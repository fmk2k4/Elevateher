"""
Agent Service - API wrapper for AI agent tasks.

Wraps the lower-level agent components (summariser) and provides a clean
async API for the router layer with safe fallback when models are unavailable.
"""

import logging
from typing import Any

# ── Ensure proper import paths ─────────────────────────────────────────────────
import services.path  # noqa: F401

# Real implementation from services.agent.summariser
from services.agent.summariser import summarise_session as _llm_summarise_session

logger = logging.getLogger(__name__)


async def generate_weekly_brief(
    events: list[dict],
    settings: Any = None,
) -> dict:
    """
    Generate a weekly brief from impact events.
    Uses the real summariser if models are available.
    """
    try:
        from services.agent.summariser import generate_weekly_brief as _llm_generate_weekly_brief

        return await _llm_generate_weekly_brief(events)
    except Exception:
        logger.exception("Weekly brief generation failed — using default")
        tracks = [event.get("sdg_track", "STEM") for event in events]
        return {
            "brief": (
                "This week the cohort completed mentorship sessions, "
                "safety checks, and SDG impact events."
            ),
            "events_count": len(events),
            "top_tracks": sorted({track for track in tracks if track}),
        }


async def summarise_session(
    messages: list[dict],
    track: str = "STEM",
    session_num: int = 1,
    settings: Any = None,
) -> dict:
    """
    Generate a session summary using the real summariser with Phi-3 / Gemini
    inference tiers (in-process GGUF → HTTP → Gemini → default fallback).

    Args:
        messages: List of {sender_role, content, sent_at} dicts
        track: SDG track
        session_num: Current session number

    Returns:
        dict with keys: summary, follow_up_questions, milestone_reached,
                        sdg_goals, sentiment
    """
    try:
        result = await _llm_summarise_session(
            messages=messages,
            track=track,
            session_num=session_num,
        )
        # agent.summariser returns SessionSummary dataclass
        return {
            "summary": result.summary,
            "follow_up_questions": result.questions,
            "milestone_reached": result.milestone_reached,
            "sdg_goals": result.sdg_goals_covered,
            "sentiment": result.mentee_sentiment,
        }
    except Exception:
        logger.exception("Session summarisation failed — using default")
        # Fallback mirrors the shape of the real output
        # Session messages use "content" key (not "text")
        text = messages[-1].get("content", messages[-1].get("text", "")) if messages else ""
        lower = text.lower()
        goals = []
        if any(w in lower for w in ("stem", "code", "engineering", "data")):
            goals.append("SDG 4.4")
        if any(w in lower for w in ("business", "career", "job", "interview")):
            goals.append("SDG 8.6")
        if any(w in lower for w in ("mentor", "confidence", "leadership")):
            goals.append("SDG 5.5")
        if not goals:
            goals = ["SDG 4.4", "SDG 5.5", "SDG 8.6"]

        positive = sum(
            1
            for w in ("progress", "thank", "confident", "clear", "ready", "achieved")
            if w in lower
        )
        negative = sum(1 for w in ("stuck", "confused", "worried", "difficult") if w in lower)
        sentiment = (
            "positive" if positive >= negative else "needs_followup" if negative else "neutral"
        )

        return {
            "summary": "Session completed with follow-up items to address before the next meeting.",
            "follow_up_questions": [
                "What is one career step you want to complete before the next session?",
                "Which skill from this session should you practise first?",
                "Would you like help finding a role model in this field?",
            ],
            "milestone_reached": positive > 0,
            "sdg_goals": goals,
            "sentiment": sentiment,
        }
