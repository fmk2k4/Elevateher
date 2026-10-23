import asyncio
import uuid

# ── Ensure proper import paths ─────────────────────────────────────────────────
import services.path  # noqa: F401
from config import get_settings
from db_pool import get_pool
from services.agent_service import summarise_session as _summarise_session

from .celery_app import celery_app

settings = get_settings()


@celery_app.task(name="tasks.agent_tasks.summarise_session")
def summarise_session_task(payload: dict):
    """
    Celery task: generate session summary using Phi-3 in-process inference.

    Payload keys:
        session_id   (str, required)
        messages     (list[dict], required)
        track        (str, optional, default STEM)
        session_num  (int, optional, default 1)
    """

    async def run():
        messages = payload.get("messages", [])
        session_id = payload.get("session_id")
        track = payload.get("track", "STEM")
        session_num = int(payload.get("session_num", 1))

        summary = await _summarise_session(
            messages=messages,
            track=track,
            session_num=session_num,
        )
        async with get_pool() as pool:
            if session_id:
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE sessions
                        SET agent_summary = $2,
                            milestone_reached = $3,
                            updated_at = now()
                        WHERE id = $1
                        """,
                        uuid.UUID(session_id),
                        summary["summary"],
                        summary["milestone_reached"],
                    )
        return {"session_id": session_id, **summary}

    return asyncio.run(run())


@celery_app.task(name="tasks.agent_tasks.generate_weekly_brief")
def generate_weekly_brief_task(payload: dict):
    from services.agent_service import generate_weekly_brief as _generate_weekly_brief

    async def run():
        events = payload.get("events")
        if events is None:
            async with get_pool() as pool:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        """
                        SELECT sdg_track, event_type, recorded_at
                        FROM impact_events
                        WHERE recorded_at >= now() - interval '7 days'
                        ORDER BY recorded_at DESC
                        LIMIT 100
                        """
                    )
                    events = [dict(row) for row in rows]
        brief = await _generate_weekly_brief(events)
        return brief

    return asyncio.run(run())
