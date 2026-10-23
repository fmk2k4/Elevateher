-- =============================================================================
-- MIGRATION 003: Phase 6 — Provenance & Connectivity Class
-- =============================================================================
-- Adds structured provenance fields to impact_events so the impact ledger
-- becomes a verifiable audit trail, not just a reporting table.
--
-- New fields:
--   source            — channel that originated the event (web|ussd|moderator|auto-inferred|mentor-confirmed)
--   evidence_type     — type of supporting evidence (session_record|self_reported|moderator_created|etc.)
--   confidence        — data quality (high|medium|low)
--   reviewer_status   — moderation state (pending|verified|flagged)
--   connectivity_class — delivery context (online|low_connectivity|offline)
--
-- Backfill: existing events get source='api' and defaults for the rest.
-- =============================================================================

BEGIN;

-- ── 1. Add provenance & connectivity_class columns ────────────────────────────
ALTER TABLE impact_events
  ADD COLUMN IF NOT EXISTS source            TEXT NOT NULL DEFAULT 'auto-inferred',
  ADD COLUMN IF NOT EXISTS evidence_type     TEXT NOT NULL DEFAULT 'session_record',
  ADD COLUMN IF NOT EXISTS confidence        TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS reviewer_status   TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS connectivity_class TEXT NOT NULL DEFAULT 'online';

-- Backfill existing rows (they were created via API/admin, so 'api' is honest)
UPDATE impact_events
SET    source = 'web'
WHERE  source = 'auto-inferred';

-- ── 2. Add indexes for Phase 6 dashboard queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_impact_source
       ON impact_events(institution_id, source, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_impact_reviewer_status
       ON impact_events(institution_id, reviewer_status, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_impact_connectivity
       ON impact_events(institution_id, connectivity_class, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_impact_sdg_provenance
       ON impact_events(institution_id, sdg_goal, source, recorded_at DESC);

-- ── 3. Program progression view ─────────────────────────────────────────────────
-- Tracks mentees through the journey: registered → matched → active → completed
DROP VIEW IF EXISTS v_program_progression;
CREATE VIEW v_program_progression AS
SELECT
    i.id                                              AS institution_id,
    i.name                                            AS institution_name,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'mentee')                    AS total_mentees,
    COUNT(DISTINCT u.id) FILTER (
        WHERE u.role = 'mentee'
        AND EXISTS (SELECT 1 FROM matches m WHERE m.mentee_id = u.id AND m.status = 'pending')
    )                                                                       AS mentees_pending_match,
    COUNT(DISTINCT u.id) FILTER (
        WHERE u.role = 'mentee'
        AND EXISTS (SELECT 1 FROM matches m WHERE m.mentee_id = u.id AND m.status = 'active')
    )                                                                       AS mentees_in_active_match,
    COUNT(DISTINCT u.id) FILTER (
        WHERE u.role = 'mentee'
        AND EXISTS (
            SELECT 1 FROM matches m
            JOIN sessions s ON s.match_id = m.id
            WHERE m.mentee_id = u.id AND s.completed = true
        )
    )                                                                       AS mentees_with_completed_sessions,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')               AS completed_programs,
    ROUND(
        COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')::numeric
        / NULLIF(COUNT(DISTINCT m.id), 0)::numeric * 100,
        1
    )                                                                       AS program_completion_rate,
    -- SDG track breakdown
    COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' AND m.sdg_track = 'STEM'
    )                                                                       AS stem_completions,
    COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' AND m.sdg_track = 'Business'
    )                                                                       AS business_completions,
    COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' AND m.sdg_track = 'Trades'
    )                                                                       AS trades_completions,
    COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' AND m.sdg_track = 'Creative'
    )                                                                       AS creative_completions
FROM institutions i
LEFT JOIN users   u ON u.institution_id = i.id AND NOT u.is_deleted
LEFT JOIN matches m ON m.mentee_id = u.id
GROUP BY i.id, i.name;

-- ── 4. Offline reach metrics view ──────────────────────────────────────────────
DROP VIEW IF EXISTS v_offline_reach;
CREATE VIEW v_offline_reach AS
SELECT
    ie.institution_id,
    COUNT(*)                                        AS total_events,
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'offline')        AS offline_events,
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'low_connectivity') AS low_conn_events,
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'online')          AS online_events,
    ROUND(
        COUNT(*) FILTER (WHERE ie.connectivity_class IN ('offline','low_connectivity'))::numeric
        / NULLIF(COUNT(*), 0)::numeric * 100,
        1
    )                                                                       AS offline_percentage,
    -- Offline by SDG goal
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'offline' AND ie.sdg_goal = '4.4') AS offline_sdg4,
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'offline' AND ie.sdg_goal = '5.5') AS offline_sdg5,
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'offline' AND ie.sdg_goal = '8.6') AS offline_sdg8,
    -- Offline by source channel
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'offline' AND ie.source = 'ussd')    AS ussd_events,
    COUNT(*) FILTER (WHERE ie.connectivity_class = 'offline' AND ie.source = 'moderator') AS moderator_events
FROM impact_events ie
GROUP BY ie.institution_id;

-- ── 5. Mentor utilization view ─────────────────────────────────────────────────
DROP VIEW IF EXISTS v_mentor_utilization;
CREATE VIEW v_mentor_utilization AS
SELECT
    u.institution_id,
    COUNT(DISTINCT mp.user_id)                                                       AS total_mentors,
    COUNT(DISTINCT mp.user_id) FILTER (
        WHERE EXISTS (SELECT 1 FROM matches m WHERE m.mentor_id = mp.user_id AND m.status = 'active')
    )                                                                               AS active_mentors,
    COUNT(DISTINCT mp.user_id) FILTER (
        WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.mentor_id = mp.user_id)
    )                                                                               AS unused_mentors,
    -- Capacity: mentors who have room for more mentees (≤3 active matches)
    COUNT(DISTINCT mp.user_id) FILTER (
        WHERE (
            SELECT COUNT(*) FROM matches m2
            WHERE m2.mentor_id = mp.user_id AND m2.status = 'active'
        ) <= 3
    )                                                                               AS mentors_with_capacity,
    -- Total active mentee slots
    COALESCE(SUM(
        (SELECT COUNT(*) FROM matches m3
         WHERE m3.mentor_id = mp.user_id AND m3.status = 'active')
    ), 0)                                                                            AS total_active_mentees,
    -- Avg sessions per mentor
    ROUND(
        COALESCE(AVG(
            (SELECT COUNT(*) FROM sessions s2
             WHERE s2.match_id IN (SELECT id FROM matches m4 WHERE m4.mentor_id = mp.user_id) AND s2.completed = true)
        ), 0)::numeric, 2
    )                                                                               AS avg_completed_sessions_per_mentor
FROM mentor_profiles mp
JOIN users u ON u.id = mp.user_id
GROUP BY u.institution_id;

-- ── 6. Safety intervention rate view ─────────────────────────────────────────
DROP VIEW IF EXISTS v_safety_intervention_rate;
CREATE VIEW v_safety_intervention_rate AS
SELECT
    COALESCE(m.institution_id, u_rep.institution_id) AS institution_id,
    COUNT(*)                                              AS total_reports,
    COUNT(*) FILTER (WHERE sr.status = 'open')            AS open_reports,
    COUNT(*) FILTER (WHERE sr.status = 'reviewing')       AS under_review,
    COUNT(*) FILTER (WHERE sr.status = 'resolved')         AS resolved,
    COUNT(*) FILTER (WHERE sr.severity = 'high')          AS high_severity,
    COUNT(*) FILTER (WHERE sr.severity = 'critical')      AS critical,
    ROUND(
        COUNT(*) FILTER (WHERE sr.status = 'resolved')::numeric
        / NULLIF(COUNT(*), 0)::numeric * 100,
        1
    )                                                     AS resolution_rate,
    ROUND(
        COUNT(*) FILTER (WHERE sr.status IN ('resolved','reviewing'))::numeric
        / NULLIF(COUNT(*), 0)::numeric * 100,
        1
    )                                                     AS intervention_rate
FROM safety_reports sr
LEFT JOIN matches m    ON m.id     = sr.match_id
LEFT JOIN users   u_rep ON u_rep.id = sr.reported_user_id
GROUP BY COALESCE(m.institution_id, u_rep.institution_id);

-- ── 7. Outcome velocity view ──────────────────────────────────────────────────
-- Days from first session to first milestone, broken down by track and geography
DROP VIEW IF EXISTS v_outcome_velocity;
CREATE VIEW v_outcome_velocity AS
SELECT
    m.institution_id,
    m.sdg_track,
    u.country,
    COUNT(DISTINCT m.id)                                    AS total_matches,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS completed_matches,
    ROUND(
        COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')::numeric
        / NULLIF(COUNT(DISTINCT m.id), 0)::numeric * 100,
        1
    )                                                        AS completion_rate,
    -- Avg days to first completed session
    ROUND(
        COALESCE(AVG(
            EXTRACT(EPOCH FROM (
                (SELECT MIN(s.completed_at) FROM sessions s WHERE s.match_id = m.id AND s.completed = true)
                - m.created_at
            )) / 86400
        ), 0)::numeric, 1
    )                                                        AS avg_days_to_first_session,
    -- Avg days to milestone (first impact event per match)
    ROUND(
        COALESCE(AVG(
            EXTRACT(EPOCH FROM (
                (SELECT MIN(ie.recorded_at) FROM impact_events ie WHERE ie.match_id = m.id)
                - m.created_at
            )) / 86400
        ), 0)::numeric, 1
    )                                                        AS avg_days_to_first_milestone,
    -- Avg match quality score
    ROUND(AVG(m.match_score)::numeric, 3)                   AS avg_match_quality
FROM matches m
JOIN users u ON u.id = m.mentee_id
GROUP BY m.institution_id, m.sdg_track, u.country;

COMMIT;