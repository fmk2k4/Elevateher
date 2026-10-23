import asyncio
import uuid

import redis

from config import get_settings
from db_pool import get_pool

try:
    from services.api.services.sms_service import send_sms
except ImportError:
    from services.sms_service import send_sms

from .celery_app import celery_app

settings = get_settings()
REDIS_URL = settings.redis_url


@celery_app.task(
    name="tasks.sms_tasks.send_sms",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_sms_task(self, payload: dict):
    try:

        async def run():
            return await send_sms(payload["phone_number"], payload["message"])

        return asyncio.run(run())
    except Exception as e:
        raise self.retry(exc=e)  # noqa: B904 — Celery retry pattern preserves exception context


@celery_app.task(name="tasks.sms_tasks.send_match_confirmed_sms")
def send_match_confirmed_sms(match_id: str):
    async def run():
        r = redis.from_url(REDIS_URL, decode_responses=True)
        cache_key = f"sms:match_confirmed:{match_id}"
        if r.exists(cache_key):
            r.close()
            return {"status": "already_sent", "match_id": match_id}

        async with get_pool() as pool:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT m.id, u.phone_number
                    FROM matches m
                    JOIN users u ON u.id = m.mentee_id
                    WHERE m.id = $1
                    """,
                    uuid.UUID(match_id),
                )
        if not row:
            r.close()
            return {"sent": False, "match_id": match_id, "reason": "match_not_found"}
        message = "ElevateHer: Your mentorship match has been confirmed. You can now start messaging your mentor."
        result = await send_sms(row["phone_number"], message)
        r.setex(cache_key, 86400, "1")
        r.close()
        return {"match_id": match_id, **result}

    return asyncio.run(run())


@celery_app.task(name="tasks.sms_tasks.notify_mentor_approved")
def notify_mentor_approved(mentor_user_id: str):
    async def run():
        async with get_pool() as pool:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                SELECT u.phone_number
                FROM users u
                WHERE u.id = $1
                """,
                    uuid.UUID(mentor_user_id),
                )
        if not row:
            return {
                "sent": False,
                "mentor_user_id": mentor_user_id,
                "reason": "mentor_not_found",
            }
        result = await send_sms(
            row["phone_number"],
            "ElevateHer: Your mentor application has been approved. You can now access your mentor dashboard.",
        )
        return {"mentor_user_id": mentor_user_id, **result}

    return asyncio.run(run())


notify_mentor_approved_task = notify_mentor_approved


@celery_app.task(
    name="tasks.sms_tasks.notify_mentor_of_match",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def notify_mentor_of_match(self, match_id: str):
    async def run():
        async with get_pool() as pool:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """SELECT u.id AS mentor_user_id, u.phone_number AS phone, mp.full_name AS mentor_name
                         FROM matches m
                         JOIN users u ON u.id = m.mentor_id
                         LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
                        WHERE m.id = $1""",
                    uuid.UUID(match_id),
                )
                if not row:
                    return {"match_id": match_id, "sent": False, "reason": "match_not_found"}
                message = "ElevateHer: A new mentee has accepted your mentorship invitation. Log in to start your session."
                sent = await send_sms(row["phone"], message)
                return {"match_id": match_id, "mentor_id": str(row["mentor_user_id"]), **sent}

    return asyncio.run(run())
