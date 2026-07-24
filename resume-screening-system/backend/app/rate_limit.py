"""Per-IP rate limiting using slowapi.

Protects the expensive endpoints (``/analyze``, ``/suggest``, ``/chat``) from
abuse and runaway costs. slowapi's ``Limiter`` has a built-in ``enabled`` flag,
so when ``RATE_LIMIT_ENABLED=false`` in config the decorators become
pass-throughs with negligible overhead (useful for load tests / local dev).

Usage:
    * ``routes.py`` imports :data:`limiter` and decorates routes with
      ``@limiter.limit(settings.RATE_LIMIT_ANALYZE)`` etc. Decorated routes must
      accept a ``request: Request`` parameter (slowapi reads the client IP from
      it).
    * ``main.py`` calls :func:`install_rate_limiting` to register the shared
      limiter on ``app.state`` and wire up the 429 handler.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import get_settings

if TYPE_CHECKING:
    from fastapi import FastAPI

# Single shared limiter, created at import time. The `enabled` flag comes from
# config; when false, `@limiter.limit(...)` decorators do nothing.
_settings = get_settings()
limiter = Limiter(
    key_func=get_remote_address,
    enabled=_settings.RATE_LIMIT_ENABLED,
    default_limits=[],
)


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Map slowapi's RateLimitExceeded to a uniform JSON 429 response."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )


def install_rate_limiting(app: "FastAPI") -> None:
    """Register the shared limiter and 429 handler on the app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
