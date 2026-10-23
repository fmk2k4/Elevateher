import json
import logging
import uuid

import asyncpg
from celery import signals
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from dependencies import (
    CurrentUser,
    get_current_user,
    get_db_pool,
    require_approved_mentor,
    require_mentor,
)
from schemas.mentor import MentorProfileCreate

router = APIRouter()
logger = logging.getLogger(__name__)

_task_pending: dict[str, str | None] = {}


def _register_task_signals():
    @signals.task_failure.connect
    def on_task_failure(request=None, exc=None, **kwargs):
        if request and request.args:
            mentor_id = str(request.args[0]) if request.args else None
            if mentor_id:
                logger.error(
                    f"Safety scan task failed for mentor {mentor_id}: {exc}",
                    extra={"mentor_id": mentor_id},
                )
                _task_pending.pop(mentor_id, None)

    @signals.task_retry.connect
    def on_task_retry(request=None, **kwargs):
        if request and request.args:
            mentor_id = str(request.args[0]) if request.args else None
            if mentor_id:
                logger.warning(
                    f"Safety scan task retrying for mentor {mentor_id}",
                    extra={"mentor_id": mentor_id},
                )


_register_task_signals()


@router.post("/profile", status_code=201)
async def create_mentor_profile(
    data: MentorProfileCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT verification_status, is_approved FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(user.id),
        )

        if existing:
            verification_status = existing["verification_status"]
        else:
            verification_status = "pending_id"

        await conn.fetchrow(
            """
            INSERT INTO mentor_profiles (
                user_id, full_name, display_name, job_title, employer,
                industry, years_exp, skills, languages, bio,
                linkedin_url, availability, verification_status, sdg_track
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                display_name = EXCLUDED.display_name,
                job_title = EXCLUDED.job_title,
                employer = EXCLUDED.employer,
                industry = EXCLUDED.industry,
                years_exp = EXCLUDED.years_exp,
                skills = EXCLUDED.skills,
                languages = EXCLUDED.languages,
                bio = EXCLUDED.bio,
                linkedin_url = EXCLUDED.linkedin_url,
                availability = EXCLUDED.availability,
                verification_status = $13,
                sdg_track = EXCLUDED.sdg_track,
                updated_at = now()
            RETURNING *
            """,
            uuid.UUID(user.id),
            data.full_name,
            data.display_name,
            data.job_title,
            data.employer,
            data.industry,
            data.years_exp,
            data.skills,
            data.languages,
            data.bio,
            data.linkedin_url,
            json.dumps(data.availability),
            verification_status,
            data.sdg_track,
        )

    try:
        from tasks.safety_tasks import scan_mentor_bio_task

        _task_pending[str(user.id)] = None
        scan_mentor_bio_task.apply_async(
            args=[str(user.id), data.bio],
            retry=True,
            max_retries=3,
            retry_backoff=True,
            retry_backoff_min=60,
            acks_late=True,
        )
    except Exception as e:
        logger.error(
            f"Failed to queue safety scan for mentor {user.id}: {e}",
            extra={"mentor_id": user.id, "content_length": len(data.bio)},
        )
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE mentor_profiles
                SET verification_status = 'pending_manual_review',
                    requires_human_review = true
                WHERE user_id = $1
                """,
                uuid.UUID(user.id),
            )
    try:
        from tasks.embedding_tasks import reembed_mentor_task

        background_tasks.add_task(reembed_mentor_task, str(user.id), data.model_dump())
    except ImportError:
        logger.warning("Celery tasks not available - skipping background task")

    return {
        "message": "Profile submitted. Pending safety verification and admin review.",
        "verification_status": "pending_id",
        "next_steps": [
            "Upload government-issued ID",
            "Upload employment proof",
            "Sign code of conduct",
        ],
    }


@router.post("/upload-verification-doc")
async def upload_verification_doc(
    request: Request,
    user: CurrentUser = Depends(require_approved_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    form = await request.form()
    doc_type = str(form.get("doc_type", ""))
    file = form.get("file")
    if doc_type not in ("id_document", "employment_doc"):
        raise HTTPException(400, "doc_type must be 'id_document' or 'employment_doc'")
    if file is None or getattr(file, "filename", None) is None:
        raise HTTPException(400, "file is required")

    try:
        from services.api.services.storage_service import upload_private_document
    except ImportError:

        async def upload_private_document(*args, **kwargs) -> dict:
            return {"error": "storage_service unavailable"}

    file_contents = await file.read()
    size_bytes = len(file_contents)
    await file.seek(0)

    import re

    safe_filename = re.sub(r"[^\w\-.]", "_", file.filename or "unknown")

    path = await upload_private_document(
        file=file,
        bucket="mentor-verification",
        path=f"{user.id}/{doc_type}/{safe_filename}",
    )

    logger.info(
        "verification_document_uploaded",
        extra={
            "action": "upload_verification_document",
            "user_id": user.id,
            "actor_id": user.id,
            "target_user_id": user.id,
            "doc_type": doc_type,
            "filename": safe_filename,
            "size_bytes": size_bytes,
            "content_type": file.content_type,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        },
    )

    async with pool.acquire() as conn:
        if doc_type == "id_document":
            await conn.execute(
                "UPDATE mentor_profiles SET id_document_path = $1 WHERE user_id = $2",
                path,
                uuid.UUID(user.id),
            )
        elif doc_type == "employment_doc":
            await conn.execute(
                "UPDATE mentor_profiles SET employment_doc_path = $1 WHERE user_id = $2",
                path,
                uuid.UUID(user.id),
            )
        profile = await conn.fetchrow(
            "SELECT id_document_path, employment_doc_path, "
            "bio_safety_score FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(user.id),
        )

    if (
        profile
        and profile["id_document_path"]
        and profile["employment_doc_path"]
        and float(profile["bio_safety_score"] or 0) >= 0.75
    ):
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE mentor_profiles SET "
                "verification_status = 'pending_admin_review' "
                "WHERE user_id = $1",
                uuid.UUID(user.id),
            )

    return {"message": f"{doc_type} uploaded successfully.", "path": path}


@router.post("/sign-code-of-conduct")
async def sign_code_of_conduct(
    agreed: bool,
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if not agreed:
        raise HTTPException(400, "You must agree to the code of conduct to proceed.")
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE mentor_profiles SET "
            "code_of_conduct_signed=true, code_signed_at=now() "
            "WHERE user_id=$1",
            uuid.UUID(user.id),
        )
    return {"message": "Code of conduct signed. Your verification is under review."}


@router.get("/list")
async def list_approved_mentors(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
    track: str | None = None,
    language: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    query = """
        SELECT mp.id, mp.full_name, mp.display_name, mp.job_title, mp.employer, mp.industry,
               mp.years_exp, mp.skills, mp.languages, mp.bio, mp.avatar_url,
               mp.current_mentees, mp.max_mentees, mp.avg_mentee_outcome_score,
               mp.can_mentor_minors, mp.verification_status, u.country
        FROM mentor_profiles mp
        JOIN users u ON u.id = mp.user_id
        WHERE mp.is_approved = true AND mp.is_active = true AND mp.current_mentees < mp.max_mentees
    """
    count_query = """
        SELECT COUNT(*)
        FROM mentor_profiles mp
        JOIN users u ON u.id = mp.user_id
        WHERE mp.is_approved = true AND mp.is_active = true AND mp.current_mentees < mp.max_mentees
    """
    values: list[object] = []

    if track:
        values.append(track)
        query += f" AND mp.specialises_in @> ARRAY[${len(values)}]::text[]"
        count_query += f" AND mp.specialises_in @> ARRAY[${len(values)}]::text[]"
    if language:
        values.append(language)
        query += f" AND ${len(values)} = ANY(mp.languages)"
        count_query += f" AND ${len(values)} = ANY(mp.languages)"

    query += f" ORDER BY mp.total_mentees_served DESC, mp.avg_mentee_outcome_score DESC NULLS LAST LIMIT {limit} OFFSET {offset}"

    async with pool.acquire() as conn:
        mentors = await conn.fetch(query, *values)
        total = await conn.fetchval(count_query, *values)

    return {
        "mentors": [dict(row) for row in mentors],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/my-mentees")
async def get_my_mentees(
    user: CurrentUser = Depends(require_approved_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool),
    page: int = 1,
    per_page: int = 20,
):
    per_page = max(1, min(per_page, 50))
    offset = (page - 1) * per_page
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id AS match_id, m.status, m.sdg_track,
                   m.started_at, m.match_reason,
                   mp.display_name, mp.career_goals,
                   mp.current_education, mp.preferred_languages,
                   COUNT(s.id) AS sessions_completed,
                   MAX(s.completed_at) AS last_session
            FROM matches m
            JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
            LEFT JOIN sessions s ON s.match_id = m.id AND s.completed = true
            WHERE m.mentor_id = $1 AND m.status IN ('pending','active')
            GROUP BY m.id, mp.display_name, mp.career_goals,
                     mp.current_education, mp.preferred_languages
            ORDER BY m.started_at DESC
            LIMIT $2 OFFSET $3
            """,
            uuid.UUID(user.id),
            per_page,
            offset,
        )
    return [dict(row) for row in rows]
