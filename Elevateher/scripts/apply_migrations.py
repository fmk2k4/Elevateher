#!/usr/bin/env python3
import asyncio
import asyncpg
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

async def apply_migrations():
    url = os.environ.get("DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    if not url:
        print("❌ DATABASE_URL not set.")
        return False
        
    try:
        conn = await asyncpg.connect(url)
    except Exception as e:
        print(f"❌ Cannot connect to database: {e}")
        return False

    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "services", "db", "migrations")
    if not os.path.isdir(migrations_dir):
        print(f"❌ Migrations directory not found: {migrations_dir}")
        return False
        
    # Ensure migrations tracking ledger table exists
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS _schema_migrations (
            filename VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    # Fetch already applied migrations
    applied_rows = await conn.fetch("SELECT filename FROM _schema_migrations")
    applied_files = {row["filename"] for row in applied_rows}

    sql_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])
    for sql_file in sql_files:
        if sql_file in applied_files:
            print(f"⏩ Skipping {sql_file} (already recorded in _schema_migrations)")
            continue

        path = os.path.join(migrations_dir, sql_file)
        print(f"Applying {sql_file}...")
        with open(path, "r", encoding="utf-8") as f:
            sql = f.read()

        try:
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute("INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", sql_file)
            print(f"✅ Successfully applied {sql_file}")
        except asyncpg.exceptions.DuplicateTableError as e:
            print(f"ℹ️ Tables in {sql_file} already exist: {e}")
            await conn.execute("INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", sql_file)
        except asyncpg.exceptions.DuplicateObjectError as e:
            print(f"ℹ️ Objects in {sql_file} already exist: {e}")
            await conn.execute("INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", sql_file)
        except Exception as e:
            if "already exists" in str(e):
                print(f"ℹ️ Parts of {sql_file} already exist: {e}")
                await conn.execute("INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", sql_file)
            else:
                print(f"❌ Error applying {sql_file}: {e}")
                await conn.close()
                return False

    await conn.close()
    return True

if __name__ == "__main__":
    print("Starting migrations...")
    success = asyncio.run(apply_migrations())
    if success:
        print("All migrations applied successfully!")
        sys.exit(0)
    else:
        sys.exit(1)
