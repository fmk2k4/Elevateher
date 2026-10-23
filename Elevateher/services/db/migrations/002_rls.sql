-- =============================================================================
-- MIGRATION 002: Row-Level Security Policies
-- =============================================================================
-- IMPORTANT: These RLS policies require application-level middleware to set
-- PostgreSQL session variables BEFORE each request:
--
--   SET app.user_id = '<uuid>';
--   SET app.role = '<role>';
--   SET app.institution_id = '<uuid>';
--
-- The Next.js web app uses Neon (direct PostgreSQL). To use RLS with Neon:
--   Option A: Use Supabase (automatic RLS session binding)
--   Option B: Add a Neon proxy that injects SET commands per request
--   Option C: Disable RLS for now and enforce at application layer
--
-- For the hackathon demo: enforce RLS at the application layer (API routes).
-- After demo, migrate to Supabase or add a proxy layer.
-- =============================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentee_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions      ENABLE ROW LEVEL SECURITY;

-- ── Users RLS ────────────────────────────────────────────────────────────────
-- Users can read/update their own row
CREATE POLICY users_own_row ON users
    FOR ALL USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Institution admins and super-admins can see all users in their institution
CREATE POLICY users_institution_read ON users
    FOR SELECT USING (
        institution_id = NULLIF(current_setting('app.institution_id', true), '')::uuid
        AND NULLIF(current_setting('app.role', true), '') IN ('institution_admin','moderator','admin')
    );

CREATE POLICY users_super_admin ON users
    FOR ALL USING (NULLIF(current_setting('app.role', true), '') = 'admin');

-- ── Mentee Profiles RLS ───────────────────────────────────────────────────────
-- Mentee can read/update their own profile
CREATE POLICY mentee_own ON mentee_profiles
    FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Mentor can read mentee profile if they have an active/pending match
CREATE POLICY mentee_mentor_read ON mentee_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.mentee_id = mentee_profiles.user_id
              AND m.mentor_id = NULLIF(current_setting('app.user_id', true), '')::uuid
              AND m.status IN ('pending','active')
        )
    );

-- ── Mentor Profiles RLS ─────────────────────────────────────────────────────
CREATE POLICY mentor_own ON mentor_profiles
    FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Mentee can read approved mentor profiles (for candidate selection)
CREATE POLICY mentor_public_read ON mentor_profiles
    FOR SELECT USING (is_approved = true AND is_active = true);

-- ── Matches RLS ───────────────────────────────────────────────────────────────
-- Both parties can see their matches
CREATE POLICY matches_own_party ON matches
    FOR ALL USING (
        mentee_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        OR mentor_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    );

-- Institution admins can see matches within their institution
CREATE POLICY matches_institution ON matches
    FOR SELECT USING (
        institution_id = NULLIF(current_setting('app.institution_id', true), '')::uuid
        AND NULLIF(current_setting('app.role', true), '') IN ('institution_admin','admin')
    );

-- ── Sessions RLS ─────────────────────────────────────────────────────────────
CREATE POLICY sessions_match_party ON sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.id = sessions.match_id
              AND (m.mentee_id = NULLIF(current_setting('app.user_id', true), '')::uuid
                   OR m.mentor_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
        )
    );

-- ── Messages RLS ─────────────────────────────────────────────────────────────
CREATE POLICY messages_match_party ON session_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = session_messages.session_id
              AND (m.mentee_id = NULLIF(current_setting('app.user_id', true), '')::uuid
                   OR m.mentor_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
        )
    );

-- ── Impact Events RLS ────────────────────────────────────────────────────────
-- INSERT is handled by application layer (uses user_id from token)
CREATE POLICY impact_own ON impact_events
    FOR SELECT USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY impact_institution ON impact_events
    FOR SELECT USING (
        institution_id = NULLIF(current_setting('app.institution_id', true), '')::uuid
        AND NULLIF(current_setting('app.role', true), '') IN ('institution_admin','admin')
    );

-- ── User Passwords RLS ─────────────────────────────────────────────────────────
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_passwords_own ON user_passwords
    FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- ── App Auth Sessions RLS ──────────────────────────────────────────────────────
ALTER TABLE app_auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_auth_sessions_own ON app_auth_sessions
    FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- ── Guardian Consents RLS ───────────────────────────────────────────────────────
ALTER TABLE guardian_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardian_consents_own ON guardian_consents
    FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- ── Auth Accounts RLS ──────────────────────────────────────────────────────────
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_accounts_own ON auth_accounts
    FOR ALL USING ("userId" = NULLIF(current_setting('app.user_id', true), '')::text);

-- ── Auth Verification Tokens RLS ───────────────────────────────────────────────
ALTER TABLE auth_verification_token ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_verification_token_own ON auth_verification_token
    FOR SELECT USING (
        identifier = (SELECT email FROM auth_users WHERE id = NULLIF(current_setting('app.user_id', true), '')::text)
    );

-- ── Mentor Risk Snapshots RLS ──────────────────────────────────────────────────
ALTER TABLE mentor_risk_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY mentor_risk_snapshots_own ON mentor_risk_snapshots
    FOR ALL USING (mentor_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- ── Safety Reports RLS ───────────────────────────────────────────────────────
-- Only admins/moderators can see all safety reports
CREATE POLICY safety_admin_read ON safety_reports
    FOR SELECT USING (
        NULLIF(current_setting('app.role', true), '') IN ('admin','institution_admin','moderator')
    );

-- Users can see their own reports
CREATE POLICY safety_own ON safety_reports
    FOR SELECT USING (reporter_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- ── Notifications RLS ────────────────────────────────────────────────────────
CREATE POLICY notifications_own ON notifications
    FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- ── Auth Users RLS ───────────────────────────────────────────────────────────
-- Note: auth_users table is managed by Auth.js. Additional policies here are
-- for app-layer separation.
CREATE POLICY auth_users_own ON auth_users
    FOR ALL USING (id::uuid = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY auth_users_admin ON auth_users
    FOR ALL USING (NULLIF(current_setting('app.role', true), '') = 'admin');

-- ── Auth Sessions RLS ─────────────────────────────────────────────────────────
CREATE POLICY auth_sessions_own ON auth_sessions
    FOR ALL USING ("userId" = NULLIF(current_setting('app.user_id', true), ''));