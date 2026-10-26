import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from dependencies import CurrentUser, get_current_user, get_db_pool

try:
    from services.matching.embedder import _get_sentence_transformer
    from services.matching.matcher import find_top_mentors
except ImportError:
    try:
        from matching.embedder import _get_sentence_transformer
        from matching.matcher import find_top_mentors
    except ImportError:

        async def find_top_mentors(pool, mentee_user_id, top_k=5):
            """Fallback when matching module is unavailable."""
            return []
try:
    from services.api.services.matching_service import generate_match_reason
except ImportError:

    def generate_match_reason(mentee: dict, mentor: dict) -> str:
        """Fallback when matching service is unavailable."""
        return "Match generated with default reasoning."


router = APIRouter(prefix="/match")
legacy_router = APIRouter(prefix="/api/ai")


def _score_and_reason(mentee: dict, mentor: dict) -> dict:
    """
    Lightweight scoring fallback for the POST /match endpoint.
    Used when only mentee/mentor dicts are provided without a DB lookup.
    Semantic embedding matching is done by the GET /match/mentee/{id} endpoint.
    """
    shared_languages = sorted(
        set(mentee.get("preferred_languages") or mentee.get("languages") or [])
        & set(mentor.get("languages") or [])
    )
    score = 0.72 + min(len(shared_languages) * 0.06, 0.18)
    if (
        str(mentee.get("sdg_track", "")).lower() in str(mentor.get("industry", "")).lower()
        or str(mentor.get("track", "")).lower() == str(mentee.get("sdg_track", "")).lower()
    ):
        score += 0.05
    if int(mentor.get("years_exp") or 0) >= 5:
        score += 0.03

    return {
        "match_reason": generate_match_reason(mentee, mentor),
        "match_score": round(min(score, 0.98), 2),
        "shared_languages": shared_languages,
    }


@router.post("")
async def ai_match(payload: dict, user: CurrentUser = Depends(get_current_user)):
    mentee = payload.get("mentee")
    mentor = payload.get("mentor")
    if not mentee or not mentor:
        raise HTTPException(status_code=400, detail="mentee and mentor profiles are required")
    return _score_and_reason(mentee, mentor)


@router.get("/mentee/{mentee_user_id}")
async def match_mentee(
    mentee_user_id: str,
    top_k: int = 5,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    top_k = max(1, min(top_k, 5))
    async with pool.acquire() as conn:
        if not await _can_view_mentee_match(conn, mentee_user_id, user):
            raise HTTPException(
                status_code=403, detail="You are not allowed to view this mentee match."
            )
        mentee_row = await conn.fetchrow(
            """
            SELECT u.id, mp.sdg_track, mp.preferred_languages
            FROM users u
            LEFT JOIN mentee_profiles mp ON mp.user_id = u.id
            WHERE u.id = $1
            """,
            uuid.UUID(mentee_user_id),
        )

    mentee_profile = {
        "sdg_track": (mentee_row or {}).get("sdg_track") or "STEM",
        "preferred_languages": list((mentee_row or {}).get("preferred_languages") or []),
    }

    mentors = await find_top_mentors(pool, mentee_user_id, top_k=top_k)
    model_available = _get_sentence_transformer() is not None

    matches = []
    for row in mentors:
        mentor_dict = {
            "languages": list(row["languages"] or []),
            "industry": row["industry"],
            "years_exp": row["years_exp"],
        }
        try:
            reason = generate_match_reason(mentee_profile, mentor_dict)
        except Exception:
            reason = "Matched because: SEA-LION embedding similarity and safety filters align."

        matches.append(
            {
                "mentor": {
                    "id": str(row["id"]),
                    "name": row["full_name"] or row["display_name"],
                    "job_title": row["job_title"],
                    "industry": row["industry"],
                    "years_exp": row["years_exp"],
                    "languages": row["languages"],
                    "bio_safety_score": row["bio_safety_score"],
                },
                "match_score": (
                    round(float(row["match_score"] or 0), 2) if model_available else None
                ),
                "match_reason": reason,
            }
        )

    return {
        "model_available": model_available,
        "warning": (
            "Semantic matching degraded — model unavailable" if not model_available else None
        ),
        "mentee_user_id": mentee_user_id,
        "matches": matches,
    }


async def _can_view_mentee_match(conn, mentee_user_id: str, user: CurrentUser) -> bool:
    if user.role == "admin":
        return True
    if user.id == mentee_user_id:
        return True

    mentee = await conn.fetchrow(
        "SELECT id, institution_id FROM users WHERE id = $1",
        mentee_user_id,
    )
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found.")

    if user.role in ("institution_admin", "moderator") and str(mentee["institution_id"] or "") == (
        user.institution_id or ""
    ):
        return True

    if user.role == "mentor":
        return (
            await conn.fetchval(
                """
            SELECT 1 FROM matches
            WHERE mentee_id = $1
              AND mentor_id = $2
              AND status IN ('pending', 'active')
            LIMIT 1
            """,
                mentee_user_id,
                user.id,
            )
            is not None
        )

    return False


@legacy_router.post("/match")
async def legacy_ai_match(
    payload: dict,
):
    mentee = payload.get("mentee")
    mentor = payload.get("mentor")
    if not mentee or not mentor:
        raise HTTPException(status_code=400, detail="mentee and mentor profiles are required")
    return _score_and_reason(mentee, mentor)
