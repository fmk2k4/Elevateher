# ElevateHer Codebase Audit

Date: 2026-07-04

## Executive Summary

ElevateHer has enough implemented surface area to deliver a strong hackathon demo, but it is not production-ready and it is not yet judge-safe by default.

The strongest parts of the repo are:

- a convincing mission-driven landing page
- a real multi-surface product concept: public web app, institution dashboard, USSD simulator, Python API, AI matching, safety, and analytics
- an actual database schema and backend router structure rather than pure mock screens

The highest-risk issues are:

- first-run and deployment reliability are weak
- several key dashboard/backend routes have runtime bugs
- the demo path is too broad, with unfinished routes that judges can easily click into
- documentation and previous audit artifacts overstate readiness

## Audit Verdict

### Hackathon demo readiness

Score: **68/100**

Interpretation:

- strong concept and enough visible product depth to impress
- too many brittle points for an uncontrolled live demo
- can become demo-ready quickly if the team narrows the path and fixes a handful of high-impact issues

### Production readiness

Score: **41/100**

Interpretation:

- architecture exists
- operational discipline, deployment reliability, auth/session hardening, and validation coverage are not sufficient for production claims

## What Is Actually Built

### User-facing surfaces that are real

#### Public web app

The web app has meaningful screens and flows, not just placeholders:

- landing page with product pitch, SDG framing, partners, and calls to action in `apps/web/src/app/page.jsx`
- sign-in and sign-up screens in `apps/web/src/app/account/signin/page.jsx` and `apps/web/src/app/account/signup/page.jsx`
- onboarding for mentees and mentors in `apps/web/src/app/onboarding/page.jsx`
- mentee dashboard, mentor discovery, matches, and impact pages in `apps/web/src/app/mentee/**`
- mentor dashboard in `apps/web/src/app/mentor/dashboard/page.jsx`
- session chat surface in `apps/web/src/app/session/[id]/page.jsx`
- institution dashboard page in `apps/web/src/app/institution/dashboard/page.jsx`
- USSD simulator in `apps/web/src/app/ussd-simulator/page.jsx`

#### Institution dashboard app

The separate dashboard app is also substantial:

- overview page in `apps/dashboard/app/[subdomain]/overview/page.tsx`
- mentors, mentees, matches, impact, safety, analytics, and reports pages in `apps/dashboard/app/[subdomain]/**`
- institution layout and navigation in `apps/dashboard/app/[subdomain]/layout.tsx`
- API proxy routes in `apps/dashboard/app/api/**`

#### Backend and data layer

The backend is not imaginary. It includes:

- FastAPI app and middleware stack in `services/api/main.py`
- auth, mentor, mentee, match, session, impact, admin, dashboard, safety, privacy, and USSD routers under `services/api/routers/`
- SQL-first schema in `services/db/migrations/001_schema.sql`
- RLS policies in `services/db/migrations/002_rls.sql`
- Celery workers and Redis-backed async infrastructure via `docker-compose.yml`

## What Is Wrong Right Now

## 1. Runtime bugs that can break the demo

### 1.1 Dashboard backend uses `user.email` even though `CurrentUser` does not provide it

Evidence:

- `services/api/routers/dashboard.py:104`
- `services/api/routers/dashboard.py:213`
- `services/api/dependencies.py:44`

Problem:

`get_user_dashboard_stats()` and `get_mentor_weekly_brief_data()` query the database using `user.email`, but `CurrentUser` only carries `id`, `role`, `institution_id`, `age`, and `guardian_consented`.

Impact:

- authenticated dashboard stats can fail with `AttributeError`
- mentor weekly brief flow can fail even when login succeeds

### 1.2 Mentor weekly brief query references a non-existent column

Evidence:

- `services/api/routers/dashboard.py:232`
- `services/db/migrations/001_schema.sql:337`

Problem:

The query selects `m.sessions_completed`, but the `matches` table does not define that column.

Impact:

- mentor weekly brief endpoint is likely broken at SQL execution time

### 1.3 Dashboard reports page is broken in the frontend

Evidence:

- `apps/dashboard/app/[subdomain]/reports/page.tsx:66`

Problem:

The page renders `reportData`, but only `reportUrl` state is declared and assigned.

Impact:

- the Reports page is an immediate judge click-trap
- likely compile-time or runtime failure depending on current build state

### 1.4 Session/chat page is only partially wired

Evidence:

- `apps/web/src/app/session/[id]/page.jsx:117`
- `apps/web/src/app/session/[id]/page.jsx:119`
- `apps/web/src/app/session/[id]/page.jsx:120`

Problem:

The session page starts a fetch for session info but does not actually use the response. `otherPartyName` stays placeholder-grade, and `sessionInfo` is never meaningfully populated.

Impact:

- chat looks less real than the rest of the product
- judge confidence drops if this route is shown live

### 1.5 Web `/api/health` requires auth, which makes it a poor demo probe

Evidence:

- `apps/web/src/app/api/health/route.js`
- `apps/web/src/app/api/utils/backend.js:22`

Problem:

The frontend health route proxies through `proxyJsonToBackend()`, which rejects unauthenticated requests.

Impact:

- contradicts the intuitive expectation of a public health endpoint
- makes smoke-checking from the frontend awkward

## 2. Operational gaps that make first-run and demo setup brittle

### 2.1 Docker does not automatically apply migrations

Evidence:

- `infra/docker/api.Dockerfile:25`
- `docker-compose.yml:35`

Problem:

The API container starts `uvicorn`, but no migration step runs automatically in container startup or compose orchestration.

Impact:

- fresh clones can boot into a broken state
- demo setup depends on manual operator discipline

### 2.2 Healthchecks only prove HTTP reachability, not real readiness

Evidence:

- `docker-compose.yml:61`
- `services/api/routers/health.py`

Problem:

Compose marks the API healthy when `/health` returns HTTP 200, even if the JSON payload reports degraded dependencies.

Impact:

- other services may start while DB/Redis/model dependencies are unavailable
- the stack can look up while important routes still fail

### 2.3 API shutdown path assumes DB and Redis always connected

Evidence:

- `services/api/main.py:90`
- `services/api/main.py:184`

Problem:

Startup allows degraded mode by leaving `app.state.db_pool` or `app.state.redis` as `None`, but shutdown unconditionally closes both.

Impact:

- shutdown can raise errors after partial startup failure
- indicates weak lifecycle hardening

### 2.4 Deploy workflow is not credible as written

Evidence:

- `.github/workflows/deploy.yml:61`
- `.github/workflows/deploy.yml:73`

Problem:

The workflow calls `railway up` and `vercel --prod` without installing or authenticating those CLIs inside the workflow.

Impact:

- production deployment claims are weaker than they appear
- the repo does not currently prove release automation

## 3. Auth and security posture are incomplete

### 3.1 Refresh token/session model is only partially implemented

Evidence:

- `services/api/routers/auth.py:160`
- `services/api/routers/auth.py:371`
- `services/db/migrations/001_schema.sql:212`

Problem:

The schema supports application auth sessions, but the runtime refresh flow behaves mostly like stateless JWT refresh and does not appear to enforce session persistence/revocation cleanly.

Impact:

- weak production auth story
- overclaim risk if the team describes this as robust session security

### 3.2 RS256 support is misleadingly implemented

Evidence:

- `services/api/services/auth_service.py:45`
- `services/api/services/auth_service.py:150`

Problem:

Public/private key handling is not correctly separated.

Impact:

- production-grade auth claims are not defensible

## 4. Documentation drift and confidence inflation

### 4.1 README still describes the web app as Next.js, but the actual app is React Router + Vite

Evidence:

- `README.md:73`
- `apps/web/package.json:6`

Problem:

The repo documentation describes a different web architecture than the one actually running.

Impact:

- onboarding confusion
- judges and collaborators may infer maturity that the repo no longer reflects accurately

### 4.2 Existing readiness audit is stale and overconfident

Evidence:

- `audit/production_readiness_audit.md:4`

Problem:

The existing audit says `ALL GAPS FIXED`, but current source still contains clear runtime and operational issues.

Impact:

- false confidence
- team may under-prioritize critical fixes before demo day

### 4.3 Demo script overstates graceful degradation

Evidence:

- `DEMO_SCRIPT.md:35`
- `DEMO_SCRIPT.md:36`

Problem:

The script suggests fallback modes like SQLite and in-memory substitutes, but those are not obviously implemented as a coherent first-class runtime path in the current repo.

Impact:

- live fallback story may collapse under pressure

## What Is Missing

## 1. Missing for a winning hackathon demo

### 1.1 One bulletproof guided judge path

Pieces exist, but the repo does not yet force a single deterministic showcase flow.

What is missing:

- a single pre-seeded, safe happy path from signup to onboarding to mentor match to session to institution dashboard
- controlled navigation that avoids unfinished routes
- a guaranteed dataset with named mentor/mentee personas and deterministic stats

### 1.2 Removal or hiding of unfinished surfaces

Missing actions:

- hide or fix `reports`
- avoid exposing session details unless polished
- ensure dashboard auth pages are clearly demo-only or bypassed entirely

### 1.3 Stronger “wow” storytelling inside the product itself

Missing polish:

- more explicit offline-first proof while using the product
- stronger safety and AI state indicators across core screens
- richer, real-seeming mentor matching rationale based on deterministic seed data instead of generic fallback copy

### 1.4 Trustworthy test gates for demo-critical surfaces

Current Playwright coverage exists, but much of it is too forgiving.

Missing:

- assertions for specific seeded people, stats, and known impact events
- checks that fail when UI silently degrades into empty or generic placeholders

## 2. Missing for production readiness

### 2.1 A real migration and rollback strategy

Missing:

- automatic migration execution on deploy/startup
- one authoritative migration flow rather than duplicated systems
- explicit rollback instructions validated in CI

### 2.2 Stronger CI coverage

Evidence:

- `.github/workflows/ci.yml:20`

What is missing:

- integration tests against real Postgres/Redis in the primary CI path
- end-to-end verification for launch-critical flows
- Docker bring-up and smoke checks

### 2.3 A consistent environment and configuration story

The repo does contain `.env.example`, but the project still needs a clearer “minimum viable local run” contract tied to actual successful startup behavior.

Missing:

- strict startup verification that required dependencies and secrets match the active mode
- better separation of demo mode vs production mode expectations

### 2.4 Production-safe auth/session hardening

Missing:

- refresh token revocation discipline
- session/device management
- correct asymmetric key handling if RS256 is claimed

### 2.5 Better observability as an operational workflow, not just dependencies

Missing:

- reliable smoke checks after deploy
- real readiness semantics
- incident-friendly logs tied to critical user flows

## What Needs To Be Finished Before Demo Day

## Must-fix before showing judges

1. Fix `apps/dashboard/app/[subdomain]/reports/page.tsx`.
2. Fix dashboard backend routes that depend on `user.email`.
3. Fix the invalid `m.sessions_completed` SQL reference in mentor weekly brief data.
4. Ensure migrations run automatically or create a one-command deterministic setup path that has been rehearsed.
5. Define and rehearse exactly one judge-safe flow.
6. Remove or hide unfinished routes/buttons from that flow.

## Strongly recommended before showing judges

1. Replace random or obviously synthetic fallback values in visible UI.
2. Improve session chat metadata so the page feels like a real mentorship conversation.
3. Tighten Playwright checks around seeded content actually visible on dashboard and web surfaces.
4. Add an explicit “demo mode” ribbon or panel explaining what is live: AI matching, safety scan, offline simulator, impact analytics.

## Not necessary for hackathon demo, but necessary before production claims

1. Harden refresh/session auth.
2. Fix deploy workflow properly.
3. Consolidate migration strategy.
4. Make health/readiness checks dependency-aware.
5. Add stronger integration and e2e gates to CI.

## Highest-Leverage Improvements To Win The Hackathon

These are the improvements most likely to increase judge confidence quickly.

### 1. Narrow the story

Do not try to demo every feature. Demo this sequence only:

1. Landing page problem framing
2. Mentee signup/onboarding
3. AI mentor matching
4. Safe mentorship session
5. Institution dashboard showing measurable SDG impact
6. USSD simulator to prove offline reach

### 2. Make seed data memorable

Use named mentors and mentees with distinct tracks, languages, and stories.

Why this matters:

- judges remember people, not tables
- deterministic names make the product feel intentional and real

### 3. Turn safety and offline access into first-class visible features

The most differentiated parts of ElevateHer are not generic dashboards. They are:

- mentorship access without smartphone/internet dependency
- safety for under-18 users
- measurable institutional impact

Those should be visible in the product at every important step.

### 4. Avoid routes that lower trust

Do not show:

- broken reports
- placeholder auth pages
- half-wired session flows
- routes that depend on random fallback values

### 5. Align docs to reality

Before demo day, update the top-level story so that:

- the actual architecture is described correctly
- the demo script matches the codebase behavior
- stale “all fixed” audit claims are removed or replaced

## Priority Plan

## Next 4 hours

1. Fix reports page.
2. Fix dashboard backend auth assumptions.
3. Fix invalid weekly brief SQL.
4. Make migrations part of startup or create a verified setup script.
5. Lock demo route and seed data.

## Next 1 day

1. Polish session page enough for trust.
2. Tighten Playwright tests against seeded content.
3. Remove unfinished UI entry points from demo navigation.
4. Update README and demo script to match reality.

## After hackathon, before any production claim

1. Rebuild CI around integration and e2e confidence.
2. Harden auth/session design.
3. Consolidate deploy and migration discipline.
4. Introduce real production readiness gates.

## Final Assessment

ElevateHer is not missing product ambition. It is missing focus and hardening.

The repo already contains enough substance to impress judges:

- real UI
- real schema
- real backend routing
- real safety and matching concepts
- real institutional dashboard framing

What separates this from a winning hackathon demo is not adding more features. It is:

- fixing a small set of visible breakpoints
- constraining the judge journey
- making the existing product feel deterministic, safe, and intentional

If the team fixes the handful of runtime issues listed here and rehearses one narrow seeded path, ElevateHer becomes a credible, compelling hackathon finalist. If the team tries to show the whole surface area as-is, the unfinished edges are likely to undermine the strength of the concept.
