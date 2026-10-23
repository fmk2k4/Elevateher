"""
Safety Service - API wrapper for bio classification and content safety.

This module provides the safety scanning API used by routers and tasks.
"""

import hashlib
import re

# ── Ensure proper import paths ─────────────────────────────────────────────────
# Import the centralized path management FIRST
import services.path  # noqa: F401
from services.safety.bio_classifier import OFF_PLATFORM_PATTERNS, ScanResult  # noqa: E402
from services.safety.bio_classifier import scan_bio as _scan_bio  # noqa: E402


def scan_bio(bio: str) -> dict:
    result: ScanResult = _scan_bio(bio)
    content_hash = hashlib.sha256(bio.encode()).hexdigest()
    return {
        "approved": result.approved,
        "safe_score": result.safe_score,
        "flags": result.flags,
        "requires_human_review": result.requires_human_review,
        "content_hash": content_hash,
    }


def scan_message(message: str) -> dict:
    if not message or len(message.strip()) < 3:
        return {
            "approved": False,
            "safe_score": 0.0,
            "flags": ["message_too_short"],
            "requires_human_review": True,
            "content_hash": hashlib.sha256((message or "").encode()).hexdigest(),
        }

    text_lower = message.lower()
    off_platform_flags = []
    for pattern in OFF_PLATFORM_PATTERNS:
        if re.search(pattern, text_lower):
            off_platform_flags.append("off_platform_solicitation")
            break

    bio = f"Career mentoring message: {message}"
    result = scan_bio(bio)
    if result["safe_score"] == 0.0:
        result["safe_score"] = 0.0
        result["approved"] = False
        result["requires_human_review"] = True
        result["flags"].append("safety_model_unavailable")
    if off_platform_flags and "off_platform_solicitation" not in result["flags"]:
        result["flags"].extend(off_platform_flags)
        result["safe_score"] = min(result["safe_score"], 0.3)
        result["approved"] = False
        result["requires_human_review"] = True
    result["flags"] = sorted(set(result["flags"]))
    result["content_hash"] = hashlib.sha256(message.encode()).hexdigest()
    return result


def scan_text(text: str) -> dict:
    if not text or len(text.strip()) < 3:
        return {
            "approved": False,
            "safe_score": 0.0,
            "flags": ["content_too_short"],
            "requires_human_review": True,
            "content_hash": hashlib.sha256((text or "").encode()).hexdigest(),
        }
    return scan_message(text)
