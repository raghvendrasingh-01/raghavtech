import type { Task, PriorityResult, Priority, Category } from "@/lib/types";
import { clamp, hoursUntil, round } from "@/lib/utils";

/**
 * Priority engine.
 *
 * Unlike a plain deadline sort, this weighs four signals and, crucially,
 * returns a written explanation of *why* a task landed at its priority —
 * the "explain WHY" requirement from the brief.
 *
 *   score = 42% urgency + 24% importance + 14% effort + 20% tightness
 *
 * - urgency:   how close the deadline is (linear over a 5-day horizon)
 * - importance: category weight + user difficulty / declared importance
 * - effort:    raw size of the remaining work
 * - tightness: work still required vs. real hours left (the "am I going
 *              to run out of runway" signal)
 */

const URGENCY_HORIZON_H = 120; // 5 days

// How much each category inherently "matters".
const CATEGORY_WEIGHT: Record<Category, number> = {
  interview: 1.0,
  work: 0.85,
  project: 0.8,
  study: 0.75,
  finance: 0.9,
  health: 0.6,
  personal: 0.5,
  other: 0.5,
};

const DIFFICULTY_WEIGHT = { easy: 0.4, medium: 0.65, hard: 0.95 } as const;

export interface PriorityContext {
  now?: Date;
  /** Total remaining committed work today (hours) — raises pressure globally. */
  workloadHours?: number;
}

export function workRemainingMin(task: Task): number {
  return Math.max(0, task.estimateMin * (1 - clamp(task.progress)));
}

export function computePriority(
  task: Task,
  ctx: PriorityContext = {}
): PriorityResult {
  const now = ctx.now ?? new Date();
  const hoursLeft = hoursUntil(task.deadline, now);
  const workH = workRemainingMin(task) / 60;

  // --- urgency ---
  const overdue = hoursLeft <= 0;
  const urgency = overdue
    ? 1
    : clamp((URGENCY_HORIZON_H - hoursLeft) / URGENCY_HORIZON_H);

  // --- importance ---
  const catW = CATEGORY_WEIGHT[task.category] ?? 0.5;
  const diffW = DIFFICULTY_WEIGHT[task.difficulty];
  const declared = task.importance ? task.importance / 5 : (catW + diffW) / 2;
  const importance = clamp(0.55 * catW + 0.25 * diffW + 0.2 * declared);

  // --- effort ---
  const effort = clamp(workH / 8); // cap at an 8-hour task

  // --- tightness (workload-aware) ---
  const runway = Math.max(hoursLeft, 0.25);
  const workloadPenalty = ctx.workloadHours ? clamp(ctx.workloadHours / 12) * 0.3 : 0;
  const tightness = overdue
    ? 1
    : clamp(workH / runway + workloadPenalty);

  const composite =
    0.42 * urgency + 0.24 * importance + 0.14 * effort + 0.2 * tightness;
  let score = round(clamp(composite) * 100);

  // Hard floors: a tight or overdue task can't be "low".
  if (overdue) score = Math.max(score, 82);
  if (tightness > 0.95) score = Math.max(score, 70);

  const priority = bandFor(score);

  const factors = [
    { label: "Urgency", weight: round(urgency * 100), detail: urgencyDetail(hoursLeft, overdue) },
    { label: "Importance", weight: round(importance * 100), detail: `${task.category} · ${task.difficulty}` },
    { label: "Effort left", weight: round(effort * 100), detail: `${round(workH, 1)}h remaining` },
    { label: "Tightness", weight: round(tightness * 100), detail: tightnessDetail(workH, runway, overdue) },
  ].sort((a, b) => b.weight - a.weight);

  return { priority, score, reason: buildReason(priority, factors, overdue), factors };
}

function bandFor(score: number): Priority {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function urgencyDetail(hoursLeft: number, overdue: boolean) {
  if (overdue) return `overdue by ${Math.abs(Math.round(hoursLeft))}h`;
  if (hoursLeft < 24) return `due in ${Math.round(hoursLeft)}h`;
  return `due in ${Math.round(hoursLeft / 24)}d`;
}

function tightnessDetail(workH: number, runway: number, overdue: boolean) {
  if (overdue) return "past deadline";
  const ratio = workH / runway;
  if (ratio >= 1) return "needs more time than is left";
  if (ratio >= 0.6) return "little slack";
  return "comfortable slack";
}

function buildReason(
  priority: Priority,
  factors: PriorityResult["factors"],
  overdue: boolean
): string {
  const top = factors[0];
  const second = factors[1];
  if (overdue)
    return `Marked ${priority.toUpperCase()} — this is past its deadline and still unfinished. Clear it first or renegotiate.`;

  const lead =
    priority === "critical"
      ? "Critical"
      : priority === "high"
        ? "High priority"
        : priority === "medium"
          ? "Medium priority"
          : "Low priority";

  return `${lead} — driven mainly by ${top.label.toLowerCase()} (${top.detail}), with ${second.label.toLowerCase()} (${second.detail}) reinforcing it.`;
}
