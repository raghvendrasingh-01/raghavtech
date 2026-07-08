import {
  planFromMessage,
  type PlannerInput,
  type PlannerOutput,
} from "@/lib/intelligence";

/**
 * AI adapter — the single seam between the UI and "intelligence".
 *
 * Today it runs the local, deterministic engine so the demo works with zero
 * external dependencies (and never breaks on stage). When a backend with an
 * OpenAI key is available (Phase 6), `USE_REMOTE` flips on and the same calls
 * transparently POST to the FastAPI `/ai/*` routes — the return shapes are
 * identical, so no UI changes are needed.
 */

const REMOTE_BASE = process.env.NEXT_PUBLIC_API_URL;
const USE_REMOTE = Boolean(REMOTE_BASE);

/** Small artificial delay so the "thinking" UI feels real in local mode. */
function think<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function chatPlan(input: PlannerInput): Promise<PlannerOutput> {
  if (USE_REMOTE) {
    try {
      const res = await fetch(`${REMOTE_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) return (await res.json()) as PlannerOutput;
    } catch {
      /* fall through to local engine */
    }
  }
  return think(planFromMessage(input));
}

/** Whether Pulse is currently backed by a live LLM (for UI badges). */
export function aiMode(): "gpt" | "local" {
  return USE_REMOTE ? "gpt" : "local";
}
