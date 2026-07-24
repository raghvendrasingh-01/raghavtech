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
    assert result == {
        "required": [],
        "matched": [],
        "missing": [],
        "missing_ranked": [],
        "quick_wins": [],
    }


def test_missing_ranked_is_ordered_by_jd_frequency():
    # Kubernetes appears three times in the JD, GraphQL once → Kubernetes ranks
    # first. Neither is in the résumé, so both are missing.
    resume = "Python and FastAPI developer."
    jd = (
        "We need Python, FastAPI and Kubernetes. Kubernetes experience is a must; "
        "day-to-day Kubernetes operations. Some GraphQL is a plus."
    )
    result = analyze_skills(resume, jd)

    ranked = result["missing_ranked"]
    # Every entry has the expected shape.
    assert all({"skill", "jd_frequency"} == set(item) for item in ranked)
    # Sorted by descending frequency.
    freqs = [item["jd_frequency"] for item in ranked]
    assert freqs == sorted(freqs, reverse=True)
    # Kubernetes (freq 3) must precede GraphQL (freq 1).
    skills_in_order = [item["skill"] for item in ranked]
    assert skills_in_order.index("Kubernetes") < skills_in_order.index("GraphQL")
    assert next(i["jd_frequency"] for i in ranked if i["skill"] == "Kubernetes") >= 3


def test_quick_wins_are_top_three_missing():
    resume = "Python developer."
    jd = "Need Python, Kubernetes, GraphQL, Kafka, Terraform and Snowflake."
    result = analyze_skills(resume, jd)

    quick = result["quick_wins"]
    assert len(quick) <= 3
    # quick_wins mirror the head of missing_ranked.
    assert quick == [item["skill"] for item in result["missing_ranked"][:3]]
    # All quick wins are genuinely missing.
    assert set(quick) <= set(result["missing"])


def test_expanded_bank_detects_new_skills():
    found = extract_known_skills(
        "Built pipelines with dbt, Airflow and Snowflake; dashboards in Tableau."
    )
    assert {"dbt", "Airflow", "Snowflake", "Tableau"} <= found
