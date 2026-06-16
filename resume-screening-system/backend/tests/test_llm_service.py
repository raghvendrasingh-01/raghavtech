"""Unit tests for the LLM service's pure helpers (no network)."""

import pytest

from app.services.llm_service import _normalise, _parse_json_object


def test_parse_plain_json():
    assert _parse_json_object('{"a": 1}') == {"a": 1}


def test_parse_json_with_code_fence():
    content = '```json\n{"fit_summary": "ok", "strengths": ["x"]}\n```'
    assert _parse_json_object(content) == {"fit_summary": "ok", "strengths": ["x"]}


def test_parse_json_with_surrounding_prose():
    content = 'Here is your result:\n{"a": [1, 2]}\nHope that helps!'
    assert _parse_json_object(content) == {"a": [1, 2]}


def test_parse_invalid_raises():
    with pytest.raises(ValueError):
        _parse_json_object("not json at all")


def test_normalise_fills_defaults_and_coerces():
    out = _normalise({"fit_summary": "good"})
    assert out["fit_summary"] == "good"
    assert out["strengths"] == []
    assert out["gap_advice"] == []
    assert out["resume_improvements"] == []
    assert out["next_steps"] == []


def test_normalise_gap_advice_shapes():
    out = _normalise(
        {
            "gap_advice": [
                {"skill": "Kafka", "how_to_address": "learn it"},
                "just a string tip",
                {"skill": "", "how_to_address": ""},  # dropped (empty)
            ],
            "strengths": "single becomes list",
        }
    )
    assert out["gap_advice"][0] == {"skill": "Kafka", "how_to_address": "learn it"}
    assert out["gap_advice"][1] == {"skill": "", "how_to_address": "just a string tip"}
    assert len(out["gap_advice"]) == 2
    assert out["strengths"] == ["single becomes list"]
