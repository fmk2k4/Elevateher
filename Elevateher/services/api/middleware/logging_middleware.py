"""
Structured Logging Middleware for ElevateHer API.

Provides:
- Correlation ID tracking across request lifecycle
- Structured JSON logging
- Request/response timing metrics
- User context injection

Logs are output in JSON format for easy parsing by log aggregators (ELK, Datadog, etc.)
"""

import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# ── Logging Configuration ───────────────────────────────────────────────────────


# Custom JSON formatter for structured logging
class StructuredLoggingFormatter(logging.Formatter):
    """Outputs logs as JSON with consistent field structure."""

    def format(self, record: logging.LogRecord) -> str:
        import json

        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            # Correlation ID (if present in log record)
            "correlation_id": getattr(record, "correlation_id", None),
            # Request context (if present)
            "method": getattr(record, "method", None),
            "path": getattr(record, "path", None),
            "status_code": getattr(record, "status_code", None),
            "elapsed_ms": getattr(record, "elapsed_ms", None),
            "user_id": getattr(record, "user_id", None),
            # Extra fields
            **getattr(record, "extra_fields", {}),
        }

        # Remove None values for cleaner output
        log_data = {k: v for k, v in log_data.items() if v is not None}

        return json.dumps(log_data)


def setup_structured_logging() -> None:
    """Configure the root logger with structured JSON output."""
    # Get root logger
    root_logger = logging.getLogger()

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Set log level from environment or default to INFO
    log_level = logging.INFO
    root_logger.setLevel(log_level)

    # Add our structured JSON handler
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredLoggingFormatter())
    root_logger.addHandler(handler)

    # Suppress noisy loggers in production
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


# ── Correlation ID Management ─────────────────────────────────────────────────

CORRELATION_ID_HEADER = "X-Correlation-ID"
REQUEST_ID_HEADER = "X-Request-ID"


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for structured logging with correlation IDs.

    Features:
    - Generates or extracts correlation ID for each request
    - Logs request start with correlation ID
    - Logs request completion with timing and status
    - Adds correlation ID to response headers
    - Injects user context when available
    """

    SENSITIVE_PARAMS = {
        "token",
        "key",
        "secret",
        "password",
        "auth",
        "access_token",
        "refresh_token",
        "code",
        "state",
    }

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        from config import get_settings

        self.trusted_proxy_ips = set(get_settings().trusted_proxy_ips.split(","))
        setup_structured_logging()

    async def dispatch(self, request: Request, call_next):
        # Generate or extract correlation ID
        correlation_id = (
            request.headers.get(CORRELATION_ID_HEADER)
            or request.headers.get(REQUEST_ID_HEADER)
            or generate_request_id()
        )

        # Reject oversized client IDs to prevent log injection
        if len(correlation_id) > 64:
            correlation_id = generate_request_id()

        # Store in request state for downstream use
        request.state.correlation_id = correlation_id
        request.state.request_id = correlation_id

        # Get user ID if available (set by RLS middleware)
        user_id = getattr(request.state, "user_id", None)

        # Log request start
        start_time = time.perf_counter()
        logger = logging.getLogger("elevateher.http")
        logger.info(
            "Request started",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "query": (
                    self._redact_query(str(request.query_params)) if request.query_params else None
                ),
                "client_ip": self._get_client_ip(request),
                "user_id": str(user_id) if user_id else None,
                "extra_fields": {
                    "user_agent": request.headers.get("User-Agent"),
                    "referer": request.headers.get("Referer"),
                },
            },
        )

        # Process request
        response = await call_next(request)

        # Calculate elapsed time
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Add correlation ID to response headers
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        response.headers[REQUEST_ID_HEADER] = correlation_id

        # Log request completion
        log_level = logging.INFO if response.status_code < 500 else logging.ERROR
        logger.log(
            log_level,
            "Request completed",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "elapsed_ms": elapsed_ms,
                "user_id": str(user_id) if user_id else None,
            },
        )

        return response

    def _redact_query(self, query_params: str) -> str:
        if not query_params:
            return None
        parts = []
        for param in query_params.split("&"):
            key = param.split("=")[0] if "=" in param else param
            if key.lower() in self.SENSITIVE_PARAMS:
                parts.append(f"{key}=[REDACTED]")
            else:
                parts.append(param)
        return "&".join(parts)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP from request."""
        direct = request.client.host if request.client else None
        if direct and direct in self.trusted_proxy_ips:
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                ip = forwarded.split(",")[0].strip()
                if self._is_valid_ip(ip):
                    return ip
        return direct or "unknown"

    def _is_valid_ip(self, ip: str) -> bool:
        import ipaddress

        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False


def get_correlation_id(request: Request) -> str | None:
    """Get the correlation ID from a request."""
    return getattr(request.state, "correlation_id", None)


def get_logger(name: str = "elevateher") -> logging.Logger:
    """Get a structured logger with the given name."""
    return logging.getLogger(name)
