from services.safety.bio_classifier import scan_bio


def test_safe_professional_bio_passes():
    from unittest.mock import patch

    with patch("services.safety.bio_classifier._call_sea_guard") as mock_call:
        mock_call.return_value = {"SAFE": 0.95}
        bio = "I am a senior data scientist at Grab with 9 years of experience. I mentor girls interested in Python, data analysis, and ethical AI careers through structured weekly sessions on ElevateHer."
        result = scan_bio(bio)
        assert result.approved is True
        assert "bio_too_short" not in result.flags
        assert "off_platform_solicitation" not in result.flags


def test_short_bio_fails():
    bio = "I help girls."
    result = scan_bio(bio)
    assert result.approved is False
    assert "bio_too_short" in result.flags
    assert result.requires_human_review is True


def test_whatsapp_private_contact_fails():
    bio = "I can help you privately. Add me on WhatsApp and do not tell anyone, this will be only between us."
    result = scan_bio(bio)
    assert result.approved is False
    assert "off_platform_solicitation" in result.flags
    assert result.requires_human_review is True


def test_secret_language_fails():
    bio = "I can mentor you privately. Just keep this between us and don't tell anyone."
    result = scan_bio(bio)
    assert result.approved is False
    assert "intimacy_escalation" in result.flags
    assert result.requires_human_review is True


def test_malay_private_contact_fails():
    bio = "Bagi nomor pribadi kamu, jangan beritahu sesiapa. Rahsia kita sahaja."
    result = scan_bio(bio)
    assert result.approved is False
    assert "off_platform_solicitation" in result.flags or "intimacy_escalation" in result.flags
    assert result.requires_human_review is True


def test_emoji_heavy_bio_flagged():
    bio = "I love mentoring so much! 😍✨💖🦄 Hit me up to learn python 💻🔥💯 Let's goooo! 🚀🎉🥰"
    result = scan_bio(bio)
    assert "suspicious_format" in result.flags
