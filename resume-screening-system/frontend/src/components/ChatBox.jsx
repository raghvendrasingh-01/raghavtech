import { useEffect, useRef, useState } from "react";

/**
 * Scoped chat widget for asking questions about the analysed résumé/JD.
 *
 * Presentation-only: conversation state lives in the parent, which also makes
 * the API call. This component renders the transcript and an input box.
 *
 * @param {object}   props
 * @param {Array<{role: string, content: string}>} props.messages  Transcript.
 * @param {(text: string) => void} props.onSend   Called with the user's text.
 * @param {boolean}  props.loading   Whether a reply is in flight.
 * @param {string}   [props.error]   Error message, if the last send failed.
 * @param {string[]} [props.suggestions]  Contextual starter prompts; falls back
 *   to a generic set when omitted or empty.
 */
const DEFAULT_SUGGESTIONS = [
  "How can I improve my résumé for this role?",
  "What interview questions should I prepare for?",
  "How do I optimize for ATS?",
];

export default function ChatBox({
  messages,
  onSend,
  loading,
  error,
  suggestions,
}) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  // Auto-scroll to the latest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const submit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput("");
  };

  // Enter sends; Shift+Enter inserts a newline (standard chat convention).
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  // Use the contextual chips the parent computed from the score/missing skills;
  // fall back to the generic set when none were provided.
  const chips =
    suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

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
          {chips.map((s) => (
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
        <textarea
          className="chat__input"
          placeholder="Type your question…  (Enter to send · Shift+Enter for a new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          rows={1}
          aria-label="Chat message"
        />
        <button
          type="submit"
          className="btn btn--primary chat__send"
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </section>
  );
}
