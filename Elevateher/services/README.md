# ElevateHer Python Services

## Architecture

The web app (`apps/web`) uses **Neon Serverless PostgreSQL** via `@neondatabase/serverless` as its primary database. This `services/` directory provides:

1. **Database migrations** (`db/`) — PostgreSQL schema, RLS policies, seed scripts
2. **Matching engine** (`matching/`) — SEA-LION embeddings + pgvector HNSW search
3. **Safety layer** (`safety/`) — SEA-Guard bio classifier + temporal grooming detector
4. **Agent** (`agent/`) — Phi-3 session summariser (falls back to Gemini API)

## Quick Start

```bash
# 1. Install dependencies
pip install -r services/requirements.txt

# 2. Set environment variables
export DATABASE_URL="postgresql://user:pass@host/dbname"   # Neon connection string
export NEON_DATABASE_URL="postgresql://..."                # Alternative
export REDIS_URL="redis://localhost:6379"
export GEMINI_API_KEY="your-key"                          # Optional

# 3. Run database migrations
cd services
python -m alembic upgrade head

# Or via the web API: GET /api/seed-demo

# 4. Seed demo data
cd ..
python -m scripts.seed_demo_data

# 5. Health check
python -m scripts.db_health_check
```

## Services

### `services/db/migrations/001_schema.sql`
Complete PostgreSQL 16 schema:
- Auth.js adapter tables (`auth_users`, `auth_accounts`, `auth_sessions`, `auth_verification_token`)
- Application tables (`users`, `institutions`, `mentee_profiles`, `mentor_profiles`, `matches`, `sessions`, `session_messages`, `impact_events`, `safety_reports`, `notifications`, `mentor_risk_snapshots`)
- All enums (`user_role`, `match_status`, `sdg_track`, `safety_severity`, etc.)
- HNSW pgvector indexes on embedding columns (**1024-dim SEA-LION-E5-Embedding-600M**)
- Triggers for auto `updated_at`, mentor count, login recording
- Dashboard views (`v_institution_cohort_summary`, `v_sdg_impact_timeline`, etc.)

### `services/db/migrations/002_rls.sql`
Row-Level Security policies. **Requires middleware to set session variables** per request. See file header for details on Supabase vs. custom proxy options.

### `services/matching/embedder.py`
Generates **1024-dim** SEA-LION-E5-Embedding-600M embeddings from mentee/mentor profile text via `sentence-transformers`. Falls back to deterministic mock vectors if model is unavailable.

### `services/matching/matcher.py`
Cosine similarity search using pgvector HNSW index. `find_top_mentors()` returns ranked mentor candidates for a mentee.

### `services/safety/bio_classifier.py`
SEA-Guard multilingual safety scanner for mentor bios. Checks for:
- Off-platform contact solicitation (multilingual: EN, MS, ID, TH)
- Intimacy escalation patterns
- Grooming language

### `services/safety/temporal_detector.py`
Redis-backed 48-hour rolling window temporal risk tracker. Accumulates risk signals per match. Generates alerts at risk ≥ 0.3 (medium), ≥ 0.5 (high), ≥ 0.8 or 2+ off-platform attempts (critical).

### `services/agent/summariser.py`
Phi-3 / Gemini session summariser. Generates:
- 2-3 sentence session summary
- 3 suggested follow-up questions for the mentor
- Milestone detection
- SDG goals covered
- Mentee sentiment

## Scripts

```bash
# Seed demo data
python -m scripts.seed_demo_data

# Health check
python -m scripts.db_health_check

# USSD simulator (requires dev server)
cd apps/web && npm run dev
python -m scripts.ussd_simulator
```

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Database | Neon Serverless PostgreSQL 16 | `@neondatabase/serverless` |
| Auth | Auth.js v5 (`@auth/core`) | Credentials provider with Argon2 |
| AI Embedding | SEA-LION-E5-Embedding-600M | `sentence-transformers`, falls back gracefully |
| Safety | SEA-Guard + regex pre-scan | `transformers`, multilingual patterns |
| Agent | Phi-3 mini Q4 / Gemini API | Session summarisation |
| Vector Index | pgvector HNSW | `m=16, ef_construction=64` |
| Session Store | Redis (Upstash) | Temporal risk tracking |
| Task Queue | Celery + Redis | Async embedding, safety scans |
| API | React Router (web app API routes) | Neon direct queries |

## Database Schema

```
auth_users ──── auth_accounts
      │               │
      └── auth_sessions ───────────────┐
                                       │
users ─── user_passwords               │
      │                                 │
      ├── guardian_consents             │
      ├── auth_sessions                │
      │                                 │
      ├── institutions ────────────────┤
      │                                 │
      ├── mentee_profiles (1:1) ─────────┤
      │                                 │
      ├── mentor_profiles (1:1) ───────────┤
      │                                   │
      └── matches ──────────────────┐    │
            │                        │    │
            ├── sessions ────────────┤────┤
            │    │                   │    │
            │    └── session_messages    │
            │                            │
            ├── impact_events            │
            ├── safety_reports           │
            └── mentor_risk_snapshots ────┘