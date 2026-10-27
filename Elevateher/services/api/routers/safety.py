import asyncio
import json
import logging
import uuid

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from dependencies import (
    CurrentUser,
    get_current_user,
    get_current_user_from_query,
    get_db_pool,
    get_redis,
    require_moderator,
)

try:
    from services.api.services.safety_service import scan_bio, scan_message, scan_text
except ImportError:

    def scan_bio(bio: str) -> dict:
        return {
            "approved": False,
            "safe_score": 0.0,
            "flags": ["unavailable"],
            "requires_human_review": True,
        }

    def scan_message(message: str) -> dict:
        return {
            "approved": False,
            "safe_score": 0.0,
            "flags": ["unavailable"],
            "requires_human_review": True,
        }

    def scan_text(text: str) -> dict:
        return scan_message(text)


try:
    from services.api.services.trust_service import (
        build_audit_timeline,
        build_risk_timeline,
        build_trust_badge,
        derive_escalation_state,
    )
except ImportError:

    def build_audit_timeline(*args, **kwargs):
        return []

    def build_risk_timeline(*args, **kwargs):
        return []

    def build_trust_badge(*args, **kwargs):
        return {"badge": "unknown"}

    def derive_escalation_state(*args, **kwargs):
        return "unknown"


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/safety", tags=["Safety"])


class BioScanRequest(BaseModel):
    bio: str = Field(default="")
    text: str = Field(default="")
    user_id: str | None = Field(default=None)
    institution_id: str | None = Field(default=None)


class MessageScanRequest(BaseModel):
    message: str = Field(default="")
    text: str = Field(default="")
    user_id: str | None = Field(default=None)
    institution_id: str | None = Field(default=None)


class TextScanRequest(BaseModel):
    text: str = Field(default="")
    user_id: str | None = Field(default=None)
    institution_id: str | None = Field(default=None)


def _require_scan_context(payload: BioScanRequest | MessageScanRequest | TextScanRequest):
    """Ensure either user_id or institution_id is provided for audit trail."""
    if not payload.user_id and not payload.institution_id:
        raise HTTPException(400, "Either user_id or institution_id is required")


@router.post("/bio")
async def check_bio(payload: BioScanRequest, user: CurrentUser = Depends(require_moderator)):
    _require_scan_context(payload)
    logger.info(
        "Bio scan initiated",
        extra={
            "scanner_id": user.id,
            "scanner_role": user.role,
            "target_user_id": payload.user_id,
        },
    )
    bio = payload.bio or payload.text
    return scan_bio(bio)


@router.post("/message")
async def check_message(
    payload: MessageScanRequest, user: CurrentUser = Depends(require_moderator)
):
    _require_scan_context(payload)
    logger.info(
        "Message scan initiated",
        extra={
            "scanner_id": user.id,
            "scanner_role": user.role,
            "target_user_id": payload.user_id,
        },
    )
    message = payload.message or payload.text
    return scan_message(message)


@router.post("/text")
async def check_text(payload: TextScanRequest, user: CurrentUser = Depends(require_moderator)):
    _require_scan_context(payload)
    logger.info(
        "Text scan initiated",
        extra={
            "scanner_id": user.id,
            "scanner_role": user.role,
            "target_user_id": payload.user_id,
        },
    )
    return scan_text(payload.text)


# ──────────────────────────────────────────────────────────────────────────────
# Phase 5 — Safety as Trust System
#
# Four read-only surfaces that turn the existing safety layer into a visible
# trust system. Each endpoint enriches DB state with the same pure functions
# defined in services/api/services/trust_service.py so they can be unit
# tested in isolation.
#
#   GET /safety/trust/{mentor_user_id}
#       → TrustBadge : verification stage, score, tier, gates passed/pending,
#         can_mentor_minors flag. Public to mentees viewing matched mentors.
#
#   GET /safety/escalation/state?match_id=…
#       → EscalationState : safe | monitor | human_review | suspended,
#         risk_score, open_reports, trigger_reasons. Visible to both
#         participants of the match and to institution moderators.
#
#   GET /safety/audit/{match_id}
#       → Chronological audit timeline (bio scan + safety_reports +
#         temporal events) for moderators and institutions.
#
#   GET /safety/risk-timeline/{match_id}
#       → Numeric risk score rolling-window series for the dashboard chart.
# ──────────────────────────────────────────────────────────────────────────────


def _serialize_trust_badge(badge) -> dict:
    return {
        "user_id": badge.user_id,
        "verification_status": badge.verification_status,
        "trust_score": badge.trust_score,
        "trust_tier": badge.trust_tier,
        "badge": badge.badge,
        "can_mentor_minors": badge.can_mentor_minors,
        "is_active": badge.is_active,
        "gates_passed": badge.gates_passed,
        "gates_pending": badge.gates_pending,
        "last_updated": badge.last_updated,
    }


def _serialize_escalation_state(state) -> dict:
    return {
        "match_id": state.match_id,
        "state": state.state,
        "risk_score": state.risk_score,
        "open_reports": state.open_reports,
        "highest_severity": state.highest_severity,
        "trigger_reasons": state.trigger_reasons,
        "last_event_at": state.last_event_at,
    }


async def _load_mentor_row(pool: asyncpg.Pool, mentor_user_id: str) -> dict | None:
    """JOIN users + mentor_profiles + count open safety_reports for one mentor."""
    row = await pool.fetchrow(
        """
        SELECT
            u.id          AS user_id,
            u.is_suspended AS is_suspended,
            u.is_deleted   AS is_deleted,
            u.updated_at   AS user_updated_at,
            mp.verification_status,
            mp.is_approved,
            mp.is_active,
            mp.can_mentor_minors,
            mp.bio_safety_score,
            mp.temporal_risk_score,
            mp.verified_at,
            mp.updated_at,
            (SELECT COUNT(*) FROM safety_reports sr
              WHERE sr.reported_user_id = u.id
                AND sr.status IN ('open','reviewing','escalated_to_authorities')
            )             AS open_safety_reports
        FROM users u
        LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
        WHERE u.id = $1
          AND u.role = 'mentor'
        """,
        mentor_user_id,
    )
    if not row:
        return None
    return dict(row)


async def _load_match_context(pool: asyncpg.Pool, match_id: str) -> dict | None:
    row = await pool.fetchrow(
        """
        SELECT
            m.id          AS match_id,
            m.mentor_id   AS mentor_id,
            m.mentee_id   AS mentee_id,
            u_mentor.is_suspended AS mentor_suspended,
            u_mentee.is_suspended AS mentee_suspended,
            u_mentor.is_deleted   AS mentor_deleted,
            u_mentee.is_deleted   AS mentee_deleted,
            u_mentor.updated_at   AS mentor_updated_at,
            m.updated_at,
            mp.verification_status AS mentor_verification_status,
            mp.temporal_risk_score  AS mentor_temporal_risk
        FROM matches m
        JOIN users u_mentor ON u_mentor.id = m.mentor_id
        JOIN users u_mentee ON u_mentee.id = m.mentee_id
        LEFT JOIN mentor_profiles mp ON mp.user_id = m.mentor_id
        WHERE m.id = $1
        """,
        match_id,
    )
    if not row:
        return None
    return dict(row)


async def _load_safety_reports(pool: asyncpg.Pool, match_id: str) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT id, reporter_id, reported_user_id, match_id, reason, description,
               severity, status, created_at
        FROM safety_reports
        WHERE match_id = $1
        ORDER BY created_at DESC
        """,
        match_id,
    )
    return [dict(r) for r in rows]


@router.get("/my-reports")
async def get_my_reports(
    pool: asyncpg.Pool = Depends(get_db_pool),
    user: CurrentUser = Depends(get_current_user),
):
    """Get safety reports submitted by the current user."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, reporter_id, reported_user_id, match_id, reason, description,
                   severity, status, created_at
            FROM safety_reports
            WHERE reporter_id = $1
            ORDER BY created_at DESC
            """,
            uuid.UUID(user.id),
        )
    return [dict(r) for r in rows]


async def _load_temporal_profile(redis: aioredis.Redis, match_id: str) -> dict | None:
    raw = await redis.get(f"temporal:{match_id}")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


@router.get("/trust/{mentor_user_id}")
async def get_mentor_trust_badge(
    mentor_user_id: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
    user: CurrentUser = Depends(get_current_user),
):
    """Public-to-participants mentor trust badge.

    Authenticated callers may read; this does not expose mentee identity.
    """
    mentor_row = await _load_mentor_row(pool, mentor_user_id)
    if not mentor_row:
        raise HTTPException(404, "Mentor not found")
    badge = build_trust_badge(mentor_row)
    return {
        "trust": _serialize_trust_badge(badge),
        "display": {
            "headline": badge.trust_tier.title(),
            "supportive_text": (
                "All safety gates passed. Verified by an ElevateHer moderator."
                if badge.trust_tier == "trusted"
                else "Verification in progress."
            ),
        },
        "scope": {
            "can_mentor_minors": badge.can_mentor_minors,
            "is_active": badge.is_active,
        },
    }


@router.get("/escalation/state")
async def get_escalation_state(
    match_id: str = Query(..., min_length=1),
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis: aioredis.Redis = Depends(get_redis),
    user: CurrentUser = Depends(get_current_user),
):
    """Return the current escalation state for a match.

    Visible to:
      - participants of the match (mentor, mentee),
      - moderators/institution admins of the mentor's institution.
    """
    match_row = await _load_match_context(pool, match_id)
    if not match_row:
        raise HTTPException(404, "Match not found")

    is_participant = str(user.id) in {
        str(match_row.get("mentor_id")),
        str(match_row.get("mentee_id")),
    }
    is_moderator = user.role in ("admin", "institution_admin", "moderator")
    if not (is_participant or is_moderator):
        raise HTTPException(403, "You cannot view this match's escalation state.")

    safety_reports = await _load_safety_reports(pool, match_id)
    temporal_profile = await _load_temporal_profile(redis, match_id)

    state = derive_escalation_state(match_row, safety_reports, temporal_profile)
    return {
        "escalation": _serialize_escalation_state(state),
        "viewer_role": "moderator"
        if is_moderator
        else ("mentor" if str(user.id) == str(match_row.get("mentor_id")) else "mentee"),
    }


@router.get("/audit/{match_id}")
async def get_match_audit_timeline(
    match_id: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis: aioredis.Redis = Depends(get_redis),
    user: CurrentUser = Depends(require_moderator),
):
    """Full chronological audit timeline for moderators and institutions.

    Combines: bio_scan (one event), safety_reports, and temporal events
    (rolling 48h window from Redis). Read-only.
    """
    match_row = await _load_match_context(pool, match_id)
    if not match_row:
        raise HTTPException(404, "Match not found")

    bio_scan = None
    if match_row.get("mentor_id"):
        bio_row = await pool.fetchrow(
            """
            SELECT bio_safety_score, bio_flags, bio_scanned_at,
                   updated_at, code_of_conduct_signed
            FROM mentor_profiles
            WHERE user_id = $1
            """,
            match_row["mentor_id"],
        )
        if bio_row:
            bio_scan = {
                "scanned_at": str(bio_row.get("bio_scanned_at") or bio_row.get("updated_at")),
                "approved": float(bio_row.get("bio_safety_score") or 0.0) >= 0.75,
                "safe_score": float(bio_row.get("bio_safety_score") or 0.0),
                "flags": list(bio_row.get("bio_flags") or []),
                "requires_human_review": float(bio_row.get("bio_safety_score") or 0.0) < 0.75,
            }

    safety_reports = await _load_safety_reports(pool, match_id)
    temporal_profile = await _load_temporal_profile(redis, match_id)

    timeline = build_audit_timeline(
        match_row=match_row,
        bio_scan=bio_scan,
        safety_reports=[{**r, "created_at": str(r.get("created_at"))} for r in safety_reports],
        temporal_profile=temporal_profile,
    )

    return {
        "match_id": match_id,
        "viewer_role": user.role,
        "event_count": len(timeline),
        "timeline": timeline,
    }


@router.get("/risk-timeline/{match_id}")
async def get_risk_timeline(
    match_id: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis: aioredis.Redis = Depends(get_redis),
    user: CurrentUser = Depends(require_moderator),
):
    """Numeric risk-score progression per event for one match.

    The dashboard renders this as a line chart under the impact / safety
    queue. Mentors never see this directly; moderators and institution admins do.
    """
    match_row = await _load_match_context(pool, match_id)
    if not match_row:
        raise HTTPException(404, "Match not found")

    temporal_profile = await _load_temporal_profile(redis, match_id)
    series = build_risk_timeline(temporal_profile)

    return {
        "match_id": match_id,
        "viewer_role": user.role,
        "window": "rolling_48h",
        "current_risk_score": series[-1]["risk_score"] if series else 0.0,
        "series": series,
    }


@router.get("/stream")
async def safety_reports_stream(
    institution_id: str | None = None,
    token: str | None = Query(default=None),
    user: CurrentUser | None = Depends(get_current_user_from_query),
    redis: aioredis.Redis = Depends(get_redis),
):
    if not user:
        raise HTTPException(401, "Authentication required")
    if user.role not in ("admin", "institution_admin", "moderator"):
        raise HTTPException(403, "Insufficient permissions")
    # Determine which institution's alerts this admin can see
    inst_uuid: uuid.UUID | str | None = None
    if user.role == "admin":
        # Super admin: optional institution filter
        if institution_id:
            try:
                inst_uuid = uuid.UUID(institution_id)
            except (ValueError, AttributeError, TypeError):
                raise HTTPException(400, "Invalid institution_id format") from None
    elif user.institution_id:
        inst_uuid = uuid.UUID(user.institution_id)
    else:
        # Institution admin/moderator with no institution context: no alerts
        inst_uuid = "NO_ACCESS"

    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe("safety_alerts")
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    data = json.loads(message["data"])
                    data_inst = data.get("institution_id")
                    if inst_uuid == "NO_ACCESS":
                        continue
                    if inst_uuid is None:
                        # Super admin with no filter: see all alerts
                        yield f"data: {json.dumps(data)}\n\n"
                    elif data_inst is not None and str(data_inst) == str(inst_uuid):
                        yield f"data: {json.dumps(data)}\n\n"
                await asyncio.sleep(1)
        finally:
            await pubsub.unsubscribe("safety_alerts")

    return StreamingResponse(event_generator(), media_type="text/event-stream")
