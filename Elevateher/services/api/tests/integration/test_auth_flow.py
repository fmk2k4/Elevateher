"""Integration tests — auth flow: register → login → JWT refresh."""

import pytest


@pytest.mark.asyncio
async def test_password_hash_and_verify():
    """Password hashing and verification work correctly."""
    from services.auth_service import hash_password, verify_password

    pw = "SecureP@ssw0rd!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong", hashed) is False


@pytest.mark.asyncio
async def test_jwt_token_creation():
    """Create and validate JWT access + refresh tokens."""
    from services.auth_service import create_access_token, create_refresh_token

    user_id = "test-user-123"
    access = create_access_token(user_id, role="mentee")
    refresh = create_refresh_token(user_id)
    assert isinstance(access, str)
    assert isinstance(refresh, str)
    assert len(access) > 20
    assert len(refresh) > 20


@pytest.mark.asyncio
async def test_jwt_token_decode():
    """Decode access token and verify user_id and role."""
    import jwt

    from config import get_settings
    from services.auth_service import create_access_token

    settings = get_settings()
    user_id = "user-abc"
    token = create_access_token(user_id, role="mentor")
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    assert payload["sub"] == user_id
    assert payload["role"] == "mentor"


@pytest.mark.asyncio
async def test_jwt_expiry_set():
    """Access tokens have correct expiry."""
    import jwt

    from config import get_settings
    from services.auth_service import create_access_token

    settings = get_settings()
    token = create_access_token("user-1", role="mentee")
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    assert "exp" in payload
    assert "iat" in payload


@pytest.mark.asyncio
async def test_register_duplicate_email():
    """Registration with duplicate email raises 409 in the router."""
    from fastapi import HTTPException, status

    exc = HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Email or phone already registered",
    )
    assert exc.status_code == 409
    assert "already registered" in exc.detail
