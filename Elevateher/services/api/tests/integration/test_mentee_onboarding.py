"""Integration tests — mentee onboarding: profile → embedding → match."""

import pytest


def test_embedder_fallback_dimension():
    """Embedding fallback produces correct dimension vectors."""
    from services.matching.embedder import EMBEDDING_DIM, embed_text

    vec = embed_text("I want to learn about technology and engineering")
    assert len(vec) == EMBEDDING_DIM
    assert EMBEDDING_DIM == 1024


def test_embedder_deterministic_consistency():
    """Same input produces same embedding (deterministic fallback)."""
    from services.matching.embedder import embed_text

    v1 = embed_text("STEM education for girls in Malaysia")
    v2 = embed_text("STEM education for girls in Malaysia")
    assert v1 == v2


def test_embedder_different_inputs_differ():
    """Different inputs produce different embeddings."""
    from services.matching.embedder import embed_text

    v1 = embed_text("I love science and technology")
    v2 = embed_text("Art and creative writing")
    assert v1 != v2


@pytest.mark.asyncio
async def test_match_score_after_onboarding():
    """Mentee profile with SDG track and languages can be matched."""
    from services.api.routers.match import _score_and_reason

    mentee = {
        "preferred_languages": ["en"],
        "sdg_track": "STEM",
    }
    mentor = {
        "languages": ["en"],
        "industry": "Technology",
        "years_exp": 7,
    }
    result = _score_and_reason(mentee, mentor)
    assert result["match_score"] >= 0.75
    assert "en" in result["shared_languages"]


@pytest.mark.asyncio
async def test_mentee_multilingual_matching():
    """Mentee with multiple language prefs gets better match with more overlap."""
    from services.api.routers.match import _score_and_reason

    mentee = {"preferred_languages": ["en", "ms", "zh"], "sdg_track": "STEM"}
    mentor_full = {"languages": ["en", "ms", "zh"], "industry": "Technology", "years_exp": 5}
    mentor_partial = {"languages": ["en"], "industry": "Technology", "years_exp": 5}

    full = _score_and_reason(mentee, mentor_full)
    partial = _score_and_reason(mentee, mentor_partial)
    assert full["match_score"] >= partial["match_score"]
    assert len(full["shared_languages"]) >= len(partial["shared_languages"])
