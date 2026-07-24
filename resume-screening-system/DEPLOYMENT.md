# Deployment Guide — AI Resume Screening System

This is a **full-stack** feature: a React/Vite frontend (the portfolio, deployed
on **Vercel**) talking to a **FastAPI** backend (deployed on **Render**).

> **Why the frontend can't reach the backend**
> The deployed page (`src/pages/ResumeScreener.tsx`) builds its API base URL from
> the `VITE_RESUME_API_URL` env var, falling back to `http://127.0.0.1:8000`.
> That env var is **not set in Vercel**, so the production bundle is hardcoded to
> `127.0.0.1:8000` — which, in a visitor's browser, means *their own* computer.
> Nothing is listening there, so every `/analyze`, `/suggest`, and `/chat` call
> fails with *"Could not reach the analysis server at http://127.0.0.1:8000"*.
> On top of that, **no backend was ever deployed**, and the backend's CORS
> allow-list defaults to localhost only.
>
> The fix is three steps: **(1)** deploy the backend to Render, **(2)** allow the
> Vercel origin via CORS, **(3)** set `VITE_RESUME_API_URL` in Vercel and
> redeploy.

---

## 1. Deploy the backend to Render

The repo ships a `render.yaml` blueprint at the **git repository root** (one
level above this `resume-screening-system/` folder), not beside this file. It
sets `rootDir: resume-screening-system/backend` so Render builds only the
backend.

### Option A — Blueprint (recommended)
1. Push this repo to GitHub (Render deploys from the repo, so `render.yaml` and
   all fixes must be committed and pushed first).
2. In the Render dashboard → **New → Blueprint** → select this repo.
3. Render reads `render.yaml` and creates the `resume-screening-api` web service.
4. Set the secret/sync-disabled env vars when prompted (see table below).

### Option B — Manual web service
**New → Web Service**, connect the repo, then set:

| Setting | Value |
| --- | --- |
| **Root Directory** | `resume-screening-system/backend` |
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/health` |

> The start command **must** bind `--host 0.0.0.0` and `--port $PORT`. Render
> injects `$PORT`; binding to a fixed port (8000/8001) or to `127.0.0.1` makes
> the service unreachable.

### Environment variables (Render dashboard)

| Key | Value | Notes |
| --- | --- | --- |
| `PYTHON_VERSION` | `3.12.8` | 3.14 has no PyTorch wheels; pin 3.12. |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` | **Required.** Your real Vercel URL(s), comma-separated. |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Optional — allows Vercel **preview** deploys. |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | Secret. Enables AI suggestions + chat. |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Optional override. |

### ⚠️ Memory / cold-start note
The backend imports `sentence-transformers` + PyTorch and loads an embedding
model on the **first** `/analyze` request.

- This can spike well past **512 MB**. If the service 502s / restarts on the
  first analysis, upgrade the plan from `starter` to **`standard` (2 GB)**.
- On the **free** plan the service spins down when idle; the first request after
  idle is slow (cold start + model load). `starter`+ stays warm.

### Verify the backend
```bash
curl https://<your-service>.onrender.com/health
# -> {"status":"ok","service":"resume-screening","version":"0.1.0"}
```

---

## 2. Point the Vercel frontend at the backend

1. Vercel dashboard → your portfolio project → **Settings → Environment
   Variables**.
2. Add:

   | Key | Value | Environments |
   | --- | --- | --- |
   | `VITE_RESUME_API_URL` | `https://<your-service>.onrender.com` | Production (+ Preview) |

   No trailing slash. (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` should
   already be set — see `.env.example`.)
3. **Redeploy** the frontend. Vite inlines `VITE_*` vars **at build time**, so an
   existing build won't pick up the new value — you must trigger a fresh deploy
   (Deployments → ⋯ → Redeploy, or push a commit).

### Verify
Open the deployed site → Resume Screener page → upload a PDF + paste a JD →
**Analyze**. You should get a score instead of the "Could not reach" error. If
you see a **CORS** error in the browser console instead, `CORS_ORIGINS` on Render
doesn't match your Vercel origin exactly (scheme + host, no path) — fix it and
restart the Render service.

---

## 3. Local development

```bash
# Backend (from resume-screening-system/backend)
python -m uvicorn app.main:app --reload --port 8001

# Frontend (portfolio root) — create .env.local from .env.example first
echo 'VITE_RESUME_API_URL=http://127.0.0.1:8001' >> .env.local
npm run dev
```
(If you run the backend on `:8000`, the page's built-in fallback works without
setting the var at all.)

---

## 4. Repository hygiene (recommended one-time cleanup)

`git ls-files` shows build artifacts and dependencies were committed. They don't
break deployment (Vercel/Render rebuild from source), but they bloat the repo.
`.gitignore` has been updated to exclude them going forward; to untrack what's
already committed:

```bash
# from repo root — removes from git index, keeps files on disk
git rm -r --cached node_modules dist
git commit -m "chore: stop tracking node_modules and dist"
```

**venv is fine:** no Python virtualenv is committed — `backend/venv/` and
`backend/.env` are correctly gitignored. Only `.env.example` templates are
tracked (placeholders, no real keys).
