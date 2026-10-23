"""Performance tests for the embedding pipeline."""


def test_embedding_dimension_constant():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import EMBEDDING_DIM

    assert EMBEDDING_DIM == 1024


def test_embedding_latency_threshold():
    """A single embed() call must complete within 5 seconds with the fallback model."""
    import sys
    import time
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import build_mentee_text, embed_text

    text = build_mentee_text(
        career_goals=["software engineer"],
        sdg_track="STEM",
        challenges=[],
        preferred_languages=["en"],
        country="Malaysia",
    )
    start = time.time()
    vec = embed_text(text)
    elapsed = time.time() - start
    assert elapsed < 5.0, f"Embedding took {elapsed:.2f}s — exceeds 5s threshold"
    assert len(vec) == 1024


def test_batch_10_embeds_under_30_seconds():
    """10 sequential embeddings (mentor pool refresh) under 30 seconds."""
    import sys
    import time
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(_root))
    from services.matching.embedder import embed_text

    texts = [f"Mentor profile {i}. Industry: Technology. {i} years experience." for i in range(10)]
    start = time.time()
    for text in texts:
        embed_text(text)
    duration = time.time() - start
    assert duration < 30.0, f"10 embeddings took {duration:.2f}s (limit: 30s)"
