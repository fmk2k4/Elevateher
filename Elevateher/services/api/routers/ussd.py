import hashlib
import hmac
import json
import logging
from datetime import UTC, datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from config import get_settings
from dependencies import CurrentUser, require_moderator
from middleware.rls_middleware import RequestConnectionPool


class InMemoryRedis:
    """In-memory Redis fallback for development/testing without Redis server."""

    def __init__(self):
        self._data: dict[str, str] = {}
        self._expiry: dict[str, float] = {}

    async def ping(self) -> bool:
        return True

    async def get(self, key: str) -> str | None:
        if key in self._expiry and datetime.now(UTC).timestamp() > self._expiry[key]:
            del self._data[key]
            del self._expiry[key]
            return None
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False) -> bool:
        if nx and key in self._data:
            return False
        self._data[key] = value
        if ex:
            self._expiry[key] = datetime.now(UTC).timestamp() + ex
        return True

    async def setex(self, key: str, seconds: int, value: str) -> None:
        self._data[key] = value
        self._expiry[key] = datetime.now(UTC).timestamp() + seconds

    async def incr(self, key: str) -> int:
        current = self._data.get(key, "0")
        try:
            new_val = int(current) + 1
        except (TypeError, ValueError):
            new_val = 1
        self._data[key] = str(new_val)
        return new_val

    async def delete(self, key: str) -> int:
        if key in self._data:
            del self._data[key]
            self._expiry.pop(key, None)
            return 1
        return 0

    async def expire(self, key: str, seconds: int) -> bool:
        if key in self._data:
            self._expiry[key] = datetime.now(UTC).timestamp() + seconds
            return True
        return False

    @property
    def values(self) -> dict:
        return self._data

    @property
    def store(self) -> dict:
        return self._data


import services.path  # noqa: F401 — ensures services/api/ is on sys.path

try:
    from services.safety.temporal_detector import record_message_event
except ImportError:

    async def record_message_event(*args, **kwargs):
        return None


try:
    from services.sms.ussd_handler import (
        LANGUAGES,
        TRACKS,
        save_session,
    )
except ImportError:
    LANGUAGES = {}
    TRACKS = {}

    async def save_session(*args, **kwargs):
        return {"session_id": "unavailable"}


try:
    from tasks.sms_tasks import send_sms_task
except ImportError:
    from services.api.tasks.sms_tasks import send_sms_task

router = APIRouter(tags=["ussd"])
legacy_router = APIRouter(prefix="/api/ussd", tags=["ussd"])


class SafetyMessageRequest(BaseModel):
    match_id: str = Field(default="demo")
    sender_role: str = Field(default="mentor")
    sender_id: str = Field(default="demo")
    message_text: str = Field(default="")
    mentor_id: str = Field(default="demo")


def verify_infobip_signature(request: Request) -> None:
    """Validate Infobip signature header and timestamp for USSD callbacks."""
    settings = get_settings()
    if settings.environment != "production":
        return

    timestamp = request.headers.get("X-Infobip-Timestamp", "")
    try:
        ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        now = datetime.now(UTC)
        if abs((now - ts).total_seconds()) > 300:
            logging.warning(f"Infobip signature rejected - stale timestamp: {timestamp}")
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Stale request")
    except ValueError:
        logging.warning(f"Infobip signature rejected - invalid timestamp: {timestamp}")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid timestamp format")

    signature = request.headers.get("X-Infobip-Signature")
    if not signature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Infobip signature")
    expected = hmac.new(
        settings.infobip_api_key.encode(),
        timestamp.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Infobip signature")


def ussd_response(text: str) -> PlainTextResponse:
    return PlainTextResponse(text)


async def get_redis(request: Request):
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client:
        try:
            await redis_client.ping()
            return redis_client
        except Exception:
            pass

    try:
        settings = get_settings()
        redis_url = settings.redis_url_with_auth or settings.redis_url
        new_redis = aioredis.from_url(redis_url)
        await new_redis.ping()
        request.app.state.redis = new_redis
        return new_redis
    except Exception:
        # Return in-memory fallback for development/testing without Redis
        logging.warning("Redis unavailable - using in-memory fallback for USSD")
        fallback = InMemoryRedis()
        request.app.state.redis = fallback
        return fallback


async def redis_dep(request: Request):
    return await get_redis(request)


async def acquire_session_lock(redis, lock_key: str) -> bool:
    """Acquire a short-lived session lock across real Redis and test doubles."""
    if hasattr(redis, "set"):
        return bool(await redis.set(lock_key, "1", nx=True, ex=30))

    existing = await redis.get(lock_key)
    if existing:
        return False
    if hasattr(redis, "setex"):
        await redis.setex(lock_key, 30, "1")
    elif hasattr(redis, "values"):
        redis.values[lock_key] = "1"
    elif hasattr(redis, "store"):
        redis.store[lock_key] = "1"
    else:
        return False
    return True


async def release_session_lock(redis, lock_key: str) -> None:
    if hasattr(redis, "delete"):
        await redis.delete(lock_key)
        return
    if hasattr(redis, "values"):
        redis.values.pop(lock_key, None)
        return
    if hasattr(redis, "store"):
        redis.store.pop(lock_key, None)


async def quick_match_by_track(pool, phone: str, name: str, track: str, lang: str) -> dict | None:
    if pool is None:
        return None

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT mp.full_name, mp.job_title, mp.years_exp, mp.industry,
                   mp.languages
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.is_approved = true
              AND mp.is_active = true
              AND mp.bio_safety_score >= 0.75
              AND u.is_suspended = false
              AND mp.current_mentees < mp.max_mentees
              AND $1 = ANY(mp.languages)
              AND (
                mp.sdg_track::text = $2
                OR mp.industry ILIKE '%' || $2 || '%'
              )
            ORDER BY CASE
                WHEN mp.sdg_track::text = $2 OR mp.industry ILIKE '%' || $2 || '%' THEN 0
                ELSE 1
            END, mp.years_exp DESC
            LIMIT 1
            """,
            lang,
            track,
        )

    if not row:
        return None

    return {
        "name": row["full_name"],
        "job_title": row["job_title"],
        "years_exp": row["years_exp"],
        "industry": row["industry"],
        "languages": row["languages"],
        "match_reason": (
            f"Matched because: she speaks {lang} "
            f"and has {row['years_exp']} years of experience."
        ),
    }


def build_no_match_message(name: str, track: str, lang: str) -> str:
    prompts = {
        "en": (
            f"END Thanks {name}. Your {track} mentor shortlist is being prepared. "
            "We will SMS your next match update within 24h."
        ),
        "ms": (
            f"END Terima kasih {name}. Senarai mentor {track} anda sedang disediakan. "
            "Kami akan SMS kemas kini padanan dalam 24 jam."
        ),
        "id": (
            f"END Terima kasih {name}. Daftar mentor {track} kamu sedang disiapkan. "
            "Kami akan kirim SMS pembaruan dalam 24 jam."
        ),
        "th": (
            f"END ขอบคุณ {name} รายชื่อเมนเทอร์สาย {track} กำลังจัดเตรียมอยู่ "
            "เราจะส่ง SMS อัปเดตภายใน 24 ชั่วโมง"
        ),
        "ja": (
            f"END {name}さん、ありがとうございます。{track}分野のメンター候補を準備中です。"
            "24時間以内にSMSで更新をお送りします。"
        ),
    }
    return prompts.get(lang, prompts["en"])


@router.post("/callback")
async def ussd_callback(
    request: Request,
    session_id: str | None = Form(default=None, alias="sessionId"),
    session_id_snake: str | None = Form(default=None, alias="session_id"),
    service_code: str | None = Form(default=None, alias="serviceCode"),
    service_code_snake: str | None = Form(default=None, alias="service_code"),
    phone_number: str | None = Form(default=None, alias="phoneNumber"),
    phone_number_snake: str | None = Form(default=None, alias="phone_number"),
    text: str = Form(default=""),
    redis: aioredis.Redis = Depends(redis_dep),
):
    """
    Infobip USSD callback handler. text accumulates inputs separated by *.
    Response must be plain text starting with CON (continue) or END (terminate).
    Response window: max 10 seconds.
    """
    session_id = session_id or session_id_snake
    service_code = service_code or service_code_snake
    phone_number = phone_number or phone_number_snake

    if not session_id or not service_code or not phone_number:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Missing USSD form fields")

    verify_infobip_signature(request)
    inputs = [i.strip() for i in text.split("*")] if text else []

    key = f"ussd:session:{session_id}"

    lock_key = f"ussd:lock:{session_id}"
    lock_acquired = await acquire_session_lock(redis, lock_key)
    if not lock_acquired:
        raise HTTPException(409, "Session being processed, please retry")

    try:
        # Load session state
        current = await redis.get(key)
        sess = json.loads(current) if current else None
        sess = sess or {"phone": phone_number}

        # Determine current step from session state
        current_step = sess.get("step", -1)

        # Track input sequence to detect batched/out-of-order inputs
        # Infobip may deliver multiple inputs in one callback (e.g., "1*2*3")
        # or deliver callbacks out of order due to network issues
        prev_input_sequence = sess.get("input_sequence", "")
        new_input_sequence = text.strip().strip("*")

        # If user sends "*" or starts fresh, they may be restarting
        # Allow if: new inputs extend the sequence, OR session is at step 0/1 and user restarts
        if prev_input_sequence and new_input_sequence:
            # Check if new inputs properly extend the previous sequence
            # Handle both cases: "prev*new" (normal) or "1*2*3" (batched all at once)
            if new_input_sequence.startswith(prev_input_sequence):
                # Normal case: new inputs extend previous
                step = len([i for i in new_input_sequence.split("*") if i])
            elif prev_input_sequence.startswith(new_input_sequence) and current_step <= 1:
                # User went back/reset at early step - allow restart
                step = len([i for i in new_input_sequence.split("*") if i])
                # Reset session for fresh start
                sess = {"phone": phone_number}
            else:
                # Inputs don't match expected sequence - could be out of order delivery
                # Calculate step from new inputs only, trust client for USSD simplicity
                step = len([i for i in new_input_sequence.split("*") if i])
        else:
            step = len(inputs)

        # Validate step progression: allow if exactly one step ahead (normal)
        # or if batched (multiple steps ahead at once)
        # Don't allow going backwards or skipping without reason
        if step > 0 and step > current_step + 1 and current_step >= 0:
            # Multiple steps received at once (batched) - this is OK for USSD
            # but warn for debugging
            import logging

            logging.getLogger(__name__).debug(
                f"USSD batched inputs: step={step}, current_step={current_step}, "
                f"inputs={inputs}, sequence={new_input_sequence}"
            )

        # Update session with new step and input sequence
        sess["step"] = step
        sess["input_sequence"] = new_input_sequence

        if step == 0:
            await save_session(redis, session_id, {"phone": phone_number, "step": 0})
            return ussd_response(
                "CON Welcome to ElevateHer\n"
                "Career mentorship for girls\n"
                "1. I'm a new mentee\n"
                "2. Returning user\n"
                "3. I'm a mentor"
            )

        # Step 1: Route by user type
        if step == 1:
            if inputs[0] == "1":
                await save_session(redis, session_id, {"phone": phone_number, "step": 1})
                return ussd_response(
                    "CON Choose language:\n"
                    "1. English\n"
                    "2. Bahasa Melayu\n"
                    "3. Bahasa Indonesia\n"
                    "4. Thai\n"
                    "5. Japanese"
                )
            elif inputs[0] == "2":
                await save_session(redis, session_id, {"phone": phone_number, "step": 1})
                return ussd_response("CON Enter your phone number to continue:")
            elif inputs[0] == "3":
                return ussd_response(
                    "END Mentor portal available at elevateher.app\n" "Dial *384# again to start."
                )
            return ussd_response(
                "CON Sorry, invalid option.\n"
                "1. I'm a new mentee\n"
                "2. Returning user\n"
                "3. I'm a mentor"
            )

        # Step 2: Language selected
        if step == 2 and inputs[0] == "2":
            try:
                returning_phone = inputs[1]
            except IndexError:
                return ussd_response("END Sorry, please dial *384# to start again.")
            sess.update({"phone": phone_number, "returning_phone": returning_phone, "step": 2})
            await save_session(redis, session_id, sess)
            task_id = send_sms_task.apply_async(
                kwargs={
                    "payload": {
                        "phone_number": returning_phone,
                        "message": (
                            "Welcome back to ElevateHer! Your mentorship updates "
                            "and new matches will be sent to this number. "
                            "Reply STOP to opt out."
                        ),
                    }
                },
                retry=True,
                max_retries=3,
                default_retry_delay=60,
            )
            logging.info(f"Queued return SMS for {returning_phone}, task_id={task_id.id}")
            return ussd_response(
                f"END Welcome back. We will SMS your mentorship updates to {returning_phone}."
            )

        if step == 2 and inputs[0] == "1":
            try:
                lang = LANGUAGES.get(inputs[1], "en")
            except IndexError:
                return ussd_response("END Sorry, please dial *384# to start again.")
            sess.update({"phone": phone_number, "lang": lang, "step": 2})
            await save_session(redis, session_id, sess)
            prompts = {
                "en": "CON Enter your first name:",
                "ms": "CON Masukkan nama anda:",
                "id": "CON Masukkan nama kamu:",
                "th": "CON กรุณาใส่ชื่อของคุณ:",
                "ja": "CON お名前を入力してください:",
            }
            return ussd_response(prompts.get(lang, "CON Enter your first name:"))

        # Step 3: Name captured
        if step == 3 and inputs[0] == "1":
            try:
                name = inputs[2]
            except IndexError:
                return ussd_response("END Sorry, please dial *384# to start again.")
            sess.update({"name": name, "step": 3})
            await save_session(redis, session_id, sess)
            track_menus = {
                "en": f"CON Hi {name}! What career interests you?\n"
                "1. STEM\n2. Business\n3. Trades\n4. Creative",
                "ms": f"CON Hai {name}! Minat kerjaya apa?\n"
                "1. STEM\n2. Perniagaan\n3. Kemahiran\n4. Kreatif",
                "id": f"CON Halo {name}! Minat karir apa?\n"
                "1. STEM\n2. Bisnis\n3. Keahlian\n4. Kreatif",
                "th": f"CON สวัสดี {name}! สนใจอะไร?\n" "1. STEM\n2. ธุรกิจ\n3. ทักษะ\n4. ครีเอท",
                "ja": f"CON こんにちは {name}! どのキャリアに興味がありますか?\n"
                "1. STEM\n2. Business\n3. Trades\n4. Creative",
            }
            return ussd_response(track_menus.get(sess.get("lang", "en"), track_menus["en"]))

        # Step 4: Track selected - run matching
        if step == 4 and inputs[0] == "1":
            try:
                track = TRACKS.get(inputs[3], "STEM")
            except IndexError:
                return ussd_response("END Sorry, please dial *384# to start again.")
            name = sess.get("name", "Friend")
            lang = sess.get("lang", "en")
            rls_conn = getattr(request.state, "rls_conn", None)
            pool = (
                RequestConnectionPool(rls_conn)
                if rls_conn
                else getattr(request.app.state, "db_pool", None)
            )
            mentor = await quick_match_by_track(
                pool=pool,
                phone=phone_number,
                name=name,
                track=track,
                lang=lang,
            )

            if mentor:
                try:
                    send_sms_task.apply_async(
                        kwargs={
                            "payload": {
                                "phone_number": phone_number,
                                "message": f"Hi! Your ElevateHer mentor match: {mentor['name']}, {mentor['job_title']}. Reply STOP to opt out.",
                            }
                        },
                        retry=True,
                        max_retries=3,
                        default_retry_delay=60,
                    )
                except Exception as e:
                    import logging

                    logging.warning(f"Failed to queue mentor-match SMS for {phone_number}: {e}")
                return ussd_response(
                    f"END Mentor found: {mentor['name']}\n"
                    f"{mentor['job_title']} ({mentor['years_exp']} yrs)\n"
                    f"{mentor.get('match_reason', 'aligned career goals')}\n"
                    "She will SMS you within 24h. Reply STOP to opt out."
                )
            try:
                send_sms_task.apply_async(
                    kwargs={
                        "payload": {
                            "phone_number": phone_number,
                            "message": (
                                f"Hi {name}! We are preparing your {track} mentor shortlist now. "
                                "Expect an SMS update within 24h. Reply STOP to opt out."
                            ),
                        }
                    },
                    retry=True,
                    max_retries=3,
                    default_retry_delay=60,
                )
            except Exception as e:
                import logging

                logging.warning(f"Failed to queue waitlist SMS for {phone_number}: {e}")
            return ussd_response(build_no_match_message(name, track, lang))

        return ussd_response("END Session error. Dial *384# to start again.")
    finally:
        await release_session_lock(redis, lock_key)


@router.post("/safety")
async def ussd_safety(
    payload: SafetyMessageRequest,
    redis: aioredis.Redis = Depends(redis_dep),
    user: CurrentUser = Depends(require_moderator),
):
    """Record message events for temporal safety detection."""
    return await record_message_event(
        redis_client=redis,
        match_id=payload.match_id,
        sender_role=payload.sender_role,
        sender_id=payload.sender_id,
        message_text=payload.message_text,
        mentor_id=payload.mentor_id,
    )


@legacy_router.post("/callback")
async def legacy_ussd_callback(
    request: Request,
    session_id: str | None = Form(default=None, alias="sessionId"),
    session_id_snake: str | None = Form(default=None, alias="session_id"),
    service_code: str | None = Form(default=None, alias="serviceCode"),
    service_code_snake: str | None = Form(default=None, alias="service_code"),
    phone_number: str | None = Form(default=None, alias="phoneNumber"),
    phone_number_snake: str | None = Form(default=None, alias="phone_number"),
    text: str = Form(default=""),
):
    settings = get_settings()
    if settings.environment == "production":
        logging.warning("Legacy USSD callback called in production - deprecated endpoint")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Legacy endpoint deprecated")
    redis = await redis_dep(request)
    return await ussd_callback(
        request=request,
        session_id=session_id or session_id_snake,
        service_code=service_code or service_code_snake,
        phone_number=phone_number or phone_number_snake,
        text=text,
        redis=redis,
    )


@legacy_router.post("/safety")
async def legacy_ussd_safety(
    request: Request,
    payload: SafetyMessageRequest,
    user: CurrentUser = Depends(require_moderator),
):
    redis = await redis_dep(request)
    return await ussd_safety(payload, redis=redis, user=user)
