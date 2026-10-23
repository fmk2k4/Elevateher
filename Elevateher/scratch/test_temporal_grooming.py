import asyncio
import os
import sys
import uuid
import asyncpg
import redis.asyncio as aioredis
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../services/api')))

from services.api.services.temporal_safety import record_and_analyse_message

load_dotenv(dotenv_path="../services/api/.env")

async def test_grooming():
    db_url = "postgresql://postgres:change-me-local-password@127.0.0.1:5432/elevateher"
    redis_url = "redis://127.0.0.1:6379/0"
    
    conn = await asyncpg.connect(db_url)
    redis = await aioredis.from_url(redis_url, decode_responses=True)
    
    # Get user IDs
    mentee = await conn.fetchrow("SELECT id FROM users WHERE email = 'demo.mentee.aisha@elevateher.demo'")
    mentor = await conn.fetchrow("SELECT id FROM users WHERE email = 'demo.mentor.unsafe@elevateher.demo'")
    
    if not mentee or not mentor:
        print("Demo users not found!")
        return

    # Get match ID
    match = await conn.fetchrow(
        "SELECT id FROM matches WHERE mentee_id = $1 AND mentor_id = $2 LIMIT 1",
        mentee['id'], mentor['id']
    )
    
    if not match:
        print("Match not found!")
        return

    match_id = str(match['id'])
    print(f"Testing temporal grooming for Match ID: {match_id}")

    messages = [
        {"role": "mentor", "text": "Hi Aisha, how are you doing today?"},
        {"role": "mentee", "text": "I am doing well, thank you! Just working on my Python skills."},
        {"role": "mentor", "text": "That's great. Hey, do you want to move our chat to WhatsApp? It's much easier to talk there."},
        {"role": "mentee", "text": "Oh, is that allowed?"},
        {"role": "mentor", "text": "Yes, it's fine. Just don't tell anyone about it. Keep it our little secret."},
        {"role": "mentor", "text": "Please just message me at +60123456789 so we can be closer. Don't let your parents know."}
    ]

    for msg in messages:
        sender_id = mentor['id'] if msg['role'] == 'mentor' else mentee['id']
        sender_role = msg['role']
        print(f"\n[{sender_role.upper()}]: {msg['text']}")
        
        result = await record_and_analyse_message(
            redis=redis,
            match_id=match_id,
            sender_role=sender_role,
            sender_id=str(sender_id),
            message_text=msg['text'],
            mentor_id=str(mentor['id'])
        )
        print(f"Risk Score: {result['risk_score']} | Off-platform count: {result['off_platform_count']}")
        if result['alert']:
            print(f">>> ALERT: {result['alert']['level']} - {result['alert']['reason']} (Action: {result['alert']['action']})")
        
        await asyncio.sleep(0.5)
        
    await conn.close()
    await redis.close()

if __name__ == "__main__":
    asyncio.run(test_grooming())
