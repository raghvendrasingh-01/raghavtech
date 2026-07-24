"""Application configuration.

Centralises tunable settings (CORS origins, model name, file limits, …) so
nothing is hard-coded across the codebase. Values are read from the environment
(and an optional ``backend/.env`` file) via :mod:`pydantic-settings`, which
keeps local dev and deployment flexible while giving us typed validation and
OpenAPI-friendly defaults.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env — loaded automatically by pydantic-settings when present.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Container for runtime configuration.

    Fields are populated from environment variables (case-insensitive, matching
    the field name) or ``backend/.env``. Override any of them by exporting the
    matching environment variable before launch. Unknown environment variables
    are ignored so the process never fails to boot on an unrelated variable.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Service metadata ---
    APP_NAME: str = "AI Resume Screening System"
    VERSION: str = "0.1.0"

    # --- CORS ---
    # Origins allowed to call the API from a browser. Defaults cover the Vite
    # dev server on both localhost and 127.0.0.1.
    #
    # In production, set CORS_ORIGINS (comma-separated) to your deployed
    # frontend origin(s), e.g.:
    #   CORS_ORIGINS=https://your-portfolio.vercel.app
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    # Optional regex matching additional allowed origins. Useful for Vercel
    # preview deployments, which get a fresh hashed subdomain on every push,
    # e.g. CORS_ORIGIN_REGEX=https://.*\.vercel\.app
    # Empty (default) disables regex matching. Applied in addition to
    # CORS_ORIGINS, never instead of it.
    CORS_ORIGIN_REGEX: str = ""

    # --- NLP model ---
    # Lightweight, fast sentence-embedding model with strong general-purpose
    # semantic similarity performance.
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # --- Upload limits ---
    # Maximum accepted résumé upload size, in bytes (default 5 MB).
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024

    # Maximum characters of text (résumé or JD) fed to the NLP layer. Caps CPU
    # work and memory for pathological inputs; well above any real résumé/JD and
    # far beyond the embedding model's effective token window.
    MAX_TEXT_CHARS: int = 50_000

    # --- Rate limiting ---
    # Per-client (IP) limits applied to the expensive endpoints. Expressed in
    # slowapi's "<count>/<window>" syntax. Set RATE_LIMIT_ENABLED=false to
    # disable limiting entirely (e.g. for load tests).
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_ANALYZE: str = "20/minute"
    RATE_LIMIT_SUGGEST: str = "10/minute"
    RATE_LIMIT_CHAT: str = "30/minute"

    # --- AI suggestions (OpenRouter) ---
    # The API key is read from the environment / backend/.env and never exposed
    # to the browser — all LLM calls happen server-side.
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    # Seconds to wait for the LLM before giving up (suggestions are best-effort).
    LLM_TIMEOUT_SECONDS: float = 45.0
    # Characters of résumé/JD sent to the LLM (keeps token cost bounded).
    LLM_MAX_INPUT_CHARS: int = 12_000
    # When true, /analyze augments the regex skill bank with an LLM extraction
    # pass (best-effort; only runs when an OpenRouter key is configured).
    LLM_SKILL_EXTRACTION: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string for CORS_ORIGINS (legacy env format).

        pydantic-settings would otherwise try to JSON-decode a bare string for a
        ``list`` field. We keep the original ``a,b,c`` convention working by
        splitting on commas; a real list/JSON array passes through untouched.
        """
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def ai_enabled(self) -> bool:
        """True when an OpenRouter key is configured."""
        return bool(self.OPENROUTER_API_KEY)


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton ``Settings`` instance."""
    return Settings()
