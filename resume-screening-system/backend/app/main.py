"""FastAPI application entry point.

Step 2 wires up the application skeleton:
    * an app factory (``create_app``) that configures CORS,
    * a ``GET /health`` liveness probe, and
    * a ``GET /`` welcome/info route.

The ``/analyze`` endpoint and supporting NLP/PDF logic are added in later
steps. Run locally with::

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import router as analysis_router

settings = get_settings()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description="Upload a résumé and a job description to get a semantic "
        "match score and a list of missing skills.",
    )

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

    # Mount the analysis routes (POST /analyze).
    app.include_router(analysis_router)

    return app


# ASGI application object imported by Uvicorn (``app.main:app``).
app = create_app()
