"""USSD handler unit tests.

Tests the state machine without hitting the real Infobip callback.
"""

import pytest


def _import_ussd_router():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from services.api.routers import ussd

    return ussd


def _import_ussd_handler():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from services.sms import ussd_handler

    return ussd_handler


class TestUSSDSessionConstants:
    def test_session_ttl(self):
        ussd = _import_ussd_handler()
        assert ussd.USSD_SESSION_TTL == 600

    def test_tracks_complete(self):
        ussd = _import_ussd_handler()
        assert "1" in ussd.TRACKS
        assert ussd.TRACKS["1"] == "STEM"

    def test_languages_complete(self):
        ussd = _import_ussd_handler()
        assert len(ussd.LANGUAGES) >= 4


class TestUSSDSessionHelpers:
    @pytest.mark.asyncio
    async def test_get_session_empty(self):
        ussd = _import_ussd_handler()

        class FakeRedis:
            async def get(self, key):
                return None

        fake_redis = FakeRedis()
        result = await ussd.get_session(fake_redis, "nonexistent")
        assert result == {}

    @pytest.mark.asyncio
    async def test_save_and_get_session(self):
        ussd = _import_ussd_handler()
        stored = {}

        class FakeRedis:
            async def setex(self, key, ttl, value):
                stored[key] = value

            async def get(self, key):
                return stored.get(key)

        await ussd.save_session(FakeRedis(), "sid123", {"name": "Test", "step": 2})
        result = await ussd.get_session(FakeRedis(), "sid123")
        assert result["name"] == "Test"
        assert result["step"] == 2


class TestUSSDStepLogic:
    @pytest.mark.asyncio
    async def test_welcome_and_session_roundtrip(self):
        """Round-trip save/get/save across the helper layer (the standalone
        sms.ussd_handler module). The full callback handler lives in
        services.api.routers.ussd and is exercised via integration tests
        against a live Redis instance.
        """
        ussd = _import_ussd_handler()

        stored = {}

        class FakeRedisGetEmpty:
            async def get(self, key):
                return None

        empty_result = await ussd.get_session(FakeRedisGetEmpty(), "nope")
        assert empty_result == {}

        class FakeRedis:
            async def setex(self, key, ttl, value):
                stored[key] = value

            async def get(self, key):
                return stored.get(key)

        await ussd.save_session(FakeRedis(), "s1", {"welcome": True})
        assert await ussd.get_session(FakeRedis(), "s1") == {"welcome": True}
