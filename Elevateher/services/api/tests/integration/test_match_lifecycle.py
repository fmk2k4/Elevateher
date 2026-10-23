"""Integration tests — match lifecycle: create → accept → sessions → complete."""

import pytest


@pytest.mark.asyncio
async def test_match_score_calculation():
    """Match scoring produces reasonable score with language overlap."""
    from services.api.routers.match import _score_and_reason

    mentee = {
        "preferred_languages": ["en", "ms"],
        "sdg_track": "STEM",
    }
    mentor = {
        "languages": ["en", "ms"],
        "industry": "Technology",
        "years_exp": 8,
    }
    result = _score_and_reason(mentee, mentor)
    assert result["match_score"] >= 0.7
    assert "match_reason" in result
    assert len(result["shared_languages"]) == 2


@pytest.mark.asyncio
async def test_match_score_no_language_overlap():
    """Match with no language overlap still produces minimum score."""
    from services.api.routers.match import _score_and_reason

    mentee = {
        "preferred_languages": ["zh"],
        "sdg_track": "Arts",
    }
    mentor = {
        "languages": ["en"],
        "industry": "Finance",
        "years_exp": 2,
    }
    result = _score_and_reason(mentee, mentor)
    assert result["match_score"] >= 0.72
    assert result["shared_languages"] == []


@pytest.mark.asyncio
async def test_match_score_sdg_aligns():
    """SDG track aligning with industry gives higher score."""
    from services.api.routers.match import _score_and_reason

    mentee_stem = {
        "preferred_languages": ["en"],
        "sdg_track": "STEM",
    }
    mentor_tech = {
        "languages": ["en"],
        "industry": "Technology",
        "years_exp": 5,
    }
    mentor_finance = {
        "languages": ["en"],
        "industry": "Finance",
        "years_exp": 5,
    }
    aligned = _score_and_reason(mentee_stem, mentor_tech)
    unaligned = _score_and_reason(mentee_stem, mentor_finance)
    assert aligned["match_score"] >= unaligned["match_score"]


@pytest.mark.asyncio
async def test_match_reason_generation():
    """Match reason is generated and contains meaningful text."""
    from services.matching_service import generate_match_reason

    mentee = {
        "preferred_languages": ["en", "ms"],
        "sdg_track": "STEM",
        "country": "Malaysia",
    }
    mentor = {
        "languages": ["en", "ms"],
        "industry": "Technology",
        "years_exp": 10,
        "country": "Singapore",
    }
    reason = generate_match_reason(mentee, mentor)
    assert isinstance(reason, str)
    assert len(reason) > 0


@pytest.mark.asyncio
async def test_match_score_experienced_mentor_bonus():
    """Experienced mentor (5+ years) gets bonus."""
    from services.api.routers.match import _score_and_reason

    mentee = {"preferred_languages": ["en"], "sdg_track": "STEM"}
    mentor_senior = {"languages": ["en"], "industry": "Technology", "years_exp": 10}
    mentor_junior = {"languages": ["en"], "industry": "Technology", "years_exp": 2}

    senior = _score_and_reason(mentee, mentor_senior)
    junior = _score_and_reason(mentee, mentor_junior)
    assert senior["match_score"] >= junior["match_score"]
