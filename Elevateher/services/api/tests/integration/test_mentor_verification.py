"""Integration tests — mentor verification: upload docs → bio scan → admin approve."""

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_bio_scan_approves_clean_mentor():
    """Clean mentor bio passes scan and is auto-approved (no model)."""
    from services.safety.bio_classifier import scan_bio

    bio = (
        "I am Dr. Sarah Tan, a biomedical engineer with a PhD from NUS. "
        "I have mentored over 50 students in biotechnology research. "
        "My passion is empowering young women to pursue careers in science."
    )
    result = scan_bio(bio)
    assert result.safe_score >= 0.5
    assert "off_platform_solicitation" not in result.flags


@pytest.mark.asyncio
async def test_bio_scan_flags_grooming_language():
    """Mentor bio with grooming patterns is flagged for review."""
    from services.safety.bio_classifier import scan_bio

    bio = (
        "I like to meet girls outside for special private sessions. "
        "Add me on WhatsApp, it will be our secret. "
        "Trust me, don't tell anyone about our arrangement."
    )
    result = scan_bio(bio)
    assert result.approved is False
    assert result.requires_human_review is True


@pytest.mark.asyncio
async def test_bio_scan_malay_off_platform():
    """Malay-language off-platform solicitation is detected."""
    from services.safety.bio_classifier import scan_bio

    bio = (
        "Saya seorang mentor dengan pengalaman 15 tahun dalam bidang teknologi. "
        "Bagi nombor peribadi untuk kita berhubung secara rahsia kita. "
        "Jangan beritahu sesiapa."
    )
    result = scan_bio(bio)
    assert result.requires_human_review is True
    assert "off_platform_solicitation" in result.flags or result.safe_score < 0.75


@pytest.mark.asyncio
async def test_bio_scan_result_serialisation():
    """ScanResult.to_dict produces expected keys."""
    from services.safety.bio_classifier import scan_bio

    result = scan_bio("I am a professional mentor with expertise in data science.")
    d = result.to_dict()
    assert "safe_score" in d
    assert "flags" in d
    assert "approved" in d
    assert "requires_human_review" in d


@pytest.mark.asyncio
async def test_scan_and_store_bio_with_mock_pool():
    """scan_and_store_bio updates DB and returns scan result."""
    import services.safety.bio_classifier as bio_mod
    from services.safety.bio_classifier import scan_and_store_bio

    original = bio_mod._MODEL_AVAILABLE
    bio_mod._MODEL_AVAILABLE = False

    try:
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="UPDATE 1")
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=ctx)

        result = await scan_and_store_bio(
            mock_pool, "user-123", "I mentor young engineers in STEM."
        )
        assert result.safe_score >= 0.0
        mock_conn.execute.assert_called_once()
    finally:
        bio_mod._MODEL_AVAILABLE = original
