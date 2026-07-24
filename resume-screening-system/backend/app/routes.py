"""API routes for résumé analysis.

Exposes the core ``POST /analyze`` endpoint which accepts a résumé PDF or DOCX
upload plus a job-description string, then orchestrates the service layer:

    PDF/DOCX bytes ──> document_service ──> résumé text
                                                 │
    job description ─────────────────────────────┤
                                                 ▼
                 nlp_service (match + breakdown) + skill_service (gap analysis)
                                                 ▼
                                       AnalyzeResponse JSON

The NLP/PDF/DOCX work is CPU-bound and blocking, so it is dispatched to a worker
thread via ``run_in_threadpool`` to avoid stalling the async event loop.

Note: this module intentionally does NOT use ``from __future__ import annotations``.
slowapi's ``@limiter.limit`` wraps the endpoint, and stringized annotations get
resolved against the wrong module globals, which makes FastAPI misread the return
type. Keeping concrete annotations avoids that.
"""

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.config import get_settings
from app.exceptions import EmptyTextError, LLMError, PDFExtractionError
from app.rate_limit import limiter
from app.schemas import (
    AnalyzeResponse,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    ModelsResponse,
    ScoreBreakdown,
    SkillReport,
    SuggestRequest,
    SuggestResponse,
    Suggestions,
)
from app.services.chat_service import generate_chat_reply
from app.services.document_service import extract_text_from_upload
from app.services.llm_service import extract_skills_llm, generate_suggestions
from app.services.nlp_service import compute_score_breakdown, compute_similarity
from app.services.retrieval_service import retrieve_context
from app.services.skill_service import analyze_skills, extract_known_skills

router = APIRouter(tags=["analysis"])
settings = get_settings()

# Read uploads in 1 MB chunks so we can abort early on oversized files.
_READ_CHUNK = 1024 * 1024


async def _read_upload_capped(upload: UploadFile, max_bytes: int) -> bytes:
    """Read an upload into memory, aborting as soon as it exceeds ``max_bytes``.

    Reading in bounded chunks means a malicious/huge upload never gets fully
    buffered — we stop and raise 413 once the cap is crossed. Peak memory is
    bounded by ``max_bytes + _READ_CHUNK``.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(_READ_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            limit_mb = max_bytes / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Résumé exceeds the {limit_mb:.0f} MB upload limit.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Analyse a résumé against a job description",
)
@limiter.limit(settings.RATE_LIMIT_ANALYZE)
async def analyze(
    request: Request,
    resume: UploadFile = File(..., description="Résumé file (PDF or DOCX)."),
    job_description: str = Form(..., description="Job description text."),
) -> AnalyzeResponse:
    """Score a résumé against a JD and report missing skills.

    Raises:
        HTTPException: 400 for invalid input (unsupported format, empty JD, empty
            file), 413 if the upload exceeds the size limit, 429 if rate limited.
    """
    try:
        # --- Validate the job description ---
        jd = job_description.strip() if job_description else ""
        if not jd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job description must not be empty.",
            )
        # Cap JD length to bound downstream CPU/memory (well above any real JD).
        jd = jd[: settings.MAX_TEXT_CHARS]

        # --- Validate the upload content type (best-effort; we also sniff bytes) ---
        if resume.content_type and resume.content_type not in (
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream",
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected a PDF or DOCX upload, got '{resume.content_type}'.",
            )

        # --- Read bytes with an enforced, streamed size cap ---
        data = await _read_upload_capped(resume, settings.MAX_UPLOAD_BYTES)

        # --- Extract text from the résumé (blocking → threadpool) ---
        try:
            resume_text = await run_in_threadpool(
                extract_text_from_upload, data, resume.filename
            )
        except PDFExtractionError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

        # --- Score (blocking → threadpool) ---
        try:
            score = await run_in_threadpool(compute_similarity, resume_text, jd)
        except EmptyTextError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

        # --- Skill gap analysis (blocking → threadpool) ---
        skills = await run_in_threadpool(analyze_skills, resume_text, jd)

        # --- Optional LLM skill extraction (best-effort; union with regex) ---
        if settings.ai_enabled and settings.LLM_SKILL_EXTRACTION:
            try:
                llm_resume_aug = await extract_skills_llm(resume_text)
                llm_jd_aug = await extract_skills_llm(jd)
                if llm_resume_aug or llm_jd_aug:
                    resume_skills = extract_known_skills(resume_text)
                    jd_skills = extract_known_skills(jd)
                    resume_all = resume_skills | {s.title() for s in llm_resume_aug}
                    jd_all = jd_skills | {s.title() for s in llm_jd_aug}
                    matched_aug = jd_all & resume_all
                    missing_aug = jd_all - resume_all
                    skills["required"] = sorted(jd_all)
                    skills["matched"] = sorted(matched_aug)
                    skills["missing"] = sorted(missing_aug)
            except Exception:
                pass  # fall back to regex-only skills already in `skills`

        # --- Score breakdown (blocking → threadpool) ---
        breakdown = await run_in_threadpool(
            compute_score_breakdown, resume_text, jd, skills
        )

        return AnalyzeResponse(
            match_score=score,
            skills=SkillReport(**skills),
            resume_char_count=len(resume_text),
            resume_text=resume_text,
            filename=resume.filename,
            score_breakdown=ScoreBreakdown(**breakdown),
        )
    finally:
        await resume.close()


@router.post(
    "/suggest",
    response_model=SuggestResponse,
    summary="AI-powered suggestions to improve résumé fit",
)
@limiter.limit(settings.RATE_LIMIT_SUGGEST)
async def suggest(request: Request, body: SuggestRequest) -> SuggestResponse:
    """Return LLM-generated guidance for the analysed résumé/JD.

    Best-effort and decoupled from ``/analyze`` so the score can render
    immediately while suggestions load. Raises 503 when AI is unavailable.
    """
    if not body.resume_text.strip() or not body.job_description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both résumé text and job description are required.",
        )

    if not settings.ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI suggestions are not configured on the server.",
        )

    try:
        data = await generate_suggestions(
            resume_text=body.resume_text,
            jd_text=body.job_description,
            match_score=body.match_score,
            matched_skills=body.matched_skills,
            missing_skills=body.missing_skills,
            model_override=body.model,
        )
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    return SuggestResponse(suggestions=Suggestions(**data))


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Scoped, retrieval-grounded chatbot",
)
@limiter.limit(settings.RATE_LIMIT_CHAT)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    """Answer a project-scoped question grounded in the résumé and JD.

    Retrieves the most relevant résumé/JD excerpts for the question and lets a
    strictly-scoped assistant answer (or politely refuse off-topic questions).
    """
    if not body.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No messages provided.",
        )
    last = body.messages[-1]
    if last.role != "user" or not last.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The last message must be a non-empty user message.",
        )

    if not settings.ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI chat is not configured on the server.",
        )

    # Retrieval (embedding) is blocking → run off the event loop.
    snippets = await run_in_threadpool(
        retrieve_context, body.resume_text, body.job_description, last.content
    )

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    try:
        reply, final_model = await generate_chat_reply(
            messages=messages,
            match_score=body.match_score,
            matched_skills=body.matched_skills,
            missing_skills=body.missing_skills,
            snippets=snippets,
            model_override=body.model,
        )
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    return ChatResponse(reply=reply, model=final_model)


# ---------------------------------------------------------------------------
# Available free-tier models
# ---------------------------------------------------------------------------

# Curated list of OpenRouter models.
# This list is intentionally static so the backend remains the single source
# of truth and the frontend never hardcodes model IDs.
_FREE_MODELS: list[dict] = [
    # Premium models (requested by user)
    {
        "id": "google/gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "Google",
    },
    {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1", "provider": "DeepSeek"},
    {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "provider": "DeepSeek"},
    {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI"},
    # Free tier models
    {
        "id": "openrouter/free",
        "name": "OpenRouter Auto (Best Free)",
        "provider": "OpenRouter",
    },
    {
        "id": "meta-llama/llama-3.3-70b-instruct:free",
        "name": "Llama 3.3 70B Instruct",
        "provider": "Meta",
    },
    {
        "id": "meta-llama/llama-3.2-3b-instruct:free",
        "name": "Llama 3.2 3B Instruct",
        "provider": "Meta",
    },
    {
        "id": "qwen/qwen3-next-80b-a3b-instruct:free",
        "name": "Qwen 3 Next 80B",
        "provider": "Qwen",
    },
    {"id": "qwen/qwen3-coder:free", "name": "Qwen 3 Coder", "provider": "Qwen"},
    {"id": "google/gemma-4-31b-it:free", "name": "Gemma 4 31B", "provider": "Google"},
    {
        "id": "google/gemma-4-26b-a4b-it:free",
        "name": "Gemma 4 26B (MoE)",
        "provider": "Google",
    },
    {
        "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "name": "Nemotron 3 Nano Omni",
        "provider": "NVIDIA",
    },
    {
        "id": "nousresearch/hermes-3-llama-3.1-405b:free",
        "name": "Hermes 3 (Llama 3.1 405B)",
        "provider": "NousResearch",
    },
]

_DEFAULT_FREE_MODEL = "openai/gpt-4o-mini"


@router.get(
    "/models",
    response_model=ModelsResponse,
    summary="List available free-tier AI models",
)
def list_models() -> ModelsResponse:
    """Return the curated list of free-tier models the frontend can offer."""
    return ModelsResponse(
        models=[ModelInfo(**m) for m in _FREE_MODELS],
        default=_DEFAULT_FREE_MODEL,
    )
