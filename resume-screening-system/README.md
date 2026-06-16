# 🎯 AI Resume Screening System

An AI-powered tool that screens a candidate's résumé (PDF) against a job
description (JD). It extracts the résumé text, computes a **semantic match
score** using sentence-embedding similarity, and highlights **skills required by
the JD that are missing from the résumé**.

> Part of the [raghavtech](../) portfolio. Fully self-contained — it has its own
> Python backend and React frontend and does not depend on the parent
> portfolio's build.

> **Status:** ✅ All 9 build steps complete and verified, plus AI-guidance and a
> scoped AI chatbot. Backend test suite: 39 passing.

---

## ✨ Features

- **PDF résumé upload** with drag-and-drop (and click-to-browse).
- **Robust text extraction** via `pdfminer.six`, including guards for
  non-PDF / corrupt / image-only files.
- **Semantic match score (0–100%)** using `sentence-transformers`
  (`all-MiniLM-L6-v2`) and cosine similarity — captures meaning, not just
  keyword overlap.
- **Skill-gap analysis** — detects skills in the JD using a curated skill bank
  with alias/regex matching and reports `matched` vs `missing`.
- **AI career guidance (optional)** — an LLM (via [OpenRouter](https://openrouter.ai/))
  turns the score + skill gaps into a fit summary, strengths, advice for each
  missing skill, résumé improvements, and next steps. The API key stays
  server-side; the feature degrades gracefully when not configured.
- **AI chatbot (optional)** — a retrieval-grounded assistant you can ask
  anything. It also has your résumé, the job, and the score/skills on hand, so
  résumé / interview / ATS / career questions get specific, grounded answers
  (via embedding retrieval over the résumé/JD).
- **Clean React UI** with a colour-graded score bar and skill pills.
- **Typed JSON API** with automatic OpenAPI docs at `/docs`.
- **Automated test suite** (39 tests across services + API).

---

## 🏗️ Architecture

```
                ┌─────────────────────────┐
                │   React + Vite frontend │
                │   (FileDropzone, JD,    │
                │    ScoreBar, SkillList) │
                └───────────┬─────────────┘
                            │  POST /analyze  (multipart: resume + job_description)
                            ▼
                ┌─────────────────────────┐
                │      FastAPI backend     │
                │      app/routes.py       │
                └───────────┬─────────────┘
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
 pdf_service.py      nlp_service.py        skill_service.py
 (pdfminer.six)   (sentence-transformers)    (skill bank)
   extract text     cosine similarity       matched / missing
        └───────────────────┼────────────────────┘
                            ▼
                   AnalyzeResponse (JSON)
            { match_score, skills{…}, resume_text }
                            │
        (optional) POST /suggest ──> llm_service ──> OpenRouter LLM
                            ▼
        Suggestions { fit_summary, strengths, gap_advice,
                      resume_improvements, next_steps }
```

---

## 🧰 Tech stack

| Layer    | Technology |
|----------|------------|
| Backend  | Python 3.12, [FastAPI](https://fastapi.tiangolo.com/), Uvicorn |
| NLP      | [sentence-transformers](https://www.sbert.net/) (`all-MiniLM-L6-v2`) |
| PDF      | [pdfminer.six](https://pdfminersix.readthedocs.io/) |
| Frontend | React 19 + [Vite](https://vitejs.dev/) |
| Tests    | pytest + FastAPI `TestClient` |

---

## 📂 Repository layout

```
resume-screening-system/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app factory, CORS, /health, /
│   │   ├── routes.py          # POST /analyze + POST /suggest
│   │   ├── schemas.py         # pydantic request/response models
│   │   ├── config.py          # settings (CORS, model, limits, OpenRouter)
│   │   ├── exceptions.py      # domain error types
│   │   └── services/
│   │       ├── pdf_service.py    # PDF → text
│   │       ├── nlp_service.py    # semantic similarity score
│   │       ├── skill_service.py  # skill extraction + gap analysis
│   │       ├── llm_service.py    # OpenRouter client + AI suggestions
│   │       ├── retrieval_service.py # embedding retrieval (RAG) for chat
│   │       └── chat_service.py   # scoped, grounded chatbot
│   ├── tests/                 # pytest suite (+ synthetic PDF fixture)
│   ├── requirements.txt       # runtime dependencies
│   ├── requirements-dev.txt   # + pytest, httpx
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # page + state + submit flow
│   │   ├── api.js             # fetch wrapper for /analyze
│   │   └── components/        # FileDropzone, ScoreBar, SkillList
│   └── .env                   # VITE_API_BASE_URL
├── Makefile                   # backend | frontend | test | install-dev | install-frontend | lint | build | clean
└── README.md
```

---

## 🚀 Getting started

### Prerequisites

- **Python 3.12** (recommended — the ML wheels are most reliable here).
- **Node.js 20.19+ or 22.12+** and npm (required by Vite 8).

> This project was scaffolded with Python provisioned via
> [`uv`](https://docs.astral.sh/uv/). Any Python 3.12 works; the instructions
> below use a standard `venv`.

### 1. Backend

```bash
cd backend

# Create + activate a virtual environment (Python 3.12)
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies (this pulls PyTorch — a few hundred MB)
pip install -r requirements.txt

# (Optional) enable AI suggestions: copy the example env and add your key
cp .env.example .env      # then set OPENROUTER_API_KEY in .env

# Run the API (http://127.0.0.1:8000, docs at /docs)
uvicorn app.main:app --reload --port 8000
```

> The core analysis (score + skills) works without any API key. The AI guidance
> panel only activates when `OPENROUTER_API_KEY` is set (get one at
> [openrouter.ai/keys](https://openrouter.ai/keys)).

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Open **http://localhost:5173**, drop in a résumé PDF, paste a job description,
and click **Analyze résumé**.

> **Using the `Makefile`** (after completing the backend venv setup in step 1
> and running `make install-frontend`): `make backend`, `make frontend`. For
> tests, run `make install-dev` once, then `make test`. See `make help` for all
> targets.

---

## 🔌 API reference

### `GET /health`
Liveness probe.
```json
{ "status": "ok", "service": "resume-screening", "version": "0.1.0" }
```

### `POST /analyze`
Multipart form:

| Field             | Type   | Description              |
|-------------------|--------|--------------------------|
| `resume`          | file   | Résumé **PDF**           |
| `job_description` | string | Job description text     |

**Example**
```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -F "resume=@resume.pdf;type=application/pdf" \
  -F "job_description=Python backend engineer with FastAPI, Docker, Kubernetes, AWS."
```

**Response `200`**
```json
{
  "match_score": 72.24,
  "skills": {
    "required": ["AWS", "Docker", "FastAPI", "Kubernetes", "Python"],
    "matched":  ["AWS", "Docker", "FastAPI", "Python"],
    "missing":  ["Kubernetes"]
  },
  "resume_char_count": 163,
  "resume_text": "…extracted résumé text…",
  "filename": "resume.pdf"
}
```

**Error responses**

| Status | When |
|--------|------|
| `400`  | Empty job description, non-PDF / corrupt / image-only file |
| `413`  | Upload exceeds the size limit (default 5 MB) |
| `422`  | Required field missing |

### `POST /suggest`
JSON body (typically built from the `/analyze` response, so no re-upload):

```json
{
  "resume_text": "…",
  "job_description": "…",
  "match_score": 72.24,
  "matched_skills": ["Python", "FastAPI"],
  "missing_skills": ["Kubernetes"]
}
```

**Response `200`**
```json
{
  "suggestions": {
    "fit_summary": "Strong fit with a few gaps…",
    "strengths": ["…"],
    "gap_advice": [{ "skill": "Kubernetes", "how_to_address": "…" }],
    "resume_improvements": ["…"],
    "next_steps": ["…"],
    "model": "openai/gpt-4o-mini"
  }
}
```

| Status | When |
|--------|------|
| `400`  | Missing résumé text or job description |
| `502`  | The AI provider failed / timed out |
| `503`  | AI not configured (`OPENROUTER_API_KEY` unset) |

### `POST /chat`
Retrieval-grounded chatbot. JSON body:

```json
{
  "messages": [
    { "role": "user", "content": "What should I prepare for the interview?" }
  ],
  "resume_text": "…",
  "job_description": "…",
  "match_score": 72.24,
  "matched_skills": ["Python"],
  "missing_skills": ["Kubernetes"]
}
```

**Response `200`** → `{ "reply": "…", "model": "openai/gpt-4o-mini" }`

The assistant answers any question, and uses the résumé/JD/score context to give
specific, grounded advice for résumé, interview, ATS, and career questions.

| Status | When |
|--------|------|
| `400`  | No messages / last message isn't a user turn |
| `502`  | The AI provider failed / timed out |
| `503`  | AI not configured |

---

## 🧠 How it works

- **Match score** — both texts are embedded with `all-MiniLM-L6-v2` and compared
  with cosine similarity. The value is clamped to `[0, 1]` and scaled to a
  0–100% score. The model loads lazily as a singleton, so it's loaded once and
  reused across requests.
- **Skill gap** — a curated *skill bank* maps canonical skills to aliases and is
  matched against text with token-boundary-aware regexes (handling `C++`, `C#`,
  `.NET`, `node.js`, etc.). The set of JD skills is partitioned into `matched`
  (also in the résumé) and `missing`.
- **AI guidance** — `llm_service.py` sends the résumé, JD, score, and skill gaps
  to an OpenRouter model and parses the JSON guidance. It runs server-side
  (key never reaches the browser) and is decoupled from `/analyze` so the score
  shows instantly while suggestions load.
- **Chatbot** — for each question, `retrieval_service.py` chunks the résumé + JD,
  embeds them with the same `all-MiniLM-L6-v2` model, and selects the top-k most
  relevant excerpts (a lightweight, per-request RAG — no vector DB needed for a
  single document). `chat_service.py` injects those excerpts + the score/skills
  into the system prompt so résumé/career questions are answered specifically and
  grounded. Conversation history is length-capped to bound token cost.

---

## 🧪 Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Covers PDF extraction, skill extraction edge cases, semantic scoring behaviour,
and the API endpoints (happy path + 400/422 error cases).

---

## ⚙️ Configuration

Environment variables (all optional):

| Variable            | Default                                             | Description |
|---------------------|-----------------------------------------------------|-------------|
| `CORS_ORIGINS`      | `http://localhost:5173,http://127.0.0.1:5173`       | Allowed browser origins (comma-separated) |
| `EMBEDDING_MODEL`   | `all-MiniLM-L6-v2`                                  | sentence-transformers model |
| `MAX_UPLOAD_BYTES`  | `5242880` (5 MB)                                    | Max résumé upload size |
| `OPENROUTER_API_KEY`| _(unset)_                                           | Enables AI suggestions when set (server-side only) |
| `OPENROUTER_MODEL`  | `openai/gpt-4o-mini`                                | Any [OpenRouter model id](https://openrouter.ai/models) |
| `LLM_TIMEOUT_SECONDS` | `45`                                              | AI request timeout |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000`                             | Backend URL (standalone frontend `.env`) |
| `VITE_RESUME_API_URL` | `http://127.0.0.1:8000`                           | Backend URL used by the in-portfolio page (`src/pages/ResumeScreener.tsx`) |

## 🔗 Portfolio integration

This project is also surfaced inside the parent portfolio as a page at
**`/resume-screener`** (`src/pages/ResumeScreener.tsx`, linked from the Projects
section). Because the screener is full-stack, that page calls this backend at
`VITE_RESUME_API_URL`. For a **live** in-portfolio demo, host the FastAPI backend
somewhere and set `VITE_RESUME_API_URL` to its URL; otherwise the page shows a
clear "start the backend" message and the standalone app in this folder remains
the primary way to run it.

---

## 🔭 Limitations & future work

- The skill bank is curated and tech-focused; domain-specific skills outside it
  may be missed. A future version could learn skills from a taxonomy or ESCO.
- Scanned/image-only PDFs have no text layer — OCR (e.g. Tesseract) could be
  added.
- Match score is a single semantic measure; section-aware weighting
  (experience vs. skills) would improve nuance.
