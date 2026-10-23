import asyncio
import json
import logging
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from dependencies import CurrentUser, get_current_user, get_db_pool, get_redis

try:
    from services.api.services.impact_service import record_impact_event
except ImportError:

    async def record_impact_event(*args, **kwargs) -> dict:
        """Fallback when impact service is unavailable."""
        return {"error": "impact_service unavailable"}


router = APIRouter(prefix="/impact", tags=["impact"])
logger = logging.getLogger(__name__)

SSE_MAX_CONNECTIONS_PER_USER = 3
SSE_CONNECTION_WINDOW_MINUTES = 60


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


async def _resolve_institution_id(pool: asyncpg.Pool, institution_id: str) -> str:
    if _is_uuid(institution_id):
        return str(uuid.UUID(institution_id))

    normalized = str(institution_id).strip().lower()
    aliases = {
        "inti": "inti-university-malaysia",
        "nyp-singapore": "nyp",
        "binus-indonesia": "binus",
    }
    lookup = aliases.get(normalized, normalized)

    async with pool.acquire() as conn:
        inst_row = await conn.fetchrow(
            "SELECT id FROM institutions WHERE subdomain = $1",
            lookup,
        )

    if not inst_row:
        raise HTTPException(404, "Institution not found.")

    return str(inst_row["id"])


async def _resolve_and_require_institution_access(
    pool: asyncpg.Pool,
    institution_id: str,
    user: CurrentUser,
) -> str:
    resolved_institution_id = await _resolve_institution_id(pool, institution_id)
    _require_institution_access(resolved_institution_id, user)
    return resolved_institution_id


class CreateImpactEventRequest(BaseModel):
    """Phase 6: all provenance fields are now explicit on the API."""

    event_type: str = Field(..., min_length=1, max_length=50)
    sdg_goal: str = Field(..., pattern=r"^(4\.4|5\.5|8\.6|4\.1|17\.16)$")
    sdg_track: str = Field(default="STEM", max_length=20)
    description: str | None = Field(default=None, max_length=500)
    institution_id: str | None = None
    # Provenance fields
    source: str = Field(default="web")
    evidence_type: str = Field(default="session_record")
    confidence: str = Field(default="high")
    reviewer_status: str = Field(default="pending")
    connectivity_class: str = Field(default="online")
    match_id: str | None = None
    session_id: str | None = None


@router.post("/events")
async def create_impact_event(
    payload: CreateImpactEventRequest,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    institution_id = payload.institution_id or user.institution_id
    if (
        institution_id
        and institution_id != user.institution_id
        and user.role not in ("admin", "institution_admin", "moderator")
    ):
        raise HTTPException(403, "You are not allowed to record impact for this institution.")
    return await record_impact_event(
        user_id=user.id,
        event_type=payload.event_type,
        sdg_goal=payload.sdg_goal,
        sdg_track=payload.sdg_track,
        institution_id=institution_id,
        pool=pool,
        source=payload.source,
        evidence_type=payload.evidence_type,
        confidence=payload.confidence,
        reviewer_status=payload.reviewer_status,
        connectivity_class=payload.connectivity_class,
        match_id=payload.match_id,
        session_id=payload.session_id,
        description=payload.description,
    )


@router.get("/events")
async def list_impact_events(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "SELECT id FROM users WHERE id = $1 LIMIT 1",
            user.id,
        )
        if not user_row:
            return {"events": [], "summary": []}

        events = await conn.fetch(
            """
            SELECT ie.*,
              i.name as institution_name
            FROM impact_events ie
            LEFT JOIN institutions i ON i.id = ie.institution_id
            WHERE ie.user_id = $1
            ORDER BY ie.recorded_at DESC
            LIMIT 30
            """,
            user_row["id"],
        )

        summary = await conn.fetch(
            """
            SELECT sdg_goal, COUNT(*) as count
            FROM impact_events
            WHERE user_id = $1
            GROUP BY sdg_goal
            ORDER BY sdg_goal
            """,
            user_row["id"],
        )

    return {"events": [dict(row) for row in events], "summary": [dict(row) for row in summary]}


@router.get("/report/{institution_id}")
async def generate_impact_report(
    institution_id: str,
    period_start: date = Query(...),
    period_end: date = Query(...),
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if user.role not in ("admin", "institution_admin", "moderator"):
        raise HTTPException(403, "Insufficient permissions.")
    if str(user.institution_id or "") != institution_id and user.role != "admin":
        raise HTTPException(403, "You can only access reports for your own institution.")

    resolved_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee' AND NOT u.is_deleted
                ) AS total_mentees,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee' AND u.country IN ('MY','ID','TH')
                ) AS sea_mentees,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS completed_matches,
                COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '4.4') AS sdg_4_events,
                COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '5.5') AS sdg_5_events,
                COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '8.6') AS sdg_8_events,
                COUNT(DISTINCT s.id) FILTER (
                    WHERE s.channel IN ('sms','ussd')
                ) AS offline_sessions,
                COUNT(DISTINCT s.id) FILTER (WHERE s.channel = 'web') AS online_sessions,
                ROUND(AVG(m.match_score)::numeric, 3) AS avg_match_quality
            FROM users u
            LEFT JOIN matches m ON m.mentee_id = u.id
            LEFT JOIN impact_events ie ON ie.user_id = u.id AND ie.institution_id = $1
            LEFT JOIN sessions s ON s.match_id = m.id
            WHERE u.institution_id = $1
              AND u.created_at BETWEEN $2 AND $3
            """,
            resolved_institution_id,
            period_start,
            period_end,
        )

    total_sessions = (row["offline_sessions"] or 0) + (row["online_sessions"] or 0)
    offline_pct = (
        round((row["offline_sessions"] or 0) / total_sessions * 100, 1) if total_sessions else 0
    )

    return {
        "institution_id": resolved_institution_id,
        "period": {"start": str(period_start), "end": str(period_end)},
        "headline": {
            "total_mentees": row["total_mentees"],
            "sea_mentees": row["sea_mentees"],
            "completed_programmes": row["completed_matches"],
            "avg_match_quality": row["avg_match_quality"],
        },
        "sdg_impact": {
            "SDG_4_quality_education": {
                "target": "4.4 — Skills for employment",
                "events": row["sdg_4_events"],
                "description": "Milestones completed in career skills development",
            },
            "SDG_5_gender_equality": {
                "target": "5.5 — Women's full participation",
                "events": row["sdg_5_events"],
                "description": "Gender equity milestones: networking, negotiation, leadership",
            },
            "SDG_8_decent_work": {
                "target": "8.6 — Employment for youth",
                "events": row["sdg_8_events"],
                "description": "Career entries, job offers, apprenticeships recorded",
            },
        },
        "digital_inclusion": {
            "offline_sessions": row["offline_sessions"],
            "online_sessions": row["online_sessions"],
            "offline_percentage": offline_pct,
            "narrative": (
                f"{offline_pct}% of sessions delivered via SMS/USSD — "
                f"reaching girls with zero smartphone or internet access."
            ),
        },
    }


# ── Phase 6 Institution Dashboard Endpoints ──────────────────────────────────
# Each endpoint returns a structured view of program quality metrics for
# institutional proof-of-impact reporting.


def _require_institution_access(institution_id: str, user: CurrentUser) -> None:
    """Raise 403 if user cannot access this institution's data."""
    if user.role not in ("admin", "institution_admin", "moderator"):
        raise HTTPException(403, "Insufficient permissions.")
    if str(user.institution_id or "") != institution_id and user.role != "admin":
        raise HTTPException(403, "You can only access your own institution's data.")


@router.get("/institution/{institution_id}/progression")
async def get_program_progression(
    institution_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Program progression: mentee journey from registration → match → completion.
    Returns cohort funnel broken down by SDG track.
    """
    resolved_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee' AND NOT u.is_deleted
                )                                                       AS total_mentees,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (SELECT 1 FROM matches m
                                 WHERE m.mentee_id = u.id AND m.status = 'pending')
                )                                                       AS pending_match,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (SELECT 1 FROM matches m
                                 WHERE m.mentee_id = u.id AND m.status = 'active')
                )                                                       AS in_active_match,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (
                        SELECT 1 FROM matches m
                        JOIN sessions s ON s.match_id = m.id
                        WHERE m.mentee_id = u.id AND s.completed = true
                    )
                )                                                       AS with_completed_sessions,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS completed_programs,
                -- Track breakdown
                COUNT(DISTINCT m.id) FILTER (
                    WHERE m.status = 'completed' AND m.sdg_track = 'STEM'
                )                                                       AS stem_completions,
                COUNT(DISTINCT m.id) FILTER (
                    WHERE m.status = 'completed' AND m.sdg_track = 'Business'
                )                                                       AS business_completions,
                COUNT(DISTINCT m.id) FILTER (
                    WHERE m.status = 'completed' AND m.sdg_track = 'Trades'
                )                                                       AS trades_completions,
                COUNT(DISTINCT m.id) FILTER (
                    WHERE m.status = 'completed' AND m.sdg_track = 'Creative'
                )                                                       AS creative_completions,
                -- Active mentees by track
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (SELECT 1 FROM matches m
                                 WHERE m.mentee_id = u.id AND m.status = 'active'
                                 AND m.sdg_track = 'STEM')
                )                                                       AS stem_active,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (SELECT 1 FROM matches m
                                 WHERE m.mentee_id = u.id AND m.status = 'active'
                                 AND m.sdg_track = 'Business')
                )                                                       AS business_active,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (SELECT 1 FROM matches m
                                 WHERE m.mentee_id = u.id AND m.status = 'active'
                                 AND m.sdg_track = 'Trades')
                )                                                       AS trades_active,
                COUNT(DISTINCT u.id) FILTER (
                    WHERE u.role = 'mentee'
                    AND EXISTS (SELECT 1 FROM matches m
                                 WHERE m.mentee_id = u.id AND m.status = 'active'
                                 AND m.sdg_track = 'Creative')
                )                                                       AS creative_active
            FROM users u
            LEFT JOIN matches m ON m.mentee_id = u.id
            WHERE u.institution_id = $1
            """,
            uuid.UUID(resolved_institution_id),
        )

    total = row["total_mentees"] or 1
    return {
        "institution_id": resolved_institution_id,
        "funnel": {
            "registered": row["total_mentees"],
            "pending_match": row["pending_match"],
            "in_active_match": row["in_active_match"],
            "with_completed_sessions": row["with_completed_sessions"],
            "completed_programs": row["completed_programs"],
        },
        "completion_rate": round((row["completed_programs"] or 0) / total * 100, 1),
        "by_track": {
            "STEM": {"active": row["stem_active"], "completed": row["stem_completions"]},
            "Business": {
                "active": row["business_active"],
                "completed": row["business_completions"],
            },
            "Trades": {"active": row["trades_active"], "completed": row["trades_completions"]},
            "Creative": {
                "active": row["creative_active"],
                "completed": row["creative_completions"],
            },
        },
    }


@router.get("/institution/{institution_id}/offline-reach")
async def get_offline_reach(
    institution_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Offline reach: how many impact events came via low/zero-connectivity channels.
    Broken down by SDG goal and source channel.
    """
    resolved_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)                                        AS total_events,
                COUNT(*) FILTER (WHERE connectivity_class = 'offline')        AS offline_events,
                COUNT(*) FILTER (WHERE connectivity_class = 'low_connectivity') AS low_conn_events,
                COUNT(*) FILTER (WHERE connectivity_class = 'online')         AS online_events,
                COUNT(*) FILTER (WHERE source = 'ussd')      AS ussd_events,
                COUNT(*) FILTER (WHERE source = 'moderator')  AS moderator_events,
                COUNT(*) FILTER (WHERE connectivity_class = 'offline' AND sdg_goal = '4.4') AS offline_sdg4,
                COUNT(*) FILTER (WHERE connectivity_class = 'offline' AND sdg_goal = '5.5') AS offline_sdg5,
                COUNT(*) FILTER (WHERE connectivity_class = 'offline' AND sdg_goal = '8.6') AS offline_sdg8
            FROM impact_events
            WHERE institution_id = $1
            """,
            uuid.UUID(resolved_institution_id),
        )

    total = row["total_events"] or 1
    offline = (row["offline_events"] or 0) + (row["low_conn_events"] or 0)
    return {
        "institution_id": resolved_institution_id,
        "total_events": row["total_events"],
        "by_connectivity": {
            "offline": row["offline_events"],
            "low_connectivity": row["low_conn_events"],
            "online": row["online_events"],
        },
        "offline_percentage": round(offline / total * 100, 1),
        "by_sdg": {
            "4.4": row["offline_sdg4"],
            "5.5": row["offline_sdg5"],
            "8.6": row["offline_sdg8"],
        },
        "by_source": {
            "ussd": row["ussd_events"],
            "moderator": row["moderator_events"],
        },
        "narrative": (
            f"{round(offline / total * 100, 1)}% of impact events "
            f"came via offline or low-connectivity channels — "
            f"reaching girls without smartphone or internet access."
        ),
    }


@router.get("/institution/{institution_id}/mentor-utilization")
async def get_mentor_utilization(
    institution_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Mentor utilization: how many mentors are active, at capacity, or unused.
    Shows mentor-to-mentee ratio and session completion rates.
    """
    resolved_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(DISTINCT mp.user_id)                          AS total_mentors,
                COUNT(DISTINCT mp.user_id) FILTER (
                    WHERE EXISTS (
                        SELECT 1 FROM matches m
                        WHERE m.mentor_id = mp.user_id AND m.status = 'active'
                    )
                )                                                    AS active_mentors,
                COUNT(DISTINCT mp.user_id) FILTER (
                    WHERE NOT EXISTS (
                        SELECT 1 FROM matches m
                        WHERE m.mentor_id = mp.user_id
                    )
                )                                                    AS unused_mentors,
                COUNT(DISTINCT mp.user_id) FILTER (
                    WHERE (
                        SELECT COUNT(*) FROM matches m2
                        WHERE m2.mentor_id = mp.user_id AND m2.status = 'active'
                    ) <= 3
                )                                                    AS mentors_with_capacity,
                COALESCE(SUM(
                    (SELECT COUNT(*) FROM matches m3
                     WHERE m3.mentor_id = mp.user_id AND m3.status = 'active')
                ), 0)                                               AS total_active_mentees,
                ROUND(
                    COALESCE(AVG(
                        (SELECT COUNT(*) FROM sessions s2
                         WHERE s2.match_id IN (
                             SELECT id FROM matches m4 WHERE m4.mentor_id = mp.user_id
                         ) AND s2.completed = true)
                    ), 0)::numeric, 2
                )                                                    AS avg_sessions_per_mentor,
                -- Avg match quality
                ROUND(AVG(
                    (SELECT AVG(m5.match_score) FROM matches m5
                     WHERE m5.mentor_id = mp.user_id)
                )::numeric, 3)                                      AS avg_match_quality
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE u.institution_id = $1 AND u.role = 'mentor'
            """,
            uuid.UUID(resolved_institution_id),
        )

    total = row["total_mentors"] or 1
    active = row["active_mentors"] or 0
    return {
        "institution_id": resolved_institution_id,
        "total_mentors": row["total_mentors"],
        "active_mentors": active,
        "unused_mentors": row["unused_mentors"],
        "mentors_with_capacity": row["mentors_with_capacity"],
        "active_mentor_rate": round(active / total * 100, 1),
        "total_active_mentees": row["total_active_mentees"],
        "avg_sessions_per_mentor": row["avg_sessions_per_mentor"],
        "avg_match_quality": row["avg_match_quality"],
        "narrative": (
            f"{active} of {row['total_mentors']} mentors are active "
            f"(avg {row['avg_sessions_per_mentor']} completed sessions/mentor)"
        ),
    }


@router.get("/institution/{institution_id}/safety-interventions")
async def get_safety_interventions(
    institution_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Safety intervention rate: open/resolved reports by severity.
    Returns per-mentor breakdown for moderators.
    """
    resolved_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)                                              AS total_reports,
                COUNT(*) FILTER (WHERE sr.status = 'open')            AS open_reports,
                COUNT(*) FILTER (WHERE sr.status = 'under_review')   AS under_review,
                COUNT(*) FILTER (WHERE sr.status = 'resolved')        AS resolved,
                COUNT(*) FILTER (WHERE sr.severity = 'high')          AS high_severity,
                COUNT(*) FILTER (WHERE sr.severity = 'critical')      AS critical,
                ROUND(
                    COUNT(*) FILTER (WHERE sr.status = 'resolved')::numeric
                    / NULLIF(COUNT(*), 0)::numeric * 100, 1
                )                                                     AS resolution_rate,
                ROUND(
                    COUNT(*) FILTER (WHERE sr.status IN ('resolved','under_review'))::numeric
                    / NULLIF(COUNT(*), 0)::numeric * 100, 1
                )                                                     AS intervention_rate
            FROM safety_reports sr
            WHERE sr.reported_user_id IN (
                SELECT id FROM users WHERE institution_id = $1
            )
            """,
            uuid.UUID(resolved_institution_id),
        )

        # Top reasons
        top_reasons = await conn.fetch(
            """
            SELECT reason, COUNT(*) as count
            FROM safety_reports
            WHERE reported_user_id IN (
                SELECT id FROM users WHERE institution_id = $1
            )
            GROUP BY reason
            ORDER BY count DESC
            LIMIT 5
            """,
            uuid.UUID(resolved_institution_id),
        )

    return {
        "institution_id": resolved_institution_id,
        "total_reports": row["total_reports"],
        "by_status": {
            "open": row["open_reports"],
            "under_review": row["under_review"],
            "resolved": row["resolved"],
        },
        "by_severity": {
            "high": row["high_severity"],
            "critical": row["critical"],
        },
        "resolution_rate": row["resolution_rate"],
        "intervention_rate": row["intervention_rate"],
        "top_reasons": [dict(r) for r in top_reasons],
        "narrative": (
            f"{row['resolution_rate']}% of safety reports resolved, "
            f"{row['intervention_rate']}% required human intervention."
        ),
    }


@router.get("/institution/{institution_id}/outcome-velocity")
async def get_outcome_velocity(
    institution_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Outcome velocity: how fast mentees reach milestones, by track and geography.
    Tracks days-to-first-session and days-to-first-milestone.
    """
    resolved_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                m.sdg_track,
                u.country,
                COUNT(DISTINCT m.id)                                   AS total_matches,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS completed,
                ROUND(
                    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')::numeric
                    / NULLIF(COUNT(DISTINCT m.id), 0)::numeric * 100, 1
                )                                                       AS completion_rate,
                ROUND(
                    COALESCE(AVG(
                        EXTRACT(EPOCH FROM (
                            (SELECT MIN(s.completed_at) FROM sessions s
                             WHERE s.match_id = m.id AND s.completed = true)
                            - m.created_at
                        )) / 86400
                    ), 0)::numeric, 1
                )                                                        AS avg_days_to_first_session,
                ROUND(
                    COALESCE(AVG(
                        EXTRACT(EPOCH FROM (
                            (SELECT MIN(ie.recorded_at) FROM impact_events ie
                             WHERE ie.match_id = m.id)
                            - m.created_at
                        )) / 86400
                    ), 0)::numeric, 1
                )                                                        AS avg_days_to_first_milestone,
                ROUND(AVG(m.match_score)::numeric, 3)                  AS avg_match_quality
            FROM matches m
            JOIN users u ON u.id = m.mentee_id
            WHERE m.institution_id = $1 AND u.institution_id = $1
            GROUP BY m.sdg_track, u.country
            ORDER BY m.sdg_track, u.country
            """,
            uuid.UUID(resolved_institution_id),
        )

        overall = await conn.fetchrow(
            """
            SELECT
                COUNT(DISTINCT m.id)                              AS total_matches,
                ROUND(
                    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')::numeric
                    / NULLIF(COUNT(DISTINCT m.id), 0)::numeric * 100, 1
                )                                                  AS overall_completion_rate,
                ROUND(
                    COALESCE(AVG(
                        EXTRACT(EPOCH FROM (
                            (SELECT MIN(s.completed_at) FROM sessions s
                             WHERE s.match_id = m.id AND s.completed = true) - m.created_at
                        )) / 86400
                    ), 0)::numeric, 1
                )                                                  AS avg_days_to_first_session,
                ROUND(AVG(m.match_score)::numeric, 3)             AS avg_match_quality
            FROM matches m
            WHERE m.institution_id = $1
            """,
            uuid.UUID(resolved_institution_id),
        )

    return {
        "institution_id": resolved_institution_id,
        "overall": {
            "total_matches": overall["total_matches"],
            "completion_rate": overall["overall_completion_rate"],
            "avg_days_to_first_session": overall["avg_days_to_first_session"],
            "avg_match_quality": overall["avg_match_quality"],
        },
        "by_track_and_country": [dict(r) for r in rows],
        "narrative": (
            f"Overall {overall['overall_completion_rate']}% completion rate, "
            f"avg {overall['avg_days_to_first_session']} days to first completed session."
        ),
    }


@router.get("/stream/{institution_id}")
async def stream_impact_events(
    request: Request,
    institution_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis = Depends(get_redis),
):
    resolved_stream_institution_id = await _resolve_and_require_institution_access(
        pool,
        institution_id,
        user,
    )

    client_ip = request.client.host if request.client else "unknown"
    del client_ip  # reserved for future per-IP rate limiting on SSE

    now = datetime.now()
    redis_key = f"sse_limits:{user.id}"
    
    # Use Redis sorted set to track connection timestamps
    cutoff = now.timestamp() - (SSE_CONNECTION_WINDOW_MINUTES * 60)
    await redis.zremrangebyscore(redis_key, 0, cutoff)
    
    count = await redis.zcard(redis_key)
    if count >= SSE_MAX_CONNECTIONS_PER_USER:
        raise HTTPException(
            429, f"Maximum {SSE_MAX_CONNECTIONS_PER_USER} connections allowed per hour"
        )

    await redis.zadd(redis_key, {str(now.timestamp()): now.timestamp()})
    await redis.expire(redis_key, SSE_CONNECTION_WINDOW_MINUTES * 60)

    async def event_generator():
        last_id = None
        while True:
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        """
                        SELECT id, event_type, sdg_goal, sdg_track, recorded_at,
                               source, evidence_type, confidence, reviewer_status,
                               connectivity_class
                        FROM impact_events
                        WHERE institution_id = $1
                        ORDER BY recorded_at DESC
                        LIMIT 20
                        """,
                        resolved_stream_institution_id,
                    )
                for row in rows:
                    if last_id and str(row["id"]) == last_id:
                        continue
                    last_id = str(row["id"])
                    data = {
                        "id": str(row["id"]),
                        "event_type": row["event_type"],
                        "sdg_goal": row["sdg_goal"],
                        "sdg_track": row["sdg_track"],
                        "recorded_at": row["recorded_at"].isoformat(),
                        # Phase 6 provenance — now real DB columns
                        "source": row["source"],
                        "evidence_type": row["evidence_type"],
                        "confidence": row["confidence"],
                        "reviewer_status": row["reviewer_status"],
                        "connectivity_class": row["connectivity_class"],
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                logger.error(f"SSE stream error: {e}", exc_info=True)
                yield {"event": "error", "data": "Connection error"}
                break
            await asyncio.sleep(5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
