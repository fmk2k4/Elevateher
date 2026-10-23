# ElevateHer — Technical Build Guide
### AI-Powered Career Mentorship Platform for Girls
**SDG Group 10 · SDG 4 (Quality Education) · SDG 5 (Gender Equality) · SDG 8 (Decent Work)**

> **Document purpose:** Step-by-step technical and architectural guide for developers, contributors, and NGO partners building ElevateHer from zero to a live, production-grade platform. Written for teams with mixed technical backgrounds — every decision is explained, not just stated.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Architecture Overview](#2-solution-architecture-overview)
3. [Phase 0 — Foundation & Setup](#3-phase-0--foundation--setup)
4. [Phase 1 — Data Layer & AI Matching Engine](#4-phase-1--data-layer--ai-matching-engine)
5. [Phase 2 — Core Platform (Web + SMS)](#5-phase-2--core-platform-web--sms)
6. [Phase 3 — Safety & Trust Layer](#6-phase-3--safety--trust-layer)
7. [Phase 4 — Mentor Onboarding & Verification](#7-phase-4--mentor-onboarding--verification)
8. [Phase 5 — Mentorship Tracks & Progress Engine](#8-phase-5--mentorship-tracks--progress-engine)
9. [Phase 6 — SMS / USSD Offline Mode](#9-phase-6--sms--ussd-offline-mode)
10. [Phase 7 — B2B Institution Dashboard](#10-phase-7--b2b-institution-dashboard)
11. [Phase 8 — Impact Measurement & SDG Reporting](#11-phase-8--impact-measurement--sdg-reporting)
12. [Phase 9 — Security, Privacy & Child Safety](#12-phase-9--security-privacy--child-safety)
13. [Phase 10 — Deployment & DevOps](#13-phase-10--deployment--devops)
14. [Contributing Guidelines](#14-contributing-guidelines)
15. [Glossary](#15-glossary)

---

## 1. Problem Statement

### 1.1 Who is being left behind?

Girls aged 14–22 in low-income and underserved regions across Southeast Asia and the UK face a compounding set of barriers when entering careers:

| Barrier | Evidence | Impact |
|---|---|---|
| No female role models in STEM | Only 1 in 5 STEM mentors globally is female *(UNESCO 2024)* | Girls self-select out of STEM before age 16 |
| Safety concerns on generic platforms | 60% of SE Asian girls cite "no safe guidance" *(ILO 2023)* | LinkedIn and similar platforms are perceived as unsafe |
| No internet or smartphone access | 2.4 billion women globally are underserved by EdTech *(World Bank)* | App-first solutions exclude the most vulnerable |
| Cultural and family barriers | Gender norms restrict career exploration in many SE Asian contexts | Girls need culturally-aware, same-gender guidance |
| No personalised support at scale | NGO programmes are offline-only and limited in reach | 1 NGO counsellor cannot mentor 500 girls simultaneously |

### 1.2 Why existing solutions fail

```
LinkedIn        → Not girl-focused. No moderation. Unsafe for minors.
NGO programmes  → Offline, small-scale, non-measurable, not scalable.
Generic EdTech  → No gender-equity training data. English-language bias.
School counsellors → 1 per 400+ students. No industry network.
```

### 1.3 What success looks like

A girl in rural Malaysia with 2G connectivity and no smartphone can:
1. Access ElevateHer via SMS/USSD
2. Be matched to a verified female mentor in her target career field
3. Complete structured mentorship sessions over 12 weeks
4. Enter her target career field with measurable support

**That is the engineering target. Every technical decision in this document serves it.**

---

## 2. Solution Architecture Overview

### 2.1 High-level system diagram

```
┌─────────────────────────────────────────────────────────┐
│                    ElevateHer Platform                  │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Web App     │    │  SMS/USSD    │    │  B2B      │ │
│  │  (Next.js)   │    │  Gateway     │    │  Dashboard│ │
│  └──────┬───────┘    └──────┬───────┘    └─────┬─────┘ │
│         │                  │                   │        │
│  ┌──────▼───────────────────▼───────────────────▼─────┐ │
│  │              API Gateway (FastAPI)                  │ │
│  └──────┬──────────────────────────────────────────────┘ │
│         │                                               │
│  ┌──────▼──────────┐    ┌────────────────────────────┐ │
│  │  AI Matching    │    │  Safety & Trust Layer      │ │
│  │  Engine         │    │  (NLP Classifier)          │ │
│  │  (Embeddings)   │    │                            │ │
│  └──────┬──────────┘    └────────────┬───────────────┘ │
│         │                            │                  │
│  ┌──────▼────────────────────────────▼───────────────┐ │
│  │            PostgreSQL + pgvector                   │ │
│  │         (profiles, sessions, embeddings)           │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Technology stack

| Layer | Technology | Why this choice |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR for low-bandwidth users; SEO for discoverability |
| Backend API | FastAPI (Python) | Fast async; ideal for ML model integration |
| Database | PostgreSQL + pgvector | Relational data + vector similarity search in one DB |
| AI Matching | Sentence-Transformers + fine-tuned model | Open-source; can run self-hosted for data privacy |
| NLP Safety | HuggingFace `transformers` (classifier) | Fine-tunable on gender-bias datasets |
| SMS/USSD | Africa's Talking API (or Twilio) | Best SE Asia & Africa USSD coverage; low cost |
| Auth | Supabase Auth | Open-source; guardian consent flows supported |
| Storage | Supabase Storage / S3 | Profile docs, verification uploads |
| Hosting | Railway (API) + Vercel (Frontend) | Free tiers available; scales to paid easily |
| CI/CD | GitHub Actions | Free for open-source; simple YAML pipelines |
| Monitoring | Sentry + PostHog | Error tracking + privacy-safe analytics |

---

## 3. Phase 0 — Foundation & Setup

*Estimated time: 1–2 days. Do this before writing a single line of product code.*

### 3.1 Repository structure

```
elevateher/
├── apps/
│   ├── web/              # Next.js frontend
│   └── dashboard/        # B2B institution dashboard
├── services/
│   ├── api/              # FastAPI backend
│   ├── matching/         # AI matching engine (standalone service)
│   └── sms/              # SMS/USSD handler
├── data/
│   ├── datasets/         # Training data (see data ethics note)
│   ├── models/           # Fine-tuned model checkpoints
│   └── migrations/       # SQL migration files
├── infra/
│   ├── docker/           # Dockerfiles
│   └── github-actions/   # CI/CD workflows
├── docs/                 # This document lives here
└── README.md
```

### 3.2 Environment setup

**Step 1 — Clone and configure**

```bash
git clone https://github.com/your-org/elevateher.git
cd elevateher

# Copy environment template
cp .env.example .env.local
```

**Step 2 — Fill in `.env.local`**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elevateher

# Supabase (Auth + Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# AI Matching Service
MATCHING_SERVICE_URL=http://localhost:8001
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2

# SMS Gateway
AFRICASTALKING_USERNAME=your-username
AFRICASTALKING_API_KEY=your-api-key

# Safety Classifier
SAFETY_MODEL_PATH=./models/safety-classifier-v1

# Guardian Consent
GUARDIAN_CONSENT_REQUIRED_AGE=18
TWILIO_VERIFY_SID=your-verify-sid
```

**Step 3 — Install dependencies**

```bash
# Backend (Python 3.11+)
cd services/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd apps/web
npm install

# Matching service
cd services/matching
pip install -r requirements.txt
```

**Step 4 — Start local database with pgvector**

```bash
docker run -d \
  --name elevateher-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=elevateher \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

**Step 5 — Run migrations**

```bash
cd data/migrations
psql $DATABASE_URL -f 001_init.sql
psql $DATABASE_URL -f 002_pgvector.sql
psql $DATABASE_URL -f 003_mentorship_tracks.sql
```

---

## 4. Phase 1 — Data Layer & AI Matching Engine

*This is the technical heart of ElevateHer. Take time here.*

### 4.1 Database schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Core user table (both mentees and mentors)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE,
  phone           TEXT UNIQUE,          -- for SMS-only users
  role            TEXT CHECK (role IN ('mentee', 'mentor', 'admin')),
  age             INT,
  country         TEXT,
  language        TEXT DEFAULT 'en',
  is_verified     BOOLEAN DEFAULT false,
  guardian_email  TEXT,                  -- required if age < 18
  guardian_consented BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Mentee career profile
CREATE TABLE mentee_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  career_goals      TEXT[],              -- e.g. ['software engineer', 'data scientist']
  sdg_track         TEXT,               -- 'STEM' | 'Business' | 'Trades' | 'Creative'
  current_education TEXT,
  challenges        TEXT[],             -- e.g. ['family pressure', 'cost', 'language']
  preferred_lang    TEXT[],
  embedding         VECTOR(768),        -- AI-generated from profile text
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Mentor profile
CREATE TABLE mentor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  industry        TEXT,
  job_title       TEXT,
  years_exp       INT,
  skills          TEXT[],
  languages       TEXT[],
  availability    JSONB,               -- { "monday": ["09:00","17:00"], ... }
  bio             TEXT,
  bio_safety_score FLOAT,             -- 0.0–1.0, from NLP classifier
  bio_flags       TEXT[],             -- flagged terms from NLP scan
  is_approved     BOOLEAN DEFAULT false,
  embedding       VECTOR(768),        -- AI-generated from mentor bio + skills
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Mentor–mentee match
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id       UUID REFERENCES users(id),
  mentor_id       UUID REFERENCES users(id),
  match_score     FLOAT,              -- cosine similarity 0.0–1.0
  status          TEXT DEFAULT 'pending',  -- pending | active | completed | declined
  track           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Mentorship sessions
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES matches(id),
  session_num     INT,
  channel         TEXT CHECK (channel IN ('web', 'sms', 'ussd', 'whatsapp')),
  notes           TEXT,
  milestone_reached TEXT,
  completed       BOOLEAN DEFAULT false,
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- Impact tracking (for SDG reporting)
CREATE TABLE impact_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  event_type      TEXT,     -- 'career_entry' | 'job_offer' | 'course_enrolled' | 'skill_gained'
  sdg_goal        TEXT,     -- '4.4' | '5.5' | '8.6'
  evidence        TEXT,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 AI Matching Engine — step by step

The matching engine answers one question: **"Which mentor is the best fit for this mentee?"**

It uses **vector embeddings** — numerical representations of text that capture meaning. Two profiles with similar meaning will have similar vectors. We measure similarity using **cosine similarity**.

**Step 1 — Choose an embedding model**

We use `paraphrase-multilingual-mpnet-base-v2` from Sentence-Transformers because:
- It supports 50+ languages (critical for SE Asia)
- It runs locally — no data sent to third-party APIs
- It is fine-tuneable on our domain data

```python
# services/matching/embedder.py

from sentence_transformers import SentenceTransformer
import numpy as np

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
model = SentenceTransformer(MODEL_NAME)

def build_mentee_text(profile: dict) -> str:
    """
    Convert a mentee profile dict into a single descriptive string
    that the embedding model can encode into a vector.
    """
    goals = ", ".join(profile.get("career_goals", []))
    challenges = ", ".join(profile.get("challenges", []))
    track = profile.get("sdg_track", "")
    lang = ", ".join(profile.get("preferred_lang", ["English"]))

    return (
        f"Career goals: {goals}. "
        f"Track: {track}. "
        f"Challenges: {challenges}. "
        f"Language preference: {lang}."
    )

def build_mentor_text(profile: dict) -> str:
    """
    Convert a mentor profile into embeddable text.
    Includes industry, skills, job title, and bio summary.
    """
    skills = ", ".join(profile.get("skills", []))
    langs = ", ".join(profile.get("languages", ["English"]))

    return (
        f"Industry: {profile.get('industry', '')}. "
        f"Role: {profile.get('job_title', '')}. "
        f"Skills: {skills}. "
        f"Languages: {langs}. "
        f"Bio: {profile.get('bio', '')[:300]}"
    )

def embed(text: str) -> list[float]:
    """Return a 768-dimensional embedding vector."""
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()
```

**Step 2 — Store embeddings in pgvector**

```python
# services/matching/store.py

import asyncpg

async def upsert_mentee_embedding(pool, user_id: str, embedding: list[float]):
    await pool.execute(
        """
        UPDATE mentee_profiles
        SET embedding = $1::vector, updated_at = now()
        WHERE user_id = $2
        """,
        embedding, user_id
    )

async def upsert_mentor_embedding(pool, user_id: str, embedding: list[float]):
    await pool.execute(
        """
        UPDATE mentor_profiles
        SET embedding = $1::vector, updated_at = now()
        WHERE user_id = $2
        """,
        embedding, user_id
    )
```

**Step 3 — Run similarity search**

```python
# services/matching/matcher.py

async def find_top_mentors(pool, mentee_user_id: str, top_k: int = 5) -> list[dict]:
    """
    Find the top-K mentors for a given mentee using
    cosine similarity between embedding vectors.
    Only returns approved, available mentors.
    """
    rows = await pool.fetch(
        """
        SELECT
            u.id,
            u.email,
            mp.job_title,
            mp.industry,
            mp.languages,
            mp.bio,
            1 - (mp.embedding <=> (
                SELECT embedding FROM mentee_profiles WHERE user_id = $1
            )) AS match_score
        FROM mentor_profiles mp
        JOIN users u ON u.id = mp.user_id
        WHERE mp.is_approved = true
          AND mp.bio_safety_score >= 0.7
        ORDER BY mp.embedding <=> (
            SELECT embedding FROM mentee_profiles WHERE user_id = $1
        )
        LIMIT $2
        """,
        mentee_user_id, top_k
    )
    return [dict(r) for r in rows]
```

**Step 4 — Re-embed on profile update**

Every time a mentee or mentor updates their profile, trigger a re-embedding job:

```python
# services/api/routers/profiles.py (FastAPI)

from services.matching.embedder import build_mentee_text, embed
from services.matching.store import upsert_mentee_embedding

@router.put("/mentee/profile")
async def update_mentee_profile(data: MenteeProfileUpdate, user=Depends(get_current_user)):
    # 1. Save to DB
    await db.save_mentee_profile(user.id, data)

    # 2. Re-embed asynchronously (don't block the HTTP response)
    text = build_mentee_text(data.dict())
    vector = embed(text)
    await upsert_mentee_embedding(db.pool, user.id, vector)

    return {"status": "updated"}
```

**Step 5 — Fine-tuning on female career data (optional but powerful)**

Use the World Bank Women in Work dataset to fine-tune the base model so it understands gender-specific career language:

```python
# data/finetune/train.py

from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

# Each training pair: (mentee description, ideal mentor description, similarity score 0–1)
train_examples = [
    InputExample(texts=[
        "Career goals: software engineer. Track: STEM. Challenges: family pressure, cost.",
        "Industry: Technology. Role: Senior Software Engineer. Skills: Python, mentoring, women-in-tech advocate."
    ], label=0.95),
    # ... more pairs from your dataset
]

model = SentenceTransformer("paraphrase-multilingual-mpnet-base-v2")
train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)
train_loss = losses.CosineSimilarityLoss(model)

model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=3,
    warmup_steps=100,
    output_path="./models/elevateher-matching-v1"
)
```

---

## 5. Phase 2 — Core Platform (Web + SMS)

### 5.1 Frontend — Next.js App Router structure

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── guardian-consent/page.tsx    ← critical for under-18s
│   ├── (mentee)/
│   │   ├── onboarding/page.tsx          ← career goals, track selection
│   │   ├── matches/page.tsx             ← AI-suggested mentors
│   │   ├── sessions/page.tsx            ← scheduled sessions
│   │   └── progress/page.tsx            ← milestone tracker
│   ├── (mentor)/
│   │   ├── onboarding/page.tsx
│   │   ├── mentees/page.tsx
│   │   └── availability/page.tsx
│   └── api/
│       └── [...route]/route.ts          ← API proxy to FastAPI backend
├── components/
│   ├── matching/MatchCard.tsx
│   ├── sessions/SessionScheduler.tsx
│   └── safety/ReportButton.tsx          ← always visible
└── middleware.ts                        ← auth guard + age gate
```

### 5.2 Mentee onboarding flow

```
Register (email or phone)
        │
        ▼
Age check — under 18?
  YES → Guardian email required → Send consent link → Wait for approval
  NO  → Continue immediately
        │
        ▼
Career goals selection (multi-select, with icons)
        │
        ▼
SDG Track selection: STEM / Business / Trades / Creative
        │
        ▼
Language preferences
        │
        ▼
Challenges (optional): Family pressure / Cost / Language / Safety / Other
        │
        ▼
AI generates embedding → stored in DB
        │
        ▼
Top 5 mentor matches shown → mentee selects preferred mentor
        │
        ▼
Mentor receives request → accepts/declines within 48h
        │
        ▼
Match confirmed → first session scheduled
```

### 5.3 API endpoints

```
POST   /auth/register
POST   /auth/login
POST   /auth/guardian-consent/{token}

GET    /mentee/matches              ← returns top-5 AI matches
POST   /mentee/profile              ← triggers re-embedding
GET    /mentee/sessions
POST   /mentee/sessions/{id}/complete

GET    /mentor/mentees
PUT    /mentor/availability
PUT    /mentor/profile              ← triggers safety scan + re-embedding

POST   /safety/report               ← report a mentor/session
GET    /admin/pending-mentors        ← review queue for admin

GET    /impact/summary/{user_id}    ← SDG impact data
```

---

## 6. Phase 3 — Safety & Trust Layer

*This is not optional. ElevateHer serves minors. Safety is an ethical and legal requirement.*

### 6.1 NLP safety classifier for mentor bios

The classifier scans every mentor bio before it appears to any mentee. It flags:
- Grooming language patterns
- Gender-coded bias ("looking for young girls to mentor")
- Inappropriate contact requests
- Content that discourages professional boundaries

```python
# services/matching/safety_classifier.py

from transformers import pipeline

# Load a pre-trained toxicity/bias classifier
# Fine-tune on a dataset of safe vs. flagged mentor bios
classifier = pipeline(
    "text-classification",
    model="./models/safety-classifier-v1",
    top_k=None
)

SAFETY_THRESHOLD = 0.75  # bio must score >= 0.75 to be approved

def scan_bio(bio_text: str) -> dict:
    """
    Returns a safety assessment for a mentor bio.
    """
    results = classifier(bio_text[:512])[0]  # model max token limit

    # Map labels to scores
    scores = {r["label"]: r["score"] for r in results}
    safe_score = scores.get("SAFE", 0.0)

    flags = []
    if scores.get("GROOMING", 0) > 0.3:
        flags.append("grooming_language")
    if scores.get("BIAS", 0) > 0.3:
        flags.append("gender_coded_bias")
    if scores.get("INAPPROPRIATE_CONTACT", 0) > 0.3:
        flags.append("inappropriate_contact")

    return {
        "safe_score": safe_score,
        "flags": flags,
        "approved": safe_score >= SAFETY_THRESHOLD and len(flags) == 0
    }
```

### 6.2 Guardian consent flow

```python
# services/api/routers/auth.py

import secrets
from datetime import datetime, timedelta

async def send_guardian_consent(mentee_user_id: str, guardian_email: str):
    """
    Sends a consent email to the guardian with a time-limited token.
    Mentee account is locked until consent is granted.
    """
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=72)

    # Store token
    await db.execute(
        "INSERT INTO guardian_consents (user_id, token, expires_at) VALUES ($1, $2, $3)",
        mentee_user_id, token, expires_at
    )

    # Send email (using SendGrid or Resend)
    consent_url = f"https://elevateher.app/guardian-consent/{token}"
    await email_client.send(
        to=guardian_email,
        subject="ElevateHer — Your daughter wants to join a mentorship programme",
        template="guardian_consent",
        data={"consent_url": consent_url, "expires_hours": 72}
    )

@router.get("/auth/guardian-consent/{token}")
async def complete_guardian_consent(token: str):
    """Guardian clicks the link in the email."""
    record = await db.fetchrow(
        "SELECT * FROM guardian_consents WHERE token = $1 AND expires_at > now()",
        token
    )
    if not record:
        raise HTTPException(400, "Invalid or expired consent link")

    await db.execute(
        "UPDATE users SET guardian_consented = true WHERE id = $1",
        record["user_id"]
    )
    return RedirectResponse("/welcome")
```

### 6.3 Reporting & moderation

Every screen in the app shows a persistent **Report** button. Reports are triaged within 24 hours by the safety moderation team.

```python
# services/api/routers/safety.py

@router.post("/safety/report")
async def file_report(data: ReportCreate, user=Depends(get_current_user)):
    report_id = await db.execute(
        """
        INSERT INTO safety_reports
          (reporter_id, reported_user_id, match_id, reason, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
        user.id, data.reported_user_id, data.match_id, data.reason, data.description
    )

    # Immediately suspend the reported user pending review
    if data.severity == "high":
        await db.execute(
            "UPDATE users SET is_suspended = true WHERE id = $1",
            data.reported_user_id
        )

    # Alert moderation team (Slack webhook or email)
    await notify_moderation_team(report_id, data.severity)

    return {"report_id": report_id, "message": "Report received. Our team will review within 24 hours."}
```

---

## 7. Phase 4 — Mentor Onboarding & Verification

### 7.1 Mentor verification checklist

Before a mentor can be matched with any mentee, the following gates must pass:

```
[ ] Identity verification  — government ID uploaded and reviewed
[ ] Professional verification — LinkedIn URL or employment letter
[ ] Bio NLP safety scan     — score ≥ 0.75 (automated)
[ ] Human review             — admin approves profile (manual, within 48h)
[ ] Code of conduct signed   — digital signature on mentor agreement
[ ] Background check         — optional but recommended for under-18 mentees
[ ] Guardian-safe flag set   — can_mentor_minors: true/false
```

### 7.2 Verification workflow (admin side)

```python
# services/api/routers/admin.py

@router.get("/admin/pending-mentors")
async def list_pending_mentors(admin=Depends(require_admin)):
    return await db.fetch(
        """
        SELECT u.id, u.email, mp.job_title, mp.industry,
               mp.bio, mp.bio_safety_score, mp.bio_flags,
               mp.created_at
        FROM mentor_profiles mp
        JOIN users u ON u.id = mp.user_id
        WHERE mp.is_approved = false
          AND u.is_suspended = false
        ORDER BY mp.created_at ASC
        """
    )

@router.post("/admin/mentors/{user_id}/approve")
async def approve_mentor(user_id: str, admin=Depends(require_admin)):
    await db.execute(
        "UPDATE mentor_profiles SET is_approved = true WHERE user_id = $1",
        user_id
    )
    await notify_mentor_approved(user_id)
    return {"status": "approved"}

@router.post("/admin/mentors/{user_id}/reject")
async def reject_mentor(user_id: str, reason: str, admin=Depends(require_admin)):
    await db.execute(
        "UPDATE users SET is_suspended = true WHERE id = $1", user_id
    )
    await notify_mentor_rejected(user_id, reason)
    return {"status": "rejected"}
```

---

## 8. Phase 5 — Mentorship Tracks & Progress Engine

### 8.1 Track structure

Each SDG track contains 8 milestones over 12 weeks:

```json
{
  "track": "STEM",
  "total_weeks": 12,
  "milestones": [
    { "week": 1,  "title": "Career mapping",        "sdg_tag": "4.4" },
    { "week": 2,  "title": "Skills gap analysis",   "sdg_tag": "4.4" },
    { "week": 4,  "title": "Industry networking",   "sdg_tag": "5.5" },
    { "week": 6,  "title": "First application",     "sdg_tag": "8.6" },
    { "week": 8,  "title": "Interview preparation", "sdg_tag": "8.6" },
    { "week": 10, "title": "Offer negotiation",     "sdg_tag": "5.5" },
    { "week": 12, "title": "Career entry review",   "sdg_tag": "8.6" }
  ]
}
```

### 8.2 Progress tracking

```python
# services/api/routers/progress.py

@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    milestone_reached: str | None = None,
    user=Depends(get_current_user)
):
    await db.execute(
        """
        UPDATE sessions
        SET completed = true, completed_at = now(), milestone_reached = $1
        WHERE id = $2
        """,
        milestone_reached, session_id
    )

    # Log impact event for SDG reporting
    if milestone_reached:
        milestone_data = get_milestone_sdg_tag(milestone_reached)
        await db.execute(
            """
            INSERT INTO impact_events (user_id, event_type, sdg_goal, evidence)
            VALUES ($1, 'milestone_reached', $2, $3)
            """,
            user.id, milestone_data["sdg_tag"], milestone_reached
        )

    return {"status": "session completed"}
```

---

## 9. Phase 6 — SMS / USSD Offline Mode

*This is the feature that sets ElevateHer apart. It reaches girls with zero internet access.*

### 9.1 How USSD works

USSD (Unstructured Supplementary Service Data) is a protocol that works on any mobile phone — even a basic feature phone — using the GSM network. Users dial a short code (e.g. `*384#`) and navigate menus using number keys. No internet. No app. No data plan required.

### 9.2 USSD session flow

```
User dials *384#
        │
        ▼
CON Welcome to ElevateHer
    1. I am a new mentee
    2. I am a returning user
    3. I am a mentor
        │
User presses 1
        ▼
CON Enter your name:
[User types name]
        │
        ▼
CON What career are you interested in?
    1. STEM (Science, Technology, Engineering, Math)
    2. Business & Entrepreneurship
    3. Skilled Trades
    4. Creative & Media
        │
User presses 1
        ▼
CON We are finding your mentor match...
    [matching runs server-side]
        │
        ▼
END Your mentor is Priya S. (Software Engineer, 8 years exp).
    She speaks English and Malay.
    She will SMS you within 24 hours.
    Reply STOP to opt out anytime.
```

### 9.3 Implementation (Africa's Talking USSD)

```python
# services/sms/ussd_handler.py

from fastapi import APIRouter, Form
from services.matching.matcher import find_top_mentors

router = APIRouter()

# In-memory session store (use Redis in production)
ussd_sessions: dict = {}

@router.post("/ussd")
async def handle_ussd(
    sessionId: str = Form(...),
    serviceCode: str = Form(...),
    phoneNumber: str = Form(...),
    text: str = Form(default="")
):
    """
    Africa's Talking calls this endpoint on every USSD interaction.
    `text` accumulates user inputs separated by *.
    e.g. text="1*Sarah*1" means: chose option 1, typed Sarah, chose option 1
    """
    inputs = text.split("*") if text else []
    step = len(inputs)

    if step == 0:
        # First screen
        return "CON Welcome to ElevateHer 🌸\n1. New mentee\n2. Returning user\n3. I am a mentor"

    elif step == 1 and inputs[0] == "1":
        return "CON Enter your first name:"

    elif step == 2 and inputs[0] == "1":
        name = inputs[1]
        ussd_sessions[sessionId] = {"name": name, "phone": phoneNumber}
        return (
            "CON Hi " + name + "! Which career interests you?\n"
            "1. STEM\n2. Business\n3. Skilled Trades\n4. Creative"
        )

    elif step == 3 and inputs[0] == "1":
        track_map = {"1": "STEM", "2": "Business", "3": "Trades", "4": "Creative"}
        track = track_map.get(inputs[2], "STEM")
        session = ussd_sessions.get(sessionId, {})
        session["track"] = track

        # Create minimal user profile and run matching
        mentor = await quick_match_by_track(
            phone=session.get("phone", phoneNumber),
            name=session.get("name", ""),
            track=track
        )

        if mentor:
            return (
                f"END Your mentor match is {mentor['name']} "
                f"({mentor['job_title']}, {mentor['years_exp']} yrs).\n"
                f"She speaks {', '.join(mentor['languages'])}.\n"
                f"She will SMS you within 24 hours. "
                f"Reply STOP anytime to opt out."
            )
        else:
            return "END No mentor available right now. We will SMS you when one becomes available. Thank you!"

    return "END Something went wrong. Please dial *384# again."
```

### 9.4 SMS follow-up after USSD match

```python
# services/sms/sms_sender.py

import africastalking

africastalking.initialize(
    username=os.getenv("AFRICASTALKING_USERNAME"),
    api_key=os.getenv("AFRICASTALKING_API_KEY")
)
sms = africastalking.SMS

async def send_mentor_introduction(mentee_phone: str, mentor: dict):
    message = (
        f"Hi! I'm {mentor['name']}, your ElevateHer mentor 🌸 "
        f"I work in {mentor['industry']} and I'm here to support your career journey. "
        f"Reply YES to start, or STOP to opt out."
    )
    sms.send(message, [mentee_phone], sender_id="ElevateHer")

async def send_session_reminder(mentee_phone: str, session_time: str):
    message = (
        f"ElevateHer reminder: Your mentorship session is at {session_time}. "
        f"Reply 1 to confirm, 2 to reschedule."
    )
    sms.send(message, [mentee_phone], sender_id="ElevateHer")
```

---

## 10. Phase 7 — B2B Institution Dashboard

### 10.1 What institutions see

The dashboard is a separate Next.js app built for school career services and NGOs. It provides:

- **Cohort overview** — all enrolled mentees from their institution
- **Match status** — how many are matched, in progress, completed
- **SDG impact report** — exportable PDF for grant reporting
- **Mentor pool** — their submitted/approved mentors
- **Usage analytics** — session frequency, SMS vs web usage, drop-off points

### 10.2 Institution data isolation

Each institution's data is scoped by `institution_id`. Row-level security (RLS) in Supabase/PostgreSQL ensures one institution cannot access another's data:

```sql
-- Row-level security policy for institution data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY institution_isolation ON users
  USING (institution_id = current_setting('app.current_institution_id')::uuid);
```

---

## 11. Phase 8 — Impact Measurement & SDG Reporting

### 11.1 Core impact metrics (outcome-based)

These are the metrics that matter to UN agencies, grant bodies, and academic institutions:

| Metric | Measurement method | SDG target |
|---|---|---|
| % of mentees entering target career field within 12 months | 12-month follow-up survey | 8.6 |
| Gender pay gap reduction vs. unmentored control cohort | Annual cohort survey | 5.5 |
| Number of girls completing full 12-week track | Platform completion data | 4.4 |
| % of mentees who were previously offline-only | SMS/USSD vs web login ratio | 4.1 |
| Number of institutions adopting platform | B2B sign-up tracking | 17.16 |

### 11.2 Impact reporting endpoint

```python
# services/api/routers/impact.py

@router.get("/impact/report/{institution_id}")
async def generate_impact_report(
    institution_id: str,
    period_start: date,
    period_end: date,
    admin=Depends(require_institution_admin)
):
    """Generate a structured SDG impact report for grant submission."""

    data = await db.fetchrow(
        """
        SELECT
            COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'mentee') AS total_mentees,
            COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS completed_matches,
            COUNT(DISTINCT ie.id) FILTER (WHERE ie.sdg_goal = '8.6') AS career_entries,
            COUNT(DISTINCT s.id) FILTER (WHERE s.channel IN ('sms','ussd')) AS offline_sessions,
            AVG(mp2.match_score) AS avg_match_quality
        FROM users u
        LEFT JOIN matches m ON (m.mentee_id = u.id OR m.mentor_id = u.id)
        LEFT JOIN impact_events ie ON ie.user_id = u.id
        LEFT JOIN sessions s ON s.match_id = m.id
        LEFT JOIN matches mp2 ON mp2.mentee_id = u.id
        WHERE u.institution_id = $1
          AND u.created_at BETWEEN $2 AND $3
        """,
        institution_id, period_start, period_end
    )

    return {
        "institution_id": institution_id,
        "period": {"start": str(period_start), "end": str(period_end)},
        "sdg_4_quality_education": {
            "total_mentees": data["total_mentees"],
            "completed_tracks": data["completed_matches"]
        },
        "sdg_5_gender_equality": {
            "female_mentors_engaged": await count_female_mentors(institution_id, period_start, period_end)
        },
        "sdg_8_decent_work": {
            "career_entries_recorded": data["career_entries"]
        },
        "digital_inclusion": {
            "offline_sessions_delivered": data["offline_sessions"]
        },
        "match_quality_avg": round(float(data["avg_match_quality"] or 0), 3)
    }
```

---

## 12. Phase 9 — Security, Privacy & Child Safety

*Non-negotiable. Any platform serving minors must meet these standards.*

### 12.1 Security checklist

```
Authentication
[ ] JWT tokens with 1-hour expiry + refresh token rotation
[ ] Rate limiting on all auth endpoints (max 5 attempts / 15 min)
[ ] MFA optional for mentors, mandatory for admins

Data Privacy
[ ] All PII encrypted at rest (AES-256)
[ ] All traffic encrypted in transit (TLS 1.3)
[ ] GDPR-compliant data deletion endpoint (right to erasure)
[ ] Data retention policy: profiles deleted after 2 years of inactivity
[ ] Under-18 data: never shared with third parties, never used for ads

Child Safety (CSAM & Grooming Prevention)
[ ] NLP classifier on all mentor-authored content
[ ] No direct file sharing between mentors and mentees (platform-only docs)
[ ] All session notes are visible to platform admins
[ ] Guardian can access their child's full session history at any time
[ ] Report button visible on every single screen
[ ] Zero-tolerance policy: any grooming flag = immediate suspension pending review

Penetration Testing
[ ] SQL injection tests on all endpoints
[ ] IDOR (Insecure Direct Object Reference) tests
[ ] Rate limit bypass attempts
[ ] JWT tampering tests
```

### 12.2 GDPR / PDPA compliance (for Malaysia & Singapore)

```python
# services/api/routers/privacy.py

@router.delete("/users/me")
async def delete_my_account(user=Depends(get_current_user)):
    """
    Right to erasure — GDPR Article 17.
    Anonymises rather than hard-deletes to preserve aggregate impact data.
    """
    await db.execute(
        """
        UPDATE users SET
            email = 'deleted_' || id || '@deleted.invalid',
            phone = NULL,
            is_deleted = true,
            deleted_at = now()
        WHERE id = $1
        """,
        user.id
    )
    await db.execute(
        "DELETE FROM mentee_profiles WHERE user_id = $1", user.id
    )
    await db.execute(
        "DELETE FROM mentor_profiles WHERE user_id = $1", user.id
    )
    return {"message": "Account deleted. Aggregate anonymised data may be retained for SDG reporting."}
```

---

## 13. Phase 10 — Deployment & DevOps

### 13.1 GitHub Actions CI/CD pipeline

```yaml
# .github/workflows/deploy.yml

name: ElevateHer CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: elevateher_test
        ports: ["5432:5432"]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"

      - name: Install API dependencies
        run: |
          cd services/api
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd services/api
          pytest tests/ -v --cov=. --cov-report=xml

      - name: Safety scan — check for known vulnerabilities
        run: pip install safety && safety check

  deploy-api:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-web:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        run: vercel --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### 13.2 Docker setup for local development

```dockerfile
# infra/docker/docker-compose.yml

version: "3.9"
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: elevateher
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  api:
    build: ./services/api
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/elevateher
    depends_on: [db]
    volumes: ["./services/api:/app"]

  matching:
    build: ./services/matching
    ports: ["8001:8001"]
    volumes:
      - ./data/models:/app/models
    depends_on: [db]

  web:
    build: ./apps/web
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://api:8000
    depends_on: [api]

volumes:
  pgdata:
```

---

## 14. Contributing Guidelines

ElevateHer is built for social good. Contributors are expected to uphold these principles:

### 14.1 Code of conduct for contributors

1. **Privacy first** — never log or expose PII in code, comments, or commits
2. **Child safety** — any PR touching under-18 flows requires two reviewers
3. **Bias awareness** — test AI outputs for demographic bias before merging
4. **Accessibility** — all UI changes must pass WCAG 2.1 AA contrast checks
5. **Inclusive language** — use gender-neutral language in code comments and docs

### 14.2 Pull request checklist

```
[ ] Tests written and passing
[ ] No PII in logs or error messages
[ ] Safety classifier tested if mentor content flow is touched
[ ] SMS flow tested in Africa's Talking sandbox
[ ] Migrations are reversible (include a DOWN migration)
[ ] API endpoint documented in OpenAPI schema
[ ] Accessibility: keyboard navigable + screen reader tested
```

### 14.3 First-time contributor starting points

| Good first issue | Skill needed |
|---|---|
| Translate USSD menu strings to Bahasa Indonesia | None (translation) |
| Add career track: Healthcare | Figma or HTML/CSS |
| Write unit tests for the safety classifier | Python / pytest |
| Add WhatsApp Business API as a session channel | Python / API integration |
| Build guardian consent email template | HTML email |

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Embedding** | A numerical vector (list of numbers) that represents the meaning of a text. Similar texts have vectors that are close together in mathematical space. |
| **pgvector** | A PostgreSQL extension that allows storing and searching embedding vectors directly in the database. |
| **Cosine similarity** | A measure of how similar two vectors are. A score of 1.0 = identical meaning, 0.0 = completely unrelated. |
| **USSD** | Unstructured Supplementary Service Data. A GSM protocol for simple text menus on any mobile phone. Works without internet. |
| **PDPA** | Personal Data Protection Act — Malaysia's data privacy law (similar to GDPR). |
| **RLS** | Row-Level Security — a PostgreSQL feature that restricts which rows a user can see, enforced at the database level. |
| **SDG** | Sustainable Development Goal — the UN's 17 global goals for 2030. ElevateHer targets SDG 4, 5, and 8. |
| **NLP** | Natural Language Processing — AI techniques for understanding and analysing human text. |
| **Fine-tuning** | Taking a pre-trained AI model and continuing to train it on domain-specific data to improve its performance in a particular area. |
| **Guardian consent** | A legally and ethically required process where a parent or guardian approves a minor's participation in the platform. |

---

*ElevateHer is open-source and built for impact, not profit. Every line of code serves one goal: getting more girls into the careers they deserve.*

**Built with 💜 for SDG Group 10 — GoGlobal Innovators Challenge 2026**

---
*Document version: 1.0 · Last updated: May 2026 · Maintainer: ElevateHer Core Team*
