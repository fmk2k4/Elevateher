import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.seed_demo_data import seed  # noqa: E402

if __name__ == "__main__":
    import asyncio

    asyncio.run(seed())
