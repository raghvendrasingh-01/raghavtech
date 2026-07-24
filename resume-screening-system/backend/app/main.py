"""FastAPI application entry point.

Wires up the application:
    * an app factory (``create_app``) that configures CORS and rate limiting,
    * a background model warmup on startup (via ``lifespan``) plus a manual
      ``GET /warmup`` endpoint,
    * a ``GET /health`` liveness probe, and
    * a ``GET /`` welcome/info route.

Run locally with::

    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.rate_limit import install_rate_limiting
from app.routes import router as analysis_router

logger = logging.getLogger(__name__)
settings = get_settings()


def _warm_model() -> None:
    """Load the embedding model so the first real request isn't slow.

    Runs in a background thread on startup. Failures are logged but never crash
    the app — the model will simply load lazily on first use instead.
    """
    try:
        from app.services.nlp_service import get_model

        get_model()
        logger.info("Embedding model warmed up.")
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Model warmup failed (will load lazily): %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Kick off a non-blocking model warmup at startup."""
    thread = threading.Thread(target=_warm_model, name="model-warmup", daemon=True)
    thread.start()
    yield


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description="Upload a résumé and a job description to get a semantic "
        "match score and a list of missing skills.",
        lifespan=lifespan,
    )

    # Per-IP rate limiting (slowapi). No-op when RATE_LIMIT_ENABLED is false.
    install_rate_limiting(app)

    # Allow the React dev frontend to call the API from the browser.
    # The API is stateless and uses no cookies/credentials, so we keep
    # allow_credentials=False and scope methods/headers explicitly rather than
    # using wildcards (defense-in-depth against origin misconfiguration).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        # Optional regex (e.g. Vercel preview URLs). `None` when unset so the
        # behaviour is identical to before unless CORS_ORIGIN_REGEX is provided.
        allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.get("/", tags=["meta"])
    def root() -> dict:
        """Friendly landing payload describing the service."""
        return {
            "service": settings.APP_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": "/health",
        }

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        """Liveness probe used by tooling and the frontend."""
        return {
            "status": "ok",
            "service": "resume-screening",
            "version": settings.VERSION,
        }

    @app.get("/warmup", tags=["meta"])
    async def warmup() -> dict:
        """Force-load the embedding model (idempotent) and report readiness.

        Useful to warm a cold instance before sending real traffic. The model is
        a cached singleton, so repeated calls are cheap after the first.
        """
        from fastapi.concurrency import run_in_threadpool
        from app.services.nlp_service import get_model

        await run_in_threadpool(get_model)
        return {"status": "ready", "model": settings.EMBEDDING_MODEL}

    # Mount the analysis routes (POST /analyze, /suggest, /chat, GET /models).
    app.include_router(analysis_router)

    return app


# ASGI application object imported by Uvicorn (``app.main:app``).
app = create_app()
