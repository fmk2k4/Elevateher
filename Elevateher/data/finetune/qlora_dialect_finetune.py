"""
QLoRA Dialect Fine-Tuning for ElevateHer
========================================
Fine-tunes the embedding model on SE Asian dialect code-switching:
  - Manglish (Malay + English)
  - Singlish (Singaporean English + Mandarin/Malay)
  - Indonesian + English code-switching
  - Thai + English code-switching

Requirements:
  pip install transformers peft bitsandbytes accelerate datasets torch

Hardware:
  RTX 4050 12GB VRAM (4-bit quantisation)
  ~2GB VRAM used after loading

Output:
  ./data/finetune/elevateher-dialect-adapter-v1/
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from datasets import Dataset
from peft import LoraConfig, get_peft_model, TaskType
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
)

# ── Configuration ───────────────────────────────────────────────────────────────

MODEL_ID = os.environ.get(
    "FINETUNE_MODEL_ID", "aisingapore/sea-lion-e5-embedding-600m"
)
ADAPTER_OUTPUT = Path(os.environ.get(
    "FINETUNE_OUTPUT", "./data/finetune/elevateher-dialect-adapter-v1"
))
MAX_SEQ_LENGTH = int(os.environ.get("FINETUNE_MAX_SEQ_LENGTH", 512))

# ── 4-bit Quantisation ──────────────────────────────────────────────────────────

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype="float16",
)

# ── LoRA Adapter Config ─────────────────────────────────────────────────────────
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
)

# ── Synthetic training pairs ────────────────────────────────────────────────────
train_data = [
    {"input": "nak jadi software engineer tapi mak tak setuju", "output": "career_goal: software engineering; challenge: family pressure; language: Malay"},
    {"input": "pengen kerja di tech tapi gak ada yang guide", "output": "career_goal: technology sector; challenge: no mentorship; language: Indonesian"},
    {"input": "I want to do business lah but dunno how to start", "output": "career_goal: entrepreneurship; challenge: starting out; language: Singlish"},
    {"input": " изучаю программирование, но не могу найти наставника", "output": "career_goal: software engineering; challenge: no mentor; language: Thai"},
    {"input": "saya nak jadi data scientist tapi tak ada duit course", "output": "career_goal: data science; challenge: cost; language: Malay"},
    {"input": "pengen jadi UX designer tapi orang cakap susah untuk perempuan", "output": "career_goal: UX design; challenge: gender bias; language: Indonesian"},
]

dataset = Dataset.from_list(train_data)


def _tokenize(examples: dict, tokenizer: Any, max_length: int = MAX_SEQ_LENGTH) -> dict:
    prompts = [
        f"### Input:\n{inp}\n\n### Output:\n{out}"
        for inp, out in zip(examples["input"], examples["output"])
    ]
    return tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
    )


def main() -> None:
    print(f"Loading {MODEL_ID}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    tokenised = dataset.map(
        lambda ex: _tokenize(ex, tokenizer),
        batched=True,
        remove_columns=dataset.column_names,
    )

    training_args = TrainingArguments(
        output_dir=str(ADAPTER_OUTPUT),
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=10,
        save_strategy="epoch",
        optim="paged_adamw_8bit",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenised,
    )

    trainer.train()
    model.save_pretrained(str(ADAPTER_OUTPUT))
    tokenizer.save_pretrained(str(ADAPTER_OUTPUT))
    print(f"Adapter saved to {ADAPTER_OUTPUT}")


if __name__ == "__main__":
    main()
