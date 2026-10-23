import asyncio
import logging
import os
from contextlib import asynccontextmanager

import asyncpg
import redis.asyncio as aioredis
import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

# Use centralized path management instead of duplicating sys.path manipulation
import services.path  # noqa: F401 - ensures paths are configured before other imports
from middleware.csrf import CSRFProtectionMiddleware  # noqa: E402
from middleware.logging_middleware import StructuredLoggingMiddleware  # noqa: E402
from middleware.rate_limit import RateLimitMiddleware  # noqa: E402
from middleware.rls_middleware import RLSMiddleware  # noqa: E402
from routers import (  # noqa: E402
    admin,
    auth,
    dashboard,
    health,
    impact,
    match,
    mentee,
    mentor,
    privacy,
    safety,
    session,
    ussd,
)
from services.api.config import get_settings  # noqa: E402

settings = get_settings()
logger = logging.getLogger(__name__)

# ── Prometheus Metrics Setup ──────────────────────────────────────────────────
# Initialize Prometheus metrics instrumentation
PROMETHEUS_AVAILABLE = False
prometheus_instrumentator = None

try:
    from prometheus_fastapi_instrumentator import Instrumentator

    # Create instrumentator with basic configuration
    prometheus_instrumentator = Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health"],
    )

    PROMETHEUS_AVAILABLE = True
except ImportError:
    logger.warning("Prometheus instrumentation not available - metrics endpoint will be disabled")

# ── Sentry Initialization ─────────────────────────────────────────────────────
if settings.sentry_dsn:
    if settings.sentry_dsn.startswith("http"):
        try:
            from sentry_sdk.integrations.asyncio import AsyncioIntegration
            from sentry_sdk.integrations.fastapi import FastApiIntegration

            sentry_init_kwargs = {
                "dsn": settings.sentry_dsn,
                "traces_sample_rate": 0.1,
                "environment": settings.environment,
                "integrations": [FastApiIntegration(), AsyncioIntegration()],
            }
        except ImportError:
            sentry_init_kwargs = {
                "dsn": settings.sentry_dsn,
                "traces_sample_rate": 0.1,
                "environment": settings.environment,
            }
        sentry_sdk.init(**sentry_init_kwargs)
        logger.info("Sentry monitoring enabled")
    elif settings.environment == "production":
        logger.warning("SENTRY_DSN is set but invalid - Sentry not initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ElevateHer API v%s", settings.app_version)

    # Try to create database pool, but don't fail if DB is unavailable
    app.state.db_pool = None
    try:
        # asyncpg.create_pool needs postgresql:// not postgresql+asyncpg://
        _db_dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        app.state.db_pool = await asyncpg.create_pool(
            dsn=_db_dsn,
            min_size=settings.db_pool_min,
            max_size=settings.db_pool_max,
            command_timeout=30,
            statement_cache_size=200,
        )

        async with app.state.db_pool.acquire() as conn:
            db_version = await conn.fetchval("SELECT version()")
            logger.info("Connected to: %s", db_version[:50])
    except Exception:
        logger.warning("Database connection unavailable - some endpoints may return errors")

    # Try to connect to Redis, but don't fail if unavailable
    app.state.redis = None
    try:
        redis_url = settings.redis_url_with_auth or settings.redis_url
        app.state.redis = await aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    except Exception:
        logger.warning("Redis connection unavailable - rate limiting will be disabled")

    # ── Model warm-up ──────────────────────────────────────────────────────────
    # If running in Vercel Serverless, skip heavy ML models to avoid cold-start timeouts
    is_vercel = os.getenv("VERCEL") == "1"

    # Embedding model: SEA-LION-E5-600M via sentence-transformers
    from services.api.services.matching_service import (
        is_embedding_model_available,
        warm_up_embedding_model,
    )

    if not is_vercel:
        try:
            await asyncio.get_running_loop().run_in_executor(None, warm_up_embedding_model)
            if is_embedding_model_available():
                logger.info(
                    "SEA-LION embedding model loaded from: %s",
                    settings.sea_lion_model_path,
                )
            else:
                logger.warning(
                    "Embedding model not available — using deterministic mock vectors. "
                    "Set SEA_LION_MODEL_PATH to enable real embeddings."
                )
        except Exception:
            logger.exception(
                "Embedding model warm-up failed; continuing with deterministic fallback"
            )
    else:
        logger.info("Skipping SEA-LION embedding warm-up (Vercel Serverless detected)")

    # Phi-3: in-process llama-cpp GGUF (no HTTP server required)
    if settings.enable_agentic_layer and not is_vercel:
        try:
            from services.agent.summariser import _get_phi3_llm, is_phi3_model_available

            await asyncio.get_running_loop().run_in_executor(None, _get_phi3_llm)
            if is_phi3_model_available():
                logger.info(
                    "Phi-3 Mini loaded from: %s",
                    settings.agent_model_path,
                )
            else:
                logger.warning(
                    "Phi-3 model not available — agent tasks will fall back to "
                    "Gemini API or default. Set AGENT_MODEL_PATH to enable local inference."
                )
        except Exception:
            logger.exception("Phi-3 warm-up failed; continuing with fallback tiers")
    elif is_vercel:
        logger.info("Skipping Phi-3 warm-up (Vercel Serverless detected), falling back to remote APIs")

    # Safety model: SEA-Guard via transformers pipeline
    if not is_vercel:
        try:
            from services.safety.bio_classifier import is_safety_model_available

            if is_safety_model_available():
                logger.info(
                    "SEA-Guard safety model loaded from: %s",
                    settings.safety_model_path,
                )
            else:
                logger.warning(
                    "SAFETY MODEL UNAVAILABLE — all bios will require manual review. "
                    "Set SAFETY_MODEL_PATH (or SEA_GUARD_MODEL_PATH) to a local model directory."
                )
        except Exception:
            logger.warning("Could not check safety model availability")
    else:
        logger.info("Skipping SEA-Guard safety model warm-up (Vercel Serverless detected)")

    logger.info("ElevateHer API started successfully")
    yield

    # Allow in-flight requests to drain before closing connections
    await asyncio.sleep(5)
    # Close Redis first so in-flight requests can still use it while DB pool drains
    redis = getattr(app.state, "redis", None)
    if redis:
        try:
            await redis.aclose()
        except Exception:
            logger.warning("Redis close error during shutdown")
    db_pool = getattr(app.state, "db_pool", None)
    if db_pool:
        try:
            await db_pool.close()
        except Exception:
            logger.warning("DB pool close error during shutdown")
    logger.info("ElevateHer API shut down cleanly")


def create_app() -> FastAPI:
    _show_docs = True if settings.environment != "production" else settings.debug
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if _show_docs else None,
        redoc_url="/redoc" if _show_docs else None,
        openapi_url="/openapi.json" if _show_docs else None,
        lifespan=lifespan,
    )

    # ── Middleware Stack ─────────────────────────────────────────────────────────
    # NOTE: Starlette add_middleware() uses LIFO order — the LAST registered
    # middleware is the OUTERMOST (first to receive requests, last to send responses).
    # CORS is registered LAST so it is the outermost layer: OPTIONS preflight
    # requests are handled immediately without touching RLS, rate limiting, or DB.
    # Actual request processing order: CORS → Rate Limit → RLS → CSRF → Logging → GZip
    #
    # Registered in reverse (innermost first):

    # 1. GZip (innermost — compresses outgoing responses)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # 2. Structured logging (logs after response is assembled)
    app.add_middleware(StructuredLoggingMiddleware)

    # 3. CSRF protection (runs after CORS validates origin)
    app.add_middleware(CSRFProtectionMiddleware)

    # 4. RLS (sets DB session context from auth token — runs after CORS allows the origin)
    app.add_middleware(RLSMiddleware)

    # 5. Rate limiting (runs before RLS to reject abusive clients early)
    app.add_middleware(RateLimitMiddleware)

    # 6. CORS (outermost — handles preflight OPTIONS before any other middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Accept-Language",
            "Content-Type",
            "Authorization",
            "X-CSRF-Token",
            "X-Requested-With",
            "X-Correlation-ID",
        ],
    )

    # ── Prometheus Metrics Instrumentation ──────────────────────────────────────
    if PROMETHEUS_AVAILABLE and prometheus_instrumentator:
        prometheus_instrumentator.instrument(app)
        logger.info("Prometheus metrics enabled at /metrics")

        @app.get("/metrics", include_in_schema=False)
        async def metrics():
            """Prometheus metrics endpoint."""
            from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
            from starlette.responses import Response

            return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    # ── OpenTelemetry Tracing ──────────────────────────────────────────────────
    if settings.environment == "production":
        try:
            from opentelemetry import trace
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
            from opentelemetry.sdk.resources import RESOURCE_SERVICE_NAME, Resource
            from opentelemetry.sdk.trace import TracerProvider

            resource = Resource(attributes={RESOURCE_SERVICE_NAME: settings.app_name})
            provider = TracerProvider(resource=resource)
            trace.set_tracer_provider(provider)
            FastAPIInstrumentor.instrument_app(app)
            logger.info("OpenTelemetry tracing enabled")
        except ImportError:
            logger.warning("OpenTelemetry not available - tracing disabled")

    # ── Security Headers ─────────────────────────────────────────────────────────
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-API-Version"] = settings.app_version
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Content-Security-Policy removed to allow frontend API access without strict blocks
        return response

    # ── Router Registration ───────────────────────────────────────────────────
    # NOTE: Routers that already declare `prefix="/x"` (impact, dashboard, match, safety)
    # must NOT be re-prefixed here, or the path doubles (e.g. /impact/impact/report/{id}).
    app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    app.include_router(mentee.router, prefix="/mentee", tags=["Mentee"])
    app.include_router(mentor.router, prefix="/mentor", tags=["Mentor"])
    app.include_router(match.router, tags=["Matching"])  # self-prefixed
    app.include_router(match.legacy_router, tags=["Matching"])
    app.include_router(session.router, prefix="/session", tags=["Sessions"])
    app.include_router(ussd.router, prefix="/ussd", tags=["USSD Gateway"])
    app.include_router(ussd.legacy_router, tags=["USSD Gateway"])
    app.include_router(impact.router, tags=["Impact & SDG"])  # self-prefixed
    app.include_router(admin.router, prefix="/admin", tags=["Administration"])
    app.include_router(admin.institution_router, prefix="/admin", tags=["Administration"])
    app.include_router(dashboard.router, tags=["Dashboard"])  # self-prefixed
    app.include_router(privacy.router, prefix="/privacy", tags=["Privacy & GDPR"])
    app.include_router(health.router)
    app.include_router(safety.router, tags=["Safety"])  # self-prefixed

    # ── Exception Handlers ─────────────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": "An unexpected error occurred.",
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "http_error", "message": exc.detail},
        )

    return app


def _get_cors_origins() -> list[str]:
    """
    Get CORS allowed origins based on environment.

    In production/staging, only explicit domains are allowed.
    In development, only localhost dev servers are allowed.
    In test, only localhost is allowed.

    IMPORTANT: When allow_credentials=True, origins must match EXACTLY.
    No wildcards or multiple origins in a single response are allowed.
    """
    # Production domains - should be configured via environment
    production_origins = [
        "https://elevateher.app",
        "https://www.elevateher.app",
        "https://inti.elevateher.app",
        "https://nyp.elevateher.app",
    ]

    # Development origins (localhost only for dev)
    dev_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    if settings.environment == "production":
        return production_origins
    elif settings.environment == "staging":
        return production_origins
    elif settings.environment == "development":
        # In dev, only use localhost origins - never production domains
        return dev_origins
    else:
        # Test environment - minimal set
        return ["http://localhost:3000", "http://localhost:3001"]


app = create_app()
