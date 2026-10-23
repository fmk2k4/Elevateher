"""Unit tests for config.py, db_pool.py, path.py."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

API_ROOT = str(Path(__file__).resolve().parents[2])
PROJECT_ROOT = str(Path(__file__).resolve().parents[4])
for _p in (PROJECT_ROOT, API_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)


class TestConfig:
    def test_settings_has_required_fields(self):
        """Settings object has all required fields."""
        from config import get_settings

        s = get_settings()
        assert s.app_name == "ElevateHer API"
        assert s.environment in ("development", "staging", "production", "test")
        assert isinstance(s.db_pool_min, int)
        assert isinstance(s.db_pool_max, int)
        assert s.embedding_dim == 1024
        assert isinstance(s.enable_agentic_layer, bool)
        assert isinstance(s.enable_qlora_embeddings, bool)

    def test_settings_jwt_secret_required(self):
        """JWT_SECRET must be set (validated by model_validator)."""
        from config import Settings

        with pytest.raises(ValueError, match="JWT_SECRET"):
            Settings(jwt_secret="")

    def test_settings_rate_limits_positive(self):
        """Rate limit values are positive integers."""
        from config import get_settings

        s = get_settings()
        assert s.rate_limit_auth_per_minute > 0
        assert s.rate_limit_api_per_minute > 0
        assert s.rate_limit_ussd_per_minute > 0

    def test_settings_model_paths_resolved(self):
        """Model path validators resolve relative paths to absolute."""
        from config import _resolve_model_path

        abs_path = _resolve_model_path("D:\\absolute\\path\\model.gguf")
        assert abs_path == "D:\\absolute\\path\\model.gguf"

    def test_settings_model_paths_relative_resolved(self):
        """Relative model path is resolved against project root."""
        from pathlib import Path

        from config import _resolve_model_path

        _project_root = Path(__file__).resolve().parents[4]
        result = _resolve_model_path("./models/test.gguf")
        assert str(_project_root) in result

    def test_settings_guardian_consent_age(self):
        """Guardian consent age defaults to 18."""
        from config import get_settings

        s = get_settings()
        assert s.guardian_consent_required_age == 18

    def test_settings_token_ttl(self):
        """Token expiry lengths are reasonable."""
        from config import get_settings

        s = get_settings()
        assert s.access_token_expire_minutes >= 1
        assert s.refresh_token_expire_days >= 1

    def test_settings_caches(self):
        """get_settings is cached (lru_cache returns same instance)."""
        from config import get_settings

        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2


class TestPath:
    def test_project_root_exists(self):
        """PROJECT_ROOT points to an existing directory."""
        from services.path import PROJECT_ROOT

        assert PROJECT_ROOT.exists()

    def test_services_root_exists(self):
        """SERVICES_ROOT points to existing directory."""
        from services.path import SERVICES_ROOT

        assert SERVICES_ROOT.exists()

    def test_api_root_exists(self):
        """API_ROOT points to existing directory."""
        from services.path import API_ROOT

        assert API_ROOT.exists()

    def test_paths_in_sys_path(self):
        """ensure_service_paths adds all required paths."""
        from services.path import API_ROOT, PROJECT_ROOT, SERVICES_ROOT, ensure_service_paths

        ensure_service_paths()
        assert str(PROJECT_ROOT) in sys.path
        assert str(SERVICES_ROOT) in sys.path
        assert str(API_ROOT) in sys.path

    def test_get_functions(self):
        """Getter functions return correct paths."""
        from services.path import (
            API_ROOT,
            PROJECT_ROOT,
            SERVICES_ROOT,
            get_api_root,
            get_project_root,
            get_services_root,
        )

        assert get_project_root() == PROJECT_ROOT
        assert get_services_root() == SERVICES_ROOT
        assert get_api_root() == API_ROOT

    def test_idempotent(self):
        """ensure_service_paths is idempotent (safe to call multiple times)."""
        from services.path import ensure_service_paths

        original_path = list(sys.path)
        try:
            sys.path = [
                p
                for p in sys.path
                if p
                not in (
                    str(_p)
                    for _p in [
                        Path(__file__).resolve().parents[4],
                        Path(__file__).resolve().parents[3],
                        Path(__file__).resolve().parents[2],
                    ]
                )
            ]
            ensure_service_paths()
            ensure_service_paths()
            from services.path import PROJECT_ROOT

            count = sys.path.count(str(PROJECT_ROOT))
            assert count == 1
        finally:
            sys.path = original_path


class TestDbPool:
    def test_get_pool_returns_pool(self):
        """get_pool returns an asyncpg pool (or create_pool coroutine)."""
        from unittest.mock import AsyncMock, MagicMock

        import db_pool as db_pool_mod

        sentinel_pool = MagicMock(name="asyncpg_pool")
        sentinel_pool.acquire.return_value.__aenter__ = AsyncMock()
        sentinel_pool.acquire.return_value.__aexit__ = AsyncMock()
        original = db_pool_mod._pool
        db_pool_mod._pool = None
        try:
            with patch("asyncpg.create_pool", new_callable=AsyncMock) as mock_pool:
                mock_pool.return_value = sentinel_pool
                result = db_pool_mod.get_pool()
                assert result is sentinel_pool
        finally:
            db_pool_mod._pool = original

    @pytest.mark.asyncio
    async def test_close_pool_function_exists(self):
        """close_pool function exists and can be called."""
        from db_pool import close_pool

        assert callable(close_pool)
