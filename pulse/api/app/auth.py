"""Clerk JWT verification.

The frontend attaches a short-lived Clerk session token as
`Authorization: Bearer <jwt>`. We verify its RS256 signature against Clerk's
public JWKS and trust the `sub` claim (the Clerk user id) — never a
client-supplied header.

Dev/demo fallback: when Clerk isn't configured AND require_auth is false, we
fall back to the `X-User-Id` header so local development keeps working.
"""
from __future__ import annotations

import time

import httpx
import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

from app.config import get_settings

# Cache the JWKS client (and thus the fetched keys) across requests.
_jwk_client: PyJWKClient | None = None
_jwk_client_url: str | None = None


def _get_jwk_client(jwks_url: str) -> PyJWKClient:
    global _jwk_client, _jwk_client_url
    if _jwk_client is None or _jwk_client_url != jwks_url:
        _jwk_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        _jwk_client_url = jwks_url
    return _jwk_client


def _verify_clerk_jwt(token: str) -> str:
    """Return the verified Clerk user id (`sub`), or raise 401."""
    settings = get_settings()
    jwks_url = settings.clerk_jwks_url
    if not jwks_url:
        raise HTTPException(status_code=503, detail="Auth is not configured on the server.")
    try:
        signing_key = _get_jwk_client(jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"require": ["exp", "sub"], "verify_aud": False},
            leeway=10,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    # Defensive: Clerk tokens carry an `nbf`; PyJWT checks exp/nbf already.
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject.")
    return sub


def get_current_user_id(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> str:
    """FastAPI dependency: the authenticated Clerk user id.

    - If a Bearer token is present, verify it and use its `sub`.
    - Else, if auth is required, reject.
    - Else (dev/demo), fall back to X-User-Id, or a demo id.
    """
    settings = get_settings()

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        return _verify_clerk_jwt(token)

    if settings.require_auth:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Dev/demo fallback — never used when require_auth is true.
    return x_user_id or "demo-user"
