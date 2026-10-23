"""Performance tests — USSD must respond within 10 seconds (network window)."""

import sys
import time
from pathlib import Path

import pytest

_api_root = str(Path(__file__).resolve().parents[1])
if _api_root not in sys.path:
    sys.path.insert(0, _api_root)
_project_root = str(Path(__file__).resolve().parents[3])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class MockRedis:
    async def get(self, key):
        return None

    async def setex(self, key, ttl, value):
        return True


@pytest.mark.asyncio
async def test_ussd_response_time():
    """
    USSD networks have a ~10 second timeout.
    Our handler must respond in under 3 seconds.
    """
    from main import create_app
    from services.api.routers.ussd import ussd_callback

    app = create_app()
    app.state.redis = MockRedis()

    start = time.time()
    # Simulate minimal USSD request
    await ussd_callback(
        request=type("Req", (), {"app": app, "state": type("S", (), {"rls_conn": None})()})(),
        session_id="perf-test-001",
        service_code="*384#",
        phone_number="+60123456789",
        text="",
        redis=MockRedis(),
    )
    duration = time.time() - start

    assert duration < 3.0, f"USSD responded in {duration:.2f}s (limit: 3s)"


@pytest.mark.asyncio
async def test_ussd_response_time_with_redis_mock():
    """USSD handler responds within 3 seconds with Redis mock."""
    redis = MockRedis()
    from services.api.routers.ussd import ussd_callback

    start = time.time()
    result = await ussd_callback(
        request=type("Req", (), {"app": None, "state": type("S", (), {"rls_conn": None})()})(),
        session_id="perf-test-002",
        service_code="*384#",
        phone_number="+60123456789",
        text="",
        redis=redis,
    )
    duration = time.time() - start

    assert result.body.decode().startswith("CON")
    assert duration < 2.0, f"USSD took {duration:.2f}s (limit: 2s for mock)"
