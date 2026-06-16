"""Retrieval-grounded chatbot.

A general-purpose assistant that can answer any question the user asks. It also
has the user's résumé, the target job description, the match score, and the
skill gaps available as context, so résumé / job / career questions are answered
specifically and grounded in retrieved résumé/JD excerpts (see
:mod:`app.services.retrieval_service`).
"""

from __future__ import annotations

from app.config import get_settings
from app.services.llm_service import _openrouter_chat

# Keep at most this many of the most recent turns to bound token usage.
MAX_HISTORY_MESSAGES = 12
# Trim any single message to this many characters.
MAX_MESSAGE_CHARS = 4000

_SYSTEM_TEMPLATE = """You are a helpful, knowledgeable AI assistant embedded in the AI Resume Screening System. You can answer any question the user asks.

You also have the user's uploaded résumé, a target job description, the computed match score, and the matched / missing skills available as context (below). When the question relates to the résumé, the job, interview preparation, ATS optimization, or the user's career, use this context to give specific, grounded advice — and do not invent experience the résumé does not show. For anything else, just answer normally and helpfully.

Be concise, clear, and practical.

=== CONTEXT (use when relevant) ===
Match score: {score:.1f}/100
Skills present in résumé (matched): {matched}
Skills required by the job but missing: {missing}

Relevant résumé / job-description excerpts for this question:
{excerpts}
=== END CONTEXT ==="""


def build_system_prompt(
    match_score: float,
    matched_skills: list[str],
    missing_skills: list[str],
    snippets: list[tuple[str, str]],
) -> str:
    """Render the scoped system prompt with the grounding context."""
    excerpts = (
        "\n".join(f"- [{source}] {text}" for source, text in snippets)
        or "(no excerpts available)"
    )
    return _SYSTEM_TEMPLATE.format(
        score=match_score,
        matched=", ".join(matched_skills) or "none detected",
        missing=", ".join(missing_skills) or "none",
        excerpts=excerpts,
    )


async def generate_chat_reply(
    messages: list[dict],
    match_score: float,
    matched_skills: list[str],
    missing_skills: list[str],
    snippets: list[tuple[str, str]],
) -> str:
    """Produce a scoped, grounded assistant reply.

    Args:
        messages: Conversation so far as ``{"role", "content"}`` dicts; the last
            entry must be the user's current question.
        match_score: The computed match score.
        matched_skills / missing_skills: Skill-gap context.
        snippets: Retrieved ``(source, text)`` excerpts for grounding.

    Returns:
        The assistant's reply text.

    Raises:
        LLMError: If the AI provider is unavailable or fails.
    """
    system_prompt = build_system_prompt(
        match_score, matched_skills, missing_skills, snippets
    )

    # Trim history length and per-message size to bound token cost.
    trimmed = [
        {"role": m["role"], "content": str(m["content"])[:MAX_MESSAGE_CHARS]}
        for m in messages[-MAX_HISTORY_MESSAGES:]
    ]
    full_messages = [{"role": "system", "content": system_prompt}, *trimmed]

    reply = await _openrouter_chat(full_messages, temperature=0.3)
    return reply.strip()
