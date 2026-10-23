"""
Matching Service - API wrapper for SEA-LION embedding and matching.

This module wraps the lower-level matching components (embedder, matcher)
and provides a clean API for the router layer.
"""

# ── Ensure proper import paths ─────────────────────────────────────────────────
# Import the centralized path management FIRST
# Pull canonical track names from shared_constants so the schema and router
# validation stay in lock-step. Previously this set was hand-curated and
# drifted from the real enum (missing Trades/Creative/Healthcare, carrying dead
# TECH/EDUCATION/ENVIRONMENT/SOCIAL entries). See implementation_plan C1.
from shared_constants import SDG_TRACKS as _SDG_TRACKS  # noqa: E402

import services.path  # noqa: F401
from services.matching.embedder import (  # noqa: E402
    _get_sentence_transformer as _get_embedder,
)
from services.matching.embedder import (  # noqa: E402
    build_mentee_text as _build_mentee_text,
)
from services.matching.embedder import (  # noqa: E402
    build_mentor_text as _build_mentor_text,
)
from services.matching.matcher import generate_match_reason as _generate_match_reason  # noqa: E402

VALID_SDG_TRACKS: set[str] = set(_SDG_TRACKS.keys())


def build_mentee_text(**kwargs):
    return _build_mentee_text(**kwargs)


def build_mentor_text(**kwargs):
    return _build_mentor_text(**kwargs)


def generate_match_reason(mentee: dict, mentor: dict) -> str:
    shared_languages = sorted(
        set(mentee.get("preferred_languages") or mentee.get("languages") or [])
        & set(mentor.get("languages") or [])
    )
    sdg_track = mentee.get("sdg_track", "STEM")
    if sdg_track not in VALID_SDG_TRACKS:
        sdg_track = "STEM"
    return _generate_match_reason(
        shared_languages=shared_languages,
        sdg_track=sdg_track,
        mentor_industry=mentor.get("industry") or mentor.get("track") or "",
        mentor_years_exp=int(mentor.get("years_exp") or 0),
    )


def warm_up_embedding_model() -> None:
    _get_embedder()


def is_model_available() -> bool:
    return _get_embedder() is not None


def is_embedding_model_available() -> bool:
    """Alias for is_model_available — checks the sentence-transformer load."""
    return is_model_available()
