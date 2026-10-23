"""Additional safety unit tests — edge cases, Malay/Indonesian patterns, scoring."""

from services.api.services.safety_service import scan_bio, scan_message, scan_text


def test_scan_bio_explicit_grooming():
    """Explicit grooming language in bio is flagged."""
    result = scan_bio(
        "I want to be your special friend. Let's keep this between us. "
        "Add me on WhatsApp for private sessions."
    )
    assert result["approved"] is False
    assert "off_platform_solicitation" in result["flags"]


def test_scan_bio_short_bio_rejected():
    """Very short bio is rejected."""
    result = scan_bio("Hi")
    assert result["approved"] is False


def test_scan_bio_empty_rejected():
    """Empty bio is rejected."""
    result = scan_bio("")
    assert result["approved"] is False


def test_scan_message_isolation_tactics():
    """Isolation language ('only between us', 'don't tell') flagged."""
    result = scan_message("This is our little secret, don't tell your parents about this")
    assert result["approved"] is False
    assert len(result["flags"]) > 0


def test_scan_message_safe_encouragement():
    """Safe mentorship encouragement (review-required without model)."""
    result = scan_message(
        "Great progress on your Python project! " "Keep practicing the exercises we discussed."
    )
    assert "content_hash" in result
    assert len(result["content_hash"]) == 64


def test_scan_message_malay_off_platform():
    """Malay off-platform solicitation is caught by regex."""
    result = scan_message("Bagi WhatsApp awak, kita chat sana")
    assert "off_platform_solicitation" in result["flags"]


def test_scan_message_indonesian_telegram():
    """Indonesian Telegram solicitation is caught."""
    result = scan_message("Chat di Telegram saja ya, lebih private")
    assert "off_platform_solicitation" in result["flags"]


def test_scan_text_whitespace_only():
    """Whitespace-only text is rejected."""
    result = scan_text("   \n\t  ")
    assert result["approved"] is False


def test_scan_bio_content_hash_deterministic():
    """Same bio content produces same content hash."""
    bio = "I am a professional mentor with 10 years of experience in technology and STEM education."
    r1 = scan_bio(bio)
    r2 = scan_bio(bio)
    assert r1["content_hash"] == r2["content_hash"]


def test_scan_bio_different_content_different_hash():
    """Different bio content produces different content hash."""
    r1 = scan_bio("I am an engineer with 5 years experience.")
    r2 = scan_bio("I am a designer with 10 years experience.")
    assert r1["content_hash"] != r2["content_hash"]


def test_scan_message_multiple_off_platform_channels():
    """Message with multiple off-platform channels flagged once."""
    result = scan_message("Add me on WhatsApp, Telegram, and WeChat for private chat")
    assert "off_platform_solicitation" in result["flags"]


def test_scan_bio_gift_language():
    """Bio with gift-giving grooming pattern is flagged."""
    result = scan_bio("I will buy you special gifts if you keep our sessions private")
    assert result["approved"] is False
    assert len(result["flags"]) > 0


def test_scan_message_meet_in_person():
    """Message with offline meeting solicitation flagged."""
    result = scan_message("Let's meet at the cafe after school, just you and me")
    assert result["approved"] is False
