"""Embedder unit tests.

Covers:
- build_mentee_text / build_mentor_text prompt construction
- embed_text() normalisation
- mock-based tests that avoid loading the full model in CI
"""

import pytest


def _model_loaded():
    env_path = None
    try:
        import sys
        from pathlib import Path as _Path

        _root = _Path(__file__).resolve().parents[3]
        sys.path.insert(0, str(_root))
        from services.matching.embedder import SEA_LION_MODEL_PATH

        env_path = SEA_LION_MODEL_PATH
    except Exception:
        return False, "could not import embedder"

    try:
        import os

        full_path = os.path.join(str(_root), env_path) if not os.path.isabs(env_path) else env_path
        if not os.path.exists(full_path):
            return False, f"model path not found: {full_path}"
        return True, full_path
    except Exception:
        return False, "model file missing"


HAS_MODEL, MODEL_REASON = _model_loaded()


def test_build_mentee_text_minimal():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import build_mentee_text

    text = build_mentee_text(
        career_goals=["engineering"],
        sdg_track="STEM",
        challenges=[],
        preferred_languages=["en"],
    )
    assert "Career goals" in text
    assert "engineering" in text


def test_build_mentee_text_full():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import build_mentee_text

    text = build_mentee_text(
        country="Malaysia",
        career_goals=["software engineer", "data science"],
        sdg_track="STEM",
        preferred_languages=["en", "ms"],
        challenges=["family pressure", "cost"],
    )
    assert "Malaysia" in text
    assert "STEM" in text
    assert "software engineer" in text
    assert "data science" in text
    assert "family pressure" in text


def test_build_mentor_text():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import build_mentor_text

    text = build_mentor_text(
        job_title="Senior Engineer",
        employer="Grab",
        industry="Technology",
        years_exp=8,
        skills=["Python", "ML"],
        languages=["en", "ms"],
        bio="Passionate about mentoring women in tech.",
        sdg_track="STEM",
    )
    assert "Technology" in text
    assert "Senior Engineer" in text
    assert "8" in text
    assert "Python" in text


@pytest.mark.skipif(not HAS_MODEL, reason=f"Model not loaded: {MODEL_REASON}")
def test_embed_returns_1024_dim_vector():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import EMBEDDING_DIM, embed_text

    vec = embed_text("test embedding")
    assert len(vec) == EMBEDDING_DIM, f"Expected {EMBEDDING_DIM} dimensions, got {len(vec)}"
    import math

    norm = math.sqrt(sum(v * v for v in vec))
    assert abs(norm - 1.0) < 0.01, "Vector should be L2 normalised"


def test_embedding_dim_constant():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import EMBEDDING_DIM

    assert EMBEDDING_DIM == 1024


def test_embed_text_mock_mode_returns_correct_dim():
    """Test embed_text returns correct dimension in mock mode (no model required)."""
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import EMBEDDING_DIM, embed_text

    vec = embed_text("test embedding in mock mode")
    assert len(vec) == EMBEDDING_DIM, f"Expected {EMBEDDING_DIM} dims, got {len(vec)}"
    import math

    norm = math.sqrt(sum(v * v for v in vec))
    assert abs(norm - 1.0) < 0.01, "Vector should be L2 normalised"
