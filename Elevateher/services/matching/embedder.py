# =============================================================================
# services/matching/embedder.py
# =============================================================================
# SEA-LION v4.5 Embedding Service
#
# Produces 1024-dimensional embedding vectors from mentee/mentor profiles.
# Uses cosine similarity for matching via pgvector HNSW index.
#
# Model: SEA-LION v4.5 (AI Singapore, November 2025)
# Download: huggingface.co/aisingapore/sea-lion-v4.5-instruct
# Local path: ./models/sea-lion-e5-embedding-600m
# =============================================================================

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from functools import lru_cache
from typing import Optional

# SEA-LION-E5 produces 1024-dimensional embeddings
EMBEDDING_DIM = 1024

# ── Path resolution ───────────────────────────────────────────────────────────
# Resolve relative paths against project root so this works whether the API
# is started from Elevateher/ (dev) or /app (Docker/Celery).


def _resolve_model_path(rel_path: str) -> str:
    """Resolve a relative path against PROJECT_ROOT, or return as-is if absolute."""
    _project_root = Path(__file__).resolve().parents[2]
    p = os.path.expanduser(rel_path)
    if os.path.isabs(p):
        return p
    return str(_project_root / p)

# Model path — order of preference:
#   1. SEA_LION_MODEL_PATH env var (absolute or relative to PROJECT_ROOT)
#   2. ./models/sea-lion-e5-embedding-600m  (relative to PROJECT_ROOT)
SEA_LION_MODEL_PATH = _resolve_model_path(
    os.environ.get("SEA_LION_MODEL_PATH", "./models/sea-lion-e5-embedding-600m")
)
FAST_FALLBACK_MODEL = os.environ.get(
    "FAST_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
PREFER_LOCAL_HEAVY_MODEL = os.environ.get("PREFER_LOCAL_HEAVY_MODEL", "0") == "1"
ENABLE_REMOTE_EMBEDDING_DOWNLOAD = os.environ.get(
    "ENABLE_REMOTE_EMBEDDING_DOWNLOAD", "0"
) == "1"


def embed_text_tfidf(text: str) -> list[float]:
    """
    Fallback TF-IDF embedding using scikit-learn.
    No model download required, works in CPU-only mode.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer

    vectorizer = TfidfVectorizer(max_features=EMBEDDING_DIM, stop_words="english")
    vectorizer.fit([text])
    vec = vectorizer.transform([text]).toarray()[0]
    vec = vec.astype(np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    result = vec.tolist()
    while len(result) < EMBEDDING_DIM:
        result.append(0.0)
    return result[:EMBEDDING_DIM] if len(result) > EMBEDDING_DIM else result


@lru_cache(maxsize=1)
def _get_sentence_transformer():
    """
    Load SEA-LION v4.5 using sentence-transformers.
    Requires: pip install sentence-transformers
    Falls back gracefully if model directory is not present (returns zero vectors).
    """
    try:
        if PREFER_LOCAL_HEAVY_MODEL and Path(SEA_LION_MODEL_PATH).exists():
            from sentence_transformers import SentenceTransformer

            return SentenceTransformer(SEA_LION_MODEL_PATH, device="cpu")

        if ENABLE_REMOTE_EMBEDDING_DOWNLOAD:
            from sentence_transformers import SentenceTransformer

            return SentenceTransformer(FAST_FALLBACK_MODEL, device="cpu")

        return None
    except (ImportError, FileNotFoundError, OSError) as e:
        print(f"[WARNING] Could not load SEA-LION model from {SEA_LION_MODEL_PATH}: {e}")
        print(
            "[WARNING] Embedding service running in MOCK mode — using deterministic vectors"
        )
        return None


def embed_text(text: str) -> list[float]:
    """
    Generate a normalised embedding vector from SEA-LION v4.5 via sentence-transformers.

    Uses mean pooling over the last hidden state for sentence-level embeddings.
    Normalised vectors enable cosine similarity via the pgvector <=> operator.

    Args:
        text: Input text (mentee or mentor profile as structured string)

    Returns:
         1024-dimensional normalised embedding vector as list of floats
    """
    model = _get_sentence_transformer()

    if model is None:
        # MOCK mode: deterministic pseudo-random vector based on text hash
        # Use for development/demo when model file is not available
        import hashlib

        h = hashlib.sha256(text.encode()).hexdigest()
        np.random.seed(int(h[:8], 16))
        vec = np.random.randn(EMBEDDING_DIM).astype(np.float32)
        vec = vec / (np.linalg.norm(vec) + 1e-8)
        return vec.tolist()

    # Encode returns (1, 1024) ndarray; squeeze to 1-D and normalise
    vec = model.encode([text], normalize_embeddings=True)[0].astype(np.float32)
    return vec.tolist()


def build_mentee_text(
    career_goals: list[str],
    sdg_track: str,
    challenges: list[str],
    preferred_languages: list[str],
    education_level: Optional[str] = None,
    country: str = "",
) -> str:
    """
    Build a rich text representation of a mentee profile for embedding.
    The structured format elicits better embeddings from SEA-LION.
    """
    goals = ", ".join(career_goals) if career_goals else "unspecified"
    challenges_str = ", ".join(challenges) if challenges else "not specified"
    langs = ", ".join(preferred_languages) if preferred_languages else "English"
    edu = f", education level: {education_level}" if education_level else ""

    return (
        f"Mentee profile. "
        f"Country: {country}. "
        f"Career goals: {goals}. "
        f"Track: {sdg_track}.{edu} "
        f"Languages: {langs}. "
        f"Challenges: {challenges_str}."
    )


def build_mentor_text(
    job_title: str,
    employer: str,
    industry: str,
    years_exp: int,
    skills: list[str],
    languages: list[str],
    bio: str,
    sdg_track: str,
) -> str:
    """
    Build a rich text representation of a mentor profile for embedding.
    """
    skills_str = ", ".join(skills) if skills else "various"
    langs = ", ".join(languages) if languages else "English"

    return (
        f"Mentor profile. "
        f"Role: {job_title} at {employer}. "
        f"Industry: {industry}. "
        f"Experience: {years_exp} years. "
        f"Track specialisation: {sdg_track}. "
        f"Skills: {skills_str}. "
        f"Languages: {langs}. "
        f"Bio: {bio[:400]}"
    )


async def generate_mentee_embedding(
    pool,
    mentee_user_id: str,
    mentee_data: dict,
) -> list[float]:
    """
    Generate and store a SEA-LION embedding for a mentee profile.

    Called asynchronously via Celery after profile creation/update.
    """
    text = build_mentee_text(
        career_goals=mentee_data.get("career_goals", []),
        sdg_track=mentee_data.get("sdg_track", "STEM"),
        challenges=mentee_data.get("challenges", []),
        preferred_languages=mentee_data.get("preferred_languages", ["en"]),
        education_level=mentee_data.get("education_level"),
        country=mentee_data.get("country", ""),
    )
    vector = embed_text(text)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentee_profiles
            SET embedding = $1::vector, embedding_updated = now()
            WHERE user_id = $2
            """,
            vector,
            mentee_user_id,
        )

    return vector


async def generate_mentor_embedding(
    pool,
    mentor_user_id: str,
    mentor_data: dict,
) -> list[float]:
    """
    Generate and store a SEA-LION embedding for a mentor profile.
    """
    text = build_mentor_text(
        job_title=mentor_data.get("job_title", ""),
        employer=mentor_data.get("employer", ""),
        industry=mentor_data.get("industry", ""),
        years_exp=mentor_data.get("years_exp", 0),
        skills=mentor_data.get("skills", []),
        languages=mentor_data.get("languages", ["en"]),
        bio=mentor_data.get("bio", ""),
        sdg_track=mentor_data.get("sdg_track", "STEM"),
    )
    vector = embed_text(text)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentor_profiles
            SET embedding = $1::vector, embedding_updated = now()
            WHERE user_id = $2
            """,
            vector,
            mentor_user_id,
        )

    return vector
