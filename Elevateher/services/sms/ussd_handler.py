"""
ElevateHer USSD Handler — Redis-backed, production-safe.

Handles Infobip USSD callbacks for:
  - New mentee registration (step-by-step)
  - Returning user lookup
  - Mentor portal redirect
  - Multi-language: EN / MS / ID / TH / JA

Response format: plain text starting with CON (continue) or END (terminate).
Network window: max 10 seconds.
Session TTL: 600 seconds (10 min).
"""

import json
from typing import Any

import redis.asyncio as aioredis

USSD_SESSION_TTL = 600  # 10 minutes
TRACKS = {"1": "STEM", "2": "Business", "3": "Trades", "4": "Creative"}
LANGUAGES = {"1": "en", "2": "ms", "3": "id", "4": "th", "5": "ja"}


async def get_session(redis: aioredis.Redis, session_id: str) -> dict[str, Any]:
    raw = await redis.get(f"ussd:session:{session_id}")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def save_session(
    redis: aioredis.Redis, session_id: str, data: dict[str, Any]
) -> None:
    await redis.setex(f"ussd:session:{session_id}", USSD_SESSION_TTL, json.dumps(data))


async def get_dialog_session(redis, session_id: str) -> dict[str, Any]:
    raw = await redis.get(f"ussd_dialog:{session_id}")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def save_dialog_session(redis, session_id: str, data: dict[str, Any]) -> None:
    await redis.setex(f"ussd_dialog:{session_id}", USSD_SESSION_TTL, json.dumps(data))


async def get_context_key(
    redis, session_id: str, context: str
) -> dict[str, Any]:
    raw = await redis.get(f"ussd_context:{session_id}:{context}")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def save_context_key(
    redis,
    session_id: str,
    context: str,
    data: dict[str, Any],
    ttl: int = 172800,
):
    await redis.setex(
        f"ussd_context:{session_id}:{context}", ttl, json.dumps(data)
    )


# Re-export helpers so routers/ussd.py can import from here if needed.
__all__ = [
    "USSD_SESSION_TTL",
    "TRACKS",
    "LANGUAGES",
    "get_session",
    "save_session",
]
