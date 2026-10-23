import os

from fastapi import APIRouter, Request, Response, status

from services.api.config import get_settings

try:
    from services.agent.summariser import is_phi3_model_available
except ImportError:

    def is_phi3_model_available() -> bool:
        """Mock fallback when agent summariser is unavailable."""
        return False


try:
    from services.api.services.matching_service import is_model_available
except ImportError:

    def is_model_available() -> bool:
        """Mock fallback when matching service is unavailable."""
        return False


try:
    from services.safety.bio_classifier import is_safety_model_available
except ImportError:
    # Fallback import path for when safety module is in different location
    try:
        from safety.bio_classifier import is_safety_model_available
    except ImportError:

        def is_safety_model_available() -> bool:
            """Mock fallback when safety classifier is unavailable."""
            return False


settings = get_settings()

router = APIRouter()


def _runtime_modes() -> dict[str, object]:
    matching_model_available = is_model_available()
    safety_model_available = is_safety_model_available()
    agent_model_available = is_phi3_model_available() if settings.enable_agentic_layer else False

    if matching_model_available:
        matching_mode = "real"
    elif os.environ.get("ENABLE_REMOTE_EMBEDDING_DOWNLOAD") == "1":
        matching_mode = "fallback"
    else:
        matching_mode = "mock"

    # Safety has THREE honest tiers — never claim "real" unless the neural model loaded.
    if safety_model_available and settings.safety_model_path:
        safety_mode = "real"
    elif settings.safety_model_path == "":
        # Regex + threshold ship as default "classifier-only" (no false "real" claim).
        safety_mode = "classifier-only"
    else:
        # Path was set but model failed to load → fall back to manual review.
        safety_mode = "human-review-only"

    if settings.enable_agentic_layer and agent_model_available:
        agent_mode = "local"
    elif os.environ.get("GEMINI_API_KEY"):
        agent_mode = "cloud"
    else:
        agent_mode = "deterministic"

    return {
        "matching_mode": matching_mode,
        "safety_mode": safety_mode,
        "agent_mode": agent_mode,
        "models": {
            "embedding": matching_model_available,
            "safety": safety_model_available,
            "agent": agent_model_available,
        },
        "safety_model_path_configured": bool(settings.safety_model_path),
    }


@router.get("/health")
async def health_check(request: Request, response: Response):
    db_ok = False
    redis_ok = False
    embedding_model_ok = False
    safety_model_ok = False

    pool = getattr(request.app.state, "db_pool", None)
    if pool is not None:
        try:
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_ok = True
        except Exception:
            db_ok = False

    redis_client = getattr(request.app.state, "redis", None)
    if redis_client is not None:
        try:
            await redis_client.ping()
            redis_ok = True
        except Exception:
            redis_ok = False

    try:
        embedding_model_ok = is_model_available()
    except Exception:
        embedding_model_ok = False

    try:
        safety_model_ok = is_safety_model_available()
    except Exception:
        safety_model_ok = False

    runtime = _runtime_modes()

    all_healthy = db_ok and redis_ok
    health_status = "healthy" if all_healthy else "degraded"

    if not all_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": health_status,
        "version": settings.app_version,
        "environment": settings.environment,
        "services": {
            "database": db_ok,
            "redis": redis_ok,
        },
        "models": {
            "embedding": embedding_model_ok,
            "safety": safety_model_ok,
        },
        "runtime": runtime,
    }


@router.get("/status")
async def runtime_status():
    return {
        "version": settings.app_version,
        "environment": settings.environment,
        "runtime": _runtime_modes(),
    }


@router.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "healthy",
    }
