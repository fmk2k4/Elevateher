# =============================================================================
# services/agent/summariser.py
# =============================================================================
# Phi-3 Mini Session Summariser / AI Facilitator Agent
#
# Generates:
#   - Session summaries (2-3 sentences)
#   - Suggested follow-up questions for mentors
#   - Milestone reached detection
#   - Mentee sentiment analysis
#
# Inference tier order (tries in order until one succeeds):
#   1. In-process llama-cpp: Phi-3-mini Q4 GGUF loaded directly
#      (n_ctx=2048, n_threads=4, no GPU offload by default)
#   2. HTTP API server: llama.cpp HTTP server at PHI3_API_URL
#      (set PHI3_API_URL env var to enable, e.g. http://localhost:8080)
#   3. Gemini API: cloud inference via GEMINI_API_KEY
#   4. Default: deterministic fallback with no network required
#
# Model: Phi-3 mini (3.8B, quantised to Q4)
# =============================================================================

from __future__ import annotations
from dataclasses import dataclass
import json
import os
import re
from pathlib import Path
from typing import TYPE_CHECKING, Optional

import httpx
from services.shared_constants import SDG_TRACKS

if TYPE_CHECKING:
    from llama_cpp import Llama  # noqa: F401

# ── Path resolution ───────────────────────────────────────────────────────────
# Resolve relative paths against project root (works from any CWD / Docker WORKDIR)
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_MODELS_ROOT = _PROJECT_ROOT / "models"


def _resolve_path(rel: str) -> str:
    p = Path(rel).expanduser()
    return str(p) if p.is_absolute() else str(_MODELS_ROOT / rel)


# PHI-3 CONFIG — resolved to absolute so it works from any working directory
_PHI3_MODEL_PATH = _resolve_path(
    os.environ.get("PHI3_MODEL_PATH", "Phi-3-mini-4k-instruct-q4.gguf")
)
PHI3_API_URL = os.environ.get("PHI3_API_URL")  # For HTTP server mode
GEMINI_API_URL = os.environ.get(
    "GEMINI_API_URL",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


# ── In-process llama-cpp loader ────────────────────────────────────────────────

_phi3_llm: Optional["Llama"] = None  # noqa: F821


def _get_phi3_llm() -> Optional["Llama"]:  # noqa: F821
    """
    Load Phi-3-mini Q4 GGUF using llama-cpp-python.
    Returns None if the model file is missing or cannot be loaded.
    Safe to call multiple times (cached after first success).
    """
    global _phi3_llm
    if _phi3_llm is not None:
        return _phi3_llm

    try:
        from llama_cpp import Llama

        n_threads = int(os.environ.get("PHI3_N_THREADS", "4"))
        _phi3_llm = Llama(
            model_path=_PHI3_MODEL_PATH,
            n_ctx=2048,
            n_threads=n_threads,
            verbose=False,
        )
        return _phi3_llm
    except (ImportError, FileNotFoundError, OSError) as e:
        import logging

        logging.getLogger(__name__).warning(
            "Could not load Phi-3 GGUF from %s: %s", _PHI3_MODEL_PATH, e
        )
        return None


def is_phi3_model_available() -> bool:
    """Check if Phi-3 can be loaded in-process (no server required)."""
    return _get_phi3_llm() is not None


@dataclass
class SessionSummary:
    summary: str
    questions: list[str]
    milestone_reached: bool
    sdg_goals_covered: list[str]
    mentee_sentiment: str  # "positive" | "neutral" | "needs_support"

    def to_dict(self) -> dict:
        return {
            "summary": self.summary,
            "questions": self.questions,
            "milestone_reached": self.milestone_reached,
            "sdg_goals_covered": self.sdg_goals_covered,
            "mentee_sentiment": self.mentee_sentiment,
        }


def _build_system_prompt(track: str, session_num: int) -> str:
    """Build the system prompt for the Phi-3 session summariser."""
    return f"""You are an AI facilitator for ElevateHer — a safe, moderated career mentorship platform for girls aged 14-22 in Southeast Asia.

This is Session {session_num} of a 12-session mentorship programme on the {track} track.
Your role is to summarise what was discussed and suggest ONE focused follow-up question for the mentor.

Be warm, encouraging, and specific. Focus on the mentee's progress and agency.
Never mention AI or the platform in the summary.
If a milestone was reached, say so clearly.

Respond ONLY with valid JSON in this exact format:
{{
  "summary": "2-3 sentence summary of what was discussed and any progress made",
  "questions": ["one specific follow-up question the mentor should ask next"],
  "milestone_reached": true or false,
  "sdg_goals_covered": ["4.4", "5.5", or "8.6" — include all relevant],
  "mentee_sentiment": "positive" or "neutral" or "needs_support"
}}"""


async def _summarise_with_phi3_llm(
    transcript: str, track: str, session_num: int
) -> dict:
    """In-process llama-cpp inference — no HTTP server required."""
    llm = _get_phi3_llm()
    if llm is None:
        raise RuntimeError("Phi-3 model not available")

    max_chars = 3000
    truncated = transcript[:max_chars]
    if len(transcript) > max_chars:
        import logging

        logging.getLogger(__name__).warning(
            "Transcript truncated from %d to %d chars for Phi-3",
            len(transcript),
            max_chars,
        )

    prompt = f"{_build_system_prompt(track, session_num)}\n\nSession transcript:\n{truncated}"
    try:
        result = llm(prompt, max_tokens=300, temperature=0.3, stop=["```"])
        content = result["choices"][0]["text"].strip()
        return _parse_json_response(content, {"method": "phi3_llm", "track": track, "session_num": session_num})
    except Exception:
        raise RuntimeError("Phi-3 inference failed")


def _parse_json_response(content: str, context: dict | None = None) -> dict:
    """Extract JSON from model response, handling markdown code blocks."""
    content = content.strip()
    # Handle ```json ... ``` blocks
    match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", content)
    if match:
        content = match.group(1)
    else:
        # Try to find JSON directly
        match = re.search(r"(\{[\s\S]*\})", content)
        if match:
            content = match.group(1)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        import logging
        logger = logging.getLogger(__name__)
        ctx = f" (context: {context})" if context else ""
        truncated = content[:500] + "..." if len(content) > 500 else content
        logger.error(
            "Summariser JSON parse failed.%s Raw response (%d chars): %s",
            ctx,
            len(content),
            truncated,
        )
        return {}


async def _summarise_with_phi3_local(transcript: str, track: str, session_num: int) -> dict:
    """Use locally-running Phi-3 server (llama.cpp HTTP server)."""
    max_chars = 3000
    truncated = transcript[:max_chars]
    if len(transcript) > max_chars:
        import logging
        logging.getLogger(__name__).warning(
            "Transcript truncated from %d to %d chars for Phi-3", len(transcript), max_chars
        )
    async with httpx.AsyncClient() as client:
        payload = {
            "prompt": f"{_build_system_prompt(track, session_num)}\n\nSession transcript:\n{truncated}",
            "max_tokens": 300,
            "temperature": 0.3,
            "stop": ["```"],
        }
        resp = await client.post(f"{PHI3_API_URL}/completion", json=payload, timeout=30)
        resp.raise_for_status()
        return _parse_json_response(resp.text, {"method": "phi3_local", "track": track, "session_num": session_num})


async def _summarise_with_gemini(transcript: str, track: str, session_num: int) -> dict:
    """Fallback: use Gemini API for session summarisation."""
    if not GEMINI_API_KEY:
        return _default_summary(track, session_num)

    max_chars = 3000
    truncated = transcript[:max_chars]
    if len(transcript) > max_chars:
        import logging
        logging.getLogger(__name__).warning(
            "Transcript truncated from %d to %d chars for Gemini", len(transcript), max_chars
        )
    system_prompt = _build_system_prompt(track, session_num)
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{system_prompt}\n\nSession transcript:\n{truncated}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 300,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if not resp.ok:
            return _default_summary(track, session_num)

        data = resp.json()
        content = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        return _parse_json_response(content, {"method": "gemini", "track": track, "session_num": session_num})


def _default_summary(track: str, session_num: int) -> dict:
    """Return a sensible default when no AI model is available."""
    return {
        "summary": f"Session {session_num} was completed on the {track} track. The mentor and mentee discussed progress and next steps.",
        "questions": [
            "What specific progress did you make toward your career goal this week?",
            "What challenge do you want to focus on in our next session?",
            "Which skill would you like to develop further?",
        ],
        "milestone_reached": False,
        "sdg_goals_covered": SDG_TRACKS.get(track, {}).get("sdg_goals", ["4.4"]),
        "mentee_sentiment": "neutral",
    }


async def summarise_session(
    messages: list[dict],
    track: str = "STEM",
    session_num: int = 1,
) -> SessionSummary:
    """
    Generate a session summary and suggested questions.

    Inference tier order:
      1. In-process llama-cpp (Phi-3 GGUF) — no server required
      2. HTTP API server (PHI3_API_URL)
      3. Gemini API (GEMINI_API_KEY)
      4. Default fallback (no network required)

    Args:
        messages: List of {sender_role, content, sent_at} dicts
        track: SDG track (STEM, Business, etc.)
        session_num: Current session number in the programme

    Returns:
        SessionSummary dataclass
    """
    # Build transcript string
    transcript = "\n".join(
        f"{m.get('sender_role', 'unknown').upper()}: {m.get('content', '')}"
        for m in messages
        if m.get("sender_role") != "system"
    )

    if not transcript.strip():
        return SessionSummary(
            summary="Session has no messages to summarise yet.",
            questions=["What did you discuss in this session?"],
            milestone_reached=False,
            sdg_goals_covered=SDG_TRACKS.get(track, {}).get("sdg_goals", ["4.4"]),
            mentee_sentiment="neutral",
        )

    # If the agentic layer is disabled, return the deterministic fallback so
    # we never spin up the heavy llama-cpp default model — that model load
    # is unsafe on certain platforms/architectures and is not required for
    # the demo day default behaviour.
    if os.environ.get("ENABLE_AGENTIC_LAYER", "false").lower() not in (
        "1",
        "true",
        "yes",
    ):
        fallback = _default_summary(track, session_num)
        return SessionSummary(
            summary=fallback.get(
                "summary", f"Session {session_num} completed."
            ),
            questions=fallback.get(
                "questions",
                [
                    "What specific steps did you take this week toward your career goal?",
                ],
            ),
            milestone_reached=fallback.get("milestone_reached", False),
            sdg_goals_covered=fallback.get(
                "sdg_goals_covered", ["4.4"]
            ),
            mentee_sentiment=fallback.get(
                "mentee_sentiment", "neutral"
            ),
        )

    # Tier 1: In-process llama-cpp (Phi-3 GGUF)
    result = {}
    if _get_phi3_llm() is not None:
        try:
            result = await _summarise_with_phi3_llm(transcript, track, session_num)
        except Exception:
            pass

    # Tier 2: HTTP API server (llama.cpp HTTP server)
    if not result and PHI3_API_URL:
        try:
            result = await _summarise_with_phi3_local(transcript, track, session_num)
        except Exception:
            pass

    # Tier 3: Gemini API
    if not result and GEMINI_API_KEY:
        try:
            result = await _summarise_with_gemini(transcript, track, session_num)
        except Exception:
            pass

    # Tier 4: Default fallback
    if not result:
        result = _default_summary(track, session_num)

    return SessionSummary(
        summary=result.get("summary", f"Session {session_num} completed."),
        questions=result.get(
            "questions",
            [
                "What specific steps did you take this week toward your career goal?",
            ],
        ),
        milestone_reached=result.get("milestone_reached", False),
        sdg_goals_covered=result.get("sdg_goals_covered", ["4.4"]),
        mentee_sentiment=result.get("mentee_sentiment", "neutral"),
    )


def generate_summary(messages, session_goal="Introduction"):
    """Sync wrapper for summarise_session (backwards compatibility)."""
    return _default_summary("STEM", 1)["summary"]


def suggest_mentor_questions(
    track: str = "STEM",
    last_milestone: str = "Career mapping",
    mentee_challenge: str = "no_role_models",
    session_num: int = 1,
) -> list[str]:
    """Generate follow-up questions for mentors. Returns 3 questions."""
    tracks = SDG_TRACKS.get(track, {})
    milestones = tracks.get("milestones", [])
    last_idx = max(0, session_num - 1) if session_num > 0 else 0
    last_accomplishment = milestones[last_idx] if last_idx < len(milestones) else last_milestone

    return [
        f"How did {last_accomplishment.lower()} go this week?",
        f"What specific obstacles did you face with {mentee_challenge.replace('_', ' ')}?",
        "What would you like to focus on in our next session?",
    ]


def generate_mentee_nudge(
    mentee_name: str,
    days_since_last_session: int,
    track: str,
    next_milestone: str,
    language: str = "en",
) -> str:
    """Generate SMS nudge for mentee. Must fit in 160 chars."""
    nudges = {
        "en": f"Hi {mentee_name}! Time for your next {track} session. Focus: {next_milestone}. Reply YES to confirm.",
        "ms": f"Hai {mentee_name}! Sudah masanya untuk sesi {track} seterusnya. Fokus: {next_milestone}. Balas YA untuk sah.",
        "id": f"Hai {mentee_name}! Saatnya sesi {track} berikutnya. Fokus: {next_milestone}. Balas YA untuk konfirmasi.",
        "th": f"สวัสดี {mentee_name}! ถึงเวลาของเซสชัน {track} ครั้งถัดไป โฟกัส: {next_milestone}",
        "ja": f"こんにちは {mentee_name}さん！次の{track}セッションの時間です。フォーカス: {next_milestone}",
    }
    n = nudges.get(language, nudges["en"])
    return n[:160]


def generate_weekly_mentor_brief(
    track: str,
    active_mentee_count: int,
    upcoming_sessions: list[dict],
) -> str:
    """Generate weekly brief for mentors."""
    session_count = len(upcoming_sessions)
    return f"Weekly brief: You have {active_mentee_count} active mentees on {track} track. {session_count} session(s) scheduled this week. Keep up the great work!"


def detect_milestone_reached(
    session_num: int,
    track: str,
    summary_text: str,
) -> tuple[bool, str | None]:
    """
    Detect if a milestone was reached in this session based on
    session number and track-specific milestone schedule.

    Returns (reached, milestone_title).
    """
    milestones = SDG_TRACKS.get(track, {}).get("milestones", [])
    if session_num <= len(milestones):
        return True, milestones[session_num - 1]

    # Fallback: keyword detection in summary
    summary_lower = summary_text.lower()
    for milestone in milestones:
        if milestone.lower().split()[0] in summary_lower:
            return True, milestone

    return False, None
