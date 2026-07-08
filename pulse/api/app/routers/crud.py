"""Generic Supabase-backed CRUD router factory.

Every Pulse resource (tasks, habits, goals, events, …) shares the same
user-scoped CRUD shape, so we generate the routers instead of repeating them.
User identity comes from the `X-User-Id` header (Clerk id) until Clerk JWT
verification is wired in Phase 7.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
import httpx

from app.supabase import Supabase, SupabaseUnavailable


def _db() -> Supabase:
    try:
        return Supabase()
    except SupabaseUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


def make_crud_router(prefix: str, table: str, order: str | None = None) -> APIRouter:
    router = APIRouter(prefix=f"/{prefix}", tags=[prefix])

    @router.get("")
    async def list_rows(x_user_id: str = Header(..., alias="X-User-Id")):
        try:
            return await _db().select(table, x_user_id, order=order)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase error: {e.response.text}")

    @router.post("", status_code=201)
    async def create_row(payload: dict, x_user_id: str = Header(..., alias="X-User-Id")):
        payload["user_id"] = x_user_id
        try:
            return await _db().insert(table, payload)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase error: {e.response.text}")

    @router.patch("/{row_id}")
    async def update_row(row_id: str, patch: dict, x_user_id: str = Header(..., alias="X-User-Id")):
        try:
            return await _db().update(table, row_id, patch)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase error: {e.response.text}")

    @router.delete("/{row_id}", status_code=204)
    async def delete_row(row_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
        try:
            await _db().delete(table, row_id)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase error: {e.response.text}")

    return router
