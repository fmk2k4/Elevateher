"""Integration tests — end-to-end USSD conversation simulation."""

import sys
from pathlib import Path

import pytest

_api_root = str(Path(__file__).resolve().parents[1])
if _api_root not in sys.path:
    sys.path.insert(0, _api_root)
_project_root = str(Path(__file__).resolve().parents[3])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class AsyncRedisMock:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def setex(self, key, ttl, value):
        self.values[key] = value

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.values:
            return False
        self.values[key] = value
        return True

    async def delete(self, key):
        self.values.pop(key, None)


@pytest.mark.asyncio
async def test_ussd_e2e_new_mentee():
    """Full USSD flow for new mentee using mocked Redis."""
    from services.api.routers.ussd import ussd_callback

    redis = AsyncRedisMock()

    def make_req():
        return type(
            "Req",
            (),
            {
                "app": type(
                    "A", (), {"state": type("S", (), {"rls_conn": None, "db_pool": None})()}
                )(),
                "state": type("S", (), {})(),
            },
        )()

    # Step 0: Welcome
    r0 = await ussd_callback(
        request=make_req(),
        session_id="test-e2e-001",
        service_code="*384#",
        phone_number="+60123456789",
        text="",
        redis=redis,
    )
    assert r0.body.decode().startswith("CON")
    assert "ElevateHer" in r0.body.decode()

    # Step 1: New user
    r1 = await ussd_callback(
        request=make_req(),
        session_id="test-e2e-001",
        service_code="*384#",
        phone_number="+60123456789",
        text="1",
        redis=redis,
    )
    assert "language" in r1.body.decode().lower() or "choose" in r1.body.decode().lower()


@pytest.mark.asyncio
async def test_ussd_e2e_malay_flow():
    """USSD flow in Bahasa Melayu — must do step-by-step to build session."""
    from services.api.routers.ussd import ussd_callback

    redis = AsyncRedisMock()

    def make_req():
        return type(
            "Req",
            (),
            {
                "app": type(
                    "A", (), {"state": type("S", (), {"rls_conn": None, "db_pool": None})()}
                )(),
                "state": type("S", (), {})(),
            },
        )()

    # Step 0: Welcome
    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-ms",
        service_code="*384#",
        phone_number="+60111234567",
        text="",
        redis=redis,
    )

    # Step 1: Choose new mentee (option 1)
    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-ms",
        service_code="*384#",
        phone_number="+60111234567",
        text="1",
        redis=redis,
    )

    # Step 2: Choose Bahasa Melayu (option 2)
    r = await ussd_callback(
        request=make_req(),
        session_id="test-e2e-ms",
        service_code="*384#",
        phone_number="+60111234567",
        text="1*2",
        redis=redis,
    )
    text = r.body.decode()
    assert "nama" in text.lower() or "masukkan" in text.lower() or "CON" in text


@pytest.mark.asyncio
async def test_ussd_invalid_input():
    """Invalid USSD input returns error."""
    from services.api.routers.ussd import ussd_callback

    redis = AsyncRedisMock()

    def make_req():
        return type(
            "Req",
            (),
            {
                "app": type(
                    "A", (), {"state": type("S", (), {"rls_conn": None, "db_pool": None})()}
                )(),
                "state": type("S", (), {})(),
            },
        )()

    # Step 0: Welcome (saves session)
    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-err",
        service_code="*384#",
        phone_number="+60123456789",
        text="",
        redis=redis,
    )

    # Step 1: Invalid option
    r = await ussd_callback(
        request=make_req(),
        session_id="test-e2e-err",
        service_code="*384#",
        phone_number="+60123456789",
        text="9",
        redis=redis,
    )
    text = r.body.decode()
    assert text.startswith("CON") or "invalid" in text.lower()


@pytest.mark.asyncio
async def test_ussd_no_match_uses_polished_fallback_message():
    """When no mentor is available, the user should still get a polished shortlist message."""
    from services.api.routers.ussd import ussd_callback

    redis = AsyncRedisMock()

    class FakePool:
        async def acquire(self):
            return self

    class FakeAcquireContext:
        async def __aenter__(self):
            class FakeConn:
                async def fetchrow(self, *_args, **_kwargs):
                    return None

            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePoolWrapper:
        def acquire(self):
            return FakeAcquireContext()

    def make_req():
        return type(
            "Req",
            (),
            {
                "app": type(
                    "A",
                    (),
                    {"state": type("S", (), {"rls_conn": None, "db_pool": FakePoolWrapper()})()},
                )(),
                "state": type("S", (), {})(),
            },
        )()

    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-no-match",
        service_code="*384#",
        phone_number="+60123456789",
        text="",
        redis=redis,
    )
    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-no-match",
        service_code="*384#",
        phone_number="+60123456789",
        text="1",
        redis=redis,
    )
    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-no-match",
        service_code="*384#",
        phone_number="+60123456789",
        text="1*1",
        redis=redis,
    )
    await ussd_callback(
        request=make_req(),
        session_id="test-e2e-no-match",
        service_code="*384#",
        phone_number="+60123456789",
        text="1*1*Aisha",
        redis=redis,
    )
    response = await ussd_callback(
        request=make_req(),
        session_id="test-e2e-no-match",
        service_code="*384#",
        phone_number="+60123456789",
        text="1*1*Aisha*1",
        redis=redis,
    )

    text = response.body.decode()
    assert text.startswith("END")
    assert "shortlist" in text.lower() or "prepared" in text.lower()
    assert "24h" in text.lower() or "24" in text.lower()
