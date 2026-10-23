import logging

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from services.api.services.auth_service import decode_token
except ImportError:

    def decode_token(token: str) -> dict:
        raise ValueError("auth_service unavailable - JWT validation will fail")


logger = logging.getLogger(__name__)


class RequestConnection:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class RequestConnectionPool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self) -> RequestConnection:
        return RequestConnection(self.conn)


class RLSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        user_id = None
        user_role = "anonymous"
        institution_id = None

        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_token(auth_header[7:])
                user_id = payload.get("sub")
                user_role = payload.get("role", "anonymous") or "anonymous"
                institution_id = payload.get("institution_id")
            except Exception as exc:
                logger.warning("Token decode failed: %s", exc)

        request.state.user_id = user_id
        request.state.user_role = user_role
        request.state.institution_id = institution_id

        pool = getattr(request.app.state, "db_pool", None)
        if not pool:
            return await call_next(request)
        if user_id is None and user_role == "anonymous":
            return await call_next(request)

        async with pool.acquire() as conn:
            request.state.rls_conn = conn
            try:
                await conn.execute("SELECT set_config('app.user_id', $1, false)", user_id or "")
                await conn.execute("SELECT set_config('app.role', $1, false)", user_role)
                await conn.execute(
                    "SELECT set_config('app.institution_id', $1, false)",
                    institution_id or "",
                )
                return await call_next(request)
            finally:
                await conn.execute("SELECT set_config('app.user_id', '', true)")
                await conn.execute("SELECT set_config('app.role', '', true)")
                await conn.execute("SELECT set_config('app.institution_id', '', true)")
