"""Tests for semantic similarity scoring.

These load the real embedding model (cached after the first run), so they are
slower than the other suites but verify genuine behaviour.
"""

import pytest

from app.exceptions import EmptyTextError
from app.services.nlp_service import compute_similarity


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
