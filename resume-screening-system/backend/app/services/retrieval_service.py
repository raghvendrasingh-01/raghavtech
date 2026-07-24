"""Lightweight retrieval (RAG) over the résumé and job description.

For a single résumé + JD a vector database is overkill, so we do retrieval
**per request**: split the documents into chunks, embed them with the same
``all-MiniLM-L6-v2`` model already used for scoring, and return the chunks most
similar to the user's question. These excerpts are injected into the chatbot
prompt so answers stay grounded in the project's data.
"""

from __future__ import annotations

import re

from app.services.nlp_service import _st_util, encode, encode_cached


def _chunk(text: str, source: str, max_chars: int = 400) -> list[tuple[str, str]]:
    """Split ``text`` into ``(source, chunk)`` pairs of at most ~max_chars.

    Splits on blank lines first; long paragraphs are further split on sentence
    boundaries so no single chunk dominates the context window.
    """
    chunks: list[tuple[str, str]] = []
    for para in re.split(r"\n{2,}", text or ""):
        para = para.strip()
        if not para:
            continue
        if len(para) <= max_chars:
            chunks.append((source, para))
            continue
        # Break a long paragraph into sentence-grouped chunks.
        current = ""
        for sentence in re.split(r"(?<=[.!?])\s+", para):
            if current and len(current) + len(sentence) > max_chars:
                chunks.append((source, current.strip()))
                current = sentence
            else:
                current = f"{current} {sentence}".strip()
        if current.strip():
            chunks.append((source, current.strip()))
    return chunks


def retrieve_context(
    resume_text: str,
    jd_text: str,
    query: str,
    k: int = 5,
) -> list[tuple[str, str]]:
    """Return the top-``k`` résumé/JD chunks most relevant to ``query``.

    Args:
        resume_text: Extracted résumé text.
        jd_text: Job description text.
        query: The user's latest question.
        k: Maximum number of chunks to return.

    Returns:
        A list of ``(source_label, chunk_text)`` tuples, highest-relevance first.
        Empty if there is nothing to search.
    """
    chunks = _chunk(resume_text, "Résumé") + _chunk(jd_text, "Job description")
    if not chunks:
        return []
    if not query or not query.strip():
        return chunks[:k]

    chunk_embeddings = encode_cached([c[1] for c in chunks])
    query_embedding = encode([query])
    scores = _st_util().cos_sim(query_embedding, chunk_embeddings)[0]
    ranked = sorted(
        range(len(chunks)), key=lambda i: float(scores[i]), reverse=True
    )
    return [chunks[i] for i in ranked[:k]]
