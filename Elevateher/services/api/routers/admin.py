import logging
import uuid

import asyncpg
from fastapi import APIRouter, Body, Depends, HTTPException

from dependencies import (
    CurrentUser,
    get_db_pool,
    require_admin,
    require_institution_admin,
    require_moderator,
)

logger = logging.getLogger(__name__)


def _admin_inst_uuid(admin: CurrentUser) -> uuid.UUID | None:
    raw = admin.institution_id
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(400, "Institution context required")


def _require_admin_inst_uuid(admin: CurrentUser) -> uuid.UUID:
    inst_uuid = _admin_inst_uuid(admin)
    if inst_uuid is None:
        raise HTTPException(400, "Institution context required")
    return inst_uuid


router = APIRouter()
institution_router = APIRouter(prefix="/institutions")


@router.get("/summary")
async def get_platform_summary(
    admin: CurrentUser = Depends(require_moderator),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if admin.role not in ("admin", "institution_admin", "moderator"):
        raise HTTPException(403, "Insufficient permissions")

    async with pool.acquire() as conn:
        institutions_rows = await conn.fetch(
            "SELECT * FROM v_institution_cohort_summary ORDER BY total_mentees DESC LIMIT 10"
        )
        top_mentor_rows = await conn.fetch(
            "SELECT * FROM v_mentor_leaderboard ORDER BY programmes_completed DESC, avg_satisfaction DESC NULLS LAST LIMIT 10"
        )
        recent_impact_rows = await conn.fetch(
            """
            SELECT ie.event_type, ie.sdg_goal, ie.sdg_track, ie.recorded_at, ie.description,
                   u.country, mp.full_name as user_name
            FROM impact_events ie
            JOIN users u ON u.id = ie.user_id
            LEFT JOIN mentee_profiles mp ON mp.user_id = ie.user_id
            ORDER BY ie.recorded_at DESC LIMIT 20
            """
        )
        safety_stats = await conn.fetchrow(
            """
            SELECT
              COUNT(*) as total_reports,
              COUNT(*) FILTER (WHERE status = 'open') as open_reports,
              COUNT(*) FILTER (WHERE severity = 'critical') as critical_reports,
              COUNT(*) FILTER (WHERE auto_suspended = true) as auto_suspensions
            FROM safety_reports
            """
        )
        global_stats = await conn.fetchrow(
            """
            SELECT
              (SELECT COUNT(*) FROM users WHERE role = 'mentee' AND is_deleted = false) as total_mentees,
              (SELECT COUNT(*) FROM users WHERE role = 'mentor' AND is_deleted = false) as total_mentors,
              (SELECT COUNT(*) FROM matches WHERE status = 'active') as active_matches,
              (SELECT COUNT(*) FROM matches WHERE status = 'completed') as completed_programmes,
              (SELECT COUNT(*) FROM impact_events) as total_impact_events,
              (SELECT COUNT(*) FROM sessions WHERE completed = true) as total_sessions
            """
        )

    return {
        "institutions": [dict(row) for row in institutions_rows],
        "top_mentors": [dict(row) for row in top_mentor_rows],
        "recent_impact": [dict(row) for row in recent_impact_rows],
        "safety_stats": dict(safety_stats) if safety_stats else {},
        "global_stats": dict(global_stats) if global_stats else {},
    }


@router.get("/mentors")
async def list_mentor_verifications(
    institution_id: str | None = None,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        if admin.role == "admin" and not institution_id:
            mentors = await conn.fetch(
                """
                SELECT mp.*,
                  u.email, u.country, u.created_at as user_created_at,
                  u.is_suspended, u.is_verified,
                  (SELECT COUNT(*) FROM matches WHERE mentor_id = u.id AND status = 'active') as active_mentees,
                  (SELECT MAX(snapshot_at) FROM mentor_risk_snapshots WHERE mentor_id = u.id) as last_risk_check,
                  (SELECT MAX(risk_score) FROM mentor_risk_snapshots WHERE mentor_id = u.id) as max_risk_score
                FROM mentor_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE NOT u.is_deleted
                ORDER BY
                  CASE mp.verification_status
                    WHEN 'pending_admin_review' THEN 1
                    WHEN 'pending_employment' THEN 2
                    WHEN 'pending_id' THEN 3
                    WHEN 'approved' THEN 4
                    ELSE 5
                  END,
                  mp.created_at DESC
                LIMIT 50
                """
            )
            stats = await conn.fetchrow(
                """
                SELECT
                  COUNT(*) FILTER (WHERE verification_status = 'pending_admin_review') as pending_review,
                  COUNT(*) FILTER (WHERE is_approved = true) as approved,
                  COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected,
                  COUNT(*) as total
                FROM mentor_profiles
                """
            )
        else:
            inst_uuid = uuid.UUID(institution_id) if admin.role == "admin" and institution_id else _require_admin_inst_uuid(admin)
            mentors = await conn.fetch(
                """
                SELECT mp.*,
                  u.email, u.country, u.created_at as user_created_at,
                  u.is_suspended, u.is_verified,
                  (SELECT COUNT(*) FROM matches WHERE mentor_id = u.id AND status = 'active') as active_mentees,
                  (SELECT MAX(snapshot_at) FROM mentor_risk_snapshots WHERE mentor_id = u.id) as last_risk_check,
                  (SELECT MAX(risk_score) FROM mentor_risk_snapshots WHERE mentor_id = u.id) as max_risk_score
                FROM mentor_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE NOT u.is_deleted AND u.institution_id = $1
                ORDER BY
                  CASE mp.verification_status
                    WHEN 'pending_admin_review' THEN 1
                    WHEN 'pending_employment' THEN 2
                    WHEN 'pending_id' THEN 3
                    WHEN 'approved' THEN 4
                    ELSE 5
                  END,
                  mp.created_at DESC
                LIMIT 50
                """,
                inst_uuid,
            )
            stats = await conn.fetchrow(
                """
                SELECT
                  COUNT(*) FILTER (WHERE verification_status = 'pending_admin_review') as pending_review,
                  COUNT(*) FILTER (WHERE is_approved = true) as approved,
                  COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected,
                  COUNT(*) as total
                FROM mentor_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE u.institution_id = $1
                """,
                inst_uuid,
            )

    return {"mentors": [dict(row) for row in mentors], "stats": dict(stats) if stats else {}}


@router.put("/mentors")
async def review_mentor_verification(
    payload: dict,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    mentor_profile_id = payload.get("mentor_profile_id")
    action = payload.get("action")
    notes = payload.get("notes")

    if not mentor_profile_id or not action:
        raise HTTPException(400, "mentor_profile_id and action required")
    if action not in ("approve", "reject", "suspend", "request_docs"):
        raise HTTPException(400, "Invalid action")

    async with pool.acquire() as conn:
        status_map = {
            "approve": "approved",
            "reject": "rejected",
            "suspend": "suspended",
            "request_docs": "pending_employment",
        }

        # Check institution scoping
        if admin.role != "admin":
            admin_inst_uuid = _require_admin_inst_uuid(admin)
            mentor = await conn.fetchrow("SELECT u.institution_id FROM mentor_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.id = $1", mentor_profile_id)
            if not mentor or str(mentor["institution_id"]) != admin.institution_id:
                raise HTTPException(403, "Cannot modify mentor from other institution")

        updated = await conn.fetchrow(
            """
            UPDATE mentor_profiles SET
              verification_status = $1,
              is_approved = $2,
              is_active = $3,
              verification_notes = $4,
              verified_by = $5,
              verified_at = $6,
              updated_at = now()
            WHERE id = $7
            RETURNING user_id, full_name, verification_status, is_approved
            """,
            status_map[action],
            action == "approve",
            action != "suspend",
            notes or None,
            uuid.UUID(admin.id) if action == "approve" else None,
            None if action != "approve" else __import__("datetime").datetime.utcnow(),
            mentor_profile_id,
        )

        if not updated:
            raise HTTPException(404, "Mentor not found")

        if updated["user_id"]:
            notif_messages = {
                "approve": {
                    "title": "🎉 Application Approved!",
                    "body": "Your mentor profile has been approved. You can now start accepting mentee requests!",
                },
                "reject": {
                    "title": "Application Update",
                    "body": notes or "Your mentor application was not approved at this time.",
                },
                "request_docs": {
                    "title": "Documents Required",
                    "body": "Please submit your employment verification documents to complete your application.",
                },
                "suspend": {
                    "title": "Account Suspended",
                    "body": notes
                    or "Your account has been temporarily suspended. Contact support for more information.",
                },
            }
            notif = notif_messages[action]
            try:
                await conn.execute(
                    """
                    INSERT INTO notifications (user_id, type, title, body)
                    VALUES ($1, $2, $3, $4)
                    """,
                    updated["user_id"],
                    action,
                    notif["title"],
                    notif["body"],
                )
            except Exception:
                logger.exception("Failed to create mentor notification")

    return {"success": True, "mentor": dict(updated)}


@router.get("/safety")
async def get_safety_dashboard(
    institution_id: str | None = None,
    admin: CurrentUser = Depends(require_moderator),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        inst_uuid = uuid.UUID(institution_id) if admin.role == "admin" and institution_id else None
        
        if admin.role in ("admin", "moderator") and not inst_uuid:
            reports = await conn.fetch(
                """
                SELECT sr.*,
                  reporter.email as reporter_email,
                  reported.email as reported_email,
                  CASE WHEN reported_mp.user_id IS NOT NULL THEN 'mentor' ELSE 'mentee' END as reported_role,
                  COALESCE(reported_mp.full_name, reported_mentee.full_name, 'Unknown') as reported_name
                FROM safety_reports sr
                JOIN users reporter ON reporter.id = sr.reporter_id
                JOIN users reported ON reported.id = sr.reported_user_id
                LEFT JOIN mentor_profiles reported_mp ON reported_mp.user_id = sr.reported_user_id
                LEFT JOIN mentee_profiles reported_mentee ON reported_mentee.user_id = sr.reported_user_id
                ORDER BY
                  CASE sr.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                  sr.created_at DESC
                LIMIT 30
                """
            )
            suspended = await conn.fetch(
                """
                SELECT u.id, u.email, u.is_suspended, u.suspended_reason, u.suspended_at,
                  COALESCE(mp.full_name, mentee_p.full_name, 'Unknown') as name,
                  CASE WHEN mp.user_id IS NOT NULL THEN 'mentor' ELSE 'mentee' END as role
                FROM users u
                LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
                LEFT JOIN mentee_profiles mentee_p ON mentee_p.user_id = u.id
                WHERE u.is_suspended = true AND NOT u.is_deleted
                ORDER BY u.suspended_at DESC
                LIMIT 20
                """
            )
            risk_mentors = await conn.fetch(
                """
                SELECT DISTINCT ON (mentor_id)
                  mrs.*,
                  mp.full_name, mp.job_title, mp.employer,
                  u.email
                FROM mentor_risk_snapshots mrs
                JOIN mentor_profiles mp ON mp.user_id = mrs.mentor_id
                JOIN users u ON u.id = mrs.mentor_id
                WHERE mrs.risk_score > 0.3
                ORDER BY mentor_id, snapshot_at DESC
                """
            )
            stats = await conn.fetchrow(
                """
                SELECT
                  COUNT(*) FILTER (WHERE status = 'open') as open_reports,
                  COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open') as critical_open,
                  COUNT(*) FILTER (WHERE auto_suspended = true) as auto_suspensions,
                  COUNT(*) as total_reports
                FROM safety_reports
                """
            )
        else:
            inst_uuid = uuid.UUID(institution_id) if admin.role == "admin" and institution_id else _require_admin_inst_uuid(admin)
            reports = await conn.fetch(
                """
                SELECT sr.*,
                  reporter.email as reporter_email,
                  reported.email as reported_email,
                  CASE WHEN reported_mp.user_id IS NOT NULL THEN 'mentor' ELSE 'mentee' END as reported_role,
                  COALESCE(reported_mp.full_name, reported_mentee.full_name, 'Unknown') as reported_name
                FROM safety_reports sr
                JOIN users reporter ON reporter.id = sr.reporter_id
                JOIN users reported ON reported.id = sr.reported_user_id
                LEFT JOIN mentor_profiles reported_mp ON reported_mp.user_id = sr.reported_user_id
                LEFT JOIN mentee_profiles reported_mentee ON reported_mentee.user_id = sr.reported_user_id
                WHERE reported.institution_id = $1
                ORDER BY
                  CASE sr.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                  sr.created_at DESC
                LIMIT 30
                """,
                inst_uuid,
            )
            suspended = await conn.fetch(
                """
                SELECT u.id, u.email, u.is_suspended, u.suspended_reason, u.suspended_at,
                  COALESCE(mp.full_name, mentee_p.full_name, 'Unknown') as name,
                  CASE WHEN mp.user_id IS NOT NULL THEN 'mentor' ELSE 'mentee' END as role
                FROM users u
                LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
                LEFT JOIN mentee_profiles mentee_p ON mentee_p.user_id = u.id
                WHERE u.is_suspended = true AND NOT u.is_deleted AND u.institution_id = $1
                ORDER BY u.suspended_at DESC
                LIMIT 20
                """,
                inst_uuid,
            )
            risk_mentors = await conn.fetch(
                """
                SELECT DISTINCT ON (mentor_id)
                  mrs.*,
                  mp.full_name, mp.job_title, mp.employer,
                  u.email
                FROM mentor_risk_snapshots mrs
                JOIN mentor_profiles mp ON mp.user_id = mrs.mentor_id
                JOIN users u ON u.id = mrs.mentor_id
                WHERE mrs.risk_score > 0.3 AND u.institution_id = $1
                ORDER BY mentor_id, snapshot_at DESC
                """,
                inst_uuid,
            )
            stats = await conn.fetchrow(
                """
                SELECT
                  COUNT(*) FILTER (WHERE status = 'open') as open_reports,
                  COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open') as critical_open,
                  COUNT(*) FILTER (WHERE auto_suspended = true) as auto_suspensions,
                  COUNT(*) as total_reports
                FROM safety_reports sr
                JOIN users reported ON reported.id = sr.reported_user_id
                WHERE reported.institution_id = $1
                """,
                inst_uuid,
            )

    return {
        "reports": [dict(row) for row in reports],
        "suspended_users": [dict(row) for row in suspended],
        "high_risk_mentors": [dict(row) for row in risk_mentors],
        "stats": dict(stats) if stats else {},
    }


@router.put("/safety")
async def review_safety_item(
    payload: dict,
    admin: CurrentUser = Depends(require_moderator),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    report_id = payload.get("report_id")
    action = payload.get("action")
    resolution_notes = payload.get("resolution_notes")
    unsuspend_user_id = payload.get("unsuspend_user_id")

    async with pool.acquire() as conn:
        if unsuspend_user_id:
            # check institution
            if admin.role != "admin":
                admin_inst_uuid = _require_admin_inst_uuid(admin)
                target_user = await conn.fetchrow("SELECT institution_id FROM users WHERE id = $1", uuid.UUID(unsuspend_user_id))
                if not target_user or str(target_user["institution_id"]) != admin.institution_id:
                    raise HTTPException(403, "Cannot unsuspend user from other institution")

            await conn.execute(
                """
                UPDATE users SET is_suspended = false, suspended_reason = null, suspended_at = null
                WHERE id = $1
                """,
                uuid.UUID(unsuspend_user_id),
            )
            return {"success": True, "action": "unsuspended"}

        if report_id and action:
            status_map = {
                "resolve": "resolved",
                "dismiss": "dismissed",
                "escalate": "escalated_to_authorities",
                "review": "reviewing",
            }
            new_status = status_map.get(action)
            if not new_status:
                raise HTTPException(400, "Invalid action")

            if admin.role != "admin":
                admin_inst_uuid = _require_admin_inst_uuid(admin)
                report = await conn.fetchrow(
                    "SELECT u.institution_id FROM safety_reports sr JOIN users u ON u.id = sr.reported_user_id WHERE sr.id = $1",
                    uuid.UUID(report_id)
                )
                if not report or str(report["institution_id"]) != admin.institution_id:
                    raise HTTPException(403, "Cannot update safety report from other institution")

            await conn.execute(
                """
                UPDATE safety_reports SET
                  status = $1,
                  reviewed_by = $2,
                  reviewed_at = now(),
                  resolution_notes = $3,
                  updated_at = now()
                WHERE id = $4
                """,
                new_status,
                uuid.UUID(admin.id),
                resolution_notes or None,
                uuid.UUID(report_id),
            )
            return {"success": True, "action": new_status}

    raise HTTPException(400, "Invalid request")


@router.get("/pending-mentors")
async def list_pending_mentors(
    institution_id: str | None = None,
    page: int = 1,
    per_page: int = 25,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if admin.role != "admin":
        admin_inst_uuid = _admin_inst_uuid(admin)
        if admin_inst_uuid is None:
            raise HTTPException(400, "Institution context required")
        if institution_id and institution_id != admin.institution_id:
            raise HTTPException(403, "Cannot access other institution's data")

    inst_filter = institution_id or admin.institution_id
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT u.id, u.email, u.phone, u.country, u.created_at,
                   mp.full_name, mp.job_title, mp.employer, mp.industry,
                   mp.years_exp, mp.bio, mp.bio_safety_score, mp.bio_flags,
                   mp.linkedin_url, mp.verification_status,
                   mp.id_document_path IS NOT NULL AS has_id_doc,
                   mp.employment_doc_path IS NOT NULL AS has_emp_doc,
                   mp.code_of_conduct_signed
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.verification_status = 'pending_admin_review'
              AND (u.institution_id = $1 OR $1 IS NULL OR $2 = 'admin')
            ORDER BY u.created_at ASC
            LIMIT $3 OFFSET $4
            """,
            uuid.UUID(inst_filter) if inst_filter else None,
            admin.role,
            per_page,
            offset,
        )
    return {"items": [dict(row) for row in rows], "page": page, "per_page": per_page}


@router.post("/mentors/{mentor_user_id}/approve")
async def approve_mentor(
    mentor_user_id: str,
    can_mentor_minors: bool = False,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    logger.info(
        "Admin action",
        extra={
            "action": "approve_mentor",
            "target_user_id": mentor_user_id,
            "actor_id": admin.id,
            "actor_role": admin.role,
        },
    )

    async with pool.acquire() as conn:
        mentor = await conn.fetchrow(
            "SELECT user_id, institution_id FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(mentor_user_id),
        )
        if not mentor:
            raise HTTPException(404, "Mentor not found")

        if admin.role != "admin" and str(mentor["institution_id"]) != admin.institution_id:
            raise HTTPException(403, "Cannot approve mentor from other institution")

        await conn.execute(
            """
            UPDATE mentor_profiles SET
                is_approved = true,
                can_mentor_minors = $1,
                verification_status = 'approved',
                verified_by = $2,
                verified_at = now()
            WHERE user_id = $3
            """,
            can_mentor_minors,
            uuid.UUID(admin.id),
            uuid.UUID(mentor_user_id),
        )
    try:
        from tasks.sms_tasks import notify_mentor_approved

        notify_mentor_approved.apply_async(args=[str(mentor_user_id)])
    except Exception as e:
        logger.warning(f"Could not queue mentor approval notification: {e}")
    return {"message": "Mentor approved.", "can_mentor_minors": can_mentor_minors}


@router.post("/mentors/{mentor_user_id}/reject")
async def reject_mentor(
    mentor_user_id: str,
    reason: str,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    logger.info(
        "Admin action",
        extra={
            "action": "reject_mentor",
            "target_user_id": mentor_user_id,
            "actor_id": admin.id,
            "actor_role": admin.role,
        },
    )

    async with pool.acquire() as conn:
        mentor = await conn.fetchrow(
            "SELECT user_id, institution_id FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(mentor_user_id),
        )
        if not mentor:
            raise HTTPException(404, "Mentor not found")

        if admin.role != "admin" and str(mentor["institution_id"]) != admin.institution_id:
            raise HTTPException(403, "Cannot reject mentor from other institution")

        await conn.execute(
            "UPDATE mentor_profiles SET "
            "verification_status = 'rejected', "
            "verification_notes = $1 WHERE user_id = $2",
            reason,
            uuid.UUID(mentor_user_id),
        )
    return {"message": "Mentor application rejected.", "reason": reason}


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    reason: str,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    logger.info(
        "Admin action",
        extra={
            "action": "suspend_user",
            "target_user_id": user_id,
            "actor_id": admin.id,
            "actor_role": admin.role,
        },
    )

    async with pool.acquire() as conn:
        target_user = await conn.fetchrow(
            "SELECT id, institution_id FROM users WHERE id = $1", uuid.UUID(user_id)
        )
        if not target_user:
            raise HTTPException(404, "User not found")

        if admin.role != "admin" and str(target_user["institution_id"]) != admin.institution_id:
            raise HTTPException(403, "Cannot suspend user from other institution")

        await conn.execute(
            """
            UPDATE users SET
                is_suspended = true,
                suspended_reason = $1,
                suspended_at = now()
            WHERE id = $2
            """,
            reason,
            uuid.UUID(user_id),
        )
    return {"message": "User suspended.", "user_id": user_id}



@router.get("/safety-reports")
async def list_safety_reports(
    status_filter: str = "open",
    page: int = 1,
    per_page: int = 25,
    admin: CurrentUser = Depends(require_moderator),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    if admin.role != "admin":
        admin_inst_uuid = _require_admin_inst_uuid(admin)
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT sr.*, u_rep2.is_suspended
                FROM safety_reports sr
                JOIN users u_rep ON u_rep.id = sr.reporter_id
                JOIN users u_rep2 ON u_rep2.id = sr.reported_user_id
                WHERE sr.status = $1
                  AND sr.reported_user_id IN (
                      SELECT id FROM users WHERE institution_id = $2
                  )
                ORDER BY sr.created_at ASC
                LIMIT $3 OFFSET $4
                """,
                status_filter,
                admin_inst_uuid,
                per_page,
                offset,
            )
    else:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT sr.*, u_rep2.is_suspended
                FROM safety_reports sr
                JOIN users u_rep ON u_rep.id = sr.reporter_id
                JOIN users u_rep2 ON u_rep2.id = sr.reported_user_id
                WHERE sr.status = $1
                ORDER BY sr.created_at ASC
                LIMIT $2 OFFSET $3
                """,
                status_filter,
                per_page,
                offset,
            )
    return {"items": [dict(row) for row in rows], "page": page, "per_page": per_page}


@router.patch("/safety-reports/{report_id}")
async def update_safety_report(
    report_id: str,
    status: str = Body(..., embed=True),
    resolution_notes: str = Body(None),
    admin: CurrentUser = Depends(require_moderator),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if admin.role != "admin":
        admin_inst_uuid = _require_admin_inst_uuid(admin)

    if status not in ("open", "reviewing", "resolved", "dismissed", "escalated_to_authorities"):
        raise HTTPException(400, "Invalid status")

    async with pool.acquire() as conn:
        if admin.role != "admin":
            # Verify the reported user belongs to the admin's institution
            report = await conn.fetchrow(
                "SELECT u.institution_id FROM safety_reports sr JOIN users u ON u.id = sr.reported_user_id WHERE sr.id = $1",
                uuid.UUID(report_id)
            )
            if not report or str(report["institution_id"]) != admin.institution_id:
                raise HTTPException(403, "Cannot update safety report from other institution")

        await conn.execute(
            """
            UPDATE safety_reports
            SET status = $1,
                reviewed_by = $2,
                reviewed_at = now(),
                resolution_notes = $3
            WHERE id = $4
            """,
            status,
            uuid.UUID(admin.id),
            resolution_notes,
            uuid.UUID(report_id),
        )

        logger.info(
            "Safety report reviewed",
            extra={
                "report_id": report_id,
                "new_status": status,
                "reviewer_id": admin.id,
            },
        )

    return {"status": "updated"}


@router.get("/institutions/{institution_id}/stats")
async def get_institution_stats(
    institution_id: str,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if admin.role != "admin":
        if not admin.institution_id or str(institution_id) != admin.institution_id:
            raise HTTPException(403, "Cannot access other institution's statistics")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM v_institution_cohort_summary WHERE institution_id = $1",
            uuid.UUID(institution_id),
        )
    if not row:
        raise HTTPException(404, "Institution not found.")
    return dict(row)


@institution_router.get("/{subdomain}/stats")
async def get_institution_stats_by_subdomain(
    subdomain: str,
    admin: CurrentUser = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM institutions WHERE subdomain = $1", subdomain.lower()
        )
    if not row:
        raise HTTPException(404, "Institution not found.")

    async with pool.acquire() as conn:
        summary = await conn.fetchrow(
            "SELECT * FROM v_institution_cohort_summary WHERE institution_id = $1",
            row["id"],
        )

    return {
        "institution_name": row["name"],
        "country": row["country"],
        "total_mentees": summary["total_mentees"] if summary else 0,
        "total_mentors": summary["total_mentors"] if summary else 0,
        "active_matches": summary["active_matches"] if summary else 0,
        "pending_matches": summary["pending_matches"] if summary else 0,
        "completed_programmes": summary["completed_programmes"] if summary else 0,
        "sdg4_events": summary["sdg4_events"] if summary else 0,
        "sdg5_events": summary["sdg5_events"] if summary else 0,
        "sdg8_events": summary["sdg8_events"] if summary else 0,
        "offline_sessions": summary["offline_sessions"] if summary else 0,
        "web_sessions": summary["web_sessions"] if summary else 0,
        "safety_alerts": summary["safety_alerts"] if summary else 0,
    }
