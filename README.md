# ElevateHer

> Safe AI-powered career mentorship for every girl — even offline.

ElevateHer is an AI-powered career mentorship platform built for girls aged 14–22 in underserved regions of Southeast Asia and the UK. It works via web, SMS, and USSD — no smartphone, no internet connection, and no app download required — reaching the 2.4 billion women currently underserved by existing EdTech.

**GoGlobal Innovators Challenge 2026 · Group 10 · SDG 4 (Quality Education) · SDG 5 (Gender Equality) · SDG 8 (Decent Work)**

## 🏗️ Repository structure

```
elevateher/
├── apps/
│   ├── web/              # Next.js mentee/mentor web app
│   └── dashboard/        # Next.js B2B institution dashboard
├── services/
│   ├── api/              # FastAPI backend
│   └── matching/         # AI matching engine
├── scripts/              # Setup, seed, and demo scripts
├── infra/docker/         # Dockerfiles
├── .github/workflows/    # CI/CD pipelines
├── .gitignore
└── package.json          # Root workspace scripts
```

Detailed technical documentation lives in `Elevateher/Elevateher doc/` and `Elevateher_Technical_Build_Guide.md`.

## ⚡ Quick start

```bash
# 1. Clone the repository
git clone https://github.com/fmk2k4/Elevateher.git
cd Elevateher

# 2. Install root dependencies
npm install

# 3. Start the development stack
npm run dev
```

The web app runs on `http://localhost:3000` and the FastAPI API on `http://localhost:8000`. Copy `.env.example` to `.env` and fill in your values before running in production.

## 🧠 Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend API | FastAPI (Python) |
| Database | PostgreSQL + pgvector |
| AI Matching | Sentence-Transformers embeddings + cosine similarity |
| NLP Safety | HuggingFace transformers classifier |
| SMS/USSD | Africa's Talking / Infobip |
| Auth | Supabase Auth |
| CI/CD | GitHub Actions |

## 📊 UN SDG alignment

- **SDG 4.4** — Skills for employment: structured 12-week mentorship tracks
- **SDG 5.5** — Women's full participation: verified female mentor network
- **SDG 8.6** — Youth employment: career entry tracking and outcome measurement

## 🛡️ Child safety

ElevateHer serves users as young as 14. Safety is built into every layer:
- Guardian consent flow for all users under 18
- NLP safety scanning on all mentor-authored content
- Persistent Report button on every screen
- Human moderation review within 24 hours

## 📖 Documentation

- `Elevateher_Technical_Build_Guide.md` — full technical and architectural guide
- `Elevateher/README.md` — app-specific setup and usage
- `Elevateher/SHIPPING.md` — pre-ship deploy checklist
- `Elevateher/VERIFICATION.md` — verification steps

## 📜 Licence

MIT — free for academic and research use. Commercial use requires a licence.

Built with 💜 for SDG Group 10 — GoGlobal Innovators Challenge 2026.
