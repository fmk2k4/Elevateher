import uuid

import asyncpg
import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import get_settings
from middleware.rls_middleware import RequestConnectionPool

try:
    from services.api.services.auth_service import decode_token
except ImportError:

    def decode_token(token: str) -> dict:
        raise ValueError("auth_service unavailable")


settings = get_settings()
security = HTTPBearer()


async def get_db_pool(request: Request) -> asyncpg.Pool | RequestConnectionPool:
    rls_conn = getattr(request.state, "rls_conn", None)
    if rls_conn is not None:
        return RequestConnectionPool(rls_conn)

    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database is not connected")
    return pool


async def get_redis(request: Request) -> aioredis.Redis:
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Redis is not connected")
    return redis_client


class CurrentUser:
    def __init__(
        self,
        id: str,  # noqa: A002
        role: str,
        institution_id: str | None,
        age: int | None,
        guardian_consented: bool,
    ):
        self.id = id
        self.role = role
        self.institution_id = institution_id
        self.age = age
        self.guardian_consented = guardian_consented
        self.is_minor = age is not None and age < 18


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> CurrentUser:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc


async def get_current_user_from_query(
    token: str | None = None,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> CurrentUser | None:
    """Authenticate a user from a token passed as a query parameter.

    Used by SSE endpoints (EventSource) where custom headers cannot be set.
    Returns None if no token is provided (caller should handle unauthenticated case).
    """
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
    except Exception:
        return None

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, role, institution_id, age, guardian_consented,
                   is_suspended, is_deleted
            FROM users WHERE id = $1
            """,
            user_id,
        )
    if not row:
        return None
    if row["is_deleted"] or row["is_suspended"]:
        return None

    return CurrentUser(
        id=str(row["id"]),
        role=row["role"],
        institution_id=str(row["institution_id"]) if row["institution_id"] else None,
        age=row["age"],
        guardian_consented=row["guardian_consented"],
    )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, role, institution_id, age, guardian_consented,
                   is_suspended, is_deleted
            FROM users WHERE id = $1
            """,
            user_id,
        )
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if row["is_deleted"]:
        raise HTTPException(status.HTTP_410_GONE, "Account has been deleted")
    if row["is_suspended"]:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Account suspended. Contact support@elevateher.app",
        )

    return CurrentUser(
        id=str(row["id"]),
        role=row["role"],
        institution_id=str(row["institution_id"]) if row["institution_id"] else None,
        age=row["age"],
        guardian_consented=row["guardian_consented"],
    )


def require_role(*roles: str):
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Access denied: requires one of {list(roles)}, got '{user.role}'",
            )
        return user

    return checker


def require_consent_for_minors():
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.is_minor and not user.guardian_consented:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Guardian consent required")
        return user

    return checker


require_admin = require_role("admin")
require_institution_admin = require_role("admin", "institution_admin")
require_moderator = require_role("admin", "institution_admin", "moderator")
require_mentor = require_role("mentor")
require_mentee = require_role("mentee")


async def require_approved_mentor(
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> CurrentUser:
    """Require user is an approved mentor."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT is_approved, is_active FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(user.id),
        )
        if not row:
            raise HTTPException(403, "Mentor profile not found")
        if not row["is_approved"]:
            raise HTTPException(403, "Mentor account not yet approved")
        if not row["is_active"]:
            raise HTTPException(403, "Mentor account is inactive")
    return user
