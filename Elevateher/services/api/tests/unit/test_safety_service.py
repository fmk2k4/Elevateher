from services.api.services.safety_service import scan_bio, scan_message, scan_text


def test_normal_bio_requires_human_review_without_model():
    """When the safety model is unavailable the service must require
    human review — never auto-approve. This is the B6 safety-hardening
    contract: denies by default. A real production deployment with the
    SEA-Guard model loaded will return approved=True (see B6 test matrix
    in UPGRADE_PLAN.md)."""
    bio = (
        "I'm a software engineer with 8 years experience in fintech. "
        "I'm passionate about helping young women enter the tech industry. "
        "I mentor 2 hours per week and focus on STEM career pathways."
    )
    result = scan_bio(bio)
    assert result["approved"] is False
    assert "safety_model_unavailable" in result["flags"]
    assert result["requires_human_review"] is True
    assert len(result["content_hash"]) == 64


def test_generic_career_message_requires_human_review():
    result = scan_message(
        "Have you looked at the Python resources I sent you? "
        "The pandas documentation is really helpful."
    )
    assert result["approved"] is False
    assert "safety_model_unavailable" in result["flags"]
    assert len(result["content_hash"]) == 64


def test_short_text_fails():
    result = scan_text("Hi")
    assert result["approved"] is False
    assert "content_too_short" in result["flags"]


def test_grooming_language_flagged():
    result = scan_message("Let's continue this on WhatsApp, it's more private")
    assert result["approved"] is False
    assert result["flags"]


def test_off_platform_pattern_blocked_even_without_model():
    """Pattern-based detection must still work in fallback mode."""
    result = scan_message("I think we should chat on telegram privately — add me there.")
    assert result["approved"] is False
    assert "off_platform_solicitation" in result["flags"]


def test_content_hash_present():
    result = scan_text(
        "Test content for hashing with enough words to pass the bio length threshold."
    )
    assert len(result["content_hash"]) == 64


def test_empty_string():
    result = scan_text("")
    assert result["approved"] is False


def test_malay_grooming_flagged():
    result = scan_message("Bagi nombor peribadi awak, kita boleh whatsapp")
    assert result["flags"]


def test_indonesian_grooming_flagged():
    result = scan_message("Kasih nomor pribadimu, bisa WA langsung")
    assert result["flags"]


def test_isolation_language_flagged():
    result = scan_message("This is just between us, don't tell anyone")
    assert len(result["flags"]) > 0
