"""Tests for the pydantic-settings based configuration.

Verifies defaults load, environment overrides apply, the comma-separated
CORS_ORIGINS legacy format still parses, and the ai_enabled property tracks the
OpenRouter key.
"""

from app.config import Settings


def test_defaults_load():
    s = Settings()
    assert s.APP_NAME
    assert s.VERSION == "0.1.0"
    assert s.MAX_UPLOAD_BYTES > 0
    assert s.MAX_TEXT_CHARS > 0
    # New rate-limit + LLM toggles have sane defaults.
    assert s.RATE_LIMIT_ENABLED is True
    assert "/minute" in s.RATE_LIMIT_ANALYZE
    assert s.LLM_SKILL_EXTRACTION is True


def test_cors_origins_default_is_list():
    s = Settings()
    assert isinstance(s.CORS_ORIGINS, list)
    assert all(isinstance(o, str) for o in s.CORS_ORIGINS)


def test_cors_origins_comma_string_is_split():
    # Legacy format: a bare comma-separated string is split by the field
    # validator into a clean list (a real list/JSON array passes through).
    s = Settings(CORS_ORIGINS="https://a.example.com, https://b.example.com")
    assert s.CORS_ORIGINS == [
        "https://a.example.com",
        "https://b.example.com",
    ]


def test_ai_enabled_tracks_key():
    # Instantiate without reading the local .env so the test is hermetic.
    assert Settings(_env_file=None, OPENROUTER_API_KEY="").ai_enabled is False
    assert Settings(_env_file=None, OPENROUTER_API_KEY="sk-test-123").ai_enabled is True


def test_env_override_applies(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("MAX_TEXT_CHARS", "1234")
    s = Settings()
    assert s.RATE_LIMIT_ENABLED is False
    assert s.MAX_TEXT_CHARS == 1234
