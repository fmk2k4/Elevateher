"""
ElevateHer Authentication Service

Provides JWT-based authentication using RS256 (asymmetric) for production security.
Password hashing uses bcrypt directly (bypasses passlib which is incompatible with bcrypt 5.x).

Production requires:
- JWT_SECRET should be a 256-bit random string (32 bytes base64-encoded)
- For RS256, set RSA_PRIVATE_KEY and RSA_PUBLIC_KEY env vars
- Falls back to HS256 only if JWT_SECRET is set and no RSA keys configured
"""

from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Always secure, never falls back."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        # Bcrypt errors should not silently pass - log and reject
        import logging

        logging.getLogger(__name__).error("Password verification failed due to hashing error")
        return False


# ── JWT Configuration ─────────────────────────────────────────────────────────

# RSA key configuration (preferred for production)
RSA_PRIVATE_KEY: str | None = None
RSA_PUBLIC_KEY: str | None = None

# Load RSA keys from environment if available
_private_key_env = settings.jwt_secret
_public_key_env = settings.jwt_public_key

if (
    _private_key_env
    and "BEGIN" in _private_key_env
    and _public_key_env
    and "BEGIN" in _public_key_env
):
    RSA_PRIVATE_KEY = _private_key_env
    RSA_PUBLIC_KEY = _public_key_env
elif _private_key_env and len(_private_key_env) >= 32:
    # If jwt_secret is a raw 256-bit key, use it for HS256 (less secure)
    pass  # Will use HS256 below


def _get_jwt_algorithm() -> str:
    """Determine JWT algorithm based on key configuration."""
    if RSA_PRIVATE_KEY and RSA_PUBLIC_KEY:
        return "RS256"
    return "HS256"  # Fallback - still secure with strong secret


def create_access_token(user_id: str, role: str, institution_id: str | None = None) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(UTC)
    exp = int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp())

    payload = {
        "sub": user_id,
        "role": role,
        "institution_id": institution_id,
        "type": "access",
        "exp": exp,
        "iat": int(now.timestamp()),
    }

    algorithm = _get_jwt_algorithm()

    if algorithm == "RS256":
        # Use asymmetric RS256 for production
        token = jwt.encode(payload, RSA_PRIVATE_KEY, algorithm="RS256")
    else:
        # Fallback to symmetric HS256
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

    return token


def create_refresh_token(user_id: str) -> str:
    """Create a signed JWT refresh token."""
    now = datetime.now(UTC)
    exp = int((now + timedelta(days=settings.refresh_token_expire_days)).timestamp())

    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": exp,
        "iat": int(now.timestamp()),
    }

    algorithm = _get_jwt_algorithm()

    if algorithm == "RS256":
        token = jwt.encode(payload, RSA_PRIVATE_KEY, algorithm="RS256")
    else:
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

    return token


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token.

    Validates:
    - Signature (RS256 or HS256 based on configuration)
    - Expiration
    - Token type

    Returns:
        dict: The decoded JWT payload

    Raises:
        ValueError: If token is invalid, expired, or wrong type
    """
    algorithm = _get_jwt_algorithm()

    try:
        if algorithm == "RS256":
            payload = jwt.decode(
                token,
                RSA_PUBLIC_KEY,
                algorithms=["RS256"],
                options={"require_sub": True, "require_exp": True},
            )
        else:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                options={"require_sub": True, "require_exp": True},
            )

    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc

    # Validate token type
    if payload.get("type") not in ("access", "refresh", "service"):
        raise ValueError("Invalid token type")

    return payload
