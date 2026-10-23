import asyncio
import concurrent.futures
import threading

import asyncpg

from config import get_settings

settings = get_settings()

_pool: asyncpg.Pool | None = None
_lock = threading.Lock()


def get_pool() -> asyncpg.Pool:
    """Return the process-global asyncpg connection pool, creating it on first call.

    Pool creation is performed in a background thread so that this function can be
    called safely from both synchronous and asynchronous contexts (e.g. FastAPI
    lifespan, Celery workers, or unit tests).
    """
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:  # double-check inside lock

                def _create() -> asyncpg.Pool:
                    # asyncpg.create_pool MUST be called from a running event loop,
                    # so we run it in a new loop in a background thread.
                    async def _init_pool():
                        return await asyncpg.create_pool(
                            dsn=settings.database_url,
                            min_size=1,
                            max_size=5,
                            command_timeout=60,
                        )

                    return asyncio.run(_init_pool())

                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    _pool = executor.submit(_create).result()
    return _pool


async def close_pool() -> None:
    """Close the process-global pool and reset the global state."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
