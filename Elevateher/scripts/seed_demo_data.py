# =============================================================================
# ElevateHer Seed Script — Full Demo Data
# =============================================================================
# Run: python -m scripts.seed_demo_data
# Requirements: pip install asyncpg python-dotenv
# This script populates the Neon database with realistic demo data for
# hackathon presentations.
#
# Auth flow: auth_users.id is the canonical user ID. All domain tables (users,
# mentee_profiles, etc.) store the same UUID as their foreign key.
# =============================================================================

import asyncio
import asyncpg
import os
import sys
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", os.environ.get("NEON_DATABASE_URL"))

DEMO_INSTITUTIONS = [
    {"id": "00000000-0000-0000-0000-000000000001", "name": "INTI University & Colleges", "subdomain": "inti", "country": "MY"},
]

DEMO_MENTORS = [
    {
        "name": "Priya Nair",
        "email": "priya.mentor@demo.elevateher.app",
        "phone": "+60191234001",
        "country": "MY",
        "language": "en",
        "age": 32,
        "job_title": "Senior Software Engineer",
        "employer": "Grab",
        "industry": "Technology",
        "years_exp": 8,
        "skills": ["Python", "Machine Learning", "System Design", "Career Coaching"],
        "languages": ["en", "ms", "ta"],
        "bio": (
            "I'm a senior software engineer at Grab with 8 years building "
            "large-scale backend systems. I grew up in Penang, studied Computer Science "
            "at UTM, and know first-hand how hard it is to be a woman in Malaysian tech. "
            "I'm passionate about helping younger girls navigate the industry with confidence. "
            "I mentor 1-2 hours per week and focus on the STEM track."
        ),
        "bio_safety_score": 0.96,
        "can_mentor_minors": True,
        "sdg_track": "STEM",
    },
    {
        "name": "Dewi Santoso",
        "email": "dewi.mentor@demo.elevateher.app",
        "phone": "+62811234001",
        "country": "ID",
        "language": "id",
        "age": 29,
        "job_title": "Product Manager",
        "employer": "Tokopedia",
        "industry": "E-Commerce",
        "years_exp": 5,
        "skills": ["Product Strategy", "User Research", "Agile", "Business Development"],
        "languages": ["en", "id"],
        "bio": (
            "Product Manager at Tokopedia with 5 years in e-commerce product. "
            "I transitioned from engineering into product and understand both sides. "
            "I love working with young women who want to break into tech business roles "
            "and helping them build strategic thinking from day one."
        ),
        "bio_safety_score": 0.94,
        "can_mentor_minors": True,
        "sdg_track": "Business",
    },
    {
        "name": "Kasama Thongchai",
        "email": "kasama.mentor@demo.elevateher.app",
        "phone": "+66891234001",
        "country": "TH",
        "language": "th",
        "age": 35,
        "job_title": "Civil Engineer",
        "employer": "AECOM Thailand",
        "industry": "Engineering & Construction",
        "years_exp": 10,
        "skills": ["Structural Engineering", "Project Management", "AutoCAD", "Leadership"],
        "languages": ["en", "th"],
        "bio": (
            "I'm a civil engineer with 10 years experience in infrastructure projects "
            "across Southeast Asia. I was the only woman on my university course and "
            "want to change that for the next generation. I especially enjoy mentoring "
            "girls interested in the Skilled Trades and Engineering tracks."
        ),
        "bio_safety_score": 0.97,
        "can_mentor_minors": False,
        "sdg_track": "Trades",
    },
    {
        "name": "Amirah Zulkifli",
        "email": "amirah.mentor@demo.elevateher.app",
        "phone": "+60171234002",
        "country": "MY",
        "language": "ms",
        "age": 27,
        "job_title": "Graphic Designer & Brand Strategist",
        "employer": "Freelance / Fiverr Pro",
        "industry": "Creative & Design",
        "years_exp": 4,
        "skills": ["Adobe Creative Suite", "Brand Strategy", "Freelancing", "Portfolio Building"],
        "languages": ["en", "ms"],
        "bio": (
            "Freelance designer turned Fiverr Pro seller. I earn more now than my "
            "corporate salary and work on my own schedule. I want to show young Malaysian "
            "women that creative careers are real, sustainable, and high-earning. "
            "I specialise in the Creative track and helping girls build freelance income."
        ),
        "bio_safety_score": 0.95,
        "can_mentor_minors": True,
        "sdg_track": "Creative",
    },
    {
        "name": "Yuki Tanaka",
        "email": "yuki.mentor@demo.elevateher.app",
        "phone": "+818011234001",
        "country": "JP",
        "language": "ja",
        "age": 41,
        "job_title": "Data Scientist",
        "employer": "Recruit Co. Ltd",
        "industry": "Technology / HR Tech",
        "years_exp": 15,
        "skills": ["Data Science", "Python", "SQL", "Statistics", "Career Development"],
        "languages": ["en", "ja"],
        "bio": (
            "Senior data scientist with 15 years at Recruit Group. I have mentored "
            "over 30 women in tech across Japan and Southeast Asia through formal "
            "and informal programmes. I believe representation matters and every "
            "girl who enters STEM changes the pipeline permanently."
        ),
        "bio_safety_score": 0.98,
        "can_mentor_minors": False,
        "sdg_track": "STEM",
    },
    {
        "name": "Jane Doe (Mentor Demo)",
        "email": "mentor@example.com",
        "phone": "+60191234099",
        "country": "MY",
        "language": "en",
        "age": 32,
        "job_title": "Product Designer",
        "employer": "Tech Corp",
        "industry": "Technology",
        "years_exp": 5,
        "skills": ["Design", "Prototyping"],
        "languages": ["en"],
        "bio": "I am a demo mentor.",
        "bio_safety_score": 0.99,
        "can_mentor_minors": True,
        "sdg_track": "STEM",
    }
]

DEMO_MENTEES = [
    {
        "name": "Aisha Rahman",
        "email": "aisha.mentee@demo.elevateher.app",
        "phone": "+60123456789",
        "country": "MY",
        "language": "ms",
        "age": 17,
        "guardian_email": "parent.aisha@demo.com",
        "career_goals": ["software_engineer", "data_analyst"],
        "sdg_track": "STEM",
        "current_education": "Form 5, SMK Bukit Jalil",
        "preferred_languages": ["ms", "en"],
        "challenges": ["family_pressure", "no_role_models"],
        "bio_short": "Nak jadi software engineer, baru belajar Python",
    },
    {
        "name": "Siti Hajar Mohd",
        "email": "siti.mentee@demo.elevateher.app",
        "phone": "+60112345678",
        "country": "MY",
        "language": "ms",
        "age": 20,
        "guardian_email": None,
        "career_goals": ["entrepreneur", "business_development"],
        "sdg_track": "Business",
        "current_education": "Diploma in Business Administration, INTI Subang",
        "preferred_languages": ["ms", "en"],
        "challenges": ["no_network", "funding"],
        "bio_short": "Business student, want to start my own brand someday",
    },
    {
        "name": "Nguyen Thi Mai",
        "email": "mai.mentee@demo.elevateher.app",
        "phone": "+84912345678",
        "country": "VN",
        "language": "en",
        "age": 22,
        "guardian_email": None,
        "career_goals": ["ux_designer", "product_manager"],
        "sdg_track": "Creative",
        "current_education": "Final year, FPT University, Hanoi",
        "preferred_languages": ["en"],
        "challenges": ["language_barrier", "no_portfolio"],
        "bio_short": "UX/UI design student looking for my first design role",
    },
    {
        "name": "Demo Mentee",
        "email": "mentee@example.com",
        "phone": "+60123456799",
        "country": "MY",
        "language": "en",
        "age": 18,
        "guardian_email": None,
        "career_goals": ["software_engineer"],
        "sdg_track": "STEM",
        "current_education": "University",
        "preferred_languages": ["en"],
        "challenges": ["networking"],
        "bio_short": "Demo mentee account.",
    }
]

import random
MOCK_NAMES = ["Ahmed", "Maria", "Chen", "Raj", "Fatima", "David", "Sarah", "Kim", "Luis", "Olivia", "Omar", "Aisha", "Hassan", "Mei", "Elena"]
MOCK_SURNAMES = ["Smith", "Wong", "Garcia", "Ali", "Kumar", "Lee", "Gonzalez", "Kim", "Nguyen", "Das", "Silva"]
MOCK_INDUSTRIES = ["Technology", "E-Commerce", "Engineering & Construction", "Creative & Design", "Healthcare"]
MOCK_JOB_TITLES = ["Engineer", "Manager", "Analyst", "Designer", "Director"]
MOCK_SKILLS = ["Python", "Management", "Design", "Marketing", "Data Analysis"]

for i in range(30):
    m_name = f"{random.choice(MOCK_NAMES)} {random.choice(MOCK_SURNAMES)}"
    DEMO_MENTORS.append({
        "name": m_name,
        "email": f"mentor{i}@demo.elevateher.app",
        "phone": f"+6010000{100+i}",
        "country": "MY",
        "language": "en",
        "age": random.randint(25, 55),
        "job_title": random.choice(MOCK_JOB_TITLES),
        "employer": "Demo Corp",
        "industry": random.choice(MOCK_INDUSTRIES),
        "years_exp": random.randint(3, 15),
        "skills": [random.choice(MOCK_SKILLS), random.choice(MOCK_SKILLS)],
        "languages": ["en"],
        "bio": "Passionate about mentoring the next generation in " + random.choice(MOCK_INDUSTRIES),
        "bio_safety_score": 0.99,
        "can_mentor_minors": True,
        "sdg_track": random.choice(["STEM", "Business", "Trades", "Creative", "Healthcare"])
    })
    
    mentee_name = f"{random.choice(MOCK_NAMES)} {random.choice(MOCK_SURNAMES)}"
    DEMO_MENTEES.append({
        "name": mentee_name,
        "email": f"mentee{i}@demo.elevateher.app",
        "phone": f"+6010000{200+i}",
        "country": "MY",
        "language": "en",
        "age": random.randint(18, 24),
        "guardian_email": None,
        "career_goals": ["professional"],
        "sdg_track": random.choice(["STEM", "Business", "Trades", "Creative", "Healthcare"]),
        "current_education": "University",
        "preferred_languages": ["en"],
        "challenges": ["networking"],
        "bio_short": "Looking for guidance in " + random.choice(MOCK_INDUSTRIES)
    })


MILESTONE_TITLES = [
    "Career mapping & goal setting",
    "Skills gap analysis",
    "Portfolio & project building",
    "Industry networking introduction",
    "First job/internship application",
    "Interview preparation",
    "Offer negotiation & salary equity",
    "Career entry review & next steps",
    "Networking & mentorship maintenance",
    "Continuing education planning",
    "Leadership development",
    "Programme completion & graduation",
]


async def seed():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set. Run: export DATABASE_URL='postgresql://...'\n"
              "   Or set NEON_DATABASE_URL in your .env file.")
        return

    print(f"\U0001f331 Connecting to database...")
    # asyncpg requires postgresql://, not postgresql+asyncpg://
    _db_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(_db_url)

    try:
        print("🔧 Ensuring auth_users has role/onboarding_complete columns...")
        try:
            await conn.execute("""
                ALTER TABLE auth_users
                ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'mentee',
                ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false
            """)
        except asyncpg.exceptions.UndefinedTableError:
            print("⚠️  auth_users table not found. Run the schema migration first.")

        # ── Seed mentors ────────────────────────────────────────────────────────
        print("\n📋 Seeding demo mentors...")
        mentor_ids = []
        for m in DEMO_MENTORS:
            # Create auth_users entry
            auth_user_id = await conn.fetchval("""
                INSERT INTO auth_users (id, name, email, role, onboarding_complete)
                VALUES (gen_random_uuid()::text, $1, $2, 'mentor', true)
                ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'mentor'
                RETURNING id
            """, m["name"], m["email"])
            auth_uuid = await conn.fetchval("SELECT id::uuid FROM auth_users WHERE email = $1", m["email"])

            # Create auth_accounts entry for credentials login
            await conn.execute("""
                INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
                VALUES ($1, 'credentials', 'credentials', $2, $3)
                ON CONFLICT ("provider", "providerAccountId") DO NOTHING
            """, str(auth_uuid), m["email"], "$2b$12$jLJdgWiXNEsTytLZz34wyeDk2O4DBD8UaeDbUXbcMsH2vgm.N/6Jy")

            # Create users entry
            await conn.execute("""
                INSERT INTO users (id, email, phone, role, country, language, age, is_verified, institution_id)
                VALUES ($1, $2, $3, 'mentor', $4, $5, $6, true,
                    (SELECT id FROM institutions WHERE subdomain = 'inti' LIMIT 1))
                ON CONFLICT (email) DO UPDATE SET
                    role = 'mentor', country = EXCLUDED.country, language = EXCLUDED.language
            """, auth_uuid, m["email"], m["phone"], m["country"], m["language"], m["age"])

            # Create user_passwords entry for FastAPI fallback
            await conn.execute("""
                INSERT INTO user_passwords (user_id, password_hash)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
            """, auth_uuid, "$2b$12$jLJdgWiXNEsTytLZz34wyeDk2O4DBD8UaeDbUXbcMsH2vgm.N/6Jy")

            # Create mentor profile
            await conn.execute("""
                INSERT INTO mentor_profiles (
                    user_id, full_name, display_name, job_title, employer, industry,
                    years_exp, skills, languages, bio, bio_safety_score,
                    can_mentor_minors, is_approved, verification_status,
                    code_of_conduct_signed, is_active, max_mentees, current_mentees
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,'approved',true,true,3,0)
                ON CONFLICT (user_id) DO NOTHING
            """,
                auth_uuid, m["name"], m["name"].split()[0] + ".",
                m["job_title"], m["employer"], m["industry"],
                m["years_exp"], m["skills"], m["languages"], m["bio"], m["bio_safety_score"],
                m["can_mentor_minors"]
            )
            mentor_ids.append(auth_uuid)
            print(f"  ✅ Mentor: {m['name']} ({m['email']})")

        # ── Seed mentees ──────────────────────────────────────────────────────
        print("\n📋 Seeding demo mentees...")
        mentee_ids = []
        for mentee in DEMO_MENTEES:
            auth_user_id = await conn.fetchval("""
                INSERT INTO auth_users (id, name, email, role, onboarding_complete)
                VALUES (gen_random_uuid()::text, $1, $2, 'mentee', true)
                ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'mentee'
                RETURNING id
            """, mentee["name"], mentee["email"])
            auth_uuid = await conn.fetchval("SELECT id::uuid FROM auth_users WHERE email = $1", mentee["email"])

            # Create auth_accounts entry for credentials login
            await conn.execute("""
                INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
                VALUES ($1, 'credentials', 'credentials', $2, $3)
                ON CONFLICT ("provider", "providerAccountId") DO NOTHING
            """, str(auth_uuid), mentee["email"], "$2b$12$jLJdgWiXNEsTytLZz34wyeDk2O4DBD8UaeDbUXbcMsH2vgm.N/6Jy")

            # Calculate guardian_consented
            guardian_consented = mentee["age"] >= 18 or mentee["guardian_email"] is None

            await conn.execute("""
                INSERT INTO users (id, email, phone, role, country, language, age,
                    guardian_email, guardian_consented, institution_id)
                VALUES ($1, $2, $3, 'mentee', $4, $5, $6, $7, $8,
                    (SELECT id FROM institutions WHERE subdomain = 'inti' LIMIT 1))
                ON CONFLICT (email) DO UPDATE SET
                    phone = EXCLUDED.phone, country = EXCLUDED.country, language = EXCLUDED.language
            """,
                auth_uuid, mentee["email"], mentee["phone"],
                mentee["country"], mentee["language"], mentee["age"],
                mentee["guardian_email"], guardian_consented
            )

            # Create user_passwords entry for FastAPI fallback
            await conn.execute("""
                INSERT INTO user_passwords (user_id, password_hash)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
            """, auth_uuid, "$2b$12$jLJdgWiXNEsTytLZz34wyeDk2O4DBD8UaeDbUXbcMsH2vgm.N/6Jy")

            await conn.execute("""
                INSERT INTO mentee_profiles (
                    user_id, full_name, display_name, career_goals, sdg_track,
                    current_education, preferred_languages, challenges,
                    bio_short, onboarding_complete
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
                ON CONFLICT (user_id) DO UPDATE SET
                    career_goals = EXCLUDED.career_goals,
                    sdg_track = EXCLUDED.sdg_track
            """,
                auth_uuid, mentee["name"], mentee["name"].split()[0] + ".",
                mentee["career_goals"], mentee["sdg_track"],
                mentee.get("current_education"),
                mentee["preferred_languages"], mentee["challenges"],
                mentee["bio_short"]
            )
            mentee_ids.append(auth_uuid)
            print(f"  ✅ Mentee: {mentee['name']} (age {mentee['age']})")

        # ── Seed active match (Aisha + Priya) ───────────────────────────────────
        print("\n📋 Seeding demo match with sessions and impact events...")
        aisha_id = await conn.fetchval(
            "SELECT id FROM users WHERE phone = '+60123456789'"
        )
        priya_id = await conn.fetchval(
            "SELECT id FROM users WHERE email = 'priya.mentor@demo.elevateher.app'"
        )
        inti_id = await conn.fetchval(
            "SELECT id FROM institutions WHERE subdomain = 'inti'"
        )

        if aisha_id and priya_id:
            match_id = await conn.fetchval("""
                INSERT INTO matches (
                    mentee_id, mentor_id, institution_id, sdg_track,
                    match_score, match_reason, status, started_at
                ) VALUES ($1,$2,$3,'STEM',0.91,
                    'Matched because: both speak Malay and English, industry is Technology, 8 years experience.',
                    'active', now() - INTERVAL '4 weeks')
                ON CONFLICT (mentee_id, mentor_id) DO NOTHING
                RETURNING id
            """, aisha_id, priya_id, inti_id)

            if match_id:
                # Seed 4 completed sessions (milestones 1-4)
                for i in range(1, 5):
                    await conn.execute("""
                        INSERT INTO sessions (
                            match_id, session_num, channel, milestone_title,
                            completed, completed_at, milestone_reached, agent_summary
                        ) VALUES ($1,$2,'sms',$3,true,
                            now() - ($4 || ' weeks')::interval, true,
                            'Session completed. Mentor and mentee reviewed career goals and made strong progress on the STEM track.')
                    """, match_id, i, MILESTONE_TITLES[i - 1], str(4 - i))

                # Seed impact events for SDG reporting
                for event_type, sdg in [
                    ("skill_gained", "4.4"),
                    ("milestone_reached", "4.4"),
                    ("course_enrolled", "4.4"),
                    ("network_connection", "5.5"),
                    ("career_entry", "8.6"),
                ]:
                    await conn.execute("""
                        INSERT INTO impact_events (
                            user_id, match_id, institution_id,
                            event_type, sdg_goal, sdg_track, is_verified
                        ) VALUES ($1,$2,$3,$4,$5,'STEM',true)
                    """, aisha_id, match_id, inti_id, event_type, sdg)

                print("  ✅ Demo match: Aisha (mentee) → Priya (mentor) [active, 4 sessions]")

                # Add a pending match for Siti
                siti_id = await conn.fetchval(
                    "SELECT id FROM users WHERE email = 'siti.mentee@demo.elevateher.app'"
                )
                dewi_id = await conn.fetchval(
                    "SELECT id FROM users WHERE email = 'dewi.mentor@demo.elevateher.app'"
                )
                if siti_id and dewi_id:
                    pending_match = await conn.fetchval("""
                        INSERT INTO matches (
                            mentee_id, mentor_id, institution_id, sdg_track,
                            match_score, match_reason, status
                        ) VALUES ($1,$2,$3,'Business',0.87,
                            'Matched because: both speak Malay and English, Business track alignment.',
                            'pending')
                        ON CONFLICT (mentee_id, mentor_id) DO NOTHING
                        RETURNING id
                    """, siti_id, dewi_id, inti_id)
                    if pending_match:
                        print("  ✅ Demo match: Siti (mentee) → Dewi (mentor) [pending]")

        print("\n🎉 Seed complete! The database is ready for demo.")
        print(f"   {len(DEMO_MENTORS)} mentors, {len(DEMO_MENTEES)} mentees, "
              "2 matches, 4 sessions, 5 impact events")

    finally:
        await conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("ElevateHer Demo Data Seeder")
    print("=" * 60)
    asyncio.run(seed())