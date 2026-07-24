"""Pydantic schemas for API responses.

These models define the structured JSON contract returned by the API and give
us automatic validation plus OpenAPI documentation at ``/docs``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RankedSkill(BaseModel):
    """A missing skill together with its frequency in the job description."""

    skill: str = Field(..., description="Canonical skill name.")
    jd_frequency: int = Field(
        0, ge=0, description="How many times the skill appears in the JD."
    )


class SectionScore(BaseModel):
    """Similarity of one résumé section against the job description."""

    section: str = Field(..., description="Section label (e.g. 'Experience').")
    score: float = Field(
        ..., ge=0.0, le=100.0, description="Section-vs-JD similarity (0–100)."
    )


class ScoreBreakdown(BaseModel):
    """Component scores behind the headline ``match_score`` (all 0–100).

    Additive diagnostic detail — the primary ``match_score`` is unchanged. Lets
    the UI explain *why* a résumé scored the way it did.
    """

    semantic_similarity: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Whole-document cosine similarity (same basis as match_score).",
    )
    skills_coverage: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Percentage of JD-required skills present in the résumé.",
    )
    sections: list[SectionScore] = Field(
        default_factory=list,
        description="Per-section résumé-vs-JD similarity (Experience, Skills, …).",
    )


class SkillReport(BaseModel):
    """Breakdown of JD-required skills versus what the résumé contains."""

    required: list[str] = Field(
        default_factory=list,
        description="Skills detected in the job description.",
    )
    matched: list[str] = Field(
        default_factory=list,
        description="Required skills that are present in the résumé.",
    )
    missing: list[str] = Field(
        default_factory=list,
        description="Required skills that are absent from the résumé.",
    )
    missing_ranked: list[RankedSkill] = Field(
        default_factory=list,
        description="Missing skills ordered by how often they appear in the JD "
        "(most-emphasised first). Additive; clients may ignore it.",
    )
    quick_wins: list[str] = Field(
        default_factory=list,
        description="The top few missing skills the candidate should prioritise, "
        "by JD frequency. Additive; clients may ignore it.",
    )


class AnalyzeResponse(BaseModel):
    """Full result of analysing a résumé against a job description."""

    match_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Semantic similarity score between résumé and JD (0–100).",
    )
    skills: SkillReport = Field(..., description="Skill gap analysis.")
    resume_char_count: int = Field(
        ..., description="Number of characters extracted from the résumé PDF."
    )
    resume_text: str = Field(
        default="",
        description="Extracted résumé text (so the client can request AI "
        "suggestions without re-uploading the file).",
    )
    filename: str | None = Field(
        default=None, description="Original uploaded résumé filename."
    )
    score_breakdown: ScoreBreakdown | None = Field(
        default=None,
        description="Optional component breakdown behind match_score. Additive; "
        "clients may ignore it.",
    )


# --- AI suggestions (/suggest) ---


class GapAdvice(BaseModel):
    """Advice for addressing a single missing/weak skill."""

    skill: str = ""
    how_to_address: str = ""


class Suggestions(BaseModel):
    """AI-generated career guidance."""

    fit_summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    gap_advice: list[GapAdvice] = Field(default_factory=list)
    resume_improvements: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    model: str = Field(default="", description="LLM model that produced this.")


class SuggestRequest(BaseModel):
    """Input for the AI suggestions endpoint (JSON body)."""

    resume_text: str = Field(..., description="Extracted résumé text.")
    job_description: str = Field(..., description="Job description text.")
    match_score: float = Field(0.0, ge=0.0, le=100.0)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    model: str = Field(
        default="",
        description="OpenRouter model ID chosen by the user. "
        "Empty string means use the server default.",
    )


class SuggestResponse(BaseModel):
    """Response wrapping the AI suggestions."""

    suggestions: Suggestions


# --- Chatbot (/chat) ---


class ChatMessage(BaseModel):
    """A single turn in the conversation."""

    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Input for the scoped chatbot (JSON body)."""

    messages: list[ChatMessage] = Field(
        ..., description="Conversation so far; the last item must be the user's "
        "current question."
    )
    resume_text: str = Field("", description="Extracted résumé text (context).")
    job_description: str = Field("", description="Job description text (context).")
    match_score: float = Field(0.0, ge=0.0, le=100.0)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    model: str = Field(
        default="",
        description="OpenRouter model ID chosen by the user. "
        "Empty string means use the server default.",
    )


class ChatResponse(BaseModel):
    """The assistant's reply."""

    reply: str
    model: str = ""


class ErrorResponse(BaseModel):
    """Uniform error envelope."""

    detail: str


# --- Available models (/models) ---


class ModelInfo(BaseModel):
    """A single selectable AI model."""

    id: str = Field(..., description="OpenRouter model ID.")
    name: str = Field(..., description="Human-readable display name.")
    provider: str = Field("", description="Provider (Google, Meta, …).")


class ModelsResponse(BaseModel):
    """List of available free-tier models."""

    models: list[ModelInfo]
    default: str = Field(..., description="The recommended default model ID.")
