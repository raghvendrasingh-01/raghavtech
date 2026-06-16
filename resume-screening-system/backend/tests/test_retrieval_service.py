"""Tests for the retrieval (RAG) service."""

from app.services.retrieval_service import _chunk, retrieve_context


def test_chunk_splits_and_labels():
    text = "First paragraph here.\n\nSecond paragraph here."
    chunks = _chunk(text, "Résumé")
    assert all(src == "Résumé" for src, _ in chunks)
    assert len(chunks) == 2


def test_chunk_breaks_long_paragraph():
    long_para = " ".join(f"Sentence number {i}." for i in range(60))
    chunks = _chunk(long_para, "JD", max_chars=200)
    assert len(chunks) > 1
    assert all(len(text) <= 260 for _, text in chunks)  # ~max_chars + slack


def test_retrieve_ranks_relevant_chunk_first():
    resume = (
        "Built scalable REST APIs with FastAPI and Python.\n\n"
        "Managed Kubernetes clusters and Docker deployments on AWS.\n\n"
        "Designed PostgreSQL schemas and tuned slow queries."
    )
    jd = "We need someone strong with databases."
    top = retrieve_context(resume, jd, "Tell me about database experience", k=2)
    assert top, "expected at least one chunk"
    # The most relevant chunk for a DB question should be database-related
    # (either the JD 'databases' line or the résumé PostgreSQL line) — and
    # definitely not the unrelated Kubernetes/Docker chunk.
    top_text = top[0][1].lower()
    assert any(term in top_text for term in ("database", "postgresql", "queries"))
    assert "kubernetes" not in top_text


def test_retrieve_empty_inputs():
    assert retrieve_context("", "", "anything") == []
