import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_model_path(path: str) -> str:
    """Resolve a possibly-relative model path against PROJECT_ROOT."""
    _project_root = Path(__file__).resolve().parents[2]

    p = Path(path).expanduser()
    if p.is_absolute():
        return str(p)
    return str(_project_root / p)


from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    app_name: str = "ElevateHer API"
    app_version: str = "2.0.0"
    environment: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = False

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = "postgresql://postgres:password@localhost:5432/elevateher"
    database_url_sync: str = "postgresql://postgres:password@localhost:5432/elevateher"
    db_pool_min: int = 5
    db_pool_max: int = 20

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"
    redis_url_with_auth: str = ""

    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # ── JWT Auth (HS256 fallback or RS256 with RSA keys) ─────────────────────
    # For HS256: Set JWT_SECRET to a strong random 256-bit value (32+ bytes)
    # For RS256: Set JWT_SECRET to the RSA private key PEM (multiline), and JWT_PUBLIC_KEY to the public key PEM
    jwt_secret: str = ""
    jwt_public_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # ── AI Models ─────────────────────────────────────────────────────────────
    # Embedding: SEA-LION-E5-Embedding-600M (multilingual sentence-transformers)
    sea_lion_model_path: str = "./models/sea-lion-e5-embedding-600m"
    # Safety: empty => regex + threshold classifier-only mode (no neural network).
    # Point to a local safetensors/gguf SEA-Guard directory to enable neural mode.
    safety_model_path: str = ""
    # Agent / summarizer: Phi-3 mini Q4 GGUF, optional — disabled when empty.
    agent_model_path: str = ""
    embedding_dim: int = 1024

    # ── AI Mode Flags ──────────────────────────────────────────────────────────
    # Exposed via GET /status → { runtime: { matching_mode, safety_mode, agent_mode } }
    enable_ai_features: bool = True
    enable_agentic_layer: bool = False
    enable_qlora_embeddings: bool = False
    gemini_api_key: str = ""

    # DeepSeek API (AI Tutor)
    deepseek_api_key: str = ""
    deepseek_api_url: str = "https://api.deepseek.com/v1/chat/completions"
    deepseek_model: str = "deepseek-chat"
    enable_ai_tutor: bool = True
    ai_tutor_max_tokens: int = 300
    ai_tutor_temperature: float = 0.7

    # ── SMS Gateways ───────────────────────────────────────────────────────────
    infobip_api_key: str = ""
    infobip_base_url: str = "https://api.infobip.com"
    infobip_sender_id: str = "ElevateHer"
    plivo_auth_id: str = ""
    plivo_auth_token: str = ""
    resend_api_key: str = ""
    email_from: str = "hello@elevateher.app"

    # ── Guardian Consent ──────────────────────────────────────────────────────
    guardian_consent_required_age: int = 18
    consent_token_ttl_hours: int = 72

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    rate_limit_auth_per_minute: int = 5
    rate_limit_api_per_minute: int = 60
    rate_limit_ussd_per_minute: int = 30

    # ── Trusted Proxies (comma-separated IP list for X-Forwarded-For) ─────────
    # IMPORTANT: Only list IPs of actual reverse proxies (Cloudflare, ALB, nginx)
    # Listing public IPs here creates a security vulnerability
    trusted_proxy_ips: str = "127.0.0.1,::1"

    # ── Dashboard ─────────────────────────────────────────────────────────────
    dashboard_service_token: str = ""

    # ── Monitoring ────────────────────────────────────────────────────────────
    sentry_dsn: str = ""

    # ── Frontend URL ──────────────────────────────────────────────────────────
    # Used for consent links, password reset links, etc. in emails.
    frontend_url: str = "http://localhost:3000"

    @model_validator(mode="after")
    def validate_production_config(self) -> "Settings":
        """Validate production configuration requirements."""
        # JWT secret required in all environments
        if not self.jwt_secret:
            raise ValueError(
                "JWT_SECRET must be set. "
                "Use a 256-bit random string for HS256, or RSA private key PEM for RS256."
            )

        # In production, enforce stronger requirements
        if self.environment == "production":
            # JWT_SECRET must be at least 32 bytes for HS256, or contain RSA key header
            is_rsa_key = "BEGIN" in self.jwt_secret and "PRIVATE" in self.jwt_secret
            is_strong_secret = len(self.jwt_secret) >= 32

            if not is_rsa_key and not is_strong_secret:
                raise ValueError(
                    "JWT_SECRET must be at least 32 characters for HS256, "
                    "or contain an RSA private key PEM for RS256"
                )

            # Dashboard service token required in production
            if not self.dashboard_service_token:
                raise ValueError("DASHBOARD_SERVICE_TOKEN required in production")

            # Database password should not be default - use regex for better detection
            default_cred_patterns = [
                r"password[@:]",
                r":password@",
                r"localdev[@:]",
                r"postgres:postgres",
                r"admin:admin",
            ]
            for pattern in default_cred_patterns:
                if re.search(pattern, self.database_url, re.IGNORECASE):
                    raise ValueError("DATABASE_URL contains default/weak credentials")

            # Redis password required in production
            if "localhost:6379" in self.redis_url and not self.redis_url.startswith("redis://:"):
                raise ValueError("REDIS_URL requires password authentication in production")

        return self

    @field_validator("sea_lion_model_path", mode="before")
    @classmethod
    def resolve_sea_lion_model_path(cls, v: str | None) -> str:
        if not v:
            return "./models/sea-lion-e5-embedding-600m"
        return _resolve_model_path(v)

    @field_validator("safety_model_path", mode="before")
    @classmethod
    def resolve_safety_model_path(cls, v: str | None) -> str:
        if not v:
            return ""
        return _resolve_model_path(v)

    @field_validator("agent_model_path", mode="before")
    @classmethod
    def resolve_agent_model_path(cls, v: str | None) -> str:
        if not v:
            return ""
        return _resolve_model_path(v)

    @field_validator("trusted_proxy_ips", mode="before")
    @classmethod
    def validate_trusted_proxies(cls, v: str | None) -> str:  # noqa: N805
        """Ensure trusted proxy IPs are properly formatted."""
        import ipaddress
        import warnings

        if not v:
            return "127.0.0.1,::1"

        ips = [ip.strip() for ip in v.split(",") if ip.strip()]
        validated = []

        for ip in ips:
            # Skip localhost string - use only IP addresses for security
            if ip.lower() == "localhost":
                warnings.warn(
                    "TRUSTED_PROXY_IPS contains 'localhost' which is not an IP address. "
                    "Use '127.0.0.1' or '::1' instead. Skipping this entry.",
                    stacklevel=2,
                )
                continue

            try:
                # Valid IP address
                ipaddress.ip_address(ip)
                validated.append(ip)
            except ValueError:
                # Try as hostname (stricter validation)
                # Only allow valid hostnames with at least one dot (FQDN)
                hostname_pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)+$"
                if re.match(hostname_pattern, ip):
                    validated.append(ip)
                else:
                    raise ValueError(
                        f"Invalid IP or hostname in TRUSTED_PROXY_IPS: '{ip}'. "
                        "Use IP addresses (e.g., '10.0.0.1') or fully qualified domain names."
                    ) from None

        if not validated:
            return "127.0.0.1,::1"

        return ",".join(validated)

    @model_validator(mode="after")
    def check_debug_in_production(self) -> "Settings":
        """Warn if debug mode is enabled in production."""
        if self.debug and self.environment == "production":
            import warnings

            warnings.warn(
                "DEBUG=True in production is a security risk",
                stacklevel=2,
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
