import asyncio
import time

import httpx

BASE = "http://localhost:8000"
TS = int(time.time())


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # Register fresh mentee
        r = await c.post(
            f"{BASE}/auth/register",
            json={
                "email": f"py_{TS}@demo.app",
                "password": "Test1234!",
                "role": "mentee",
                "age": 20,
                "country": "MY",
            },
        )
        print(f"[1] Register: {r.status_code}")
        if r.status_code >= 400:
            print(f"    Body: {r.text[:200]}")
            return

        # Login
        r = await c.post(
            f"{BASE}/auth/login", json={"identifier": f"py_{TS}@demo.app", "password": "Test1234!"}
        )
        token = r.json()["access_token"]
        print("[2] Login: OK")

        # /auth/me
        r = await c.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
        print(f"[3] /auth/me: {r.status_code} {r.json().get('email', '?')}")

        # Create mentee profile
        r = await c.post(
            f"{BASE}/mentee/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "full_name": "Aisha Bt Python",
                "display_name": "AishaPy",
                "career_goals": ["Software Engineer", "AI Researcher"],
                "sdg_track": "STEM",
                "current_education": "Universiti Malaya",
                "education_level": "degree",
                "preferred_languages": ["en", "ms"],
                "challenges": ["Confidence building"],
                "bio_short": "CS student passionate about AI and machine learning",
            },
        )
        print(f"[4] POST /mentee/profile: {r.status_code}")
        if r.status_code >= 400:
            print(f"    Body: {r.text[:400]}")
        else:
            data = r.json()
            print(f"    OK: id={data.get('id', '?')[:20]}...")

        # Create mentor
        r = await c.post(
            f"{BASE}/auth/register",
            json={
                "email": f"py_mt_{TS}@demo.app",
                "password": "Test1234!",
                "role": "mentor",
                "age": 28,
                "country": "MY",
            },
        )
        r = await c.post(
            f"{BASE}/auth/login",
            json={"identifier": f"py_mt_{TS}@demo.app", "password": "Test1234!"},
        )
        mt = r.json()["access_token"]

        r = await c.post(
            f"{BASE}/mentor/profile",
            headers={"Authorization": f"Bearer {mt}"},
            json={
                "full_name": "Dr. Sarah Python",
                "display_name": "SarahPy",
                "job_title": "Senior Data Scientist",
                "employer": "TechCorp MY",
                "industry": "Technology",
                "years_exp": 8,
                "skills": ["Python", "ML"],
                "languages": ["en", "ms"],
                "bio": "I am a passionate data scientist with 8 years of experience in AI and machine learning. I love mentoring the next generation of women in STEM.",
                "availability": {
                    "type": "recurring",
                    "days": ["Mon", "Wed"],
                    "hours": "18:00-20:00",
                },
                "sdg_track": "STEM",
            },
        )
        print(f"[5] POST /mentor/profile: {r.status_code}")
        if r.status_code >= 400:
            print(f"    Body: {r.text[:400]}")
        else:
            print(f"    OK: {r.text[:100]}")

        # Health
        r = await c.get(f"{BASE}/health")
        print(f"[6] Health: {r.json()}")

        # USSD callback
        r = await c.post(
            f"{BASE}/ussd/callback",
            data={
                "sessionId": "test001",
                "serviceCode": "*384#",
                "phoneNumber": "+60123456789",
                "text": "",
            },
        )
        print(f"[7] USSD callback: {r.status_code} {r.text[:80]}")


asyncio.run(main())
