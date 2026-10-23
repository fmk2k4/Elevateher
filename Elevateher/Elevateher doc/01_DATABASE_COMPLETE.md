# ElevateHer — File 01: Complete Database Layer
### Schema · Migrations · Seed Data · Indexes · Row-Level Security · Views

> **Senior Engineer Note:** A broken database design is the most expensive mistake you can make. Fix it now in SQL, not later in Python. Every table in this document has a reason. Every index has a measured justification. Every RLS policy has a threat model behind it.

---

## 1. Migration Strategy (Alembic)

We use Alembic for versioned, reversible migrations. Every migration has an `upgrade()` and a `downgrade()`. Never run raw SQL in production outside of Alembic.

### 1.1 Alembic initialisation

```bash
cd services/api
pip install alembic asyncpg
alembic init alembic

# Edit alembic.ini — set sqlalchemy.url
# Edit alembic/env.py — use async engine
```

```python
# alembic/env.py
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.models import Base   # import your SQLAlchemy models

config = context.config
fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_online():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=None
    )
    async def do_run():
        async with connectable.connect() as connection:
            await connection.run_sync(
                context.configure, target_metadata=target_metadata,
                compare_type=True, compare_server_default=True
            )
            async with context.begin_transaction():
                await context.run_migrations()
    asyncio.run(do_run())

run_migrations_online()
```

---

## 2. Migration 001 — Extensions & Enums

```sql
-- alembic/versions/001_extensions_and_enums.sql

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid(), encrypt
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram index for text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- GIN index for composite searches

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
    'mentee',
    'mentor',
    'admin',
    'institution_admin',
    'moderator'
);

CREATE TYPE match_status AS ENUM (
    'pending',      -- mentor has not responded yet
    'active',       -- both parties confirmed, programme running
    'completed',    -- 12-week programme finished
    'declined',     -- mentor declined the match
    'cancelled',    -- either party cancelled mid-programme
    'flagged'       -- safety concern raised
);

CREATE TYPE session_channel AS ENUM (
    'web',
    'sms',
    'ussd',
    'whatsapp',
    'email'
);

CREATE TYPE sdg_track AS ENUM (
    'STEM',
    'Business',
    'Trades',
    'Creative',
    'Healthcare'
);

CREATE TYPE impact_event_type AS ENUM (
    'career_entry',
    'job_offer',
    'promotion_received',
    'course_enrolled',
    'course_completed',
    'certification_gained',
    'skill_gained',
    'milestone_reached',
    'programme_completed',
    'internship_started',
    'first_salary_negotiation',
    'network_connection'
);

CREATE TYPE safety_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE safety_status AS ENUM (
    'open',
    'reviewing',
    'resolved',
    'dismissed',
    'escalated_to_authorities'
);

CREATE TYPE verification_status AS ENUM (
    'unverified',
    'pending_id',
    'pending_employment',
    'pending_admin_review',
    'approved',
    'rejected',
    'suspended'
);
```

---

## 3. Migration 002 — Core User Tables

```sql
-- alembic/versions/002_core_users.sql

-- ── Institutions ─────────────────────────────────────────────────────────────
CREATE TABLE institutions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    country         CHAR(2) NOT NULL,               -- ISO 3166-1 alpha-2
    type            TEXT CHECK (type IN ('university','polytechnic','school','ngo','corporate')),
    subdomain       TEXT UNIQUE,                    -- e.g. 'inti' → inti.elevateher.app
    logo_url        TEXT,
    contact_email   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    subscription_plan TEXT DEFAULT 'pilot' CHECK (
        subscription_plan IN ('pilot','standard','enterprise','ngo_grant')
    ),
    max_mentees     INTEGER DEFAULT 200,
    max_mentors     INTEGER DEFAULT 50,
    pilot_start     DATE,
    pilot_end       DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- GoGlobal founding partners
INSERT INTO institutions (name, country, type, subdomain, contact_email, subscription_plan, pilot_start) VALUES
    ('INTI University & Colleges', 'MY', 'university', 'inti', 'careers@inti.edu.my', 'pilot', '2027-01-01'),
    ('Nanyang Polytechnic', 'SG', 'polytechnic', 'nyp', 'careerservices@nyp.edu.sg', 'pilot', '2027-01-01'),
    ('BINUS University', 'ID', 'university', 'binus', 'careers@binus.ac.id', 'pilot', '2027-01-01'),
    ('Prince of Songkla University', 'TH', 'university', 'psu', 'careers@psu.ac.th', 'pilot', '2027-01-01'),
    ('Kansai University', 'JP', 'university', 'kansai', 'careers@kansai-u.ac.jp', 'pilot', '2027-01-01'),
    ('Teesside University', 'GB', 'university', 'teesside', 'careers@tees.ac.uk', 'pilot', '2027-01-01');

-- ── Users (core identity table) ──────────────────────────────────────────────
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE,
    phone               TEXT UNIQUE,                -- E.164 format: +60123456789
    phone_country_code  CHAR(2),                    -- MY, ID, TH, SG, JP, GB
    role                user_role NOT NULL DEFAULT 'mentee',
    institution_id      UUID REFERENCES institutions(id) ON DELETE SET NULL,
    language            TEXT DEFAULT 'en' CHECK (language IN ('en','ms','id','th','ja')),
    age                 SMALLINT CHECK (age BETWEEN 10 AND 100),
    date_of_birth       DATE,
    country             CHAR(2),
    city                TEXT,
    is_verified         BOOLEAN DEFAULT false,
    is_suspended        BOOLEAN DEFAULT false,
    suspended_reason    TEXT,
    suspended_at        TIMESTAMPTZ,
    is_deleted          BOOLEAN DEFAULT false,
    deleted_at          TIMESTAMPTZ,
    guardian_email      TEXT,
    guardian_phone      TEXT,
    guardian_consented  BOOLEAN DEFAULT false,
    last_login          TIMESTAMPTZ,
    login_count         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Enforce: users under 18 must have a guardian email set
ALTER TABLE users ADD CONSTRAINT under_18_needs_guardian
    CHECK (
        age IS NULL OR age >= 18
        OR (age < 18 AND guardian_email IS NOT NULL)
    );

CREATE TYPE education_level AS ENUM (
    'secondary',
    'pre_university',
    'diploma',
    'degree',
    'postgrad',
    'vocational',
    'other'
);

CREATE TYPE verification_status AS ENUM (
    'unverified',
    'pending_id',
    'pending_employment',
    'pending_admin_review',
    'approved',
    'rejected',
    'suspended'
);

-- ── User Passwords (separate from auth_sessions for password auth) ────────────
CREATE TABLE user_passwords (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    password_hash   TEXT NOT NULL,
    previous_hashes TEXT[] DEFAULT '{}',  -- for password history/complexity rules
    changed_at      TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_passwords_user ON user_passwords(user_id);

-- ── Guardian Consents ─────────────────────────────────────────────────────────
CREATE TABLE guardian_consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT UNIQUE NOT NULL,
    guardian_email  TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consented       BOOLEAN DEFAULT false,
    consented_at    TIMESTAMPTZ,
    ip_address      INET,                           -- for audit trail
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id)                                -- one consent per user at a time
);

-- ── Auth Sessions (for custom session tracking beyond Supabase) ───────────────
CREATE TABLE auth_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT UNIQUE NOT NULL,
    device_info     TEXT,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_token ON auth_sessions(refresh_token) WHERE NOT revoked;
```

---

## 4. Migration 003 — Profile Tables + pgvector

```sql
-- alembic/versions/003_profiles_and_vectors.sql

-- ── Mentee Profiles ───────────────────────────────────────────────────────────
CREATE TABLE mentee_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name           TEXT,
    display_name        TEXT,                       -- public name (may be first name only)
    avatar_url          TEXT,
    career_goals        TEXT[] DEFAULT '{}',        -- e.g. ['software_engineer','data_analyst']
    sdg_track           sdg_track DEFAULT 'STEM',
    current_education   TEXT,
    education_level     education_level,
    graduation_year     SMALLINT,
    preferred_languages TEXT[] DEFAULT '{"en"}',
    challenges          TEXT[] DEFAULT '{}',        -- ['family_pressure','language','cost','safety']
    interests           TEXT[] DEFAULT '{}',
    bio_short           TEXT,                       -- 160 chars, shown in SMS matches
    onboarding_complete BOOLEAN DEFAULT false,
    embedding           VECTOR(4096),               -- SEA-LION v4.5 embedding
    embedding_updated   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Mentor Profiles ───────────────────────────────────────────────────────────
CREATE TABLE mentor_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name               TEXT NOT NULL,
    display_name            TEXT,
    avatar_url              TEXT,
    job_title               TEXT NOT NULL,
    employer                TEXT NOT NULL,
    industry                TEXT NOT NULL,
    years_exp               SMALLINT NOT NULL CHECK (years_exp >= 0),
    skills                  TEXT[] DEFAULT '{}',
    languages               TEXT[] DEFAULT '{"en"}',
    bio                     TEXT NOT NULL,          -- min 100 chars enforced in app layer
    bio_safety_score        FLOAT DEFAULT 0.0 CHECK (bio_safety_score BETWEEN 0 AND 1),
    bio_flags               TEXT[] DEFAULT '{}',
    bio_scanned_at          TIMESTAMPTZ,
    availability            JSONB DEFAULT '{"weekly_hours": 2, "timezone": "UTC+8"}',
    can_mentor_minors       BOOLEAN DEFAULT false,
    specialises_in          TEXT[],                 -- specific sub-tracks
    linkedin_url            TEXT,
    verification_status     verification_status DEFAULT 'unverified',
    verification_notes      TEXT,
    verified_by             UUID REFERENCES users(id),
    verified_at             TIMESTAMPTZ,
    id_document_path        TEXT,                   -- Supabase Storage path (private bucket)
    employment_doc_path     TEXT,
    code_of_conduct_signed  BOOLEAN DEFAULT false,
    code_signed_at          TIMESTAMPTZ,
    is_approved             BOOLEAN DEFAULT false,
    is_active               BOOLEAN DEFAULT true,
    max_mentees             SMALLINT DEFAULT 3,
    current_mentees         SMALLINT DEFAULT 0,
    total_mentees_served    INTEGER DEFAULT 0,
    avg_mentee_outcome_score FLOAT,                 -- populated after track completions
    embedding               VECTOR(4096),           -- SEA-LION v4.5 embedding
    embedding_updated       TIMESTAMPTZ,
    temporal_risk_score     FLOAT DEFAULT 0.0,      -- updated by temporal detector
    temporal_flags          JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mentor_profiles ADD CONSTRAINT mentor_capacity
    CHECK (current_mentees <= max_mentees);

-- ── HNSW Indexes (fast approximate nearest-neighbour search) ─────────────────
-- HNSW is 10-100x faster than IVFFlat at query time. m=16 is standard.
-- ef_construction=64 balances build speed vs index quality.
CREATE INDEX idx_mentee_embedding_hnsw ON mentee_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_mentor_embedding_hnsw ON mentor_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ── Standard Indexes ──────────────────────────────────────────────────────────
CREATE INDEX idx_mentee_user_id ON mentee_profiles(user_id);
CREATE INDEX idx_mentor_user_id ON mentor_profiles(user_id);
CREATE INDEX idx_mentor_approved ON mentor_profiles(is_approved, is_active) WHERE is_approved = true;
CREATE INDEX idx_mentor_industry ON mentor_profiles USING GIN (industry gin_trgm_ops);
CREATE INDEX idx_mentor_skills ON mentor_profiles USING GIN (skills);
CREATE INDEX idx_mentor_languages ON mentor_profiles USING GIN (languages);
CREATE INDEX idx_mentee_goals ON mentee_profiles USING GIN (career_goals);
CREATE INDEX idx_mentee_track ON mentee_profiles(sdg_track);
```

---

## 5. Migration 004 — Matching & Sessions

```sql
-- alembic/versions/004_matches_and_sessions.sql

-- ── Matches ───────────────────────────────────────────────────────────────────
CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentee_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mentor_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    institution_id      UUID REFERENCES institutions(id),
    match_score         FLOAT CHECK (match_score BETWEEN 0 AND 1),
    match_reason        TEXT,                       -- human-readable match explanation
    match_vector_dist   FLOAT,                      -- raw cosine distance (for audit)
    sdg_track           sdg_track,
    status              match_status DEFAULT 'pending',
    decline_reason      TEXT,
    cancellation_reason TEXT,
    mentor_response_at  TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    target_completed_at TIMESTAMPTZ,               -- 12 weeks from started_at
    completed_at        TIMESTAMPTZ,
    completion_notes    TEXT,
    mentee_satisfaction SMALLINT CHECK (mentee_satisfaction BETWEEN 1 AND 5),
    mentor_satisfaction SMALLINT CHECK (mentor_satisfaction BETWEEN 1 AND 5),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (mentee_id, mentor_id, status)           -- prevent duplicate active matches
);

-- Auto-set target completion date 12 weeks after start
CREATE OR REPLACE FUNCTION set_match_target_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.started_at IS NOT NULL AND NEW.target_completed_at IS NULL THEN
        NEW.target_completed_at := NEW.started_at + INTERVAL '12 weeks';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_match_target_date
    BEFORE INSERT OR UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION set_match_target_date();

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
    session_num         SMALLINT NOT NULL CHECK (session_num > 0),
    channel             session_channel NOT NULL DEFAULT 'web',
    milestone_id        TEXT,                       -- references tracks JSON milestone ID
    milestone_title     TEXT,
    scheduled_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    duration_minutes    SMALLINT,
    mentor_notes        TEXT,                       -- visible to admin + guardian
    mentee_notes        TEXT,                       -- visible to admin + guardian
    agent_summary       TEXT,                       -- AI-generated summary (Phi-3)
    agent_questions     TEXT[],                     -- AI-suggested next questions
    milestone_reached   BOOLEAN DEFAULT false,
    completed           BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_match ON sessions(match_id);
CREATE INDEX idx_sessions_completed ON sessions(completed, completed_at);

-- Prevent duplicate session numbers within a match
CREATE UNIQUE INDEX idx_sessions_unique_num ON sessions(match_id, session_num);

-- ── Session Messages (for web chat log) ──────────────────────────────────────
CREATE TABLE session_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    sender_role     TEXT CHECK (sender_role IN ('mentor','mentee','system')),
    content         TEXT NOT NULL,
    content_hash    TEXT,                           -- SHA-256 for integrity audit
    safety_score    FLOAT,                          -- SEA-Guard score for each message
    safety_flags    TEXT[] DEFAULT '{}',
    is_flagged      BOOLEAN DEFAULT false,
    sent_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_session ON session_messages(session_id, sent_at);
CREATE INDEX idx_messages_flagged ON session_messages(is_flagged) WHERE is_flagged = true;
```

---

## 6. Migration 005 — Impact & Safety

```sql
-- alembic/versions/005_impact_and_safety.sql

-- ── Impact Events ─────────────────────────────────────────────────────────────
CREATE TABLE impact_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    match_id        UUID REFERENCES matches(id),
    session_id      UUID REFERENCES sessions(id),
    institution_id  UUID REFERENCES institutions(id),
    event_type      impact_event_type NOT NULL,
    sdg_goal        TEXT NOT NULL CHECK (sdg_goal IN ('4.4','5.5','8.6','4.1','17.16')),
    sdg_track       sdg_track,
    description     TEXT,
    evidence        TEXT,                           -- brief notes from mentor/admin
    is_verified     BOOLEAN DEFAULT false,
    verified_by     UUID REFERENCES users(id),
    recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_impact_user ON impact_events(user_id);
CREATE INDEX idx_impact_institution ON impact_events(institution_id, recorded_at);
CREATE INDEX idx_impact_sdg ON impact_events(sdg_goal, recorded_at);
CREATE INDEX idx_impact_type ON impact_events(event_type, recorded_at);

-- ── Safety Reports ────────────────────────────────────────────────────────────
CREATE TABLE safety_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id         UUID NOT NULL REFERENCES users(id),
    reported_user_id    UUID NOT NULL REFERENCES users(id),
    match_id            UUID REFERENCES matches(id),
    session_id          UUID REFERENCES sessions(id),
    reason              TEXT NOT NULL,
    description         TEXT,
    evidence_text       TEXT,                       -- copied message content
    severity            safety_severity NOT NULL DEFAULT 'medium',
    status              safety_status DEFAULT 'open',
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    auto_suspended      BOOLEAN DEFAULT false,      -- was account auto-suspended?
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_safety_open ON safety_reports(status) WHERE status = 'open';
CREATE INDEX idx_safety_severity ON safety_reports(severity, created_at);
CREATE INDEX idx_safety_reported ON safety_reports(reported_user_id);

-- Auto-suspend account on critical safety reports
CREATE OR REPLACE FUNCTION auto_suspend_on_critical()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity = 'critical' THEN
        UPDATE users
        SET is_suspended = true,
            suspended_reason = 'Automatic suspension: critical safety report #' || NEW.id,
            suspended_at = now()
        WHERE id = NEW.reported_user_id;

        NEW.auto_suspended := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_suspend
    BEFORE INSERT ON safety_reports
    FOR EACH ROW EXECUTE FUNCTION auto_suspend_on_critical();

-- ── Mentor Temporal Risk Snapshots ────────────────────────────────────────────
CREATE TABLE mentor_risk_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id       UUID NOT NULL REFERENCES users(id),
    match_id        UUID REFERENCES matches(id),
    risk_score      FLOAT NOT NULL,
    flags           TEXT[] DEFAULT '{}',
    message_count   INTEGER DEFAULT 0,
    off_platform_attempts INTEGER DEFAULT 0,
    intimacy_flags  INTEGER DEFAULT 0,
    snapshot_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_mentor ON mentor_risk_snapshots(mentor_id, snapshot_at DESC);
CREATE INDEX idx_risk_score ON mentor_risk_snapshots(risk_score DESC) WHERE risk_score > 0.3;

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,                  -- 'match_found','session_reminder','safety_alert'
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    action_url      TEXT,
    is_read         BOOLEAN DEFAULT false,
    channel         session_channel DEFAULT 'web',
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);
```

---

## 7. Migration 006 — Views for Dashboard & Reporting

```sql
-- alembic/versions/006_views.sql

-- ── Cohort Summary View (used by B2B dashboard overview) ─────────────────────
CREATE OR REPLACE VIEW v_institution_cohort_summary AS
SELECT
    i.id                AS institution_id,
    i.name              AS institution_name,
    i.country,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'mentee' AND NOT u.is_deleted)  AS total_mentees,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'mentor' AND NOT u.is_deleted)  AS total_mentors,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active')                      AS active_matches,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')                   AS completed_programmes,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'pending')                     AS pending_matches,
    COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '4.4')                     AS sdg4_events,
    COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '5.5')                     AS sdg5_events,
    COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '8.6')                     AS sdg8_events,
    COUNT(DISTINCT s.id) FILTER (WHERE s.channel IN ('sms','ussd'))               AS offline_sessions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.channel = 'web')                        AS web_sessions,
    ROUND(AVG(COALESCE(m.mentee_satisfaction, 0))::numeric, 2)                   AS avg_mentee_satisfaction,
    MAX(m.created_at)                                                             AS last_activity
FROM institutions i
LEFT JOIN users u        ON u.institution_id = i.id
LEFT JOIN matches m      ON m.mentee_id = u.id
LEFT JOIN impact_events ie ON ie.institution_id = i.id
LEFT JOIN sessions s     ON s.match_id = m.id
GROUP BY i.id, i.name, i.country;

-- ── SDG Impact Timeline (for line charts in dashboard) ───────────────────────
CREATE OR REPLACE VIEW v_sdg_impact_timeline AS
SELECT
    institution_id,
    DATE_TRUNC('week', recorded_at) AS week,
    sdg_goal,
    COUNT(*)                        AS event_count
FROM impact_events
GROUP BY institution_id, DATE_TRUNC('week', recorded_at), sdg_goal
ORDER BY institution_id, week;

-- ── Active Match Details (for match management table) ────────────────────────
CREATE OR REPLACE VIEW v_active_matches AS
SELECT
    m.id                AS match_id,
    m.status,
    m.sdg_track,
    m.match_score,
    m.match_reason,
    m.started_at,
    m.target_completed_at,
    -- Mentee info
    u_mentee.id         AS mentee_id,
    mp_mentee.display_name AS mentee_name,
    u_mentee.country    AS mentee_country,
    u_mentee.language   AS mentee_language,
    -- Mentor info
    u_mentor.id         AS mentor_id,
    mp_mentor.display_name AS mentor_name,
    mp_mentor.job_title,
    mp_mentor.industry,
    -- Progress
    COUNT(s.id)         AS sessions_completed,
    MAX(s.completed_at) AS last_session_at,
    m.institution_id
FROM matches m
JOIN users u_mentee          ON u_mentee.id = m.mentee_id
JOIN mentee_profiles mp_mentee ON mp_mentee.user_id = m.mentee_id
JOIN users u_mentor          ON u_mentor.id = m.mentor_id
JOIN mentor_profiles mp_mentor ON mp_mentor.user_id = m.mentor_id
LEFT JOIN sessions s         ON s.match_id = m.id AND s.completed = true
WHERE m.status IN ('active','pending')
GROUP BY m.id, u_mentee.id, mp_mentee.display_name, u_mentee.country, u_mentee.language,
         u_mentor.id, mp_mentor.display_name, mp_mentor.job_title, mp_mentor.industry;

-- ── Mentor Leaderboard (for institution admin, not public) ───────────────────
CREATE OR REPLACE VIEW v_mentor_leaderboard AS
SELECT
    u.id                            AS mentor_id,
    mp.display_name,
    mp.job_title,
    mp.industry,
    mp.current_mentees,
    mp.total_mentees_served,
    mp.avg_mentee_outcome_score,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS programmes_completed,
    AVG(m.mentee_satisfaction) FILTER (WHERE m.mentee_satisfaction IS NOT NULL) AS avg_satisfaction,
    u.institution_id
FROM mentor_profiles mp
JOIN users u ON u.id = mp.user_id
LEFT JOIN matches m ON m.mentor_id = u.id
WHERE mp.is_approved = true AND NOT u.is_deleted
GROUP BY u.id, mp.display_name, mp.job_title, mp.industry,
         mp.current_mentees, mp.total_mentees_served, mp.avg_mentee_outcome_score, u.institution_id;
```

---

## 8. Migration 007 — Row-Level Security Policies

```sql
-- alembic/versions/007_rls.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS THREAT MODEL:
-- 1. Institution A must NEVER see Institution B's user data
-- 2. A mentor must NEVER see another mentor's profile details or messages
-- 3. A mentee must NEVER see another mentee's profile
-- 4. Admins can see everything within their institution
-- 5. Super-admins (role='admin') can see everything
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables with sensitive data
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentee_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;

-- ── Users RLS ────────────────────────────────────────────────────────────────
CREATE POLICY users_own_row ON users
    FOR ALL USING (id = current_setting('app.user_id', true)::uuid);

CREATE POLICY users_same_institution ON users
    FOR SELECT USING (
        institution_id = current_setting('app.institution_id', true)::uuid
        AND current_setting('app.role', true) IN ('institution_admin','moderator','admin')
    );

CREATE POLICY users_super_admin ON users
    FOR ALL USING (current_setting('app.role', true) = 'admin');

-- ── Mentee Profiles RLS ───────────────────────────────────────────────────────
CREATE POLICY mentee_own ON mentee_profiles
    FOR ALL USING (user_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY mentee_mentor_can_read ON mentee_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.mentee_id = mentee_profiles.user_id
              AND m.mentor_id = current_setting('app.user_id', true)::uuid
              AND m.status IN ('pending','active')
        )
    );

-- ── Matches RLS ───────────────────────────────────────────────────────────────
CREATE POLICY matches_own_party ON matches
    FOR ALL USING (
        mentee_id = current_setting('app.user_id', true)::uuid
        OR mentor_id = current_setting('app.user_id', true)::uuid
    );

CREATE POLICY matches_institution_admin ON matches
    FOR SELECT USING (
        institution_id = current_setting('app.institution_id', true)::uuid
        AND current_setting('app.role', true) IN ('institution_admin','admin')
    );

-- ── Messages RLS ──────────────────────────────────────────────────────────────
CREATE POLICY messages_match_party ON session_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = session_messages.session_id
              AND (m.mentee_id = current_setting('app.user_id', true)::uuid
                   OR m.mentor_id = current_setting('app.user_id', true)::uuid)
        )
    );
```

---

## 9. Migration 008 — Triggers & Automation

```sql
-- alembic/versions/008_triggers.sql

-- ── updated_at auto-update ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mentee_updated_at
    BEFORE UPDATE ON mentee_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mentor_updated_at
    BEFORE UPDATE ON mentor_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_matches_updated_at
    BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_institutions_updated_at
    BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Mentor current_mentees counter ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_mentor_mentee_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE mentor_profiles SET current_mentees = current_mentees + 1
        WHERE user_id = NEW.mentor_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'active' AND NEW.status NOT IN ('active') THEN
            UPDATE mentor_profiles SET
                current_mentees = GREATEST(0, current_mentees - 1)
            WHERE user_id = NEW.mentor_id;
        END IF;
        IF NEW.status = 'completed' THEN
            UPDATE mentor_profiles SET
                total_mentees_served = total_mentees_served + 1
            WHERE user_id = NEW.mentor_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mentor_count
    AFTER INSERT OR UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_mentor_mentee_count();

-- ── Record login ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_login IS DISTINCT FROM OLD.last_login AND NEW.last_login IS NOT NULL THEN
        NEW.login_count := OLD.login_count + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_login
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION record_login();
```

---

## 10. Seed Script (Full Demo Data)

```python
# scripts/seed_demo_data.py
# Run: python scripts/seed_demo_data.py
# Populates database with realistic demo data for hackathon presentation

import asyncio
import asyncpg
import json
import os
from datetime import datetime, timedelta

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/elevateher")

DEMO_MENTORS = [
    {
        "full_name": "Priya Nair",
        "display_name": "Priya N.",
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
        "sdg_track": "STEM"
    },
    {
        "full_name": "Dewi Santoso",
        "display_name": "Dewi S.",
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
        "sdg_track": "Business"
    },
    {
        "full_name": "Kasama Thongchai",
        "display_name": "Kasama T.",
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
        "sdg_track": "Trades"
    },
    {
        "full_name": "Amirah Zulkifli",
        "display_name": "Amirah Z.",
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
        "sdg_track": "Creative"
    },
    {
        "full_name": "Yuki Tanaka",
        "display_name": "Yuki T.",
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
        "sdg_track": "STEM"
    }
]

DEMO_MENTEES = [
    {
        "full_name": "Aisha Rahman",
        "display_name": "Aisha R.",
        "email": None,
        "phone": "+60123456789",   # SMS/USSD user — no email
        "country": "MY",
        "language": "ms",
        "age": 17,
        "guardian_email": "parent.aisha@demo.com",
        "career_goals": ["software_engineer", "data_analyst"],
        "sdg_track": "STEM",
        "current_education": "Form 5, SMK Bukit Jalil",
        "preferred_languages": ["ms", "en"],
        "challenges": ["family_pressure", "no_role_models"],
        "bio_short": "Nak jadi software engineer, baru belajar Python"
    },
    {
        "full_name": "Siti Hajar Mohd",
        "display_name": "Siti H.",
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
        "bio_short": "Business student, want to start my own brand someday"
    },
    {
        "full_name": "Nguyen Thi Mai",
        "display_name": "Mai N.",
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
        "bio_short": "UX/UI design student looking for my first design role"
    }
]

async def seed():
    conn = await asyncpg.connect(DB_URL)
    print("🌱 Seeding demo data...")

    try:
        # Insert institutions (already seeded in migration 002, skip if exists)
        # Insert demo mentors
        for mentor_data in DEMO_MENTORS:
            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, phone, role, country, language, age, is_verified)
                VALUES ($1, $2, 'mentor', $3, $4, $5, true)
                ON CONFLICT (phone) DO UPDATE SET is_verified = true
                RETURNING id
                """,
                mentor_data.get("email"), mentor_data["phone"],
                mentor_data["country"], mentor_data["language"], mentor_data["age"]
            )
            await conn.execute(
                """
                INSERT INTO mentor_profiles (
                    user_id, full_name, display_name, job_title, employer,
                    industry, years_exp, skills, languages, bio,
                    bio_safety_score, can_mentor_minors, is_approved,
                    verification_status, code_of_conduct_signed
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,'approved',true)
                ON CONFLICT (user_id) DO NOTHING
                """,
                user_id, mentor_data["full_name"], mentor_data["display_name"],
                mentor_data["job_title"], mentor_data["employer"],
                mentor_data["industry"], mentor_data["years_exp"],
                mentor_data["skills"], mentor_data["languages"], mentor_data["bio"],
                mentor_data["bio_safety_score"], mentor_data["can_mentor_minors"]
            )
            print(f"  ✅ Mentor: {mentor_data['full_name']}")

        # Insert demo mentees
        for mentee_data in DEMO_MENTEES:
            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, phone, role, country, language, age,
                    guardian_email, guardian_consented)
                VALUES ($1, $2, 'mentee', $3, $4, $5, $6, $7)
                ON CONFLICT (phone) DO UPDATE SET language = EXCLUDED.language
                RETURNING id
                """,
                mentee_data.get("email"), mentee_data["phone"],
                mentee_data["country"], mentee_data["language"], mentee_data["age"],
                mentee_data.get("guardian_email"),
                mentee_data["age"] >= 18 or mentee_data.get("guardian_email") is None
            )
            await conn.execute(
                """
                INSERT INTO mentee_profiles (
                    user_id, full_name, display_name,
                    career_goals, sdg_track, current_education,
                    preferred_languages, challenges, bio_short, onboarding_complete
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
                ON CONFLICT (user_id) DO NOTHING
                """,
                user_id, mentee_data["full_name"], mentee_data["display_name"],
                mentee_data["career_goals"], mentee_data["sdg_track"],
                mentee_data.get("current_education"),
                mentee_data["preferred_languages"], mentee_data["challenges"],
                mentee_data.get("bio_short")
            )
            print(f"  ✅ Mentee: {mentee_data['full_name']}")

        # Seed a completed match with impact events (for dashboard demo)
        aisha_id = await conn.fetchval("SELECT id FROM users WHERE phone = '+60123456789'")
        priya_id = await conn.fetchval("SELECT id FROM users WHERE email = 'priya.mentor@demo.elevateher.app'")
        inti_id  = await conn.fetchval("SELECT id FROM institutions WHERE subdomain = 'inti'")

        if aisha_id and priya_id:
            match_id = await conn.fetchval(
                """
                INSERT INTO matches (
                    mentee_id, mentor_id, institution_id, sdg_track,
                    match_score, match_reason, status, started_at
                ) VALUES ($1,$2,$3,'STEM',0.91,
                    'Matched because: both speak Malay and English, industry is Technology, 8 years experience.',
                    'active', now() - INTERVAL '4 weeks')
                ON CONFLICT DO NOTHING RETURNING id
                """,
                aisha_id, priya_id, inti_id
            )

            if match_id:
                # Seed 4 completed sessions
                for i in range(1, 5):
                    await conn.execute(
                        """
                        INSERT INTO sessions (
                            match_id, session_num, channel, milestone_title,
                            completed, completed_at, milestone_reached,
                            agent_summary
                        ) VALUES ($1,$2,'sms',$3,true,
                            now() - ($4 || ' weeks')::interval, true, $5)
                        """,
                        match_id, i,
                        ["Career mapping & goal setting", "Skills gap analysis",
                         "Portfolio & project building", "Industry networking"][i-1],
                        str(4-i),
                        f"Aisha and Priya completed milestone {i}. Strong progress on STEM track."
                    )
                # Seed impact events
                for event_type, sdg in [
                    ("skill_gained","4.4"), ("milestone_reached","4.4"),
                    ("course_enrolled","4.4"), ("network_connection","5.5")
                ]:
                    await conn.execute(
                        """
                        INSERT INTO impact_events (
                            user_id, match_id, institution_id, event_type, sdg_goal, sdg_track
                        ) VALUES ($1,$2,$3,$4,$5,'STEM')
                        """,
                        aisha_id, match_id, inti_id, event_type, sdg
                    )
                print("  ✅ Demo match with sessions and impact events created")

        print("\n🎉 Seed complete! Database ready for demo.")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
```

---

## 11. Database Health Check Script

```python
# scripts/db_health_check.py
"""Run before demo day. Verifies all critical database conditions."""

import asyncio, asyncpg, os

async def check():
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    print("🔍 ElevateHer Database Health Check\n" + "="*45)
    checks = [
        ("pgvector extension", "SELECT 1 FROM pg_extension WHERE extname = 'vector'"),
        ("HNSW index exists", "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mentor_embedding_hnsw'"),
        ("Approved mentors", "SELECT COUNT(*) FROM mentor_profiles WHERE is_approved = true"),
        ("Mentee profiles", "SELECT COUNT(*) FROM mentee_profiles WHERE onboarding_complete = true"),
        ("Active matches", "SELECT COUNT(*) FROM matches WHERE status = 'active'"),
        ("Impact events", "SELECT COUNT(*) FROM impact_events"),
        ("Institutions", "SELECT COUNT(*) FROM institutions WHERE is_active = true"),
        ("RLS enabled on users", "SELECT rowsecurity FROM pg_tables WHERE tablename = 'users'"),
    ]
    all_pass = True
    for name, query in checks:
        result = await conn.fetchval(query)
        status = "✅" if result else "❌"
        if not result:
            all_pass = False
        print(f"  {status} {name}: {result}")
    print("\n" + ("✅ ALL CHECKS PASSED" if all_pass else "❌ SOME CHECKS FAILED"))
    await conn.close()

asyncio.run(check())
```

---

*File 01 of 10 — ElevateHer Complete Technical Suite*
*Covers: Alembic migrations 001–008, all schema, HNSW indexes, RLS, triggers, views, full seed script*
