-- =============================================================================
-- MIGRATION 000: Auth.js Adapter Tables (Core Authentication)
-- =============================================================================
-- These tables are required by @auth/core with the Pool adapter.
-- Schema matches @auth/core conventions exactly.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS auth_users (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name            TEXT,
    email           TEXT UNIQUE NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    image           TEXT,
    role            TEXT DEFAULT 'mentee',
    onboarding_complete BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_accounts (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId"            TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL,
    type                TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token       TEXT,
    access_token        TEXT,
    expires_at          INTEGER,
    token_type          TEXT,
    scope               TEXT,
    id_token            TEXT,
    session_state       TEXT,
    password            TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sessionToken"  TEXT UNIQUE NOT NULL,
    "userId"        TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    expires         TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_verification_token (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    identifier  TEXT NOT NULL,
    token       TEXT NOT NULL,
    expires     TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(identifier, token)
);

-- Auth.js indexes
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts("userId");
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user  ON auth_sessions("userId");