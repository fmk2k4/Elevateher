"""Mentor bios — safe and unsafe examples for safety classifier tests."""

SAFE_MENTOR_BIOS = [  # noqa: E501
    "I'm a senior software engineer at Grab with 8 years experience building backend systems. I grew up in Penang and studied Computer Science at UTM. I'm passionate about helping young women enter the tech industry through mentorship.",  # noqa: E501
    "Product Manager at Tokopedia with 5 years in e-commerce. I transitioned from engineering into product and understand both sides. I love working with young women who want to break into tech business roles.",  # noqa: E501
    "Civil engineer with 10 years experience in infrastructure projects across Southeast Asia. I was the only woman in my university course and want to change that for the next generation.",  # noqa: E501
]

UNSAFE_MENTOR_BIOS = [
    "Let's chat privately on WhatsApp, it's more fun there. I have a special connection with you.",
    "Add me on Telegram for personal tutoring. Your parents don't need to know.",
    "I can help you with special attention if you share your private photos with me.",
    "Let me be your secret friend. We can meet outside the app.",
    "Bagikan nombor peribadi kamu, kita yang kenal lebih rapat.",
    "Chat di luar saja, lebih enak. Raahsia kita.",
]

BIAS_PATTERNS = [
    "Women shouldn't be in engineering, it's not natural for them.",
    "Girls are better at supportive roles, not technical work.",
    "You should focus on finding a husband instead of studying.",
]

# Test cases combining biographical data with expected outcomes
BIO_TEST_CASES = [  # noqa: E501
    {"bio": SAFE_MENTOR_BIOS[0], "expected_approved": True, "expected_safe_min": 0.75},  # noqa: E501
    {
        "bio": UNSAFE_MENTOR_BIOS[0],
        "expected_approved": False,
        "expected_flags": ["off_platform_solicitation"],
    },  # noqa: E501
    {
        "bio": UNSAFE_MENTOR_BIOS[1],
        "expected_approved": False,
        "expected_flags": ["off_platform_solicitation"],
    },  # noqa: E501
    {"bio": BIAS_PATTERNS[0], "expected_approved": False, "expected_flags": ["gender_coded_bias"]},  # noqa: E501
]
