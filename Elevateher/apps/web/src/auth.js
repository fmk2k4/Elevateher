/**
 * ElevateHer Web Authentication Bridge
 * Manages Auth.js adapter sessions, domain database user synchronization,
 * and JWT minting for FastAPI backend requests.
 */
import CreateAuth from "@auth/create"
import Credentials from "@auth/core/providers/credentials"
import { CredentialsSignin } from '@auth/core/errors'
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

function Adapter(client) {
  return {
    async createVerificationToken(
      verificationToken
    ) {
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO auth_verification_token ( identifier, expires, token )
        VALUES ($1, $2, $3)
        `;
      await client.query(sql, [identifier, expires, token]);
      return verificationToken;
    },
    async useVerificationToken({
      identifier,
      token,
    }) {
      const sql = `delete from auth_verification_token
      where identifier = $1 and token = $2
      RETURNING identifier, expires, token `;
      const result = await client.query(sql, [identifier, token]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },

    async createUser(user) {
      const { name, email, emailVerified, image, role, age, guardian_email } = user;
      const sql = `
        INSERT INTO auth_users (name, email, "emailVerified", image, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, "emailVerified", image, role`;
      const result = await client.query(sql, [
        name,
        email,
        emailVerified,
        image,
        role || 'mentee',
      ]);
      const createdUser = result.rows[0];

      try {
        await client.query(`
          INSERT INTO users (id, email, role, age, guardian_email, guardian_consented)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [createdUser.id, email, createdUser.role, age || null, guardian_email || null, !(age && age < 18)]);
      } catch (e) {
        console.error('Failed to sync to domain users table', e);
      }

      return createdUser;
    },
    async getUser(id) {
      const sql = 'select * from auth_users where id = $1';
      try {
        const result = await client.query(sql, [id]);
        return result.rowCount === 0 ? null : result.rows[0];
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      const sql = 'select * from auth_users where email = $1';
      const result = await client.query(sql, [email]);
      if (result.rowCount === 0) {
        return null;
      }
      const userData = result.rows[0];
      const accountsData = await client.query(
        'select * from auth_accounts where "userId" = $1',
        [userData.id]
      );
      return {
        ...userData,
        accounts: accountsData.rows,
      };
    },
    async getUserByAccount({
      providerAccountId,
      provider,
    }) {
      const sql = `
          select u.* from auth_users u join auth_accounts a on u.id = a."userId"
          where
          a.provider = $1
          and
          a."providerAccountId" = $2`;

      const result = await client.query(sql, [provider, providerAccountId]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },
    async updateUser(user) {
      const fetchSql = 'select * from auth_users where id = $1';
      const query1 = await client.query(fetchSql, [user.id]);
      const oldUser = query1.rows[0];

      const newUser = {
        ...oldUser,
        ...user,
      };

      const { id, name, email, emailVerified, image } = newUser;
      const updateSql = `
        UPDATE auth_users set
        name = $2, email = $3, "emailVerified" = $4, image = $5
        where id = $1
        RETURNING name, id, email, "emailVerified", image
      `;
      const query2 = await client.query(updateSql, [
        id,
        name,
        email,
        emailVerified,
        image,
      ]);
      return query2.rows[0];
    },
    async linkAccount(account) {
      const sql = `
      insert into auth_accounts
      (
        "userId",
        provider,
        type,
        "providerAccountId",
        access_token,
        expires_at,
        refresh_token,
        id_token,
        scope,
        session_state,
        token_type,
        password
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning
        id,
        "userId",
        provider,
        type,
        "providerAccountId",
        access_token,
        expires_at,
        refresh_token,
        id_token,
        scope,
        session_state,
        token_type,
        password
      `;

      const params = [
        account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.access_token,
        account.expires_at,
        account.refresh_token,
        account.id_token,
        account.scope,
        account.session_state,
        account.token_type,
        account.extraData?.password,
      ];

      const result = await client.query(sql, params);

      if (account.extraData?.password) {
        try {
          await client.query(`
            INSERT INTO user_passwords (user_id, password_hash)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
          `, [account.userId, account.extraData.password]);
        } catch (e) {
          console.error('Failed to sync to user_passwords table', e);
        }
      }

      return result.rows[0];
    },
    async createSession({ sessionToken, userId, expires }) {
      if (userId === undefined) {
        throw Error('userId is undef in createSession');
      }
      const sql = `insert into auth_sessions ("userId", expires, "sessionToken")
      values ($1, $2, $3)
      RETURNING id, "sessionToken", "userId", expires`;

      const result = await client.query(sql, [userId, expires, sessionToken]);
      return result.rows[0];
    },

    async getSessionAndUser(sessionToken) {
      if (sessionToken === undefined) {
        return null;
      }
      const result1 = await client.query(
        `select * from auth_sessions where "sessionToken" = $1`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const session = result1.rows[0];

      const result2 = await client.query(
        'select * from auth_users where id = $1',
        [session.userId]
      );
      if (result2.rowCount === 0) {
        return null;
      }
      const user = result2.rows[0];
      return {
        session,
        user,
      };
    },
    async updateSession(
      session
    ) {
      const { sessionToken } = session;
      const result1 = await client.query(
        `select * from auth_sessions where "sessionToken" = $1`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const originalSession = result1.rows[0];

      const newSession = {
        ...originalSession,
        ...session,
      };
      const sql = `
        UPDATE auth_sessions set
        expires = $2
        where "sessionToken" = $1
        `;
      const result = await client.query(sql, [
        newSession.sessionToken,
        newSession.expires,
      ]);
      return result.rows[0];
    },
    async deleteSession(sessionToken) {
      const sql = `delete from auth_sessions where "sessionToken" = $1`;
      await client.query(sql, [sessionToken]);
    },
    async unlinkAccount(partialAccount) {
      const { provider, providerAccountId } = partialAccount;
      const sql = `delete from auth_accounts where "providerAccountId" = $1 and provider = $2`;
      await client.query(sql, [providerAccountId, provider]);
    },
    async deleteUser(userId) {
      await client.query('delete from auth_users where id = $1', [userId]);
      await client.query('delete from auth_sessions where "userId" = $1', [
        userId,
      ]);
      await client.query('delete from auth_accounts where "userId" = $1', [
        userId,
      ]);
    },
  };
}
const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
const adapter = Adapter(pool);

export const { auth } = CreateAuth({
  providers: [Credentials({
  id: 'credentials-signin',
  name: 'Credentials Sign in',
  credentials: {
    email: {
      label: 'Email',
      type: 'email',
    },
    password: {
      label: 'Password',
      type: 'password',
    },
  },
  authorize: async (credentials) => {
    const { email, password } = credentials;
    if (!email || !password) {
      return null;
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return null;
    }

    // logic to verify if user exists
    const user = await adapter.getUserByEmail(email);
    if (!user) {
      const error = new CredentialsSignin();
      error.code = 'no-account';
      throw error;
    }
    const matchingAccount = user.accounts.find(
      (account) => account.provider === 'credentials'
    );
    const accountPassword = matchingAccount?.password;
    if (!accountPassword) {
      throw new CredentialsSignin();
    }

    const isValid = await bcrypt.compare(password, accountPassword);
    if (!isValid) {
      throw new CredentialsSignin();
    }

    // return user object with the their profile data
    return user;
  },
}),
  Credentials({
  id: 'credentials-signup',
  name: 'Credentials Sign up',
  credentials: {
    email: {
      label: 'Email',
      type: 'email',
    },
    password: {
      label: 'Password',
      type: 'password',
    },
    name: { label: 'Name', type: 'text', required: false },
    image: { label: 'Image', type: 'text', required: false },
    role: { label: 'Role', type: 'text', required: false },
    age: { label: 'Age', type: 'number', required: false },
    guardian_email: { label: "Guardian's Email (required if under 18)", type: 'email', required: false },
  },
  authorize: async (credentials) => {
    const { email, password } = credentials;
    if (!email || !password) {
      return null;
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return null;
    }

    // logic to verify if user exists
    const user = await adapter.getUserByEmail(email);
    if (user) {
      const error = new CredentialsSignin();
      error.code = 'account-exists';
      throw error;
    }
    
    const age = credentials.age ? parseInt(credentials.age, 10) : null;
    const guardian_email = credentials.guardian_email || null;

    // Validate guardian email for minors
    if (age !== null && age < 18 && !guardian_email) {
      const error = new CredentialsSignin();
      error.code = 'guardian-email-required';
      throw error;
    }

    const newUser = await adapter.createUser({
      emailVerified: null,
      email,
      role: typeof credentials.role === 'string' ? credentials.role : undefined,
      name:
        typeof credentials.name === 'string' &&
        credentials.name.trim().length > 0
          ? credentials.name
          : undefined,
      image:
        typeof credentials.image === 'string'
          ? credentials.image
          : undefined,
      age,
      guardian_email,
    });
    await adapter.linkAccount({
      extraData: {
        password: await bcrypt.hash(password, 10),
      },
      type: 'credentials',
      userId: newUser.id,
      providerAccountId: newUser.id,
      provider: 'credentials',
    });
    return newUser;
  },
})],
  pages: {
    signIn: '/account/signin',
    signOut: '/account/logout',
  },
    jwt: {
    encode: async ({ secret, token }) => {
      if (!token) return '';
      const secretEncoded = new TextEncoder().encode(secret);
      return await new SignJWT({
        ...token,
        type: 'access',
        role: token.role || 'mentee',
        sub: token.sub,
        institution_id: token.institution_id || null,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secretEncoded);
    },
    decode: async ({ secret, token }) => {
      if (!token) return null;
      const secretEncoded = new TextEncoder().encode(secret);
      try {
        const { payload } = await jwtVerify(token, secretEncoded);
        return payload;
      } catch (e) {
        return null;
      }
    },
  },
})