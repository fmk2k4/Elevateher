# ElevateHer — Shipping & Deploy Checklist

> Single-source, owner-aware pre-ship playbook for the ElevateHer platform.
> Last updated 2026-07-01. Audience: solo dev solo pull from main, judges demo.

For project overview, see [`README.md`](README.md).
For manual evidence capture, see [`VERIFICATION.md`](VERIFICATION.md).
For the security / agent / production audit backlog and fix status, see [`UPGRADE_PLAN.md`](UPGRADE_PLAN.md).
For container topology, see [`docker-compose.yml`](docker-compose.yml).

---

## TL;DR

ElevateHer is four deployed surfaces — a FastAPI backend (`services/api`), a Next.js mentee/mentor web app (`apps/web`), a Next.js B2B institution dashboard (`apps/dashboard`), and an Expo mobile client — packaged in a single `docker-compose.yml` with a Postgres+pgvector database, Redis, three Celery workers (safety / main / beat), and Flower. The whole stack comes up with `docker compose up -d` and is verified against `VERIFICATION.md`. Three supported deploy targets: **local dev**, **demo-day single host**, and **production split**.

---

## Pre-ship checklist

Owners: **Solo** = the dev/judge-ready bar. Complete all phases in order; Phase A and Phase C are hard gates.

### Phase A — Secrets & config (BLOCK until complete)

- [ ] `.env` filled with real production values for every key in `.env.example` (Solo)
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `JWT_SECRET`
  - [ ] `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`
  - [ ] `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`
  - [ ] `GEMINI_API_KEY`
  - [ ] `RESEND_API_KEY`
  - [ ] `SENTRY_DSN`
- [ ] All five tokens rotated to fresh random secrets (Solo)
  - [ ] `JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))")` (Solo)
  - [ ] `POSTGRES_PASSWORD` rotated (Solo)
  - [ ] `REDIS_PASSWORD` rotated (Solo)
  - [ ] `FLOWER_PASSWORD` rotated (Solo)
  - [ ] `DASHBOARD_SERVICE_TOKEN` rotated — generate a **new** token for production, **do not reuse** the dev value from `.env.local` (Solo)
- [ ] Every `your-...-here` placeholder in `.env` is replaced (Solo)

### Phase B — Domain, CORS, TLS

- [ ] `services/api/main.py::_get_cors_origins()` includes all production origins (`https://elevateher.app`, `https://*.elevateher.app`, `https://dashboard.elevateher.app`) (Solo)
- [ ] `apps/dashboard/app/api/dashboard/[...path]/route.ts` forwards auth server-side using `DASHBOARD_SERVICE_TOKEN` (Solo)
- [ ] DNS `A` / `CNAME` records point `elevateher.app` and `*.elevateher.app` at the deployment target (Solo)
- [ ] TLS issued (Let's Encrypt or managed) — **never ship HTTP-only** (Solo)
- [ ] HSTS preload list considered for primary domain (Solo)

### Phase C — Models & AI

- [ ] HuggingFace models staged on host (`python scripts/download_models.py`) — ~4.4 GB total; SEA-LION-E5 + Phi-3 Q4 (Solo)
- [ ] `ENABLE_AGENTIC_LAYER=true` set **only** if Phi-3 GGUF is present, else `false` to stay on Gemini/keyword fallback (Solo)
- [ ] `ELEVATEHER_DISABLE_SAFETY_MODEL` **unset** in production. Dev/test only — see UPGRADE_PLAN B6 (Solo)
- [ ] Fallback paths exercised end-to-end at least once: regex + Gemini API for agent, TF-IDF for matching, pattern scan for safety (Solo)
  - [ ] Confirmed: `services/safety/bio_classifier.py::OFF_PLATFORM_PATTERNS` covers all 15+ platforms (Solo)
  - [ ] Confirmed: matching returns `model_available:false`, `match_score:null` with a warning when the SEA-LION model is absent (Solo)

### Phase D — Database

- [ ] Postgres 16 + pgvector provisioned (managed Neon/Supabase in prod, container in demo) (Solo)
- [ ] Migrations applied in order (Solo)
  - [ ] `alembic upgrade head`
  - [ ] Apply `services/db/migrations/000_auth_js.sql`
  - [ ] Apply `services/db/migrations/001_schema.sql`
  - [ ] Apply `services/db/migrations/002_rls.sql`
- [ ] Seed-data decision recorded (Solo)
  - [ ] Production: **do not** run `scripts/seed_demo_data.py`
  - [ ] Demo-day: run `docker exec elevateher_api python scripts/seed_demo_data.py` (target: 34 mentors, 32 mentees, 2 matches, 4 sessions, 5 impact events)
- [ ] Backups enabled — nightly `pg_dump` to object storage, retention ≥ 30 days, restore drill documented (Solo)

### Phase E — Services running

- [ ] Clean start on the target host (Solo)
  - [ ] `docker compose up -d` → all 8 containers `healthy` via `docker compose ps`
  - [ ] `curl http://localhost:8000/health` → `{"status":"healthy",...}`
- [ ] Dashboard renders for a real subdomain: `curl http://localhost:3001/inti/overview` returns HTML
- [ ] `/docs` (FastAPI Swagger) **disabled** in production OR auth-gated behind `DASHBOARD_SERVICE_TOKEN` (Solo)
- [ ] `/ussd/safety` webhook auth-gated by `require_moderator` (Solo)

### Phase F — Security hardening

- [ ] Rate limits active on `/auth`, `/api`, `/ussd` (Solo)
- [ ] CORS allowlist matches Phase B (Solo)
- [ ] Sentry FastAPI integration wired with `SENTRY_DSN` (Solo)
- [ ] `JWT_ALGORITHM` pinned (`HS256` for single host, `RS256` if JWKS is introduced) (Solo)
- [ ] Dashboard security headers on every response (Solo)
  - [ ] `Content-Security-Policy`
  - [ ] `Strict-Transport-Security`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `Permissions-Policy`
- [ ] Trusted proxy IPs configured so `X-Forwarded-For` is honored only from known proxies (Solo)

### Phase G — Monitoring & observability

- [ ] Sentry DSN live; sample FastAPI request triggered to confirm ingest (Solo)
- [ ] `/health` scraped from external uptime monitor (Uptime Kuma / Better Stack / Healthchecks) at 60-second cadence (Solo)
- [ ] Flower reachable behind `FLOWER_USER` / `FLOWER_PASSWORD` basic-auth; not exposed publicly (Solo)
- [ ] Logs volume mounted to the host (or shipped via Loki / Datadog / CloudWatch) with 14-day retention (Solo)

### Phase H — Verification

- [ ] Run **V0 → V6** from [`VERIFICATION.md`](VERIFICATION.md) and capture `curl` outputs plus `psql` query results as pre-demo evidence (Solo)
- [ ] V6 cleanup grep pass exits clean (`grep -rn '"SAFE":\s*0\.9' services/safety services/api/services`) (Solo)
- [ ] `docker scout quickview elevateher_api` returns **no HIGH/CRITICAL** vulns — gate on this in CI per UPGRADE_PLAN M12 (Solo)

---

## Deploy targets

### 1. Local dev

```bash
cp .env.example .env
docker compose up --build -d
docker exec elevateher_api alembic upgrade head
docker exec elevateher_api python scripts/seed_demo_data.py
python scripts/download_models.py   # one-time, ~4.4 GB
```

Verified when V0 of `VERIFICATION.md` passes.

### 2. Demo-day (single-host VM / Render / Railway)

- Deploy `docker-compose.yml` as-is on a single VM with ≥ 8 GB RAM and ≥ 20 GB disk.
- Replace every `?Set X` value with prod-grade secrets.
- Expose **3000**, **3001**, **8000**, **5555** behind a reverse proxy (Caddy / nginx) terminating TLS.
- Use SQLite -> Postgres + Redis persistence (the volumes `pgdata`, `redisdata`) for the demo window; take a snapshot before judging.
- Monitor via **Flower** (gated) and **Sentry**.

### 3. Production split (recommended)

```yaml
api.elevateher.app        → Railway / Render / Fly  (Docker image from infra/docker/api.Dockerfile)
web.elevateher.app        → Vercel  (apps/web)
dashboard.elevateher.app  → Vercel  (apps/dashboard)
                          (also serve Expo mobile build via EAS / App Center / Play Console)
db                        → Managed Postgres + pgvector (Neon, Supabase, or AlloyDB)
redis                     → Managed Redis (Upstash) over rediss://
celery (safety + main)    → Same image as api, separate Fly/Railway services
celery beat               → Single instance, same image
flower                    → Internal-only — admin VPN or SSH-tunneled
object storage (backups)  → S3 / Cloud Storage R2 with lifecycle rules
cdn / waf                 → Cloudflare in front of Vercel and the api host
```

Notes:
- Pin Python 3.12-slim in every Dockerfile (`infra/docker/api.Dockerfile` already does).
- Use managed TLS for every public endpoint; do not terminate in the app container.
- Apply migrations during deploy via a `release` command, not at app startup.
- Rotate secrets in the manager UI (Railway / Fly / Vercel), not in `.env` files checked into the repo.

---

## CI/CD

The current pipeline lives in `.github/workflows/`:

- [`ci.yml`](.github/workflows/ci.yml) — Python unit tests (`pytest services/api/tests/unit`) plus `apps/web` and `apps/dashboard` Next.js builds.
- [`deploy.yml`](.github/workflows/deploy.yml) — Railway service deploy + Vercel project deploys on `main`.

Upgrade plan (see `UPGRADE_PLAN.md` M12):

- [ ] Add `docker compose build` step on PRs (Solo)
- [ ] Add `trivy image` or `docker scout quickview elevateher_api`; fail on HIGH/CRITICAL (Solo)
- [ ] Add `scripts/download_models.py` smoke run only on tag events (Solo)
- [ ] Add Lighthouse CI for the dashboard so accessibility regressions are caught (Solo)

---

## Demo-day runbook (3 hours before judging)

- [ ] `docker compose up -d`; wait for `docker compose ps` to show all 8 containers `healthy`
- [ ] Run **V0 pre-flight** from `VERIFICATION.md`; capture outputs
- [ ] `curl http://localhost:8000/health` returns `healthy`
- [ ] Open `http://localhost:3001` in the browser → confirm **INTI / NYP / BINUS / Prince of Songkla / Kansai / Teesside** all show non-zero stats in the overview widget
- [ ] **V1 live** — open the matching endpoint / dashboard panel; show `model_available:true` and a dynamic `match_reason`
- [ ] **V2 live** — open `scratch/ussd_simulator.html`; dial `*384#`; run a new-mentee and a returning-user flow
- [ ] **V5 ready** — pre-populate a moderator JWT; have the safety endpoints page open for moderator-driven demo
- [ ] Pre-stage helper scripts on the host so you can re-run on demand:
  - `python tmp_check.py`
  - `python verify_models.py`
- [ ] Keep a notebook tab open with V0 → V5 expected-output tables to answer judge questions
- [ ] Two browser windows side by side: public mentee web (`localhost:3000`) and dashboard (`localhost:3001`)
- [ ] In offline-model fallback demo (if HuggingFace was unreachable), explicitly narrate: *"regex + Gemini fallback"* — don't let it look like a regression

---

## Rollback plan

| Layer | Action |
|-------|--------|
| Containers (state loss) | `docker compose down` then re-deploy the previous `docker compose pull` tag |
| Database | `alembic downgrade -1` (or to the matching revision tag), then restart the previous API / worker image tag |
| Frontend (web, dashboard) | Vercel **Instant Rollback** from the Deployments tab |
| Celery workers | `docker compose pull <prev-tag>` then `docker compose up -d celery_main_worker celery_safety_worker celery_beat` |
| Seeds / demo content | Re-run `scripts/seed_demo_data.py` after rollback; the script is idempotent on UUIDs but **will duplicate** if you change `id` columns — wipe the database volume first for a clean demo |

Always announce in the demo Slack / status page **before** rolling back, and keep at least one previous image tag pinned in your registry.

---

## Open shipping risks (post-fix status summary)

Resolved this round (see `UPGRADE_PLAN.md`):

- ✅ **B6** Safety classifier no longer returns `SAFE: 0.9` when the model is unavailable — degraded mode now blocks auto-approval and routes to human review (`is_safety_model_available()` is checked in `/health`).
- ✅ **B7** Celery tasks now call the real `services.agent.summariser` (Phi-3 GGUF in-process → HTTP API → Gemini → default).
- ✅ **C10** Dashboard uses a service-token-aware fetch wrapper so `Authorization: Bearer ${DASHBOARD_SERVICE_TOKEN}` is sent on every request.
- ✅ **C11** Dashboard route no longer has a double `/dashboard` prefix — exactly one of `main.py` mount and `dashboard.py` router declares it.
- ✅ **H11** Message safety scanner uses the full `OFF_PLATFORM_PATTERNS` dictionary (15+ platforms + regex).
- ✅ **H12** Embedding model exposes `model_available`; degraded mode returns `match_score:null` with a warning.
- ✅ **H13** Temporal alerts auto-dispatch `handle_critical_safety_flag` plus a Celery beat sweep of `temporal_alert:*`.
- ✅ **H17** Both Next.js apps have `error.tsx` and `not-found.tsx` boundaries.

Remaining before a public launch (not blocking demo day):

- ⚠️ **H14** Celery safety queue still shares the main worker image; consider a dedicated host for the safety worker under sustained SMS load.
- ⚠️ **H15** Phi-3 / Gemini summarisation still caps at the first 3 000 chars; chunked summarisation not yet shipped.
- ⚠️ **M13** Redis traffic is unencrypted on the Docker network (`redis://`). Production requires `rediss://` or a sidecar.
- ⚠️ **M12 / M14** `docker compose build` + image scan not in CI; `scripts/download_models.py` lacks retries. Tracked for CI hardening this week.
- ⚠️ **L4** Pagination not yet present on mentor / mentee list endpoints; admin endpoints already paginate.
- ⚠️ **L10** `apps/web` still has limited route coverage — React Router pages for login / onboarding / matches / chat are in progress.

Items tracked only for completeness: L5, L9, L11–L18 from `UPGRADE_PLAN.md`. None are demo-day blockers.

---

*Keep this document in sync with `UPGRADE_PLAN.md`. When a fix lands, update both files in the same PR.*
