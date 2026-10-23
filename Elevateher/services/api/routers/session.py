import asyncio
import json
import logging
import uuid

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from dependencies import (
    CurrentUser,
    get_current_user,
    get_db_pool,
    require_mentee,
    require_mentor,
)

try:
    from services.api.services.agent_service import summarise_session
except ImportError:
    try:
        from services.agent_service import summarise_session  # type: ignore[no-redef]
    except ImportError:
        async def summarise_session(*args, **kwargs):  # type: ignore[misc]
            return "Session summary unavailable."

try:
    from services.api.services.safety_service import scan_message
except ImportError:
    try:
        from services.safety_service import scan_message  # type: ignore[no-redef]
    except ImportError:
        def scan_message(message: str) -> dict:  # type: ignore[misc]
            return {"approved": True, "safe_score": 1.0, "flags": []}

try:
    from services.agent.tutor import get_tutor_response
    from services.agent.tutor_context import build_tutor_context, format_session_history
except ImportError:
    pass

logger = logging.getLogger(__name__)

router = APIRouter()


class SendMessageRequest(BaseModel):
    session_id: str = Field(..., description="Session UUID")
    content: str = Field(..., min_length=1, max_length=4000)

    @field_validator("session_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("Invalid session ID format") from None
        return v


async def _get_redis(request: Request):
    """Attempt to get Redis client from app state. Returns None if unavailable."""
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client:
        try:
            await redis_client.ping()
            return redis_client
        except Exception:
            logger.warning("Redis ping failed — temporal detection will be skipped")
    return None


async def _run_temporal_analysis(
    redis,
    match_id: str,
    sender_role: str,
    sender_id: str,
    message_text: str,
    mentor_id: str,
    pool: asyncpg.Pool = None,
) -> None:
    """
    Fire-and-forget temporal grooming detection.
    Runs after each message INSERT without blocking the API response.
    On CRITICAL alert, dispatches Celery suspension task.
    """
    try:
        try:
            from services.api.services.temporal_safety import record_and_analyse_message
        except ImportError:

            async def record_and_analyse_message(*args, **kwargs) -> dict:
                return {"alert": None, "risk_score": 0.0}

        result = await record_and_analyse_message(
            redis=redis,
            match_id=match_id,
            sender_role=sender_role,
            sender_id=sender_id,
            message_text=message_text,
            mentor_id=mentor_id,
        )
        alert = result.get("alert")
        if alert and alert.get("level") == "CRITICAL":
            try:
                from tasks.safety_tasks import handle_critical_safety_flag

                handle_critical_safety_flag.delay(
                    {
                        "mentor_id": mentor_id,
                        "match_id": match_id,
                        "reason": alert.get("reason", "Critical temporal safety signal"),
                    }
                )
                logger.warning(
                    "CRITICAL temporal alert dispatched",
                    extra={
                        "match_id": match_id,
                        "mentor_id": mentor_id,
                        "risk_score": result.get("risk_score"),
                    },
                )
            except Exception:
                logger.exception("Failed to dispatch Celery suspension for match %s", match_id)
                if pool:
                    try:
                        async with pool.acquire() as conn:
                            await conn.execute("UPDATE users SET is_suspended = true WHERE id = $1", uuid.UUID(mentor_id))
                            await conn.execute(
                                "UPDATE matches SET status = 'flagged', updated_at = now() WHERE mentor_id = $1 AND status IN ('active', 'pending')",
                                uuid.UUID(mentor_id)
                            )
                            await conn.execute(
                                """
                                INSERT INTO safety_reports (reported_user_id, match_id, reason, severity, status)
                                VALUES ($1, $2, $3, 'critical', 'open')
                                """,
                                uuid.UUID(mentor_id),
                                uuid.UUID(match_id) if match_id != "demo" else None,
                                alert.get("reason", "Critical temporal safety signal")
                            )
                        logger.warning("Applied fallback suspension for mentor %s", mentor_id)
                    except Exception as fallback_e:
                        logger.error(f"Fallback safety suspension also failed: {fallback_e}")
        elif alert:
            logger.warning(
                "Temporal safety alert: %s",
                alert.get("level"),
                extra={
                    "match_id": match_id,
                    "risk_score": result.get("risk_score"),
                    "action": alert.get("action"),
                },
            )
    except Exception:
        logger.exception("Temporal safety analysis failed for match %s — continuing", match_id)


@router.get("/my")
async def get_my_sessions(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id, s.session_num, s.channel, s.milestone_title,
                   s.completed, s.completed_at, s.agent_summary,
                   s.scheduled_at, m.sdg_track
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE m.mentee_id = $1
            ORDER BY s.session_num ASC
            """,
            uuid.UUID(user.id),
        )
    return [dict(row) for row in rows]


@router.get("")
async def get_sessions(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
    match_id: str | None = None,
):
    async with pool.acquire() as conn:
        if match_id:
            match_rows = await conn.fetch(
                """
                SELECT id FROM matches WHERE id = $1
                AND (mentee_id = $2 OR mentor_id = $2)
                LIMIT 1
                """,
                uuid.UUID(match_id),
                uuid.UUID(user.id),
            )
            if not match_rows:
                raise HTTPException(403, "Forbidden")

            rows = await conn.fetch(
                """
                SELECT s.id, s.session_num, s.channel, s.milestone_title,
                       s.completed, s.completed_at, s.agent_summary,
                       s.scheduled_at, m.sdg_track
                FROM sessions s
                JOIN matches m ON m.id = s.match_id
                WHERE s.match_id = $1
                ORDER BY s.session_num ASC
                """,
                uuid.UUID(match_id),
            )
            return {"sessions": [dict(row) for row in rows]}

        if user.role == "mentee":
            rows = await conn.fetch(
                """
                SELECT s.id, s.session_num, s.channel, s.milestone_title,
                       s.completed, s.completed_at, s.agent_summary,
                       s.scheduled_at, m.sdg_track
                FROM sessions s
                JOIN matches m ON m.id = s.match_id
                WHERE m.mentee_id = $1
                ORDER BY s.session_num ASC
                """,
                uuid.UUID(user.id),
            )
        else:
            rows = await conn.fetch(
                """
                SELECT s.id, s.session_num, s.channel, s.milestone_title,
                       s.completed, s.completed_at, s.agent_summary,
                       s.scheduled_at, m.sdg_track
                FROM sessions s
                JOIN matches m ON m.id = s.match_id
                WHERE m.mentor_id = $1
                ORDER BY s.session_num ASC
                """,
                uuid.UUID(user.id),
            )
    return {"sessions": [dict(row) for row in rows]}


@router.post("", status_code=201)
async def create_session(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    match_id = payload.get("match_id")
    channel = payload.get("channel", "web")
    milestone_title = payload.get("milestone_title")
    scheduled_at = payload.get("scheduled_at")

    if not match_id:
        raise HTTPException(400, "match_id required")

    async with pool.acquire() as conn:
        match_rows = await conn.fetch(
            """
            SELECT id FROM matches WHERE id = $1
            AND (mentee_id = $2 OR mentor_id = $2)
            AND status = 'active'
            LIMIT 1
            """,
            uuid.UUID(match_id),
            uuid.UUID(user.id),
        )
        if not match_rows:
            raise HTTPException(404, "Match not found or not active")

        count_rows = await conn.fetch(
            "SELECT COUNT(*) AS cnt FROM sessions WHERE match_id = $1",
            uuid.UUID(match_id),
        )
        session_num = int(count_rows[0]["cnt"]) + 1

        if session_num > 12:
            raise HTTPException(400, "Maximum 12 sessions per programme")

        new_session = await conn.fetchrow(
            """
            INSERT INTO sessions (match_id, session_num, channel, milestone_title, scheduled_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            uuid.UUID(match_id),
            session_num,
            channel,
            milestone_title or f"Session {session_num}",
            scheduled_at or None,
        )

    return {"session": dict(new_session)}


@router.get("/mentor/my")
async def get_my_mentor_sessions(
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id, s.session_num, s.channel, s.milestone_title,
                   s.completed, s.completed_at, s.agent_summary,
                   s.scheduled_at, m.sdg_track
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE m.mentor_id = $1
            ORDER BY s.session_num ASC
            """,
            uuid.UUID(user.id),
        )
    return [dict(row) for row in rows]


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.*,
                   m.sdg_track,
                   mentee_p.full_name as mentee_name,
                   mentor_p.full_name as mentor_name,
                   m.mentee_id,
                   m.mentor_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            JOIN mentee_profiles mentee_p ON mentee_p.user_id = m.mentee_id
            JOIN mentor_profiles mentor_p ON mentor_p.user_id = m.mentor_id
            WHERE s.id = $1
            """,
            uuid.UUID(session_id),
        )
        if not row:
            raise HTTPException(404, "Session not found")
        if row["mentee_id"] != uuid.UUID(user.id) and row["mentor_id"] != uuid.UUID(user.id):
            raise HTTPException(403, "Forbidden")

        other_party_name = row["mentor_name"] if user.role == "mentee" else row["mentee_name"]

        return {"session": dict(row), "other_party_name": other_party_name}


@router.get("/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id, m.mentee_id, m.mentor_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1
            """,
            uuid.UUID(session_id),
        )
        if not row:
            raise HTTPException(404, "Session not found.")
        if row["mentee_id"] != uuid.UUID(user.id) and row["mentor_id"] != uuid.UUID(user.id):
            raise HTTPException(403, "You are not allowed to view this session.")
        mentor_row = await conn.fetchrow(
            "SELECT is_approved FROM mentor_profiles WHERE user_id = $1",
            row["mentor_id"],
        )
        if not mentor_row or not mentor_row["is_approved"]:
            raise HTTPException(403, "Mentor account not approved or inactive.")
        rows = await conn.fetch(
            """
            SELECT id, session_id, sender_id, sender_role, content, safety_score,
                   safety_flags, is_flagged, sent_at
            FROM session_messages
            WHERE session_id = $1
            ORDER BY sent_at ASC, id ASC
            """,
            uuid.UUID(session_id),
        )
    return [dict(row) for row in rows]


@router.post("/messages", status_code=201)
async def create_session_message(
    payload: SendMessageRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    session_id = payload.session_id
    content = payload.content

    sender_role = "mentor" if user.role == "mentor" else "mentee"
    if user.role not in ("mentor", "mentee"):
        raise HTTPException(403, "Only mentors and mentees can write session messages.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id, m.id AS match_id, m.mentee_id, m.mentor_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1
            """,
            uuid.UUID(session_id),
        )
        if not row:
            raise HTTPException(404, "Session not found.")
        if row["mentee_id"] != uuid.UUID(user.id) and row["mentor_id"] != uuid.UUID(user.id):
            raise HTTPException(403, "You are not allowed to write to this session.")
        if sender_role == "mentor":
            mentor_row = await conn.fetchrow(
                "SELECT is_approved, is_active FROM mentor_profiles WHERE user_id = $1",
                uuid.UUID(user.id),
            )
            if not mentor_row:
                raise HTTPException(403, "Mentor profile not found.")
            if not mentor_row["is_approved"]:
                raise HTTPException(403, "Mentor account not yet approved.")
            if not mentor_row["is_active"]:
                raise HTTPException(403, "Mentor account is inactive.")

        safety_result = scan_message(content)
        message = await conn.fetchrow(
            """
            INSERT INTO session_messages
                (session_id, sender_id, sender_role, content, safety_flags,
                 safety_score, is_flagged)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, session_id, sender_id, sender_role, content, safety_score,
                      safety_flags, is_flagged, sent_at
            """,
            uuid.UUID(session_id),
            uuid.UUID(user.id),
            sender_role,
            content,
            safety_result["flags"],
            safety_result["safe_score"],
            safety_result["safe_score"] < 0.75,
        )

        if message["is_flagged"]:
            other_id = await conn.fetchval(
                """
                SELECT mentor_id FROM matches m WHERE m.id = $1 AND $2 != m.mentor_id
                UNION ALL
                SELECT mentee_id FROM matches m WHERE m.id = $1 AND $2 != m.mentee_id
                LIMIT 1
                """,
                uuid.UUID(session_id),
                uuid.UUID(user.id),
            )
            if other_id:
                await conn.execute(
                    """
                    INSERT INTO safety_reports
                    (reporter_id, reported_user_id, session_id, reason, severity, status)
                    VALUES ($1, $2, $3, 'flagged_message', 'medium', 'open')
                    """,
                    uuid.UUID(user.id),
                    other_id,
                    uuid.UUID(session_id),
                )
                logger.warning(
                    "Flagged message auto-reported",
                    extra={
                        "reporter_id": user.id,
                        "reported_user_id": str(other_id),
                        "message_id": str(message["id"]),
                    },
                )

    # ── Temporal grooming detection (fire-and-forget) ──────────────────────────
    # Runs asynchronously — never blocks the message send response.
    # Redis unavailability is caught inside _run_temporal_analysis and logged.
    match_id = str(row["match_id"])
    mentor_id = str(row["mentor_id"])
    redis_client = await _get_redis(request)
    if redis_client is not None:
        asyncio.create_task(
            _run_temporal_analysis(
                redis=redis_client,
                match_id=match_id,
                sender_role=sender_role,
                sender_id=user.id,
                message_text=content,
                mentor_id=mentor_id,
                pool=pool,
            )
        )
    else:
        logger.warning(
            "Temporal safety skipped — Redis unavailable",
            extra={"match_id": match_id},
        )

    response = dict(message)
    # Serialize datetime for json
    response["sent_at"] = response["sent_at"].isoformat() if response.get("sent_at") else None
    response["temporal_risk_score"] = None  # populated asynchronously via Redis

    if redis_client:
        try:
            await redis_client.publish(
                f"session_messages:{session_id}",
                json.dumps({"type": "new_message", "message": response}),
            )
        except Exception as e:
            logger.error(f"Failed to publish new message to Redis: {e}")

    return response


@router.get("/{session_id}/stream")
async def session_stream(
    session_id: str,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id, m.mentee_id, m.mentor_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1
            """,
            uuid.UUID(session_id),
        )
        if not row:
            raise HTTPException(404, "Session not found")
        if row["mentee_id"] != uuid.UUID(user.id) and row["mentor_id"] != uuid.UUID(user.id):
            raise HTTPException(403, "You are not allowed to view this session")

    redis_client = await _get_redis(request)
    if not redis_client:
        raise HTTPException(503, "Real-time updates unavailable")

    async def event_generator():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"session_messages:{session_id}")
        try:
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    data = msg["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"
                await asyncio.sleep(1)
        finally:
            await pubsub.unsubscribe(f"session_messages:{session_id}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{session_id}/complete")
async def complete_session(
    session_id: str,
    payload: dict | None = Body(default=None),
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    payload = payload or {}
    mentor_notes = payload.get("mentor_notes")
    mentee_notes = payload.get("mentee_notes")
    milestone_reached = bool(payload.get("milestone_reached", False))
    duration_minutes = payload.get("duration_minutes")

    if user.role not in ("mentor", "mentee"):
        raise HTTPException(403, "Only mentors and mentees can complete sessions.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id, s.session_num, s.match_id, m.mentee_id, m.mentor_id, m.sdg_track
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1
            AND (m.mentee_id = $2 OR m.mentor_id = $2)
            """,
            uuid.UUID(session_id),
            uuid.UUID(user.id),
        )
        if not row:
            raise HTTPException(404, "Session not found.")

        is_mentor = str(row["mentor_id"]) == user.id
        await conn.execute(
            """
            UPDATE sessions SET
              completed=true,
              completed_at=now(),
              mentor_notes=$1,
              mentee_notes=$2,
              milestone_reached=$3,
              duration_minutes=$4
            WHERE id=$5
            """,
            mentor_notes if is_mentor and mentor_notes else None,
            mentee_notes if not is_mentor and mentee_notes else None,
            milestone_reached,
            duration_minutes if duration_minutes is not None else None,
            uuid.UUID(session_id),
        )

        if milestone_reached and row["match_id"]:
            try:
                # Phase 6: determine connectivity_class from session channel
                session_channel = row.get("channel", "web")
                connectivity_class: str
                if session_channel in ("sms", "ussd"):
                    connectivity_class = "offline"
                elif session_channel == "offline-first":
                    connectivity_class = "low_connectivity"
                else:
                    connectivity_class = "online"
                # Source is the channel that delivered the session
                source: str = session_channel if session_channel != "web" else "web"

                await conn.execute(
                    """
                    INSERT INTO impact_events
                        (user_id, match_id, session_id, event_type, sdg_goal,
                         sdg_track, description,
                         source, evidence_type, confidence, reviewer_status,
                         connectivity_class, is_verified)
                    VALUES ($1, $2, $3, 'milestone_reached', '4.4', $4, $5,
                            $6, 'session_record', 'high', 'verified',
                            $7, true)
                    """,
                    row["mentee_id"],
                    row["match_id"],
                    uuid.UUID(session_id),
                    row["sdg_track"] or "STEM",
                    f"Milestone reached in Session {row['session_num']}",
                    source,
                    connectivity_class,
                )
            except Exception:
                logger.exception("Failed to record milestone impact event")

        updated = await conn.fetchrow(
            "SELECT * FROM sessions WHERE id = $1",
            uuid.UUID(session_id),
        )

    return {"session": dict(updated) if updated else None, "success": True}


@router.post("/{session_id}/summarise")
async def summarise_session_endpoint(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Generate AI summary for a completed session.

    Fetches session messages, generates a summary using the agent summariser,
    and updates the session record with the results.
    """
    async with pool.acquire() as conn:
        # Get session with match info and verify access
        row = await conn.fetchrow(
            """
            SELECT s.id, s.session_num, s.match_id, m.sdg_track,
                   m.mentee_id, m.mentor_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1
            AND (m.mentee_id = $2 OR m.mentor_id = $2)
            """,
            uuid.UUID(session_id),
            uuid.UUID(user.id),
        )
        if not row:
            raise HTTPException(404, "Session not found.")

        # Fetch messages for summarisation
        messages = await conn.fetch(
            """
            SELECT sender_role, content, sent_at
            FROM session_messages
            WHERE session_id = $1 AND is_flagged = false
            ORDER BY sent_at ASC
            LIMIT 50
            """,
            uuid.UUID(session_id),
        )

        if not messages:
            return {
                "summary": "Session has no messages to summarise yet.",
                "questions": [
                    "What specific steps did you take this week toward your career goal?",
                    "What challenge do you want to focus on in our next session?",
                    "Which skill would you like to develop further?",
                ],
                "milestone_reached": False,
                "sdg_goals_covered": ["4.4"],
                "mentee_sentiment": "neutral",
            }

        # Build message dicts for summariser
        msg_list = [{"sender_role": m["sender_role"], "content": m["content"]} for m in messages]

        track = row["sdg_track"] or "STEM"
        session_num = row["session_num"] or 1

        # Generate summary using agent summariser
        result = await summarise_session(
            messages=msg_list,
            track=track,
            session_num=session_num,
        )

        # Update session with summary
        await conn.execute(
            """
            UPDATE sessions SET
                agent_summary = $1,
                agent_questions = $2,
                milestone_reached = $3
            WHERE id = $4
            """,
            result.summary,
            result.questions,
            result.milestone_reached,
            uuid.UUID(session_id),
        )

        return {
            "summary": result.summary,
            "questions": result.questions,
            "milestone_reached": result.milestone_reached,
            "sdg_goals_covered": result.sdg_goals_covered,
            "mentee_sentiment": result.mentee_sentiment,
        }


class ChatAIRequest(BaseModel):
    message: str = Field(description="The user's incoming message to the tutor")


@router.post("/{session_id}/chat-ai", status_code=200)
async def ai_tutor_respond(
    session_id: str,
    payload: ChatAIRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Interact with the AI Tutor (Ela) during a session.
    Safety-scans the user message, builds long-term context, fetches AI response,
    and returns a stream (SSE) or JSON fallback.
    """
    # 1. Verify access & get session details
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id, s.session_num, s.match_id, m.sdg_track, m.mentee_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1 AND (m.mentee_id = $2 OR m.mentor_id = $2)
            """,
            uuid.UUID(session_id),
            uuid.UUID(user.id),
        )
        if not row:
            raise HTTPException(404, "Session not found or access denied.")

        match_id = str(row["match_id"])
        mentee_id = str(row["mentee_id"])
        session_num = row["session_num"] or 1
        sdg_track = row["sdg_track"] or "STEM"

        # 2. Safety Scan the incoming message BEFORE processing
        scan_res = scan_message(payload.message)
        if not scan_res["approved"]:
            return {"error": "Message flagged by safety system.", "tutor_response": None}

        # 3. Build Tutor Context (prior milestones & summaries)
        try:
            ctx = await build_tutor_context(conn, match_id, session_num, mentee_id)
        except Exception as e:
            logger.error(f"Failed to build tutor context: {e}")
            ctx = {
                "mentee_name": "there",
                "career_goal": "your goals",
                "sdg_track": sdg_track,
                "context_text": "",
            }

        # 4. Fetch recent chat history
        messages = await conn.fetch(
            """
            SELECT sender_role, content, sent_at
            FROM session_messages
            WHERE session_id = $1 AND is_flagged = false
            ORDER BY sent_at DESC
            LIMIT 20
            """,
            uuid.UUID(session_id),
        )
        # Reverse to chronological
        messages = list(reversed(messages))
        msg_dicts = [{"sender_role": m["sender_role"], "content": m["content"]} for m in messages]

        # Include the current message in the transcript if it's not already saved
        msg_dicts.append({"sender_role": user.role, "content": payload.message})

        try:
            transcript = format_session_history(msg_dicts)
        except Exception:
            transcript = ""

        # 5. Get AI Response
        tutor_res = await get_tutor_response(
            mentee_name=ctx.get("mentee_name", "there"),
            career_goal=ctx.get("career_goal", "your goals"),
            sdg_track=ctx.get("sdg_track", sdg_track),
            session_num=session_num,
            context_text=ctx.get("context_text", ""),
            transcript=transcript,
        )

        # 6. Save Tutor Response to DB
        await conn.execute(
            """
            INSERT INTO session_messages (session_id, sender_id, sender_role, content)
            VALUES ($1, NULL, 'tutor', $2)
            """,
            uuid.UUID(session_id),
            tutor_res.message,
        )

        # TODO: If tutor_res.should_nudge_mentor is True, trigger an SMS to the mentor

        # Return as StreamingResponse to provide typing effect in UI
        async def event_generator():
            yield f"data: {json.dumps({'type': 'metadata', 'reasoning': getattr(tutor_res, 'reasoning', None), 'coaching_type': tutor_res.coaching_type})}\n\n"

            chunk_size = 4
            msg = tutor_res.message
            for i in range(0, len(msg), chunk_size):
                chunk = msg[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                await asyncio.sleep(0.01)

            yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
