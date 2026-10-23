import logging
import uuid

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from dependencies import CurrentUser, get_current_user, get_db_pool, require_mentee
from schemas.mentee import MenteeProfileCreate, MenteeProfileResponse

try:
    from services.api.services.matching_service import generate_match_reason
except ImportError:

    def generate_match_reason(mentee: dict, mentor: dict) -> str:
        """Fallback when matching service is unavailable."""
        return "Match generated with default reasoning."


logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/profile", response_model=MenteeProfileResponse, status_code=201)
async def create_mentee_profile(
    data: MenteeProfileCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            """
            INSERT INTO mentee_profiles (
                user_id, full_name, display_name, career_goals, sdg_track,
                current_education, education_level, preferred_languages,
                challenges, bio_short, onboarding_complete
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                display_name = EXCLUDED.display_name,
                career_goals = EXCLUDED.career_goals,
                sdg_track = EXCLUDED.sdg_track,
                current_education = EXCLUDED.current_education,
                education_level = EXCLUDED.education_level,
                preferred_languages = EXCLUDED.preferred_languages,
                challenges = EXCLUDED.challenges,
                bio_short = EXCLUDED.bio_short,
                onboarding_complete = true,
                updated_at = now()
            RETURNING *
            """,
            uuid.UUID(user.id),
            data.full_name,
            data.display_name,
            data.career_goals,
            data.sdg_track.value,
            data.current_education,
            data.education_level,
            data.preferred_languages,
            data.challenges or [],
            data.bio_short,
        )

        await conn.execute(
            "UPDATE auth_users SET onboarding_complete = true WHERE id = $1", str(user.id)
        )

    try:
        from tasks.embedding_tasks import reembed_mentee_task

        background_tasks.add_task(reembed_mentee_task, str(user.id), data.model_dump())
    except ImportError:
        logger.warning("Celery tasks not available - skipping background task")
    # Convert asyncpg Record (with UUIDs) to dict with string UUIDs before Pydantic validation
    _profile = dict(profile)
    if "id" in _profile and _profile["id"] is not None:
        _profile["id"] = str(_profile["id"])
    if "user_id" in _profile and _profile["user_id"] is not None:
        _profile["user_id"] = str(_profile["user_id"])
    return MenteeProfileResponse.model_validate(_profile)


@router.get("/profile", response_model=MenteeProfileResponse)
async def get_mentee_profile(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            "SELECT * FROM mentee_profiles WHERE user_id = $1", uuid.UUID(user.id)
        )
    if not profile:
        raise HTTPException(404, "Profile not found. Please complete onboarding.")
    _profile = dict(profile)
    if "id" in _profile and _profile["id"] is not None:
        _profile["id"] = str(_profile["id"])
    if "user_id" in _profile and _profile["user_id"] is not None:
        _profile["user_id"] = str(_profile["user_id"])
    return MenteeProfileResponse.model_validate(_profile)


@router.get("/matches")
async def get_my_matches(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        if user.role in ("admin", "mentee"):
            rows = await conn.fetch(
                """
                SELECT m.id, m.mentor_id, m.status, m.match_score, m.match_reason,
                       m.sdg_track, m.started_at, m.completed_at,
                       mp.display_name AS mentor_name, mp.job_title,
                       mp.industry, mp.years_exp, mp.bio,
                       COUNT(s.id) AS sessions_completed
                FROM matches m
                JOIN mentor_profiles mp ON mp.user_id = m.mentor_id
                LEFT JOIN sessions s ON s.match_id = m.id AND s.completed = true
                WHERE m.mentee_id = $1
                GROUP BY m.id, mp.display_name, mp.job_title, mp.industry, mp.years_exp, mp.bio
                ORDER BY m.created_at DESC
                """,
                uuid.UUID(user.id),
            )
            return {"matches": [dict(row) for row in rows], "role": user.role}

        rows = await conn.fetch(
            """
            SELECT m.id, m.status, m.match_score, m.match_reason,
                   m.sdg_track, m.started_at, m.completed_at,
                   mp.display_name AS mentee_name, mp.career_goals, mp.current_education,
                   mp.preferred_languages,
                   COUNT(s.id) AS sessions_completed
            FROM matches m
            JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
            LEFT JOIN sessions s ON s.match_id = m.id AND s.completed = true
            WHERE m.mentor_id = $1
            GROUP BY m.id, mp.display_name, mp.career_goals, mp.current_education, mp.preferred_languages
            ORDER BY m.created_at DESC
            """,
            uuid.UUID(user.id),
        )

    return {"matches": [dict(row) for row in rows], "role": user.role}


@router.post("/matches")
async def request_match(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    mentor_id = payload.get("mentor_id")
    if not mentor_id:
        raise HTTPException(400, "mentor_id required")

    async with pool.acquire() as conn:
        active_match = await conn.fetchval(
            "SELECT count(*) FROM matches WHERE mentee_id = $1 AND status IN ('active', 'pending')",
            uuid.UUID(user.id),
        )
        if active_match > 0:
            raise HTTPException(400, "You already have an active or pending match.")

        user_row = await conn.fetchrow(
            "SELECT id, role FROM users WHERE id = $1", uuid.UUID(user.id)
        )
        if not user_row or user_row["role"] != "mentee":
            raise HTTPException(403, "Only mentees can request matches")

        mentor = await conn.fetchrow(
            "SELECT user_id, is_approved, current_mentees, max_mentees FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(mentor_id),
        )
        if not mentor:
            raise HTTPException(404, "Mentor not found")
        if not mentor["is_approved"]:
            raise HTTPException(400, "Mentor is not approved")
        if mentor["current_mentees"] >= mentor["max_mentees"]:
            raise HTTPException(400, "Mentor has reached full capacity")

        match = await conn.fetchrow(
            """
            INSERT INTO matches (mentee_id, mentor_id, status, match_score, match_reason)
            VALUES ($1, $2, 'pending', 0.9, 'Requested by mentee via platform')
            RETURNING *
            """,
            uuid.UUID(user.id),
            mentor["user_id"],
        )

    return {"match": dict(match)}


@router.get("/matches/{match_id}")
async def get_match_details(
    match_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        match = await conn.fetchrow(
            """
            SELECT m.*,
              mp_mentor.full_name as mentor_name, mp_mentor.job_title, mp_mentor.bio, mp_mentor.industry,
              mp_mentee.full_name as mentee_name, mp_mentee.sdg_track, mp_mentee.career_goals,
              (SELECT COUNT(*) FROM sessions s WHERE s.match_id = m.id AND s.completed = true) as sessions_completed,
              (SELECT COUNT(*) FROM sessions s WHERE s.match_id = m.id) as total_sessions
            FROM matches m
            JOIN mentor_profiles mp_mentor ON mp_mentor.user_id = m.mentor_id
            JOIN mentee_profiles mp_mentee ON mp_mentee.user_id = m.mentee_id
            WHERE m.id = $1
            AND (m.mentee_id = $2 OR m.mentor_id = $2)
            LIMIT 1
            """,
            uuid.UUID(match_id),
            uuid.UUID(user.id),
        )

    if not match:
        raise HTTPException(404, "Match not found")
    return {"match": dict(match)}


@router.patch("/matches/{match_id}")
async def update_match(
    match_id: str,
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    action = payload.get("action")
    decline_reason = payload.get("decline_reason")

    if action not in ("accept", "decline", "complete", "cancel"):
        raise HTTPException(400, "Invalid action. Use: accept, decline, complete, cancel")

    async with pool.acquire() as conn:
        match = await conn.fetchrow(
            "SELECT * FROM matches WHERE id = $1 LIMIT 1", uuid.UUID(match_id)
        )
        if not match:
            raise HTTPException(404, "Match not found")

        is_mentor = str(match["mentor_id"]) == user.id
        is_mentee = str(match["mentee_id"]) == user.id
        if not is_mentor and not is_mentee:
            raise HTTPException(403, "Forbidden")

        updated_match = None
        if action == "accept" and is_mentor and match["status"] == "pending":
            # Check mentor capacity before accepting
            mentor = await conn.fetchrow(
                "SELECT current_mentees, max_mentees FROM mentor_profiles WHERE user_id = $1",
                uuid.UUID(user.id),
            )
            if mentor["current_mentees"] >= mentor["max_mentees"]:
                raise HTTPException(400, "Mentor has reached full capacity")

            updated_match = await conn.fetchrow(
                """
                UPDATE matches SET
                  status = 'active',
                  mentor_response_at = now(),
                  started_at = now(),
                  updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                uuid.UUID(match_id),
            )
            # If mentor just hit capacity, decline other pending requests
            if mentor["current_mentees"] + 1 >= mentor["max_mentees"]:
                await conn.execute(
                    """
                    UPDATE matches SET
                      status = 'declined',
                      decline_reason = 'Mentor reached full capacity',
                      updated_at = now(),
                      mentor_response_at = now()
                    WHERE mentor_id = $1 AND status = 'pending' AND id != $2
                    """,
                    uuid.UUID(user.id),
                    uuid.UUID(match_id),
                )
        elif action == "decline" and is_mentor and match["status"] == "pending":
            updated_match = await conn.fetchrow(
                """
                UPDATE matches SET
                  status = 'declined',
                  decline_reason = $2,
                  mentor_response_at = now(),
                  updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                uuid.UUID(match_id),
                decline_reason or "Mentor unavailable at this time",
            )
        elif action == "complete" and (is_mentor or is_mentee) and match["status"] == "active":
            updated_match = await conn.fetchrow(
                """
                UPDATE matches SET
                  status = 'completed',
                  completed_at = now(),
                  completion_notes = $2,
                  mentee_satisfaction = $3,
                  mentor_satisfaction = $4,
                  updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                uuid.UUID(match_id),
                payload.get("completion_notes") or None,
                payload.get("mentee_satisfaction") if is_mentee else match["mentee_satisfaction"],
                payload.get("mentor_satisfaction") if is_mentor else match["mentor_satisfaction"],
            )
        elif action == "cancel" and (is_mentor or is_mentee):
            updated_match = await conn.fetchrow(
                """
                UPDATE matches SET
                  status = 'cancelled',
                  cancellation_reason = $2,
                  updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                uuid.UUID(match_id),
                decline_reason or "Cancelled by user",
            )
        else:
            raise HTTPException(
                409,
                f"Cannot perform action '{action}' on a match with status '{match['status']}'",
            )

    return {"match": dict(updated_match) if updated_match else None}


@router.get("/candidates")
async def get_mentor_candidates(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool),
    limit: int = 5,
    offset: int = 0,
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    async with pool.acquire() as conn:
        active = await conn.fetchval(
            "SELECT id FROM matches WHERE mentee_id = $1 AND status = 'active'",
            uuid.UUID(user.id),
        )
        if active:
            raise HTTPException(400, "You already have an active mentor match.")

        profile = await conn.fetchrow(
            "SELECT * FROM mentee_profiles WHERE user_id = $1", uuid.UUID(user.id)
        )
        if not profile:
            raise HTTPException(404, "Complete mentee onboarding before viewing candidates.")

        rows = await conn.fetch(
            """
            SELECT id, user_id, display_name, job_title, industry, years_exp,
                   languages, bio, sdg_track, bio_safety_score, is_approved, is_active
            FROM mentor_profiles
            WHERE is_approved = true AND is_active = true
            ORDER BY bio_safety_score DESC NULLS LAST, years_exp DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset,
        )

    candidates = []
    for row in rows:
        mentor = dict(row)
        score = 0.72
        shared_languages = sorted(
            set(profile["preferred_languages"] or ["en"]) & set(mentor.get("languages") or [])
        )
        score += min(len(shared_languages) * 0.06, 0.18)
        if (
            profile["sdg_track"] == mentor.get("sdg_track")
            or profile["sdg_track"] in str(mentor.get("industry", "")).lower()
        ):
            score += 0.05
        if int(mentor.get("years_exp") or 0) >= 5:
            score += 0.03
        candidates.append(
            {
                "mentor_id": str(mentor["user_id"]),
                "mentor_name": mentor.get("display_name") or mentor.get("full_name"),
                "job_title": mentor.get("job_title"),
                "industry": mentor.get("industry"),
                "years_exp": mentor.get("years_exp"),
                "languages": mentor.get("languages") or [],
                "match_score": round(min(score, 0.98), 2),
                "match_reason": generate_match_reason(profile, mentor),
                "bio_preview": (mentor.get("bio") or "")[:160],
            }
        )

    return {"candidates": candidates}


@router.post("/matches/{match_id}/accept")
async def accept_match(
    match_id: str,
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        match = await conn.fetchrow(
            "SELECT * FROM matches WHERE id = $1 AND mentee_id = $2 AND status = 'pending'",
            uuid.UUID(match_id),
            uuid.UUID(user.id),
        )
        if not match:
            raise HTTPException(404, "Match not found or not in pending state.")

        await conn.execute(
            "UPDATE matches SET status = 'active', started_at = now() WHERE id = $1",
            uuid.UUID(match_id),
        )

    try:
        from tasks.sms_tasks import send_match_confirmed_sms

        send_match_confirmed_sms.apply_async(args=[str(match_id)])
    except Exception as e:
        logger.warning(f"Could not queue match SMS: {e}")
    try:
        from tasks.sms_tasks import notify_mentor_of_match

        notify_mentor_of_match.apply_async(args=[str(match_id)])
    except Exception as e:
        logger.warning(f"Could not queue mentor match notification: {e}")
    return {
        "message": "Match accepted! Your mentor has been notified.",
        "match_id": match_id,
    }


@router.get("/sessions")
async def get_my_sessions(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool),
    page: int = 1,
    per_page: int = 20,
):
    per_page = max(1, min(per_page, 50))
    offset = (page - 1) * per_page
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
            LIMIT $2 OFFSET $3
            """,
            uuid.UUID(user.id),
            per_page,
            offset,
        )
    return [dict(row) for row in rows]


@router.post("/report", deprecated=True)
async def create_safety_report(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """DEPRECATED: Use /safety/reports instead. Report a safety concern about another user."""
    reported_user_id = payload.get("reported_user_id")
    match_id = payload.get("match_id")
    reason = payload.get("reason")
    description = payload.get("description", "")[:1000]
    severity = payload.get("severity", "medium")

    if not reported_user_id or not reason:
        raise HTTPException(400, "reported_user_id and reason are required")

    if severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(400, "Invalid severity")

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO safety_reports
            (reporter_id, reported_user_id, match_id, reason, description, severity)
            VALUES ($1, $2, $3, $4, $5, $6::safety_severity)
            """,
            uuid.UUID(user.id),
            uuid.UUID(reported_user_id),
            uuid.UUID(match_id) if match_id else None,
            reason,
            description,
            severity,
        )

    return {"status": "reported", "message": "Safety report submitted for review"}


@router.post("/reports")
async def create_safety_report_v2(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    reported_user_id = payload.get("reported_user_id")
    match_id = payload.get("match_id")
    session_id = payload.get("session_id")
    reason = payload.get("reason")
    description = payload.get("description", "")[:1000]
    severity = payload.get("severity", "medium")

    if not reported_user_id or not reason:
        raise HTTPException(400, "reported_user_id and reason are required")
    if severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(400, "Invalid severity")

    async with pool.acquire() as conn:
        report = await conn.fetchrow(
            """
            INSERT INTO safety_reports
            (reporter_id, reported_user_id, session_id, match_id, reason, description, severity)
            VALUES ($1, $2, $3, $4, $5, $6, $7::safety_severity)
            RETURNING id, severity, status, created_at
            """,
            uuid.UUID(user.id),
            uuid.UUID(reported_user_id),
            uuid.UUID(session_id) if session_id else None,
            uuid.UUID(match_id) if match_id else None,
            reason,
            description,
            severity,
        )

    return {"success": True, "report": dict(report)}
