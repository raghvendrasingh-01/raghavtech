"""Tests for semantic similarity scoring.

These load the real embedding model (cached after the first run), so they are
slower than the other suites but verify genuine behaviour.
"""

import pytest

from app.exceptions import EmptyTextError
from app.services.nlp_service import (
    compute_score_breakdown,
    compute_similarity,
    encode_cached,
)


def test_score_in_range_and_relative_ordering():
    resume = (
        "Senior Python engineer building REST APIs with FastAPI, Docker, "
        "PostgreSQL and AWS."
    )
    jd_match = "Python backend engineer with FastAPI, Docker, PostgreSQL, AWS."
    jd_unrelated = "Pastry chef skilled in French desserts and cake decoration."

    s_match = compute_similarity(resume, jd_match)
    s_unrelated = compute_similarity(resume, jd_unrelated)

    assert 0.0 <= s_unrelated <= 100.0
    assert 0.0 <= s_match <= 100.0
    assert s_match > s_unrelated


def test_identical_text_scores_near_100():
    text = "Python engineer with FastAPI and Docker."
    assert compute_similarity(text, text) > 99.0


def test_empty_text_raises():
    with pytest.raises(EmptyTextError):
        compute_similarity("", "some jd")
    with pytest.raises(EmptyTextError):
        compute_similarity("some resume", "")


def test_embedding_cache_returns_identical_vectors():
    # Encoding the same text twice must return byte-identical embeddings from
    # the cache (not merely close values).
    text = "Python engineer with FastAPI and Docker."
    first = encode_cached([text])[0]
    second = encode_cached([text])[0]
    # Same content → same cached tensor values.
    assert first.shape == second.shape
    assert bool((first == second).all())


def test_score_breakdown_shape_and_ranges():
    resume = (
        "Summary: Senior Python engineer.\n"
        "Experience: Built REST APIs with FastAPI, Docker and PostgreSQL at AWS.\n"
        "Skills: Python, FastAPI, Docker, PostgreSQL, AWS.\n"
        "Education: BSc Computer Science."
    )
    jd = "Python backend engineer with FastAPI, Docker, Kubernetes, PostgreSQL, AWS."
    skills = {"required": ["Python", "FastAPI", "Kubernetes"], "matched": ["Python", "FastAPI"]}

    breakdown = compute_score_breakdown(resume, jd, skills)

    assert set(breakdown) == {"semantic_similarity", "skills_coverage", "sections"}
    assert 0.0 <= breakdown["semantic_similarity"] <= 100.0
    # 2 of 3 required skills matched → ~66.67% coverage.
    assert breakdown["skills_coverage"] == pytest.approx(66.67, abs=0.5)
    assert isinstance(breakdown["sections"], list)
    for section in breakdown["sections"]:
        assert set(section) == {"section", "score"}
        assert 0.0 <= section["score"] <= 100.0

    # Inline "Heading: content" lines (the common single-column résumé layout)
    # must be detected — Experience/Skills/Education are all present here.
    labels = {s["section"] for s in breakdown["sections"]}
    assert {"Experience", "Skills", "Education"} <= labels


def test_score_breakdown_empty_inputs_return_zeros():
    result = compute_score_breakdown("", "", {"required": [], "matched": []})
    assert result == {"semantic_similarity": 0.0, "skills_coverage": 0.0, "sections": []}
