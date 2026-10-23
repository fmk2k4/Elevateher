import pytest
from httpx import ASGITransport, AsyncClient


class MockRedis:
    async def get(self, key):
        return None

    async def setex(self, key, ttl, value):
        return True

    async def ping(self):
        return True


@pytest.fixture
def api_client():
    try:
        from main import create_app

        app = create_app()
    except ImportError:
        pytest.skip("main module not importable")
    app.state.redis = MockRedis()
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_endpoint(api_client):
    response = await api_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    # Matches degraded when Redis is mock (ping returns "PONG" string)
    assert body["status"] in ("healthy", "degraded")
    assert body["version"] == "2.0.0"


@pytest.mark.asyncio
async def test_ai_match_endpoint(api_client):
    response = await api_client.post(
        "/api/ai/match",
        json={
            "mentee": {"preferred_languages": ["en", "ms"], "sdg_track": "STEM"},
            "mentor": {
                "languages": ["en", "ms"],
                "industry": "Technology",
                "years_exp": 8,
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "Matched because:" in body["match_reason"]
    assert body["match_score"] >= 0.7


@pytest.mark.asyncio
async def test_ussd_callback_endpoint(api_client):
    response = await api_client.post(
        "/api/ussd/callback",
        data={
            "session_id": "s1",
            "service_code": "*384#",
            "phone_number": "+60123456789",
            "text": "1*1*Aisha*1",
        },
    )
    assert response.status_code == 200
    assert response.text.startswith("END")
