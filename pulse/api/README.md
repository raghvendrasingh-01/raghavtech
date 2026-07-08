# Pulse API

FastAPI backend for Pulse — the AI Chief of Staff.

## What's inside

| Path | Purpose |
|------|---------|
| `app/main.py` | App entrypoint, CORS, router wiring |
| `app/config.py` | Env-driven settings |
| `app/schemas.py` | Pydantic models (camelCase — identical to the frontend payloads) |
| `app/intelligence/` | The AI engine: `priority`, `risk`, `scheduler`, `planner`, `breakdown` |
| `app/llm.py` | Optional OpenAI adapter (used only if `OPENAI_API_KEY` is set) |
| `app/supabase.py` | Async PostgREST client (service-role) |
| `app/routers/` | `health`, `ai` (stateless), and generated CRUD resources |

The **AI routes are stateless** — tasks and events arrive in the request body,
so `/ai/chat`, `/ai/analyze`, `/ai/schedule`, and `/ai/goal-plan` work with or
without a database. The CRUD routes persist to Supabase.

## Run locally

```bash
cd pulse/api
uv venv --python 3.12
uv pip install -e .
cp .env.example .env         # fill in Supabase creds (optional for AI routes)
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API.

## Connect the frontend

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `pulse/web`. The frontend's
AI adapter then routes to this backend automatically; without it, the frontend
uses its built-in local engine.

## Database

Apply `../supabase/schema.sql` to your Supabase project (SQL editor or
`psql`). All tables are prefixed `pulse_` and user-scoped.
