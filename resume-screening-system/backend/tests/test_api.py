"""Integration tests for the FastAPI endpoints via TestClient."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "resume-screening"


def test_root():
    res = client.get("/")
    assert res.status_code == 200
    assert "service" in res.json()


def test_analyze_happy_path(sample_resume_pdf, sample_jd):
    res = client.post(
        "/analyze",
        files={"resume": ("resume.pdf", sample_resume_pdf, "application/pdf")},
        data={"job_description": sample_jd},
    )
    assert res.status_code == 200
    body = res.json()
    assert 0.0 <= body["match_score"] <= 100.0
    skills = body["skills"]
    # Skills required by the JD but absent from the résumé.
    assert {"Kubernetes", "GraphQL", "Kafka"} <= set(skills["missing"])
    assert {"Python", "FastAPI", "Docker"} <= set(skills["matched"])
    assert body["filename"] == "resume.pdf"


def test_analyze_empty_jd_returns_400(sample_resume_pdf):
    res = client.post(
        "/analyze",
        files={"resume": ("resume.pdf", sample_resume_pdf, "application/pdf")},
        data={"job_description": "   "},
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_analyze_non_pdf_returns_400(sample_jd):
    res = client.post(
        "/analyze",
        files={"resume": ("notes.pdf", b"just plain text", "application/pdf")},
        data={"job_description": sample_jd},
    )
    assert res.status_code == 400
    assert "pdf" in res.json()["detail"].lower()


def test_analyze_missing_file_returns_422(sample_jd):
    res = client.post("/analyze", data={"job_description": sample_jd})
    assert res.status_code == 422


# --- /suggest (AI suggestions) ---


def test_suggest_empty_inputs_returns_400():
    res = client.post("/suggest", json={"resume_text": "", "job_description": ""})
    assert res.status_code == 400


def test_suggest_disabled_returns_503(monkeypatch):
    import app.routes as routes

    monkeypatch.setattr(routes.settings, "OPENROUTER_API_KEY", "")
    res = client.post(
        "/suggest",
        json={"resume_text": "Python dev", "job_description": "Python role"},
    )
    assert res.status_code == 503


def test_suggest_happy_path_mocked(monkeypatch):
    import app.routes as routes

    # Ensure the AI-enabled gate passes without depending on the real env.
    monkeypatch.setattr(routes.settings, "OPENROUTER_API_KEY", "test-key")

    async def fake_generate(**kwargs):
        return {
            "fit_summary": "Strong fit overall.",
            "strengths": ["Python", "APIs"],
            "gap_advice": [{"skill": "Kafka", "how_to_address": "Take a course."}],
            "resume_improvements": ["Quantify impact."],
            "next_steps": ["Apply now."],
            "model": "test-model",
        }

    monkeypatch.setattr(routes, "generate_suggestions", fake_generate)

    res = client.post(
        "/suggest",
        json={
            "resume_text": "Python developer with FastAPI experience.",
            "job_description": "Python backend role needing Kafka.",
            "match_score": 70.0,
            "matched_skills": ["Python"],
            "missing_skills": ["Kafka"],
        },
    )
    assert res.status_code == 200
    s = res.json()["suggestions"]
    assert s["fit_summary"] == "Strong fit overall."
    assert s["gap_advice"][0]["skill"] == "Kafka"
    assert s["model"] == "test-model"


def test_suggest_provider_failure_returns_502(monkeypatch):
    import app.routes as routes
    from app.exceptions import LLMError

    monkeypatch.setattr(routes.settings, "OPENROUTER_API_KEY", "test-key")

    async def boom(**kwargs):
        raise LLMError("provider down")

    monkeypatch.setattr(routes, "generate_suggestions", boom)

    res = client.post(
        "/suggest",
        json={"resume_text": "x", "job_description": "y"},
    )
    assert res.status_code == 502
    assert "provider down" in res.json()["detail"]


# --- /chat (scoped chatbot) ---


def test_chat_empty_messages_returns_400():
    res = client.post("/chat", json={"messages": []})
    assert res.status_code == 400


def test_chat_last_must_be_user_returns_400():
    res = client.post(
        "/chat",
        json={"messages": [{"role": "assistant", "content": "hi"}]},
    )
    assert res.status_code == 400


def test_chat_disabled_returns_503(monkeypatch):
    import app.routes as routes

    monkeypatch.setattr(routes.settings, "OPENROUTER_API_KEY", "")
    res = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "How do I improve?"}]},
    )
    assert res.status_code == 503


def test_chat_happy_path_mocked(monkeypatch):
    import app.routes as routes

    monkeypatch.setattr(routes.settings, "OPENROUTER_API_KEY", "test-key")

    captured = {}

    async def fake_reply(
        *,
        messages,
        match_score,
        matched_skills,
        missing_skills,
        snippets,
        model_override=None,
    ):
        captured["messages"] = messages
        captured["missing"] = missing_skills
        # The route now returns (reply, final_model); mirror that shape.
        return "Focus on learning Kubernetes for this role.", "openai/gpt-4o-mini"

    # Avoid loading the embedding model in tests by stubbing retrieval too.
    monkeypatch.setattr(routes, "generate_chat_reply", fake_reply)
    monkeypatch.setattr(routes, "retrieve_context", lambda *a, **k: [("Résumé", "FastAPI dev")])

    res = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "What skills am I missing?"},
            ],
            "resume_text": "Python developer.",
            "job_description": "Need Kubernetes.",
            "match_score": 60.0,
            "matched_skills": ["Python"],
            "missing_skills": ["Kubernetes"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert "Kubernetes" in body["reply"]
    assert captured["missing"] == ["Kubernetes"]
    assert captured["messages"][-1]["content"] == "What skills am I missing?"
