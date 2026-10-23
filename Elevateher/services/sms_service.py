# Re-export SMS service functions from the API layer
from services.api.services.sms_service import send_sms, send_email  # noqa: F401

__all__ = ["send_sms", "send_email"]
