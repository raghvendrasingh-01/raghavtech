import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StarsCanvas } from "../components/canvas";

/**
 * AI Resume Screening System — in-portfolio page.
 *
 * Lets the user upload a résumé PDF and paste a job description, then calls the
 * project's FastAPI backend (`POST /analyze`) to get a semantic match score and
 * a list of missing skills.
 *
 * The backend URL is configurable via the `VITE_RESUME_API_URL` env var and
 * defaults to the local dev server. Because this project is full-stack, the
 * page degrades gracefully (with a clear message) when the backend isn't
 * reachable.
 */

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

const scoreColor = (score: number): string => {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
};

const scoreBand = (score: number): string => {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Weak match";
};

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

const ResumeScreener = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // AI suggestions state (loaded after a successful analysis).
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [suggestLoading, setSuggestLoading] = useState<boolean>(false);
  const [suggestError, setSuggestError] = useState<string>("");

  // Chatbot state.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatLoading]);

  const canSubmit = !!file && jobDescription.trim().length > 0 && !loading;

  const selectFile = (candidate: File | undefined | null) => {
    if (!candidate) return;
    const isPdf =
      candidate.type === "application/pdf" ||
      candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please choose a PDF file.");
      setFile(null);
      return;
    }
    setError("");
    setFile(candidate);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (loading) return;
    selectFile(e.dataTransfer.files?.[0]);
  };

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

  const sendChat = async (text: string) => {
    if (!result || chatLoading) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const history: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: trimmed },
    ];
    setChatMessages(history);
    setChatInput("");
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
    setJobDescription("");
    setResult(null);
    setError("");
    setSuggestions(null);
    setSuggestError("");
    setChatMessages([]);
    setChatInput("");
    setChatError("");
  };

  const renderPills = (skills: string[], variant: "matched" | "missing" | "neutral") => {
    if (skills.length === 0) {
      return (
        <p className="text-gray-400 text-sm">
          {variant === "missing" ? "Great — no missing skills! 🎉" : "None"}
        </p>
      );
    }
    const cls =
      variant === "matched"
        ? "bg-green-500/15 text-green-400"
        : variant === "missing"
        ? "bg-red-500/15 text-red-400"
        : "bg-gray-500/20 text-gray-200";
    return (
      <ul className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li key={skill} className={`rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
            {variant === "matched" && "✓ "}
            {variant === "missing" && "✕ "}
            {skill}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-black">
      <StarsCanvas />
      <div className="relative z-10 min-h-screen px-6 py-16">
        <div className="mx-auto w-full max-w-5xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <Link
              to="/"
              className="mb-6 inline-block text-sm text-purple-400 hover:text-purple-300"
            >
              ← Back to portfolio
            </Link>
            <h1 className="text-white text-4xl font-bold">
              🎯 AI Resume Screening System
            </h1>
            <p className="mt-3 text-gray-300">
              Upload a résumé and paste a job description to get a semantic match
              score and a list of missing skills.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* ---- Input form ---- */}
            <section className="bg-tertiary rounded-2xl p-6 shadow-xl">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <span
                  id="resume-label"
                  className="text-white text-sm font-semibold"
                >
                  Résumé (PDF)
                </span>
                <div
                  role="button"
                  tabIndex={0}
                  aria-labelledby="resume-label"
                  onClick={() => !loading && inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!loading) inputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!loading) setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-colors ${
                    isDragging
                      ? "border-purple-500 bg-purple-500/10"
                      : file
                      ? "border-green-500"
                      : "border-gray-600 hover:border-purple-500"
                  } ${loading ? "opacity-60" : ""}`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    disabled={loading}
                    onChange={(e) => selectFile(e.target.files?.[0])}
                  />
                  {file ? (
                    <div className="text-white">
                      <span className="text-2xl">📄</span>
                      <p className="mt-1 break-all font-semibold">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(0)} KB · click to replace
                      </p>
                    </div>
                  ) : (
                    <div className="text-gray-300">
                      <span className="text-2xl">⬆️</span>
                      <p className="mt-1 font-semibold text-white">
                        Drag &amp; drop your résumé PDF
                      </p>
                      <p className="text-xs text-gray-400">or click to browse</p>
                    </div>
                  )}
                </div>

                <label
                  htmlFor="jd"
                  className="mt-1 text-white text-sm font-semibold"
                >
                  Job description
                </label>
                <textarea
                  id="jd"
                  rows={9}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description here…"
                  className="bg-primary text-gray-200 w-full resize-y rounded-lg border border-gray-700 p-3 text-sm outline-none focus:border-purple-500"
                />

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 rounded-lg bg-purple-600 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Analyzing…" : "Analyze résumé"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="rounded-lg border border-gray-600 px-5 py-3 font-semibold text-gray-300 transition-colors hover:text-white disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </p>
                )}
              </form>
            </section>

            {/* ---- Results ---- */}
            <section className="bg-tertiary flex min-h-[320px] rounded-2xl p-6 shadow-xl">
              {loading ? (
                <div className="m-auto text-center text-gray-300">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-purple-500" />
                  <p>Analyzing your résumé…</p>
                </div>
              ) : !result ? (
                <div className="m-auto text-center text-gray-400">
                  <span className="text-4xl">📊</span>
                  <p className="mt-3">Your results will appear here.</p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Score */}
                  <div className="mb-6">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-white font-semibold">Match score</span>
                      <span
                        className="text-3xl font-bold"
                        style={{ color: scoreColor(result.match_score) }}
                      >
                        {result.match_score.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Match score"
                      aria-valuenow={Math.round(result.match_score)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${result.match_score.toFixed(1)}% — ${scoreBand(
                        result.match_score
                      )}`}
                      className="bg-primary h-3.5 w-full overflow-hidden rounded-full border border-gray-700"
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, result.match_score))}%`,
                          backgroundColor: scoreColor(result.match_score),
                        }}
                      />
                    </div>
                    <p
                      className="mt-1.5 text-sm font-semibold"
                      style={{ color: scoreColor(result.match_score) }}
                    >
                      {scoreBand(result.match_score)}
                    </p>
                  </div>

                  {/* Skills */}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-white mb-2 text-sm font-bold">
                        Matched skills{" "}
                        <span className="font-normal text-gray-400">
                          ({result.skills.matched.length})
                        </span>
                      </h3>
                      {renderPills(result.skills.matched, "matched")}
                    </div>
                    <div>
                      <h3 className="text-white mb-2 text-sm font-bold">
                        Missing skills{" "}
                        <span className="font-normal text-gray-400">
                          ({result.skills.missing.length})
                        </span>
                      </h3>
                      {renderPills(result.skills.missing, "missing")}
                    </div>
                    <div>
                      <h3 className="text-white mb-2 text-sm font-bold">
                        All JD skills detected{" "}
                        <span className="font-normal text-gray-400">
                          ({result.skills.required.length})
                        </span>
                      </h3>
                      {renderPills(result.skills.required, "neutral")}
                    </div>
                  </div>

                  <p className="mt-5 border-t border-gray-700 pt-4 text-xs text-gray-400">
                    Parsed <strong>{result.resume_char_count}</strong> characters
                    {result.filename ? ` from "${result.filename}"` : ""}.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ---- AI career guidance ---- */}
          {result && (
            <section className="bg-tertiary mt-6 rounded-2xl p-6 shadow-xl">
              <h2 className="text-white mb-4 text-xl font-bold">
                🤖 AI career guidance
              </h2>

              {suggestLoading && (
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-gray-600 border-t-purple-500" />
                  <span>Generating personalized suggestions…</span>
                </div>
              )}

              {!suggestLoading && suggestError && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  {suggestError}
                </p>
              )}

              {!suggestLoading && !suggestError && suggestions && (
                <div className="space-y-5 text-sm text-gray-200">
                  {suggestions.fit_summary && (
                    <p className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4 leading-relaxed text-white">
                      {suggestions.fit_summary}
                    </p>
                  )}

                  {suggestions.strengths?.length > 0 && (
                    <div>
                      <h3 className="text-white mb-2 font-bold">💪 Strengths</h3>
                      <ul className="list-disc space-y-1.5 pl-5">
                        {suggestions.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suggestions.gap_advice?.length > 0 && (
                    <div>
                      <h3 className="text-white mb-2 font-bold">
                        🎯 Closing the gaps
                      </h3>
                      <ul className="list-disc space-y-1.5 pl-5">
                        {suggestions.gap_advice.map((g, i) => (
                          <li key={i}>
                            {g.skill && (
                              <strong className="text-white">{g.skill}: </strong>
                            )}
                            {g.how_to_address}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suggestions.resume_improvements?.length > 0 && (
                    <div>
                      <h3 className="text-white mb-2 font-bold">
                        📝 Résumé improvements
                      </h3>
                      <ul className="list-disc space-y-1.5 pl-5">
                        {suggestions.resume_improvements.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suggestions.next_steps?.length > 0 && (
                    <div>
                      <h3 className="text-white mb-2 font-bold">🚀 Next steps</h3>
                      <ol className="list-decimal space-y-1.5 pl-5">
                        {suggestions.next_steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {suggestions.model && (
                    <p className="border-t border-gray-700 pt-3 text-xs text-gray-500">
                      Generated by {suggestions.model} via OpenRouter
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ---- Chatbot ---- */}
          {result && (
            <section className="bg-tertiary mt-6 rounded-2xl p-6 shadow-xl">
              <h2 className="text-white text-xl font-bold">
                💬 Ask the AI assistant
              </h2>
              <p className="mb-4 mt-1 text-xs text-gray-400">
                Ask anything — and since it has your résumé, this job, and your
                score, it can also give tailored interview, ATS, and career advice.
              </p>

              <div
                className="flex max-h-[360px] flex-col gap-2.5 overflow-y-auto pr-1"
                role="log"
                aria-live="polite"
              >
                {chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-purple-600 px-4 py-2.5 text-sm text-white"
                        : "bg-primary max-w-[85%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border border-gray-700 px-4 py-2.5 text-sm text-gray-200"
                    }
                  >
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-primary self-start rounded-2xl rounded-bl-sm border border-gray-700 px-4 py-3 text-sm text-gray-400">
                    <span className="inline-block animate-pulse">● ● ●</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatMessages.length <= 1 && !chatLoading && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {CHAT_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void sendChat(p)}
                      className="rounded-full border border-gray-600 bg-gray-500/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-purple-500 hover:text-white"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {chatError && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  {chatError}
                </p>
              )}

              <form
                className="mt-4 flex gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendChat(chatInput);
                }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  placeholder="Type your question…"
                  aria-label="Chat message"
                  className="bg-primary flex-1 rounded-lg border border-gray-700 px-3.5 py-2.5 text-sm text-gray-200 outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </section>
          )}

          {/* Backend note */}
          <p className="mt-8 text-center text-xs text-gray-500">
            This is a full-stack project: the screening runs on a Python/FastAPI
            backend with sentence-transformers. Source &amp; setup live in the{" "}
            <code className="text-gray-400">resume-screening-system/</code> folder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResumeScreener;
