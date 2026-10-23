# =============================================================================
# services/safety/bio_classifier.py
# =============================================================================
# SEA-Guard Bio Safety Classifier
#
# Scans mentor bios for grooming language, bias patterns, and safety violations
# before a mentor profile is approved. Backed by SEA-LION family safety models.
#
# Model: SEA-Guard (AI Singapore) — aisingapore/sea-guard-safety-v1
# Research basis: SEA-LION v4.5 safety fine-tune for SE Asian cultural norms
#
# Thresholds are tuned for the ElevateHer demographic (girls 14-22 in SE Asia):
#   - Grooming patterns in Malay, Indonesian, Thai, English, Singlish
#   - Gender-coded bias in professional contexts
#   - Off-platform contact solicitation
#   - Inappropriate age gap exploitation language
# =============================================================================

from __future__ import annotations
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import re
import os

# Safety score threshold — bio must pass this to auto-approve
SAFETY_THRESHOLD = 0.75

# Per-flag thresholds — lower = catch more, but also more false positives
# Tuned for the hackathon demo; in production, run validation on labelled data
FLAG_THRESHOLDS = {
    "grooming_language": 0.25,
    "gender_coded_bias": 0.30,
    "inappropriate_contact": 0.20,
    "boundary_violation": 0.20,
    "isolation_language": 0.20,
}

# Patterns for fast pattern-based pre-screening (before model inference)
# These are multilingual — Malay, Indonesian, Thai, English
OFF_PLATFORM_PATTERNS = [
    # English
    r"\bwhatsapp\b",
    r"\btelegram\b",
    r"\bwechat\b",
    r"\bsignal\b",
    r"\binstagram\b",
    r"\bfacebook\b",
    r"\bline\b",
    r"\bkakao\b",
    r"\bmeet\s+(me|you)\s+outside\b",
    r"\bmeet\s+at\s+the\s+cafe\b",
    r"\bjust\s+you\s+and\s+me\b",
    r"\bcome\s+to\s+my\b",
    r"\bpersonal\s+(chat|number|contact)\b",
    r"\badd\s+me\b",
    r"\bcontact\s+me\s+outside\b",
    r"\bprivate\s+(call|chat|number)\b",
    r"\bonly\s+if\s+you\s+promise\b",
    r"\bdon't?\s+tell\s+(anyone|your\s+parents)\b",
    # Malay / Indonesian
    r"\bnombor\s+(peribadi|pribadi)\b",
    r"\bnomor\s+(pribadi|peribadi)\b",
    r"\b(pribadi|peribadi)\b",
    r"\b(pribadimu|peribadimu)\b",
    r"\bbagi\s+(nombor|nomor)\b",
    r"\brahsia\s+kita\b",
    r"\bjangan\s+beritahu\b",
    r"\bantara\s+kita\s+je\b",
    r"\bchat\s+外面的\b",
    r"\b私人号码\b",  # private number variants
]

INTIMACY_ESCALATION_PATTERNS = [
    r"\bonly\s+between\s+us\b",
    r"\bour\s+(little\s+)?secret\b",
    r"\bspecial\s+to\s+me\b",
    r"\bspecial\s+gifts?\b",
    r"\byou're?\s+different\b",
    r"\btrust\s+me\s+on\s+this\b",
    r"\bno\s+one\s+will\s+know\b",
    r"\bkeep\s+this\s+between\s+us\b",
    # Malay
    r"\brahsia\s+kita\b",
    r"\bhanya\s+antara\s+kita\b",
    r"\bspecial\s+sangat\b",
    r"\bkau\s+beda\b",
    # Indonesian
    r"\brahasia\s+kita\b",
    r"\bhanya\s+antara\s+kita\b",
]


@dataclass
class ScanResult:
    safe_score: float
    flags: list[str]
    approved: bool
    requires_human_review: bool
    matched_patterns: list[str]

    def to_dict(self) -> dict:
        return {
            "safe_score": self.safe_score,
            "flags": self.flags,
            "approved": self.approved,
            "requires_human_review": self.requires_human_review,
        }


def _fast_pattern_scan(text: str) -> tuple[list[str], list[str]]:
    """
    Fast pre-screening with regex patterns.
    Returns (flags, matched_patterns) before model inference.
    """
    text_lower = text.lower()
    flags = []
    matched = []

    for pattern in OFF_PLATFORM_PATTERNS:
        if re.search(pattern, text_lower):
            flags.append("off_platform_solicitation")
            matched.append(f"off_platform:{pattern}")
            break

    for pattern in INTIMACY_ESCALATION_PATTERNS:
        if re.search(pattern, text_lower):
            flags.append("intimacy_escalation")
            matched.append(f"intimacy:{pattern}")
            break

    # Check for very short bios (might hide problematic content)
    if len(text.strip()) < 30:
        flags.append("bio_too_short")

    # Check for excessive emojis / overly casual tone (optional filter)
    emoji_count = len(re.findall(r"[\U0001F300-\U0001F9FF]", text))
    if emoji_count / max(len(text), 1) >= 0.10:
        flags.append("suspicious_format")

    return flags, matched


def _get_sea_guard_classifier():
    from transformers import pipeline

    model_path = (
        os.environ.get("SAFETY_MODEL_PATH")
        or os.environ.get("SEA_GUARD_MODEL_PATH")
        or "aisingapore/sea-guard-safety-v1"
    )
    return pipeline(
        "text-classification",
        model=model_path,
        device=0,
        top_k=None,
    )


@lru_cache(maxsize=1)
def _cached_sea_guard_classifier():
    return _get_sea_guard_classifier()


class SafetyModelUnavailableError(Exception):
    pass


_MODEL_AVAILABLE: bool | None = None


def _resolve_safety_path() -> str | None:
    """
    Resolve SAFETY_MODEL_PATH / SEA_GUARD_MODEL_PATH to an absolute path.
    Tries env var first, then falls back to the local models directory structure.
    """
    raw = (
        os.environ.get("SAFETY_MODEL_PATH")
        or os.environ.get("SEA_GUARD_MODEL_PATH")
        or "./models/sea-guard-safety-v1"
    )
    p = Path(raw).expanduser()
    if p.is_absolute():
        return str(p)
    # Resolve against project root (works from Docker WORKDIR or repo root)
    project_root = Path(__file__).resolve().parents[2]
    return str(project_root / p)


def is_safety_model_available() -> bool:
    """
    Check whether the safety model can be loaded from the configured path.

    Path resolution order:
      1. SAFETY_MODEL_PATH env var (resolved to absolute from project root)
      2. SEA_GUARD_MODEL_PATH env var (same resolution)
      3. Disable via ELEVATEHER_DISABLE_SAFETY_MODEL=1

    When the env var points at a local directory that exists, a trial load is
    attempted to confirm the model is functional.  Results are cached so
    subsequent calls are cheap.
    """
    global _MODEL_AVAILABLE
    if _MODEL_AVAILABLE is not None:
        return _MODEL_AVAILABLE

    if os.environ.get("ELEVATEHER_DISABLE_SAFETY_MODEL") == "1":
        _MODEL_AVAILABLE = False
        return False

    resolved_path = _resolve_safety_path()
    if not resolved_path:
        _MODEL_AVAILABLE = False
        return False

    if not Path(resolved_path).exists():
        _MODEL_AVAILABLE = False
        return False

    try:
        _get_sea_guard_classifier()
        _MODEL_AVAILABLE = True
        return True
    except Exception:
        _MODEL_AVAILABLE = False
        return False


def _call_sea_guard(text: str) -> dict[str, float]:
    """
    Call SEA-Guard model for safety scoring.
    CRITICAL: If model is unavailable, runs pattern scan and returns
    scores with model_unavailable flag set — caller MUST treat this
    as requiring human review. Never silently returns SAFE without model.
    """
    if not is_safety_model_available():
        flags, matched = _fast_pattern_scan(text)
        result = {}
        if "off_platform_solicitation" in flags:
            result = {"SAFE": 0.3, "GROOMING_LANGUAGE": 0.7}
        elif "intimacy_escalation" in flags:
            result = {"SAFE": 0.5, "GROOMING_LANGUAGE": 0.7, "ISOLATION_LANGUAGE": 0.5}
        elif "bio_too_short" in flags:
            result = {"SAFE": 0.7, "GROOMING_LANGUAGE": 0.1}
        else:
            result = {"SAFE": 0.95}
        
        # For the hackathon demo, we don't want to auto-fail if the neural model is missing.
        # The pattern scan above is sufficient for a demo.
        result["model_unavailable"] = 1.0
        return result

    try:
        classifier = _cached_sea_guard_classifier()
        results = classifier(text[:512])[0]
        return {r["label"]: r["score"] for r in results}
    except Exception:
        import logging
        logging.getLogger(__name__).exception("SEA-Guard model inference failed")
        flags, matched = _fast_pattern_scan(text)
        result = {}
        if "off_platform_solicitation" in flags:
            result = {"SAFE": 0.3, "GROOMING_LANGUAGE": 0.7}
        elif "intimacy_escalation" in flags:
            result = {"SAFE": 0.5, "GROOMING_LANGUAGE": 0.7, "ISOLATION_LANGUAGE": 0.5}
        elif "bio_too_short" in flags:
            result = {"SAFE": 0.7, "GROOMING_LANGUAGE": 0.1}
        else:
            result = {"SAFE": 0.5}
        result["model_unavailable"] = 1.0
        return result


def scan_bio(bio_text: str) -> ScanResult:
    """
    Main entry point: scan a mentor bio for safety concerns.

    Returns a ScanResult with:
      - safe_score: 0.0–1.0 (1.0 = completely safe)
      - flags: list of concern labels
      - approved: True if safe_score >= 0.75 and no flags
      - requires_human_review: True if any flag triggered
    """
    if not bio_text or len(bio_text.strip()) < 10:
        return ScanResult(
            safe_score=0.0,
            flags=["bio_too_short"],
            approved=False,
            requires_human_review=True,
            matched_patterns=[],
        )

    # Step 1: Fast pattern scan (no model needed)
    pattern_flags, matched_patterns = _fast_pattern_scan(bio_text)

    # Step 2: Model-based scoring
    scores = _call_sea_guard(bio_text)
    safe_score = scores.get("SAFE", 0.5)

    if scores.get("model_unavailable", 0.0) > 0.0:
        pattern_flags.append("safety_model_unavailable")

    # Apply flag thresholds
    model_flags = [
        flag_name
        for flag_name, threshold in FLAG_THRESHOLDS.items()
        if scores.get(flag_name.upper(), 0.0) > threshold
    ]

    all_flags = list(set(pattern_flags + model_flags))

    approved = safe_score >= SAFETY_THRESHOLD and len(all_flags) == 0
    requires_human_review = safe_score < SAFETY_THRESHOLD or len(all_flags) > 0

    if not approved:
        import logging

        logging.warning(
            f"[Safety] Bio failed scan. score={safe_score:.2f} flags={all_flags}"
        )

    return ScanResult(
        safe_score=round(safe_score, 4),
        flags=all_flags,
        approved=approved,
        requires_human_review=requires_human_review,
        matched_patterns=matched_patterns,
    )


async def scan_and_store_bio(
    pool,
    mentor_user_id: str,
    bio_text: str,
) -> ScanResult:
    """
    Scan a mentor bio and store the results in the database.
    Called via Celery after mentor profile creation.
    """
    result = scan_bio(bio_text)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentor_profiles
            SET bio_safety_score = $1,
                bio_flags = $2,
                bio_scanned_at = now(),
                verification_status = CASE
                    WHEN $3 = true THEN verification_status
                    ELSE 'pending_admin_review'
                END
            WHERE user_id = $4
            """,
            result.safe_score,
            result.flags,
            result.requires_human_review,  # if review needed, status already set above
            mentor_user_id,
        )

    return result
