from importlib import import_module
import sys
from pathlib import Path

_sms_service = (
    Path(__file__).resolve().parent.parent / "api" / "services" / "sms_service.py"
)
if str(_sms_service.parent) not in sys.path:
    sys.path.insert(0, str(_sms_service.parent))

_send_sms = import_module("sms_service").send_sms
send_email = import_module("sms_service").send_email
send_sms = _send_sms

__all__ = ["send_email", "send_sms"]
