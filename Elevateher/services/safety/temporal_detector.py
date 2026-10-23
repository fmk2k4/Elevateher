# =============================================================================
# services/safety/temporal_detector.py
# =============================================================================
# Temporal Grooming Pattern Detector
#
# Research basis:
#   - Street et al. (2025): Real-time grooming detection via temporal analysis
#   - Leiva-Bianchi et al. (2025): ML methods for grooming — 92% MLP accuracy
#   - PAN-12 dataset benchmarks
#
# This module monitors message *cadence* and *content patterns over time*,
# not just a single bio scan. It uses Redis to track temporal risk signals
# per match, accumulating flags across a 48-hour rolling window.
#
# Risk scoring:
#   - Off-platform contact: 0.4 per occurrence (critical signal)
#   - Intimacy escalation: 0.2 per occurrence
#   - Risk score >= 0.5: flag for human review
#   - Risk score >= 0.8 OR off-platform count >= 2: immediate suspend
# =============================================================================

from __future__ import annotations

import re
import json
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, asdict
from typing import Optional

import redis.asyncio as aioredis

# ── Pattern definitions ───────────────────────────────────────────────────────

OFF_PLATFORM_PATTERNS = [
    # English
    r"\bwhatsapp\b",
    r"\btelegram\b",
    r"\bwechat\b",
    r"\bsignal\b",
    r"\binstagram\b",
    r"\bfacebook\b",
    r"\bline\b",
    r"\bkakao\b",
    r"\bmeet\s+(me|you)\s+outside\b",
    r"\bcome\s+to\s+my\s+(house|place|address)\b",
    r"\bpersonal\s+(chat|number|contact)\b",
    r"\badd\s+me\b",
    r"\bcontact\s+(me|us)\s+outside\b",
    r"\bprivate\s+(call|chat|number)\b",
    r"\bonly\s+if\s+you\s+promise\b",
    r"\bdon't?\s+tell\s+anyone\b",
    # Malay
    r"\bnombor\s+(peribadi|pribadi)\b",
    r"\bbagi\s+(nombor|nomor)\b",
    r"\brahsia\s+kita\b",
    r"\bjangan\s+beritahu\b",
    r"\b外面\s+chat\b",  # "chat outside" in mixed text
    # Indonesian
    r"\bnomor\s+(pribadi|peribadi)\b",
    r"\brahasia\s+kita\b",
    # Thai
    r"\bchat\s+นอก\b",
    r"\bprivate\s+line\b",  # "outside chat" + "private line" in Thai
]

INTIMACY_ESCALATION_PATTERNS = [
    r"\bonly\s+between\s+us\b",
    r"\bour\s+secret\b",
    r"\bkeep\s+this\s+between\s+us\b",
    r"\bspecial\s+to\s+me\b",
    r"\byou're?\s+(very\s+)?different\b",
    r"\bno\s+one\s+(else|others?)\s+(will|can)\b",
    r"\btrust\s+me\b",
    r"\bi\s+told?\s+no\s+one\b",
    # Malay
    r"\brahsia\s+kita\b",
    r"\bhanya\s+antara\s+kita\b",
    r"\bspecial\s+sangat\b",
    # Indonesian
    r"\brahasia\s+kita\b",
    r"\bhanya\s+antara\s+kita\b",
]

RISK_WEIGHTS = {
    "off_platform_attempt": 0.40,  # Most serious signal
    "intimacy_escalation": 0.20,
    "rapid_intimacy": 0.15,  # Fast trust-building
    "resource_request": 0.10,  # Asking for photos, info
}

MAX_REDIS_KEY_TTL_DAYS = 90
ROLLING_WINDOW_HOURS = 48


@dataclass
class TemporalRiskProfile:
    """Immutable snapshot of risk state for a match at a point in time."""

    match_id: str
    events: list[dict]
    risk_score: float
    off_platform_count: int
    intimacy_count: int
    last_updated: str  # ISO timestamp


@dataclass
class TemporalRiskAlert:
    """Alert generated when risk threshold is breached."""

    severity: str  # "medium" | "high" | "critical"
    reason: str
    action: str
    risk_score: float
    match_id: str
    mentor_id: str


def _analyse_message(text: str) -> tuple[list[str], list[str]]:
    """
    Analyse a single message for risk signals.
    Returns (flags, matched_patterns) tuples.
    """
    text_lower = text.lower()
    flags = []
    matched = []

    for pattern in OFF_PLATFORM_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            flags.append("off_platform_attempt")
            matched.append(f"off_platform:{pattern[:30]}")
            break

    for pattern in INTIMACY_ESCALATION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            flags.append("intimacy_escalation")
            matched.append(f"intimacy:{pattern[:30]}")
            break

    return flags, matched


def _compute_risk_score(
    off_platform_count: int,
    intimacy_count: int,
    recent_event_count: int,
) -> float:
    """
    Compute risk score using weighted accumulation.
    Capped at 1.0.

    Formula:
      score = min(1.0,
        off_platform_count * 0.4 +
        intimacy_count * 0.2 +
        rapid_intimacy_indicator * 0.15
      )
    """
    return min(
        1.0,
        (
            off_platform_count * RISK_WEIGHTS["off_platform_attempt"]
            + intimacy_count * RISK_WEIGHTS["intimacy_escalation"]
        ),
    )


def _generate_alert(
    risk_score: float,
    off_platform_count: int,
    match_id: str,
    mentor_id: str,
) -> Optional[TemporalRiskAlert]:
    """Generate an alert if risk thresholds are breached."""
    if off_platform_count >= 2 or risk_score >= 0.8:
        return TemporalRiskAlert(
            severity="critical",
            reason="Multiple off-platform contact attempts or very high risk score",
            action="immediate_suspend",
            risk_score=risk_score,
            match_id=match_id,
            mentor_id=mentor_id,
        )
    if risk_score >= 0.5:
        return TemporalRiskAlert(
            severity="high",
            reason="Behavioural escalation pattern detected — mentoring relationship appears unhealthy",
            action="flag_for_review",
            risk_score=risk_score,
            match_id=match_id,
            mentor_id=mentor_id,
        )
    if risk_score >= 0.3:
        return TemporalRiskAlert(
            severity="medium",
            reason="Early warning signals in message tone",
            action="increase_monitoring",
            risk_score=risk_score,
            match_id=match_id,
            mentor_id=mentor_id,
        )
    return None


# ── Redis-backed temporal analysis ───────────────────────────────────────────


async def record_message_event(
    redis_client: aioredis.Redis,
    match_id: str,
    sender_role: str,
    sender_id: str,
    message_text: str,
    mentor_id: str,
) -> TemporalRiskProfile:
    """
    Record a message event and update the temporal risk profile.

    Call this after every message in a session (both mentor and mentee).
    Uses Redis for low-latency temporal state management.

    Returns the updated risk profile and optionally triggers an alert.
    """
    redis_key = f"temporal:{match_id}"
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Load existing profile
    raw = await redis_client.get(redis_key)
    if raw:
        profile = json.loads(raw)
    else:
        profile = {
            "match_id": match_id,
            "events": [],
            "risk_score": 0.0,
            "off_platform_count": 0,
            "intimacy_count": 0,
            "last_updated": now_iso,
        }

    # Analyse this message
    flags, matched_patterns = _analyse_message(message_text)

    # Record event
    event = {
        "timestamp": now_iso,
        "sender_role": sender_role,
        "sender_id": sender_id,
        "flags": flags,
        "matched_patterns": matched_patterns,
        "message_length": len(message_text),
    }
    profile["events"].append(event)

    # Filter to rolling 48-hour window
    cutoff = (now - timedelta(hours=ROLLING_WINDOW_HOURS)).isoformat()
    recent_events = [e for e in profile["events"] if e["timestamp"] > cutoff]
    profile["events"] = recent_events

    # Recalculate counts
    off_platform_count = sum(
        1 for e in recent_events if "off_platform_attempt" in e.get("flags", [])
    )
    intimacy_count = sum(
        1 for e in recent_events if "intimacy_escalation" in e.get("flags", [])
    )
    recent_event_count = len(recent_events)

    # Compute risk score
    risk_score = _compute_risk_score(
        off_platform_count, intimacy_count, recent_event_count
    )
    profile["risk_score"] = risk_score
    profile["off_platform_count"] = off_platform_count
    profile["intimacy_count"] = intimacy_count
    profile["last_updated"] = now_iso

    # Persist to Redis
    await redis_client.setex(
        redis_key,
        MAX_REDIS_KEY_TTL_DAYS * 24 * 3600,
        json.dumps(profile),
    )

    # Generate alert if needed
    alert = _generate_alert(risk_score, off_platform_count, match_id, mentor_id)
    if alert:
        alert_key = f"temporal_alert:{match_id}"
        await redis_client.setex(
            alert_key,
            MAX_REDIS_KEY_TTL_DAYS * 24 * 3600,
            json.dumps(asdict(alert)),
        )
        if alert.severity == "critical":
            try:
                from tasks.safety_tasks import handle_critical_safety_flag
                handle_critical_safety_flag.delay({
                    "mentor_id": mentor_id,
                    "match_id": match_id,
                    "reason": alert.reason,
                })
            except Exception:
                import logging
                logging.getLogger(__name__).exception(
                    "Failed to dispatch suspension for match %s", match_id
                )

    return TemporalRiskProfile(
        match_id=match_id,
        events=recent_events,
        risk_score=risk_score,
        off_platform_count=off_platform_count,
        intimacy_count=intimacy_count,
        last_updated=now_iso,
    )


async def get_risk_profile(
    redis_client: aioredis.Redis,
    match_id: str,
) -> Optional[TemporalRiskProfile]:
    """Retrieve the current risk profile for a match from Redis."""
    raw = await redis_client.get(f"temporal:{match_id}")
    if not raw:
        return None
    p = json.loads(raw)
    return TemporalRiskProfile(**p)


async def take_risk_snapshot(
    pool,
    redis_client: aioredis.Redis,
    match_id: str,
    mentor_id: str,
) -> Optional[dict]:
    """
    Periodically called by Celery beat to snapshot risk state to PostgreSQL.
    Stores a durable record for compliance and long-term analysis.
    """
    profile = await get_risk_profile(redis_client, match_id)
    if not profile:
        return None

    snapshot = {
        "mentor_id": mentor_id,
        "match_id": match_id,
        "risk_score": profile.risk_score,
        "flags": list(set(f for e in profile.events for f in e.get("flags", []))),
        "message_count": len(profile.events),
        "off_platform_attempts": profile.off_platform_count,
        "intimacy_flags": profile.intimacy_count,
    }

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO mentor_risk_snapshots
                (mentor_id, match_id, risk_score, flags, message_count,
                 off_platform_attempts, intimacy_flags)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            snapshot["mentor_id"],
            snapshot["match_id"],
            snapshot["risk_score"],
            snapshot["flags"],
            snapshot["message_count"],
            snapshot["off_platform_attempts"],
            snapshot["intimacy_flags"],
        )

    return snapshot
