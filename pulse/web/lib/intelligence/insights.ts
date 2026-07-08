import type {
  Task,
  CalendarEvent,
  AiSuggestion,
  ProductivityDay,
} from "@/lib/types";
import { computePriority, workRemainingMin } from "./priority";
import { computeRisk } from "./risk";
import { clamp, round } from "@/lib/utils";

/**
 * Higher-level insights derived from tasks + calendar:
 * productivity score, burnout/overload detection, and the proactive
 * AI suggestion feed that makes Pulse feel like a Chief of Staff.
 */

export function computeProductivityScore(
  tasks: Task[],
  history: ProductivityDay[],
  now = new Date()
): { score: number; delta: number; label: string } {
  const open = tasks.filter((t) => t.status !== "done");
  const onTrack = open.filter((t) => computeRisk(t, { now }).risk < 55).length;
  const trackRatio = open.length ? onTrack / open.length : 1;

  const recent = history.slice(-7);
  const avg = recent.length
    ? recent.reduce((s, d) => s + d.score, 0) / recent.length
    : 70;
  const prev = history.slice(-14, -7);
  const prevAvg = prev.length ? prev.reduce((s, d) => s + d.score, 0) / prev.length : avg;

  const score = round(clamp(0.55 * (avg / 100) + 0.45 * trackRatio) * 100);
  const delta = round(avg - prevAvg);
  const label = score >= 80 ? "Excellent" : score >= 65 ? "Solid" : score >= 45 ? "Slipping" : "At risk";
  return { score, delta, label };
}

/** Detect an overloaded / burnout-prone day. */
export function detectOverload(
  tasks: Task[],
  events: CalendarEvent[],
  now = new Date()
): { overloaded: boolean; committedHours: number; meetingHours: number; message: string } {
  const today = now.toDateString();
  const meetingHours = round(
    events
      .filter((e) => new Date(e.start).toDateString() === today)
      .reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000, 0),
    1
  );
  const dueSoon = tasks.filter(
    (t) => t.status !== "done" && new Date(t.deadline).getTime() - now.getTime() < 36 * 3_600_000
  );
  const taskHours = round(dueSoon.reduce((s, t) => s + workRemainingMin(t) / 60, 0), 1);
  const committedHours = round(meetingHours + taskHours, 1);
  const overloaded = committedHours > 10 || meetingHours > 5;
  const message = overloaded
    ? `Heads up — ${committedHours}h of committed work today (${meetingHours}h in meetings). That's above a sustainable load. Protect one block and consider pushing a low-priority item.`
    : `Balanced day: ~${committedHours}h committed. You have room to go deep on what matters.`;
  return { overloaded, committedHours, meetingHours, message };
}

/** One-line AI daily briefing (also used by the morning-briefing feature). */
export function generateBriefing(
  tasks: Task[],
  events: CalendarEvent[],
  now = new Date()
): string {
  const today = now.toDateString();
  const meetings = events.filter((e) => new Date(e.start).toDateString() === today).length;
  const open = tasks.filter((t) => t.status !== "done");
  const risky = open
    .map((t) => ({ t, r: computeRisk(t, { now, events }) }))
    .sort((a, b) => b.r.risk - a.r.risk)[0];

  const parts: string[] = [];
  parts.push(
    meetings
      ? `You have ${meetings} ${meetings === 1 ? "event" : "events"} and ${open.length} open ${open.length === 1 ? "task" : "tasks"} today.`
      : `${open.length} open ${open.length === 1 ? "task" : "tasks"} and a clear calendar — a good day to go deep.`
  );
  if (risky && risky.r.risk >= 55) {
    parts.push(`**${risky.t.title}** is your biggest risk at ${risky.r.risk}% — I'd start there.`);
  } else if (risky) {
    parts.push(`Nothing is in the danger zone. Stay ahead of **${risky.t.title}**.`);
  }
  return parts.join(" ");
}

/** Build the proactive suggestion feed shown on the dashboard. */
export function generateSuggestions(
  tasks: Task[],
  events: CalendarEvent[],
  history: ProductivityDay[],
  now = new Date()
): AiSuggestion[] {
  const out: AiSuggestion[] = [];
  const iso = now.toISOString();

  // 1) Riskiest deadline
  const risky = tasks
    .filter((t) => t.status !== "done")
    .map((t) => ({ t, r: computeRisk(t, { now, events }) }))
    .sort((a, b) => b.r.risk - a.r.risk)[0];
  if (risky && risky.r.risk >= 55) {
    out.push({
      id: "sg-risk",
      kind: "risk",
      title: `${risky.t.title} is at ${risky.r.risk}% miss risk`,
      body: `${risky.r.message} ${risky.r.recommendation}`,
      createdAt: iso,
      cta: "Rescue this deadline",
    });
  }

  // 2) Overload / burnout
  const load = detectOverload(tasks, events, now);
  if (load.overloaded) {
    out.push({ id: "sg-load", kind: "burnout", title: "Your day is overloaded", body: load.message, createdAt: iso, cta: "Rebalance my day" });
  }

  // 3) Best focus window
  out.push({
    id: "sg-focus",
    kind: "focus",
    title: "Your peak focus window is 9–11 AM",
    body: "Based on when you complete the most work, I've reserved deep-work blocks in the morning for your hardest tasks.",
    createdAt: iso,
    cta: "Use this window",
  });

  // 4) Momentum / insight
  const topTask = tasks
    .filter((t) => t.status !== "done")
    .map((t) => ({ t, p: computePriority(t, { now }) }))
    .sort((a, b) => b.p.score - a.p.score)[0];
  if (topTask) {
    out.push({
      id: "sg-next",
      kind: "insight",
      title: `Do "${topTask.t.title}" first today`,
      body: topTask.p.reason,
      createdAt: iso,
      cta: "Start now",
    });
  }

  return out.slice(0, 4);
}
