# Phase 6: 4-Hour Deep Audit (2026-07-02)

## Goal
Per user request — run a deep audit across the codebase after Phase 5 cleanup, fix every real bug found, and bring all Playwright projects back to 100% green.

## Bugs Found & Fixed (10 real bugs across 5 audit passes)

### Pass 2 — Router double-prefix bug
The biggest silent bug. `services/api/main.py` declared `prefix=` on every router that already had its own prefix, doubling the URL space:
- `/impact` collision: every `/impact/*` request hit `/impact/impact/*` (404 every time).
- Same trap on `/safety` and `/match` (self-prefixed and re-prefixed by `main.py`).

Fix: `include_router()` calls now follow one rule — **don't** add a slash prefix when the router self-declares one. Self-prefixed routers (`impact`, `dashboard`, `match`, `safety`) receive no prefix arg.

### Pass 5 / Phase 1 — Dashboard service token was opaque string
`.env` had `DASHBOARD_SERVICE_TOKEN=0OWnUwoaGm45QbbJbbQv1DshuycRumQqYTxTA7P6kOY` which is **not a JWT**. Phase 1 hardening added a `decode_token()` bypass that required both `compare_digest(token, ...)` AND a valid `decode_token(token)`. Since the opaque string isn't a JWT, the decode consistently raised "Invalid token" — every dashboard read returned 401.

**Fix:** minted a proper JWT, signed with the live `JWT_SECRET` from `.env`, with explicit claims:
```json
{"sub": "dashboard-service", "role": "admin", "exp": 9999999999, "type": "service"}
```

Also widened `decode_token()` in `services/api/services/auth_service.py` to accept `type ∈ {"access", "refresh", "service"}` — previously service tokens were silently rejected.

### Pass 8 — Auth.py missing `try:` partner
`services/api/routers/auth.py:373` had a function body with `try:` for the **import** statement only, then called `decode_token()` outside the try, followed by orphan `except jwt.ExpiredSignatureError:` clauses for the un-indented code path. Fixed by wrapping `decode_token` + the except clauses in a proper `try/except`.

### Pass 8 — Architecture drift in dashboard proxy
Both `apps/dashboard/app/api/dashboard/[...path]/route.ts` and `apps/dashboard/app/api/institutions/[subdomain]/route.ts` were forwarding to `NEXT_PUBLIC_API_URL` (=`http://localhost:8000`). From inside the Docker container, `localhost` is the container's loopback — NOT the host. Every data fetch returned 502.

**Fix:** prefer `API_URL=http://api:8000` (docker DNS), fall back to `NEXT_PUBLIC_API_URL` for non-container environments.

### Pass 8 — Dashboard proxy stripping bug
While rewriting the proxy above, the previous edit chopped out `buildProxyHeaders` and `buildResponseHeaders`. Re-wrote full route.ts with helpers + method dispatch + SSE passthrough + content-type preservation.

### Pass 8 — Minor lint cleanup
1. `services/api/routers/mentor.py:71` removed unused `requires_human_review = True`
2. `services/api/routers/impact.py:673` removed unused `client_ip` (comment: reserved for future per-IP rate limit on SSE)
3. `services/api/main.py:2` removed unused `import os`
4. `services/api/routers/dashboard.py:_json_safe` now handles `asyncpg.pgproto.UUID` → `str` for JSON compatibility

### Pass 8 — Migration 003 (provenance) was never applied
`services/db/migrations/003_provenance.sql` had been authored (Phase 6 effort) but never applied to the live DB. Effects:
- `impact_events` was missing `source`, `evidence_type`, `confidence`, `reviewer_status`, `connectivity_class` columns
- `v_program_progression`, `v_offline_reach`, `v_mentor_utilization`, `v_safety_intervention_rate`, `v_outcome_velocity` views didn't exist

The dashboard silently swallowed the 500s and showed the error-state UI.

#### Bugs in 003_provenance.sql that **prevented it from applying**:

1. **`v_mentor_utilization` referenced `mp.institution_id`** — but `mentor_profiles.institution_id` doesn't exist; the column lives on `users.institution_id`. Fixed by `JOIN users u ON u.id = mp.user_id` and grouping by `u.institution_id`.

2. **`v_safety_intervention_rate` referenced `sr.institution_id`** — but `safety_reports.institution_id` doesn't exist. Resolved via `COALESCE(matches.institution_id, users.institution_id)`. The correlated subquery for `top_reason` had to be removed because it referenced outer columns from a GROUP BY context.

3. **Status enum mismatch**: `safety_status` PG enum is `(open, reviewing, resolved, dismissed, escalated_to_authorities)` but the view referenced `'under_review'`. Replaced with `'reviewing'`.

**Fix:** applied migration directly to live DB with the column additions and view rewrites. All 9 views now exist, all 18 columns on `impact_events` present.

Also added `services/api/alembic/versions/003_provenance.py` as a fresh alembic revision that re-applies `003_provenance.sql` idempotently from inside the migration system, so future fresh deployments don't need to re-discover this.

## Tests After Audit (Full Re-Run)

| Project | Result | Time |
|---|---|---|
| health | 2/2 | 1.4s |
| dashboard | 14/14 | 15.5s |
| simulator | 3/3 | 4.1s |
| **Total** | **19/19** | **21s** |

Live dashboard verifications:
- `GET /dashboard/{sub}/stats` → 200 (33 active_mentees, 32 SE Asia mentees, 9 matches, 0.908 quality)
- `GET /impact/institution/{sub}/progression` → 200
- `GET /impact/report/{sub}?period_start=...` → 200 (SDG 4.4 events: 3, ...)

## Files Changed in Audit

```
services/api/main.py                                      # prefix double-fix, import cleanup
services/api/services/auth_service.py                    # decode_token type=service
services/api/routers/auth.py                              # try/except wrap fix
services/api/routers/impact.py                            # subdomain resolution, unused var
services/api/routers/dashboard.py                         # _json_safe UUID handling
services/api/routers/mentor.py                            # unused var cleanup
.env                                                      # DASHBOARD_SERVICE_TOKEN (real JWT)
.env.example                                              # DASHBOARD_SERVICE_TOKEN (documentation)
services/db/migrations/003_provenance.sql                # view fixes (mentor_util, safety_intervention)
services/api/alembic/versions/003_provenance.py           # NEW alembic revision
apps/dashboard/app/api/dashboard/[...path]/route.ts       # prefer API_URL over localhost
apps/dashboard/app/api/institutions/[subdomain]/route.ts   # prefer API_URL over localhost
playwright/tests/02-dashboard-overview.spec.ts            # locator strict mode fix
```

## Audit Findings — Not Fixed (Acknowledged)

1. **`apps/web/src/app/api/**` BFF handlers**: 30 route files all use `utils/backend.js` `proxyJsonToBackend()` (forward to FastAPI). Only `seed-demo` uses direct SQL. Architecture is OK as-is.

2. **`ruff B008` on every FastAPI endpoint signature**: this is a `FastAPI Depends()` placement that ruff doesn't understand. Suppressing it across the entire `services/api` would require a project config file; deferred.

3. **Web container deployment**: `elevateher_web` image was never built during the audit window. Rebuilding it from docker hub requires bandwidth beyond what's available. Dashboard tests don't depend on it.

## Verification

```powershell
python -m py_compile services/api/{main.py,config.py,dependencies.py}
python -m py_compile services/api/routers/{auth,impact,dashboard,mentor,mentee,match,safety,session,admin}.py
python -m py_compile services/api/services/{trust,impact,safety,auth,agent,matching,sms}_service.py
python -m py_compile services/api/middleware/{csrf,rate_limit,rls_middleware,logging_middleware}.py
python -m py_compile services/api/alembic/versions/{001_initial,003_provenance}.py
# ALL OK (23 files)
```

```powershell
$env:RUN_E2E='1'; npx playwright test --project={dashboard,health,simulator}
# 19/19 passed
```

## Live System Status (post-audit)

- API on `:8000` (healthy)
- Dashboard on `:3001` (healthy)
- DB/Redis up; freshly migrated to include provenance
- .env contains a fully-signed JWT for the dashboard service account
- All provenance columns + phase-6 dashboard views verified live

*Last Updated: 2026-07-02 (End of 4-hour Deep Audit)*
