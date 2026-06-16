"""Tests for skill extraction and gap analysis."""

from app.services.skill_service import analyze_skills, extract_known_skills


def test_extract_known_skills_basic():
    found = extract_known_skills("Python, FastAPI and Docker expertise.")
    assert {"Python", "FastAPI", "Docker"} <= found


def test_node_js_does_not_leak_javascript():
    # "js" inside "node.js" must NOT be detected as JavaScript.
    found = extract_known_skills("Backend with Node.js and Express.")
    assert "Node.js" in found
    assert "JavaScript" not in found


def test_real_js_ts_still_detected():
    found = extract_known_skills("Strong in JS and TS, plus React.")
    assert {"JavaScript", "TypeScript", "React"} <= found


def test_symbol_heavy_tokens():
    found = extract_known_skills("Knows C++, C# and .NET.")
    assert {"C++", "C#", ".NET"} <= found


def test_gap_analysis_partition():
    resume = "Python, FastAPI, Docker, PostgreSQL, AWS, React, TypeScript, CI/CD."
    jd = "Python, FastAPI, Docker, Kubernetes, PostgreSQL, AWS, GraphQL, Kafka."
    result = analyze_skills(resume, jd)

    required = set(result["required"])
    matched = set(result["matched"])
    missing = set(result["missing"])

    # matched and missing partition the required set.
    assert matched | missing == required
    assert matched.isdisjoint(missing)
    assert {"Kubernetes", "GraphQL", "Kafka"} <= missing
    assert {"Python", "FastAPI", "Docker", "PostgreSQL", "AWS"} <= matched


def test_ambiguous_bare_words_are_not_false_positives():
    # Common English words that used to collide with bare aliases must NOT be
    # detected as skills (go, r, ml, node, spring, rest).
    text = (
        "I will go to the spring festival, take a rest, and meet R. at the "
        "node in the network. The ml of liquid was measured."
    )
    found = extract_known_skills(text)
    for noise in {"Go", "R", "Machine Learning", "Node.js", "Spring", "REST"}:
        assert noise not in found, f"false positive: {noise} in {found}"


def test_contextual_aliases_still_match():
    found = extract_known_skills(
        "Experience with Golang, R programming, Spring Boot and REST APIs."
    )
    assert {"Go", "R", "Spring", "REST"} <= found


def test_empty_inputs():
    result = analyze_skills("", "")
    assert result == {"required": [], "matched": [], "missing": []}
