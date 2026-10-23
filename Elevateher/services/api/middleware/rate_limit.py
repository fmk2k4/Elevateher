import logging

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from services.api.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Rate limit window in seconds
_RATE_LIMIT_WINDOW_SECONDS = 60


async def _increment_attempts(redis_client, key: str) -> int:
    """Increment request count across real Redis and lightweight test doubles."""
    if hasattr(redis_client, "incr"):
        return await redis_client.incr(key)

    current = 0
    if hasattr(redis_client, "get"):
        raw = await redis_client.get(key)
        if raw is not None:
            try:
                current = int(raw)
            except (TypeError, ValueError):
                current = 0

    attempts = current + 1
    if hasattr(redis_client, "setex"):
        await redis_client.setex(key, 60, str(attempts))
    elif hasattr(redis_client, "values"):
        redis_client.values[key] = str(attempts)
    elif hasattr(redis_client, "store"):
        redis_client.store[key] = str(attempts)
    return attempts


async def _set_expiry(redis_client, key: str, ttl_seconds: int) -> None:
    if hasattr(redis_client, "expire"):
        await redis_client.expire(key, ttl_seconds)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware with secure IP extraction.

    Extracts client IP from X-Forwarded-For header ONLY if the request
    comes from a trusted proxy. This prevents IP spoofing attacks.

    Trusted proxies are configured via TRUSTED_PROXY_IPS environment variable.
    """

    # Parse trusted proxy IPs once at startup
    _trusted_proxy_ips: frozenset | None = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Parse trusted proxy IPs from config
        if self._trusted_proxy_ips is None:
            proxy_ips = getattr(settings, "trusted_proxy_ips", None)
            if proxy_ips:
                ips = [ip.strip() for ip in proxy_ips.split(",") if ip.strip()]
                RateLimitMiddleware._trusted_proxy_ips = frozenset(ips)
            else:
                # Default: trust only localhost proxies
                RateLimitMiddleware._trusted_proxy_ips = frozenset(
                    {"127.0.0.1", "::1", "localhost"}
                )

    @property
    def trusted_proxy_ips(self) -> frozenset:
        return self._trusted_proxy_ips or frozenset()

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health/docs paths
        if request.url.path in (
            "/health",
            "/",
            "/docs",
            "/openapi.json",
            "/redoc",
        ):
            return await call_next(request)

        # Determine client IP securely
        client_ip = self._get_client_ip(request)
        key = f"rate:{client_ip}:{request.url.path}"

        # Get Redis client
        redis_client = getattr(request.app.state, "redis", None)
        if redis_client is None:
            if settings.environment == "production":
                logger.error(
                    "Redis down - blocking rate-limited request in production"
                )
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": "service_unavailable",
                        "message": "Rate limiting temporarily unavailable. Please try again later.",
                    },
                )
            logger.warning(
                "Redis down - allowing rate-limited request (development)"
            )
            return await call_next(request)

        # Determine rate limit based on endpoint
        limit = self._get_rate_limit(request)

        try:
            # Check rate limit
            attempts = await _increment_attempts(redis_client, key)
            if attempts == 1:
                await _set_expiry(redis_client, key, _RATE_LIMIT_WINDOW_SECONDS)

            if attempts > limit:
                logger.warning(
                    "Rate limit exceeded",
                    extra={
                        "client_ip": client_ip,
                        "path": request.url.path,
                        "attempts": attempts,
                        "limit": limit,
                    },
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limited",
                        "message": "Too many requests. Please slow down.",
                        "retry_after": 60,
                    },
                    headers={"Retry-After": "60"},
                )
        except Exception:
            import traceback

            traceback.print_exc()
            if settings.environment == "production":
                logger.error(
                    "Rate limit check failed - blocking in production",
                    exc_info=True,
                )
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": "service_unavailable",
                        "message": "Rate limiting temporarily unavailable.",
                    },
                )
            logger.warning(
                "Rate limit check failed - allowing request (development)",
                exc_info=True,
            )
            return await call_next(request)

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, respecting trusted proxy configuration.

        Only trusts X-Forwarded-For header if the direct client IP
        is in the trusted proxy list. This prevents IP spoofing.
        """
        # Get the direct client IP (from network connection)
        direct_client = request.client.host if request.client else "unknown"

        # Check if direct client is a trusted proxy
        if direct_client not in self.trusted_proxy_ips:
            # Not from a trusted proxy - use direct client IP (don't trust XFF)
            return direct_client

        # Direct client is a trusted proxy - check X-Forwarded-For
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
            # The leftmost IP is the original client (if from trusted proxy)
            client_ip = forwarded.split(",")[0].strip()
            if client_ip:
                return client_ip

        return direct_client

    def _get_rate_limit(self, request: Request) -> int:
        """Determine rate limit for the current request."""
        path = request.url.path
        if path.startswith("/auth"):
            return settings.rate_limit_auth_per_minute
        if path.startswith("/ussd"):
            return settings.rate_limit_ussd_per_minute
        return settings.rate_limit_api_per_minute
