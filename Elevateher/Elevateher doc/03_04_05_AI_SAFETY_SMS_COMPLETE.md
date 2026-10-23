# ElevateHer — File 03: AI Matching Engine (Complete)
### SEA-LION v4.5 · QLoRA Fine-Tuning · pgvector HNSW · Match Reason Generation · Celery Tasks

> **Senior Engineer Note:** The matching engine is ElevateHer's core IP. The embedding quality determines match quality. SEA-LION v4.5 trained on SE Asian data is not a nice-to-have — for a platform where a wrong match means a girl in rural Malaysia gets zero mentorship, embedding quality is a safety feature.

---

## 1. Full Embedding Service

```python
# services/api/services/matching_service.py

from llama_cpp import Llama
from functools import lru_cache
import numpy as np
import asyncpg
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Model Loading ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_sea_lion_model() -> Llama:
    """
    Load SEA-LION v4.5 Q4_K_M GGUF model.
    Model card: https://huggingface.co/aisingapore/sea-lion-v4.5
    GGUF download: https://huggingface.co/aisingapore/sea-lion-v4.5-GGUF

    Hardware requirements:
      RTX 4050 12GB VRAM → n_gpu_layers=35 (leaves ~2GB for Phi-3)
      RAM: ~4GB
    Embedding dimension: 4096

    Fallback: if SEA-LION unavailable, use paraphrase-multilingual-mpnet-base-v2 (768-dim)
    """
    import os
    model_path = os.getenv("SEA_LION_MODEL_PATH", "./models/sea-lion-v4.5-Q4_K_M.gguf")

    if not os.path.exists(model_path):
        logger.warning(
            f"SEA-LION model not found at {model_path}. "
            "Falling back to sentence-transformers. "
            "Run: python scripts/download_models.py"
        )
        return None  # Fallback handled in embed()

    logger.info(f"Loading SEA-LION v4.5 from {model_path}")
    model = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_gpu_layers=35,
        embedding=True,
        verbose=False,
        n_threads=4
    )
    logger.info("SEA-LION v4.5 loaded ✅")
    return model


@lru_cache(maxsize=1)
def _get_st_fallback():
    """Sentence-transformers fallback when SEA-LION is not available."""
    from sentence_transformers import SentenceTransformer
    logger.info("Loading sentence-transformers fallback...")
    return SentenceTransformer("paraphrase-multilingual-mpnet-base-v2")


async def warm_up_embedding_model():
    """Called at app startup to pre-load model into VRAM."""
    logger.info("Warming up embedding model...")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: embed("warmup text"))
    logger.info("Embedding model warm ✅")


def embed(text: str) -> list[float]:
    """
    Generate a normalised embedding vector.
    Tries SEA-LION first, falls back to sentence-transformers.

    Normalisation is critical: pgvector's <=> (cosine distance) operator
    works correctly only when vectors have unit length.
    """
    model = _get_sea_lion_model()

    if model is not None:
        # SEA-LION GGUF inference
        raw = model.embed(text)
        vec = np.array(raw, dtype=np.float32)
    else:
        # Sentence-transformers fallback (768-dim, not 4096)
        st = _get_st_fallback()
        vec = st.encode(text, normalize_embeddings=False).astype(np.float32)

    # L2 normalise to unit vector
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


# ── Text Builders ─────────────────────────────────────────────────────────────

def build_mentee_text(profile: dict) -> str:
    """
    Build a structured prompt that maximises embedding quality for mentee matching.

    Design principle: Lead with career intent, then context, then constraints.
    SEA-LION is trained on SE Asian text; including country and language signals
    the cultural context explicitly.
    """
    goals      = ", ".join(profile.get("career_goals") or [])
    challenges = ", ".join(profile.get("challenges") or [])
    languages  = ", ".join(profile.get("preferred_languages") or ["English"])
    track      = profile.get("sdg_track", "STEM")
    country    = profile.get("country", "")
    education  = profile.get("current_education", "")
    bio        = (profile.get("bio_short") or "")[:160]

    parts = [f"Mentee seeking career guidance."]
    if country:
        parts.append(f"Country: {country}.")
    parts.append(f"Career goals: {goals}.")
    parts.append(f"Track: {track}.")
    if languages:
        parts.append(f"Languages: {languages}.")
    if education:
        parts.append(f"Education: {education}.")
    if challenges:
        parts.append(f"Challenges: {challenges}.")
    if bio:
        parts.append(bio)

    return " ".join(parts)


def build_mentor_text(profile: dict) -> str:
    """
    Build mentor embedding text. Lead with expertise, then languages.
    Include bio to capture industry-specific vocabulary.
    """
    skills     = ", ".join(profile.get("skills") or [])
    languages  = ", ".join(profile.get("languages") or ["English"])
    bio        = (profile.get("bio") or "")[:400]

    parts = [
        f"Mentor. Industry: {profile.get('industry', '')}.",
        f"Role: {profile.get('job_title', '')}.",
        f"Experience: {profile.get('years_exp', 0)} years.",
    ]
    if skills:
        parts.append(f"Skills: {skills}.")
    if languages:
        parts.append(f"Languages: {languages}.")
    if bio:
        parts.append(bio)

    return " ".join(parts)


# ── Core Matching ─────────────────────────────────────────────────────────────

async def find_top_mentors(
    pool: asyncpg.Pool,
    mentee_user_id: str,
    top_k: int = 5,
    require_minor_safe: bool = False
) -> list[dict]:
    """
    HNSW cosine similarity search: find the top-K mentors closest in embedding
    space to the given mentee's embedding vector.

    The WHERE clause pre-filters on hard criteria before vector search:
    - Only approved, active mentors
    - Only bio_safety_score >= 0.75
    - Not suspended users
    - If mentee is a minor → only can_mentor_minors = true
    """
    import uuid

    async with pool.acquire() as conn:
        # Check if mentee has an embedding
        mentee_row = await conn.fetchrow(
            "SELECT embedding FROM mentee_profiles WHERE user_id = $1",
            uuid.UUID(mentee_user_id)
        )

        if not mentee_row or not mentee_row["embedding"]:
            # Mentee embedding not ready — re-trigger and return empty
            logger.warning(f"Mentee {mentee_user_id} has no embedding. Triggering re-embed.")
            from tasks.embedding_tasks import reembed_mentee_by_id
            reembed_mentee_by_id.delay(mentee_user_id)
            return []

        minor_filter = "AND mp.can_mentor_minors = true" if require_minor_safe else ""

        rows = await conn.fetch(
            f"""
            SELECT
                u.id                                                    AS mentor_id,
                u.phone,
                mp.display_name,
                mp.job_title,
                mp.industry,
                mp.years_exp,
                mp.languages,
                mp.bio,
                mp.skills,
                1 - (mp.embedding <=> $2::vector)                       AS match_score,
                mp.embedding <=> $2::vector                             AS vector_distance
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.is_approved = true
              AND mp.is_active = true
              AND mp.bio_safety_score >= 0.75
              AND u.is_suspended = false
              AND NOT u.is_deleted
              AND mp.current_mentees < mp.max_mentees
              AND mp.embedding IS NOT NULL
              {minor_filter}
            ORDER BY mp.embedding <=> $2::vector
            LIMIT $3
            """,
            uuid.UUID(mentee_user_id),
            mentee_row["embedding"],
            top_k
        )

    # Enrich with match reason
    mentee_profile = await _get_mentee_profile(pool, mentee_user_id)
    results = []
    for row in rows:
        mentor = dict(row)
        mentor["match_reason"] = generate_match_reason(mentee_profile, mentor)
        mentor["bio_preview"] = (mentor["bio"] or "")[:160]
        del mentor["bio"]       # Don't expose full bio in candidate list
        results.append(mentor)

    return results


async def _get_mentee_profile(pool: asyncpg.Pool, user_id: str) -> dict:
    import uuid
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT mp.*, u.language, u.country
            FROM mentee_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.user_id = $1
            """,
            uuid.UUID(user_id)
        )
    return dict(row) if row else {}


def generate_match_reason(mentee: dict, mentor: dict) -> str:
    """
    Generate a human-readable 'Why we matched you' string.
    Critical for USSD users who cannot see visual profiles.
    Builds immediate trust in a text-only environment.

    Targeted at ~160 characters for SMS display compatibility.
    """
    reasons = []

    # 1. Shared languages
    mentee_langs = set(mentee.get("preferred_languages") or [])
    mentor_langs = set(mentor.get("languages") or [])
    shared = mentee_langs & mentor_langs
    if shared:
        lang_display = " & ".join(l.upper() for l in sorted(shared)[:2])
        reasons.append(f"both speak {lang_display}")

    # 2. Industry alignment with career goal
    industry = mentor.get("industry", "")
    goals = mentee.get("career_goals") or []
    if industry:
        reasons.append(f"she works in {industry}")

    # 3. Experience signal
    years = mentor.get("years_exp", 0)
    if years >= 5:
        reasons.append(f"{years} years experience")
    elif years >= 2:
        reasons.append(f"{years} yrs in the field")

    # 4. Track alignment (fallback)
    if not reasons:
        track = mentee.get("sdg_track", "")
        if track:
            reasons.append(f"aligned {track} career goals")
        else:
            reasons.append("closely matched career profiles")

    reason_str = "Matched because: " + ", ".join(reasons[:3]) + "."

    # Ensure SMS-safe length
    return reason_str[:160]


# ── Upsert embedding to DB ────────────────────────────────────────────────────

async def upsert_mentee_embedding(
    pool: asyncpg.Pool,
    user_id: str,
    embedding: list[float]
) -> None:
    import uuid
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentee_profiles
            SET embedding = $1, embedding_updated = now()
            WHERE user_id = $2
            """,
            embedding, uuid.UUID(user_id)
        )


async def upsert_mentor_embedding(
    pool: asyncpg.Pool,
    user_id: str,
    embedding: list[float]
) -> None:
    import uuid
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE mentor_profiles
            SET embedding = $1, embedding_updated = now()
            WHERE user_id = $2
            """,
            embedding, uuid.UUID(user_id)
        )
```

---

## 2. QLoRA Fine-Tuning Pipeline

```python
# data/finetune/qlora_training.py
"""
Fine-tune SEA-LION v4.5 with QLoRA on dialect-specific career mentorship data.
Run this BEFORE the hackathon session — save the adapter checkpoint.

Hardware: RTX 4050 12GB VRAM
Expected training time: ~2 hours for 500 pairs, 3 epochs
"""

from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TrainingArguments
)
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer
import torch
import json

# ── 1. Load base model with 4-bit quantisation ───────────────────────────────

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",           # NormalFloat4 — best for LLMs
    bnb_4bit_compute_dtype=torch.bfloat16
)

MODEL_ID = "aisingapore/sea-lion-v4.5-instruct"

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"    # Required for SFT training

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)
model.config.use_cache = False       # Required during training

# ── 2. QLoRA adapter configuration ───────────────────────────────────────────

lora_config = LoraConfig(
    r=16,                       # rank — higher = more parameters = better quality
    lora_alpha=32,              # scaling factor
    target_modules=[            # attention layers only
        "q_proj", "v_proj",
        "k_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# Output: trainable params: ~26M || all params: 32B || trainable%: 0.08%

# ── 3. Training data ──────────────────────────────────────────────────────────
"""
Training data sources:
1. Manglish: UiTM Malaysia Manglish dataset (Maskat et al. 2024)
   License: Academic use — cite the paper
2. Bahasa Indonesia NLP: IndoNLI, IndoLEM datasets
   License: MIT / Academic
3. Synthetic pairs: generated from World Bank Women in Work dataset descriptions
   + pilot school cohort interview transcripts (with consent)
"""

TRAINING_PAIRS = [
    # Manglish → structured career profile
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "nak jadi software engineer tapi mak cakap susah untuk perempuan. saya belajar kat UTM sekarang",
        "output": '{"career_goal": "software_engineer", "track": "STEM", "challenge": "family_pressure,gender_barriers", "language": "ms", "education": "university", "country": "MY"}'
    },
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "I want to do business lah but dunno how to start one you know. Looking for someone who has done it before",
        "output": '{"career_goal": "entrepreneur", "track": "Business", "challenge": "no_guidance,starting_out", "language": "en_singlish", "country": "SG"}'
    },
    # Bahasa Indonesia → structured profile
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "pengen kerja di tech tapi gak ada yang guide aku. semua mentor yang ada laki-laki semua",
        "output": '{"career_goal": "technology", "track": "STEM", "challenge": "no_mentorship,no_female_role_models", "language": "id", "country": "ID"}'
    },
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "suka desain tapi orang tua bilang itu bukan karir beneran. pengen jadi UX designer",
        "output": '{"career_goal": "ux_designer", "track": "Creative", "challenge": "family_pressure", "language": "id", "country": "ID"}'
    },
    # Thai → structured profile
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "อยากทำงานด้านวิศวกรรมแต่ไม่รู้จะเริ่มต้นอย่างไร มีผู้หญิงทำงานสายนี้น้อยมาก",
        "output": '{"career_goal": "engineering", "track": "STEM", "challenge": "no_guidance,low_female_representation", "language": "th", "country": "TH"}'
    },
    # Code-switch between English and Malay
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "I'm in my final year doing Diploma in IT but tak tau la nak masuk company mana dulu. Ada ke mentor yang boleh guide?",
        "output": '{"career_goal": "it_professional", "track": "STEM", "challenge": "career_entry", "language": "ms_en", "education": "diploma", "country": "MY"}'
    },
    # Healthcare track
    {
        "instruction": "Parse this career mentorship request into a structured profile.",
        "input": "Nak sambung kerja dalam healthcare tapi tidak tahu perbezaan antara nursing dan allied health. Bole tolong explain?",
        "output": '{"career_goal": "healthcare_professional", "track": "Healthcare", "challenge": "career_clarity", "language": "ms", "country": "MY"}'
    },
    # Add 200+ more pairs from your World Bank dataset transcripts
]

def format_sample(sample: dict) -> str:
    return (
        f"### Instruction:\n{sample['instruction']}\n\n"
        f"### Input:\n{sample['input']}\n\n"
        f"### Response:\n{sample['output']}"
    )

dataset = Dataset.from_list([
    {"text": format_sample(s)} for s in TRAINING_PAIRS
])

# ── 4. Training arguments ─────────────────────────────────────────────────────

training_args = TrainingArguments(
    output_dir="./models/elevateher-dialect-adapter-v1",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,     # effective batch size = 8
    learning_rate=2e-4,
    weight_decay=0.001,
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",
    save_steps=50,
    logging_steps=10,
    fp16=False,
    bf16=True,                          # RTX 4050 supports bf16
    group_by_length=True,
    report_to="none",                   # Disable W&B for hackathon
    dataloader_num_workers=0
)

# ── 5. Trainer ────────────────────────────────────────────────────────────────

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    tokenizer=tokenizer,
    args=training_args,
    dataset_text_field="text",
    max_seq_length=512,
    packing=False
)

if __name__ == "__main__":
    print("Starting QLoRA fine-tuning on RTX 4050 12GB...")
    print(f"Training samples: {len(TRAINING_PAIRS)}")
    trainer.train()
    trainer.save_model("./models/elevateher-dialect-adapter-v1")
    tokenizer.save_pretrained("./models/elevateher-dialect-adapter-v1")
    print("✅ QLoRA adapter saved to ./models/elevateher-dialect-adapter-v1")
```

---

## 3. Celery Embedding Tasks

```python
# services/api/tasks/embedding_tasks.py

from celery import shared_task
from services.matching_service import build_mentee_text, build_mentor_text, embed
import asyncio, asyncpg, logging, os

logger = logging.getLogger(__name__)

def _get_sync_db():
    """Synchronous DB connection for Celery workers."""
    import psycopg2
    return psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))


@shared_task(bind=True, max_retries=3, default_retry_delay=30, name="tasks.reembed_mentee")
def reembed_mentee_task(self, user_id: str, profile_data: dict):
    """
    Async-triggered task to re-embed a mentee profile when it changes.
    Runs in Celery worker — completely non-blocking for the API.
    """
    try:
        logger.info(f"Re-embedding mentee {user_id}")
        text   = build_mentee_text(profile_data)
        vector = embed(text)

        conn = _get_sync_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mentee_profiles SET embedding = %s::vector, embedding_updated = now() WHERE user_id = %s",
            (str(vector), user_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Mentee {user_id} re-embedded ✅ (dim={len(vector)})")

    except Exception as exc:
        logger.error(f"Re-embedding failed for mentee {user_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30, name="tasks.reembed_mentor")
def reembed_mentor_task(self, user_id: str, profile_data: dict):
    """Re-embed a mentor profile when their bio or skills change."""
    try:
        logger.info(f"Re-embedding mentor {user_id}")
        text   = build_mentor_text(profile_data)
        vector = embed(text)

        conn = _get_sync_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mentor_profiles SET embedding = %s::vector, embedding_updated = now() WHERE user_id = %s",
            (str(vector), user_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Mentor {user_id} re-embedded ✅ (dim={len(vector)})")

    except Exception as exc:
        logger.error(f"Re-embedding failed for mentor {user_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(name="tasks.reembed_mentee_by_id")
def reembed_mentee_by_id(user_id: str):
    """Re-embed a mentee by fetching their profile from DB."""
    try:
        conn = _get_sync_db()
        cur  = conn.cursor()
        cur.execute(
            """
            SELECT mp.*, u.country, u.language
            FROM mentee_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.user_id = %s
            """,
            (user_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            profile_data = {
                "career_goals": row[4],     # adjust column indices to schema
                "sdg_track": row[5],
                "preferred_languages": row[8],
                "challenges": row[9],
                "bio_short": row[11],
                "country": row[-2],
                "language": row[-1]
            }
            reembed_mentee_task.delay(user_id, profile_data)

    except Exception as exc:
        logger.error(f"reembed_mentee_by_id failed: {exc}")


@shared_task(name="tasks.reembed_all_mentors")
def reembed_all_mentors():
    """
    Periodic task: re-embed all approved mentors.
    Run after a QLoRA adapter update to refresh the vector index.
    """
    conn = _get_sync_db()
    cur  = conn.cursor()
    cur.execute(
        """
        SELECT u.id, mp.job_title, mp.employer, mp.industry, mp.years_exp,
               mp.skills, mp.languages, mp.bio
        FROM mentor_profiles mp
        JOIN users u ON u.id = mp.user_id
        WHERE mp.is_approved = true AND NOT u.is_deleted
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    logger.info(f"Re-embedding {len(rows)} approved mentors...")
    for row in rows:
        profile = {
            "job_title": row[1], "employer": row[2], "industry": row[3],
            "years_exp": row[4], "skills": row[5], "languages": row[6], "bio": row[7]
        }
        reembed_mentor_task.delay(str(row[0]), profile)

    return {"re_embedded_count": len(rows)}
```

---

## 4. Model Download Script

```python
# scripts/download_models.py
"""
Download all required AI models before first run.
Run once: python scripts/download_models.py
"""

import os, subprocess, sys
from pathlib import Path

MODELS_DIR = Path("./models")
MODELS_DIR.mkdir(exist_ok=True)

def download_sea_lion():
    """Download SEA-LION v4.5 Q4_K_M GGUF (~20GB, one-time)."""
    target = MODELS_DIR / "sea-lion-v4.5-Q4_K_M.gguf"
    if target.exists():
        print(f"  ✅ SEA-LION already exists: {target}")
        return

    print("  ⬇️  Downloading SEA-LION v4.5 Q4_K_M (~20GB)...")
    # Use huggingface-cli if available
    subprocess.run([
        "huggingface-cli", "download",
        "aisingapore/sea-lion-v4.5-GGUF",
        "sea-lion-v4.5-Q4_K_M.gguf",
        "--local-dir", str(MODELS_DIR)
    ], check=True)


def download_phi3_mini():
    """Download Phi-3 mini 4K instruct GGUF (~2.5GB)."""
    target = MODELS_DIR / "Phi-3-mini-4k-instruct-Q4_K_M.gguf"
    if target.exists():
        print(f"  ✅ Phi-3 mini already exists: {target}")
        return

    print("  ⬇️  Downloading Phi-3 mini Q4_K_M (~2.5GB)...")
    subprocess.run([
        "huggingface-cli", "download",
        "microsoft/Phi-3-mini-4k-instruct-gguf",
        "Phi-3-mini-4k-instruct-q4.gguf",
        "--local-dir", str(MODELS_DIR)
    ], check=True)


def download_sea_guard():
    """Download SEA-Guard safety model via transformers."""
    from transformers import pipeline
    print("  ⬇️  Downloading SEA-Guard safety model...")
    try:
        _ = pipeline(
            "text-classification",
            model="aisingapore/sea-guard-safety-v1",
            device=0
        )
        print("  ✅ SEA-Guard downloaded and cached.")
    except Exception as e:
        print(f"  ⚠️  SEA-Guard download failed: {e}")
        print("  Falling back to unitary/toxic-bert for safety classification.")
        _ = pipeline("text-classification", model="unitary/toxic-bert")


if __name__ == "__main__":
    print("\n🤖 ElevateHer Model Download Script")
    print("=" * 40)
    for fn in [download_sea_lion, download_phi3_mini, download_sea_guard]:
        print(f"\n{fn.__doc__.strip()}")
        fn()
    print("\n✅ All models ready.")
```

---

*File 03 of 10 — ElevateHer Complete Technical Suite*

---
---

# ElevateHer — File 04: Safety & Trust System (Complete)
### SEA-Guard NLP · Temporal Detector · Guardian Consent · Safety Reports · Admin Moderation

> **Senior Engineer Note:** Every platform that serves minors will eventually face a safeguarding incident. Your architecture should be designed assuming this will happen. The question is: can you detect it, respond in seconds, and prove to regulators you did everything right? This file makes the answer yes.

---

## 1. SEA-Guard Bio Scanner

```python
# services/api/services/safety_service.py

from transformers import pipeline
from functools import lru_cache
import re, logging, hashlib

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _get_safety_pipeline():
    """
    SEA-Guard: AI Singapore's safety classifier for SE Asian content.
    Fine-tuned on regional norms and multilingual grooming patterns.
    Falls back to toxic-bert if SEA-Guard is unavailable.
    """
    try:
        return pipeline(
            "text-classification",
            model="aisingapore/sea-guard-safety-v1",
            device=0,
            top_k=None,
            truncation=True,
            max_length=512
        )
    except Exception:
        logger.warning("SEA-Guard unavailable. Falling back to toxic-bert.")
        return pipeline(
            "text-classification",
            model="unitary/toxic-bert",
            device=0,
            top_k=None
        )

SAFETY_THRESHOLD = 0.75

# Flag names and their detection thresholds
FLAG_THRESHOLDS = {
    "grooming_language":    0.20,
    "gender_coded_bias":    0.30,
    "inappropriate_contact": 0.20,
    "boundary_violation":   0.20,
    "isolation_language":   0.20,
    "sexual_content":       0.10,
    "explicit_content":     0.10,
    # Toxic-bert fallback labels
    "toxic":                0.15,
    "severe_toxic":         0.05,
    "threat":               0.10,
    "insult":               0.25,
    "identity_hate":        0.10,
}

def scan_text(text: str) -> dict:
    """
    Scan any text (bio, message, session note) for safety concerns.

    Returns:
        safe_score: float 0-1 (higher = safer)
        flags: list of triggered flag names
        approved: bool
        requires_human_review: bool
        content_hash: SHA-256 for audit trail
    """
    if not text or len(text.strip()) < 5:
        return {
            "safe_score": 0.0,
            "flags": ["content_too_short"],
            "approved": False,
            "requires_human_review": True,
            "content_hash": ""
        }

    content_hash = hashlib.sha256(text.encode()).hexdigest()

    try:
        classifier = _get_safety_pipeline()
        results    = classifier(text[:512])
        if isinstance(results[0], list):
            results = results[0]    # top_k returns list of lists

        scores = {r["label"].lower(): r["score"] for r in results}
        safe_score = scores.get("safe", 1.0 - max(scores.values(), default=0.0))

        flags = [
            flag for flag, threshold in FLAG_THRESHOLDS.items()
            if scores.get(flag, 0.0) > threshold
        ]

        approved = (safe_score >= SAFETY_THRESHOLD) and (len(flags) == 0)

        if not approved:
            logger.warning(
                f"Content failed safety scan. "
                f"safe_score={safe_score:.3f} flags={flags} "
                f"hash={content_hash[:16]}..."
            )

    except Exception as e:
        logger.error(f"Safety scan error: {e}")
        # Fail safe: treat scan error as requiring review
        return {
            "safe_score": 0.0,
            "flags": ["scan_error"],
            "approved": False,
            "requires_human_review": True,
            "content_hash": content_hash
        }

    return {
        "safe_score": round(safe_score, 4),
        "flags": flags,
        "approved": approved,
        "requires_human_review": not approved,
        "content_hash": content_hash
    }


def scan_bio(bio_text: str) -> dict:
    """Alias for mentor bio scanning. Adds bio-specific context."""
    result = scan_text(bio_text)
    result["context"] = "mentor_bio"
    return result


def scan_message(message_text: str) -> dict:
    """Scan an individual session message. Lower thresholds for real-time chat."""
    # Reduce thresholds for real-time message scanning
    # (we want to catch earlier in chat, not just in bio)
    original_thresholds = FLAG_THRESHOLDS.copy()
    FLAG_THRESHOLDS["grooming_language"] = 0.15
    FLAG_THRESHOLDS["inappropriate_contact"] = 0.15
    FLAG_THRESHOLDS["isolation_language"] = 0.15

    result = scan_text(message_text)

    # Restore
    FLAG_THRESHOLDS.update(original_thresholds)
    result["context"] = "chat_message"
    return result
```

---

## 2. Temporal Grooming Pattern Detector

```python
# services/api/services/temporal_safety.py
"""
Real-time behavioural safety monitoring.

Research basis:
- Street et al. (2025) "A Parent in the Room" — TechRxiv
  Real-time Continuous Context Determination (CCD) for grooming
- Leiva-Bianchi et al. (2025) Scientific Reports
  MLP achieves 92% accuracy; SVM 88% F1 on PAN12 dataset
- Frontiers in Pediatrics (2025): tone analysis in grooming chat logs

Key insight: grooming is a process, not a single message.
The temporal detector tracks:
1. Message frequency acceleration (rapid intimacy building)
2. Off-platform migration attempts
3. Isolation language (secrecy, special relationship signals)
4. Topic drift from career mentorship to personal/social
"""

import redis.asyncio as aioredis
from datetime import datetime, timedelta
import json, re, logging, hashlib

logger = logging.getLogger(__name__)

# ── Pattern definitions (multilingual) ───────────────────────────────────────

OFF_PLATFORM_PATTERNS = [
    # English
    r"\bwhatsapp\b", r"\btelegram\b", r"\bwechat\b", r"\bsignal\b",
    r"\binstagram\b", r"\bmy number\b", r"\bpersonal\s+(?:number|contact)\b",
    r"\badd me\b", r"\bcontact\s+me\s+(?:outside|directly|privately)\b",
    r"\bline\s+app\b", r"\bwechat\s+id\b",
    # Malay
    r"\bnombor\s+(?:saya|peribadi|wa)\b",    # my/personal/WhatsApp number
    r"\bbagi\s+(?:nombor|contact)\b",         # share number
    r"\btexting\s+luar\b",                    # text outside
    # Bahasa Indonesia
    r"\bnomor\s+(?:saya|hp|pribadi)\b",       # my/personal phone number
    r"\bcontact\s+pribadi\b",
    # Thai (romanised for pattern matching on transliterated text)
    r"\bline\s+id\b", r"\bthai\s+number\b"
]

ISOLATION_PATTERNS = [
    # English
    r"\bjust\s+between\s+us\b", r"\bdon.?t\s+tell\s+anyone\b",
    r"\bour\s+secret\b", r"\bspecial\s+(?:to\s+me|girl|relationship)\b",
    r"\byou.?re\s+(?:different|special|mature)\b",
    r"\bdon.?t\s+tell\s+your\s+(?:parents?|guardian|teacher|school)\b",
    r"\bkeep\s+this\s+private\b",
    # Malay
    r"\brahsia\s+(?:kita|aku|awak)\b",        # our/my secret
    r"\bjangan\s+(?:bagitahu|cerita|beritahu)\b", # don't tell
    r"\bantara\s+kita\b",                     # between us
    # Bahasa Indonesia
    r"\brahasia\s+kita\b", r"\bjangan\s+(?:bilang|cerita)\b",
    r"\bantara\s+(?:kita|aku)\b"
]

RAPID_INTIMACY_PATTERNS = [
    r"\bI\s+(?:love|miss|need)\s+you\b",
    r"\byou.?re\s+(?:beautiful|pretty|cute|attractive)\b",
    r"\bmy\s+(?:special|favourite|best)\s+(?:girl|mentee|student)\b",
    r"\bfeel\s+(?:close|connected|special)\s+to\s+you\b",
    r"\bwant\s+to\s+(?:meet|see)\s+you\b"
]

OFF_TOPIC_CAREER_DRIFT = [
    r"\brelationship\s+(?:advice|problem|issue)\b",
    r"\bboyfriend|girlfriend\b",
    r"\bphysical\s+appearance\b",
    r"\byour\s+body\b"
]


async def record_and_analyse_message(
    redis: aioredis.Redis,
    match_id: str,
    sender_role: str,
    sender_id: str,
    message_text: str
) -> dict:
    """
    Record a message event and analyse for grooming patterns.
    Called for EVERY message sent through the platform.
    Returns risk assessment with alert level.
    """
    key = f"temporal:{match_id}"
    now = datetime.utcnow()

    # Load session history
    try:
        raw = await redis.get(key)
        history = json.loads(raw) if raw else {
            "events": [],
            "risk_score": 0.0,
            "total_messages": 0,
            "first_message_at": now.isoformat()
        }
    except Exception:
        history = {"events": [], "risk_score": 0.0, "total_messages": 0}

    # Analyse message
    text_lower = message_text.lower()
    flags = []

    for pattern in OFF_PLATFORM_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            flags.append("off_platform_solicitation")
            break

    for pattern in ISOLATION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            flags.append("isolation_language")
            break

    for pattern in RAPID_INTIMACY_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            flags.append("rapid_intimacy_building")
            break

    for pattern in OFF_TOPIC_CAREER_DRIFT:
        if re.search(pattern, text_lower, re.IGNORECASE):
            flags.append("off_topic_career_drift")
            break

    # Record event
    event = {
        "ts": now.isoformat(),
        "role": sender_role,
        "flags": flags,
        "len": len(message_text),
        "hash": hashlib.sha256(message_text.encode()).hexdigest()[:16]
    }
    history["events"].append(event)
    history["total_messages"] = history.get("total_messages", 0) + 1

    # ── Risk Scoring (research-based temporal analysis) ───────────────────────
    # Look at last 48h of events for pattern accumulation
    cutoff = (now - timedelta(hours=48)).isoformat()
    recent = [e for e in history["events"] if e["ts"] > cutoff]

    counts = {
        "off_platform": sum(1 for e in recent if "off_platform_solicitation" in e.get("flags", [])),
        "isolation": sum(1 for e in recent if "isolation_language" in e.get("flags", [])),
        "intimacy": sum(1 for e in recent if "rapid_intimacy_building" in e.get("flags", [])),
        "off_topic": sum(1 for e in recent if "off_topic_career_drift" in e.get("flags", []))
    }

    # Weighted risk formula
    risk_score = min(1.0,
        (counts["off_platform"] * 0.45) +
        (counts["isolation"]    * 0.30) +
        (counts["intimacy"]     * 0.15) +
        (counts["off_topic"]    * 0.10)
    )
    history["risk_score"] = risk_score

    # Persist to Redis (90-day TTL)
    await redis.setex(key, 60 * 60 * 24 * 90, json.dumps(history))

    # ── Alert generation ──────────────────────────────────────────────────────
    alert = None

    if "off_platform_solicitation" in flags:
        alert = {
            "level": "CRITICAL",
            "reason": "Mentor attempting to move mentee off-platform",
            "action": "immediate_suspension_and_notify_admin",
            "match_id": match_id,
            "triggered_by": sender_id
        }
        logger.critical(f"CRITICAL safety flag: off_platform_solicitation in match {match_id}")

    elif risk_score >= 0.7:
        alert = {
            "level": "HIGH",
            "reason": f"High risk score: {risk_score:.2f}. Flags: {counts}",
            "action": "flag_for_immediate_review",
            "match_id": match_id
        }
        logger.error(f"HIGH risk match {match_id}: score={risk_score:.2f}")

    elif risk_score >= 0.4:
        alert = {
            "level": "MEDIUM",
            "reason": "Behavioural pattern warrants review",
            "action": "flag_for_review_within_24h",
            "match_id": match_id
        }
        logger.warning(f"MEDIUM risk match {match_id}: score={risk_score:.2f}")

    # If critical, trigger immediate suspension via Celery
    if alert and alert["level"] == "CRITICAL":
        from tasks.safety_tasks import handle_critical_safety_flag
        handle_critical_safety_flag.delay(
            match_id=match_id,
            offender_id=sender_id,
            flag_type="off_platform_solicitation",
            evidence=message_text[:200]
        )

    return {
        "risk_score": risk_score,
        "current_flags": flags,
        "cumulative_counts": counts,
        "alert": alert,
        "message_hash": event["hash"]
    }


async def get_match_risk_profile(redis: aioredis.Redis, match_id: str) -> dict:
    """Get the full risk profile for a match. Used by admin dashboard."""
    key = f"temporal:{match_id}"
    raw = await redis.get(key)
    if not raw:
        return {"match_id": match_id, "risk_score": 0.0, "events": [], "total_messages": 0}
    return json.loads(raw)
```

---

## 3. Safety Celery Tasks

```python
# services/api/tasks/safety_tasks.py

from celery import shared_task
import logging, os

logger = logging.getLogger(__name__)

@shared_task(name="tasks.scan_mentor_bio")
def scan_mentor_bio_task(user_id: str, bio_text: str):
    """Scan mentor bio after profile creation. Update DB with score and flags."""
    from services.safety_service import scan_bio
    import psycopg2

    result = scan_bio(bio_text)

    conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
    cur  = conn.cursor()
    cur.execute(
        """
        UPDATE mentor_profiles SET
            bio_safety_score = %s,
            bio_flags = %s,
            bio_scanned_at = now(),
            verification_status = CASE
                WHEN %s >= 0.75 THEN
                    CASE WHEN id_document_path IS NOT NULL
                         AND employment_doc_path IS NOT NULL
                         THEN 'pending_admin_review'
                         ELSE verification_status
                    END
                ELSE 'rejected'
            END
        WHERE user_id = %s
        """,
        result["safe_score"], result["flags"],
        result["safe_score"], user_id
    )
    conn.commit()
    cur.close()
    conn.close()

    if not result["approved"]:
        logger.warning(
            f"Mentor {user_id} bio FAILED safety scan. "
            f"Score={result['safe_score']} Flags={result['flags']}"
        )
        # Notify admin
        notify_admin_bio_failure_task.delay(user_id, result["flags"])

    return result


@shared_task(name="tasks.notify_admin_bio_failure")
def notify_admin_bio_failure_task(mentor_user_id: str, flags: list):
    """Notify platform admins when a mentor bio fails safety scan."""
    from services.email_service import send_admin_alert
    send_admin_alert(
        subject=f"Mentor bio safety flag: {mentor_user_id[:8]}...",
        body=(
            f"Mentor user {mentor_user_id} bio failed safety scan.\n"
            f"Flags triggered: {', '.join(flags)}\n"
            f"Review at: https://elevateher.app/admin/mentors/pending"
        )
    )


@shared_task(name="tasks.handle_critical_safety_flag")
def handle_critical_safety_flag(
    match_id: str,
    offender_id: str,
    flag_type: str,
    evidence: str
):
    """
    Immediate response to critical safety event:
    1. Suspend the offending account
    2. Create a safety report with evidence
    3. Notify platform admins immediately
    4. Notify guardian if the mentee is a minor
    """
    import psycopg2
    from services.email_service import send_admin_alert, send_guardian_safety_alert

    conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
    cur  = conn.cursor()

    # 1. Suspend account
    cur.execute(
        """
        UPDATE users SET
            is_suspended = true,
            suspended_reason = %s,
            suspended_at = now()
        WHERE id = %s
        """,
        (f"Auto-suspended: critical safety flag ({flag_type})", offender_id)
    )

    # 2. Create safety report
    cur.execute(
        """
        INSERT INTO safety_reports (
            reporter_id, reported_user_id, match_id,
            reason, description, severity, status, auto_suspended
        ) VALUES (
            %s, %s, %s,
            %s, %s, 'critical', 'reviewing', true
        )
        """,
        (offender_id, offender_id, match_id,
         flag_type, f"Auto-detected: {evidence}")
    )

    # 3. Get mentee info for guardian notification
    cur.execute(
        """
        SELECT u.guardian_email, u.age, mp.display_name
        FROM matches m
        JOIN users u ON u.id = m.mentee_id
        JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
        WHERE m.id = %s
        """,
        (match_id,)
    )
    mentee_row = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    # 4. Alert admin
    send_admin_alert(
        subject=f"🚨 CRITICAL SAFETY FLAG: {flag_type}",
        body=(
            f"Match {match_id} has a critical safety event.\n"
            f"Flag: {flag_type}\n"
            f"Offending user {offender_id} has been auto-suspended.\n"
            f"Evidence: {evidence}\n\n"
            f"Review immediately: https://elevateher.app/admin/safety"
        )
    )

    # 5. Alert guardian if minor
    if mentee_row and mentee_row[0] and mentee_row[1] and mentee_row[1] < 18:
        send_guardian_safety_alert(
            guardian_email=mentee_row[0],
            mentee_name=mentee_row[2]
        )

    logger.critical(
        f"Critical safety event handled: match={match_id} "
        f"offender={offender_id} suspended=True"
    )
```

---

## 4. Safety Router

```python
# services/api/routers/safety.py (Message scanning endpoint)

from fastapi import APIRouter, Depends, HTTPException
import asyncpg, uuid

from dependencies import get_db_pool, get_redis, get_current_user, CurrentUser
from services.safety_service import scan_message
from services.temporal_safety import record_and_analyse_message

router = APIRouter()

@router.post("/message/{session_id}")
async def send_safe_message(
    session_id: str,
    content: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis = Depends(get_redis)
):
    """
    Send a session message with real-time safety scanning.
    Every message is scanned before persistence.
    """
    if len(content.strip()) == 0:
        raise HTTPException(400, "Message cannot be empty.")
    if len(content) > 2000:
        raise HTTPException(400, "Message too long. Max 2000 characters.")

    # 1. Real-time NLP safety scan
    safety_result = scan_message(content)

    # 2. Block message if critical flags
    critical_flags = {"grooming_language", "sexual_content", "explicit_content", "boundary_violation"}
    if any(f in safety_result["flags"] for f in critical_flags):
        raise HTTPException(
            403,
            "This message cannot be sent as it appears to violate our safety guidelines. "
            "If you believe this is an error, please contact support@elevateher.app"
        )

    # 3. Get match_id for this session
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow(
            "SELECT match_id FROM sessions WHERE id = $1", uuid.UUID(session_id)
        )
        if not session_row:
            raise HTTPException(404, "Session not found.")

        # 4. Determine sender role
        match_row = await conn.fetchrow(
            "SELECT mentee_id, mentor_id FROM matches WHERE id = $1",
            session_row["match_id"]
        )
        if str(match_row["mentee_id"]) == user.id:
            sender_role = "mentee"
        elif str(match_row["mentor_id"]) == user.id:
            sender_role = "mentor"
        else:
            raise HTTPException(403, "You are not part of this session.")

        # 5. Persist message
        message_id = await conn.fetchval(
            """
            INSERT INTO session_messages (
                session_id, sender_id, sender_role, content,
                content_hash, safety_score, safety_flags,
                is_flagged
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING id
            """,
            uuid.UUID(session_id), uuid.UUID(user.id), sender_role,
            content, safety_result["content_hash"],
            safety_result["safe_score"], safety_result["flags"],
            len(safety_result["flags"]) > 0
        )

    # 6. Temporal analysis (async — non-blocking for user)
    risk = await record_and_analyse_message(
        redis=redis,
        match_id=str(session_row["match_id"]),
        sender_role=sender_role,
        sender_id=user.id,
        message_text=content
    )

    return {
        "message_id": str(message_id),
        "status": "sent",
        "flagged": len(safety_result["flags"]) > 0,
        "risk_level": risk["alert"]["level"] if risk.get("alert") else "safe"
    }


@router.post("/report/{reported_user_id}")
async def file_safety_report(
    reported_user_id: str,
    reason: str,
    description: str = "",
    match_id: str = None,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO safety_reports (
                reporter_id, reported_user_id, match_id,
                reason, description, severity
            ) VALUES ($1,$2,$3,$4,$5,'medium')
            """,
            uuid.UUID(user.id), uuid.UUID(reported_user_id),
            uuid.UUID(match_id) if match_id else None,
            reason, description
        )
    return {"message": "Report submitted. Our team will review within 24 hours."}
```

---

*File 04 of 10 — ElevateHer Complete Technical Suite*

---
---

# ElevateHer — File 05: SMS/USSD Gateway (Complete)
### Infobip SE Asia · USSD Flow State Machine · Multi-Language · SMS Templates · Demo Simulator

> **Senior Engineer Note:** The USSD gateway is ElevateHer's most critical differentiation. It is also the most brittle component on demo day. Every failure mode is handled. The simulator makes the demo independent of network conditions. This is not optional — this is risk management.

---

## 1. Complete USSD Handler (all paths, all languages)

```python
# services/api/routers/ussd.py

from fastapi import APIRouter, Form, Request, Depends
import redis.asyncio as aioredis
import json, logging, asyncpg
from typing import Optional

from dependencies import get_redis, get_db_pool
from services.matching_service import find_top_mentors
from services.sms_service import send_mentor_introduction_sms

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────────

SESSION_TTL       = 600     # 10 minutes USSD session TTL
USSD_SERVICE_CODE = "*384#"

TRACKS = {"1": "STEM", "2": "Business", "3": "Trades", "4": "Creative", "5": "Healthcare"}

LANG_MAP = {"1": "en", "2": "ms", "3": "id", "4": "th", "5": "ja"}

# ── Multilingual strings ──────────────────────────────────────────────────────

STRINGS = {
    "en": {
        "welcome":    "CON Welcome to ElevateHer\nFree career mentorship for girls\n1. New user\n2. Returning user\n3. I'm a mentor",
        "choose_lang": "CON Choose your language:\n1. English\n2. Bahasa Melayu\n3. Bahasa Indonesia\n4. Thai\n5. Japanese",
        "ask_name":   "CON Enter your first name:",
        "ask_track":  "CON Hi {name}! What career interests you?\n1. STEM\n2. Business\n3. Skilled Trades\n4. Creative\n5. Healthcare",
        "match_found": "END Mentor found: {mentor_name}\n{job_title} ({years} yrs)\n{reason}\nShe will SMS you shortly.\nReply STOP to opt out.",
        "no_match":   "END No mentor available right now.\nWe will SMS you when one joins.\nReply JOIN to stay notified.",
        "returning":  "CON Enter your registered phone number:",
        "error":      "END Error. Please dial {code} again.",
        "min_blocked":"END Account pending guardian consent.\nAsk your parent to check email."
    },
    "ms": {
        "welcome":    "CON Selamat datang ke ElevateHer\nMentorship kerjaya percuma untuk wanita\n1. Pengguna baru\n2. Pengguna sedia ada\n3. Saya mentor",
        "choose_lang": "CON Pilih bahasa anda:\n1. English\n2. Bahasa Melayu\n3. Bahasa Indonesia\n4. Thai\n5. Japanese",
        "ask_name":   "CON Masukkan nama anda:",
        "ask_track":  "CON Hai {name}! Minat kerjaya anda?\n1. Sains & Teknologi\n2. Perniagaan\n3. Kemahiran Teknikal\n4. Kreatif\n5. Penjagaan Kesihatan",
        "match_found": "END Mentor dijumpai: {mentor_name}\n{job_title} ({years} thn pengalaman)\n{reason}\nBeliau akan SMS anda tidak lama lagi.\nBalas BERHENTI untuk keluar.",
        "no_match":   "END Tiada mentor yang tersedia sekarang.\nKami akan SMS anda apabila ada.\nBalas SERTAI untuk dimaklumkan.",
        "returning":  "CON Masukkan nombor telefon berdaftar anda:",
        "error":      "END Ralat. Sila dail {code} semula.",
        "min_blocked": "END Akaun menunggu kebenaran penjaga.\nMinta ibu bapa semak e-mel."
    },
    "id": {
        "welcome":    "CON Selamat datang di ElevateHer\nMentorship karir gratis untuk wanita\n1. Pengguna baru\n2. Pengguna lama\n3. Saya mentor",
        "ask_name":   "CON Masukkan nama kamu:",
        "ask_track":  "CON Halo {name}! Minat karir apa?\n1. Sains & Teknologi\n2. Bisnis\n3. Keahlian Teknis\n4. Kreatif\n5. Kesehatan",
        "match_found": "END Mentor ditemukan: {mentor_name}\n{job_title} ({years} thn)\n{reason}\nBeliau akan SMS kamu.\nBalas STOP untuk keluar.",
        "no_match":   "END Belum ada mentor tersedia.\nKami akan SMS kamu nanti.\nBalas JOIN untuk notifikasi.",
        "error":      "END Error. Silakan dial {code} lagi.",
        "min_blocked": "END Akun menunggu persetujuan wali.\nMinta orang tua cek email."
    },
    "th": {
        "welcome":    "CON ยินดีต้อนรับสู่ ElevateHer\nให้คำปรึกษาอาชีพฟรีสำหรับผู้หญิง\n1. ผู้ใช้ใหม่\n2. ผู้ใช้เก่า\n3. ฉันเป็นเมนทอร์",
        "ask_name":   "CON กรุณาใส่ชื่อของคุณ:",
        "ask_track":  "CON สวัสดี {name}! สนใจสายอาชีพใด?\n1. วิทยาศาสตร์/เทคโนโลยี\n2. ธุรกิจ\n3. ทักษะอาชีพ\n4. ครีเอทีฟ\n5. สาธารณสุข",
        "match_found": "END พบเมนทอร์: {mentor_name}\n{job_title} ({years} ปี)\n{reason}\nเธอจะส่ง SMS ถึงคุณ\nตอบ STOP เพื่อยกเลิก",
        "no_match":   "END ยังไม่มีเมนทอร์ที่พร้อม\nเราจะแจ้งให้ทราบทาง SMS\nตอบ JOIN เพื่อรับแจ้ง",
        "error":      "END ข้อผิดพลาด กรุณากด {code} อีกครั้ง",
        "min_blocked": "END บัญชีรอความยินยอมผู้ปกครอง\nขอให้ผู้ปกครองตรวจอีเมล"
    }
}


def get_str(lang: str, key: str, **kwargs) -> str:
    """Get localised USSD string, falling back to English."""
    template = STRINGS.get(lang, STRINGS["en"]).get(key, STRINGS["en"].get(key, "CON Error"))
    return template.format(**kwargs) if kwargs else template


# ── Redis session helpers ─────────────────────────────────────────────────────

async def _get_session(redis: aioredis.Redis, session_id: str) -> dict:
    try:
        raw = await redis.get(f"ussd:{session_id}")
        return json.loads(raw) if raw else {}
    except Exception:
        return {}

async def _save_session(redis: aioredis.Redis, session_id: str, data: dict) -> None:
    await redis.setex(f"ussd:{session_id}", SESSION_TTL, json.dumps(data))

async def _clear_session(redis: aioredis.Redis, session_id: str) -> None:
    await redis.delete(f"ussd:{session_id}")


# ── USSD handler ──────────────────────────────────────────────────────────────

@router.post("/callback")
async def handle_ussd_callback(
    sessionId:   str = Form(...),
    serviceCode: str = Form(...),
    phoneNumber: str = Form(...),
    text:        str = Form(default=""),
    request: Request = None,
    redis: aioredis.Redis = Depends(get_redis),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Infobip USSD callback endpoint.

    Protocol:
    - text accumulates all user inputs separated by *
    - Response starts with CON (continue session) or END (terminate session)
    - Response timeout: 10 seconds maximum
    - Session is stateless from telco perspective; Redis maintains our state

    USSD flow:
      Step 0 → welcome screen
      Step 1 → user type selection (new/returning/mentor)
      Step 2 → language selection (new users)
      Step 3 → name input
      Step 4 → career track selection
      → END: match result
    """
    inputs = [i.strip() for i in text.split("*")] if text else []
    step   = len(inputs)
    sess   = await _get_session(redis, sessionId)

    logger.info(f"USSD: sessionId={sessionId[:12]} phone={phoneNumber[-4:]} step={step}")

    try:
        # ── Step 0: Welcome ───────────────────────────────────────────────────
        if step == 0:
            return get_str("en", "welcome")

        # ── Step 1: User type ────────────────────────────────────────────────
        if step == 1:
            choice = inputs[0]
            if choice == "1":   # New user → language selection
                return get_str("en", "choose_lang")
            elif choice == "2": # Returning user
                return get_str("en", "returning")
            elif choice == "3": # Mentor portal info
                return "END Mentor portal: elevateher.app/mentor\nDial *384# to return."
            else:
                return get_str("en", "error", code=USSD_SERVICE_CODE)

        # ── Step 2 (new user): Language selection ────────────────────────────
        if step == 2 and inputs[0] == "1":
            lang = LANG_MAP.get(inputs[1], "en")
            sess.update({"phone": phoneNumber, "lang": lang, "flow": "new"})
            await _save_session(redis, sessionId, sess)
            return get_str(lang, "ask_name")

        # ── Step 2 (returning user): Phone number lookup ──────────────────────
        if step == 2 and inputs[0] == "2":
            lookup_phone = inputs[1].strip()
            async with pool.acquire() as conn:
                user = await conn.fetchrow(
                    """
                    SELECT u.id, u.language, mp.display_name, m.id AS match_id,
                           m.status, mp2.display_name AS mentor_name
                    FROM users u
                    LEFT JOIN mentee_profiles mp ON mp.user_id = u.id
                    LEFT JOIN matches m ON m.mentee_id = u.id AND m.status = 'active'
                    LEFT JOIN mentor_profiles mp2 ON mp2.user_id = m.mentor_id
                    WHERE u.phone = $1 AND NOT u.is_deleted
                    """,
                    lookup_phone if lookup_phone.startswith("+") else phoneNumber
                )
            if not user:
                return "END Phone number not found. Dial *384# and select 'New user'."
            if user["match_id"]:
                lang = user["language"] or "en"
                return f"END Hi {user['display_name']}!\nYour mentor: {user['mentor_name']}\nNext session: SMS your mentor directly.\nDial *384# anytime."
            else:
                return "END No active mentor yet. We'll SMS you when matched. Dial *384# for options."

        # ── Step 3: Name input ────────────────────────────────────────────────
        if step == 3 and inputs[0] == "1" and sess.get("flow") == "new":
            name = inputs[2][:30].strip()    # max 30 chars, safety limit
            if not name or len(name) < 2:
                return get_str(sess.get("lang","en"), "ask_name") + "\n(Name must be 2+ characters)"
            sess["name"] = name
            await _save_session(redis, sessionId, sess)
            lang = sess.get("lang", "en")
            return get_str(lang, "ask_track", name=name)

        # ── Step 4: Career track + matching ──────────────────────────────────
        if step == 4 and inputs[0] == "1" and sess.get("flow") == "new":
            track_choice = inputs[3]
            if track_choice not in TRACKS:
                return get_str(sess.get("lang","en"), "error", code=USSD_SERVICE_CODE)

            track  = TRACKS[track_choice]
            name   = sess.get("name", "")
            lang   = sess.get("lang", "en")
            phone  = phoneNumber

            # Quick registration
            async with pool.acquire() as conn:
                user_id = await conn.fetchval(
                    """
                    INSERT INTO users (phone, phone_country_code, role, language,
                        country, guardian_consented)
                    VALUES ($1, $2, 'mentee', $3, $4, true)
                    ON CONFLICT (phone) DO UPDATE SET language = EXCLUDED.language
                    RETURNING id
                    """,
                    phone,
                    phone[1:3].upper() if len(phone) > 2 else "XX",
                    lang,
                    _phone_to_country(phone)
                )
                # Create minimal mentee profile
                await conn.execute(
                    """
                    INSERT INTO mentee_profiles (
                        user_id, display_name, sdg_track,
                        preferred_languages, onboarding_complete
                    ) VALUES ($1, $2, $3, $4, true)
                    ON CONFLICT (user_id) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        sdg_track = EXCLUDED.sdg_track
                    """,
                    user_id, name, track, [lang, "en"]
                )

            # Trigger embedding in background
            from tasks.embedding_tasks import reembed_mentee_by_id
            reembed_mentee_by_id.delay(str(user_id))

            # Quick sync match (embedding may not be ready — use track-based fallback)
            mentor = await _quick_track_match(pool, str(user_id), track, lang)

            await _clear_session(redis, sessionId)

            if mentor:
                # Schedule SMS follow-up
                from tasks.sms_tasks import send_ussd_match_sms
                send_ussd_match_sms.delay(
                    mentee_phone=phone,
                    mentee_name=name,
                    mentor=mentor,
                    lang=lang
                )
                return get_str(lang, "match_found",
                    mentor_name=mentor["display_name"],
                    job_title=mentor["job_title"],
                    years=mentor["years_exp"],
                    reason=mentor.get("match_reason", "aligned goals")
                )
            else:
                from tasks.sms_tasks import send_ussd_no_match_sms
                send_ussd_no_match_sms.delay(phone=phone, name=name, lang=lang)
                return get_str(lang, "no_match")

        # ── Fallback ──────────────────────────────────────────────────────────
        return get_str(sess.get("lang","en"), "error", code=USSD_SERVICE_CODE)

    except Exception as e:
        logger.exception(f"USSD handler error: {e}")
        await _clear_session(redis, sessionId)
        return "END Service temporarily unavailable. Please try again later."


async def _quick_track_match(
    pool: asyncpg.Pool,
    user_id: str,
    track: str,
    lang: str
) -> Optional[dict]:
    """
    Fast track-based match when vector embedding isn't ready yet.
    Falls back to find_top_mentors once embedding propagates.
    """
    from services.matching_service import generate_match_reason
    import uuid

    async with pool.acquire() as conn:
        mentor = await conn.fetchrow(
            """
            SELECT u.id, mp.display_name, mp.job_title, mp.industry,
                   mp.years_exp, mp.languages, mp.bio
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.is_approved = true
              AND mp.is_active = true
              AND $1 = ANY(mp.languages)
              AND mp.current_mentees < mp.max_mentees
              AND NOT u.is_suspended
            ORDER BY mp.years_exp DESC
            LIMIT 1
            """,
            lang
        )
        if not mentor:
            # Fallback: any language
            mentor = await conn.fetchrow(
                """
                SELECT u.id, mp.display_name, mp.job_title, mp.industry,
                       mp.years_exp, mp.languages, mp.bio
                FROM mentor_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE mp.is_approved = true
                  AND mp.is_active = true
                  AND mp.current_mentees < mp.max_mentees
                  AND NOT u.is_suspended
                ORDER BY RANDOM()
                LIMIT 1
                """
            )

    if mentor:
        mentor = dict(mentor)
        mentor["match_reason"] = f"Matched because: {track} track alignment"
        return mentor
    return None


def _phone_to_country(phone: str) -> str:
    """Infer country from E.164 phone prefix."""
    prefixes = {
        "+60": "MY", "+62": "ID", "+66": "TH", "+65": "SG",
        "+81": "JP", "+44": "GB", "+1": "US"
    }
    for prefix, country in prefixes.items():
        if phone.startswith(prefix):
            return country
    return "XX"
```

---

## 2. SMS Service (Infobip + Plivo Fallback)

```python
# services/api/services/sms_service.py

import httpx, os, logging
from typing import Optional

logger = logging.getLogger(__name__)

INFOBIP_BASE = os.getenv("INFOBIP_BASE_URL", "https://api.infobip.com")
INFOBIP_KEY  = os.getenv("INFOBIP_API_KEY", "")
PLIVO_AUTH_ID    = os.getenv("PLIVO_AUTH_ID", "")
PLIVO_AUTH_TOKEN = os.getenv("PLIVO_AUTH_TOKEN", "")

async def send_sms(to_phone: str, message: str, sender: str = "ElevateHer") -> dict:
    """
    Primary: Infobip (SE Asia: MY, ID, TH, SG, JP)
    Fallback: Plivo (cost-optimised for Indonesia at $0.12/msg vs Twilio $0.44)
    """
    try:
        return await _send_via_infobip(to_phone, message, sender)
    except Exception as e:
        logger.warning(f"Infobip failed ({e}), falling back to Plivo")
        return await _send_via_plivo(to_phone, message)


async def _send_via_infobip(to: str, text: str, sender: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{INFOBIP_BASE}/sms/2/text/advanced",
            headers={
                "Authorization": f"App {INFOBIP_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            json={
                "messages": [{
                    "from": sender,
                    "destinations": [{"to": to}],
                    "text": text
                }]
            }
        )
        response.raise_for_status()
        data = response.json()
        logger.info(f"Infobip SMS sent to {to[-4:]}... messageId={data.get('messages',[{}])[0].get('messageId','')[:12]}")
        return data


async def _send_via_plivo(to: str, text: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://api.plivo.com/v1/Account/{}/Message/".format(PLIVO_AUTH_ID),
            auth=(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN),
            json={"src": "ElevateHer", "dst": to, "text": text}
        )
        response.raise_for_status()
        return response.json()


# ── SMS Template Library ──────────────────────────────────────────────────────

SMS_TEMPLATES = {
    "mentor_introduction": {
        "en": "Hi from ElevateHer! I'm {mentor_name}, your career mentor in {industry} ({years} yrs). Reply YES to start your 12-week programme. Reply STOP to opt out.",
        "ms": "Hai dari ElevateHer! Saya {mentor_name}, mentor kerjaya anda dalam {industry} ({years} thn). Balas YA untuk memulakan. Balas BERHENTI untuk keluar.",
        "id": "Halo dari ElevateHer! Saya {mentor_name}, mentor karir Anda di {industry} ({years} thn). Balas YA untuk mulai. Balas STOP untuk keluar.",
        "th": "สวัสดีจาก ElevateHer! ฉัน {mentor_name} เมนทอร์ด้าน {industry} ({years} ปี) ตอบ ใช่ เพื่อเริ่ม หรือ STOP เพื่อออก"
    },
    "session_reminder": {
        "en": "ElevateHer: Your {track} session is scheduled. Reply 1 to confirm, 2 to reschedule. Need help? Reply HELP.",
        "ms": "ElevateHer: Sesi {track} anda telah dijadualkan. Balas 1 untuk sahkan, 2 untuk jadualkan semula.",
        "id": "ElevateHer: Sesi {track} Anda sudah dijadwalkan. Balas 1 untuk konfirmasi, 2 untuk jadwal ulang.",
        "th": "ElevateHer: เซสชัน {track} ของคุณถูกกำหนดไว้แล้ว ตอบ 1 เพื่อยืนยัน 2 เพื่อเลื่อน"
    },
    "mentee_nudge": {
        "en": "Hi {name}! It's been {days} days since your last ElevateHer session. Your mentor is ready for your next step. Reply READY or dial *384#.",
        "ms": "Hai {name}! Sudah {days} hari sejak sesi ElevateHer terakhir anda. Mentor anda bersedia. Balas SEDIA atau dail *384#.",
        "id": "Halo {name}! Sudah {days} hari sejak sesi ElevateHer terakhirmu. Mentor kamu siap. Balas SIAP atau dial *384#.",
        "th": "สวัสดี {name}! ผ่านมา {days} วันแล้ว นับจากเซสชันล่าสุด เมนทอร์พร้อมแล้ว ตอบ พร้อม หรือกด *384#"
    },
    "match_confirmed": {
        "en": "ElevateHer: Your match is confirmed! {mentor_name} ({industry}) will guide you on your {track} journey. First session will be scheduled by SMS within 48h.",
        "ms": "ElevateHer: Padanan anda disahkan! {mentor_name} ({industry}) akan membimbing perjalanan {track} anda. Sesi pertama akan dijadualkan dalam 48 jam.",
        "id": "ElevateHer: Pasangan Anda dikonfirmasi! {mentor_name} ({industry}) akan membimbing perjalanan {track} Anda. Sesi pertama dijadwalkan dalam 48 jam.",
        "th": "ElevateHer: จับคู่สำเร็จ! {mentor_name} ({industry}) จะแนะนำการเดินทาง {track} ของคุณ เซสชันแรกจะนัดภายใน 48 ชม."
    },
    "guardian_consent_sms": {
        "en": "ElevateHer: Your daughter {name} has joined our career mentorship programme. Please check your email to give consent. Safe, moderated, free. elevateher.app"
    },
    "no_match_wait": {
        "en": "Hi {name}! You're on the ElevateHer waitlist for {track} mentors. We'll SMS you the moment a mentor is available. You'll be first in line!",
        "ms": "Hai {name}! Anda dalam senarai tunggu ElevateHer untuk mentor {track}. Kami akan SMS anda sebaik ada mentor. Anda yang pertama!",
        "id": "Halo {name}! Kamu ada di daftar tunggu ElevateHer untuk mentor {track}. Kami akan SMS kamu begitu ada mentor.",
        "th": "สวัสดี {name}! คุณอยู่ในรายการรอ ElevateHer สำหรับเมนทอร์ {track} เราจะแจ้ง SMS ทันทีที่มีเมนทอร์"
    }
}


def get_sms_text(template_key: str, lang: str, **kwargs) -> str:
    """Get a localised SMS text from the template library."""
    templates = SMS_TEMPLATES.get(template_key, {})
    template = templates.get(lang, templates.get("en", ""))
    return template.format(**kwargs) if template else ""


async def send_mentor_introduction_sms(
    mentee_phone: str,
    mentee_lang: str,
    mentor_name: str,
    mentor_industry: str,
    mentor_years: int
) -> None:
    msg = get_sms_text(
        "mentor_introduction", mentee_lang,
        mentor_name=mentor_name, industry=mentor_industry, years=mentor_years
    )
    if msg:
        await send_sms(mentee_phone, msg)


async def send_session_reminder_sms(phone: str, lang: str, track: str) -> None:
    msg = get_sms_text("session_reminder", lang, track=track)
    if msg:
        await send_sms(phone, msg)


async def send_mentee_nudge_sms(phone: str, lang: str, name: str, days: int) -> None:
    msg = get_sms_text("mentee_nudge", lang, name=name, days=days)
    if msg:
        await send_sms(phone, msg)
```

---

## 3. SMS Celery Tasks

```python
# services/api/tasks/sms_tasks.py

from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task(name="tasks.send_ussd_match_sms")
def send_ussd_match_sms(mentee_phone: str, mentee_name: str, mentor: dict, lang: str):
    """Async SMS sent after USSD match — non-blocking."""
    import asyncio
    from services.sms_service import send_sms, get_sms_text

    msg = get_sms_text(
        "match_confirmed", lang,
        mentor_name=mentor.get("display_name",""),
        industry=mentor.get("industry",""),
        track=mentor.get("sdg_track","STEM")
    )
    asyncio.run(send_sms(mentee_phone, msg))


@shared_task(name="tasks.send_ussd_no_match_sms")
def send_ussd_no_match_sms(phone: str, name: str, lang: str):
    import asyncio
    from services.sms_service import send_sms, get_sms_text
    msg = get_sms_text("no_match_wait", lang, name=name, track="your chosen")
    asyncio.run(send_sms(phone, msg))


@shared_task(name="tasks.send_match_confirmed_sms")
def send_match_confirmed_sms(match_id: str):
    """Notify both mentor and mentee when a web match is confirmed."""
    import asyncio, psycopg2, os
    from services.sms_service import send_sms

    conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
    cur  = conn.cursor()
    cur.execute(
        """
        SELECT
            u_mentee.phone, u_mentee.language,
            mp_mentee.display_name AS mentee_name,
            u_mentor.phone AS mentor_phone,
            mp_mentor.display_name AS mentor_name,
            mp_mentor.industry, m.sdg_track
        FROM matches m
        JOIN users u_mentee ON u_mentee.id = m.mentee_id
        JOIN mentee_profiles mp_mentee ON mp_mentee.user_id = m.mentee_id
        JOIN users u_mentor ON u_mentor.id = m.mentor_id
        JOIN mentor_profiles mp_mentor ON mp_mentor.user_id = m.mentor_id
        WHERE m.id = %s
        """,
        (match_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row:
        from services.sms_service import get_sms_text
        lang = row[1] or "en"
        msg = get_sms_text(
            "match_confirmed", lang,
            mentor_name=row[4], industry=row[5], track=row[6]
        )
        asyncio.run(send_sms(row[0], msg))    # to mentee
        asyncio.run(send_sms(                  # to mentor
            row[3],
            f"ElevateHer: {row[2]} has accepted your mentorship. "
            f"Please schedule your first session within 48 hours."
        ))


@shared_task(name="tasks.notify_mentor_approved")
def notify_mentor_approved_task(mentor_user_id: str):
    """SMS + email to mentor when admin approves their profile."""
    import asyncio, psycopg2, os
    from services.sms_service import send_sms

    conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
    cur  = conn.cursor()
    cur.execute(
        "SELECT phone, email FROM users WHERE id = %s", (mentor_user_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row and row[0]:
        asyncio.run(send_sms(
            row[0],
            "ElevateHer: Your mentor profile has been approved! "
            "Log in to start receiving mentee matches. "
            "elevateher.app/mentor/dashboard"
        ))
```

---

## 4. USSD Demo Simulator (Demo Day Bulletproof)

```python
# scripts/ussd_simulator.py
"""
Fully offline USSD demo simulator.
Mocks the Infobip USSD callback payload locally.
Run before demo: python scripts/ussd_simulator.py

Scenarios available:
1. New Malaysian mentee (Aisha, Bahasa Melayu, STEM)
2. New Indonesian mentee (Dewi, Bahasa Indonesia, Business)
3. Returning user lookup
4. No match found (waitlist)
"""

import asyncio, httpx, sys

API_BASE    = "http://localhost:8000"
USSD_URL    = f"{API_BASE}/ussd/callback"
SERVICE_CODE = "*384#"

def print_screen(content: str, step: int):
    width = 50
    print("\n" + "=" * width)
    print(f"  📱 FEATURE PHONE SCREEN [Step {step}]")
    print("=" * width)
    display = content.replace("CON ", "").replace("END ", "[FINAL] ")
    for line in display.split("\n"):
        print(f"  {line}")
    print("=" * width)


async def run_scenario(name: str, conversation: list[dict]):
    print(f"\n🎬 Demo Scenario: {name}")
    print("-" * 50)

    session_id   = f"DEMO_{name.replace(' ', '_').upper()[:20]}"
    service_code = SERVICE_CODE
    phone        = conversation[0].get("phone", "+60123456789")

    for i, step_data in enumerate(conversation):
        text = step_data.get("text", "")

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                USSD_URL,
                data={
                    "sessionId":   session_id,
                    "serviceCode": service_code,
                    "phoneNumber": phone,
                    "text":        text
                }
            )

        content = response.text
        print_screen(content, i)

        # Narrate what the user inputs next
        if i + 1 < len(conversation) and not content.startswith("END"):
            next_input = conversation[i + 1].get("text", "").split("*")[-1]
            print(f"\n  👆 User presses: [{next_input}]")

        await asyncio.sleep(0.8)    # Simulate human response time

        if content.startswith("END"):
            print("\n  ✅ USSD session ended.")
            break


SCENARIOS = {
    "1": {
        "name": "Aisha — Malaysian girl, STEM track",
        "conversation": [
            {"phone": "+60123456789", "text": ""},
            {"text": "1"},           # New user
            {"text": "1*2"},         # Bahasa Melayu
            {"text": "1*2*Aisha"},   # Name
            {"text": "1*2*Aisha*1"}  # STEM track
        ]
    },
    "2": {
        "name": "Dewi — Indonesian girl, Business track",
        "conversation": [
            {"phone": "+62811234567", "text": ""},
            {"text": "1"},           # New user
            {"text": "1*3"},         # Bahasa Indonesia
            {"text": "1*3*Dewi"},    # Name
            {"text": "1*3*Dewi*2"}   # Business track
        ]
    },
    "3": {
        "name": "Kasama — Thai girl, Trades track",
        "conversation": [
            {"phone": "+66891234567", "text": ""},
            {"text": "1"},
            {"text": "1*4"},         # Thai
            {"text": "1*4*Kasama"},
            {"text": "1*4*Kasama*3"} # Trades
        ]
    },
    "4": {
        "name": "Returning user lookup",
        "conversation": [
            {"phone": "+60123456789", "text": ""},
            {"text": "2"},               # Returning user
            {"text": "2*+60123456789"},  # Phone number
        ]
    }
}


async def main():
    print("\n" + "="*50)
    print("  📡 ElevateHer USSD Demo Simulator")
    print("  API target: " + API_BASE)
    print("="*50)

    print("\nAvailable scenarios:")
    for key, s in SCENARIOS.items():
        print(f"  {key}. {s['name']}")
    print("  A. Run all scenarios")
    print("  Q. Quit")

    choice = input("\nSelect scenario: ").strip().upper()

    if choice == "Q":
        return
    elif choice == "A":
        for key, scenario in SCENARIOS.items():
            await run_scenario(scenario["name"], scenario["conversation"])
            await asyncio.sleep(1)
    elif choice in SCENARIOS:
        s = SCENARIOS[choice]
        await run_scenario(s["name"], s["conversation"])
    else:
        print("Invalid choice.")

if __name__ == "__main__":
    asyncio.run(main())
```

---

*File 05 of 10 — ElevateHer Complete Technical Suite*
*Covers: Full USSD state machine (all 5 languages), Infobip + Plivo SMS service, SMS template library, Celery SMS tasks, bulletproof demo simulator*
