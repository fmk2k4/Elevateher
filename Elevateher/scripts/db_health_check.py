#!/usr/bin/env python3
# =============================================================================
# ElevateHer Database Health Check
# =============================================================================
# Run: python -m scripts.db_health_check
# Verifies all critical database conditions before demo day.

import asyncio
import asyncpg
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

CHECKS = [
    ("auth_users table",           "SELECT 1 FROM auth_users LIMIT 1"),
    ("auth_accounts table",         "SELECT 1 FROM auth_accounts LIMIT 1"),
    ("users table",                 "SELECT 1 FROM users LIMIT 1"),
    ("user_passwords table",        "SELECT 1 FROM user_passwords LIMIT 1"),
    ("institutions table",          "SELECT COUNT(*) FROM institutions"),
    ("approved mentors",            "SELECT COUNT(*) FROM mentor_profiles WHERE is_approved = true"),
    ("mentee profiles (onboarded)","SELECT COUNT(*) FROM mentee_profiles WHERE onboarding_complete = true"),
    ("active matches",              "SELECT COUNT(*) FROM matches WHERE status = 'active'"),
    ("pending matches",             "SELECT COUNT(*) FROM matches WHERE status = 'pending'"),
    ("sessions",                    "SELECT COUNT(*) FROM sessions"),
    ("impact events",               "SELECT COUNT(*) FROM impact_events"),
    ("safety_reports table",        "SELECT 1 FROM safety_reports LIMIT 1"),
    ("notifications table",         "SELECT 1 FROM notifications LIMIT 1"),
    ("mentor risk_snapshots",       "SELECT 1 FROM mentor_risk_snapshots LIMIT 1"),
    ("v_institution_cohort_summary view", "SELECT 1 FROM v_institution_cohort_summary LIMIT 1"),
    ("pg_trgm extension",            "SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'"),
    ("healthcheck: 1=1",            "SELECT 1"),  # sanity check
]

ADMIN_CHECKS = [
    ("Admin user exists",           "SELECT 1 FROM auth_users WHERE role = 'admin' LIMIT 1"),
]


async def check():
    url = os.environ.get("DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    if not url:
        print("❌ DATABASE_URL not set.")
        return

    print("🔍 ElevateHer Database Health Check")
    print("=" * 50)

    try:
        conn = await asyncpg.connect(url, timeout=10)
    except Exception as e:
        print(f"❌ Cannot connect to database: {e}")
        return

    all_pass = True
    for name, query in CHECKS:
        try:
            result = await conn.fetchval(query)
            status = "✅" if result is not None else "❌"
            if result is None:
                all_pass = False
            val = result if result is not None else 0
            print(f"  {status} {name}: {val}")
        except asyncpg.exceptions.UndefinedTableError:
            print(f"  ❌ {name}: TABLE MISSING — run migrations first")
            all_pass = False
        except Exception as e:
            print(f"  ❌ {name}: {e}")
            all_pass = False

    print("\n  ── Admin Checks ──")
    for name, query in ADMIN_CHECKS:
        try:
            result = await conn.fetchval(query)
            status = "✅" if result else "⚠️"
            print(f"  {status} {name}")
        except Exception as e:
            print(f"  ⚠️  {name}: {e}")

    await conn.close()
    print()
    if all_pass:
        print("✅ ALL CHECKS PASSED — Database is ready for demo!")
    else:
        print("❌ SOME CHECKS FAILED — Fix issues before demo day.")
    return all_pass


if __name__ == "__main__":
    success = asyncio.run(check())
    sys.exit(0 if success else 1)