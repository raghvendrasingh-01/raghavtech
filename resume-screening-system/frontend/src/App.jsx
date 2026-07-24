import { useEffect, useState } from "react";
import "./App.css";
import {
  analyzeResume,
  getSuggestions,
  sendChatMessage,
  getModels,
} from "./api";
import { downloadReport } from "./report";
import { MODEL_STORAGE_KEY } from "./constants";
import FileDropzone from "./components/FileDropzone";
import ModelSelector from "./components/ModelSelector";
import ScoreBar from "./components/ScoreBar";
import ScoreBreakdown from "./components/ScoreBreakdown";
import SkillList from "./components/SkillList";
import AiSuggestions from "./components/AiSuggestions";
import ChatBox from "./components/ChatBox";

const CHAT_GREETING = {
  role: "assistant",
  content:
    "Hi! Ask me anything. I also have your résumé, this job, and your match " +
    "results on hand, so I can give tailored advice when you need it.",
};

// Truthful staged-loading labels shown while the single /analyze call runs.
// These describe the real server-side pipeline (parse → embed → skills →
// breakdown); they advance on a gentle timer, with NO fabricated percentages.
const ANALYZE_STAGES = [
  "Reading your résumé",
  "Analyzing the job description",
  "Computing semantic match",
  "Identifying skills",
  "Preparing your results",
];

/**
 * Build contextual chat starter prompts from an analysis result.
 *
 * Chips adapt to the score band and the top missing skills so the suggestions
 * are relevant to the specific résumé/JD rather than generic.
 *
 * @param {object|null} analysis  The AnalyzeResponse (or null before analysis).
 * @returns {string[]} Up to three starter prompts.
 */
function buildChatSuggestions(analysis) {
  if (!analysis) return [];
  const chips = [];
  const score = Number(analysis.match_score) || 0;
  const quickWins = analysis.skills?.quick_wins ?? [];
  const missing = analysis.skills?.missing ?? [];

  const topSkill = quickWins[0] ?? missing[0];
  if (topSkill) {
    chips.push(`How do I gain and show ${topSkill} experience?`);
  }
  if (score < 50) {
    chips.push("Why is my match score low, and how do I raise it?");
  } else if (score < 75) {
    chips.push("What would push this résumé to a strong match?");
  } else {
    chips.push("My score is strong — how do I stand out further?");
  }
  if (missing.length > 0) {
    chips.push("How should I rewrite my résumé to cover the missing skills?");
  } else {
    chips.push("What interview questions should I prepare for?");
  }
  chips.push("How do I optimize this résumé for ATS?");

  // De-duplicate and cap at three.
  return [...new Set(chips)].slice(0, 3);
}

/**
 * Staged loading indicator for the /analyze call.
 *
 * The backend does not stream progress, so rather than fake a percentage we
 * surface the real pipeline stages as honest labels that advance on a timer.
 * Under `prefers-reduced-motion` the timer is skipped and the full checklist is
 * shown at once (all "in progress") — still truthful, just static.
 */
function AnalyzeStages() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    // Advance through stages but hold on the last one until the response lands
    // (the parent unmounts this component when loading finishes).
    const id = setInterval(() => {
      setActive((i) => Math.min(ANALYZE_STAGES.length - 1, i + 1));
    }, 1100);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <ul className="analyze-stages" aria-label="Analysis progress">
      {ANALYZE_STAGES.map((label, i) => {
        const done = !reduced && i < active;
        const current = reduced || i === active;
        const state = done ? "done" : current ? "current" : "pending";
        return (
          <li
            key={label}
            className={`analyze-stages__item analyze-stages__item--${state}`}
          >
            <span className="analyze-stages__dot" aria-hidden />
            <span className="analyze-stages__label">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

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

  // AI model selection.
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem(MODEL_STORAGE_KEY) || ""
  );
  // Non-error notice shown when the backend fell back to a different model than
  // the one requested (e.g. the pick was rate-limited).
  const [modelFallbackMsg, setModelFallbackMsg] = useState("");

  // Load the curated model list once on mount and reconcile the saved choice.
  useEffect(() => {
    let cancelled = false;
    getModels().then(({ models, default: def }) => {
      if (cancelled) return;
      setAvailableModels(models);
      const ids = models.map((m) => m.id);
      setSelectedModel((prev) =>
        prev && ids.includes(prev) ? prev : def || ids[0] || ""
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleModelSelect = (id) => {
    setSelectedModel(id);
    localStorage.setItem(MODEL_STORAGE_KEY, id);
    setModelFallbackMsg("");
  };

  // Given the model the backend reports it actually used, surface a gentle
  // notice if it differs from what the user picked. Names are looked up from
  // the model list so we show friendly labels, not raw ids.
  const noteFallback = (usedId) => {
    if (!usedId || !selectedModel || usedId === selectedModel) return;
    const nameOf = (id) =>
      availableModels.find((m) => m.id === id)?.name || id;
    setModelFallbackMsg(
      `${nameOf(selectedModel)} was busy, so ${nameOf(
        usedId
      )} answered instead.`
    );
  };

  const canSubmit = file && jobDescription.trim().length > 0 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Please upload a résumé (PDF or DOCX).");
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
      const s = await getSuggestions(analysis, jobDescription, selectedModel);
      setSuggestions(s);
      noteFallback(s?.model);
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
      const { reply, model } = await sendChatMessage(
        history,
        result,
        jobDescription,
        selectedModel
      );
      setChatMessages([...history, { role: "assistant", content: reply }]);
      noteFallback(model);
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
    setModelFallbackMsg("");
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
              <span className="form__step" aria-hidden>
                1
              </span>
              Résumé (PDF or DOCX)
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
              <span className="form__step" aria-hidden>
                2
              </span>
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

            <span className="form__label" id="model-label">
              <span className="form__step" aria-hidden>
                3
              </span>
              AI model
            </span>
            {availableModels.length > 0 ? (
              <ModelSelector
                models={availableModels}
                selectedId={selectedModel}
                onSelect={handleModelSelect}
                disabled={loading}
              />
            ) : (
              <p className="form__model-placeholder">
                Loading AI models… (ensure the backend is running)
              </p>
            )}

            <div className="form__actions">
              <button
                type="submit"
                className="btn btn--primary btn--cta"
                disabled={!canSubmit}
              >
                {loading ? (
                  <>
                    <span className="btn__spinner" aria-hidden />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <span className="btn__step" aria-hidden>
                      4
                    </span>
                    Analyze résumé
                  </>
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
        <section
          className="card card--results"
          onMouseMove={(e) => {
            // Feed the CSS cursor-glow layer. Cheap: two custom-prop writes,
            // no React re-render. Disabled surfaces (touch/reduced-motion) just
            // ignore the values via media queries.
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              "--mx",
              `${((e.clientX - r.left) / r.width) * 100}%`
            );
            e.currentTarget.style.setProperty(
              "--my",
              `${((e.clientY - r.top) / r.height) * 100}%`
            );
          }}
        >
          {loading && (
            <div className="placeholder placeholder--loading">
              <div className="spinner" aria-hidden />
              <p>Analyzing your résumé…</p>
              <AnalyzeStages />
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

              {result.score_breakdown && (
                <ScoreBreakdown breakdown={result.score_breakdown} />
              )}

              {result.skills.quick_wins?.length > 0 && (
                <div className="quick-wins">
                  <h3 className="quick-wins__title">
                    <span aria-hidden>⚡</span> Quick wins
                  </h3>
                  <p className="quick-wins__hint">
                    Highest-impact skills to add — most frequent in the job
                    description.
                  </p>
                  <ul className="quick-wins__list">
                    {result.skills.quick_wins.map((skill, i) => (
                      <li key={skill} className="quick-wins__item">
                        <span className="quick-wins__rank">#{i + 1}</span>
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

              <div className="results__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    downloadReport(result, jobDescription, suggestions)
                  }
                >
                  ⬇ Export report (JSON)
                </button>
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
          {modelFallbackMsg && (
            <p className="model-fallback-notice" role="status">
              <span aria-hidden>↻</span> {modelFallbackMsg}
            </p>
          )}

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
            suggestions={buildChatSuggestions(result)}
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
