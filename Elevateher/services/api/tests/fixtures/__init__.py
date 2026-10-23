"""
Test fixtures for ElevateHer — safe/unsafe bios,
USSD conversation trees, and grooming detection patterns.
"""

SAFE_BIOS = [
    {
        "text": "I am a data analyst at a local bank with 5 years of experience.",
        "expected_safe": True,
        "description": "Standard professional bio",
    },
    {
        "text": "Software engineer who loves mentoring girls in tech. 8 years at Grab, Penang.",
        "expected_safe": True,
        "description": "SE Asian professional bio",
    },
    {
        "text": "Teacher at a public secondary school. Specialises in maths and science for girls.",
        "expected_safe": True,
        "description": "Education sector mentor",
    },
]

UNSAFE_BIOS = [
    {
        "text": "I love young girls and want to help them privately in my hotel room.",
        "expected_safe": False,
        "flags": ["inappropriate_contact", "isolation_language"],
    },
    {
        "text": "Looking for fun chats with teen girls. Let's move to WhatsApp for privacy.",
        "expected_safe": False,
        "flags": ["off_platform_solicitation", "isolation_language"],
    },
    {
        "text": (
            "Mature professional seeking casual meetings "
            "outside the platform with young mentees."
        ),
        "expected_safe": False,
        "flags": ["inappropriate_contact", "boundary_violation"],
    },
]

BORDERLINE_BIOS = [
    {
        "text": "I enjoy chatting with young people. Message me on Telegram for career tips.",
        "expected_safe": False,
        "flags": ["off_platform_solicitation"],
    },
    {
        "text": "You can trust me completely. Don't tell your parents about our sessions.",
        "expected_safe": False,
        "flags": ["isolation_language", "boundary_violation"],
    },
]

USSD_CONVERSATIONS_NEW_MENTEE = [
    {
        "name": "English new mentee",
        "inputs": ["1", "1", "Siti", "1"],
        "expected_final": "CON Hi Siti! What career interests you?",
    },
    {
        "name": "Malay new mentee",
        "inputs": ["1", "2", "Aisha", "2"],
        "expected_final": "CON Hai Aisha! Minat kerjaya apa?",
    },
    {
        "name": "Indonesian new mentee",
        "inputs": ["1", "3", "Dewi", "3"],
        "expected_final": "CON Halo Dewi! Minat karir apa?",
    },
    {
        "name": "Thai new mentee",
        "inputs": ["1", "4", "พร", "4"],
        "expected_final": "CON สวัสดี พร! สนใจอะไร?",
    },
]

USSD_CONVERSATIONS_RETURNING = [
    {
        "name": "Returning user",
        "inputs": ["2", "60191234567"],
        "expected_final": "END Welcome back.",
    }
]

GROOMING_PATTERNS = [
    {
        "text": "Don't tell anyone about our chats, our secret.",
        "expected_flags": ["intimacy_escalation"],
        "severity": "medium",
    },
    {
        "text": "You're special to me, different from the other girls.",
        "expected_flags": ["intimacy_escalation"],
        "severity": "medium",
    },
    {
        "text": "Add me on WhatsApp: +60191234567",
        "expected_flags": ["off_platform_solicitation"],
        "severity": "high",
    },
    {
        "text": "Let's move to Telegram for more private talks.",
        "expected_flags": ["off_platform_solicitation", "isolation_language"],
        "severity": "high",
    },
    {
        "text": "What's your personal number? I want to call you.",
        "expected_flags": ["off_platform_solicitation"],
        "severity": "high",
    },
    {
        "text": "Just between us, don't tell your parents.",
        "expected_flags": ["intimacy_escalation", "isolation_language"],
        "severity": "high",
    },
    {
        "text": "Kita jangan bagitahu orang tua tau, rahsia kita je.",
        "expected_flags": ["intimacy_escalation", "isolation_language"],
        "severity": "high",
    },
    {
        "text": "Our next session will be at the usual time.",
        "expected_flags": [],
        "severity": "none",
    },
]
