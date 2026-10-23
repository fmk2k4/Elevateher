import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
ALLOWED_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10MB


def _is_valid_image(data: bytes) -> bool:
    """Validate image magic bytes."""
    signatures = {
        b"\xff\xd8\xff": "jpeg",
        b"\x89PNG": "png",
    }
    return any(data.startswith(sig) for sig in signatures)


async def upload_private_document(file: UploadFile, bucket: str, path: str) -> str:
    """
    Upload a document to Supabase Storage (private bucket).
    Falls back to a local path placeholder if Supabase is not configured.
    """
    contents = await file.read()

    if len(contents) > MAX_DOCUMENT_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_DOCUMENT_SIZE // (1024*1024)}MB",
        )

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))}",
        )

    if file.content_type and file.content_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise HTTPException(status_code=400, detail="File type not allowed")

    if ext in {".jpg", ".jpeg", ".png"}:
        if not _is_valid_image(contents):
            raise HTTPException(status_code=400, detail="Invalid image file")

    await file.seek(0)

    if not settings.supabase_service_key:
        filename = Path(path).name.replace(" ", "_")
        return f"file://{bucket}/{uuid.uuid4().hex}/{filename}"

    try:
        from supabase import create_client

        client = create_client(settings.supabase_url, settings.supabase_service_key)
        client.storage.from_(bucket).upload(path, contents)
        return path
    except Exception:
        logger.exception("Supabase upload failed — falling back to local document path")
        filename = Path(path).name.replace(" ", "_")
        return f"file://{bucket}/{uuid.uuid4().hex}/{filename}"


def get_public_url(bucket: str, path: str) -> str:
    """
    Generate a signed URL for private bucket access.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.error("Storage misconfigured - supabase not set up")
        raise HTTPException(500, "Storage not configured")

    try:
        from supabase import create_client

        client = create_client(settings.supabase_url, settings.supabase_service_key)
        signed = client.storage.from_(bucket).create_signed_url(path, 3600)
        return signed.get("signedURL", "")
    except Exception as exc:
        logger.exception("Failed to generate signed URL")
        raise HTTPException(500, "Failed to generate document URL") from exc
