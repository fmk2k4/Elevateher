import os
import sys

# Set HF cache offline and home directory properly
os.environ["HF_DATASETS_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"

print("Verifying Models...")

try:
    from sentence_transformers import SentenceTransformer
    print("[1] Loading SEA-LION Embedding Model...")
    model = SentenceTransformer("./models/sea-lion-e5-embedding-600m")
    emb = model.encode(["Testing embeddings."])
    print(f"[OK] SEA-LION loaded successfully! Embedding shape: {emb.shape}")
except Exception as e:
    print(f"[X] SEA-LION Failed: {e}")

try:
    from llama_cpp import Llama
    print("\n[2] Loading Phi-3 Instruct Model...")
    llm = Llama(
        model_path="./models/Phi-3-mini-4k-instruct-q4.gguf",
        n_ctx=256,
        n_threads=4,
        verbose=False
    )
    res = llm("Q: What is the capital of Malaysia? A:", max_tokens=10)
    print(f"[OK] Phi-3 loaded successfully! Output: {res['choices'][0]['text'].strip()}")
except Exception as e:
    print(f"[X] Phi-3 Failed: {e}")
