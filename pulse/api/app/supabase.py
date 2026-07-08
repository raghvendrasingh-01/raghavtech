"""Thin async Supabase (PostgREST) client using the service-role key.

Every method scopes by user_id. If Supabase isn't configured the client raises
`SupabaseUnavailable`, which the routers translate into a clear 503.
"""
from __future__ import annotations

from typing import Any
import httpx

from app.config import get_settings


class SupabaseUnavailable(RuntimeError):
    pass


class Supabase:
    def __init__(self) -> None:
        s = get_settings()
        if not s.has_supabase:
            raise SupabaseUnavailable("Supabase is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).")
        self._base = f"{s.supabase_url}/rest/v1"
        self._storage = f"{s.supabase_url}/storage/v1"
        self._key = s.supabase_service_role_key
        self._headers = {
            "apikey": s.supabase_service_role_key,
            "Authorization": f"Bearer {s.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    async def select(self, table: str, user_id: str, order: str | None = None) -> list[dict[str, Any]]:
        params = {"user_id": f"eq.{user_id}", "select": "*"}
        if order:
            params["order"] = order
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{self._base}/{table}", headers=self._headers, params=params)
            r.raise_for_status()
            return r.json()

    async def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        headers = {**self._headers, "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{self._base}/{table}", headers=headers, json=row)
            r.raise_for_status()
            data = r.json()
            return data[0] if isinstance(data, list) and data else data

    async def update(self, table: str, row_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        headers = {**self._headers, "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.patch(f"{self._base}/{table}", headers=headers, params={"id": f"eq.{row_id}"}, json=patch)
            r.raise_for_status()
            data = r.json()
            return data[0] if isinstance(data, list) and data else {}

    async def delete(self, table: str, row_id: str) -> None:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.delete(f"{self._base}/{table}", headers=self._headers, params={"id": f"eq.{row_id}"})
            r.raise_for_status()

    async def upload_object(self, bucket: str, path: str, content: bytes, content_type: str | None) -> str:
        """Upload bytes to Storage with the service-role key (bypasses RLS) and
        return the object's public URL."""
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "false",
        }
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{self._storage}/object/{bucket}/{path}", headers=headers, content=content)
            r.raise_for_status()
        return f"{self._storage}/object/public/{bucket}/{path}"
