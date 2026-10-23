-- =============================================================================
-- ElevateHer Database Schema v2.0
-- PostgreSQL 16 + pgvector (Neon Serverless Compatible)
-- =============================================================================
-- Run this AFTER Auth.js migration. Contains ONLY application domain tables.
-- Auth.js adapter tables are in 000_auth_js.sql
--
-- Migration order:
--   000_auth_js.sql       ← Auth.js adapter tables
--   001_extensions.sql    ← PostgreSQL extensions + enums
--   002_core_users.sql    ← institutions, users, user_passwords, guardian_consents, auth_sessions
--   003_profiles.sql      ← mentee_profiles, mentor_profiles + HNSW indexes
--   004_matches.sql        ← matches, sessions, session_messages
--   005_impact_safety.sql  ← impact_events, safety_reports, notifications, mentor_risk_snapshots
--   006_views.sql          ← Dashboard views
--   007_triggers.sql       ← Auto-updated_at, mentor count, login recorder
-- =============================================================================

-- =============================================================================
-- MIGRATION 001: Extensions & Enums
-- =============================================================================

-- Extensions (Neon supports all of these)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid(), encrypt
CREATE EXTENSION IF NOT EXISTS "vector";         -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- trigram index for text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN index for composite searches

-- ── User Role ────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
    'mentee',
    'mentor',
    'admin',
    'institution_admin',
    'moderator'
);

-- ── Match Status ─────────────────────────────────────────────────────────────
CREATE TYPE match_status AS ENUM (
    'pending',     -- mentor has not responded yet
    'active',      -- both parties confirmed, programme running
    'completed',   -- 12-week programme finished
    'declined',    -- mentor declined the match
    'cancelled',   -- either party cancelled mid-programme
    'flagged'      -- safety concern raised
);

-- ── Session Channel ───────────────────────────────────────────────────────────
CREATE TYPE session_channel AS ENUM (
    'web',
    'sms',
    'ussd',
    'whatsapp',
    'email'
);

-- ── SDG Track ────────────────────────────────────────────────────────────────
CREATE TYPE sdg_track AS ENUM (
    'STEM',
    'Business',
    'Trades',
    'Creative',
    'Healthcare'
);

-- ── Education Level ──────────────────────────────────────────────────────────
CREATE TYPE education_level AS ENUM (
    'secondary',
    'pre_university',
    'diploma',
    'degree',
    'postgrad',
    'vocational',
    'other'
);

-- ── Impact Event Type ────────────────────────────────────────────────────────
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

-- ── Safety ──────────────────────────────────────────────────────────────────
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

-- ── Verification ─────────────────────────────────────────────────────────────
CREATE TYPE verification_status AS ENUM (
    'unverified',
    'pending_id',
    'pending_employment',
    'pending_admin_review',
    'approved',
    'rejected',
    'suspended'
);

-- =============================================================================
-- MIGRATION 002: Core User Tables
-- =============================================================================

-- ── Institutions ─────────────────────────────────────────────────────────────
CREATE TABLE institutions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    country             CHAR(2) NOT NULL,                          -- ISO 3166-1 alpha-2
    type                TEXT CHECK (type IN ('university','polytechnic','school','ngo','corporate')),
    subdomain           TEXT UNIQUE,                               -- e.g. 'inti' → inti.elevateher.app
    logo_url            TEXT,
    contact_email       TEXT NOT NULL,
    is_active           BOOLEAN DEFAULT true,
    subscription_plan   TEXT DEFAULT 'pilot' CHECK (
        subscription_plan IN ('pilot','standard','enterprise','ngo_grant')
    ),
    max_mentees         INTEGER DEFAULT 200,
    max_mentors         INTEGER DEFAULT 50,
    pilot_start         DATE,
    pilot_end           DATE,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Users (core identity — mirrors auth_users for app-specific data) ─────────
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE,
    phone               TEXT UNIQUE,                               -- E.164 format: +60123456789
    phone_country_code  CHAR(2),
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

-- ── User Passwords (for credentials auth, mirrors auth_accounts.password) ─────
CREATE TABLE user_passwords (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    password_hash   TEXT NOT NULL,
    previous_hashes TEXT[] DEFAULT '{}',
    changed_at      TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_passwords_user ON user_passwords(user_id);

-- Prevent empty password hash
ALTER TABLE user_passwords ADD CONSTRAINT password_hash_not_empty
    CHECK (length(password_hash) > 0);

-- ── Guardian Consents ─────────────────────────────────────────────────────────
CREATE TABLE guardian_consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT UNIQUE NOT NULL,
    guardian_email  TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consented       BOOLEAN DEFAULT false,
    consented_at    TIMESTAMPTZ,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── App Auth Sessions (custom session tracking beyond Auth.js) ───────────────
CREATE TABLE app_auth_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT UNIQUE NOT NULL,
    device_info     TEXT,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_app_auth_sessions_user  ON app_auth_sessions(user_id);
CREATE INDEX idx_app_auth_sessions_token ON app_auth_sessions(refresh_token) WHERE NOT revoked;

-- ── Institutions seed data ────────────────────────────────────────────────────
INSERT INTO institutions (name, country, type, subdomain, contact_email, subscription_plan, pilot_start) VALUES
    ('INTI University & Colleges',       'MY', 'university',  'inti',    'careers@inti.edu.my',        'pilot', '2027-01-01'),
    ('Nanyang Polytechnic',              'SG', 'polytechnic', 'nyp',     'careerservices@nyp.edu.sg',   'pilot', '2027-01-01'),
    ('BINUS University',                'ID', 'university',  'binus',   'careers@binus.ac.id',         'pilot', '2027-01-01'),
    ('Prince of Songkla University',     'TH', 'university',  'psu',     'careers@psu.ac.th',           'pilot', '2027-01-01'),
    ('Kansai University',               'JP', 'university',  'kansai',  'careers@kansai-u.ac.jp',      'pilot', '2027-01-01'),
    ('Teesside University',             'GB', 'university',  'teesside','careers@tees.ac.uk',          'pilot', '2027-01-01')
ON CONFLICT (subdomain) DO NOTHING;

-- =============================================================================
-- MIGRATION 003: Profile Tables
-- =============================================================================

-- ── Mentee Profiles ───────────────────────────────────────────────────────────
CREATE TABLE mentee_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name           TEXT,
    display_name        TEXT,
    avatar_url          TEXT,
    career_goals        TEXT[] DEFAULT '{}',
    sdg_track           sdg_track DEFAULT 'STEM',
    current_education   TEXT,
    education_level     education_level,
    graduation_year     SMALLINT,
    preferred_languages TEXT[] DEFAULT '{"en"}',
    challenges          TEXT[] DEFAULT '{}',
    interests           TEXT[] DEFAULT '{}',
    bio_short           TEXT,                                     -- 160 chars, shown in SMS matches
    onboarding_complete BOOLEAN DEFAULT false,
    embedding           VECTOR(1024),                             -- SEA-LION-E5 embedding
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
    sdg_track               sdg_track DEFAULT 'STEM',
    years_exp               SMALLINT NOT NULL CHECK (years_exp >= 0),
    skills                  TEXT[] DEFAULT '{}',
    languages               TEXT[] DEFAULT '{"en"}',
    bio                     TEXT NOT NULL,
    bio_safety_score        FLOAT DEFAULT 0.0 CHECK (bio_safety_score BETWEEN 0 AND 1),
    bio_flags               TEXT[] DEFAULT '{}',
    bio_scanned_at          TIMESTAMPTZ,
    availability            JSONB DEFAULT '{"weekly_hours": 2, "timezone": "UTC+8"}',
    can_mentor_minors       BOOLEAN DEFAULT false,
    specialises_in          TEXT[],                                  -- specific sub-tracks
    linkedin_url            TEXT,
    verification_status     verification_status DEFAULT 'unverified',
    verification_notes      TEXT,
    verified_by             UUID REFERENCES users(id),
    verified_at             TIMESTAMPTZ,
    id_document_path        TEXT,
    employment_doc_path     TEXT,
    code_of_conduct_signed  BOOLEAN DEFAULT false,
    code_signed_at          TIMESTAMPTZ,
    is_approved             BOOLEAN DEFAULT false,
    is_active               BOOLEAN DEFAULT true,
    max_mentees             SMALLINT DEFAULT 3,
    current_mentees         SMALLINT DEFAULT 0,
    total_mentees_served    INTEGER DEFAULT 0,
    avg_mentee_outcome_score FLOAT,
    embedding               VECTOR(1024),                            -- SEA-LION-E5 embedding
    embedding_updated       TIMESTAMPTZ,
    temporal_risk_score     FLOAT DEFAULT 0.0,
    temporal_flags          JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mentor_profiles ADD CONSTRAINT mentor_capacity
    CHECK (current_mentees <= max_mentees);

-- ── HNSW Indexes (fast approximate nearest-neighbour search) ─────────────────
-- HNSW is 10-100x faster than IVFFlat at query time.
-- ef_construction=64 is the standard balance of build speed vs. index quality.
CREATE INDEX idx_mentee_embedding_hnsw ON mentee_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_mentor_embedding_hnsw ON mentor_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ── Standard Indexes ──────────────────────────────────────────────────────────
CREATE INDEX idx_mentee_user_id     ON mentee_profiles(user_id);
CREATE INDEX idx_mentor_user_id     ON mentor_profiles(user_id);
CREATE INDEX idx_mentor_approved    ON mentor_profiles(is_approved, is_active) WHERE is_approved = true;
CREATE INDEX idx_mentor_industry    ON mentor_profiles USING GIN (industry gin_trgm_ops);
CREATE INDEX idx_mentor_track       ON mentor_profiles(sdg_track);
CREATE INDEX idx_mentor_skills      ON mentor_profiles USING GIN (skills);
CREATE INDEX idx_mentor_languages    ON mentor_profiles USING GIN (languages);
CREATE INDEX idx_mentee_goals        ON mentee_profiles USING GIN (career_goals);
CREATE INDEX idx_mentee_track        ON mentee_profiles(sdg_track);

-- =============================================================================
-- MIGRATION 004: Matching & Sessions
-- =============================================================================

-- ── Matches ───────────────────────────────────────────────────────────────────
CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentee_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mentor_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    institution_id      UUID REFERENCES institutions(id),
    match_score         FLOAT CHECK (match_score BETWEEN 0 AND 1),
    match_reason        TEXT,
    match_vector_dist   FLOAT,
    sdg_track           sdg_track,
    status              match_status DEFAULT 'pending',
    decline_reason      TEXT,
    cancellation_reason TEXT,
    mentor_response_at  TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    target_completed_at TIMESTAMPTZ,                              -- 12 weeks from started_at
    completed_at        TIMESTAMPTZ,
    completion_notes    TEXT,
    mentee_satisfaction SMALLINT CHECK (mentee_satisfaction BETWEEN 1 AND 5),
    mentor_satisfaction SMALLINT CHECK (mentor_satisfaction BETWEEN 1 AND 5),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (mentee_id, mentor_id)                                 -- prevent duplicate matches per pair
);

-- Auto-set target completion date 12 weeks after match starts
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
    milestone_id        TEXT,
    milestone_title     TEXT,
    scheduled_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    duration_minutes    SMALLINT,
    mentor_notes        TEXT,
    mentee_notes        TEXT,
    agent_summary       TEXT,                                     -- AI-generated summary (Phi-3)
    agent_questions     TEXT[],
    milestone_reached   BOOLEAN DEFAULT false,
    completed           BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_match      ON sessions(match_id);
CREATE INDEX idx_sessions_completed ON sessions(completed, completed_at);

-- Prevent duplicate session numbers within a match
CREATE UNIQUE INDEX idx_sessions_unique_num ON sessions(match_id, session_num);

-- Performance indexes
CREATE INDEX idx_matches_mentee ON matches(mentee_id) WHERE mentee_id IS NOT NULL;
CREATE INDEX idx_matches_mentor ON matches(mentor_id) WHERE mentor_id IS NOT NULL;
CREATE INDEX idx_matches_status ON matches(status) WHERE status IS NOT NULL;

-- ── Session Messages (web chat log) ──────────────────────────────────────────
CREATE TABLE session_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    sender_role     TEXT CHECK (sender_role IN ('mentor','mentee','system')),
    content         TEXT NOT NULL,
    content_hash    TEXT,                                         -- SHA-256 for audit integrity
    safety_score    FLOAT,
    safety_flags    TEXT[] DEFAULT '{}',
    is_flagged      BOOLEAN DEFAULT false,
    sent_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_session ON session_messages(session_id, sent_at);
CREATE INDEX idx_messages_flagged ON session_messages(is_flagged) WHERE is_flagged = true;

-- =============================================================================
-- MIGRATION 005: Impact & Safety
-- =============================================================================

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
    evidence        TEXT,
    is_verified     BOOLEAN DEFAULT false,
    verified_by     UUID REFERENCES users(id),
    recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_impact_user         ON impact_events(user_id);
CREATE INDEX idx_impact_institution ON impact_events(institution_id, recorded_at);
CREATE INDEX idx_impact_sdg          ON impact_events(sdg_goal, recorded_at);
CREATE INDEX idx_impact_type          ON impact_events(event_type, recorded_at);

-- ── Safety Reports ────────────────────────────────────────────────────────────
CREATE TABLE safety_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id         UUID NOT NULL REFERENCES users(id),
    reported_user_id    UUID NOT NULL REFERENCES users(id),
    match_id            UUID REFERENCES matches(id),
    session_id          UUID REFERENCES sessions(id),
    reason              TEXT NOT NULL,
    description         TEXT,
    evidence_text       TEXT,
    severity            safety_severity NOT NULL DEFAULT 'medium',
    status              safety_status DEFAULT 'open',
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    auto_suspended      BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_safety_open      ON safety_reports(status) WHERE status = 'open';
CREATE INDEX idx_safety_severity  ON safety_reports(severity, created_at);
CREATE INDEX idx_safety_reported  ON safety_reports(reported_user_id);
CREATE INDEX idx_safety_reports_reporter ON safety_reports(reporter_id) WHERE reporter_id IS NOT NULL;
CREATE INDEX idx_safety_reports_status ON safety_reports(status) WHERE status != 'resolved';
CREATE INDEX idx_mentor_profiles_sdg ON mentor_profiles(sdg_track) WHERE sdg_track IS NOT NULL;
CREATE INDEX idx_impact_events_user_type ON impact_events(user_id, event_type) WHERE user_id IS NOT NULL;

-- Flag critical safety reports for admin review (suspension handled manually)
CREATE OR REPLACE FUNCTION auto_suspend_on_critical()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity = 'critical' THEN
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
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id           UUID NOT NULL REFERENCES users(id),
    match_id            UUID REFERENCES matches(id),
    risk_score          FLOAT NOT NULL,
    flags               TEXT[] DEFAULT '{}',
    message_count       INTEGER DEFAULT 0,
    off_platform_attempts INTEGER DEFAULT 0,
    intimacy_flags      INTEGER DEFAULT 0,
    snapshot_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_mentor ON mentor_risk_snapshots(mentor_id, snapshot_at DESC);
CREATE INDEX idx_risk_score  ON mentor_risk_snapshots(risk_score DESC) WHERE risk_score > 0.3;

-- ── Notifications ──────────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,                     -- 'match_found','match_accepted','session_reminder','safety_alert'
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    action_url  TEXT,
    is_read     BOOLEAN DEFAULT false,
    channel     session_channel DEFAULT 'web',
    sent_at     TIMESTAMPTZ,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- =============================================================================
-- MIGRATION 006: Dashboard Views
-- =============================================================================

-- ── Institution Cohort Summary ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_institution_cohort_summary AS
SELECT
    i.id                AS institution_id,
    i.name              AS institution_name,
    i.country,
    i.subscription_plan,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'mentee' AND NOT u.is_deleted)  AS total_mentees,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'mentor' AND NOT u.is_deleted)  AS total_mentors,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active')                      AS active_matches,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')                  AS completed_programmes,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'pending')                     AS pending_matches,
    COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '4.4')                     AS sdg4_events,
    COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '5.5')                     AS sdg5_events,
    COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '8.6')                     AS sdg8_events,
    COUNT(DISTINCT s.id) FILTER (WHERE s.channel IN ('sms','ussd'))               AS offline_sessions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.channel = 'web')                        AS web_sessions,
    ROUND(AVG(COALESCE(m.mentee_satisfaction, 0))::numeric, 2)                   AS avg_mentee_satisfaction,
    MAX(m.created_at)                                                             AS last_activity
FROM institutions i
LEFT JOIN users u          ON u.institution_id = i.id
LEFT JOIN matches m        ON m.mentee_id = u.id
LEFT JOIN impact_events ie ON ie.institution_id = i.id
LEFT JOIN sessions s      ON s.match_id = m.id
GROUP BY i.id, i.name, i.country, i.subscription_plan;

-- ── SDG Impact Timeline ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_sdg_impact_timeline AS
SELECT
    institution_id,
    DATE_TRUNC('week', recorded_at) AS week,
    sdg_goal,
    COUNT(*)                         AS event_count
FROM impact_events
GROUP BY institution_id, DATE_TRUNC('week', recorded_at), sdg_goal
ORDER BY institution_id, week;

-- ── Active Match Details ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_active_matches AS
SELECT
    m.id                    AS match_id,
    m.status,
    m.sdg_track,
    m.match_score,
    m.match_reason,
    m.started_at,
    m.target_completed_at,
    u_mentee.id              AS mentee_id,
    mp_mentee.display_name  AS mentee_name,
    u_mentee.country        AS mentee_country,
    u_mentee.language       AS mentee_language,
    u_mentor.id              AS mentor_id,
    mp_mentor.display_name  AS mentor_name,
    mp_mentor.job_title,
    mp_mentor.industry,
    COUNT(s.id)             AS sessions_completed,
    MAX(s.completed_at)     AS last_session_at,
    m.institution_id
FROM matches m
JOIN users u_mentee           ON u_mentee.id = m.mentee_id
JOIN mentee_profiles mp_mentee ON mp_mentee.user_id = m.mentee_id
JOIN users u_mentor           ON u_mentor.id = m.mentor_id
JOIN mentor_profiles mp_mentor ON mp_mentor.user_id = m.mentor_id
LEFT JOIN sessions s          ON s.match_id = m.id AND s.completed = true
WHERE m.status IN ('active','pending')
GROUP BY m.id, u_mentee.id, mp_mentee.display_name, u_mentee.country, u_mentee.language,
         u_mentor.id, mp_mentor.display_name, mp_mentor.job_title, mp_mentor.industry;

-- ── Mentor Leaderboard ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_mentor_leaderboard AS
SELECT
    u.id                             AS mentor_id,
    mp.display_name,
    mp.job_title,
    mp.industry,
    mp.current_mentees,
    mp.total_mentees_served,
    mp.avg_mentee_outcome_score,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')                          AS programmes_completed,
    AVG(m.mentee_satisfaction) FILTER (WHERE m.mentee_satisfaction IS NOT NULL)            AS avg_satisfaction,
    u.institution_id
FROM mentor_profiles mp
JOIN users u ON u.id = mp.user_id
LEFT JOIN matches m ON m.mentor_id = u.id
WHERE mp.is_approved = true AND NOT u.is_deleted
GROUP BY u.id, mp.display_name, mp.job_title, mp.industry,
         mp.current_mentees, mp.total_mentees_served, mp.avg_mentee_outcome_score, u.institution_id;

-- =============================================================================
-- MIGRATION 007: Triggers & Automation
-- =============================================================================

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
CREATE TRIGGER trg_safety_reports_updated_at
    BEFORE UPDATE ON safety_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Mentor current_mentees counter ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_mentor_mentee_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE mentor_profiles
        SET current_mentees = current_mentees + 1
        WHERE user_id = NEW.mentor_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'pending') THEN
            UPDATE mentor_profiles
            SET current_mentees = GREATEST(0, current_mentees - 1)
            WHERE user_id = NEW.mentor_id;
        END IF;
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            UPDATE mentor_profiles
            SET total_mentees_served = total_mentees_served + 1
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
        NEW.login_count := COALESCE(OLD.login_count, 0) + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_login
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION record_login();