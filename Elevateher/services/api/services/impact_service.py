import uuid
from typing import Literal

import asyncpg

from config import get_settings
from db_pool import get_pool

settings = get_settings()


async def record_impact_event(
    user_id: str,
    event_type: str,
    sdg_goal: str,
    sdg_track: str,
    institution_id: str | None = None,
    pool: asyncpg.Pool | None = None,
    # ── Phase 6 provenance fields ─────────────────────────────────────────────
    source: Literal[
        "web", "ussd", "moderator", "auto-inferred", "mentor-confirmed"
    ] = "auto-inferred",
    evidence_type: str = "session_record",
    confidence: Literal["high", "medium", "low"] = "high",
    reviewer_status: Literal["pending", "verified", "flagged"] = "pending",
    connectivity_class: Literal["online", "low_connectivity", "offline"] = "online",
    match_id: str | None = None,
    session_id: str | None = None,
    description: str | None = None,
) -> dict:
    """
    Record an impact event with full Phase 6 provenance traceability.

    Args:
        source:             Channel that originated the event
        evidence_type:       Type of supporting evidence
        confidence:         Data quality level
        reviewer_status:     Moderation state
        connectivity_class: Delivery channel class (online|low_connectivity|offline)
        match_id:           Associated match (optional)
        session_id:         Associated session (optional)
        description:        Human-readable event description
    """
    event_uuid = uuid.uuid4()
    close_pool = False
    if pool is None:
        pool = get_pool()
        close_pool = True
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO impact_events
                    (id, user_id, institution_id, match_id, session_id,
                     event_type, sdg_goal, sdg_track, description,
                     source, evidence_type, confidence, reviewer_status,
                     connectivity_class, recorded_at)
                VALUES ($1, $2, $3, $4, $5, $6::impact_event_type, $7, $8::sdg_track, $9,
                        $10, $11, $12, $13, $14, now())
                RETURNING id, user_id, institution_id, match_id, session_id,
                          event_type, sdg_goal, sdg_track, description,
                          source, evidence_type, confidence, reviewer_status,
                          connectivity_class, recorded_at
                """,
                event_uuid,
                uuid.UUID(user_id),
                uuid.UUID(institution_id) if institution_id else None,
                uuid.UUID(match_id) if match_id else None,
                uuid.UUID(session_id) if session_id else None,
                event_type,
                sdg_goal,
                sdg_track,
                description,
                source,
                evidence_type,
                confidence,
                reviewer_status,
                connectivity_class,
            )
            return dict(row)
    finally:
        if close_pool:
            await pool.close()
