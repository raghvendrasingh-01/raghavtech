import type { Habit, ProductivityDay, Task, ActivityItem } from "@/lib/types";

/**
 * Pure metric helpers for habits and analytics (no "AI", just math).
 */

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Is this date an "expected" day for the habit's cadence? */
function isDue(habit: Habit, d: Date): boolean {
  if (habit.cadence === "weekdays") {
    const day = d.getDay();
    return day >= 1 && day <= 5;
  }
  return true; // daily & weekly both count any completed day toward streak
}

/** Consecutive completed days up to today (skipping non-due days for weekdays). */
export function computeStreak(habit: Habit, now = new Date()): number {
  const done = new Set(habit.completed);
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  // If today isn't done yet, start counting from yesterday so an in-progress
  // day doesn't break the streak.
  if (!done.has(ymd(cursor))) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 400; i++) {
    if (!isDue(habit, cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (done.has(ymd(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

/** Completions within the last 7 days. */
export function weeklyCount(habit: Habit, now = new Date()): number {
  const done = new Set(habit.completed);
  let count = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    if (done.has(ymd(cursor))) count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Last `days` days as {date, done} for a heatmap/strip, oldest→newest. */
export function habitStrip(habit: Habit, days: number, now = new Date()): { date: string; done: boolean }[] {
  const done = new Set(habit.completed);
  const out: { date: string; done: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({ date: ymd(d), done: done.has(ymd(d)) });
  }
  return out;
}

export interface AnalyticsSummary {
  totalCompleted: number;
  avgFocusHours: number;
  missedDeadlines: number;
  successRate: number; // 0-100
  weekDelta: number; // % change in score, last 7d vs prior 7d
  bestDay: { date: string; score: number } | null;
}

export function summarizeAnalytics(
  history: ProductivityDay[],
  tasks: Task[],
  activity: ActivityItem[]
): AnalyticsSummary {
  const totalCompleted = history.reduce((s, d) => s + d.completed, 0);
  const avgFocusHours = history.length
    ? Math.round((history.reduce((s, d) => s + d.focusHours, 0) / history.length) * 10) / 10
    : 0;

  const missedDeadlines =
    tasks.filter((t) => t.status === "missed").length +
    activity.filter((a) => a.kind === "missed").length;

  // Success rate = how much of everything due actually got done. Based on the
  // full completion history (not just currently-open tasks) so it stays stable.
  const completedTotal = totalCompleted + tasks.filter((t) => t.status === "done").length;
  const successRate =
    completedTotal + missedDeadlines > 0
      ? Math.round((completedTotal / (completedTotal + missedDeadlines)) * 100)
      : 92;

  const last7 = history.slice(-7);
  const prev7 = history.slice(-14, -7);
  const avg = (arr: ProductivityDay[]) => (arr.length ? arr.reduce((s, d) => s + d.score, 0) / arr.length : 0);
  const weekDelta = prev7.length ? Math.round(avg(last7) - avg(prev7)) : 0;

  const bestDay = history.length
    ? history.reduce((best, d) => (d.score > best.score ? d : best), history[0])
    : null;

  return {
    totalCompleted,
    avgFocusHours,
    missedDeadlines,
    successRate,
    weekDelta,
    bestDay: bestDay ? { date: bestDay.date, score: bestDay.score } : null,
  };
}
