from services.api.services.matching_service import (
    build_mentee_text,
    build_mentor_text,
    generate_match_reason,
)


def test_shared_language_included():
    mentee = {
        "preferred_languages": ["ms", "en"],
        "career_goals": ["software_engineer"],
        "sdg_track": "STEM",
    }
    mentor = {
        "languages": ["en", "ms"],
        "industry": "Technology",
        "years_exp": 8,
        "track": "STEM",
    }
    reason = generate_match_reason(mentee, mentor)
    assert "ms" in reason.lower() or "en" in reason.lower()
    assert "Matched because:" in reason


def test_industry_included():
    mentee = {"preferred_languages": ["en"]}
    mentor = {"languages": ["en"], "industry": "Healthcare", "years_exp": 5}

    reason = generate_match_reason(mentee, mentor)
    assert "Healthcare" in reason


def test_reason_under_160_chars():
    """Must fit in a single SMS."""
    mentee = {
        "preferred_languages": ["ms", "en", "id"],
        "career_goals": ["software_engineer", "data_scientist", "product_manager"],
        "sdg_track": "STEM",
    }
    mentor = {
        "languages": ["ms", "en", "id"],
        "industry": "Technology & Software Engineering",
        "years_exp": 15,
        "track": "STEM",
    }
    reason = generate_match_reason(mentee, mentor)
    assert len(reason) <= 160, f"Reason too long ({len(reason)} chars): {reason}"


def test_empty_profiles_fallback():
    """Should not crash on minimal data."""
    reason = generate_match_reason({}, {})
    assert isinstance(reason, str)
    assert len(reason) > 0


def test_build_mentee_text_contains_profile_signals():
    text = build_mentee_text(
        career_goals=["software_engineer"],
        sdg_track="STEM",
        challenges=["no_role_models"],
        preferred_languages=["en"],
        country="MY",
    )
    assert "Career goals" in text
    assert "Track: STEM" in text


def test_build_mentor_text_contains_profile_signals():
    text = build_mentor_text(
        job_title="Engineer",
        employer="Demo Co",
        industry="Technology",
        years_exp=8,
        skills=["Python"],
        languages=["en"],
        bio="I mentor young women in tech.",
        sdg_track="STEM",
    )
    assert "Mentor profile" in text
    assert "Experience: 8 years" in text
