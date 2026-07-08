"""Runtime configuration, loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase (service-role key — server side only, bypasses RLS)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Optional LLM. When present, the AI routes use GPT; otherwise the local
    # deterministic engine handles everything. OpenRouter is OpenAI-compatible,
    # so either key works — OpenRouter takes precedence when both are set.
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    # Model id. For OpenRouter use the "vendor/model" form (e.g. openai/gpt-4o-mini).
    llm_model: str = "openai/gpt-4o-mini"
    # Override the API base URL. Auto-set to OpenRouter when an OpenRouter key is present.
    llm_base_url: str = ""

    # Clerk auth. The JWKS URL is derived from the issuer / publishable key;
    # set clerk_issuer explicitly for production (e.g. https://<slug>.clerk.accounts.dev).
    clerk_issuer: str = ""
    clerk_publishable_key: str = ""
    # When true, requests without a valid Clerk JWT are rejected. When false
    # (dev/demo), a missing/invalid token falls back to the X-User-Id header.
    require_auth: bool = False

    # CORS — the Next.js frontend origin(s).
    cors_origins: str = "http://localhost:3000"

    # Working-hour defaults for scheduling.
    day_start_hour: int = 8
    day_end_hour: int = 22

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def has_llm(self) -> bool:
        return bool(self.openrouter_api_key or self.openai_api_key)

    @property
    def llm_key(self) -> str:
        return self.openrouter_api_key or self.openai_api_key

    @property
    def resolved_base_url(self) -> str | None:
        if self.llm_base_url:
            return self.llm_base_url
        if self.openrouter_api_key:
            return "https://openrouter.ai/api/v1"
        return None  # default = OpenAI

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def clerk_jwks_url(self) -> str | None:
        """Clerk's JWKS endpoint, derived from the issuer or publishable key.

        Clerk publishable keys look like `pk_test_<base64(issuer-host)>` /
        `pk_live_...`, where the decoded host is the Frontend API domain.
        """
        issuer = self._clerk_issuer_host()
        return f"{issuer}/.well-known/jwks.json" if issuer else None

    def _clerk_issuer_host(self) -> str | None:
        if self.clerk_issuer:
            return self.clerk_issuer.rstrip("/")
        pk = self.clerk_publishable_key
        if pk and "_" in pk:
            import base64
            try:
                encoded = pk.split("_", 2)[-1]
                host = base64.b64decode(encoded + "==").decode().rstrip("$")
                if host:
                    return f"https://{host}"
            except Exception:
                return None
        return None

    @property
    def has_clerk(self) -> bool:
        return bool(self.clerk_jwks_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
