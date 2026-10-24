import uuid
from datetime import UTC, datetime

import asyncpg
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from dependencies import CurrentUser, get_current_user, get_db_pool

router = APIRouter()


@router.post("/privacy/data-export")
async def request_data_export(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    user_id = uuid.UUID(user.id)
    async with pool.acquire() as conn:
        user_data = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)

        mentee_profile = await conn.fetchrow(
            "SELECT * FROM mentee_profiles WHERE user_id = $1", user_id
        )
        mentor_profile = await conn.fetchrow(
            "SELECT * FROM mentor_profiles WHERE user_id = $1", user_id
        )

        export = {
            "exported_at": datetime.now(UTC).isoformat(),
            "user": {
                "id": str(user_data["id"]),
                "email": user_data["email"],
                "phone": user_data["phone"],
                "role": user_data["role"],
                "created_at": str(user_data["created_at"]),
            },
            "mentee_profile": dict(mentee_profile) if mentee_profile else None,
            "mentor_profile": dict(mentor_profile) if mentor_profile else None,
        }

        if export["user"]:
            export["user"].pop("password_hash", None)

        return JSONResponse(content=export)


@router.post("/privacy/account-delete")
async def request_account_delete(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    user_id = uuid.UUID(user.id)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE users SET
                email = 'deleted_' || id || '@anonymized.local',
                phone = NULL,
                full_name = '[deleted]',
                guardian_email = NULL,
                is_deleted = true,
                deleted_at = now()
            WHERE id = $1
            """,
            user_id,
        )
    return {
        "status": "deleted",
        "message": "Your personal data has been anonymized per GDPR Article 17",
    }


@router.get("/privacy-policy")
async def privacy_policy():
    return {
        "title": "ElevateHer Privacy Policy",
        "version": "2.0.0",
        "guardian_consent_required_age": 18,
        "data_retention": (
            "User data is retained for the active programme and "
            "deleted or anonymised after a verified deletion request."
        ),
    }
