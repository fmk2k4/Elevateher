import hashlib
import os
from pathlib import Path


MODELS = [
    {
        "env": "SEA_LION_MODEL_PATH",
        "revision_env": "SEA_LION_MODEL_REVISION",
        "checksum_env": "SEA_LION_MODEL_SHA256",
        "default": Path("models") / "sea-lion-e5-embedding-600m",
        "repo_id": "aisingapore/SEA-LION-E5-Embedding-600M",
        "filename": None,
    },
    {
        "env": "AGENT_MODEL_PATH",
        "revision_env": "AGENT_MODEL_REVISION",
        "checksum_env": "AGENT_MODEL_SHA256",
        "default": Path("models") / "Phi-3-mini-4k-instruct-q4.gguf",
        "repo_id": "microsoft/Phi-3-mini-4k-instruct-gguf",
        "filename": "Phi-3-mini-4k-instruct-q4.gguf",
    },
    {
        "env": "SAFETY_MODEL_PATH",
        "revision_env": "SAFETY_MODEL_REVISION",
        "checksum_env": "SAFETY_MODEL_SHA256",
        "default": Path("models") / "sea-guard-safety-v1",
        "repo_id": "aisingapore/sea-guard-safety-v1",
        "filename": None,
    },
]


def resolve_model_path(model: dict) -> Path:
    configured = os.getenv(model["env"])
    if configured:
        return Path(configured)
    return model["default"]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_checksum(path: Path, model: dict) -> None:
    expected = os.getenv(model.get("checksum_env", ""))
    if expected and sha256_file(path) != expected.lower():
        raise SystemExit(f"Checksum mismatch for {path}; expected {expected}")


def revision_for(model: dict):
    return os.getenv(model.get("revision_env", "")) or None


def main() -> int:
    try:
        from huggingface_hub import hf_hub_download, snapshot_download
    except ImportError:
        print("Install huggingface_hub to download models: pip install huggingface_hub")
        return 1

    import time
    from tenacity import retry, stop_after_attempt, wait_exponential

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        reraise=True,
    )
    def _download_with_retry(model: dict):
        destination = resolve_model_path(model)
        if destination.exists():
            if destination.is_file():
                verify_checksum(destination, model)
            print(f"Already present: {destination}")
            return
        destination.parent.mkdir(parents=True, exist_ok=True)
        if model["filename"]:
            downloaded = hf_hub_download(
                repo_id=model["repo_id"],
                filename=model["filename"],
                revision=revision_for(model),
                local_dir=destination.parent,
                resume_download=True,
            )
            downloaded_path = Path(downloaded)
            verify_checksum(downloaded_path, model)
            if downloaded_path.resolve() != destination.resolve():
                downloaded_path.replace(destination)
            print(f"Downloaded {downloaded} -> {destination}")
        else:
            snapshot_download(
                repo_id=model["repo_id"],
                revision=revision_for(model),
                local_dir=destination,
                resume_download=True,
            )
            if destination.is_file():
                verify_checksum(destination, model)
            print(f"Downloaded {model['repo_id']} -> {destination}")

    for model in MODELS:
        _download_with_retry(model)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
