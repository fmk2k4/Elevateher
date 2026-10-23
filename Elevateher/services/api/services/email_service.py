import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_guardian_consent_email(
    guardian_email: str, mentee_age: int, consent_token: str
) -> None:
    if not settings.resend_api_key:
        logger.info("Guardian consent email skipped because RESEND_API_KEY is not configured")
        return

    link = f"https://localhost:3000/account/guardian-consent/{consent_token}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.email_from,
                    "to": guardian_email,
                    "subject": "Confirm ElevateHer guardian consent",
                    "html": (
                        f"<p>Please confirm consent for a "
                        f"{mentee_age}-year-old mentee to use ElevateHer.</p>"
                        f"<p><a href='{link}'>Confirm consent</a></p>"
                    ),
                },
                timeout=10.0,
            )
            response.raise_for_status()
            logger.info("Guardian consent email sent to %s", guardian_email)
    except Exception:
        logger.exception("Failed to send guardian consent email")
