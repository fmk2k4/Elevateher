import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # services/api (for `main`)
sys.path.insert(
    0, str(Path(__file__).resolve().parents[3])
)  # Elevateher (for `services.api.*`, `services.matching.*`)

os.environ.update(
    {
        "DATABASE_URL": "postgresql+asyncpg://postgres:testpassword@localhost:5432/elevateher_test",
        "DATABASE_URL_SYNC": "postgresql://postgres:testpassword@localhost:5432/elevateher_test",
        "REDIS_URL": "redis://localhost:6379/15",
        "JWT_SECRET": "test-secret-do-not-use-in-production",
        "INFOBIP_API_KEY": "test-key",
        "ENVIRONMENT": "test",
        "ENABLE_AGENTIC_LAYER": "false",
        "ENABLE_QLORA_EMBEDDINGS": "false",
    }
)
