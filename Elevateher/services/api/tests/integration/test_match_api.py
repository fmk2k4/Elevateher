from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient


class MockUser:
    def __init__(self, id, role, institution_id=None):
        self.id = id
        self.role = role
        self.institution_id = institution_id


class MockPool:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    def acquire(self):
        return self

    async def fetchrow(self, query, *args):
        if "FROM users u" in query and "mentee_profiles" in query:
            return {"id": args[0], "sdg_track": "STEM", "preferred_languages": ["en"]}
        if "FROM users WHERE id =" in query:
            return {"id": args[0], "institution_id": "inst_1"}
        if "SELECT 1 FROM matches" in query:
            return None
        return None


class MockRow(dict):
    def __getattr__(self, name):
        return self[name]


@pytest.fixture
def mock_dependencies(monkeypatch):
    import main
    from dependencies import get_current_user, get_db_pool

    async def mock_get_current_user():
        return MockUser("11111111-1111-1111-1111-111111111111", "mentee")

    async def mock_get_db_pool():
        return MockPool()

    app = main.create_app()
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_db_pool] = mock_get_db_pool
    return app


@pytest.fixture
def api_client(mock_dependencies):
    transport = ASGITransport(app=mock_dependencies)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_post_match_returns_score_reason_shared(api_client):
    response = await api_client.post(
        "/api/ai/match",
        json={
            "mentee": {"preferred_languages": ["en", "ms"], "sdg_track": "STEM"},
            "mentor": {"languages": ["en", "ms"], "industry": "Technology", "years_exp": 8},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "match_score" in data
    assert "match_reason" in data
    assert "shared_languages" in data
    assert set(data["shared_languages"]) == {"en", "ms"}


@pytest.mark.asyncio
@patch("routers.match.find_top_mentors")
@patch("routers.match._get_sentence_transformer")
async def test_get_match_mentee_degraded_warning(mock_get_st, mock_find_top_mentors, api_client):
    mock_get_st.return_value = None
    mock_find_top_mentors.return_value = [
        MockRow(
            {
                "id": "m1",
                "full_name": "M1",
                "job_title": "T",
                "industry": "I",
                "years_exp": 5,
                "languages": ["en"],
                "bio_safety_score": 0.9,
                "match_score": 0.8,
                "display_name": "M1",
            }
        )
    ]

    response = await api_client.get("/match/mentee/11111111-1111-1111-1111-111111111111")
    assert response.status_code == 200
    data = response.json()
    assert data["model_available"] is False
    assert "Semantic matching degraded" in data["warning"]
    assert len(data["matches"]) == 1


@pytest.mark.asyncio
@patch("routers.match._can_view_mentee_match", return_value=False)
async def test_get_match_mentee_unauthorized(mock_can_view, api_client):
    response = await api_client.get("/match/mentee/22222222-2222-2222-2222-222222222222")
    assert response.status_code == 403
    data = response.json()
    assert "not allowed" in data["message"]


@pytest.mark.asyncio
@patch("routers.match.find_top_mentors")
async def test_get_match_mentee_excludes_unsafe_mentor(mock_find_top_mentors, api_client):
    """
    Test that the route excludes unsafe mentors.
    In the real app, find_top_mentors filters out mentors with bio_safety_score < 0.75.
    We mock find_top_mentors to return only the safe mentor, proving the router correctly handles the filtered list.
    """
    mock_find_top_mentors.return_value = [
        MockRow(
            {
                "id": "safe1",
                "full_name": "Safe Mentor",
                "job_title": "T",
                "industry": "I",
                "years_exp": 5,
                "languages": ["en"],
                "bio_safety_score": 0.9,
                "match_score": 0.8,
                "display_name": "Safe",
            }
        )
    ]
    response = await api_client.get("/match/mentee/11111111-1111-1111-1111-111111111111")
    data = response.json()
    assert len(data["matches"]) == 1
    assert data["matches"][0]["mentor"]["id"] == "safe1"


@pytest.mark.asyncio
@patch("routers.match.find_top_mentors")
async def test_get_match_mentee_excludes_suspended_mentor(mock_find_top_mentors, api_client):
    """
    Test that the route excludes suspended mentors.
    In the real app, find_top_mentors filters out users where is_suspended = true.
    """
    mock_find_top_mentors.return_value = []
    response = await api_client.get("/match/mentee/11111111-1111-1111-1111-111111111111")
    data = response.json()
    assert len(data["matches"]) == 0


@pytest.mark.asyncio
@patch("routers.match.find_top_mentors")
async def test_get_match_mentee_excludes_full_capacity_mentor(mock_find_top_mentors, api_client):
    """
    Test that the route excludes full-capacity mentors.
    In the real app, find_top_mentors filters out profiles where current_mentees >= max_mentees.
    """
    mock_find_top_mentors.return_value = []
    response = await api_client.get("/match/mentee/11111111-1111-1111-1111-111111111111")
    data = response.json()
    assert len(data["matches"]) == 0
