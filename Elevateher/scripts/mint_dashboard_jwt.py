"""Mint a JWT for the dashboard service-to-service caller.

Usage: python scripts/mint_dashboard_jwt.py
Reads JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, DASHBOARD_SERVICE_TOKEN
from .env (repo root) or environment.

Outputs a JWT token to stdout and a one-line .env snippet suggesting updates.
The minted token satisfies both halves of FastAPI auth:
  1. secrets.compare_digest(token, settings.dashboard_service_token)
  2. decode_token() must yield sub=dashboard-service, role=admin

Therefore the token IS the value you should put in DASHBOARD_SERVICE_TOKEN.
"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from jose import jwt

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")

import os  # noqa: E402  (after load_dotenv)


def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def main() -> int:
    secret = _get("JWT_SECRET")
    if not secret:
        print("ERROR: JWT_SECRET is not set in .env or environment.")
        return 1

    algorithm = _get("JWT_ALGORITHM", "HS256") or "HS256"
    if algorithm.startswith("RS"):
        print(
            "ERROR: DASHBOARD_SERVICE_TOKEN must be HS256-signed. "
            f"Got JWT_ALGORITHM={algorithm}."
        )
        return 1

    expire_minutes = int(_get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    now = datetime.now(UTC)
    payload = {
        "sub": "dashboard-service",
        "role": "admin",
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expire_minutes)).timestamp()),
    }

    token = jwt.encode(payload, secret, algorithm=algorithm)

    print("=" * 72)
    print("DASHBOARD_SERVICE_TOKEN (use this exact value in apps/dashboard/.env.local):")
    print()
    print(token)
    print()
    print("=" * 72)
    print(
        "Suggested one-line .env snippet (.env at repo root and "
        "apps/dashboard/.env.local):"
    )
    print()
    print(f"DASHBOARD_SERVICE_TOKEN={token}")
    print()
    print(
        f"Expires in {expire_minutes} minutes. Re-run this script to rotate."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
