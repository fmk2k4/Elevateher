import secrets
import uuid
from datetime import UTC, datetime, timedelta

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from jose import jwt
from pydantic import BaseModel

from config import get_settings
from dependencies import CurrentUser, get_current_user, get_db_pool, get_redis
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse

try:
    from services.api.services.auth_service import (
        create_access_token,
        create_refresh_token,
        hash_password,
        verify_password,
    )
    from services.api.services.email_service import send_guardian_consent_email
except ImportError:

    def _unavailable(*args, **kwargs):
        raise RuntimeError("auth_service unavailable")

    create_access_token = _unavailable
    create_refresh_token = _unavailable
    hash_password = _unavailable
    verify_password = _unavailable
    send_guardian_consent_email = _unavailable

settings = get_settings()
router = APIRouter()
logger = __import__("logging").getLogger(__name__)


@router.post("/register", status_code=201)
async def register(
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        institution_id = None
        if data.institution_code:
            institution_id = await conn.fetchval(
                "SELECT id FROM institutions WHERE subdomain = $1 AND is_active = true",
                data.institution_code.lower(),
            )

        needs_consent = bool(data.age is None or data.age < settings.guardian_consent_required_age)
        try:
            async with conn.transaction():
                user_id = await conn.fetchval(
                    """
                    INSERT INTO users (email, phone, role, age, country, language,
                        guardian_email, institution_id, guardian_consented)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    RETURNING id
                    """,
                    data.email,
                    data.phone,
                    data.role,
                    data.age,
                    data.country,
                    data.language,
                    data.guardian_email,
                    institution_id,
                    not needs_consent,
                )
                await conn.execute(
                    "INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)",
                    user_id,
                    hash_password(data.password),
                )
        except asyncpg.UniqueViolationError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email or phone already registered",
            ) from exc

        if needs_consent and data.guardian_email:
            token = secrets.token_urlsafe(48)
            expires = datetime.now(UTC) + timedelta(hours=settings.consent_token_ttl_hours)
            await conn.execute(
                "INSERT INTO guardian_consents "
                "(user_id, token, guardian_email, expires_at) "
                "VALUES ($1, $2, $3, $4)",
                user_id,
                token,
                data.guardian_email,
                expires,
            )
            background_tasks.add_task(
                send_guardian_consent_email,
                guardian_email=data.guardian_email,
                mentee_age=data.age,
                consent_token=token,
            )

    return {
        "user_id": str(user_id),
        "message": "Account created successfully.",
        "requires_guardian_consent": needs_consent,
        "onboarding_next": ("/mentee/profile" if data.role == "mentee" else "/mentor/profile"),
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    data: LoginRequest,
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis_client=Depends(get_redis),
):
    rate_key = f"auth_attempts:{data.identifier}"
    attempts = await redis_client.incr(rate_key)
    if attempts == 1:
        await redis_client.expire(rate_key, 900)
    if attempts > settings.rate_limit_auth_per_minute * 3:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many login attempts. Try again in 15 minutes.",
        )

    identifier = data.identifier.strip().lower()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.role, u.institution_id, u.age, u.is_suspended,
                   u.is_deleted, u.guardian_consented, p.password_hash,
                   i.subdomain
            FROM users u
            JOIN user_passwords p ON p.user_id = u.id
            LEFT JOIN institutions i ON i.id = u.institution_id
            WHERE LOWER(u.email) = $1 OR u.phone = $1
            """,
            identifier,
        )

    if not row or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials.")
    if row["is_deleted"]:
        raise HTTPException(status.HTTP_410_GONE, "Account has been deleted.")
    if row["is_suspended"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is suspended.")

    if (
        row["age"]
        and row["age"] < settings.guardian_consent_required_age
        and not row["guardian_consented"]
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Account pending guardian consent. Please check your guardian's email.",
        )

    user_id = str(row["id"])
    institution_id = str(row["institution_id"]) if row["institution_id"] else None
    access_token = create_access_token(user_id, row["role"], institution_id)
    refresh_token = create_refresh_token(user_id)

    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET last_login = now(), login_count = login_count + 1 WHERE id = $1",
            row["id"],
        )

        # Store the session for revocation
        expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        ip_address = request.client.host if request.client else None
        device_info = request.headers.get("user-agent")

        await conn.execute(
            """
            INSERT INTO app_auth_sessions
            (user_id, refresh_token, ip_address, device_info, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            """,
            row["id"],
            refresh_token,
            ip_address,
            device_info,
            expires_at,
        )

    await redis_client.delete(rate_key)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user_id=user_id,
        role=row["role"],
        subdomain=row.get("subdomain"),
    )

class UserResponse(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    role: str
    age: int | None = None
    country: str | None = None
    language: str | None = None
    institution_id: str | None = None
    guardian_consented: bool
    is_minor: bool = False


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> UserResponse:
    """Return the currently authenticated user's profile."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT email, phone, role, age, country, language,
                   institution_id, guardian_consented
            FROM users WHERE id = $1
            """,
            user.id,
        )
    if not row:
        raise HTTPException(404, "User not found")
    return UserResponse(
        id=user.id,
        email=row["email"],
        phone=row["phone"],
        role=row["role"],
        age=row["age"],
        country=row["country"],
        language=row["language"],
        institution_id=str(row["institution_id"]) if row["institution_id"] else None,
        guardian_consented=row["guardian_consented"],
        is_minor=user.is_minor,
    )


@router.get("/users/profile")
async def get_user_profile(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.email, u.role, u.age, u.country, u.language,
                   u.institution_id, u.guardian_consented, u.is_verified,
                   u.is_suspended, u.last_login, u.login_count,
                   mp.full_name, mp.display_name, mp.career_goals, mp.sdg_track,
                   mp.current_education, mp.education_level,
                   mp.preferred_languages, mp.challenges, mp.bio_short,
                   mp.onboarding_complete
            FROM users u
            LEFT JOIN mentee_profiles mp ON mp.user_id = u.id
            WHERE u.id = $1
            LIMIT 1
            """,
            user.id,
        )
    return {"user": dict(row) if row else None}


@router.put("/users/profile")
async def update_user_profile(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    role = payload.get("role")
    onboarding_complete = payload.get("onboarding_complete")
    name = payload.get("name")

    async with pool.acquire() as conn:
        # Update core user fields in users table (authoritative source for get_current_user)
        if role and role in ("mentee", "mentor", "institution_admin"):
            await conn.execute(
                "UPDATE users SET role = $1 WHERE id = $2",
                role, uuid.UUID(user.id),
            )

        # Update profile fields in the appropriate profile table
        profile_fields = []
        profile_values = []
        if name:
            profile_fields.append(f"full_name = ${len(profile_values) + 1}")
            profile_values.append(name)
        if isinstance(onboarding_complete, bool):
            profile_fields.append(f"onboarding_complete = ${len(profile_values) + 1}")
            profile_values.append(onboarding_complete)

        if profile_fields:
            if user.role == "mentee":
                profile_table = "mentee_profiles"
            else:
                profile_table = "mentor_profiles"
            set_clause = ", ".join(profile_fields)
            query = f"UPDATE {profile_table} SET {set_clause} WHERE user_id = ${len(profile_values) + 1}"  # noqa: S608 - table is hardcoded allowlist, values parameterized
            await conn.execute(query, *profile_values, uuid.UUID(user.id))

    return {"user": {"id": user.id, "role": role or user.role, "updated": True}}


@router.get("/notifications")
async def list_notifications(
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        notifications = await conn.fetch(
            """
            SELECT * FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 30
            """,
            user.id,
        )
    rows = [dict(row) for row in notifications]
    return {"notifications": rows, "unread": sum(1 for row in rows if not row.get("is_read"))}


@router.put("/notifications")
async def update_notifications(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    notification_id = payload.get("notification_id")
    mark_all_read = bool(payload.get("mark_all_read", False))

    async with pool.acquire() as conn:
        if mark_all_read:
            await conn.execute(
                "UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false",
                user.id,
            )
        elif notification_id:
            await conn.execute(
                "UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND user_id = $2",
                notification_id,
                user.id,
            )
    return {"success": True}

@router.get("/guardian-consent/{token}")
async def complete_guardian_consent(
    request: Request,
    token: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis=Depends(get_redis),
):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"consent_approval:{client_ip}"
    attempts = await redis.incr(rate_key)
    if attempts == 1:
        await redis.expire(rate_key, 3600)
    if attempts > 5:
        raise HTTPException(429, "Too many consent attempts. Please try again later.")

    async with pool.acquire() as conn:
        record = await conn.fetchrow(
            """
            SELECT id, user_id, expires_at, consented
            FROM guardian_consents
            WHERE token = $1 AND expires_at > now() AND consented = false
            """,
            token,
        )
        if not record:
            raise HTTPException(400, "Invalid or expired consent link.")

        async with conn.transaction():
            consent = await conn.fetchrow(
                "SELECT * FROM guardian_consents WHERE id = $1 FOR UPDATE",
                record["id"],
            )
            if not consent:
                raise HTTPException(400, "Invalid consent token")
            if consent["consented"]:
                raise HTTPException(400, "Consent already given")
            await conn.execute(
                "UPDATE guardian_consents SET consented=true, " "consented_at=now() WHERE id=$1",
                record["id"],
            )
            await conn.execute(
                "UPDATE users SET guardian_consented=true WHERE id=$1",
                record["user_id"],
            )

    return {
        "message": "Guardian consent confirmed. The account is now fully active.",
        "status": "activated",
    }


class GuardianConsentVerifyResponse(BaseModel):
    valid: bool
    reason: str | None = None
    mentee_name: str | None = None
    mentee_age: int | None = None


@router.get("/guardian-consent/verify", response_model=GuardianConsentVerifyResponse)
async def verify_guardian_consent(
    token: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        record = await conn.fetchrow(
            """
            SELECT gc.id, gc.user_id, gc.expires_at, gc.consented,
                   u.email, u.age, mp.full_name, mp.display_name
            FROM guardian_consents gc
            JOIN users u ON u.id = gc.user_id
            LEFT JOIN mentee_profiles mp ON mp.user_id = u.id
            WHERE gc.token = $1
            """,
            token,
        )
        if not record:
            return {"valid": False, "reason": "invalid"}
        if record["consented"]:
            return {"valid": False, "reason": "already_consented"}

        expires_at = record["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(UTC):
            return {"valid": False, "reason": "expired"}

        name = record["full_name"] or record["display_name"] or (record["email"] or "").split("@")[0]
        return {
            "valid": True,
            "mentee_name": name,
            "mentee_age": record["age"],
        }


class GuardianConsentRespondRequest(BaseModel):
    token: str
    decision: str


@router.post("/guardian-consent/respond")
async def respond_guardian_consent(
    data: GuardianConsentRespondRequest,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    if data.decision not in ["consented", "declined"]:
        raise HTTPException(400, "Invalid decision.")

    async with pool.acquire() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                """
                SELECT id, user_id, expires_at, consented
                FROM guardian_consents
                WHERE token = $1
                FOR UPDATE
                """,
                data.token,
            )
            if not record:
                raise HTTPException(404, "Invalid consent token.")

            if record["consented"]:
                return {"status": "already_consented", "message": "Consent already provided"}

            expires_at = record["expires_at"]
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
            if expires_at < datetime.now(UTC):
                raise HTTPException(410, "Consent link has expired")

            await conn.execute(
                "UPDATE guardian_consents SET consented=true, consented_at=now() WHERE id=$1",
                record["id"],
            )
            if data.decision == "consented":
                await conn.execute(
                    "UPDATE users SET guardian_consented=true WHERE id=$1",
                    record["user_id"],
                )
                return {
                    "status": "consented",
                    "message": "Guardian consent successfully registered.",
                }
            else:
                return {"status": "declined", "message": "Consent declined."}


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
async def refresh_token(data: RefreshRequest, pool: asyncpg.Pool = Depends(get_db_pool)):
    try:
        from services.api.services.auth_service import decode_token
    except ImportError:

        def decode_token(token: str) -> dict:
            raise ValueError("auth_service unavailable")

    try:
        payload = decode_token(data.refresh_token)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, "Refresh token has expired") from exc
    except jwt.InvalidTokenError:
        logger.warning("Invalid refresh token attempt")
        raise HTTPException(401, "Invalid or expired refresh token") from None
    except Exception as exc:
        logger.error("Unexpected token decode error", exc_info=True)
        raise HTTPException(401, "Invalid or expired refresh token") from exc

    user_id = payload.get("sub")
    if not user_id or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")

    async with pool.acquire() as conn:
        # Check if the token is valid in the database (not revoked)
        session = await conn.fetchrow(
            """
            SELECT id, revoked
            FROM app_auth_sessions
            WHERE refresh_token = $1 AND user_id = $2
            """,
            data.refresh_token,
            uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        )
        if not session or session["revoked"]:
            raise HTTPException(401, "Session has been revoked or is invalid")

        # Update last_used_at
        await conn.execute(
            "UPDATE app_auth_sessions SET last_used_at = now() WHERE id = $1", session["id"]
        )

        row = await conn.fetchrow(
            "SELECT role FROM users WHERE id = $1 AND NOT is_deleted AND NOT is_suspended",
            uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        )
    if not row:
        raise HTTPException(401, "User not found")

    return {
        "access_token": create_access_token(user_id, row["role"]),
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
    }


@router.post("/logout")
async def logout(data: RefreshRequest, pool: asyncpg.Pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE app_auth_sessions SET revoked = true, revoked_at = now() WHERE refresh_token = $1",
            data.refresh_token,
        )
    return {"message": "Logged out successfully"}
