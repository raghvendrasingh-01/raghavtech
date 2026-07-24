"""Semantic similarity scoring using sentence-transformers.

Loads a lightweight sentence-embedding model (``all-MiniLM-L6-v2`` by default)
and computes the cosine similarity between a résumé and a job description.

The model is loaded **lazily** via a module-level singleton: the first call to
:func:`get_model` pays the (one-time) load cost, and every subsequent call —
including across many API requests — reuses the same in-memory instance.
"""

from __future__ import annotations

import re
import threading
from functools import lru_cache

# sentence_transformers is imported lazily inside helpers to speed up app boot
# and prevent startup timeout crashes on resource-constrained platforms.

from app.config import get_settings
from app.exceptions import EmptyTextError

# A lock guards the first concurrent load so two requests racing on a cold
# start don't each construct the (expensive) model.
_model_lock = threading.Lock()

# Common résumé section headings used to split text for section-aware scoring.
# Matched case-insensitively at the start of a line.
_SECTION_HEADINGS: dict[str, tuple[str, ...]] = {
    "Summary": ("summary", "objective", "profile", "about"),
    "Experience": ("experience", "work experience", "employment", "professional experience"),
    "Skills": ("skills", "technical skills", "technologies", "core competencies"),
    "Education": ("education", "academic"),
    "Projects": ("projects", "personal projects", "side projects"),
}


@lru_cache(maxsize=1)
def _load_model(model_name: str) -> "SentenceTransformer":  # noqa: F821
    """Construct and cache the SentenceTransformer for ``model_name``."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


def _st_util():
    """Return the ``sentence_transformers.util`` module (deferred import).

    Centralises the lazy import so every caller (scoring, retrieval) resolves it
    the same way rather than each re-importing inline.
    """
    from sentence_transformers import util

    return util


def get_model() -> "SentenceTransformer":  # noqa: F821
    """Return the shared, lazily-loaded embedding model singleton."""
    settings = get_settings()
    with _model_lock:
        return _load_model(settings.EMBEDDING_MODEL)


def encode(texts: list[str]):
    """Encode ``texts`` into normalised embedding tensors.

    Thin wrapper over the model so callers don't repeat the encode kwargs.
    """
    model = get_model()
    return model.encode(
        texts,
        convert_to_tensor=True,
        normalize_embeddings=True,
    )


@lru_cache(maxsize=256)
def _encode_one_cached(text: str):
    """Encode and cache a single text's embedding (keyed by exact content).

    The chatbot re-embeds the same résumé/JD chunks on every turn; caching by
    content string avoids recomputing identical embeddings within a session.
    """
    return encode([text])[0]


def encode_cached(texts: list[str]):
    """Encode a list of texts, reusing cached per-text embeddings where possible.

    Returns a stacked tensor in the same order as ``texts``. Falls back to a
    plain (uncached) batch encode if stacking is unavailable for any reason.
    """
    if not texts:
        return encode([])
    try:
        import torch

        return torch.stack([_encode_one_cached(t) for t in texts])
    except Exception:
        # Any issue (e.g. torch quirk) → correctness-preserving batch encode.
        return encode(texts)


def _cosine_pct(vec_a, vec_b) -> float:
    """Cosine similarity of two vectors, clamped to a 0–100 percentage."""
    cosine = _st_util().cos_sim(vec_a, vec_b).item()
    return round(max(0.0, min(1.0, cosine)) * 100.0, 2)


def compute_similarity(resume_text: str, jd_text: str) -> float:
    """Compute a semantic match score between résumé and job description.

    Both texts are embedded into the same vector space and compared with cosine
    similarity. The raw cosine value lies in ``[-1, 1]``; we clamp it to
    ``[0, 1]`` (negative similarity is meaningless here) and scale to a
    percentage rounded to two decimals.

    Args:
        resume_text: Plain text extracted from the résumé.
        jd_text: Plain text of the job description.

    Returns:
        A match score in the range ``0.0``–``100.0``.

    Raises:
        EmptyTextError: If either text is blank.
    """
    if not resume_text or not resume_text.strip():
        raise EmptyTextError("Résumé text is empty.")
    if not jd_text or not jd_text.strip():
        raise EmptyTextError("Job description text is empty.")

    embeddings = encode([resume_text, jd_text])
    return _cosine_pct(embeddings[0], embeddings[1])


def _split_sections(resume_text: str) -> dict[str, str]:
    """Split résumé text into labelled sections by common headings.

    Returns a mapping of ``section_label -> text``. Text before the first
    recognised heading is ignored for section scoring (it is already captured by
    the whole-document similarity). Sections with no detected heading are simply
    absent from the result.
    """
    # Build a lookup from lowercased heading alias -> canonical section label.
    alias_to_label: dict[str, str] = {}
    for label, aliases in _SECTION_HEADINGS.items():
        for alias in aliases:
            alias_to_label[alias] = label

    sections: dict[str, list[str]] = {}
    current: str | None = None
    for raw_line in resume_text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue

        # Case 1 — a standalone heading line: the whole (short) line matches an
        # alias, optionally trailed by a colon, e.g. "Experience" or "SKILLS:".
        key = re.sub(r"[:\s]+$", "", line).lower()
        if key in alias_to_label and len(line) <= 40:
            current = alias_to_label[key]
            sections.setdefault(current, [])
            continue

        # Case 2 — an inline heading: "Experience: Built REST APIs ...". Match a
        # leading alias followed by a colon and capture the remainder as the
        # first line of that section (common in single-column PDF résumés).
        head, sep, rest = line.partition(":")
        if sep and head.strip().lower() in alias_to_label:
            current = alias_to_label[head.strip().lower()]
            sections.setdefault(current, [])
            if rest.strip():
                sections[current].append(rest.strip())
            continue

        if current is not None:
            sections[current].append(line)

    return {label: "\n".join(lines) for label, lines in sections.items() if lines}


def compute_score_breakdown(
    resume_text: str,
    jd_text: str,
    skills: dict,
) -> dict:
    """Return a component breakdown behind the headline match score.

    Args:
        resume_text: Plain text extracted from the résumé.
        jd_text: Plain text of the job description.
        skills: The dict returned by ``analyze_skills`` (uses required/matched).

    Returns:
        A dict shaped like the ``ScoreBreakdown`` schema::

            {
                "semantic_similarity": float,   # whole-doc cosine (0–100)
                "skills_coverage": float,       # matched/required * 100
                "sections": [{"section": str, "score": float}, ...],
            }

    Never raises for empty inputs — returns zeros so ``/analyze`` stays robust.
    """
    if not resume_text.strip() or not jd_text.strip():
        return {"semantic_similarity": 0.0, "skills_coverage": 0.0, "sections": []}

    # Overall semantic similarity (same basis as match_score).
    jd_embedding = encode([jd_text])[0]
    resume_embedding = encode([resume_text])[0]
    semantic = _cosine_pct(resume_embedding, jd_embedding)

    # Skills coverage from the already-computed skill analysis.
    required = skills.get("required") or []
    matched = skills.get("matched") or []
    coverage = round(100.0 * len(matched) / len(required), 2) if required else 0.0

    # Per-section similarity against the JD.
    section_scores: list[dict] = []
    for label, text in _split_sections(resume_text).items():
        section_scores.append(
            {"section": label, "score": _cosine_pct(encode([text])[0], jd_embedding)}
        )

    return {
        "semantic_similarity": semantic,
        "skills_coverage": coverage,
        "sections": section_scores,
    }
