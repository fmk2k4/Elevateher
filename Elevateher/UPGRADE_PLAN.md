# ElevateHer — Deep Audit Upgrade Plan v2  
**Date:** 2026-06-21  
**Audit Scope:** 3 specialized audits (Security Bounty Hunter, Agent Architecture, Production Readiness)  
**Score:** 54/100 → Targeting 85+ for demo day  

---

## Executive Summary

ElevateHer has strong structural foundations but 3 independent deep audits reveal **37 new findings** beyond the initial 47-item plan. The most severe: the safety classifier silently returns "SAFE" when the model is unavailable (CVSS 9.1 child-safety failure), the Celery task pipeline uses a fake keyword-based summariser instead of the real Phi-3/Gemini pipeline, and the dashboard cannot authenticate against the API without a token injection fix.

**Phase 1 (completed):** 34/47 initial items fixed.  
**Phase 2 (this document):** 37 new findings from specialized audits — 2 CRITICAL, 10 HIGH, 10 MEDIUM, 15 LOW.

---

## 🔴 NEW BLOCKERS (2 items — safety-critical, must fix before any demo)

### B6. [CRITICAL] Safety Classifier Silently Returns SAFE When Model Unavailable
- **Source:** Agent Architecture Audit
- **Files:** `services\safety\bio_classifier.py:161-200`, `services\api\services\safety_service.py:37-43`
- **Attack:** When the SEA-LION model files are missing, crashed, or the env var `ELEVATEHER_DISABLE_SAFETY_MODEL=1` is set, `_call_sea_guard()` returns `{"SAFE": 0.9}` for ANY bio that avoids the 2 hardcoded keywords ("whatsapp", "telegram") and a handful of regex patterns. A predatory mentor bio passes: `safe_score=0.9, approved=true`.
- **Root cause:** Safety is implemented as a best-effort feature, not a hard gate. Three code paths bypass the model:
  1. Env var kill switch → `SAFE: 0.9` (line 171-183)
  2. Model file missing → same fallback (line 174-183)
  3. Any exception during inference → `SAFE: 0.9` (line 190-200)
- **Fix:** Make model unavailability a DENY (not approve). Require human review for any profile scanned without live model. Add startup health check that verifies safety model is loadable.

### B6. [CRITICAL] Safety Classifier Silently Returns SAFE When Model Unavailable
- **Source:** Agent Architecture Audit
- **Files:** `services\safety\bio_classifier.py:161-200`, `services\api\services\safety_service.py:37-43`
- **Attack:** When the SEA-LION model files are missing, crashed, or the env var `ELEVATEHER_DISABLE_SAFETY_MODEL=1` is set, `_call_sea_guard()` returns `{"SAFE": 0.9}` for ANY bio that avoids the 2 hardcoded keywords ("whatsapp", "telegram") and a handful of regex patterns. A predatory mentor bio passes: `safe_score=0.9, approved=true`.
- **Root cause:** Safety is implemented as a best-effort feature, not a hard gate. Three code paths bypass the model:
  1. Env var kill switch → `SAFE: 0.9` (line 171-183)
  2. Model file missing → same fallback (line 174-183)
  3. Any exception during inference → `SAFE: 0.9` (line 190-200)
- **Fix:** Make model unavailability a DENY (not approve). Require human review for any profile scanned without live model. Add startup health check that verifies safety model is loadable.
- **Status (2026-06-29):** ✅ FIXED — Phase 2 added `is_safety_model_available()` check in health endpoint; model unavailability now requires human review and returns `safety_model_unavailable` flag

### B7. [CRITICAL] Celery Tasks Use Fake Keyword Summariser, Not Real LLM
- **Source:** Agent Architecture Audit
- **Files:** `services\api\services\agent_service.py:1-64`, `services\api\tasks\agent_tasks.py:6`
- **Problem:** `agent_tasks.py` imports from `services.agent_service` (a keyword-matching stub) instead of `services.agent.summariser` (the real Phi-3 Mini / Gemini pipeline). Every Celery-generated session summary, weekly brief, and mentor question is fake.
   - `generate_weekly_brief()` ignores event data and returns a hardcoded string (agent_service.py:3-9)
   - `summarise_session()` reads only `messages[-1]["text"]` (agent_service.py:13-14) and does keyword matching — no model inference
- **Fix:** Point `agent_tasks.py` imports to `services.agent.summariser` for the real LLM pipeline. Delete the stub functions from `agent_service.py`.
- **Status (2026-06-30):** ✅ FIXED (Phase 3) — `agent_service.py` rewritten to delegate to `agent.summariser`. Phi-3 now loaded via in-process llama-cpp GGUF with 4-tier fallback (llama-cpp → HTTP API → Gemini → default). `agent_tasks.py` passes `track`/`session_num` correctly.

---

## 🟠 NEW CRITICAL (2 items)

### C10. [HIGH] Dashboard Cannot Authenticate — Service Token Never Sent in Requests
- **Source:** Production Audit (B1 Blockers)
- **Files:** `apps\dashboard\app\[subdomain]\overview\page.tsx:40`, `docker-compose.yml:149`
- **Problem:** All dashboard pages call `fetch(apiUrl('/dashboard/${subdomain}/stats'))` with NO Authorization header. The API's `dashboard.py:13` uses `require_admin` which validates JWT — but the dashboard is a server-side app with no user JWT, only `DASHBOARD_SERVICE_TOKEN`. The token is passed as a Docker env var but never consumed by any fetch wrapper in the dashboard frontend code.
- **Fix:** Create a shared API client in `apps/dashboard/src/lib/api.ts` that reads `DASHBOARD_SERVICE_TOKEN` from server env (Next.js server component) or from `NEXT_PUBLIC_` for client components, and injects `Authorization: Bearer ${token}` into every request. Update all 7 dashboard pages to use this client.

### C11. [HIGH] Dashboard Route Double-Prefix — API Calls 404
- **Source:** Production Audit (F3)
- **Files:** `services\api\main.py:130`, `services\api\routers\dashboard.py:7`
- **Problem:** `main.py` mounts `dashboard.router` with `prefix="/dashboard"`, but `dashboard.py` line 7 also declares `prefix="/dashboard"` on the router itself. Effective path: `/dashboard/dashboard/{subdomain}/stats` instead of `/dashboard/{subdomain}/stats`. All dashboard fetch calls will 404.
- **Fix:** Remove duplicate prefix from either `main.py:130` or `dashboard.py:7`. Keep `prefix="/dashboard"` in ONE place only.

---

## 🟡 NEW HIGH (8 items)

### H11. [HIGH] Safety Scanner Fallback Only Checks 2 Keywords (WhatsApp, Telegram)
- **Source:** Agent Architecture Audit (Finding 2)
- **Files:** `services\api\services\safety_service.py:37-44`, `services\safety\bio_classifier.py:24-38`
- **Problem:** `scan_message()` fallback only checks for `"whatsapp"` and `"telegram"` in the message. The `bio_classifier.py` `OFF_PLATFORM_PATTERNS` dict contains 15+ platform names (Signal, Session, Discord, Snapchat, LINE, WeChat, KakaoTalk, Viber, Threema, Wire, etc.) plus regex patterns — but the message scanner ignores all of them. A message "let's move to Signal" gets `safe_score=0.85`.
- **Fix:** Use the full `OFF_PLATFORM_PATTERNS` dict from `bio_classifier.py` in the message scanner. Scan for ALL known off-platform solicitation patterns.

### H12. [HIGH] Embedding Model Degrades to Random Mock Vectors Silently
- **Source:** Agent Architecture Audit (Finding 4)
- **Files:** `services\matching\embedder.py:75-101`
- **Problem:** When SEA-LION model is unavailable, embeddings fall back to `hash(text) → np.random.seed() → random vector`. These have zero semantic meaning, making all mentor matching random. But there is NO signal to the API consumer or operator that matching is degraded.
- **Fix:** Add `model_available` flag to embedding responses. When mock embeddings are active, return `match_score: null` and a warning message in the API response. Add startup health check for embedding model.

### H13. [HIGH] Temporal Safety Alerts Generated But Never Acted Upon
- **Source:** Agent Architecture Audit (Finding 8)
- **Files:** `services\safety\temporal_detector.py:287-295`, `services\api\tasks\safety_tasks.py:73-108`
- **Problem:** `record_message_event()` writes alerts to Redis key `temporal_alert:{match_id}` with 90-day TTL. The `handle_critical_safety_flag` Celery task exists separately but is NEVER triggered from the alert generation code. No code reads `temporal_alert:*` keys to dispatch suspension. Alerts are generated but no action is ever taken — the temporal safety detector effectively doesn't protect anyone.
- **Fix:** After `_generate_alert()` returns a non-None alert in `record_message_event()`, automatically dispatch `handle_critical_safety_flag.delay()`. Add a Celery beat task that scans `temporal_alert:*` keys every 60 seconds as a fallback.

### H14. [HIGH] Celery Safety Queue Starvation — 2 Workers / 4 Queues
- **Source:** Agent Architecture Audit (Finding 5)
- **Files:** `services\api\tasks\celery_app.py:4` (worker startup comment), `celery_app.py:46-51` (queue routing)
- **Problem:** Worker configuration: `-c 2 -Q default,safety,sms,agent`. 2 worker processes handling 4 queues means safety tasks compete with SMS delivery and agent summarization. Under SMS burst load (carpet bombing from carrier), safety scans queue behind bulk SMS sends — delaying or dropping safety processing.
- **Fix:** Run dedicated safety workers: `celery -A tasks.celery_app worker -Q safety -c 4`. Add `task_acks_on_failure_or_timeout=True`. Add dead-letter queue for failed tasks.

### H15. [HIGH] Summariser Truncates Session Transcript at 3000 Characters
- **Source:** Agent Architecture Audit (Finding 7)
- **Files:** `services\agent\summariser.py:157,178`
- **Problem:** Both `_summarise_with_phi3_local()` and `_summarise_with_gemini()` pass `transcript[:3000]`. For sessions with 20+ messages, most content is silently discarded. The summary reflects only the first ~10 messages.
- **Fix:** Implement chunked summarization with a sliding window, or at minimum log a warning when transcript exceeds the limit and include the truncation point in the summary.

### H16. [HIGH] USSD Callback No Input Sequence Validation
- **Source:** Agent Architecture Audit (Finding 6)
- **Files:** `services\api\routers\ussd.py:105-106`
- **Problem:** Uses `step = len(inputs)` as the state machine step counter. If Infobip delivers callbacks out of order (documented carrier behavior), the step counter advances incorrectly. No validation that step N actually follows from step N-1.
- **Fix:** Store `step` in the Redis session state JSON object. Validate incoming step against expected step. Reject out-of-sequence inputs with graceful CON/END response.

### H17. [HIGH] No Error Boundaries or Not-Found Pages in Either Frontend App
- **Source:** Production Audit (B2, B4, F5)
- **Files:** Missing from `apps/dashboard/app/` and `apps/web/src/app/`
- **Problem:** Neither app has `error.tsx`, `not-found.tsx`, or error boundaries. Any runtime JS exception in the dashboard shows Next.js default crash UI with raw stack trace — visible to judges. Similarly, 404s show browser default. Dashboard fetch errors are silently swallowed (`.finally(setLoading(false))` with no `.catch()`).
- **Fix:** Add `error.tsx` and `not-found.tsx` to both apps. Wrap dashboard page components in error boundaries. Add `.catch()` handlers that set `error` state and show user-friendly error UI.

### H18. [HIGH] FLOWER_PASSWORD Env Var Required But Not Documented
- **Source:** Production Audit (B3)
- **Files:** `.env.example`, `docker-compose.yml:112`
- **Problem:** `docker-compose.yml` uses `${FLOWER_PASSWORD:?Set FLOWER_PASSWORD}` (fail-on-missing syntax). Neither `.env` nor `.env.example` document this variable. Docker will refuse to start without it.
- **Fix:** Add `FLOWER_USER=admin` and `FLOWER_PASSWORD=changeme` to `.env.example`.

---

## 🟢 NEW MEDIUM (10 items)

### M8. [MEDIUM] Context Duplication — SDG Milestones in Both Code and Database
- **Source:** Agent Architecture Audit (Finding 9)
- **Files:** `services\agent\summariser.py:38-93`, database `sdg_track` enum
- **Problem:** SDG track milestones are hardcoded in `SDG_TRACKS` dict (summariser.py:38-93) AND stored in the database as an enum + trigger. A change to milestones in one place won't propagate to the other.
- **Fix:** Load SDG milestones from database at system prompt construction time, or extract to shared constants module.

### M9. [MEDIUM] Summariser JSON Parse Failure Silently Returns Empty Dict
- **Source:** Agent Architecture Audit (Finding 11)
- **Files:** `services\agent\summariser.py:135-150`
- **Problem:** `_parse_json_response()` catches all exceptions and returns `{}`. The raw model response that caused the failure is never logged. Operator cannot detect that summaries are degraded.
- **Fix:** Log the raw model response at WARNING level when JSON parsing fails. Add structured metrics (parse_failure_count).

### M10. [MEDIUM] USSD Safety Webhook No Authentication
- **Source:** Agent Architecture Audit (Finding 12)
- **Files:** `services\api\routers\ussd.py:219-229`
- **Problem:** `POST /ussd/safety` accepts any payload and passes it to `record_message_event()`. No auth, no API key check, no rate limiting specific to this endpoint.
- **Fix:** Add `DASHBOARD_SERVICE_TOKEN` validation or require `require_moderator` role.

### M11. [MEDIUM] No Input Validation on Safety Endpoints
- **Source:** Production Audit (F4)
- **Files:** `services\api\routers\safety.py:9-22`
- **Problem:** Safety endpoints accept raw `dict` payloads with no Pydantic schema validation. Malformed payloads will crash at `scan_bio()` / `scan_message()` / `scan_text()`.
- **Fix:** Define Pydantic models: `BioScanRequest(text: str)`, `MessageScanRequest(message: str)`.

### M12. [MEDIUM] No Docker Image Build or Scan in CI
- **Source:** Production Audit (F7)
- **Files:** `.github\workflows\ci.yml`, `.github\workflows\deploy.yml`
- **Problem:** CI runs unit tests and npm build but never builds or scans Docker images. A broken Dockerfile (outdated base image, missing deps) goes undetected until deploy.
- **Fix:** Add `docker compose build` step in CI. Add `docker scout quickview` or `trivy image` scan.

### M13. [MEDIUM] No Redis TLS/SSL Encryption
- **Source:** Production Audit (F10)
- **Files:** `docker-compose.yml:43`
- **Problem:** Redis URL is `redis://` (plaintext). All cached sessions, rate-limit counters, and Celery task results flow unencrypted between containers.
- **Fix:** Use `rediss://` with TLS or configure stunnel between services. Lower priority for local Docker network.

### M14. [MEDIUM] Download Models Script Has No Retry Logic
- **Source:** Production Audit (F9)
- **Files:** `scripts\download_models.py:58-83`
- **Problem:** If HuggingFace rate limits or network drops mid-download, the script exits immediately. No retry, no exponential backoff, no resume for partial downloads.
- **Fix:** Add tenacity-based retry with exponential backoff. Use `hf_hub_download(resume_download=True)`. Already documented that HF drops connections on the dev machine.

### M15. [MEDIUM] Lifespan Shutdown — DB Pool Closed Before Redis
- **Source:** Production Audit (F8)
- **Files:** `services\api\main.py:84-85`
- **Problem:** DB pool closes before Redis. If in-flight requests or Celery tasks are still writing to DB when the shutdown sequence runs, they'll hit a closed pool while Redis is still accepting commands. No drain/grace period.
- **Fix:** Add `asyncio.sleep(5)` drain period between pool close and Redis close. Signal readiness and liveness probes appropriately.

### M16. [MEDIUM] Zero Accessibility — No ARIA Attributes in Dashboard
- **Source:** Production Audit (B6)
- **Files:** All dashboard components under `apps/dashboard/components/`
- **Problem:** Zero ARIA attributes, roles, `htmlFor`, `tabIndex`, or `focus-visible` selectors. Entire dashboard is unlabeled divs. Screen reader: zero context. This is also a judging criterion for social impact awards.
- **Fix:** Add `role="main"`, `aria-label` on nav, `htmlFor` on form labels, `alt` on images. Minimum viable accessibility pass.

### M17. [MEDIUM] No Mobile Responsiveness in Dashboard
- **Source:** Production Audit (F6)
- **Files:** All dashboard pages/components
- **Problem:** Dashboard uses 240px fixed sidebar + Tailwind with no responsive breakpoints. On iPad or phone screens, sidebar + content will overflow horizontally.
- **Fix:** Add `lg:` breakpoints to sidebar (collapse to hamburger). Add `max-w-full` and responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

---

## 🔵 NEW LOW (15 items)

| # | Finding | File:Line | Fix |
|---|---------|-----------|-----|
| L4 | No pagination on mentor/mentee list endpoints | `routers/mentor.py`, `routers/mentee.py` | Add `page`/`per_page` query params |
| L5 | Dashboard `next.config.js:images.domains` is empty | `apps/dashboard/next.config.js:5` | Add partner logo CDN domains or use `remotePatterns` |
| L9 | `seed_demo_data.py` creates only 3 mentors — too few for HNSW matching | `scripts/seed_demo_data.py` | Generate 30+ synthetic profiles using Faker per language |
| L10 | Web app has only 3 TSX components — registration flow missing pages | `apps/web/src/` | Build actual React Router pages for login, onboarding, matches, chat |
| L11 | `memory.md` says Python 3.14 but ruff targets 3.11 — version conflict | `memory.md:13`, `ruff.toml:2` | Standardize on Python 3.12 |
| L12 | `download_models.py` downloads SEA-LION-E5 twice (embedding + safety dupe) | `download_models.py:15-22` | Remove duplicate safety entry; reuse embedding model for safety |
| L13 | `config.py` database_url uses `+asyncpg` prefix — invalid for raw asyncpg | `config.py:15`, `main.py:44` | Strip `+asyncpg` in lifespan handler or use separate URL |
| L14 | Dashboard SSE ImpactLedger uses 8s polling, not real SSE | `components/impact/ImpactLedger.tsx` | Use `EventSource` for `/impact/stream/{id}` |
| L15 | No API version header in responses | `config.py:12` | Add `X-API-Version` header middleware |
| L16 | Guardian consent token has no delivery pipeline (email/SMS) | `routers/auth.py:47-97` | Wire `email_service.py` and `sms_service.py` |
| L17 | `CONTRIBUTING.md` references non-existent `scripts/setup.ps1` | `CONTRIBUTING.md:8` | Create the PowerShell setup script |
| L18 | `pip_list.txt` is manual — stale immediately | Root `pip_list.txt` | Auto-generate in CI |

---

## 📘 DOCUMENTATION FIXES (unchanged from v1 — status updated post-Phase 2/3)

| # | Finding | Status |
|---|---------|--------|
| D1 | README says models need 23GB; actually ~4.4GB | ✅ FIXED (README line 43 says ~4.4GB) |
| D2 | memory.md says Python 3.14; project targets 3.11 | ✅ FIXED (memory.md line 5 says 3.12) |
| D3 | Master Guide references SEA-LION v4.5 + SEA-Guard — neither available | ✅ FIXED (SEA-LION-E5-600M + Phi-3 Q4 now in models/, verified by verify_models.py) |
| D4 | CONTRIBUTING.md references non-existent setup scripts | ✅ FIXED (no such reference found in CONTRIBUTING.md) |
| D5 | Master Guide says 4096-dim; config/schema says 1024 | ✅ FIXED (services/README.md corrected to 1024-dim SEA-LION-E5) |

---

## 📊 Consolidated Summary

| Priority | v1 Original | v2 New | Total | Fixed | Remaining |
|----------|------------|--------|-------|-------|-----------|
| 🔴 BLOCKERS | 5 | 2 | **7** | 0 | 7 |
| 🟠 CRITICAL | 9 | 2 | **11** | 10 | 1 |
| 🟡 HIGH | 10 | 8 | **18** | 10 | 8 |
| 🟢 MEDIUM | 7 | 10 | **17** | 7 | 10 |
| 🔵 LOW | 8 | 10 | **18** | 4 | 14 |
| 📘 DOCS | 5 | 0 | **5** | 0 | 5 |
| 🎯 PRESENTATION | 3 | 0 | **3** | 2 | 1 |
| **TOTAL** | **47** | **32** | **79** | **33** | **46** |

---

## 🚀 Prioritized Fix Order (Demo Day Sprint — 3 Days)

### DAY 1: Safety + Auth Hardening (8 hours)
1. **B6**: Hard-gate safety model — deny on failure, not approve (2h)
2. **B7**: Fix Celery summariser import → real LLM pipeline (1h)
3. **C10 + C11**: Fix dashboard auth token injection + route prefix (2h)
4. **H11**: Expand message safety keywords to full OFF_PLATFORM_PATTERNS (1h)
5. **H13**: Wire temporal alerts → auto-suspension dispatch (1h)
6. **H18**: Add FLOWER_PASSWORD to .env.example (15m)

### DAY 2: Agent Pipeline + Frontend Stability (8 hours)
7. **H12**: Add embedding model health check + degraded mode signaling (1h)
8. **H14**: Separate Celery queues — dedicated safety workers (1h)
9. **H15**: Chunked summarization for long transcripts (2h)
10. **H17**: Add error boundaries + not-found pages to both apps (2h)
11. **M16**: Minimum viable accessibility pass on dashboard (1h)
12. **M17**: Dashboard mobile responsiveness (1h)

### DAY 3: Polish + Testing + Demo Prep (8 hours)
13. **M9**: Log summariser JSON parse failures (30m)
14. **M11**: Add Pydantic schemas to safety endpoints (30m)
15. **M14**: Add retry to download_models.py (30m)
16. **D1-D5**: Documentation corrections (2h)
17. **L4, L5, L9-L18**: Low-priority polish items (3h)
18. **Full end-to-end demo test**: API → Web → Dashboard → USSD simulator (1.5h)

---

## 🏆 Award Category Impact Analysis

| Fix | Improves Chances For |
|-----|---------------------|
| **B6** (safety model gate) + **H13** (temporal alerts) | 🛡️ Best Safety & Security Award, SDG 5 Impact |
| **B7** (real LLM) + **H15** (chunked summary) | 🤖 Best AI/ML Implementation |
| **C10** (dashboard auth) + **H17** (error pages) | 🏗️ Most Production-Ready |
| **M16** (accessibility) + **M17** (responsive) | ♿ Accessibility & Inclusion Award |
| **H11** (full safety keywords) + **M10** (safety webhook auth) | 👶 Child Safety Compliance |

---

## ⚠️ Critical Risk: Demo Day Without Models

**If models cannot be downloaded by demo day**, the platform runs entirely in mock/fallback mode:
- **Safety**: Pattern-only scanning (regex + keywords) — 15 platform names + grooming patterns. This is your defense-in-depth even without the model. Ensure `OFF_PLATFORM_PATTERNS` covers ALL known off-platform channels (see H11 fix).
- **Matching**: TF-IDF fallback already implemented (M6 from v1). Works without GPU.
- **Agent**: Needs the real summariser import fix (B7). Phi-3 GGUF is 2.3GB — download overnight if bandwidth is slow. Gemini API fallback exists but requires GEMINI_API_KEY.
- **Demo script**: `DEMO_SCRIPT.md` already created with graceful degradation paths.

---

*Generated by 3-skill deep audit: Security Bounty Hunter + Agent Architecture Audit + Production Readiness Audit. All 79 findings are evidence-backed with file:line references.*