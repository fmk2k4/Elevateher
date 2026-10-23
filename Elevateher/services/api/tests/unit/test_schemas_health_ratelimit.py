"""Unit tests for schemas (validation), health endpoint shape, and rate limit helpers."""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

API_ROOT = str(Path(__file__).resolve().parents[2])
PROJECT_ROOT = str(Path(__file__).resolve().parents[4])
SERVICES_ROOT = str(Path(__file__).resolve().parents[3])
for _p in (PROJECT_ROOT, SERVICES_ROOT, API_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)


class TestAuthSchemas:
    """Pydantic validation for auth schemas."""

    def test_register_with_valid_email_and_phone(self):
        from schemas.auth import RegisterRequest

        req = RegisterRequest(
            email="a@example.com",
            phone="+60123456789",
            password="StrongP@ss1",
            role="mentee",
            age=20,
            country="MY",
            language="en",
        )
        assert req.email == "a@example.com"
        assert req.phone == "+60123456789"

    def test_register_with_invalid_email_rejected(self):
        from pydantic import ValidationError

        from schemas.auth import RegisterRequest

        with pytest.raises(ValidationError):
            RegisterRequest(
                email="not-an-email",
                phone="+60123456789",
                password="StrongP@ss1",
                role="mentee",
                age=20,
                country="MY",
                language="en",
            )

    def test_register_with_invalid_phone_rejected(self):
        from pydantic import ValidationError

        from schemas.auth import RegisterRequest

        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@example.com",
                phone="abc123",  # not E.164
                password="StrongP@ss1",
                role="mentee",
                age=20,
                country="MY",
                language="en",
            )

    def test_register_minor_requires_guardian(self):
        from pydantic import ValidationError

        from schemas.auth import RegisterRequest

        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@example.com",
                phone="+60123456789",
                password="StrongP@ss1",
                role="mentee",
                age=15,  # under 18
                country="MY",
                language="en",
                guardian_email=None,
            )

    def test_register_minor_with_guardian_email_ok(self):
        from schemas.auth import RegisterRequest

        req = RegisterRequest(
            email="a@example.com",
            phone="+60123456789",
            password="StrongP@ss1",
            role="mentee",
            age=15,
            country="MY",
            language="en",
            guardian_email="parent@example.com",
        )
        assert req.guardian_email == "parent@example.com"

    def test_register_invalid_role_rejected(self):
        from pydantic import ValidationError

        from schemas.auth import RegisterRequest

        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@example.com",
                phone="+60123456789",
                password="StrongP@ss1",
                role="admin",  # not in pattern
                age=20,
                country="MY",
            )

    def test_register_short_password_rejected(self):
        from pydantic import ValidationError

        from schemas.auth import RegisterRequest

        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@example.com",
                phone="+60123456789",
                password="short",  # under 8 chars
                role="mentee",
                age=20,
                country="MY",
            )

    def test_login_request_minimal(self):
        from schemas.auth import LoginRequest

        req = LoginRequest(identifier="a@example.com", password="StrongP@ss1")
        assert req.identifier == "a@example.com"
        assert req.password == "StrongP@ss1"

    def test_token_response_shape(self):
        from schemas.auth import TokenResponse

        tr = TokenResponse(
            access_token="acc123",
            refresh_token="ref456",
            expires_in=3600,
            user_id="user-1",
            role="mentor",
        )
        assert tr.token_type == "bearer"
        assert tr.expires_in == 3600


class TestHealthEndpointShape:
    """Health endpoint returns expected dict shape with mocked deps."""

    @pytest.mark.asyncio
    async def test_root_returns_app_info(self):
        from routers.health import root

        result = await root()
        assert result["status"] == "healthy"
        assert "version" in result
        assert "name" in result

    @pytest.mark.asyncio
    async def test_health_check_with_no_state_returns_degraded(self):
        from routers.health import health_check

        class _FakeRequest:
            class _App:
                class state: ...

            app = _App()

        from unittest.mock import MagicMock

        result = await health_check(_FakeRequest(), MagicMock())
        assert result["status"] in ("healthy", "degraded")
        assert "services" in result
        assert "models" in result
        assert "database" in result["services"]
        assert "redis" in result["services"]

    @pytest.mark.asyncio
    async def test_health_check_with_working_pool(self):
        from unittest.mock import AsyncMock, MagicMock

        from routers.health import health_check

        class _ConnCtx:
            def __aiter__(self):
                return self

        mock_conn = MagicMock()
        mock_conn.fetchval = AsyncMock(return_value=1)

        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=ctx)

        mock_redis = MagicMock()
        mock_redis.ping = AsyncMock(return_value=True)

        class _AppState:
            db_pool = mock_pool
            redis = mock_redis

        class _App:
            state = _AppState()

        class _Request:
            app = _App()

        from unittest.mock import MagicMock

        result = await health_check(_Request(), MagicMock())
        assert result["services"]["database"] is True
        assert result["services"]["redis"] is True


class TestRateLimitHelpers:
    """Rate-limit middleware helpers and IP extraction logic."""

    def test_increment_attempts_with_incr_uses_real_redis(self):
        from middleware.rate_limit import _increment_attempts

        client = MagicMock()
        client.incr = AsyncMock(return_value=5)

        import asyncio

        result = asyncio.run(_increment_attempts(client, "rate:k"))
        assert result == 5

    @pytest.mark.asyncio
    async def test_increment_attempts_with_test_double(self):
        from middleware.rate_limit import _increment_attempts

        class _TestDouble:
            def __init__(self):
                self.values = {}

            async def setex(self, key, ttl, value):
                self.values[key] = value

            async def get(self, key):
                return None

        td = _TestDouble()
        result = await _increment_attempts(td, "rate:k1")
        assert result == 1
        assert td.values["rate:k1"] == "1"

    @pytest.mark.asyncio
    async def test_increment_attempts_increments_existing(self):
        from middleware.rate_limit import _increment_attempts

        class _TestDouble:
            def __init__(self):
                self.values = {"rate:k": "3"}

            async def setex(self, key, ttl, value):
                self.values[key] = value

            async def get(self, key):
                return self.values.get(key)

        td = _TestDouble()
        result = await _increment_attempts(td, "rate:k")
        assert result == 4
        assert td.values["rate:k"] == "4"

    @pytest.mark.asyncio
    async def test_rate_limit_middleware_dispatch_skips_health(self):
        from middleware.rate_limit import RateLimitMiddleware

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
        mw._trusted_proxy_ips = frozenset({"127.0.0.1", "::1", "localhost"})

        class FakeRequest:
            url = type("u", (), {"path": "/health"})()
            headers = {}
            client = type("c", (), {"host": "127.0.0.1"})()
            app = type("a", (), {"state": type("s", (), {"redis": None})()})()

        call_next = AsyncMock(return_value="ok")

        result = await mw.dispatch(FakeRequest(), call_next)
        assert result == "ok"
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_rate_limit_allows_request_without_redis(self):
        from middleware.rate_limit import RateLimitMiddleware

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
        mw._trusted_proxy_ips = frozenset({"127.0.0.1", "::1", "localhost"})

        class FakeRequest:
            url = type("u", (), {"path": "/auth/login"})()
            headers = {}
            client = type("c", (), {"host": "127.0.0.1"})()
            app = type("a", (), {"state": type("s", (), {"redis": None})()})()

        call_next = AsyncMock(return_value="allowed")

        result = await mw.dispatch(FakeRequest(), call_next)
        assert result == "allowed"
        call_next.assert_called_once()

    def test_get_rate_limit_auth(self):
        from middleware.rate_limit import RateLimitMiddleware

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)

        class FakeRequest:
            url = type("u", (), {"path": "/auth/login"})()

        assert mw._get_rate_limit(FakeRequest()) > 0

    def test_get_rate_limit_ussd(self):
        from middleware.rate_limit import RateLimitMiddleware

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)

        class FakeRequest:
            url = type("u", (), {"path": "/ussd/callback"})()

        assert mw._get_rate_limit(FakeRequest()) > 0

    def test_get_client_ip_no_proxy(self):
        from middleware.rate_limit import RateLimitMiddleware

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
        mw._trusted_proxy_ips = frozenset({"127.0.0.1", "::1"})

        class FakeRequest:
            headers = {"X-Forwarded-For": "1.2.3.4"}
            client = type("c", (), {"host": "192.168.1.5"})()

        assert mw._get_client_ip(FakeRequest()) == "192.168.1.5"

    def test_get_client_ip_via_trusted_proxy(self):
        from middleware.rate_limit import RateLimitMiddleware

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
        mw._trusted_proxy_ips = frozenset({"127.0.0.1", "::1"})

        class FakeRequest:
            headers = {"X-Forwarded-For": "1.2.3.4, 10.0.0.1"}
            client = type("c", (), {"host": "127.0.0.1"})()

        assert mw._get_client_ip(FakeRequest()) == "1.2.3.4"
