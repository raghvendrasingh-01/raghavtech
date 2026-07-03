import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StarsCanvas } from "../components/canvas";
import "./ResumeScreener.css";

const API_BASE_URL: string = (
  (import.meta.env.VITE_RESUME_API_URL as string | undefined) ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

interface SkillReport {
  required: string[];
  matched: string[];
  missing: string[];
}

interface AnalyzeResponse {
  match_score: number;
  skills: SkillReport;
  resume_char_count: number;
  resume_text?: string;
  filename: string | null;
}

interface GapAdvice {
  skill: string;
  how_to_address: string;
}

interface Suggestions {
  fit_summary: string;
  strengths: string[];
  gap_advice: GapAdvice[];
  resume_improvements: string[];
  next_steps: string[];
  model?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! Ask me anything. I also have your résumé, this job, and your match " +
    "results on hand, so I can give tailored advice when you need it.",
};

const CHAT_PROMPTS = [
  "How can I improve my résumé for this role?",
  "What interview questions should I prepare for?",
  "How do I optimize for ATS?",
];

// --- Sub-components for Scoped Resume Screener ---

// 1. FileDropzone Component
interface FileDropzoneProps {
  file: File | null;
  onFileSelected: (f: File | null) => void;
  onError: (msg: string) => void;
  error: string;
  disabled: boolean;
  labelledBy: string;
}

const FileDropzone = ({
  file,
  onFileSelected,
  onError,
  error,
  disabled,
  labelledBy,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSelect = (candidate: File | undefined | null) => {
    if (!candidate) return;
    const isPdf =
      candidate.type === "application/pdf" ||
      candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      onError("Please choose a PDF file.");
      onFileSelected(null);
      return;
    }
    onError("");
    onFileSelected(candidate);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    validateAndSelect(e.dataTransfer.files?.[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    validateAndSelect(e.target.files?.[0]);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  return (
    <div className="dropzone-wrap">
      <div
        className={
          "dropzone" +
          (isDragging ? " dropzone--active" : "") +
          (disabled ? " dropzone--disabled" : "") +
          (file ? " dropzone--has-file" : "")
        }
        role="button"
        tabIndex={0}
        aria-label={labelledBy ? undefined : "Upload résumé PDF"}
        aria-labelledby={labelledBy}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="dropzone__input"
          onChange={handleChange}
          disabled={disabled}
          hidden
        />
        {file ? (
          <div className="dropzone__file">
            <span className="dropzone__file-chip" aria-hidden>
              📄
            </span>
            <div>
              <div className="dropzone__filename">{file.name}</div>
              <div className="dropzone__hint">
                {(file.size / 1024).toFixed(0)} KB · click to replace
              </div>
            </div>
          </div>
        ) : (
          <div className="dropzone__empty">
            <span className="dropzone__icon" aria-hidden>
              ⬆
            </span>
            <p className="dropzone__title">
              Drag &amp; drop your résumé PDF here
            </p>
            <p className="dropzone__hint">or click to browse</p>
          </div>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};

// 2. ScoreBar Component
const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface ScoreBarProps {
  score: number;
}

const ScoreBar = ({ score }: ScoreBarProps) => {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));

  const band =
    clamped >= 75
      ? "var(--matched)"
      : clamped >= 50
      ? "var(--moderate)"
      : "var(--missing)";
  const label =
    clamped >= 75
      ? "Strong match"
      : clamped >= 50
      ? "Moderate match"
      : "Weak match";

  const [pct, setPct] = useState(REDUCED_MOTION ? clamped : 0);
  const [display, setDisplay] = useState(REDUCED_MOTION ? clamped : 0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const rectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPct(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  useEffect(() => {
    if (REDUCED_MOTION) {
      const raf = requestAnimationFrame(() => setDisplay(clamped));
      return () => cancelAnimationFrame(raf);
    }
    const duration = 1050;
    let start: number | null = null;
    let frame: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(clamped * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else setDisplay(clamped);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (REDUCED_MOTION) return;
    const r = rectRef.current ?? e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({
      rx: -py * 6,
      ry: px * 8,
      mx: (px + 0.5) * 100,
      my: (py + 0.5) * 100,
    });
  };
  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    rectRef.current = e.currentTarget.getBoundingClientRect();
  };
  const handleLeave = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });

  return (
    <div className="score">
      <span className="eyebrow score__eyebrow">Match score</span>

      <div
        className="tilt-stage"
        role="progressbar"
        aria-label="Match score"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${clamped.toFixed(1)}% — ${label}`}
      >
        <div
          className="tilt-card"
          onMouseMove={handleMove}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            // @ts-expect-error Custom CSS variables are valid in React styles
            "--mx": `${tilt.mx}%`,
            "--my": `${tilt.my}%`,
          }}
        >
          <div
            className="gauge"
            // @ts-expect-error Custom CSS variables are valid in React styles
            style={{ "--p": pct, "--band": band }}
            aria-hidden
          >
            <span className="gauge__sheen" />
          </div>
          <div className="gauge__center">
            <span className="gauge__value tnum" style={{ color: band }}>
              {display.toFixed(1)}
              <span className="gauge__value-pct">%</span>
            </span>
            <span className="gauge__band" style={{ color: band }}>
              {label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. SkillList Component
interface SkillListProps {
  title: string;
  skills: string[];
  variant?: "matched" | "missing" | "neutral";
  emptyText?: string;
}

const SkillList = ({
  title,
  skills = [],
  variant = "neutral",
  emptyText = "None",
}: SkillListProps) => {
  return (
    <div className="skills">
      <h3 className="skills__title">
        {title} <span className="skills__count">{skills.length}</span>
      </h3>
      {skills.length === 0 ? (
        <p className="skills__empty">{emptyText}</p>
      ) : (
        <ul className={`pill-list pill-list--${variant}`}>
          {skills.map((skill, i) => (
            <li
              key={skill}
              className="pill"
              // @ts-expect-error Custom CSS variables are valid in React styles
              style={{ "--i": i }}
            >
              {variant === "matched" && (
                <span className="pill__mark" aria-hidden>
                  ✓
                </span>
              )}
              {variant === "missing" && (
                <span className="pill__mark" aria-hidden>
                  ✕
                </span>
              )}
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// 4. AiSuggestions Component
interface AiSuggestionsProps {
  loading: boolean;
  error: string;
  suggestions: Suggestions | null;
}

const AiSuggestions = ({
  loading,
  error,
  suggestions,
}: AiSuggestionsProps) => {
  return (
    <section className="ai card">
      <h2 className="ai__title">
        <span aria-hidden>🤖</span> AI career guidance
      </h2>

      {loading && (
        <div className="ai__loading">
          <div className="spinner spinner--sm" aria-hidden />
          <span>Generating personalized suggestions…</span>
        </div>
      )}

      {!loading && error && <p className="alert alert--warn">{error}</p>}

      {!loading && !error && suggestions && (
        <div className="ai__body">
          {suggestions.fit_summary && (
            <p className="ai__summary">{suggestions.fit_summary}</p>
          )}

          {suggestions.strengths?.length > 0 && (
            <div className="ai__group">
              <h3 className="ai__heading">
                <span className="ai__heading-emoji" aria-hidden>
                  💪
                </span>
                Strengths
              </h3>
              <ul className="ai__list">
                {suggestions.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.gap_advice?.length > 0 && (
            <div className="ai__group">
              <h3 className="ai__heading">
                <span className="ai__heading-emoji" aria-hidden>
                  🎯
                </span>
                Closing the gaps
              </h3>
              <ul className="ai__list">
                {suggestions.gap_advice.map((g, i) => (
                  <li key={i}>
                    {g.skill && <strong>{g.skill}: </strong>}
                    {g.how_to_address}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.resume_improvements?.length > 0 && (
            <div className="ai__group">
              <h3 className="ai__heading">
                <span className="ai__heading-emoji" aria-hidden>
                  📝
                </span>
                Résumé improvements
              </h3>
              <ul className="ai__list">
                {suggestions.resume_improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.next_steps?.length > 0 && (
            <div className="ai__group">
              <h3 className="ai__heading">
                <span className="ai__heading-emoji" aria-hidden>
                  🚀
                </span>
                Next steps
              </h3>
              <ol className="ai__list ai__list--ordered">
                {suggestions.next_steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {suggestions.model && (
            <p className="ai__meta">
              Generated by {suggestions.model} via OpenRouter
            </p>
          )}
        </div>
      )}
    </section>
  );
};

// 5. ChatBox Component
interface ChatBoxProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  error: string;
}

const ChatBox = ({ messages, onSend, loading, error }: ChatBoxProps) => {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput("");
  };

  return (
    <section className="chat card">
      <h2 className="chat__title">
        <span aria-hidden>💬</span> Ask the AI assistant
      </h2>
      <p className="chat__hint">
        Ask anything — and since it has your résumé, this job, and your score, it
        can also give tailored interview, ATS, and career advice.
      </p>

      <div className="chat__log" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble bubble--${m.role === "user" ? "user" : "bot"}`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="bubble bubble--bot bubble--typing">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && !loading && (
        <div className="chat__suggestions">
          {CHAT_PROMPTS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => !loading && onSend(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="alert alert--warn">{error}</p>}

      <form className="chat__form" onSubmit={submit}>
        <input
          type="text"
          className="chat__input"
          placeholder="Type your question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          aria-label="Chat message"
        />
        <button
          type="submit"
          className="btn btn--primary chat__send"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </section>
  );
};

// --- Main Integrated Component ---

const ResumeScreener = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // AI suggestions state (loaded after a successful analysis).
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [suggestLoading, setSuggestLoading] = useState<boolean>(false);
  const [suggestError, setSuggestError] = useState<string>("");

  // Chatbot state.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string>("");

  const canSubmit = !!file && jobDescription.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setSuggestions(null);
    setSuggestError("");
    setChatMessages([]);
    setChatError("");

    if (!file) {
      setError("Please upload a résumé PDF.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste a job description.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("job_description", jobDescription);

      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/analyze`, {
          method: "POST",
          body: formData,
        });
      } catch {
        throw new Error(
          `Could not reach the analysis server at ${API_BASE_URL}. ` +
            "This project has a Python/FastAPI backend — start it locally " +
            "(see the project README) or set VITE_RESUME_API_URL to a " +
            "deployed instance."
        );
      }

      if (!response.ok) {
        let detail = `Request failed (HTTP ${response.status}).`;
        try {
          const data = await response.json();
          if (typeof data?.detail === "string") detail = data.detail;
          else if (Array.isArray(data?.detail))
            detail = data.detail.map((d: { msg: string }) => d.msg).join("; ");
        } catch {
          /* keep generic message */
        }
        throw new Error(detail);
      }

      const data = (await response.json()) as AnalyzeResponse;
      if (!data || typeof data.match_score !== "number" || !data.skills) {
        throw new Error("The server returned an unexpected response.");
      }
      setResult(data);
      setChatMessages([CHAT_GREETING]);
      // Load AI guidance in the background; the score renders immediately.
      void fetchSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (analysis: AnalyzeResponse) => {
    setSuggestLoading(true);
    setSuggestError("");
    try {
      const res = await fetch(`${API_BASE_URL}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: analysis.resume_text ?? "",
          job_description: jobDescription,
          match_score: analysis.match_score,
          matched_skills: analysis.skills.matched,
          missing_skills: analysis.skills.missing,
        }),
      });
      if (!res.ok) {
        let detail = `AI suggestions failed (HTTP ${res.status}).`;
        try {
          const d = await res.json();
          if (typeof d?.detail === "string") detail = d.detail;
        } catch {
          /* keep generic */
        }
        throw new Error(detail);
      }
      const d = await res.json();
      setSuggestions((d.suggestions ?? null) as Suggestions | null);
    } catch (err) {
      setSuggestError(
        err instanceof Error ? err.message : "Could not load AI suggestions."
      );
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSendChat = async (text: string) => {
    if (!result || chatLoading) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const history: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: trimmed },
    ];
    setChatMessages(history);
    setChatError("");
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          resume_text: result.resume_text ?? "",
          job_description: jobDescription,
          match_score: result.match_score,
          matched_skills: result.skills.matched,
          missing_skills: result.skills.missing,
        }),
      });
      if (!res.ok) {
        let detail = `Chat failed (HTTP ${res.status}).`;
        try {
          const d = await res.json();
          if (typeof d?.detail === "string") detail = d.detail;
        } catch {
          /* keep generic */
        }
        throw new Error(detail);
      }
      const d = await res.json();
      setChatMessages([
        ...history,
        { role: "assistant", content: (d.reply as string) ?? "" },
      ]);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Could not get a reply."
      );
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
    <div className="relative min-h-screen w-full bg-black">
      {/* Background 3D Stars Canvas */}
      <StarsCanvas />

      {/* Main Glassmorphism Scope */}
      <div className="resume-screener-scope relative z-10">
        <div className="app">
          {/* Header */}
          <header className="app__header">
            <div className="back-link-container">
              <Link to="/" className="back-link">
                ← Back to portfolio
              </Link>
            </div>
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

          {/* Core Layout */}
          <main className="layout">
            {/* Input Form Column */}
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

            {/* Results Column */}
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
                  {/* Conic Score Gauge */}
                  <ScoreBar score={result.match_score} />

                  {/* Skills lists */}
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
                    Parsed{" "}
                    <strong className="tnum">
                      {result.resume_char_count}
                    </strong>{" "}
                    characters
                    {result.filename ? ` from "${result.filename}"` : ""}.
                  </p>
                </div>
              )}
            </section>
          </main>

          {/* AI Suggestions + Chatbot Row (renders after success) */}
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

          {/* Footer */}
          <footer className="app__footer">
            <span className="app__footer-line" aria-hidden />
            Built with FastAPI · sentence-transformers · React + Vite
          </footer>
        </div>
      </div>
    </div>
  );
};

export default ResumeScreener;
