# Dashboard service auth

The FastAPI `dashboard_service_token` is dual-purpose: it is BOTH the shared
secret compared via `secrets.compare_digest` AND a valid JWT (`sub=dashboard-
service`, `role=admin`). An opaque string fails auth.

Before `docker compose up`:

1. From repo root, run `python scripts/mint_dashboard_jwt.py`.
2. Copy the printed JWT into BOTH:
   - `.env` (repo root) — `DASHBOARD_SERVICE_TOKEN=...`
   - `apps/dashboard/.env.local` — `DASHBOARD_SERVICE_TOKEN=...`
3. Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60m). Re-run the
   script to rotate.
