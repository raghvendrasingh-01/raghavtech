"""API routes for résumé analysis.

Exposes the core ``POST /analyze`` endpoint which accepts a résumé PDF upload
plus a job-description string, then orchestrates the service layer:

    PDF bytes ──> pdf_service ──> résumé text
                                      │
    job description ──────────────────┤
                                      ▼
                 nlp_service (match score) + skill_service (gap analysis)
                                      ▼
                              AnalyzeResponse JSON

The NLP/PDF work is CPU-bound and blocking, so it is dispatched to a worker
thread via ``run_in_threadpool`` to avoid stalling the async event loop.
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.config import get_settings
from app.exceptions import EmptyTextError, LLMError, PDFExtractionError
from app.schemas import (
    AnalyzeResponse,
    ChatRequest,
    ChatResponse,
    SkillReport,
    SuggestRequest,
    SuggestResponse,
    Suggestions,
)
from app.services.chat_service import generate_chat_reply
from app.services.llm_service import generate_suggestions
from app.services.nlp_service import compute_similarity
from app.services.pdf_service import extract_text_from_pdf_bytes
from app.services.retrieval_service import retrieve_context
from app.services.skill_service import analyze_skills

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
async def analyze(
    resume: UploadFile = File(..., description="Résumé file (PDF)."),
    job_description: str = Form(..., description="Job description text."),
) -> AnalyzeResponse:
    """Score a résumé against a JD and report missing skills.

    Raises:
        HTTPException: 400 for invalid input (non-PDF, empty JD, empty file),
            413 if the upload exceeds the size limit.
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
        if resume.content_type not in (
            "application/pdf",
            "application/octet-stream",
            None,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected a PDF upload, got '{resume.content_type}'.",
            )

        # --- Read bytes with an enforced, streamed size cap ---
        data = await _read_upload_capped(resume, settings.MAX_UPLOAD_BYTES)

        # --- Extract text from the PDF (blocking → threadpool) ---
        try:
            resume_text = await run_in_threadpool(extract_text_from_pdf_bytes, data)
        except PDFExtractionError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

        # --- Score + skill gap analysis (blocking → threadpool) ---
        try:
            score = await run_in_threadpool(compute_similarity, resume_text, jd)
        except EmptyTextError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

        skills = await run_in_threadpool(analyze_skills, resume_text, jd)

        return AnalyzeResponse(
            match_score=score,
            skills=SkillReport(**skills),
            resume_char_count=len(resume_text),
            resume_text=resume_text,
            filename=resume.filename,
        )
    finally:
        # Always release the upload's underlying spooled temp file.
        await resume.close()


@router.post(
    "/suggest",
    response_model=SuggestResponse,
    summary="AI-powered suggestions to improve résumé fit",
)
async def suggest(body: SuggestRequest) -> SuggestResponse:
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
async def chat(body: ChatRequest) -> ChatResponse:
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
        reply = await generate_chat_reply(
            messages=messages,
            match_score=body.match_score,
            matched_skills=body.matched_skills,
            missing_skills=body.missing_skills,
            snippets=snippets,
        )
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    return ChatResponse(reply=reply, model=settings.OPENROUTER_MODEL)
