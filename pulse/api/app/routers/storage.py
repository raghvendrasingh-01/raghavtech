"""Storage routes — server-side file uploads.

Uploads go through the backend using the Supabase service-role key (which
bypasses Storage RLS), so the browser never needs write access to the bucket.
The frontend posts multipart files here and gets back public URLs.
"""
from __future__ import annotations

import re
import time
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import get_current_user_id
from app.supabase import Supabase, SupabaseUnavailable

router = APIRouter(prefix="/storage", tags=["storage"])

BUCKET = "task-attachments"
MAX_BYTES = 10 * 1024 * 1024  # 10 MB per file
ALLOWED_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}


def _safe_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9.\-_]", "_", name or "file")


@router.post("/task-attachments")
async def upload_task_attachments(
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    try:
        db = Supabase()
    except SupabaseUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Namespace by the verified Clerk user id — clients cannot spoof this.
    prefix = _safe_name(user_id)
    urls: list[str] = []

    for f in files:
        if f.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported file type: {f.content_type}")
        content = await f.read()
        if len(content) > MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"{f.filename} exceeds the 10 MB limit.")

        # Namespaced, collision-resistant object key.
        path = f"{prefix}/{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}-{_safe_name(f.filename or 'file')}"
        try:
            url = await db.upload_object(BUCKET, path, content, f.content_type)
        except Exception as e:  # noqa: BLE001 — surface a clean error to the client
            raise HTTPException(status_code=502, detail=f"Upload failed: {e}")
        urls.append(url)

    return {"urls": urls}
