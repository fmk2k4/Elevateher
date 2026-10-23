"""USSD conversation trees for end-to-end USSD handler tests."""

# Conversation flows by language
USSD_CONVERSATION_FLOWS = {  # noqa: E501
    "en": [  # noqa: E501
        (
            "",
            "CON Welcome to ElevateHer\nCareer mentorship for girls\n1. I'm a new mentee\n2. Returning user\n3. I'm a mentor",
        ),  # noqa: E501
        (
            "1",
            "CON Choose language:\n1. English\n2. Bahasa Melayu\n3. Bahasa Indonesia\n4. Thai\n5. Japanese",
        ),  # noqa: E501
        ("1*1", "CON Enter your first name:"),
        (
            "1*1*Aisha",
            "CON Hi Aisha! What career interests you?\n1. STEM\n2. Business\n3. Trades\n4. Creative",
        ),  # noqa: E501
        ("1*1*Aisha*1", "END Mentor found:"),
    ],
    "ms": [
        ("", "CON Welcome to ElevateHer\nCareer mentorship for girls"),
        ("1", "CON Choose language:"),
        ("1*2", "CON Masukkan nama anda:"),
        ("1*2*Aisha", "CON Hai Aisha! Minat kerjaya apa?"),
    ],
    "id": [
        ("", "CON Welcome to ElevateHer"),
        ("1*3", "CON Masukkan nama kamu:"),
        ("1*3*Siti", "CON Halo Siti! Minat karir apa?"),
    ],
}

# Expected field names in session data
USSD_SESSION_FIELDS = [
    "phone",
    "lang",
    "name",
    "track",
    "step",
]

# Test data for USSD validation
USSD_TEST_DATA = {
    "valid_session_id": "test-session-001",
    "valid_phone": "+60123456789",
    "valid_service_code": "*384#",
    "track_selections": {"1": "STEM", "2": "Business", "3": "Trades", "4": "Creative"},
    "language_selections": {"1": "en", "2": "ms", "3": "id", "4": "th", "5": "ja"},
}
