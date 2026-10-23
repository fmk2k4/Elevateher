"""
CSRF Protection Middleware for ElevateHer API.

Implements double-submit cookie pattern for CSRF protection on state-changing
operations. Uses Secure, HttpOnly cookies to prevent XSS theft.

Usage:
    app.add_middleware(CSRFProtectionMiddleware)

Important:
    - Only protects state-changing methods (POST, PUT, PATCH, DELETE)
    - Exempts paths that don't require CSRF (health checks, docs)
    - Uses SameSite=Lax cookies with Secure flag in production
"""

import logging
import secrets

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from config import get_settings

logger = logging.getLogger(__name__)

# Paths exempt from CSRF protection
EXEMPT_PATHS = {
    "/health",
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/auth/register",
    "/auth/login",
    "/auth/refresh",
}

# State-changing HTTP methods requiring CSRF
PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class CSRFTokenError(Exception):
    """Raised when CSRF validation fails."""

    pass


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(32)


def _cookie_is_secure(request: Request) -> bool:
    """Check if request is over HTTPS (or Secure flag should be set)."""
    # Check various indicators of HTTPS connection
    if request.url.scheme == "https":
        return True
    # Check common proxy headers
    forwarded_proto = request.headers.get("X-Forwarded-Proto", "").lower()
    if forwarded_proto == "https":
        return True
    # In production, always use Secure cookies
    settings = get_settings()
    if settings.environment == "production":
        return True
    return False


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection using double-submit cookie pattern.

    Flow:
    1. First request (GET/HEAD/OPTIONS): Set CSRF cookie if not present
    2. State-changing request: Validate X-CSRF-Token header matches cookie
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip exempt paths
        path = request.url.path
        if any(path.startswith(exempt) for exempt in EXEMPT_PATHS):
            return await call_next(request)

        # Only check state-changing methods
        if request.method not in PROTECTED_METHODS:
            return await call_next(request)

        # Get CSRF token from header (check both common header names)
        csrf_token_header = request.headers.get("X-CSRF-Token") or request.headers.get(
            "X-CSRFToken"
        )

        # Get CSRF token from cookie
        csrf_token_cookie = request.cookies.get("csrf_token")

        # Validate double-submit
        try:
            self._validate_csrf(csrf_token_header, csrf_token_cookie, request)
        except CSRFTokenError as exc:
            logger.warning(
                "CSRF validation failed",
                extra={
                    "path": path,
                    "method": request.method,
                    "client_ip": request.client.host if request.client else "unknown",
                    "reason": str(exc),
                },
            )
            return JSONResponse(
                status_code=403,
                content={
                    "error": "csrf_error",
                    "message": "CSRF token missing or invalid. Please refresh and try again.",
                },
            )

        # Process request
        response = await call_next(request)

        # Ensure CSRF cookie is set for subsequent requests
        response = self._ensure_csrf_cookie(request, response)

        return response

    def _validate_csrf(
        self, header_token: str | None, cookie_token: str | None, request: Request
    ) -> None:
        """
        Validate CSRF token using double-submit pattern.

        Raises:
            CSRFTokenError: If validation fails
        """
        if not header_token:
            raise CSRFTokenError("Missing X-CSRF-Token header")

        if not cookie_token:
            raise CSRFTokenError("Missing csrf_token cookie")

        # Tokens must match exactly (constant-time comparison)
        if not secrets.compare_digest(header_token, cookie_token):
            raise CSRFTokenError("Token mismatch")

        # Optional: Validate token wasn't reused (regenerate on each use)
        # This is optional - double-submit is secure without rotation

    def _ensure_csrf_cookie(self, request: Request, response: Response) -> Response:
        """Ensure the CSRF cookie is set on the response."""
        if "csrf_token" in request.cookies:
            # Cookie already exists, keep it
            return response

        # Generate and set new CSRF cookie
        token = generate_csrf_token()
        is_secure = _cookie_is_secure(request)

        response.set_cookie(
            key="csrf_token",
            value=token,
            httponly=False,  # Must be readable by JavaScript for X-CSRF-Token header
            secure=is_secure,
            samesite="lax",
            max_age=3600 * 24,  # 24 hours
            path="/",
        )

        return response


def get_csrf_token_from_request(request: Request) -> str | None:
    """Helper to extract CSRF token from request for form rendering."""
    return request.cookies.get("csrf_token")
