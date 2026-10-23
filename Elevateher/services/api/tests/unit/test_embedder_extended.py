"""Additional embedder unit tests — edge cases, builder functions, mock mode."""

import math


def test_embed_text_empty_string():
    """embed_text handles empty string gracefully."""
    from services.matching.embedder import EMBEDDING_DIM, embed_text

    vec = embed_text("")
    assert len(vec) == EMBEDDING_DIM
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        assert abs(norm - 1.0) < 0.01


def test_embed_text_unicode():
    """embed_text handles unicode/Chinese characters."""
    from services.matching.embedder import EMBEDDING_DIM, embed_text

    vec = embed_text("我想学习工程学和技术")
    assert len(vec) == EMBEDDING_DIM


def test_embed_text_long_input():
    """embed_text handles very long input text."""
    from services.matching.embedder import EMBEDDING_DIM, embed_text

    long_text = "Technology and engineering " * 500
    vec = embed_text(long_text)
    assert len(vec) == EMBEDDING_DIM


def test_build_mentee_text_empty_challenges():
    """build_mentee_text handles empty challenges list."""
    from services.matching.embedder import build_mentee_text

    text = build_mentee_text(
        career_goals=["engineering"],
        sdg_track="STEM",
        challenges=[],
        preferred_languages=["en"],
    )
    assert "not specified" in text
    assert "STEM" in text


def test_build_mentee_text_no_language():
    """build_mentee_text defaults to English when no languages given."""
    from services.matching.embedder import build_mentee_text

    text = build_mentee_text(
        career_goals=["engineering"],
        sdg_track="STEM",
        challenges=[],
        preferred_languages=[],
    )
    assert "English" in text


def test_build_mentor_text_no_skills():
    """build_mentor_text defaults to 'various' when no skills."""
    from services.matching.embedder import build_mentor_text

    text = build_mentor_text(
        job_title="Engineer",
        employer="TechCo",
        industry="Technology",
        years_exp=5,
        skills=[],
        languages=["en"],
        bio="I mentor women in tech.",
        sdg_track="STEM",
    )
    assert "various" in text


def test_build_mentor_text_bio_truncation():
    """build_mentor_text truncates bio to 400 chars."""
    from services.matching.embedder import build_mentor_text

    long_bio = "A" * 500
    text = build_mentor_text(
        job_title="Engineer",
        employer="Co",
        industry="Tech",
        years_exp=5,
        skills=["Python"],
        languages=["en"],
        bio=long_bio,
        sdg_track="STEM",
    )
    bio_section = text.split("Bio: ")[1]
    assert len(bio_section) <= 400


def test_embed_text_normalised():
    """Mock embedding vectors are L2-normalised."""
    from services.matching.embedder import embed_text

    vec = embed_text("normalisation test")
    norm = math.sqrt(sum(v * v for v in vec))
    assert abs(norm - 1.0) < 0.01


def test_build_mentee_text_with_education():
    """build_mentee_text includes education level when provided."""
    from services.matching.embedder import build_mentee_text

    text = build_mentee_text(
        career_goals=["data science"],
        sdg_track="STEM",
        challenges=[],
        preferred_languages=["en"],
        education_level="University",
    )
    assert "University" in text
