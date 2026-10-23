import asyncio, httpx, json

BASE = "http://localhost:8000"

async def main():
    # 1. Register fresh mentee
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{BASE}/auth/register", json={
            "email": f"py_test@demo.app", "password": "Test1234!",
            "role": "mentee", "age": 20, "country": "MY"
        })
        print(f"[1] Register: {r.status_code} {r.json()}")

        # 2. Login
        r = await c.post(f"{BASE}/auth/login", json={
            "identifier": "py_test@demo.app", "password": "Test1234!"
        })
        token = r.json()["access_token"]
        print(f"[2] Login: OK {token[:15]}...")

        # 3. /auth/me
        r = await c.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
        print(f"[3] /auth/me: {r.status_code} {r.json()}")

        # 4. Create mentee profile
        r = await c.post(f"{BASE}/mentee/profile", headers={"Authorization": f"Bearer {token}"}, json={
            "full_name": "Aisha Bt Python",
            "display_name": "AishaPy",
            "career_goals": ["Software Engineer", "AI Researcher"],
            "sdg_track": "STEM",
            "current_education": "Universiti Malaya",
            "education_level": "undergraduate",
            "preferred_languages": ["en", "ms"],
            "challenges": ["Confidence building"],
            "bio_short": "CS student passionate about AI and machine learning"
        })
        print(f"[4] POST /mentee/profile: {r.status_code} {r.text[:300]}")

        # 5. Create mentor profile
        r2 = await c.post(f"{BASE}/auth/register", json={
            "email": f"py_mentor@demo.app", "password": "Test1234!",
            "role": "mentor", "age": 28, "country": "MY"
        })
        rid = r2.json()["user_id"]

        r = await c.post(f"{BASE}/auth/login", json={
            "identifier": "py_mentor@demo.app", "password": "Test1234!"
        })
        mt = r.json()["access_token"]

        r = await c.post(f"{BASE}/mentor/profile", headers={"Authorization": f"Bearer {mt}"}, json={
            "full_name": "Dr. Sarah Python",
            "display_name": "SarahPy",
            "job_title": "Senior Data Scientist",
            "employer": "TechCorp MY",
            "industry": "Technology",
            "years_exp": 8,
            "skills": ["Python", "ML", "Mentoring"],
            "languages": ["en", "ms"],
            "bio": "I am a passionate data scientist with 8 years of experience in AI and machine learning. I love mentoring the next generation of women in STEM and helping mentees navigate their career paths in technology.",
            "availability": {"type": "recurring", "days": ["Mon", "Wed"], "hours": "18:00-20:00"},
            "sdg_track": "STEM"
        })
        print(f"[5] POST /mentor/profile: {r.status_code} {r.text[:200]}")

        # 6. Health
        r = await c.get(f"{BASE}/health")
        print(f"[6] Health: {r.json()}")

asyncio.run(main())