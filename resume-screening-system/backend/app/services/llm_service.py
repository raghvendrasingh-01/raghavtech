"""AI-powered suggestions via OpenRouter.

Given a résumé, a job description, the computed match score, and the skill-gap
analysis, this asks an LLM (through the OpenRouter API) for concise, actionable
career guidance: an honest fit summary, strengths, advice for each missing
skill, résumé improvements, and next steps.

Design notes:
* The API key lives server-side only (config / ``.env``) — it is never sent to
  the browser.
* Suggestions are **best-effort**: any failure (no key, timeout, bad response)
  raises :class:`LLMError`, which the API layer turns into a graceful message
  rather than breaking the core analysis.
* The model output is requested as JSON and parsed defensively (tolerating
  Markdown code fences and surrounding prose) so it works across models.
"""

from __future__ import annotations

import json
import logging

import httpx

from app.config import get_settings
from app.exceptions import LLMError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an expert technical recruiter and career coach. Given a "
    "candidate's résumé, a target job description, a computed semantic match "
    "score, and a skills-gap analysis, give concise, specific, actionable "
    "guidance to improve the candidate's fit for THIS role. Be honest and "
    "constructive; never invent experience the résumé does not show. "
    "Return ONLY valid JSON matching the requested schema — no Markdown, no "
    "commentary outside the JSON."
)

# The JSON shape we ask the model to produce.
_SCHEMA_HINT = {
    "fit_summary": "string — 1-2 sentences, honest overall assessment of fit",
    "strengths": ["string — concrete strengths relative to the JD"],
    "gap_advice": [
        {
            "skill": "string — a missing/weak skill",
            "how_to_address": "string — practical, specific advice",
        }
    ],
    "resume_improvements": ["string — concrete edits to the résumé"],
    "next_steps": ["string — prioritized actions the candidate should take"],
}


def _build_user_prompt(
    resume_text: str,
    jd_text: str,
    match_score: float,
    matched_skills: list[str],
    missing_skills: list[str],
    max_chars: int,
) -> str:
    """Assemble the user message sent to the LLM."""
    return (
        f"MATCH SCORE: {match_score:.1f}/100\n\n"
        f"SKILLS PRESENT IN RÉSUMÉ (matched JD skills): "
        f"{', '.join(matched_skills) or 'none detected'}\n"
        f"SKILLS REQUIRED BY JD BUT MISSING FROM RÉSUMÉ: "
        f"{', '.join(missing_skills) or 'none'}\n\n"
        f"=== JOB DESCRIPTION ===\n{jd_text[:max_chars]}\n\n"
        f"=== RÉSUMÉ TEXT ===\n{resume_text[:max_chars]}\n\n"
        "Respond with a single JSON object using EXACTLY these keys: "
        f"{json.dumps(_SCHEMA_HINT)}"
    )


def _parse_json_object(content: str) -> dict:
    """Parse a JSON object from model output, tolerating fences/prose."""
    text = content.strip()
    # Strip Markdown code fences if present.
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text[3:] else text[3:]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fall back to the first {...} block.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _normalise(data: dict) -> dict:
    """Coerce the parsed object into the documented shape with safe defaults."""

    def as_str_list(value) -> list[str]:
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    gap_advice = []
    for item in data.get("gap_advice", []) or []:
        if isinstance(item, dict):
            skill = str(item.get("skill", "")).strip()
            how = str(item.get("how_to_address", "")).strip()
            if skill or how:
                gap_advice.append({"skill": skill, "how_to_address": how})
        elif isinstance(item, str) and item.strip():
            gap_advice.append({"skill": "", "how_to_address": item.strip()})

    return {
        "fit_summary": str(data.get("fit_summary", "")).strip(),
        "strengths": as_str_list(data.get("strengths")),
        "gap_advice": gap_advice,
        "resume_improvements": as_str_list(data.get("resume_improvements")),
        "next_steps": as_str_list(data.get("next_steps")),
    }


async def _openrouter_chat(
    messages: list[dict],
    temperature: float = 0.4,
    model_override: str = "",
) -> tuple[str, str]:
    """Send a chat-completion request to OpenRouter and return (reply_text, model_used).

    When ``model_override`` is non-empty it is used instead of the server
    default from config, allowing the frontend to select the model.
    If a 429 (Rate Limit) is encountered, it will automatically attempt
    to failover to a few highly available free models.

    Raises:
        LLMError: If AI is not configured, the request fails/times out, or the
            response is malformed after all retries.
    """
    settings = get_settings()
    if not settings.ai_enabled:
        raise LLMError(
            "AI features are not configured. Set OPENROUTER_API_KEY in the "
            "backend environment."
        )

    chosen_model = model_override.strip() or settings.OPENROUTER_MODEL
    
    # Fallback cascade in case of 429s. We ensure the chosen model is tried first.
    fallbacks = [
        "google/gemma-4-26b-a4b-it:free",
        "openrouter/free",
    ]
    models_to_try = [chosen_model] + [m for m in fallbacks if m != chosen_model]

    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "AI Resume Screening System",
    }

    last_error_status = 500
    
    async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
        for attempt_model in models_to_try:
            payload = {
                "model": attempt_model,
                "messages": messages,
                "temperature": temperature,
            }
            try:
                response = await client.post(url, json=payload, headers=headers)
            except httpx.TimeoutException:
                logger.warning("OpenRouter timeout for model %s", attempt_model)
                continue
            except httpx.HTTPError as exc:
                logger.warning("OpenRouter request error for %s: %s", attempt_model, exc)
                continue

            if response.status_code in (402, 429):
                logger.warning("OpenRouter %s error on %s (Rate Limited or Unpaid)", response.status_code, attempt_model)
                last_error_status = response.status_code
                continue
                
            if response.status_code != 200:
                logger.warning(
                    "OpenRouter returned %s on %s: %s", 
                    response.status_code, attempt_model, response.text[:500]
                )
                last_error_status = response.status_code
                continue

            try:
                body = response.json()
                content = body["choices"][0]["message"]["content"]
                return content, attempt_model
            except (KeyError, IndexError, ValueError):
                logger.warning("Unexpected response format from %s", attempt_model)
                continue

    # If we exhausted all fallbacks:
    if last_error_status in (402, 429):
        raise LLMError("The AI provider is currently overwhelmed or requires credits. Please wait a moment and try again.")
    raise LLMError(f"The AI provider returned an error (HTTP {last_error_status}).")


async def extract_skills_llm(text: str) -> set[str]:
    """Use an LLM to extract technical skills from ``text``.

    Best-effort extraction used to augment the regex-based skill bank. Only runs
    when AI is configured; gracefully returns an empty set on any failure.

    Args:
        text: The résumé or JD text to analyse.

    Returns:
        A set of skill names extracted by the model (lowercased, stripped).
    """
    settings = get_settings()
    if not settings.ai_enabled:
        return set()

    # Truncate to keep the request fast and cheap.
    truncated = text[: settings.LLM_MAX_INPUT_CHARS]
    messages = [
        {
            "role": "system",
            "content": (
                "You are a technical recruiter extracting skills from a document. "
                "Return ONLY a JSON array of technical skill names (programming "
                "languages, frameworks, libraries, databases, cloud platforms, "
                "tools). Be specific. Do not include soft skills or job titles."
            ),
        },
        {
            "role": "user",
            "content": f"Extract all technical skills from this text:\n\n{truncated}",
        },
    ]

    try:
        content, _ = await _openrouter_chat(messages, temperature=0.2)
        # Parse as a JSON array.
        parsed = json.loads(content.strip())
        if not isinstance(parsed, list):
            # Try extracting an array from inside a code fence or object.
            if isinstance(parsed, dict) and "skills" in parsed:
                parsed = parsed["skills"]
            else:
                return set()
        return {str(s).strip().lower() for s in parsed if str(s).strip()}
    except Exception as exc:
        # Best-effort: any failure (timeout, parse error, rate limit) just
        # returns empty rather than breaking the analysis.
        logger.debug("LLM skill extraction failed: %s", exc)
        return set()


async def generate_suggestions(
    resume_text: str,
    jd_text: str,
    match_score: float,
    matched_skills: list[str],
    missing_skills: list[str],
    model_override: str = "",
) -> dict:
    """Call OpenRouter and return normalised AI suggestions.

    Raises:
        LLMError: If AI is not configured, the request fails/times out, or the
            response can't be parsed.
    """
    settings = get_settings()
    chosen_model = model_override.strip() or settings.OPENROUTER_MODEL
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _build_user_prompt(
                resume_text,
                jd_text,
                match_score,
                matched_skills,
                missing_skills,
                settings.LLM_MAX_INPUT_CHARS,
            ),
        },
    ]
    content, final_model = await _openrouter_chat(
        messages, temperature=0.4, model_override=chosen_model
    )

    try:
        parsed = _parse_json_object(content)
    except json.JSONDecodeError as exc:
        logger.warning("Could not parse LLM JSON: %s", content[:500])
        raise LLMError("The AI response could not be parsed.") from exc

    result = _normalise(parsed)
    result["model"] = final_model
    return result
