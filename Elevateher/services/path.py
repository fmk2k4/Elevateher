"""
ElevateHer Service Path Management

Centralized Python path configuration for the ElevateHer services.
This module ensures proper import resolution across all service modules.

Usage:
    import services.path  # Call at module import (auto-initializes)
    from services.api.main import app

Or to manually initialize:
    from services.path import ensure_service_paths
    ensure_service_paths()
"""

import sys
from pathlib import Path

# The project root (Elevateher/)
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# The services directory
SERVICES_ROOT = PROJECT_ROOT / "services"

# The API directory (services/api/)
API_ROOT = SERVICES_ROOT / "api"

# The models directory
MODELS_ROOT = PROJECT_ROOT / "models"

# Paths that need to be added
_PATHS_TO_ADD = [
    str(PROJECT_ROOT),
    str(SERVICES_ROOT),
    str(API_ROOT),
]

# Track if paths have been initialized to avoid duplicate warnings
_paths_initialized = False


def ensure_service_paths() -> None:
    """
    Ensure all service paths are in sys.path.

    Call this at the start of any service entrypoint (main.py, celery tasks, etc.)
    before importing application code.

    Safe to call multiple times - duplicates are not added.
    """
    global _paths_initialized

    for path in _PATHS_TO_ADD:
        if path not in sys.path:
            sys.path.insert(0, path)

    _paths_initialized = True


def is_initialized() -> bool:
    """Check if service paths have been initialized."""
    return _paths_initialized


def get_project_root() -> Path:
    """Get the project root directory."""
    return PROJECT_ROOT


def get_services_root() -> Path:
    """Get the services directory."""
    return SERVICES_ROOT


def get_api_root() -> Path:
    """Get the API directory."""
    return API_ROOT


def get_models_root() -> Path:
    """Get the models directory."""
    return MODELS_ROOT


# Auto-initialize on import so service entrypoints can rely on it.
ensure_service_paths()
