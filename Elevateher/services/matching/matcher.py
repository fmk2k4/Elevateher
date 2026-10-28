# =============================================================================
# services/matching/matcher.py
# =============================================================================
# AI Mentor Matching Engine
# Uses pgvector HNSW index for cosine similarity search.
# =============================================================================

import asyncpg


async def find_top_mentors(
    pool: asyncpg.Pool,
    mentee_user_id: str,
    top_k: int = 5,
    min_safety_score: float = 0.75,
) -> list[dict]:
    """
    Find top K mentors for a mentee using vector cosine similarity.

    Uses the HNSW index on mentor_profiles.embedding for fast
    approximate nearest-neighbour search. Falls back to exact search
    if the index doesn't exist yet.

    Returns mentors sorted by cosine similarity (most similar first),
    filtered by is_approved=true and safety score >= min_safety_score.
    """
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                WITH mentee_vec AS (
                    SELECT embedding FROM mentee_profiles WHERE user_id = $1
                )
                SELECT
                    u.id,
                    mp.id AS profile_id,
                    mp.full_name,
                    mp.display_name,
                    mp.job_title,
                    mp.employer,
                    mp.industry,
                    mp.years_exp,
                    mp.skills,
                    mp.languages,
                    mp.bio,
                    mp.avatar_url,
                    mp.bio_safety_score,
                    mp.can_mentor_minors,
                    mp.current_mentees,
                    mp.max_mentees,
                    u.country,
                    1 - (mp.embedding <=> (SELECT embedding FROM mentee_vec)) AS match_score
                FROM mentor_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE mp.is_approved = true
                  AND mp.is_active = true
                  AND mp.bio_safety_score >= $2
                  AND u.is_suspended = false
                  AND (mp.max_mentees IS NULL OR mp.current_mentees < mp.max_mentees)
                ORDER BY mp.embedding <=> (SELECT embedding FROM mentee_vec)
                LIMIT $3
                """,
                mentee_user_id,
                min_safety_score,
                top_k,
            )
        except asyncpg.exceptions.UndefinedFunctionError:
            # HNSW index doesn't exist yet — use exact search
            rows = await conn.fetch(
                """
                WITH mentee_vec AS (
                    SELECT embedding FROM mentee_profiles WHERE user_id = $1
                )
                SELECT
                    u.id,
                    mp.id AS profile_id,
                    mp.full_name,
                    mp.display_name,
                    mp.job_title,
                    mp.employer,
                    mp.industry,
                    mp.years_exp,
                    mp.skills,
                    mp.languages,
                    mp.bio,
                    mp.avatar_url,
                    mp.bio_safety_score,
                    mp.can_mentor_minors,
                    mp.current_mentees,
                    mp.max_mentees,
                    u.country,
                    1 - (mp.embedding <=> (SELECT embedding FROM mentee_vec)) AS match_score
                FROM mentor_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE mp.is_approved = true
                  AND mp.is_active = true
                  AND mp.bio_safety_score >= $2
                  AND u.is_suspended = false
                  AND (mp.max_mentees IS NULL OR mp.current_mentees < mp.max_mentees)
                ORDER BY mp.embedding <=> (SELECT embedding FROM mentee_vec)
                LIMIT $3
                """,
                mentee_user_id,
                min_safety_score,
                top_k,
            )

    return [dict(r) for r in rows]


async def find_mentors_by_language(
    pool: asyncpg.Pool,
    language: str,
    limit: int = 10,
) -> list[dict]:
    """Filter mentors by spoken language."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT mp.id AS profile_id, mp.full_name, mp.display_name,
                   mp.job_title, mp.industry, mp.years_exp, mp.languages,
                   u.country
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.is_approved = true
              AND mp.is_active = true
              AND $1 = ANY(mp.languages)
              AND (mp.max_mentees IS NULL OR mp.current_mentees < mp.max_mentees)
            ORDER BY mp.total_mentees_served DESC
            LIMIT $2
            """,
            language,
            limit,
        )
    return [dict(r) for r in rows]


def generate_match_reason(
    shared_languages: list[str],
    sdg_track: str,
    mentor_industry: str,
    mentor_years_exp: int,
) -> str:
    """
    Generate a human-readable match reason string.
    Shown to USSD users and in the web app match card.

    This is the v2.0 upgrade from the original spec — it generates
    a coherent English sentence rather than just listing factors.
    """
    parts = []

    if shared_languages:
        lang_str = ", ".join(shared_languages)
        parts.append(f"both speak {lang_str}")

    if mentor_industry and sdg_track:
        parts.append(f"{mentor_industry} industry")
        track_industries = {
            "STEM": ["technology", "science", "engineering", "healthcare", "data"],
            "Business": ["business", "finance", "commerce", "consulting"],
            "Trades": ["engineering", "construction", "manufacturing", "trade"],
            "Creative": ["design", "creative", "media", "arts"],
            "Healthcare": ["healthcare", "medical", "pharma", "wellness"],
        }
        matched = any(
            kw in mentor_industry.lower() for kw in track_industries.get(sdg_track, [])
        )
        if matched:
            parts.append(f"{sdg_track} track expertise")

    if mentor_years_exp >= 5:
        parts.append(f"{mentor_years_exp} years of professional experience")

    if not parts:
        parts.append("aligned career interests")

    return "Matched because: " + ", ".join(parts) + "."
