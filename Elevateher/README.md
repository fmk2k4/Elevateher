# ElevateHer 🌟

> **Safe AI career mentorship for every girl — even offline.**

ElevateHer is an AI-powered career mentorship platform built specifically for girls aged 14–22 in Southeast Asia. It works via SMS and USSD — no smartphone, no internet connection, no app download required. Every feature is designed for the 2.4 billion women currently underserved by existing EdTech.

**GoGlobal Innovators Challenge 2026 · Group 10 · SDG 4 · SDG 5 · SDG 8**

---

## ⚡ Quick Start (5 minutes)

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | Latest | [docker.com/desktop](https://www.docker.com/products/docker-desktop) |
| Python | 3.11+ | [python.org](https://www.python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Git | Any | [git-scm.com](https://git-scm.com) |
| NVIDIA GPU (Optional) | RTX 4050+ | Required for local AI inference |

### One-command setup

```bash
# 1. Clone
git clone https://github.com/your-org/elevateher.git
cd elevateher

# 2. Copy environment file
cp .env.example .env

# 3. Start everything (first run downloads Docker images — ~5 min)
# Note: Database migrations will run automatically on startup via start.sh
docker compose up --build -d

# 4. Seed demo data
docker exec elevateher_api python scripts/seed_demo_data.py

# 5. Download AI models (one-time, requires ~4.4GB disk)
python scripts/download_models.py
```

### Database Migrations
> [!IMPORTANT]
> The single source of truth for applying database migrations is `services/api/start.sh`. This script is executed automatically when the API container starts. Do not run manual migration scripts or use alternative methods in production. Rollbacks should be handled by updating `start.sh` or applying new counter-migrations.

### Verify everything is running

```bash
# Health check
curl http://localhost:8000/health

# Expected after Docker is healthy:
# {"status":"healthy","version":"2.0.0","environment":"development","services":{"database":true,"redis":true}}
```

### Access the applications

| Application | URL | Description |
|---|---|---|
| **Mentee/Mentor Web App** | http://localhost:3000 | Main user-facing interface (React Router v7 / Vite) |
| **B2B Institution Dashboard** | http://localhost:3001 | INTI/NYP admin portal |
| **API Documentation** | http://localhost:8000/docs | FastAPI Swagger (dev only) |
| **Celery Monitoring** | http://localhost:5555 | Task queue monitor |

---

## 🏗️ Architecture

```text
┌──────────────────────────────────────────────────────┐
│                 ElevateHer Platform                  │
│                                                      │
│  Web App (React Router) ←→  API (FastAPI + Redis)        │
│  Dashboard (Next.js) ←→  AI Matching (SEA-LION v4.5) │
│  SMS/USSD (Infobip)  ←→  Safety (SEA-Guard)          │
│                          Agent (Phi-3 mini)           │
│                          Database (PostgreSQL+pgvec.) │
└──────────────────────────────────────────────────────┘
```

> **Architecture Note:** The mentee/mentor portal is built on React Router v7 with Vite and Hono SSR, while the B2B Institution Dashboard is powered by Next.js 14 App Router. See [ROUTING.md](./apps/web/ROUTING.md) for routing details.

## 🌏 Supported Countries & Languages

| Country | Language | SMS/USSD Gateway | Status |
|---------|----------|-----------------|--------|
| 🇲🇾 Malaysia | Bahasa Melayu, English | Infobip / Maxis, Celcom | Supported |
| 🇮🇩 Indonesia | Bahasa Indonesia | Plivo / Telkomsel, Indosat | Supported |
| 🇹🇭 Thailand | Thai | Infobip / AIS, DTAC | Supported |
| 🇸🇬 Singapore | English, Singlish | Infobip / SingTel | Supported |
| 🇯🇵 Japan | Japanese | Infobip / SoftBank | Supported |
| 🇬🇧 United Kingdom | English | Infobip / EE, Vodafone | Supported |

## 🔬 AI Stack

| Component | Model | Purpose |
|-----------|-------|---------|
| **Embeddings** | SEA-LION v4.5 / all-MiniLM-L6-v2 | SE Asian multilingual career matching |
| **Safety** | Pattern Matching / SEA-Guard | SE Asian content moderation |
| **Dialect Tuning** | QLoRA adapters | Manglish, Singlish, Indonesian code-switching |
| **Agent** | Phi-3 mini 4K (Microsoft) / Gemini Flash | Session summaries, mentor questions, nudges |

## 📊 UN SDG Alignment

- **SDG 4.4** — Skills for employment: Structured 12-week mentorship tracks
- **SDG 5.5** — Women's full participation: Verified female mentor network
- **SDG 8.6** — Youth employment: Career entry tracking and outcome measurement

## 🛡️ Child Safety

ElevateHer is built for users as young as 14. Our safety architecture includes:
- Guardian consent flow for all users under 18 (API verified)
- SEA-Guard NLP scanning on all mentor-authored content
- Temporal grooming pattern detection backed by 2025 peer-reviewed research
- Automatic account suspension on critical safety flags (Currently triggers safety dashboard alerts, auto-suspension pending review)
- Human moderation review within 24 hours

## ⚙️ Demo Mode vs Production Mode

ElevateHer runs in Demo Mode by default (`NEXT_PUBLIC_DEMO_MODE=true` in `apps/web/.env`).

- **Demo Mode**: Shows demo accounts on the sign-in screen, uses fallback offline models if cloud AI APIs are unconfigured, and bypasses institution validation if the dashboard token is missing.
- **Production Mode**: Hides demo credentials, enforces strict safety check fallbacks (degraded states if services go down), requires real email verification for guardian consent, and fails loud if configuration is missing.

See [ENVIRONMENT.md](./ENVIRONMENT.md) for a full breakdown of production environment variables.

## 📁 Repository Structure

```text
elevateher/
├── apps/
│   ├── web/                   # React Router v7 / Vite mentee/mentor app
│   └── dashboard/             # Next.js B2B institution dashboard
├── services/
│   ├── api/                   # FastAPI backend
│   └── db/                    # PostgreSQL migrations and RLS
├── data/
│   ├── models/                # AI model files (gitignored)
│   ├── datasets/              # Training data (gitignored)
│   └── migrations/            # Alembic SQL migrations
├── infra/
│   └── docker/                # Docker configs
├── scripts/                   # Setup, seed, demo scripts
├── docs/                      # Architecture diagrams
├── .github/                   # CI/CD workflows
└── .env.example               # Environment template
```

## 📖 Technical Documentation

| File | Content |
|---|---|
| `Elevateher doc/01_DATABASE_COMPLETE.md` | Schema, migrations, RLS, seed scripts |
| `Elevateher doc/02_FASTAPI_BACKEND_COMPLETE.md` | All API routes, auth, Pydantic models |
| `Elevateher doc/03_04_05_AI_SAFETY_SMS_COMPLETE.md` | AI matching, safety layer, SMS/USSD |
| `Elevateher doc/06_NEXTJS_WEB_APP_COMPLETE.md` | Frontend pages, components, hooks |
| `Elevateher doc/07_08_DASHBOARD_AGENT_COMPLETE.md` | B2B dashboard, agentic facilitation |
| `Elevateher doc/09_DEVOPS_TESTING_COMPLETE.md` | Test suite, CI/CD, Docker, deployment |
| `Elevateher doc/10_PROJECT_SETUP_COMPLETE.md` | This file |
| `Elevateher doc/ElevateHer_MASTER_GUIDE_v2.md` | Authoritative master guide |

## 🤝 GoGlobal Partners

Built with and for the GoGlobal Innovators Challenge 2026 partner network:
INTI University (MY) · Nanyang Polytechnic (SG) · BINUS University (ID) ·
Prince of Songkla University (TH) · Kansai University (JP) · Teesside University (UK)

## 📜 Licence

MIT — free for academic and research use. Commercial use requires a licence.
Contact: hello@elevateher.app

## 🙏 Research Acknowledgements

- AI Singapore SEA-LION v4.5 / SEA-Guard (November 2025)
- Street et al. "A Parent in the Room" — TechRxiv (May 2025)
- Leiva-Bianchi et al. Scientific Reports (2025)
- Maskat et al. Manglish Dataset, UiTM Malaysia (2024)
- World Bank Women in Work dataset
