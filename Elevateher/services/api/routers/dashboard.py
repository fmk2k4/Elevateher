import json
import uuid
from datetime import date, datetime
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from dependencies import (
    CurrentUser,
    get_current_user,
    get_db_pool,
    get_redis,
    require_admin,
    require_institution_admin,
)
def _json_safe(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, datetime | date):
        return o.isoformat()
    # asyncpg returns UUID values as pgproto.UUID which is JSON-incompatible.
    if hasattr(o, "hex") and hasattr(o, "version"):
        return str(o)
    raise TypeError(f"not JSON serializable: {type(o)}")


async def _get_institution_for_admin(conn, subdomain: str, user: CurrentUser):
    inst = await conn.fetchrow(
        "SELECT id FROM institutions WHERE subdomain = $1", subdomain.lower()
    )
    if not inst:
        raise HTTPException(404, "Institution not found.")
    
    if user.role == "institution_admin":
        raw = user.institution_id
        if not raw:
            raise HTTPException(403, "Not authorized for this institution (no context)")
        
        try:
            inst_uuid = uuid.UUID(str(raw))
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(403, "Not authorized for this institution (invalid context)")
            
        if str(inst_uuid) != str(inst["id"]):
            raise HTTPException(403, "Not authorized for this institution")
            
    return inst

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _normalize_status(value: str | None) -> str:
    allowed = {
        "pending_admin_review",
        "approved",
        "rejected",
        "suspended",
    }
    candidate = (value or "pending_admin_review").lower()
    return candidate if candidate in allowed else "pending_admin_review"


@router.get("/stats")
async def get_user_dashboard_stats(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis = Depends(get_redis),
):
    cache_key = f"dashboard:stats:{user.id}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    async with pool.acquire() as conn:
        db_user = await conn.fetchrow(
            "SELECT id, role FROM users WHERE id = $1 LIMIT 1",
            uuid.UUID(user.id),
        )
        if not db_user:
            return {"stats": None}

        if db_user["role"] == "mentee":
            match_rows = await conn.fetch(
                "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM matches WHERE mentee_id = $1",
                db_user["id"],
            )
            session_rows = await conn.fetch(
                "SELECT COUNT(*) as total FROM sessions s JOIN matches m ON m.id = s.match_id WHERE m.mentee_id = $1 AND s.completed = true",
                db_user["id"],
            )
            impact_rows = await conn.fetch(
                "SELECT COUNT(*) as total, event_type FROM impact_events WHERE user_id = $1 GROUP BY event_type ORDER BY COUNT(*) DESC",
                db_user["id"],
            )
            notif_rows = await conn.fetch(
                "SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false",
                db_user["id"],
            )
            result = {
                "role": "mentee",
                "stats": {
                    "total_matches": int(match_rows[0]["total"] or 0),
                    "active_matches": int(match_rows[0]["active"] or 0),
                    "sessions_completed": int(session_rows[0]["total"] or 0),
                    "impact_events": [dict(row) for row in impact_rows],
                    "unread_notifications": int(notif_rows[0]["unread"] or 0),
                },
            }
            await redis.setex(cache_key, 60, json.dumps(result, default=_json_safe))
            return result

        if db_user["role"] == "mentor":
            match_rows = await conn.fetch(
                "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'completed') as completed FROM matches WHERE mentor_id = $1",
                db_user["id"],
            )
            session_rows = await conn.fetch(
                "SELECT COUNT(*) as total FROM sessions s JOIN matches m ON m.id = s.match_id WHERE m.mentor_id = $1 AND s.completed = true",
                db_user["id"],
            )
            impact_rows = await conn.fetch(
                "SELECT COUNT(*) as total FROM impact_events WHERE verified_by = $1",
                db_user["id"],
            )
            profile_rows = await conn.fetch(
                "SELECT verification_status, current_mentees, max_mentees, is_approved, avg_mentee_outcome_score FROM mentor_profiles WHERE user_id = $1",
                db_user["id"],
            )
            notif_rows = await conn.fetch(
                "SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false",
                db_user["id"],
            )
            result = {
                "role": "mentor",
                "stats": {
                    "total_matches": int(match_rows[0]["total"] or 0),
                    "active_mentees": int(match_rows[0]["active"] or 0),
                    "completed_programmes": int(match_rows[0]["completed"] or 0),
                    "sessions_hosted": int(session_rows[0]["total"] or 0),
                    "impact_events_verified": int(impact_rows[0]["total"] or 0),
                    "unread_notifications": int(notif_rows[0]["unread"] or 0),
                    "profile": dict(profile_rows[0]) if profile_rows and profile_rows[0] else None,
                },
            }
            await redis.setex(cache_key, 60, json.dumps(result, default=_json_safe))
            return result

    return {"stats": None}


@router.get("/mentor/weekly-brief-data")
async def get_mentor_weekly_brief_data(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Returns mentor weekly brief context: profile + active mentees + recent sessions.
    The AI-generated summary is assembled in the web app (where Gemini API key lives).
    Phase 1: replaces direct Neon SQL call in ai/weekly-brief/route.js.
    """
    async with pool.acquire() as conn:
        db_user = await conn.fetchrow(
            "SELECT id, role FROM users WHERE id = $1 LIMIT 1",
            uuid.UUID(user.id),
        )
        if not db_user or db_user["role"] != "mentor":
            raise HTTPException(403, "Only mentors can access weekly briefs.")

        mentor_profile = await conn.fetchrow(
            """
            SELECT mp.*, u.email FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.user_id = $1 LIMIT 1
            """,
            db_user["id"],
        )
        if not mentor_profile:
            raise HTTPException(404, "Mentor profile not found.")

        active_mentees = await conn.fetch(
            """
            SELECT m.id as match_id, m.status, m.started_at, m.sdg_track,
                   mp.full_name as mentee_name, mp.career_goals,
                   mp.sdg_track as mentee_track,
                   (SELECT COUNT(*) FROM sessions s
                    WHERE s.match_id = m.id AND s.completed = true) as sessions_done
            FROM matches m
            JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
            WHERE m.mentor_id = $1 AND m.status = 'active'
            """,
            db_user["id"],
        )

        recent_sessions = await conn.fetch(
            """
            SELECT s.session_num, s.completed, s.milestone_title,
                   s.completed_at, s.agent_summary,
                   mp.full_name as mentee_name
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
            WHERE m.mentor_id = $1
            ORDER BY s.created_at DESC
            LIMIT 10
            """,
            db_user["id"],
        )

        impact_total = await conn.fetchval(
            """
            SELECT COUNT(*) FROM impact_events
            WHERE verified_by = $1
               OR EXISTS (
                   SELECT 1 FROM matches m2
                   WHERE m2.mentor_id = $1 AND m2.id = impact_events.match_id
               )
            """,
            db_user["id"],
        )

    return {
        "profile": dict(mentor_profile),
        "active_mentees": [dict(r) for r in active_mentees],
        "recent_sessions": [dict(r) for r in recent_sessions],
        "impact_events_total": impact_total,
    }


@router.get("/{subdomain}/stats")
async def get_dashboard_stats(
    subdomain: str,
    user: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst = await _get_institution_for_admin(conn, subdomain, user)

        row = await conn.fetchrow(
            "SELECT * FROM v_institution_cohort_summary WHERE institution_id = $1",
            inst["id"],
        )

    result = dict(row) if row else {}
    safe = json.loads(json.dumps(result, default=_json_safe))
    return safe


@router.get("/{subdomain}/mentees")
async def get_dashboard_mentees(
    subdomain: str,
    user: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst = await _get_institution_for_admin(conn, subdomain, user)

        mentee_rows = await conn.fetch(
            """
            SELECT u.id, mp.display_name, mp.sdg_track,
                   mp.career_goals, mp.preferred_languages,
                   mp.onboarding_complete, u.created_at,
                   m.status AS match_status,
                   COUNT(s.id) FILTER (WHERE s.completed = true) AS sessions_completed
            FROM users u
            JOIN mentee_profiles mp ON mp.user_id = u.id
            LEFT JOIN matches m ON m.mentee_id = u.id
            LEFT JOIN sessions s ON s.match_id = m.id
            WHERE u.institution_id = $1 AND u.role = 'mentee'
            GROUP BY u.id, mp.display_name, mp.sdg_track,
                     mp.career_goals, mp.preferred_languages,
                     mp.onboarding_complete, u.created_at, m.status
            ORDER BY u.created_at DESC
            """,
            inst["id"],
        )

    mentees = []
    for r in mentee_rows:
        mentees.append(
            {
                "id": str(r["id"]),
                "display_name": r["display_name"],
                "sdg_track": r["sdg_track"],
                "career_goals": r["career_goals"] or [],
                "preferred_languages": r["preferred_languages"] or [],
                "onboarding_complete": r["onboarding_complete"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else "",
                "match_status": r["match_status"],
                "sessions_completed": r["sessions_completed"] or 0,
            }
        )

    result = {"mentees": mentees}
    safe = json.loads(json.dumps(result, default=_json_safe))
    return safe


@router.get("/{subdomain}/matches")
async def get_dashboard_matches(
    subdomain: str,
    user: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst = await _get_institution_for_admin(conn, subdomain, user)

        match_rows = await conn.fetch(
            """
            SELECT m.id AS match_id, m.status, m.match_score, m.match_reason, m.created_at AS started_at,
                   mp.display_name AS mentee_name, mp.sdg_track,
                   mentor_p.full_name AS mentor_name, mentor_p.job_title AS mentor_job_title,
                   COUNT(s.id) FILTER (WHERE s.completed = true) AS sessions_completed
            FROM matches m
            JOIN users mentee ON mentee.id = m.mentee_id
            JOIN mentee_profiles mp ON mp.user_id = mentee.id
            JOIN users mentor ON mentor.id = m.mentor_id
            JOIN mentor_profiles mentor_p ON mentor_p.user_id = mentor.id
            LEFT JOIN sessions s ON s.match_id = m.id
            WHERE mentee.institution_id = $1
            GROUP BY m.id, m.status, m.match_score, m.match_reason, m.created_at,
                     mp.display_name, mp.sdg_track,
                     mentor_p.full_name, mentor_p.job_title
            ORDER BY m.created_at DESC
            """,
            inst["id"],
        )

    matches = []
    for r in match_rows:
        matches.append(
            {
                "match_id": str(r["match_id"]),
                "status": r["status"],
                "sdg_track": r["sdg_track"],
                "match_score": float(r["match_score"]),
                "match_reason": r["match_reason"] or "",
                "mentee_name": r["mentee_name"] or "",
                "mentor_name": r["mentor_name"] or "",
                "mentor_job_title": r["mentor_job_title"] or "",
                "sessions_completed": r["sessions_completed"] or 0,
                "started_at": r["started_at"].isoformat() if r["started_at"] else "",
            }
        )

    result = {"matches": matches}
    safe = json.loads(json.dumps(result, default=_json_safe))
    return safe


@router.get("/{subdomain}/analytics/weekly")
async def get_weekly_analytics(
    subdomain: str,
    user: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst = await _get_institution_for_admin(conn, subdomain, user)

        rows = await conn.fetch(
            """
            SELECT DATE_TRUNC('week', recorded_at) AS week,
                   COUNT(*) FILTER (WHERE sdg_goal = '4.4') AS sdg4,
                   COUNT(*) FILTER (WHERE sdg_goal = '5.5') AS sdg5,
                   COUNT(*) FILTER (WHERE sdg_goal = '8.6') AS sdg8
            FROM impact_events
            WHERE institution_id = $1
              AND recorded_at >= now() - INTERVAL '12 weeks'
            GROUP BY DATE_TRUNC('week', recorded_at)
            ORDER BY week ASC
            """,
            inst["id"],
        )

    return {"weekly": [dict(r) for r in rows]}


@router.get("/{subdomain}/analytics/tracks")
async def get_track_distribution(
    subdomain: str,
    user: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst = await _get_institution_for_admin(conn, subdomain, user)

        rows = await conn.fetch(
            """
            SELECT mp.sdg_track AS name, COUNT(*) AS value
            FROM matches m
            JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
            JOIN users u ON u.id = m.mentee_id
            WHERE u.institution_id = $1 AND m.status = 'active'
            GROUP BY mp.sdg_track
            """,
            inst["id"],
        )

    return {"tracks": [dict(r) for r in rows]}


@router.get("/institutions/{subdomain}/mentors")
async def get_institution_mentors(
    subdomain: str,
    status: str = "approved",
    user: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst = await _get_institution_for_admin(conn, subdomain, user)

        verified = _normalize_status(status)

        rows = await conn.fetch(
            """
            SELECT u.id, mp.full_name, mp.job_title, mp.industry,
                   mp.years_exp, mp.languages, mp.bio_safety_score,
                   mp.is_approved, mp.verification_status,
                   mp.current_mentees, mp.total_mentees_served
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.verification_status = $1
              AND u.institution_id = $2
            ORDER BY mp.created_at DESC
            """,
            verified,
            inst["id"],
        )

    return {"mentors": [dict(r) for r in rows]}
