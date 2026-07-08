from fastapi import APIRouter
from app.config import get_settings

router = APIRouter(tags=["meta"])


@router.get("/")
def root() -> dict:
    s = get_settings()
    return {
        "name": "Pulse API",
        "status": "ok",
        "ai_mode": "gpt" if s.has_llm else "local-engine",
        "supabase": s.has_supabase,
        "docs": "/docs",
    }


@router.get("/health")
def health() -> dict:
    return {"status": "healthy"}
