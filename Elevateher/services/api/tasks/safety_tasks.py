import asyncio
import uuid

import asyncpg
import redis.asyncio as aioredis

# ── Ensure proper import paths BEFORE any service imports ─────────────────────
import services.path  # noqa: F401
from config import get_settings
from db_pool import get_pool
from services.safety.temporal_detector import record_message_event, take_risk_snapshot

try:
    from services.api.services.safety_service import scan_bio, scan_message
except ImportError:

    def scan_bio(bio: str) -> dict:
        return {
            "approved": False,
            "safe_score": 0.5,
            "flags": [],
            "requires_human_review": False,
            "content_hash": "",
        }

    def scan_message(message: str) -> dict:
        return {
            "approved": False,
            "safe_score": 0.5,
            "flags": [],
            "requires_human_review": False,
            "content_hash": "",
        }


try:
    from services.api.services.sms_service import send_email
except ImportError:

    async def send_email(*args, **kwargs) -> None:
        pass


from .celery_app import celery_app, logger

settings = get_settings()


@celery_app.task(name="tasks.safety_tasks.scan_bio")
def scan_bio_task(user_id: str, bio: str):
    async def run():
        result = scan_bio(bio)
        async with get_pool() as pool:
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE mentor_profiles
                    SET bio_safety_score = $2,
                        bio_flags = $3,
                        bio_scanned_at = now(),
                        verification_status = 'pending_admin_review'
                    WHERE user_id = $1
                    """,
                    user_id,
                    result["safe_score"],
                    result["flags"],
                )
        return {"user_id": user_id, **result}

    return asyncio.run(run())


@celery_app.task(name="tasks.safety_tasks.scan_message")
def scan_message_task(payload: dict):
    async def run():
        result = scan_message(payload.get("message_text", ""))
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        profile = await record_message_event(
            redis_client=redis_client,
            match_id=str(payload.get("match_id", "demo")),
            sender_role=str(payload.get("sender_role", "unknown")),
            sender_id=str(payload.get("sender_id", "unknown")),
            message_text=str(payload.get("message_text", "")),
            mentor_id=str(payload.get("mentor_id", "unknown")),
        )
        await redis_client.aclose()
        return {
            "result": result,
            "risk_score": profile.risk_score,
            "profile": profile.__dict__,
        }

    return asyncio.run(run())


@celery_app.task(name="tasks.safety_tasks.scan_mentor_bio")
def scan_mentor_bio_task(user_id: str, bio: str):
    return scan_bio_task(user_id, bio)


@celery_app.task(name="tasks.safety_tasks.handle_critical_safety_flag")
def handle_critical_safety_flag(payload: dict):
    async def run():
        mentor_id = payload.get("mentor_id") or payload.get("user_id")
        match_id = str(payload.get("match_id", "demo"))
        reason = str(payload.get("reason", "Critical safety signal detected"))
        reporter_id: str | None = payload.get("reporter_id")

        if not mentor_id:
            logger.error("handle_critical_safety_flag called without mentor_id")
            return {"error": "missing mentor_id"}

        mentor_uuid = uuid.UUID(mentor_id)
        try:
            match_uuid = uuid.UUID(match_id) if match_id != "demo" else None
        except ValueError:
            match_uuid = None

        async with get_pool() as pool:
            async with pool.acquire() as conn:
                role = await conn.fetchval("SELECT role FROM users WHERE id = $1", mentor_uuid)
                if role != "mentor":
                    logger.warning(f"Safety flag on non-mentor user: {mentor_id}")
                    return {"error": "user is not a mentor"}

                async with conn.transaction():
                    if reporter_id:
                        await conn.execute(
                            """
                            INSERT INTO safety_reports
                                (reporter_id, reported_user_id, match_id, reason, severity, status)
                            VALUES ($1, $2, $3, $4, 'critical', 'open')
                            """,
                            uuid.UUID(reporter_id),
                            mentor_uuid,
                            match_uuid,
                            reason,
                        )
                    await conn.execute(
                        "UPDATE users SET is_suspended = true WHERE id = $1",
                        mentor_uuid,
                    )
                    await conn.execute(
                        """
                        UPDATE matches
                        SET status = 'flagged', updated_at = now()
                        WHERE mentor_id = $1 AND status IN ('active', 'pending')
                        """,
                        mentor_uuid,
                    )
        await send_email(
            to="safety@elevateher.app",
            subject="Critical safety alert",
            html=f"<p>Mentor {mentor_id} was suspended for: {reason}</p>",
        )
        return {"suspended": True, "mentor_id": mentor_id, "match_id": match_id}

    return asyncio.run(run())


@celery_app.task(name="tasks.safety_tasks.snapshot_temporal_risks")
def snapshot_temporal_risks_task():
    async def run():
        snapshots = []
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with get_pool() as pool:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, mentor_id
                    FROM matches
                    WHERE status IN ('pending', 'active')
                    ORDER BY updated_at DESC
                    LIMIT 100
                    """
                )
                for row in rows:
                    snapshot = await take_risk_snapshot(
                        pool=pool,
                        redis_client=redis_client,
                        match_id=str(row["id"]),
                        mentor_id=str(row["mentor_id"]),
                    )
                    if snapshot:
                        snapshots.append(snapshot)
        await redis_client.aclose()
        return {"snapshots": snapshots, "count": len(snapshots)}

    return asyncio.run(run())


@celery_app.task(name="tasks.safety_tasks.notify_admin_bio_failure")
def notify_admin_bio_failure_task(user_id: str, reason: str):
    async def run():
        await send_email(
            to="safety@elevateher.app",
            subject="Mentor bio requires review",
            html=f"<p>Mentor {user_id} bio requires review: {reason}</p>",
        )
        return {"notified": True, "user_id": user_id}

    return asyncio.run(run())


@celery_app.task(name="tasks.safety_tasks.check_pending_scans")
def check_pending_scans():
    """Timeout handler - mark stale pending scans for manual review."""

    async def run():
        pool = await asyncpg.create_pool(get_settings().database_url, min_size=1, max_size=2)
        async with pool.acquire() as conn:
            result = await conn.fetch(
                """
                UPDATE mentor_profiles
                SET verification_status = 'pending_manual_review',
                    requires_human_review = true
                WHERE verification_status = 'pending_id'
                AND created_at < now() - interval '15 minutes'
                AND (bio_safety_score IS NULL OR bio_safety_score = 0)
                RETURNING user_id
                """
            )
            for row in result:
                logger.warning(
                    f"Mentor {row['user_id']} timed out in pending_id, flagged for manual review"
                )
        await pool.close()

    return asyncio.run(run())
