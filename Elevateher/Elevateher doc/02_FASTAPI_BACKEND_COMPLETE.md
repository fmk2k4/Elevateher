# ElevateHer — File 02: FastAPI Backend (Complete)
### All Routers · Middleware · Auth · Rate Limiting · Error Handling · Pydantic Models

> **Senior Engineer Note:** FastAPI earns its keep through strict Pydantic validation, async-first DB access, and dependency injection. Never bypass DI for globals. Never use synchronous DB calls in async handlers. Every endpoint has a type signature — if it doesn't, reject the PR.

---

## 1. Project Structure

```
services/api/
├── main.py                   # App factory, lifespan, middleware registration
├── config.py                 # Pydantic Settings from .env
├── dependencies.py           # Shared DI: db pool, redis, current user
├── models/                   # SQLAlchemy ORM models
│   ├── __init__.py
│   ├── user.py
│   ├── profile.py
│   ├── match.py
│   └── impact.py
├── schemas/                  # Pydantic request/response schemas
│   ├── __init__.py
│   ├── auth.py
│   ├── mentee.py
│   ├── mentor.py
│   ├── match.py
│   ├── session.py
│   └── impact.py
├── routers/
│   ├── auth.py
│   ├── mentee.py
│   ├── mentor.py
│   ├── match.py
│   ├── session.py
│   ├── ussd.py
│   ├── impact.py
│   ├── admin.py
│   └── privacy.py
├── services/
│   ├── auth_service.py
│   ├── matching_service.py
│   ├── safety_service.py
│   ├── sms_service.py
│   ├── email_service.py
│   └── impact_service.py
├── middleware/
│   ├── rls_middleware.py     # Sets PostgreSQL app.* settings per request
│   ├── rate_limit.py
│   └── logging_middleware.py
├── tasks/
│   ├── celery_app.py
│   ├── embedding_tasks.py
│   ├── safety_tasks.py
│   ├── sms_tasks.py
│   └── agent_tasks.py
└── tests/                    # See File 09
```

---

## 2. Configuration

```python
# services/api/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Literal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "ElevateHer API"
    app_version: str = "2.0.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False

    # Database
    database_url: str
    db_pool_min: int = 5
    db_pool_max: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # AI Models
    sea_lion_model_path: str = "./models/sea-lion-v4.5-Q4_K_M.gguf"
    safety_model_path: str = "./models/sea-guard-safety-v1"
    agent_model_path: str = "./models/Phi-3-mini-4k-instruct-Q4_K_M.gguf"
    embedding_dim: int = 4096

    # SMS Gateway — Infobip (SE Asia primary)
    infobip_api_key: str = ""
    infobip_base_url: str = "https://api.infobip.com"
    infobip_sender_id: str = "ElevateHer"

    # SMS Gateway — Plivo (Indonesia fallback)
    plivo_auth_id: str = ""
    plivo_auth_token: str = ""

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "hello@elevateher.app"

    # Security
    guardian_consent_required_age: int = 18
    consent_token_ttl_hours: int = 72
    rate_limit_auth_per_minute: int = 5
    rate_limit_api_per_minute: int = 60
    rate_limit_ussd_per_minute: int = 30

    # Features
    enable_agentic_layer: bool = True
    enable_qlora_embeddings: bool = True

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

## 3. Main App Factory

```python
# services/api/main.py

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncpg
import redis.asyncio as aioredis
import logging
import time

from config import get_settings
from middleware.rls_middleware import RLSMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.logging_middleware import StructuredLoggingMiddleware
from routers import auth, mentee, mentor, match, session, ussd, impact, admin, privacy

settings = get_settings()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────────
    logger.info(f"Starting ElevateHer API v{settings.app_version}")

    # PostgreSQL connection pool
    app.state.db_pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.db_pool_min,
        max_size=settings.db_pool_max,
        command_timeout=30,
        statement_cache_size=200
    )

    # Redis client
    app.state.redis = await aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20
    )

    # Verify DB connection
    async with app.state.db_pool.acquire() as conn:
        db_version = await conn.fetchval("SELECT version()")
        logger.info(f"Connected to: {db_version[:50]}")

    # Load AI models (lazy — only if enabled)
    if settings.enable_agentic_layer:
        from services.matching_service import warm_up_embedding_model
        await warm_up_embedding_model()

    logger.info("✅ ElevateHer API started successfully")
    yield

    # ── Shutdown ───────────────────────────────────────────────────────────────
    await app.state.db_pool.close()
    await app.state.redis.aclose()
    logger.info("ElevateHer API shut down cleanly")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan
    )

    # ── Middleware (order matters — last registered = outermost) ───────────────
    app.add_middleware(StructuredLoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RLSMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://elevateher.app",
            "https://inti.elevateher.app",
            "https://nyp.elevateher.app",
            "http://localhost:3000",
            "http://localhost:3001"
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["*"]
    )

    # ── Routers ────────────────────────────────────────────────────────────────
    app.include_router(auth.router,    prefix="/auth",    tags=["Authentication"])
    app.include_router(mentee.router,  prefix="/mentee",  tags=["Mentee"])
    app.include_router(mentor.router,  prefix="/mentor",  tags=["Mentor"])
    app.include_router(match.router,   prefix="/match",   tags=["Matching"])
    app.include_router(session.router, prefix="/session", tags=["Sessions"])
    app.include_router(ussd.router,    prefix="/ussd",    tags=["USSD Gateway"])
    app.include_router(impact.router,  prefix="/impact",  tags=["Impact & SDG"])
    app.include_router(admin.router,   prefix="/admin",   tags=["Administration"])
    app.include_router(privacy.router, prefix="/privacy", tags=["Privacy & GDPR"])

    # ── Global Exception Handlers ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled exception on {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "message": "An unexpected error occurred."}
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "http_error", "message": exc.detail}
        )

    # ── Health Check ────────────────────────────────────────────────────────────
    @app.get("/health", tags=["System"])
    async def health_check(request: Request):
        db_ok = False
        redis_ok = False
        try:
            async with request.app.state.db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_ok = True
        except Exception:
            pass
        try:
            await request.app.state.redis.ping()
            redis_ok = True
        except Exception:
            pass

        status = "healthy" if db_ok and redis_ok else "degraded"
        return {
            "status": status,
            "version": settings.app_version,
            "environment": settings.environment,
            "services": {"database": db_ok, "redis": redis_ok}
        }

    return app

app = create_app()
```

---

## 4. Dependencies (Shared DI)

```python
# services/api/dependencies.py

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncpg
import redis.asyncio as aioredis
from jose import jwt, JWTError
from config import get_settings
import uuid

settings = get_settings()
security = HTTPBearer()

async def get_db_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.db_pool

async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis

class CurrentUser:
    def __init__(self, id: str, role: str, institution_id: str | None,
                 age: int | None, guardian_consented: bool):
        self.id = id
        self.role = role
        self.institution_id = institution_id
        self.age = age
        self.guardian_consented = guardian_consented
        self.is_minor = age is not None and age < 18

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    pool: asyncpg.Pool = Depends(get_db_pool)
) -> CurrentUser:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    row = await pool.fetchrow(
        """
        SELECT id, role, institution_id, age, guardian_consented,
               is_suspended, is_deleted
        FROM users WHERE id = $1
        """,
        uuid.UUID(user_id)
    )
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if row["is_deleted"]:
        raise HTTPException(status.HTTP_410_GONE, "Account has been deleted")
    if row["is_suspended"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
            "Account suspended. Contact support@elevateher.app")

    return CurrentUser(
        id=str(row["id"]),
        role=row["role"],
        institution_id=str(row["institution_id"]) if row["institution_id"] else None,
        age=row["age"],
        guardian_consented=row["guardian_consented"]
    )

def require_role(*roles: str):
    """Role-based access control decorator."""
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                f"Requires one of: {', '.join(roles)}")
        return user
    return checker

require_admin = require_role("admin")
require_institution_admin = require_role("admin", "institution_admin")
require_moderator = require_role("admin", "institution_admin", "moderator")
require_mentor = require_role("admin", "mentor")
require_mentee = require_role("admin", "mentee")
```

---

## 5. Pydantic Schemas

```python
# services/api/schemas/auth.py

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import re

class RegisterRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="mentee", pattern="^(mentee|mentor)$")
    age: Optional[int] = Field(None, ge=10, le=100)
    country: str = Field(min_length=2, max_length=2)
    language: str = Field(default="en", pattern="^(en|ms|id|th|ja)$")
    guardian_email: Optional[EmailStr] = None
    institution_code: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v and not re.match(r"^\+[1-9]\d{7,14}$", v):
            raise ValueError("Phone must be E.164 format: +60123456789")
        return v

    @field_validator("guardian_email")
    @classmethod
    def validate_minor_guardian(cls, v, info):
        age = info.data.get("age")
        if age and age < 18 and not v:
            raise ValueError("Guardian email required for users under 18")
        return v

    def model_post_init(self, __context):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")

class LoginRequest(BaseModel):
    identifier: str       # email or phone number
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    role: str


# services/api/schemas/mentee.py

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class SDGTrack(str, Enum):
    STEM = "STEM"
    Business = "Business"
    Trades = "Trades"
    Creative = "Creative"
    Healthcare = "Healthcare"

class MenteeProfileCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    display_name: Optional[str] = Field(None, max_length=50)
    career_goals: List[str] = Field(min_length=1, max_length=5)
    sdg_track: SDGTrack
    current_education: Optional[str] = Field(None, max_length=200)
    education_level: Optional[str] = None
    preferred_languages: List[str] = Field(default=["en"], max_length=5)
    challenges: Optional[List[str]] = Field(default=[])
    bio_short: Optional[str] = Field(None, max_length=160)

class MenteeProfileUpdate(MenteeProfileCreate):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    career_goals: Optional[List[str]] = None
    sdg_track: Optional[SDGTrack] = None

class MenteeProfileResponse(BaseModel):
    id: str
    user_id: str
    full_name: Optional[str]
    display_name: Optional[str]
    career_goals: List[str]
    sdg_track: str
    current_education: Optional[str]
    preferred_languages: List[str]
    challenges: List[str]
    bio_short: Optional[str]
    onboarding_complete: bool

    class Config:
        from_attributes = True


# services/api/schemas/match.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MatchResponse(BaseModel):
    match_id: str
    mentor_id: str
    mentor_name: str
    mentor_job_title: str
    mentor_industry: str
    mentor_years_exp: int
    mentor_languages: list[str]
    match_score: float
    match_reason: str
    sdg_track: str
    status: str
    started_at: Optional[datetime]

class MatchCandidateResponse(BaseModel):
    """Before a match is confirmed — just candidates."""
    mentor_id: str
    mentor_name: str
    job_title: str
    industry: str
    years_exp: int
    languages: list[str]
    match_score: float
    match_reason: str
    bio_preview: str        # first 160 chars of bio
```

---

## 6. Authentication Router

```python
# services/api/routers/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
import asyncpg
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import uuid, secrets

from dependencies import get_db_pool, get_redis
from config import get_settings
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from services.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token
)
from services.email_service import send_guardian_consent_email
from tasks.embedding_tasks import reembed_mentee_task

settings = get_settings()
router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/register", response_model=dict, status_code=201)
async def register(
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        # Check for existing user
        exists = await conn.fetchval(
            "SELECT id FROM users WHERE email = $1 OR phone = $2",
            data.email, data.phone
        )
        if exists:
            raise HTTPException(status.HTTP_409_CONFLICT,
                "An account with this email or phone already exists.")

        # Resolve institution from code
        institution_id = None
        if data.institution_code:
            institution_id = await conn.fetchval(
                "SELECT id FROM institutions WHERE subdomain = $1 AND is_active = true",
                data.institution_code.lower()
            )

        # Create user
        user_id = await conn.fetchval(
            """
            INSERT INTO users (email, phone, role, age, country, language,
                guardian_email, institution_id,
                guardian_consented)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id
            """,
            data.email, data.phone, data.role, data.age,
            data.country, data.language, data.guardian_email,
            institution_id,
            data.age is None or data.age >= settings.guardian_consent_required_age
        )

        # Store hashed password in Supabase Auth (or your own auth table)
        # For simplicity, storing in a separate passwords table
        await conn.execute(
            "INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)",
            user_id, hash_password(data.password)
        )

        # Guardian consent for minors
        needs_consent = data.age and data.age < settings.guardian_consent_required_age
        if needs_consent and data.guardian_email:
            token = secrets.token_urlsafe(48)
            expires = datetime.utcnow() + timedelta(hours=settings.consent_token_ttl_hours)
            await conn.execute(
                """
                INSERT INTO guardian_consents (user_id, token, guardian_email, expires_at)
                VALUES ($1, $2, $3, $4)
                """,
                user_id, token, data.guardian_email, expires
            )
            background_tasks.add_task(
                send_guardian_consent_email,
                guardian_email=data.guardian_email,
                mentee_age=data.age,
                consent_token=token
            )

    return {
        "user_id": str(user_id),
        "message": "Account created successfully.",
        "requires_guardian_consent": needs_consent,
        "onboarding_next": "/mentee/profile" if data.role == "mentee" else "/mentor/profile"
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis: = Depends(get_redis)
):
    # Rate limit check
    rate_key = f"auth_attempts:{data.identifier}"
    attempts = await redis.incr(rate_key)
    if attempts == 1:
        await redis.expire(rate_key, 900)   # 15-minute window
    if attempts > settings.rate_limit_auth_per_minute * 3:  # 5 * 3 = 15 per 15 min
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many login attempts. Try again in 15 minutes.")

    async with pool.acquire() as conn:
        identifier = data.identifier.strip().lower()
        row = await conn.fetchrow(
            """
            SELECT u.id, u.role, u.institution_id, u.age, u.is_suspended,
                   u.is_deleted, u.guardian_consented, p.password_hash
            FROM users u
            JOIN user_passwords p ON p.user_id = u.id
            WHERE LOWER(u.email) = $1 OR u.phone = $1
            """,
            identifier
        )

    if not row or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials.")

    if row["is_deleted"]:
        raise HTTPException(status.HTTP_410_GONE, "Account has been deleted.")
    if row["is_suspended"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is suspended.")

    # Check guardian consent for minors
    age = row["age"]
    if age and age < settings.guardian_consent_required_age and not row["guardian_consented"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
            "Account pending guardian consent. Please check your guardian's email.")

    user_id = str(row["id"])
    access_token  = create_access_token(user_id, row["role"])
    refresh_token = create_refresh_token(user_id)

    # Update last login
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET last_login = now() WHERE id = $1",
            row["id"]
        )

    # Clear rate limit on successful login
    await redis.delete(rate_key)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user_id=user_id,
        role=row["role"]
    )


@router.get("/guardian-consent/{token}")
async def complete_guardian_consent(
    token: str,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        record = await conn.fetchrow(
            """
            SELECT gc.id, gc.user_id, gc.expires_at, gc.consented
            FROM guardian_consents gc
            WHERE gc.token = $1 AND gc.expires_at > now() AND gc.consented = false
            """,
            token
        )
        if not record:
            raise HTTPException(400, "Consent link is invalid or has expired.")

        async with conn.transaction():
            await conn.execute(
                "UPDATE guardian_consents SET consented=true, consented_at=now() WHERE id=$1",
                record["id"]
            )
            await conn.execute(
                "UPDATE users SET guardian_consented=true WHERE id=$1",
                record["user_id"]
            )

    return {"message": "Guardian consent confirmed. The account is now fully active.", "status": "activated"}


@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    try:
        payload = jwt.decode(refresh_token, settings.jwt_secret,
                            algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid refresh token")
    except Exception:
        raise HTTPException(401, "Invalid or expired refresh token")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT role FROM users WHERE id = $1 AND NOT is_deleted", user_id
        )
    if not row:
        raise HTTPException(401, "User not found")

    return {
        "access_token": create_access_token(user_id, row["role"]),
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60
    }
```

---

## 7. Mentee Router

```python
# services/api/routers/mentee.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
import asyncpg, uuid

from dependencies import get_db_pool, get_redis, get_current_user, require_mentee, CurrentUser
from schemas.mentee import MenteeProfileCreate, MenteeProfileUpdate, MenteeProfileResponse
from services.matching_service import find_top_mentors
from tasks.embedding_tasks import reembed_mentee_task

router = APIRouter()

@router.post("/profile", response_model=MenteeProfileResponse, status_code=201)
async def create_mentee_profile(
    data: MenteeProfileCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            """
            INSERT INTO mentee_profiles (
                user_id, full_name, display_name, career_goals, sdg_track,
                current_education, education_level, preferred_languages,
                challenges, bio_short, onboarding_complete
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                career_goals = EXCLUDED.career_goals,
                sdg_track = EXCLUDED.sdg_track,
                onboarding_complete = true,
                updated_at = now()
            RETURNING *
            """,
            uuid.UUID(user.id), data.full_name, data.display_name,
            data.career_goals, data.sdg_track.value,
            data.current_education, data.education_level,
            data.preferred_languages, data.challenges or [], data.bio_short
        )

    # Trigger async re-embedding (non-blocking)
    background_tasks.add_task(
        reembed_mentee_task, str(user.id), data.model_dump()
    )

    return MenteeProfileResponse(**dict(profile))


@router.get("/profile", response_model=MenteeProfileResponse)
async def get_mentee_profile(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            "SELECT * FROM mentee_profiles WHERE user_id = $1",
            uuid.UUID(user.id)
        )
    if not profile:
        raise HTTPException(404, "Profile not found. Please complete onboarding.")
    return MenteeProfileResponse(**dict(profile))


@router.get("/matches")
async def get_my_matches(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Get the current user's active and completed matches."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, m.status, m.match_score, m.match_reason,
                   m.sdg_track, m.started_at, m.completed_at,
                   mp.display_name AS mentor_name, mp.job_title,
                   mp.industry, mp.years_exp, mp.bio,
                   COUNT(s.id) AS sessions_count
            FROM matches m
            JOIN mentor_profiles mp ON mp.user_id = m.mentor_id
            LEFT JOIN sessions s ON s.match_id = m.id AND s.completed = true
            WHERE m.mentee_id = $1
            GROUP BY m.id, mp.display_name, mp.job_title, mp.industry, mp.years_exp, mp.bio
            ORDER BY m.created_at DESC
            """,
            uuid.UUID(user.id)
        )
    return [dict(r) for r in rows]


@router.get("/candidates")
async def get_mentor_candidates(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Get top 5 AI-matched mentor candidates before a match is confirmed."""
    # Check if mentee already has an active match
    async with pool.acquire() as conn:
        active = await conn.fetchval(
            "SELECT id FROM matches WHERE mentee_id = $1 AND status = 'active'",
            uuid.UUID(user.id)
        )
        if active:
            raise HTTPException(400, "You already have an active mentor match.")

    candidates = await find_top_mentors(pool, str(user.id), top_k=5)
    return {"candidates": candidates}


@router.post("/matches/{match_id}/accept")
async def accept_match(
    match_id: str,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        match = await conn.fetchrow(
            "SELECT * FROM matches WHERE id = $1 AND mentee_id = $2 AND status = 'pending'",
            uuid.UUID(match_id), uuid.UUID(user.id)
        )
        if not match:
            raise HTTPException(404, "Match not found or not in pending state.")

        await conn.execute(
            "UPDATE matches SET status = 'active', started_at = now() WHERE id = $1",
            uuid.UUID(match_id)
        )

    # Notify mentor via SMS/email
    from tasks.sms_tasks import send_match_confirmed_sms
    background_tasks.add_task(send_match_confirmed_sms, match_id)

    return {"message": "Match accepted! Your mentor has been notified.", "match_id": match_id}


@router.get("/sessions")
async def get_my_sessions(
    user: CurrentUser = Depends(require_mentee),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id, s.session_num, s.channel, s.milestone_title,
                   s.completed, s.completed_at, s.agent_summary,
                   s.scheduled_at, m.sdg_track
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE m.mentee_id = $1
            ORDER BY s.session_num ASC
            """,
            uuid.UUID(user.id)
        )
    return [dict(r) for r in rows]
```

---

## 8. Mentor Router

```python
# services/api/routers/mentor.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
import asyncpg, uuid

from dependencies import get_db_pool, require_mentor, get_current_user, CurrentUser
from tasks.embedding_tasks import reembed_mentor_task
from tasks.safety_tasks import scan_mentor_bio_task
from services.matching_service import find_top_mentors

router = APIRouter()

@router.post("/profile", status_code=201)
async def create_mentor_profile(
    data: dict,  # Full schema defined in schemas/mentor.py
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    # Bio must be at least 100 chars
    bio = data.get("bio", "")
    if len(bio.strip()) < 100:
        raise HTTPException(400, "Bio must be at least 100 characters.")

    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            """
            INSERT INTO mentor_profiles (
                user_id, full_name, display_name, job_title, employer,
                industry, years_exp, skills, languages, bio,
                linkedin_url, availability, verification_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending_id')
            ON CONFLICT (user_id) DO UPDATE SET
                job_title = EXCLUDED.job_title,
                bio = EXCLUDED.bio,
                updated_at = now()
            RETURNING *
            """,
            uuid.UUID(user.id), data["full_name"], data.get("display_name"),
            data["job_title"], data["employer"], data["industry"],
            data["years_exp"], data["skills"], data.get("languages",["en"]),
            bio, data.get("linkedin_url"), data.get("availability", {})
        )

    # Async: safety scan + embedding
    background_tasks.add_task(scan_mentor_bio_task, str(user.id), bio)
    background_tasks.add_task(reembed_mentor_task, str(user.id), data)

    return {
        "message": "Profile submitted. Pending safety verification and admin review.",
        "verification_status": "pending_id",
        "next_steps": [
            "Upload government-issued ID",
            "Upload employment proof",
            "Sign code of conduct"
        ]
    }


@router.post("/upload-verification-doc")
async def upload_verification_doc(
    doc_type: str,  # 'id_document' | 'employment_doc'
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    if doc_type not in ("id_document", "employment_doc"):
        raise HTTPException(400, "doc_type must be 'id_document' or 'employment_doc'")

    # Upload to Supabase Storage (private bucket)
    from services.storage_service import upload_private_document
    path = await upload_private_document(
        file=file,
        bucket="mentor-verification",
        path=f"{user.id}/{doc_type}/{file.filename}"
    )

    column = "id_document_path" if doc_type == "id_document" else "employment_doc_path"
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE mentor_profiles SET {column} = $1 WHERE user_id = $2",
            path, uuid.UUID(user.id)
        )

    # Check if all docs uploaded → move to admin review
    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            "SELECT id_document_path, employment_doc_path, bio_safety_score FROM mentor_profiles WHERE user_id = $1",
            uuid.UUID(user.id)
        )
        if (profile["id_document_path"] and profile["employment_doc_path"]
                and profile["bio_safety_score"] >= 0.75):
            await conn.execute(
                "UPDATE mentor_profiles SET verification_status = 'pending_admin_review' WHERE user_id = $1",
                uuid.UUID(user.id)
            )

    return {"message": f"{doc_type} uploaded successfully.", "path": path}


@router.post("/sign-code-of-conduct")
async def sign_code_of_conduct(
    agreed: bool,
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    if not agreed:
        raise HTTPException(400, "You must agree to the code of conduct to proceed.")
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE mentor_profiles SET code_of_conduct_signed=true, code_signed_at=now() WHERE user_id=$1",
            uuid.UUID(user.id)
        )
    return {"message": "Code of conduct signed. Your verification is under review."}


@router.get("/my-mentees")
async def get_my_mentees(
    user: CurrentUser = Depends(require_mentor),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id AS match_id, m.status, m.sdg_track,
                   m.started_at, m.match_reason,
                   mp.display_name, mp.career_goals,
                   mp.current_education, mp.preferred_languages,
                   COUNT(s.id) AS sessions_completed,
                   MAX(s.completed_at) AS last_session
            FROM matches m
            JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
            LEFT JOIN sessions s ON s.match_id = m.id AND s.completed = true
            WHERE m.mentor_id = $1 AND m.status IN ('pending','active')
            GROUP BY m.id, mp.display_name, mp.career_goals,
                     mp.current_education, mp.preferred_languages
            """,
            uuid.UUID(user.id)
        )
    return [dict(r) for r in rows]
```

---

## 9. Admin Router

```python
# services/api/routers/admin.py

from fastapi import APIRouter, Depends, HTTPException
import asyncpg, uuid

from dependencies import get_db_pool, require_institution_admin, require_admin, CurrentUser

router = APIRouter()

@router.get("/pending-mentors")
async def list_pending_mentors(
    institution_id: str = None,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """List mentors pending admin approval. Institution admins see only their cohort."""
    inst_filter = institution_id or admin.institution_id

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT u.id, u.email, u.phone, u.country, u.created_at,
                   mp.full_name, mp.job_title, mp.employer, mp.industry,
                   mp.years_exp, mp.bio, mp.bio_safety_score, mp.bio_flags,
                   mp.linkedin_url, mp.verification_status,
                   mp.id_document_path IS NOT NULL AS has_id_doc,
                   mp.employment_doc_path IS NOT NULL AS has_emp_doc,
                   mp.code_of_conduct_signed
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.verification_status = 'pending_admin_review'
              AND (u.institution_id = $1 OR $1 IS NULL OR $2 = 'admin')
            ORDER BY u.created_at ASC
            """,
            uuid.UUID(inst_filter) if inst_filter else None,
            admin.role
        )
    return [dict(r) for r in rows]


@router.post("/mentors/{mentor_user_id}/approve")
async def approve_mentor(
    mentor_user_id: str,
    can_mentor_minors: bool = False,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentor_profiles SET
                is_approved = true,
                can_mentor_minors = $1,
                verification_status = 'approved',
                verified_by = $2,
                verified_at = now()
            WHERE user_id = $3
            """,
            can_mentor_minors, uuid.UUID(admin.id), uuid.UUID(mentor_user_id)
        )
    from tasks.sms_tasks import notify_mentor_approved
    from tasks.sms_tasks import notify_mentor_approved_task
    notify_mentor_approved_task.delay(mentor_user_id)
    return {"message": "Mentor approved.", "can_mentor_minors": can_mentor_minors}


@router.post("/mentors/{mentor_user_id}/reject")
async def reject_mentor(
    mentor_user_id: str,
    reason: str,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentor_profiles SET
                verification_status = 'rejected',
                verification_notes = $1
            WHERE user_id = $2
            """,
            reason, uuid.UUID(mentor_user_id)
        )
    return {"message": "Mentor application rejected.", "reason": reason}


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    reason: str,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE users SET
                is_suspended = true,
                suspended_reason = $1,
                suspended_at = now()
            WHERE id = $2
            """,
            reason, uuid.UUID(user_id)
        )
    return {"message": "User suspended.", "user_id": user_id}


@router.get("/safety-reports")
async def list_safety_reports(
    status_filter: str = "open",
    admin: CurrentUser = Depends(require_moderator),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT sr.*, u_rep.email AS reporter_email,
                   u_rep2.email AS reported_email,
                   u_rep2.is_suspended
            FROM safety_reports sr
            JOIN users u_rep  ON u_rep.id = sr.reporter_id
            JOIN users u_rep2 ON u_rep2.id = sr.reported_user_id
            WHERE sr.status = $1
            ORDER BY sr.created_at ASC
            """,
            status_filter
        )
    return [dict(r) for r in rows]


@router.get("/institutions/{institution_id}/stats")
async def get_institution_stats(
    institution_id: str,
    admin: CurrentUser = Depends(require_institution_admin),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM v_institution_cohort_summary WHERE institution_id = $1",
            uuid.UUID(institution_id)
        )
    if not row:
        raise HTTPException(404, "Institution not found.")
    return dict(row)
```

---

## 10. RLS Middleware

```python
# services/api/middleware/rls_middleware.py
"""
Sets PostgreSQL session-level settings so Row-Level Security
policies know who is making the request.
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from jose import jwt, JWTError
from config import get_settings

settings = get_settings()

class RLSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip RLS for health checks and public endpoints
        if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        user_id = None
        user_role = "anonymous"
        institution_id = None

        # Extract JWT if present
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = jwt.decode(
                    token, settings.jwt_secret,
                    algorithms=[settings.jwt_algorithm]
                )
                user_id = payload.get("sub")
                user_role = payload.get("role", "anonymous")
                institution_id = payload.get("institution_id")
            except JWTError:
                pass  # Anonymous request — RLS will block sensitive data

        # Store in request state for use in route handlers
        request.state.user_id = user_id
        request.state.user_role = user_role
        request.state.institution_id = institution_id

        response = await call_next(request)
        return response
```

---

## 11. Auth Service Helpers

```python
# services/api/services/auth_service.py

from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, role: str, institution_id: str = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "institution_id": institution_id,
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
```

---

## 12. requirements.txt

```txt
# services/api/requirements.txt

# Framework
fastapi==0.115.0
uvicorn[standard]==0.32.0
python-multipart==0.0.12    # for UploadFile

# Database
asyncpg==0.30.0
alembic==1.14.0
sqlalchemy[asyncio]==2.0.36

# Redis
redis==5.2.0

# Auth & Security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic[email]==2.10.3
pydantic-settings==2.7.0

# AI / ML
llama-cpp-python==0.3.2     # SEA-LION & Phi-3 GGUF inference
transformers==4.47.0         # SEA-Guard pipeline
torch==2.5.1
sentence-transformers==3.3.1
peft==0.14.0                 # QLoRA
bitsandbytes==0.45.0         # 4-bit quantisation

# SMS & Communications
httpx==0.27.2               # Infobip API calls
plivo==4.52.0

# Email
resend==2.5.0

# Task Queue
celery[redis]==5.4.0
flower==2.0.1               # Celery monitoring (dev only)

# Monitoring
sentry-sdk[fastapi]==2.19.0

# Testing
pytest==8.3.4
pytest-asyncio==0.24.0
pytest-cov==6.0.0
httpx==0.27.2               # test client
faker==33.1.0

# Dev tools
ruff==0.8.4
black==24.10.0
safety==3.2.11
```

---

*File 02 of 10 — ElevateHer Complete Technical Suite*
*Covers: App factory, all middleware, auth router, mentee/mentor/admin routers, Pydantic schemas, auth service, requirements.txt*
