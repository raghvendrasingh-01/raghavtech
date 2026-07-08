import type { Task, CalendarEvent, RiskResult } from "@/lib/types";
import { clamp, round } from "@/lib/utils";
import { workRemainingMin } from "./priority";

/**
 * Deadline-risk engine.
 *
 * risk = f(work_remaining, free_time_before_deadline)
 *
 * Free time is computed from the real calendar: for every day between now and
 * the deadline we take the waking work window (default 08:00–22:00) and
 * subtract any meetings/classes/events that overlap it. "Coverage" is how many
 * times over your free time covers the work still required; the more slack,
 * the lower the risk. This is the engine behind the "you are likely to miss
 * this — start now" nudges.
 */

export interface RiskContext {
  now?: Date;
  events?: CalendarEvent[];
  dayStartHour?: number; // default 8
  dayEndHour?: number; // default 22
}

function atHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function overlapMinutes(aS: Date, aE: Date, bS: Date, bE: Date): number {
  const s = Math.max(aS.getTime(), bS.getTime());
  const e = Math.min(aE.getTime(), bE.getTime());
  return Math.max(0, (e - s) / 60000);
}

/** Free waking minutes between `now` and `deadline`, minus busy events. */
export function freeMinutesBefore(
  deadlineIso: string,
  ctx: RiskContext = {}
): number {
  const now = ctx.now ?? new Date();
  const end = new Date(deadlineIso);
  if (end <= now) return 0;

  const dayStart = ctx.dayStartHour ?? 8;
  const dayEnd = ctx.dayEndHour ?? 22;
  const events = ctx.events ?? [];

  let free = 0;
  const cursor = new Date(now);

  // Safety bound — never loop more than ~60 days.
  for (let i = 0; i < 60 && cursor < end; i++) {
    const windowStart = new Date(Math.max(cursor.getTime(), atHour(cursor, dayStart).getTime()));
    const windowEnd = new Date(Math.min(end.getTime(), atHour(cursor, dayEnd).getTime()));

    if (windowEnd > windowStart) {
      let avail = (windowEnd.getTime() - windowStart.getTime()) / 60000;
      for (const ev of events) {
        avail -= overlapMinutes(windowStart, windowEnd, new Date(ev.start), new Date(ev.end));
      }
      free += Math.max(0, avail);
    }

    // advance to next calendar day at 00:00
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return round(free);
}

/** Map coverage (free / work) to a monotonic 0-99 risk. */
function riskFromCoverage(coverage: number): number {
  if (!isFinite(coverage)) return 2;
  if (coverage >= 1.5) return clamp(10 - (coverage - 1.5) * 8, 2, 10);
  if (coverage >= 1.0) return 45 - ((coverage - 1.0) / 0.5) * 35; // 1.0→45, 1.5→10
  if (coverage >= 0.5) return 80 - ((coverage - 0.5) / 0.5) * 35; // 0.5→80, 1.0→45
  return 99 - (coverage / 0.5) * 19; // 0→99, 0.5→80
}

export function computeRisk(task: Task, ctx: RiskContext = {}): RiskResult {
  const now = ctx.now ?? new Date();
  const workMin = workRemainingMin(task);
  const freeMin = freeMinutesBefore(task.deadline, ctx);
  const past = new Date(task.deadline) <= now;

  if (task.status === "done" || workMin <= 0) {
    return {
      risk: 0,
      level: "safe",
      workRemainingMin: 0,
      freeTimeBeforeDeadlineMin: freeMin,
      message: "Done — nothing left to worry about.",
      recommendation: "Nice. One less thing on your plate.",
    };
  }

  let risk: number;
  if (past) risk = 99;
  else if (freeMin <= 0) risk = 97;
  else risk = riskFromCoverage(freeMin / workMin);

  risk = round(clamp(risk, 0, 99));
  const level = risk >= 80 ? "critical" : risk >= 55 ? "high" : risk >= 30 ? "watch" : "safe";

  const workH = round(workMin / 60, 1);
  const freeH = round(freeMin / 60, 1);

  return {
    risk,
    level,
    workRemainingMin: workMin,
    freeTimeBeforeDeadlineMin: freeMin,
    message: message(level, workH, freeH, past),
    recommendation: recommendation(level, workMin, freeMin),
  };
}

function message(
  level: RiskResult["level"],
  workH: number,
  freeH: number,
  past: boolean
): string {
  if (past) return "This deadline has passed and the task is unfinished.";
  switch (level) {
    case "critical":
      return `You are likely to miss this. ~${workH}h of work remain but only ~${freeH}h are free before the deadline.`;
    case "high":
      return `Cutting it close. ~${workH}h of work vs. ~${freeH}h free — one distraction and it slips.`;
    case "watch":
      return `On track, but no room to waste. ~${workH}h of work, ~${freeH}h available.`;
    default:
      return `Comfortable. ~${freeH}h free for ~${workH}h of work.`;
  }
}

function recommendation(
  level: RiskResult["level"],
  workMin: number,
  freeMin: number
): string {
  switch (level) {
    case "critical":
      return freeMin <= 0
        ? "There isn't enough free time — cut scope, delegate, or move the deadline. I can break it into a minimal version."
        : "Start immediately and protect a focus block now. Let me reshuffle your day to fit it.";
    case "high":
      return "Block a focus session in your next free slot today. I can schedule it for you.";
    case "watch":
      return "Slot it into today or tomorrow morning so a surprise meeting can't derail it.";
    default:
      return "No action needed yet — I'll keep watching it.";
  }
}
