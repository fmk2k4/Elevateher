# ElevateHer — Manual Verification Playbook

**Date:** 2026-07-01
**App root:** `D:\Hackathon\Elevateher\Elevateher`
**Python runtime:** 3.12 (Dockerfile pinned) / 3.14 (local venv)

> Pre-demo evidence log. Run these in order, mark each PASS/FAIL with the time
> and the literal output snippet you captured.

---

## V0 — Pre-flight

| # | Step | Command | Expected |
|---|------|---------|----------|
| 1 | Docker services healthy | `docker compose ps` | All 8 services `healthy` (db, redis, api, celery_safety_worker, celery_main_worker, celery_beat, flower, web, dashboard) |
| 2 | API health | `curl http://localhost:8000/health` | `{"status":"healthy",...,"services":{"database":true,"redis":true}}` |
| 3 | Seed data | `docker exec elevateher_api python scripts/seed_demo_data.py` | `34 mentors, 32 mentees active, 2 matches, 4 sessions, 5 impact events` |
| 4 | Tests | `$env:ELEVATEHER_DISABLE_SAFETY_MODEL=1; $env:ENABLE_AGENTIC_LAYER="false"; python -m pytest services/api/tests/unit --timeout=20 -q` | `37 passed` |

---

## V1 — Matching (Component 1)

| # | Step | Command | Expected |
|---|------|---------|----------|
| 1.1 | Get a mentee UUID | `docker exec elevateher_db psql -U postgres -d elevateher -t -c "SELECT id FROM users WHERE role='mentee' LIMIT 1;"` | One UUID printed |
| 1.2 | GET match list (real SEA-LION scoring) | `curl -X GET 'http://localhost:8000/match/mentee/<mentee-uuid>?top_k=3' -H "Authorization: Bearer $TOKEN"` | JSON `{"matches":[…3 items…],"model_available":true,"warning":null}` |
| 1.3 | Verify match_reason is dynamic | inspect any `match_reason` field | One of the form "Matched because: \<language overlap\>, \<industry\>, \<years\>.", NOT the literal "SEA-LION embedding similarity and safety filters align." hardcoded string |
| 1.4 | Degraded model test | `docker compose stop api; docker compose run -e ELEVATEHER_DISABLE_SAFETY_MODEL=1 api uvicorn … &` or set `ELEVATEHER_DISABLE_SAFETY_MODEL=1` and rerun GET | `model_available:false`, `match_score:null`, `warning:"Semantic matching degraded — model unavailable"` |

---

## V2 — USSD Simulator (Component 2)

| # | Step | Command | Expected |
|---|------|---------|----------|
| 2.1 | Open HTML simulator | Open `scratch/ussd_simulator.html` in browser | Phone pad renders |
| 2.2 | Dial `*384#` | Click "Dial *384#" button | First CON response with the welcome menu |
| 2.3 | New mentee EN STEM | Send `1` → `1` → "Aisha Rahman" → `1` | Final response starts with `END` and contains a mentor name |
| 2.4 | Returning user | Send `2` → `+60123456789` | `END` or further CON depending on whether phone exists in seed |
| 2.5 | Grooming test | Send step input containing "WhatsApp" at a prompt | `END` response with "move to encrypted chat blocked" (off-platform pattern trip) |

---

## V3 — Temporal Grooming Detection (Component 3)

| # | Step | Command | Expected |
|---|------|---------|----------|
| 3.1 | Get a mentor/mentee pair | `psql … "SELECT mentor_id, mentee_id FROM matches WHERE status='active' LIMIT 1;"` | Both UUIDs |
| 3.2 | Get an active session UUID | `psql … "SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1;"` | One UUID |
| 3.3 | Mint a JWT for the mentee | `python -c "import jwt, time; print(jwt.encode({'sub':'<mentee-uuid>','role':'mentee','exp':int(time.time())+3600}, '<jwt_secret>', algorithm='HS256'))"` | One token |
| 3.4 | Send a clean message | `curl -X POST http://localhost:8000/session/messages -H "Authorization: Bearer $<token>" -H "Content-Type: application/json" -d '{"session_id":"<sid>","content":"Thanks for the resume feedback!"}'` | 201 with `is_flagged:false`, `temporal_risk_score:null` |
| 3.5 | Send an off-platform message | `--data '{"session_id":"<sid>","content":"Add me on whatsapp for private lessons"}'` | 201 with `is_flagged:true`, `safety_flags` includes `off_platform_solicitation` |
| 3.6 | Inspect Redis | `docker exec elevateher_redis redis-cli -a "$REDIS_PASSWORD" KEYS 'temporal:*'` | One key present |
| 3.7 | Risk score | `docker exec elevateher_redis redis-cli -a "$REDIS_PASSWORD" GET 'temporal:<match-uuid>'` | JSON with `risk_score` > 0 and `off_platform_count>=1` |
| 3.8 | Critical escalation | `curl … -d '{"session_id":"<sid>","content":"Let me get your telegram so we can chat privately"}'`; iterate 2× | Eventually the mentor is suspended — verify via `psql` `users.is_suspended=true WHERE id='<mentor-uuid>'` and an admin email at safety@elevateher.app |

---

## V4 — Dashboard security & dashboard demo

| # | Step | Command | Expected |
|---|------|---------|----------|
| 4.1 | Check dashboard prefix | `curl -i 'http://localhost:8000/dashboard/<subdomain>/stats' -H "Authorization: Bearer $DASHBOARD_SERVICE_TOKEN"` | `200 OK` (NOT 404 — would indicate double `/dashboard/dashboard/` prefix) |
| 4.2 | Load dashboard web | Open `http://localhost:3001/<subdomain>/overview` | Overview renders (or shows graceful error if no data for the chosen subdomain) |
| 4.3 | ARIA pass | DevTools Accessibility tab — focus Sidebar nav | Each nav link announces its label, active page labelled `aria-current="page"` |
| 4.4 | Mobile viewport | DevTools device emulation (390×844) | Hamburger toggle visible; sidebar hidden; tap opens panel with backdrop |

---

## V5 — Safety endpoints

| # | Step | Command | Expected |
|---|------|---------|----------|
| 5.1 | Mod auth required | `curl -i -X POST http://localhost:8000/safety/bio -d '{"bio":"hi"}'` | `401 Unauthorized` (no header) or `403 Forbidden` (non-moderator) |
| 5.2 | Mod success path | Mint JWT with role `admin`, `curl … /safety/bio -d '{"bio":"<clean engineering bio>"}'` | `approved:false` (model unavailable → requires human review in dev) |
| 5.3 | Off-platform pattern | `curl … /safety/message -d '{"message":"meet me on whatsapp"}'` | `flags:["off_platform_solicitation"]` |
| 5.4 | USSD `/ussd/safety` webhook auth | `curl -i -X POST http://localhost:8000/ussd/safety` | `403 Forbidden` (gated by `require_moderator`) |

---

## V6 — Cleanup & post-checks

| # | Step | Command | Expected |
|---|------|---------|----------|
| 6.1 | No double-prefix | `grep -n 'dashboard.router' services/api/main.py; grep -n 'prefix=\"/dashboard\"' services/api/routers/dashboard.py` | Exactly one of them carries the prefix |
| 6.2 | No `SAFE: 0.9` shortcuts | `grep -rn '"SAFE":\s*0\.9' services/safety services/api/services` | No matches |
| 6.3 | Single summaries import | `grep -n 'summariser' services/api/services/agent_service.py services/api/tasks/agent_tasks.py` | `agent_service` calls into `agent.summariser`; `agent_tasks` calls `agent_service` |
| 6.4 | Pagination present in admin endpoints | `curl /admin/pending-mentors?page=2&per_page=10` | JSON `{"items":[…],"page":2,"per_page":10}` |
| 6.5 | Python pinned | `grep -n 'FROM python' infra/docker/api.Dockerfile` | `FROM python:3.12-slim` |
| 6.6 | Optional: build CI image scan | `docker scout quickview elevateher_api` | No HIGH/CRITICAL vulns |

---

## Notes

- All commands assume the user is in the project root `D:\Hackathon\Elevateher\Elevateher`
  and Docker Compose is running the default profile.
- The matcher endpoint requires authentication for security; mint a token
  using the project's `JWT_SECRET` from `.env`.
- For the demo, you can skip the full manual sweep and only run V0 and V1 — those
  cover the highest-impact safety and AI integration paths.
