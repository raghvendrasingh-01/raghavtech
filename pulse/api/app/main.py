"""Pulse API — FastAPI application entrypoint.

Layout:
  app/config.py         settings (env)
  app/schemas.py        Pydantic models (camelCase, match the frontend)
  app/intelligence/     the AI engine (priority, risk, scheduler, planner, breakdown)
  app/llm.py            optional OpenAI adapter
  app/supabase.py       async PostgREST client (service-role)
  app/routers/          health, ai (stateless), and CRUD resources
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, ai, storage
from app.routers.crud import make_crud_router

settings = get_settings()

app = FastAPI(
    title="Pulse API",
    description="AI Chief of Staff — planning, prioritization, and deadline-risk intelligence.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stateless / meta
app.include_router(health.router)
app.include_router(ai.router)
app.include_router(storage.router)

# Supabase-backed resources (return 503 until Supabase is configured)
app.include_router(make_crud_router("tasks", "pulse_tasks", order="deadline.asc"))
app.include_router(make_crud_router("habits", "pulse_habits"))
app.include_router(make_crud_router("goals", "pulse_goals"))
app.include_router(make_crud_router("events", "pulse_calendar_events", order="starts_at.asc"))
app.include_router(make_crud_router("notifications", "pulse_notifications", order="created_at.desc"))
