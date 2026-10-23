"""
Trust Service — Phase 5 "Safety as Trust System"

Surface the mentor verification pipeline as a public trust badge with
explicit escalation states, optional in-memory event classification for the
admin queue, and pure helpers for the audit timeline.

This module deliberately has no DB writes — everything is derived from the
existing mentor_profiles, safety_reports, users, and matches tables. Read
side only. Writes go through admin.py and the Celery worker.

Escalation states (per match / per mentor):
    safe         – bio passed, no open reports, no temporal alarm
    monitor      – ≥1 flag but risk_score < 0.3 OR bio flagged but reviewed clean
    human_review – open safety_report with severity ∈ {high, critical}
    suspended    – user.is_suspended OR verification_status = 'suspended'

Trust stages (per mentor):
    unverified, pending_id, pending_employment, pending_admin_review,
    approved, rejected, suspended
    → mirrors services/db/migrations/001_schema.sql:111 verification_status enum
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# ── Verification stage ordering (lowest → highest trust) ────────────────────────
VERIFICATION_STAGE_ORDER = [
    "unverified",
    "pending_id",
    "pending_employment",
    "pending_admin_review",
    "approved",
    "rejected",
    "suspended",
]

VERIFICATION_STAGE_LABELS = {
    "unverified": "Unverified",
    "pending_id": "ID document pending",
    "pending_employment": "Employment verification pending",
    "pending_admin_review": "Awaiting admin review",
    "approved": "Verified mentor",
    "rejected": "Application rejected",
    "suspended": "Suspended",
}

VERIFICATION_STAGE_BADGES = {
    "unverified": {"color": "gray", "icon": "?"},
    "pending_id": {"color": "amber", "icon": "id"},
    "pending_employment": {"color": "amber", "icon": "briefcase"},
    "pending_admin_review": {"color": "amber", "icon": "shield"},
    "approved": {"color": "emerald", "icon": "check"},
    "rejected": {"color": "red", "icon": "x"},
    "suspended": {"color": "red", "icon": "pause"},
}


# ── Escalation states (per match) ──────────────────────────────────────────────
ESCALATION_STATES = ("safe", "monitor", "human_review", "suspended")


@dataclass
class TrustBadge:
    user_id: str
    verification_status: str
    trust_score: float  # 0.0 – 1.0
    trust_tier: str  # "unverified" | "developing" | "verified" | "trusted"
    badge: dict[str, str]
    can_mentor_minors: bool
    is_active: bool
    gates_passed: list[str]
    gates_pending: list[str]
    last_updated: str | None


@dataclass
class EscalationState:
    match_id: str
    state: str  # one of ESCALATION_STATES
    risk_score: float
    open_reports: int
    highest_severity: str | None
    trigger_reasons: list[str]
    last_event_at: str | None


def compute_trust_score(
    is_approved: bool,
    bio_safety_score: float,
    temporal_risk_score: float,
    open_safety_reports: int,
) -> float:
    """0.0 – 1.0 trust score.

    Approved mentor with clean bio, no temporal alarm, no open reports → 1.0.
    Suspended / has open critical report → 0.0.
    Nothing below 0.0, nothing above 1.0.
    """
    if not is_approved:
        return 0.0
    score = (
        bio_safety_score * 0.45
        + (1.0 - temporal_risk_score) * 0.35
        + max(0.0, 1.0 - 0.25 * open_safety_reports) * 0.20
    )
    return round(max(0.0, min(1.0, score)), 3)


def trust_tier_from_score(score: float, verification_status: str) -> str:
    """Map score to a UI tier, capped by verification status."""
    if verification_status == "suspended":
        return "unverified"
    if verification_status not in ("approved",):
        return "developing"
    if score >= 0.85:
        return "trusted"
    if score >= 0.65:
        return "verified"
    return "developing"


def build_trust_badge(mentor_row: dict[str, Any]) -> TrustBadge:
    """Derive a TrustBadge from a JOIN row over users + mentor_profiles."""
    verification_status = str(mentor_row.get("verification_status") or "unverified")
    is_approved = bool(mentor_row.get("is_approved"))
    open_reports = int(mentor_row.get("open_safety_reports") or 0)
    bio_safety_score = float(mentor_row.get("bio_safety_score") or 0.0)
    temporal_risk_score = float(mentor_row.get("temporal_risk_score") or 0.0)

    if is_approved and not open_reports:
        gates_passed = [
            "id_verified",
            "employment_verified",
            "code_of_conduct_signed",
            "bio_safety_scan_passed",
            "human_reviewed",
        ]
        gates_pending = []
    else:
        all_gates = [
            "id_verified",
            "employment_verified",
            "code_of_conduct_signed",
            "bio_safety_scan_passed",
            "human_reviewed",
        ]
        gates_passed = ["id_verified"] if verification_status != "unverified" else []
        gates_pending = [
            g
            for g in all_gates
            if verification_status not in ("approved",) or g not in gates_passed
        ]

    score = compute_trust_score(
        is_approved=is_approved,
        bio_safety_score=bio_safety_score,
        temporal_risk_score=temporal_risk_score,
        open_safety_reports=open_reports,
    )
    tier = trust_tier_from_score(score, verification_status)

    return TrustBadge(
        user_id=str(mentor_row.get("user_id")),
        verification_status=verification_status,
        trust_score=score,
        trust_tier=tier,
        badge=VERIFICATION_STAGE_BADGES.get(verification_status, {"color": "gray", "icon": "?"}),
        can_mentor_minors=bool(mentor_row.get("can_mentor_minors")),
        is_active=bool(mentor_row.get("is_active")),
        gates_passed=gates_passed,
        gates_pending=gates_pending,
        last_updated=str(mentor_row.get("verified_at") or mentor_row.get("updated_at")),
    )


def derive_escalation_state(
    match_row: dict[str, Any],
    safety_reports: list[dict[str, Any]],
    temporal_profile: dict[str, Any] | None,
) -> EscalationState:
    """Combine user suspension, safety reports, and temporal profile.

    Inputs are tiny dicts — the router does the SQL — so this stays pure and
    easy to unit test.
    """
    triggers: list[str] = []

    if bool(match_row.get("mentor_suspended")) or bool(match_row.get("mentee_suspended")):
        return EscalationState(
            match_id=str(match_row.get("match_id")),
            state="suspended",
            risk_score=float(match_row.get("mentor_temporal_risk") or 0.0),
            open_reports=0,
            highest_severity=None,
            trigger_reasons=["user_suspended"],
            last_event_at=str(match_row.get("mentor_updated_at") or match_row.get("updated_at")),
        )

    open_reports = [
        r
        for r in safety_reports
        if r.get("status") in ("open", "reviewing", "escalated_to_authorities")
    ]
    critical_open = [r for r in open_reports if r.get("severity") in ("high", "critical")]
    highest_severity = (
        max((r.get("severity") for r in open_reports), key=_severity_rank, default=None)
        if open_reports
        else None
    )

    profile = temporal_profile or {}
    risk_score = float(profile.get("risk_score") or match_row.get("mentor_temporal_risk") or 0.0)
    off_platform_count = int(
        profile.get("off_platform_count") or match_row.get("mentor_off_platform_count") or 0
    )

    if critical_open:
        triggers.append(f"{len(critical_open)} open high/critical safety report(s)")
        return EscalationState(
            match_id=str(match_row.get("match_id")),
            state="human_review",
            risk_score=risk_score,
            open_reports=len(open_reports),
            highest_severity=highest_severity,
            trigger_reasons=triggers or ["safety_report_open"],
            last_event_at=str(profile.get("last_updated") or match_row.get("updated_at")),
        )

    if risk_score >= 0.5 or off_platform_count >= 1:
        if risk_score >= 0.8 or off_platform_count >= 2:
            triggers.append("temporal_risk_critical")
            return EscalationState(
                match_id=str(match_row.get("match_id")),
                state="human_review",
                risk_score=risk_score,
                open_reports=len(open_reports),
                highest_severity=highest_severity,
                trigger_reasons=triggers,
                last_event_at=str(profile.get("last_updated")),
            )
        triggers.append("temporal_risk_high")
        return EscalationState(
            match_id=str(match_row.get("match_id")),
            state="monitor",
            risk_score=risk_score,
            open_reports=len(open_reports),
            highest_severity=highest_severity,
            trigger_reasons=triggers,
            last_event_at=str(profile.get("last_updated")),
        )

    if open_reports:
        triggers.append(f"{len(open_reports)} open non-critical safety report(s)")
        return EscalationState(
            match_id=str(match_row.get("match_id")),
            state="monitor",
            risk_score=risk_score,
            open_reports=len(open_reports),
            highest_severity=highest_severity,
            trigger_reasons=triggers,
            last_event_at=str(profile.get("last_updated")),
        )

    return EscalationState(
        match_id=str(match_row.get("match_id")),
        state="safe",
        risk_score=risk_score,
        open_reports=0,
        highest_severity=None,
        trigger_reasons=["no_safety_signals"],
        last_event_at=str(profile.get("last_updated")),
    )


def _severity_rank(severity: str | None) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4, None: 0}.get(severity or "", 0)


def build_audit_timeline(
    match_row: dict[str, Any],
    bio_scan: dict[str, Any] | None,
    safety_reports: list[dict[str, Any]],
    temporal_profile: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Return a single chronological view of safety-relevant events for a match.

    Sources: bio scan (one-time on mentor approval), safety_reports (open and
    closed), and temporal_profile.events (rolling 48h window).

    Each entry has: ts, source, severity, summary, evidence_pointer.
    """
    timeline: list[dict[str, Any]] = []

    if bio_scan and bio_scan.get("scanned_at"):
        timeline.append(
            {
                "ts": bio_scan["scanned_at"],
                "source": "bio_scan",
                "severity": "low" if bio_scan.get("approved") else "medium",
                "summary": "Mentor bio safety scan",
                "evidence_pointer": {
                    "safe_score": bio_scan.get("safe_score"),
                    "flags": bio_scan.get("flags", []),
                    "requires_human_review": bio_scan.get("requires_human_review", False),
                    "content_hash": bio_scan.get("content_hash"),
                },
            }
        )

    for r in safety_reports:
        timeline.append(
            {
                "ts": r.get("created_at"),
                "source": "safety_report",
                "severity": r.get("severity"),
                "summary": f"Safety report ({r.get('status')}): {r.get('reason') or r.get('description', '')[:120]}",
                "evidence_pointer": {
                    "report_id": r.get("id"),
                    "reporter_id": r.get("reporter_id"),
                    "reported_user_id": r.get("reported_user_id"),
                    "status": r.get("status"),
                },
            }
        )

    if temporal_profile:
        for event in temporal_profile.get("events", []):
            timeline.append(
                {
                    "ts": event.get("timestamp"),
                    "source": "temporal_event",
                    "severity": _temporal_event_severity(event.get("flags", [])),
                    "summary": ", ".join(event.get("flags", [])) or "message_scanned",
                    "evidence_pointer": {
                        "sender_role": event.get("sender_role"),
                        "message_length": event.get("message_length"),
                        "matched_patterns": event.get("matched_patterns", []),
                    },
                }
            )

    timeline.sort(key=lambda e: str(e.get("ts") or ""), reverse=True)
    return timeline


def _temporal_event_severity(flags: list[str]) -> str:
    if "off_platform_attempt" in flags:
        return "high"
    if "intimacy_escalation" in flags:
        return "medium"
    return "low"


def build_risk_timeline(temporal_profile: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Return only the numeric risk-score progression suitable for a line chart."""
    if not temporal_profile:
        return []
    events = temporal_profile.get("events", [])
    rolling_score = 0.0
    off_remaining = 0
    intim_remaining = 0
    series: list[dict[str, Any]] = []
    for event in events:
        flags = event.get("flags", [])
        if "off_platform_attempt" in flags:
            off_remaining += 1
        if "intimacy_escalation" in flags:
            intim_remaining += 1
        rolling_score = min(
            1.0,
            off_remaining * 0.4 + intim_remaining * 0.2,
        )
        series.append(
            {
                "ts": event.get("timestamp"),
                "risk_score": round(rolling_score, 3),
                "flags": flags,
            }
        )
    return series
