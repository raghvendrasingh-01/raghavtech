/**
 * API client for the résumé screening backend.
 *
 * The base URL is read from the Vite env var `VITE_API_BASE_URL` so the same
 * build can target local dev or a deployed backend. Defaults to the local
 * FastAPI dev server.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

/**
 * Fetch the curated list of AI models the backend can use.
 *
 * The backend is the single source of truth for which OpenRouter models are
 * offered (`GET /models`). On any failure this resolves to an empty list rather
 * than throwing, so the UI degrades gracefully (the selector shows a
 * "loading/unavailable" placeholder and analysis still works with the server
 * default).
 *
 * @returns {Promise<{models: Array<{id:string,name:string,provider:string}>, default: string}>}
 */
export async function getModels() {
  try {
    const response = await fetch(`${API_BASE_URL}/models`);
    if (!response.ok) return { models: [], default: "" };
    const data = await response.json();
    return {
      models: Array.isArray(data?.models) ? data.models : [],
      default: typeof data?.default === "string" ? data.default : "",
    };
  } catch {
    return { models: [], default: "" };
  }
}

/**
 * Send a résumé (PDF or DOCX) and a job description to the backend for analysis.
 *
 * @param {File} resumeFile - The PDF/DOCX file selected by the user.
 * @param {string} jobDescription - The job description text.
 * @returns {Promise<object>} Resolves to the AnalyzeResponse JSON.
 * @throws {Error} With a human-readable message on validation/server errors.
 */
export async function analyzeResume(resumeFile, jobDescription) {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("job_description", jobDescription);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: formData,
    });
  } catch {
    // Network-level failure (server down, CORS, DNS, …).
    throw new Error(
      "Could not reach the server. Is the backend running on " +
        `${API_BASE_URL}?`
    );
  }

  if (!response.ok) {
    // Try to surface the backend's structured error detail.
    let detail = `Request failed (HTTP ${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data?.detail)) {
        // FastAPI 422 validation error shape.
        detail = data.detail.map((d) => d.msg).join("; ");
      }
    } catch {
      /* keep the generic message */
    }
    throw new Error(detail);
  }

  // Validate the success body shape so a malformed/partial 2xx response surfaces
  // a friendly error instead of crashing the UI during render.
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an unexpected (non-JSON) response.");
  }
  if (
    !data ||
    typeof data.match_score !== "number" ||
    typeof data.skills !== "object" ||
    data.skills === null
  ) {
    throw new Error("The server returned an unexpected response shape.");
  }
  return data;
}

/**
 * Request AI-powered suggestions for an analysed résumé/JD.
 *
 * @param {object} analysis - The AnalyzeResponse returned by {@link analyzeResume}.
 * @param {string} jobDescription - The job description text.
 * @param {string} [model] - Optional model id to override the server default.
 * @returns {Promise<object>} Resolves to the `suggestions` object (includes
 *   `model`, the model that actually ran, which may differ on fallback).
 * @throws {Error} With a human-readable message on failure.
 */
export async function getSuggestions(analysis, jobDescription, model = "") {
  const payload = {
    resume_text: analysis.resume_text || "",
    job_description: jobDescription,
    match_score: analysis.match_score,
    matched_skills: analysis.skills?.matched ?? [],
    missing_skills: analysis.skills?.missing ?? [],
  };
  if (model) payload.model = model;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the server for AI suggestions.");
  }

  if (!response.ok) {
    let detail = `AI suggestions failed (HTTP ${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* keep generic message */
    }
    throw new Error(detail);
  }

  const data = await response.json();
  return data.suggestions ?? {};
}

/**
 * Send a chat message (with conversation history + project context) to the
 * scoped chatbot.
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation so far.
 * @param {object} analysis - The AnalyzeResponse (for résumé/score/skills context).
 * @param {string} jobDescription - The job description text.
 * @param {string} [model] - Optional model id to override the server default.
 * @returns {Promise<{reply: string, model: string}>} The assistant's reply text
 *   and the model that actually produced it (may differ from the request on
 *   fallback).
 * @throws {Error} With a human-readable message on failure.
 */
export async function sendChatMessage(
  messages,
  analysis,
  jobDescription,
  model = ""
) {
  const payload = {
    messages,
    resume_text: analysis.resume_text || "",
    job_description: jobDescription,
    match_score: analysis.match_score,
    matched_skills: analysis.skills?.matched ?? [],
    missing_skills: analysis.skills?.missing ?? [],
  };
  if (model) payload.model = model;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the chat server.");
  }

  if (!response.ok) {
    let detail = `Chat failed (HTTP ${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* keep generic message */
    }
    throw new Error(detail);
  }

  const data = await response.json();
  return { reply: data.reply ?? "", model: data.model ?? "" };
}

export { API_BASE_URL };
