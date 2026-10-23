"""
services/agent/tutor_context.py
================================
Builds contextual memory for the AI Tutor (Ela) across the 12-session programme.

Loads prior session summaries, milestones reached, mentee profile, and SDG track
so Ela can coach with continuity rather than starting cold each session.
"""
from __future__ import annotations

import uuid
from typing import Any


async def build_tutor_context(
    conn: Any,
    match_id: str,
    current_session_num: int,
    mentee_user_id: str,
) -> dict:
    """
    Load programme context for the AI Tutor.

    Returns a dict with:
        prior_summaries     - list of {"session_num", "summary", "milestone"} dicts
        mentee_name         - mentee display name
        career_goal         - mentee career goal string
        sdg_track           - SDG track (STEM / Business / etc.)
        milestones_reached  - count of milestones reached so far
        context_text        - pre-formatted string for injection into the system prompt
    """
    # ── Load mentee profile ────────────────────────────────────────────────────
    mentee_row = await conn.fetchrow(
        """
        SELECT full_name, display_name, career_goals, sdg_track, challenges
        FROM mentee_profiles
        WHERE user_id = $1
        """,
        uuid.UUID(mentee_user_id),
    )

    mentee_name = "there"
    career_goal = "your career goals"
    sdg_track = "STEM"
    challenges: list[str] = []

    if mentee_row:
        mentee_name = (
            mentee_row.get("display_name")
            or mentee_row.get("full_name")
            or "there"
        )
        career_goal = mentee_row.get("career_goals") or "your career goals"
        sdg_track = mentee_row.get("sdg_track") or "STEM"
        challenges = list(mentee_row.get("challenges") or [])

    # ── Load prior session summaries ───────────────────────────────────────────
    prior_rows = await conn.fetch(
        """
        SELECT session_num, agent_summary, milestone_title, milestone_reached
        FROM sessions
        WHERE match_id = $1
          AND session_num < $2
          AND agent_summary IS NOT NULL
        ORDER BY session_num ASC
        """,
        uuid.UUID(match_id),
        current_session_num,
    )

    prior_summaries = []
    milestones_reached = 0

    for row in prior_rows:
        milestone_text = None
        if row["milestone_reached"] and row["milestone_title"]:
            milestone_text = row["milestone_title"]
            milestones_reached += 1

        prior_summaries.append(
            {
                "session_num": row["session_num"],
                "summary": row["agent_summary"] or "",
                "milestone": milestone_text,
            }
        )

    # ── Build formatted context string ────────────────────────────────────────
    context_lines: list[str] = []

    if prior_summaries:
        context_lines.append("PROGRAMME PROGRESS SO FAR:")
        for entry in prior_summaries:
            milestone_mark = f" ✓ Milestone: {entry['milestone']}" if entry["milestone"] else ""
            context_lines.append(
                f"  Session {entry['session_num']}{milestone_mark}: {entry['summary']}"
            )
    else:
        context_lines.append("PROGRAMME PROGRESS: This is the first session — no prior history yet.")

    if challenges:
        context_lines.append(f"MENTEE'S STATED CHALLENGES: {', '.join(challenges)}")

    context_text = "\n".join(context_lines)

    return {
        "prior_summaries": prior_summaries,
        "mentee_name": mentee_name,
        "career_goal": career_goal,
        "sdg_track": sdg_track,
        "milestones_reached": milestones_reached,
        "challenges": challenges,
        "context_text": context_text,
    }


def format_session_history(messages: list[dict], max_chars: int = 2000) -> str:
    """
    Format recent session messages as a conversation transcript.
    Truncated to max_chars from the end (most recent messages preserved).
    """
    lines = []
    for msg in messages:
        role = msg.get("sender_role", "unknown").upper()
        content = msg.get("content", "").strip()
        if role != "SYSTEM" and content:
            lines.append(f"{role}: {content}")

    transcript = "\n".join(lines)
    if len(transcript) > max_chars:
        # Keep the most recent messages
        transcript = "...[earlier messages truncated]...\n" + transcript[-max_chars:]
    return transcript
