import type {
  Task,
  Subtask,
  Category,
  Difficulty,
  CalendarEvent,
  PriorityResult,
  RiskResult,
} from "@/lib/types";
import { computePriority } from "./priority";
import { computeRisk } from "./risk";
import { formatDate, formatTime, round } from "@/lib/utils";

/**
 * Task-analysis engine — the brains behind AI task creation.
 *
 * Given a rough draft (name, deadline, estimate, difficulty, category) it:
 *  - corrects the estimate for the planning fallacy (people under-estimate),
 *  - breaks the work into sensible subtasks,
 *  - suggests the best time to actually do it (from real free slots),
 *  - predicts priority (with reason) and miss-risk.
 *
 * All rule-based and instant; the AI adapter can override with GPT later.
 */

export interface TaskDraft {
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  estimateMin: number;
  deadline: string; // ISO
  importance?: number;
}

export interface TaskAnalysis {
  priority: PriorityResult;
  risk: RiskResult;
  /** AI-corrected "actual" completion time. */
  adjustedEstimateMin: number;
  estimateDeltaPct: number;
  subtasks: Subtask[];
  bestSlot: { startIso: string; label: string } | null;
  notes: string[];
}

const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 1.1, medium: 1.28, hard: 1.55 };

/** People underestimate — Pulse pads the estimate based on difficulty. */
export function adjustEstimate(estimateMin: number, difficulty: Difficulty): number {
  return Math.round((estimateMin * DIFFICULTY_MULT[difficulty]) / 5) * 5;
}

type Template = { title: string; frac: number }[];

const TEMPLATES: Record<string, Template> = {
  study: [
    { title: "Review the requirements", frac: 0.15 },
    { title: "Outline your approach", frac: 0.2 },
    { title: "Do the core work", frac: 0.4 },
    { title: "Check & test", frac: 0.15 },
    { title: "Finalize & submit", frac: 0.1 },
  ],
  interview: [
    { title: "Review the key concepts", frac: 0.25 },
    { title: "Solve practice problems", frac: 0.4 },
    { title: "Review your mistakes", frac: 0.2 },
    { title: "Do a timed mock run", frac: 0.15 },
  ],
  project: [
    { title: "Scope & plan the work", frac: 0.15 },
    { title: "Build the core", frac: 0.45 },
    { title: "Handle edge cases & polish", frac: 0.25 },
    { title: "Test & ship", frac: 0.15 },
  ],
  reading: [
    { title: "Skim & set reading goals", frac: 0.15 },
    { title: "Read deeply and take notes", frac: 0.6 },
    { title: "Summarize the takeaways", frac: 0.25 },
  ],
  work: [
    { title: "Gather context", frac: 0.25 },
    { title: "Draft the work", frac: 0.5 },
    { title: "Review & send", frac: 0.25 },
  ],
  generic: [
    { title: "Break down the work", frac: 0.2 },
    { title: "Do the main part", frac: 0.55 },
    { title: "Review & wrap up", frac: 0.25 },
  ],
};

function pickTemplateKey(draft: TaskDraft): string | null {
  const t = `${draft.title} ${draft.description ?? ""}`.toLowerCase();
  // Tiny errands don't need subtasks.
  if (draft.estimateMin <= 25 || /\b(pay|bill|email|call|text|book|renew|reply)\b/.test(t)) return null;
  if (/\b(read|chapter|book|paper|article)\b/.test(t)) return "reading";
  if (/\b(interview|dsa|leetcode|mock|dp|algorithms?)\b/.test(t)) return "interview";
  if (/\b(build|ship|app|feature|deploy|mvp|prototype|design)\b/.test(t)) return "project";
  if (draft.category === "interview") return "interview";
  if (draft.category === "project") return "project";
  if (draft.category === "study") return "study";
  if (draft.category === "work") return "work";
  return "generic";
}

export function suggestSubtasks(draft: TaskDraft, adjustedMin: number): Subtask[] {
  const key = pickTemplateKey(draft);
  if (!key) return [];
  const tmpl = TEMPLATES[key];
  return tmpl.map((s, i) => ({
    id: `sub-${i}-${Math.round(s.frac * 1000)}`,
    title: s.title,
    done: false,
    estimateMin: Math.max(10, Math.round((adjustedMin * s.frac) / 5) * 5),
  }));
}

/** Scan free time day-by-day and return the first slot that fits a first chunk. */
export function suggestBestSlot(
  draft: TaskDraft,
  events: CalendarEvent[],
  now: Date,
  targetMin: number
): { startIso: string; label: string } | null {
  const deadline = new Date(draft.deadline).getTime();
  if (deadline <= now.getTime()) return null;

  const dayStart = 8;
  const dayEnd = 22;
  const need = Math.min(targetMin, 90); // just need room for a first focus block
  const step = 30 * 60000;

  const preferredHour =
    draft.category === "interview" ? 19 : draft.category === "study" ? 9 : 10;

  for (let day = 0; day < 30; day++) {
    const base = new Date(now);
    base.setDate(now.getDate() + day);
    for (let h = dayStart; h <= dayEnd; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStart = new Date(base);
        slotStart.setHours(h, m, 0, 0);
        const s = slotStart.getTime();
        if (s < now.getTime() + step) continue; // not in the past / too soon
        if (s + need * 60000 > deadline) return null; // ran out of runway
        const end = s + need * 60000;
        // must stay within the working window
        const windowEnd = new Date(base);
        windowEnd.setHours(dayEnd, 0, 0, 0);
        if (end > windowEnd.getTime()) continue;
        // no clash with events
        const clash = events.some((e) => {
          const es = new Date(e.start).getTime();
          const ee = new Date(e.end).getTime();
          return s < ee && end > es;
        });
        if (clash) continue;

        const dayLabel =
          day === 0 ? "today" : day === 1 ? "tomorrow" : formatDate(slotStart.toISOString());
        const near = Math.abs(h - preferredHour) <= 2;
        return {
          startIso: slotStart.toISOString(),
          label: `${dayLabel} at ${formatTime(slotStart.toISOString())}${near ? " — your best window for this" : ""}`,
        };
      }
    }
  }
  return null;
}

/** Suggest a milestone roadmap for a goal (used by the Goal Planner). */
export function suggestMilestones(goalTitle: string): { title: string; etaWeeks: number }[] {
  const t = goalTitle.toLowerCase();
  if (/\b(intern|internship|job|swe|faang|google|placement|offer)\b/.test(t))
    return [
      { title: "Finish DSA patterns (arrays → graphs)", etaWeeks: 4 },
      { title: "System design fundamentals", etaWeeks: 3 },
      { title: "Ship 2 portfolio projects", etaWeeks: 4 },
      { title: "Polish resume & LinkedIn", etaWeeks: 1 },
      { title: "10 mock interviews", etaWeeks: 4 },
    ];
  if (/\b(fit|gym|weight|muscle|run|marathon|health)\b/.test(t))
    return [
      { title: "Set baseline & training plan", etaWeeks: 1 },
      { title: "Build the habit (4 sessions/week)", etaWeeks: 4 },
      { title: "Progressive overload block", etaWeeks: 6 },
      { title: "Deload & reassess", etaWeeks: 1 },
    ];
  if (/\b(launch|startup|product|users|saas|app|business)\b/.test(t))
    return [
      { title: "Validate the problem", etaWeeks: 1 },
      { title: "Ship an MVP", etaWeeks: 3 },
      { title: "Get first 10 users", etaWeeks: 2 },
      { title: "Iterate on feedback", etaWeeks: 3 },
      { title: "Public launch", etaWeeks: 1 },
    ];
  if (/\b(learn|language|japanese|spanish|guitar|piano|skill)\b/.test(t))
    return [
      { title: "Learn the fundamentals", etaWeeks: 3 },
      { title: "Daily practice habit", etaWeeks: 6 },
      { title: "Build something real with it", etaWeeks: 3 },
      { title: "Reach conversational / intermediate", etaWeeks: 6 },
    ];
  if (/\b(exam|test|gre|gate|sat|score|grade)\b/.test(t))
    return [
      { title: "Diagnose weak areas", etaWeeks: 1 },
      { title: "Cover the full syllabus", etaWeeks: 5 },
      { title: "Timed practice papers", etaWeeks: 3 },
      { title: "Final revision", etaWeeks: 1 },
    ];
  return [
    { title: "Break the goal into phases", etaWeeks: 1 },
    { title: "Build momentum with quick wins", etaWeeks: 3 },
    { title: "Do the core work", etaWeeks: 5 },
    { title: "Review & finish strong", etaWeeks: 2 },
  ];
}

export function analyzeTask(
  draft: TaskDraft,
  ctx: { events: CalendarEvent[]; now?: Date }
): TaskAnalysis {
  const now = ctx.now ?? new Date();
  const adjustedEstimateMin = adjustEstimate(draft.estimateMin, draft.difficulty);
  const estimateDeltaPct = draft.estimateMin
    ? round(((adjustedEstimateMin - draft.estimateMin) / draft.estimateMin) * 100)
    : 0;

  const subtasks = suggestSubtasks(draft, adjustedEstimateMin);

  // Build a synthetic task using the *adjusted* estimate so priority/risk
  // reflect the realistic workload.
  const synthetic: Task = {
    id: "draft",
    title: draft.title || "Untitled task",
    description: draft.description,
    category: draft.category,
    difficulty: draft.difficulty,
    estimateMin: adjustedEstimateMin,
    deadline: draft.deadline,
    status: "todo",
    progress: 0,
    subtasks,
    importance: draft.importance,
    createdAt: now.toISOString(),
  };

  const priority = computePriority(synthetic, { now });
  const risk = computeRisk(synthetic, { now, events: ctx.events });
  const bestSlot = suggestBestSlot(draft, ctx.events, now, adjustedEstimateMin);

  const notes: string[] = [];
  if (estimateDeltaPct > 0)
    notes.push(
      `Similar ${draft.difficulty} tasks tend to run ~${estimateDeltaPct}% over — I've planned for ${Math.round(adjustedEstimateMin / 60 * 10) / 10}h.`
    );
  if (risk.risk >= 55)
    notes.push(`⚠️ ${risk.risk}% miss risk. ${risk.recommendation}`);
  if (bestSlot) notes.push(`Best time to start: ${bestSlot.label}.`);
  if (subtasks.length) notes.push(`Split into ${subtasks.length} steps so you can start small.`);

  return { priority, risk, adjustedEstimateMin, estimateDeltaPct, subtasks, bestSlot, notes };
}
