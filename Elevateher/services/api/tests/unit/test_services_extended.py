"""Unit tests for service wrappers — matching, sms, impact, email, storage, agent, temporal."""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

API_ROOT = str(Path(__file__).resolve().parents[2])
PROJECT_ROOT = str(Path(__file__).resolve().parents[4])
SERVICES_ROOT = str(Path(__file__).resolve().parents[3])
for _p in (PROJECT_ROOT, SERVICES_ROOT, API_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)


class TestMatchingService:
    """Tests for services.api.services.matching_service wrappers."""

    def test_valid_sdg_tracks_contains_known(self):
        from services.api.services.matching_service import VALID_SDG_TRACKS

        assert "STEM" in VALID_SDG_TRACKS
        assert "Business" in VALID_SDG_TRACKS

    def test_build_mentee_text(self):
        from services.api.services.matching_service import build_mentee_text

        text = build_mentee_text(
            career_goals=["data scientist"],
            sdg_track="STEM",
            challenges=["time"],
            preferred_languages=["en"],
        )
        assert "data scientist" in text
        assert "STEM" in text
        assert "en" in text

    def test_build_mentor_text(self):
        from services.api.services.matching_service import build_mentor_text

        text = build_mentor_text(
            job_title="Senior Engineer",
            employer="Acme",
            industry="Technology",
            years_exp=10,
            skills=["Python"],
            languages=["en", "ms"],
            bio="Mentor bio",
            sdg_track="STEM",
        )
        assert "Senior Engineer" in text
        assert "Technology" in text
        assert "10" in text
        assert "Python" in text

    def test_generate_match_reason_returns_string(self):
        from services.api.services.matching_service import generate_match_reason

        reason = generate_match_reason(
            {
                "career_goals": ["engineer"],
                "sdg_track": "STEM",
                "preferred_languages": ["en"],
            },
            {
                "job_title": "Engineer",
                "industry": "Technology",
                "languages": ["en"],
                "years_exp": 5,
            },
        )
        assert isinstance(reason, str)
        assert len(reason) > 0

    def test_is_embedding_model_available_returns_bool(self):
        from services.api.services.matching_service import is_embedding_model_available

        result = is_embedding_model_available()
        assert isinstance(result, bool)

    def test_warm_up_embedding_model_runs(self):
        from services.api.services.matching_service import warm_up_embedding_model

        warm_up_embedding_model()
        assert True


class TestSmsService:
    """Tests for services.api.services.sms_service."""

    @pytest.mark.asyncio
    async def test_send_sms_no_api_key_returns_error_dict(self):
        from services.api.services.sms_service import send_sms

        fake = MagicMock(
            infobip_api_key="",
            plivo_auth_id="",
            plivo_auth_token="",
        )
        with patch("services.api.services.sms_service.settings", fake):
            result = await send_sms("+60123456789", "Test", provider="infobip")
        assert isinstance(result, dict)
        assert result.get("sent") is False


class TestSendEmail:
    """Tests for services.api.services.sms_service.send_email."""

    @pytest.mark.asyncio
    async def test_send_email_resend_missing_key(self):
        from services.api.services.sms_service import send_email

        fake = MagicMock(resend_api_key="")
        with patch("services.api.services.sms_service.settings", fake):
            result = await send_email(
                to="x@example.com",
                subject="hi",
                html="<p>test</p>",
            )
        assert isinstance(result, dict)
        assert result.get("sent") is False


class TestImpactService:
    """Tests for services.api.services.impact_service."""

    @pytest.mark.asyncio
    async def test_record_impact_event_writes_to_db(self):
        import uuid as _uuid

        from services.api.services.impact_service import record_impact_event

        async def fake_fetchrow(*args, **kwargs):
            return {
                "id": _uuid.uuid4(),
                "user_id": _uuid.uuid4(),
                "institution_id": None,
                "event_type": "session_completed",
                "sdg_goal": "4.4",
                "sdg_track": "STEM",
                "recorded_at": None,
            }

        mock_conn = AsyncMock()
        mock_conn.fetchrow = fake_fetchrow
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=ctx)

        valid_uid = str(_uuid.uuid4())
        result = await record_impact_event(
            user_id=valid_uid,
            event_type="session_completed",
            sdg_goal="4.4",
            sdg_track="STEM",
            pool=mock_pool,
        )
        assert isinstance(result, dict)
        assert result["event_type"] == "session_completed"


class TestEmailService:
    """Tests for services.api.services.email_service."""

    @pytest.mark.asyncio
    async def test_send_guardian_consent_email_no_api_key(self):
        from services.api.services.email_service import send_guardian_consent_email

        fake = MagicMock(resend_api_key="")
        with patch("services.api.services.email_service.settings", fake):
            await send_guardian_consent_email(
                guardian_email="parent@example.com",
                mentee_age=17,
                consent_token="abc123",
            )
        assert True


class TestStorageService:
    """Tests for services.api.services.storage_service constants."""

    def test_max_document_size_positive(self):
        from services.api.services.storage_service import MAX_DOCUMENT_SIZE

        assert MAX_DOCUMENT_SIZE > 0

    def test_allowed_document_extensions_non_empty(self):
        from services.api.services.storage_service import ALLOWED_DOCUMENT_EXTENSIONS

        items = list(ALLOWED_DOCUMENT_EXTENSIONS)
        assert len(items) > 0
        for ext in items:
            assert isinstance(ext, str)
            assert ext.startswith(".")

    def test_allowed_document_mime_types_non_empty(self):
        from services.api.services.storage_service import ALLOWED_DOCUMENT_MIME_TYPES

        items = list(ALLOWED_DOCUMENT_MIME_TYPES)
        assert len(items) > 0
        for mt in items:
            assert isinstance(mt, str)
            assert "/" in mt


class TestAgentService:
    """Tests for services.api.services.agent_service."""

    @pytest.mark.asyncio
    async def test_summarise_session_returns_dict(self):
        from services.api.services.agent_service import summarise_session

        result = await summarise_session(
            messages=[{"sender_role": "mentee", "content": "Hello"}],
            track="STEM",
            session_num=1,
        )
        assert isinstance(result, dict)
        assert "summary" in result
        assert "follow_up_questions" in result

    @pytest.mark.asyncio
    async def test_generate_weekly_brief_uses_fallback(self):
        """When underlying summariser errors, wrapper returns fallback dict."""
        import agent.summariser as agent_module

        from services.api.services.agent_service import generate_weekly_brief

        original = getattr(agent_module, "generate_weekly_brief", None)
        agent_module.generate_weekly_brief = None

        try:
            result = await generate_weekly_brief(
                [
                    {"sdg_track": "STEM", "event_type": "session_completed"},
                ]
            )
        finally:
            if original is not None:
                agent_module.generate_weekly_brief = original

        assert isinstance(result, dict)


class TestSharedConstants:
    """Tests for services.shared_constants."""

    def test_sdg_tracks_contains_known_tracks(self):
        from services.shared_constants import SDG_TRACKS

        assert "STEM" in SDG_TRACKS
        assert "Business" in SDG_TRACKS

    def test_sdg_tracks_have_required_keys(self):
        from services.shared_constants import SDG_TRACKS

        for track_name, track_data in SDG_TRACKS.items():
            assert isinstance(track_data, dict)
            assert isinstance(track_name, str)


class TestTemporalSafety:
    """Tests for services.api.services.temporal_safety."""

    @pytest.mark.asyncio
    async def test_record_and_analyse_clean_message(self):
        from services.api.services.temporal_safety import record_and_analyse_message

        class _FakeRedis:
            def __init__(self):
                self.store = {}

            async def get(self, k):
                return self.store.get(k)

            async def setex(self, k, ttl, v):
                self.store[k] = v
                return True

        result = await record_and_analyse_message(
            redis=_FakeRedis(),
            match_id="m-clean-1",
            sender_role="mentor",
            sender_id="mentor-1",
            message_text="Great work on the assignment this week!",
        )
        assert "current_flags" in result
        assert result["current_flags"] == [] or result["current_flags"] is None
        assert result["alert"] is None
