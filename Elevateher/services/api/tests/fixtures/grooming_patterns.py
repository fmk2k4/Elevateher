"""Grooming pattern test messages for temporal detector."""

# Multilingual grooming patterns for testing temporal_detector
# Each pattern triggers specific risk flags

GROOMING_TEST_CASES = [
    # English off-platform patterns
    {
        "text": "Let's continue this on WhatsApp, it's more private",
        "expected_flags": ["off_platform_attempt"],
        "expected_risk_min": 0.4,
    },
    {
        "text": "Add me on Telegram for faster replies",
        "expected_flags": ["off_platform_attempt"],
        "expected_risk_min": 0.4,
    },
    {
        "text": "Share your personal number with me",
        "expected_flags": ["off_platform_attempt"],
        "expected_risk_min": 0.4,
    },
    # Malay patterns
    {
        "text": "Bagi nombor peribadi kamu, saya nak kenal kamu lebih rapat",
        "expected_flags": ["off_platform_attempt"],
        "expected_risk_min": 0.4,
    },
    {
        "text": "Raahsia kita, jangan bagitahu siapa-siapa",
        "expected_flags": ["intimacy_escalation"],
        "expected_risk_min": 0.2,
    },
    # Indonesian patterns
    {
        "text": "Kita chat di luar saja, lebih enak",
        "expected_flags": ["off_platform_attempt"],
        "expected_risk_min": 0.4,
    },
    {
        "text": "Ini rahasia kita, antara kita saja",
        "expected_flags": ["intimacy_escalation"],
        "expected_risk_min": 0.2,
    },
    # Thai patterns
    {
        "text": "คุยนอกๆ ดีกว่า",
        "expected_flags": ["off_platform_attempt"],
        "expected_risk_min": 0.4,
    },
    # Safe messages (should not trigger flags)
    {
        "text": "Great work on your Python project. See you next week!",
        "expected_flags": [],
        "expected_risk_min": 0.0,
    },
    {
        "text": "I'm proud of your progress. Keep going!",
        "expected_flags": [],
        "expected_risk_min": 0.0,
    },
]

MULTILINGUAL_INTIMACY_PATTERNS = [
    "only between us",
    "our secret",
    "you're special to me",
    "rahsia kita",
    "rahasia kita",
    "hanya antara kita",
]
