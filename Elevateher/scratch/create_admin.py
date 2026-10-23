import asyncio
import os
import sys
import asyncpg
import bcrypt
from dotenv import load_dotenv

load_dotenv(dotenv_path="apps/web/.env")

async def create_admin():
    db_url = "postgresql://postgres:change-me-local-password@127.0.0.1:5432/elevateher"
    conn = await asyncpg.connect(db_url)
    
    admin_email = 'demo.admin.inti@elevateher.demo'
    
    # Get user id from backend users table
    user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", admin_email)
    
    if not user:
        print("Admin user not found in 'users' table. Run seed script first.")
        await conn.close()
        return

    user_id = user['id']
    print(f"Found admin user with ID: {user_id}")
    
    # Check if exists in auth_users
    auth_user = await conn.fetchrow("SELECT id FROM auth_users WHERE email = $1", admin_email)
    
    if not auth_user:
        print("Inserting into auth_users...")
        await conn.execute(
            """
            INSERT INTO auth_users (id, name, email, "emailVerified", image)
            VALUES ($1, $2, $3, $4, $5)
            """,
            str(user_id), "Demo Admin INTI", admin_email, None, None
        )
    else:
        print("Admin user already in auth_users. Updating ID to match backend...")
        # Since id is primary key, we might need to delete and recreate or just update
        # but it's safer to delete if it's a demo
        await conn.execute("DELETE FROM auth_accounts WHERE \"userId\" = $1", auth_user['id'])
        await conn.execute("DELETE FROM auth_users WHERE id = $1", auth_user['id'])
        
        await conn.execute(
            """
            INSERT INTO auth_users (id, name, email, "emailVerified", image)
            VALUES ($1, $2, $3, $4, $5)
            """,
            str(user_id), "Demo Admin INTI", admin_email, None, None
        )

    # Hash password
    password = b"password123"
    hashed = bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')
    
    print("Inserting into auth_accounts...")
    await conn.execute(
        """
        INSERT INTO auth_accounts (
            "userId", provider, type, "providerAccountId", password
        )
        VALUES ($1, $2, $3, $4, $5)
        """,
        str(user_id), 'credentials', 'credentials', str(user_id), hashed
    )
    
    print("Admin credentials created successfully! You can login with:")
    print(f"Email: {admin_email}")
    print("Password: password123")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
