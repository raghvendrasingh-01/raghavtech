"""Application configuration.

Centralises tunable settings (CORS origins, model name, file limits, …) so
nothing is hard-coded across the codebase. Values can be overridden via
environment variables, which keeps local dev and deployment flexible.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

try:  # Load backend/.env if python-dotenv is available (it ships with uvicorn[standard]).
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:  # pragma: no cover - dotenv is optional
    pass


def _split_env(name: str, default: str) -> list[str]:
    """Read a comma-separated environment variable into a list of strings."""
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    """Container for runtime configuration.

    Attributes are read once from the environment at import time. Override any
    of them by exporting the matching environment variable before launch.
    """

    # --- Service metadata ---
    APP_NAME: str = "AI Resume Screening System"
    VERSION: str = "0.1.0"

    # --- CORS ---
    # Origins allowed to call the API from a browser. Defaults cover the Vite
    # dev server on both localhost and 127.0.0.1.
    CORS_ORIGINS: list[str] = _split_env(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    # --- NLP model (used from Step 4) ---
    # Lightweight, fast sentence-embedding model with strong general-purpose
    # semantic similarity performance.
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # --- Upload limits ---
    # Maximum accepted résumé upload size, in bytes (default 5 MB).
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))

    # Maximum characters of text (résumé or JD) fed to the NLP layer. Caps CPU
    # work and memory for pathological inputs; well above any real résumé/JD and
    # far beyond the embedding model's effective token window.
    MAX_TEXT_CHARS: int = int(os.getenv("MAX_TEXT_CHARS", str(50_000)))

    # --- AI suggestions (OpenRouter) ---
    # The API key is read from the environment / backend/.env and never exposed
    # to the browser — all LLM calls happen server-side.
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    OPENROUTER_BASE_URL: str = os.getenv(
        "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
    )
    # Seconds to wait for the LLM before giving up (suggestions are best-effort).
    LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
    # Characters of résumé/JD sent to the LLM (keeps token cost bounded).
    LLM_MAX_INPUT_CHARS: int = int(os.getenv("LLM_MAX_INPUT_CHARS", str(12_000)))

    @property
    def ai_enabled(self) -> bool:
        """True when an OpenRouter key is configured."""
        return bool(self.OPENROUTER_API_KEY)


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton ``Settings`` instance."""
    return Settings()
