"""
Temporal Safety Service - API wrapper for message temporal analysis.

This module wraps the temporal_detector for use in the API layer.
"""

# ── Ensure proper import paths ─────────────────────────────────────────────────
# Import the centralized path management FIRST
import services.path  # noqa: F401
from services.safety.temporal_detector import (
    record_message_event as _record_message_event,  # noqa: E402
)


async def record_and_analyse_message(
    redis, match_id, sender_role, sender_id, message_text, mentor_id=None
):
    if mentor_id is None:
        mentor_id = sender_id if sender_role == "mentor" else "unknown"
    profile = await _record_message_event(
        redis_client=redis,
        match_id=match_id,
        sender_role=sender_role,
        sender_id=sender_id,
        message_text=message_text,
        mentor_id=mentor_id,
    )
    alert = None
    if profile.off_platform_count >= 2 or profile.risk_score >= 0.8:
        alert = {
            "level": "CRITICAL",
            "reason": "Multiple off-platform contact attempts or very high risk score",
            "action": "immediate_suspend",
            "risk_score": profile.risk_score,
        }
    elif profile.risk_score >= 0.5:
        alert = {
            "level": "HIGH",
            "reason": "Behavioural escalation pattern detected",
            "action": "flag_for_review",
            "risk_score": profile.risk_score,
        }
    elif profile.risk_score >= 0.3:
        alert = {
            "level": "MEDIUM",
            "reason": "Early warning signals in message tone",
            "action": "increase_monitoring",
            "risk_score": profile.risk_score,
        }
    return {
        "current_flags": profile.events[-1]["flags"] if profile.events else [],
        "risk_score": profile.risk_score,
        "off_platform_count": profile.off_platform_count,
        "intimacy_count": profile.intimacy_count,
        "alert": alert,
    }
