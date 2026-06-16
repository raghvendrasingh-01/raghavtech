import { useState } from "react";
import "./App.css";
import { analyzeResume, getSuggestions, sendChatMessage } from "./api";
import FileDropzone from "./components/FileDropzone";
import ScoreBar from "./components/ScoreBar";
import SkillList from "./components/SkillList";
import AiSuggestions from "./components/AiSuggestions";
import ChatBox from "./components/ChatBox";

const CHAT_GREETING = {
  role: "assistant",
  content:
    "Hi! Ask me anything. I also have your résumé, this job, and your match " +
    "results on hand, so I can give tailored advice when you need it.",
};

/**
 * Top-level application.
 *
 * Holds the form state (résumé file + job description), submits to the backend
 * `/analyze` endpoint, and renders the match score and skill-gap analysis.
 */
export default function App() {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // AI suggestions state (loaded after a successful analysis).
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");

  // Chatbot state.
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const canSubmit = file && jobDescription.trim().length > 0 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Please upload a résumé PDF.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste a job description.");
      return;
    }

    setLoading(true);
    setSuggestions(null);
    setSuggestError("");
    setChatMessages([]);
    setChatError("");
    try {
      const data = await analyzeResume(file, jobDescription);
      setResult(data);
      setChatMessages([CHAT_GREETING]);
      // Kick off AI suggestions in the background — the score renders right
      // away while these load.
      fetchSuggestions(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (analysis) => {
    setSuggestLoading(true);
    setSuggestError("");
    try {
      const s = await getSuggestions(analysis, jobDescription);
      setSuggestions(s);
    } catch (err) {
      setSuggestError(err.message || "Could not load AI suggestions.");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSendChat = async (text) => {
    if (!result) return;
    const history = [...chatMessages, { role: "user", content: text }];
    setChatMessages(history);
    setChatError("");
    setChatLoading(true);
    try {
      const reply = await sendChatMessage(history, result, jobDescription);
      setChatMessages([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatError(err.message || "Could not get a reply.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileError("");
    setJobDescription("");
    setResult(null);
    setError("");
    setSuggestions(null);
    setSuggestError("");
    setChatMessages([]);
    setChatError("");
  };

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__badge eyebrow">
          <span className="app__badge-dot" aria-hidden />
          Semantic résumé intelligence
        </span>
        <h1 className="app__title">
          <span className="app__title-grad">Resume</span> Screening System
        </h1>
        <p className="app__subtitle">
          Upload a résumé and paste a job description to get a semantic match
          score, a skill-gap breakdown, and AI-powered career guidance.
        </p>
      </header>

      <main className="layout">
        {/* ---- Input form ---- */}
        <section className="card form-card">
          <form onSubmit={handleSubmit} className="form">
            <span className="form__label" id="resume-label">
              Résumé (PDF)
            </span>
            <FileDropzone
              file={file}
              onFileSelected={setFile}
              onError={setFileError}
              error={fileError}
              disabled={loading}
              labelledBy="resume-label"
            />

            <label className="form__label" htmlFor="jd">
              Job description
            </label>
            <textarea
              id="jd"
              className="textarea"
              placeholder="Paste the job description here…"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              disabled={loading}
            />

            <div className="form__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!canSubmit}
              >
                {loading ? (
                  <>
                    <span className="btn__spinner" aria-hidden />
                    Analyzing…
                  </>
                ) : (
                  "Analyze résumé"
                )}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleReset}
                disabled={loading}
              >
                Reset
              </button>
            </div>

            {error && <p className="alert alert--error">{error}</p>}
          </form>
        </section>

        {/* ---- Results ---- */}
        <section className="card card--results">
          {loading && (
            <div className="placeholder">
              <div className="spinner" aria-hidden />
              <p>Analyzing your résumé…</p>
              <span className="placeholder__sub">
                Computing semantic similarity and skill coverage
              </span>
            </div>
          )}

          {!loading && !result && (
            <div className="placeholder placeholder--muted">
              <span className="placeholder__icon" aria-hidden>
                ◎
              </span>
              <p>Your results will appear here</p>
              <span className="placeholder__sub">
                Add a résumé and a job description, then analyze
              </span>
            </div>
          )}

          {!loading && result && (
            <div className="results">
              <ScoreBar score={result.match_score} />

              <div className="results__skills">
                <SkillList
                  title="Matched skills"
                  skills={result.skills.matched}
                  variant="matched"
                  emptyText="No required skills were found in the résumé."
                />
                <SkillList
                  title="Missing skills"
                  skills={result.skills.missing}
                  variant="missing"
                  emptyText="Great — no missing skills! 🎉"
                />
                <SkillList
                  title="All JD skills detected"
                  skills={result.skills.required}
                  variant="neutral"
                  emptyText="No known skills detected in the job description."
                />
              </div>

              <p className="results__meta">
                Parsed <strong className="tnum">{result.resume_char_count}</strong>{" "}
                characters
                {result.filename ? ` from "${result.filename}"` : ""}.
              </p>
            </div>
          )}
        </section>
      </main>

      {result && (
        <div className="stack">
          <AiSuggestions
            loading={suggestLoading}
            error={suggestError}
            suggestions={suggestions}
          />

          <ChatBox
            messages={chatMessages}
            onSend={handleSendChat}
            loading={chatLoading}
            error={chatError}
          />
        </div>
      )}

      <footer className="app__footer">
        <span className="app__footer-line" aria-hidden />
        Built with FastAPI · sentence-transformers · React + Vite
      </footer>
    </div>
  );
}
