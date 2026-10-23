import asyncio

try:
    from services.matching.embedder import generate_mentee_embedding, generate_mentor_embedding
except ImportError:
    from matching.embedder import generate_mentee_embedding, generate_mentor_embedding

from config import get_settings
from db_pool import get_pool

from .celery_app import celery_app

settings = get_settings()


@celery_app.task(name="tasks.embedding_tasks.generate_mentee_embedding")
def generate_mentee_embedding_task(user_id: str, payload: dict | None = None):
    async def run(payload_inner: dict | None):
        async with get_pool() as pool:
            if payload_inner is None:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT * FROM mentee_profiles WHERE user_id = $1", user_id
                    )
                payload_inner = dict(row) if row else {}
            vector = await generate_mentee_embedding(pool, user_id, payload_inner)
            return {"updated": True, "user_id": user_id, "embedding_dim": len(vector)}

    return asyncio.run(run(payload))


@celery_app.task(name="tasks.embedding_tasks.generate_mentor_embedding")
def generate_mentor_embedding_task(user_id: str, payload: dict | None = None):
    async def run(payload_inner: dict | None):
        async with get_pool() as pool:
            if payload_inner is None:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT * FROM mentor_profiles WHERE user_id = $1", user_id
                    )
                payload_inner = dict(row) if row else {}
            vector = await generate_mentor_embedding(pool, user_id, payload_inner)
            return {"updated": True, "user_id": user_id, "embedding_dim": len(vector)}

    return asyncio.run(run(payload))


reembed_mentee_task = generate_mentee_embedding_task
reembed_mentor_task = generate_mentor_embedding_task
