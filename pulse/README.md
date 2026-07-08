# Pulse — Your AI Chief of Staff

> The Last-Minute Life Saver. Pulse doesn't just store your tasks — it actively
> plans your day, prioritizes your work with reasons, predicts missed deadlines
> before they happen, and rebuilds your schedule the moment things change.
>
> **Not another to-do list.**

---

## ✨ What makes it special

| Feature | What it does |
|---|---|
| **Deadline Radar** | Scores every task's *miss-risk* by comparing work remaining against the free time actually left on your calendar — and tells you to start *now*. |
| **AI Prioritization** | Ranks tasks Critical → Low from urgency × importance × effort × workload, and **explains why** for each one. |
| **Smart Scheduler** | Bin-packs your work into real free slots around meetings, with focus blocks and breaks. Carries unfinished work across days. |
| **AI Planner + Chat** | "Plan my week — 2 assignments, an interview, and an exam." → a full daily plan in seconds. |
| **AI Task Creation** | Type a task; Pulse corrects your time estimate, suggests the best slot, breaks it into subtasks, and predicts if you'll miss it. |
| **Accountability & Nudges** | Context-aware reminders ("6h of work, 2h free — start now") instead of dumb "due tomorrow" alerts. |
| **Habits · Goals · Analytics** | Streaks & graphs, AI-generated goal roadmaps, and productivity analytics with recommendations. |

### The "AI" is real — and demo-proof
Pulse runs a **local, deterministic intelligence engine** (priority, risk,
scheduler, planner) that works with **zero external dependencies** — so the demo
never breaks on stage. Drop in an OpenAI key and the same interface upgrades to
GPT automatically. Same story for auth (Clerk-ready) and push (FCM-ready).

---

## 🏗 Architecture

```
pulse/
├── web/                      # Next.js 16 · React 19 · TS · Tailwind v4 · Framer Motion · Recharts
│   ├── app/                  # App Router: (marketing) landing, /login, (app) authed shell
│   ├── components/           # ui/ primitives · app/ shell · dashboard/ tasks/ planner/ … feature views
│   ├── lib/
│   │   ├── intelligence/     # ★ the engine: priority · risk · scheduler · planner · breakdown · insights
│   │   ├── ai/adapter.ts     # local engine now → OpenAI when NEXT_PUBLIC_API_URL is set
│   │   ├── auth.ts           # Clerk-ready auth seam (demo user by default)
│   │   ├── firebase.ts       # FCM-ready push (browser Notifications fallback)
│   │   └── seed/             # rich demo data anchored to "now"
│   └── public/firebase-messaging-sw.js
│
├── api/                      # FastAPI · uv · Python 3.12
│   ├── app/intelligence/     # the engine, ported to Python (parity with the frontend)
│   ├── app/routers/          # /ai/* (stateless) + Supabase-backed CRUD
│   ├── app/llm.py            # optional OpenAI adapter
│   └── app/supabase.py       # async PostgREST client
│
└── supabase/schema.sql       # complete Postgres schema (all pulse_* tables, RLS, triggers)
```

The AI routes are **stateless** — tasks/events travel in the request body — so
the frontend and backend share the exact same engine and payload shapes.

---

## 🚀 Run locally

**Frontend**
```bash
cd pulse/web
npm install
npm run dev            # http://localhost:3000
```
That's it — the app is fully usable on the built-in engine + seeded data.

**Backend (optional)**
```bash
cd pulse/api
uv venv --python 3.12 && uv pip install -e .
uv run uvicorn app.main:app --port 8008   # http://localhost:8008/docs
```
Then set `NEXT_PUBLIC_API_URL=http://localhost:8008` in `pulse/web/.env.local`
to route the frontend's AI through FastAPI.

**Database (optional)** — apply `supabase/schema.sql` in the Supabase SQL editor.

---

## ☁️ Deploy

- **Frontend → Vercel**: import `pulse/web` (config in `web/vercel.json`). Set the
  env vars from `web/.env.example`.
- **Backend → Render**: blueprint at `api/render.yaml`, or use `api/Dockerfile`
  for any container host (Koyeb, Fly, Cloud Run).

---

## 🧰 Tech stack

**Frontend** Next.js (App Router) · React · TypeScript · TailwindCSS v4 · Framer
Motion · Recharts · lucide
**Backend** FastAPI · Pydantic · httpx · (optional) OpenAI
**Data** Supabase Postgres · **Auth** Clerk-ready · **Push** Firebase Cloud Messaging
**Deploy** Vercel + Render

---

Built for a hackathon — designed to feel like a startup-ready SaaS you'd use
every day.
