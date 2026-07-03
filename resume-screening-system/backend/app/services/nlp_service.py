"""Semantic similarity scoring using sentence-transformers.

Loads a lightweight sentence-embedding model (``all-MiniLM-L6-v2`` by default)
and computes the cosine similarity between a résumé and a job description.

The model is loaded **lazily** via a module-level singleton: the first call to
:func:`get_model` pays the (one-time) load cost, and every subsequent call —
including across many API requests — reuses the same in-memory instance.
"""

from __future__ import annotations

import threading
from functools import lru_cache

# sentence_transformers is imported lazily inside functions to speed up app boot
# and prevent startup timeout crashes on resource-constrained platforms.

from app.config import get_settings
from app.exceptions import EmptyTextError

# A lock guards the first concurrent load so two requests racing on a cold
# start don't each construct the (expensive) model.
_model_lock = threading.Lock()


@lru_cache(maxsize=1)
def _load_model(model_name: str) -> SentenceTransformer:
    """Construct and cache the SentenceTransformer for ``model_name``."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(model_name)


def get_model() -> SentenceTransformer:
    """Return the shared, lazily-loaded embedding model singleton."""
    settings = get_settings()
    with _model_lock:
        return _load_model(settings.EMBEDDING_MODEL)


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

    model = get_model()
    # ``convert_to_tensor`` keeps the embeddings on-device for a fast cosine op.
    embeddings = model.encode(
        [resume_text, jd_text],
        convert_to_tensor=True,
        normalize_embeddings=True,
    )
    from sentence_transformers import util
    cosine = util.cos_sim(embeddings[0], embeddings[1]).item()

    # Clamp negatives to zero, then express as a 0–100 percentage.
    score = max(0.0, min(1.0, cosine)) * 100.0
    return round(score, 2)
