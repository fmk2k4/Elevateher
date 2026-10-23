"""
SMS and Email Service for ElevateHer.

Provides unified SMS sending via Infobip (primary) and Plivo (fallback),
and email sending via Resend.

All external API calls include retry logic with exponential backoff
to handle transient failures gracefully.
"""

import logging

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _mask_phone(phone: str) -> str:
    """Mask phone number for logging - shows first 3 and last 2 digits only."""
    if not phone:
        return "unknown"
    if len(phone) <= 5:
        return "*" * len(phone)
    return phone[:3] + "*" * (len(phone) - 5) + phone[-2:]


# ── Retry Configuration ───────────────────────────────────────────────────────

# HTTP status codes that should trigger a retry
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# Maximum retries for transient failures
MAX_RETRIES = 3


def _is_retryable_http_error(exception: Exception) -> bool:
    """Check if an HTTP error is retryable."""
    if isinstance(exception, httpx.TimeoutException):
        return True
    if isinstance(exception, httpx.NetworkError):
        return True
    if isinstance(exception, httpx.HTTPStatusError):
        return exception.response.status_code in RETRYABLE_STATUS_CODES
    return False


# ── Infobip SMS ────────────────────────────────────────────────────────────────


async def _send_sms_infobip_internal(
    phone_number: str,
    message: str,
    sender_id: str | None = None,
) -> dict:
    """
    Internal implementation of Infobip SMS send.
    Does not include retry logic - retry wrapper handles that.
    """
    api_key = settings.infobip_api_key
    base_url = settings.infobip_base_url.rstrip("/")
    sender = sender_id or settings.infobip_sender_id or "ElevateHer"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/sms/2/text/advanced",
            headers={
                "Authorization": f"App {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "messages": [
                    {
                        "from": sender,
                        "destinations": [{"to": phone_number}],
                        "text": message,
                    }
                ]
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return {
            "sent": True,
            "phone_number": phone_number,
            "message": message,
            "provider": "infobip",
            "response": response.json(),
        }


async def send_sms_via_infobip(
    phone_number: str,
    message: str,
    sender_id: str | None = None,
) -> dict:
    """
    Send SMS via Infobip (SE Asia primary gateway).
    Returns API response or error dict.
    Includes retry logic for transient failures.
    """
    api_key = settings.infobip_api_key

    if not api_key:
        return {
            "sent": False,
            "phone_number": phone_number,
            "message": message,
            "provider": "infobip",
            "reason": "INFOBIP_API_KEY not configured",
        }

    try:
        # Use tenacity retry wrapper
        result = await _send_sms_infobip_with_retry(
            phone_number=phone_number,
            message=message,
            sender_id=sender_id,
        )
        return result
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Infobip HTTP error",
            extra={
                "provider": "infobip",
                "status_code": exc.response.status_code,
            },
        )
        return {
            "sent": False,
            "provider": "infobip",
            "reason": f"HTTP {exc.response.status_code}",
            "error": str(exc),
        }
    except Exception as exc:
        logger.exception("Infobip unexpected error", extra={"provider": "infobip"})
        return {
            "sent": False,
            "provider": "infobip",
            "reason": "unexpected_error",
            "error": str(exc),
        }


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True,
)
async def _send_sms_infobip_with_retry(
    phone_number: str,
    message: str,
    sender_id: str | None = None,
) -> dict:
    """Infobip SMS send with exponential backoff retry."""
    return await _send_sms_infobip_internal(phone_number, message, sender_id)


# ── Plivo SMS (Fallback) ──────────────────────────────────────────────────────


async def _send_sms_plivo_internal(phone_number: str, message: str) -> dict:
    """
    Internal implementation of Plivo SMS send (synchronous SDK wrapped in thread).
    Does not include retry logic - retry wrapper handles that.
    """
    import plivo

    auth_id = settings.plivo_auth_id
    auth_token = settings.plivo_auth_token
    client = plivo.RestClient(auth_id=auth_id, auth_token=auth_token)
    result = client.messages.create(
        src=settings.infobip_sender_id or "ElevateHer",
        dst=phone_number,
        text=message,
    )
    return {
        "sent": True,
        "provider": "plivo",
        "message_uuid": result.message_uuid,
    }


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True,
)
async def _send_sms_plivo_with_retry(phone_number: str, message: str) -> dict:
    """Plivo SMS send with exponential backoff retry."""
    import asyncio

    return await asyncio.to_thread(_send_sms_plivo_internal, phone_number, message)


async def send_sms_via_plivo(phone_number: str, message: str) -> dict:
    """
    Send SMS via Plivo (Indonesia cost-optimised fallback).
    """
    auth_id = settings.plivo_auth_id
    auth_token = settings.plivo_auth_token

    if not auth_id or not auth_token:
        return {
            "sent": False,
            "phone_number": phone_number,
            "message": message,
            "provider": "plivo",
            "reason": "PLIVO_AUTH_ID/PLIVO_AUTH_TOKEN not configured",
        }

    try:
        result = await _send_sms_plivo_with_retry(phone_number, message)
        return result
    except Exception as exc:
        logger.warning("Plivo send failed", extra={"provider": "plivo", "error": str(exc)})
        return {
            "sent": False,
            "provider": "plivo",
            "error": str(exc),
        }


# ── Unified SMS Send ───────────────────────────────────────────────────────────


async def send_sms(
    phone_number: str,
    message: str,
    provider: str | None = "infobip",
) -> dict:
    """
    Unified SMS send function. Tries primary (Infobip), falls back to Plivo.
    Returns a result dict. Never raises — returns error info instead.
    """
    if provider == "plivo":
        return await send_sms_via_plivo(phone_number, message)

    result = await send_sms_via_infobip(phone_number, message)
    if not result.get("sent") and result.get("reason", "").startswith("INFOBIP"):
        # Infobip failed with a transient error, try Plivo
        return await send_sms_via_plivo(phone_number, message)
    return result


# ── Email via Resend ────────────────────────────────────────────────────────────


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True,
)
async def _send_email_resend_with_retry(
    to: str,
    subject: str,
    html: str,
) -> dict:
    """Resend email send with exponential backoff retry."""
    api_key = settings.resend_api_key

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.email_from,
                "to": to,
                "subject": subject,
                "html": html,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return {
            "sent": True,
            "to": to,
            "subject": subject,
            "provider": "resend",
            "response": response.json(),
        }


async def send_email(to: str, subject: str, html: str) -> dict:
    """
    Send email via Resend. Falls back to no-op if not configured.
    Includes retry logic for transient failures.
    """
    api_key = settings.resend_api_key
    if not api_key:
        return {
            "sent": False,
            "to": to,
            "subject": subject,
            "provider": "dry-run",
            "reason": "RESEND_API_KEY not configured",
        }

    try:
        result = await _send_email_resend_with_retry(to, subject, html)
        return result
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Resend HTTP error",
            extra={
                "status_code": exc.response.status_code,
                "to": to,
                "subject": subject,
            },
        )
        return {
            "sent": False,
            "to": to,
            "subject": subject,
            "provider": "resend",
            "reason": f"HTTP {exc.response.status_code}",
            "error": str(exc),
        }
    except Exception as exc:
        logger.exception("Resend unexpected error", extra={"to": to, "subject": subject})
        return {
            "sent": False,
            "to": to,
            "subject": subject,
            "provider": "resend",
            "error": str(exc),
        }
