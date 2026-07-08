import type { Task, CalendarEvent, ScheduleBlock } from "@/lib/types";
import { computePriority, workRemainingMin } from "./priority";
import { computeRisk } from "./risk";

/**
 * Smart scheduler.
 *
 * Reads your calendar (meetings, classes, events), finds the free gaps in the
 * working window, and greedily packs the most important / most at-risk tasks
 * into focus blocks — inserting short breaks so the day stays humane.
 *
 * Placement order: highest priority score first, ties broken by nearest
 * deadline. At-risk tasks are flagged `rescue`. `generateRange` carries each
 * task's *remaining* work across days, so a task is scheduled until it's done
 * and the next task fills later days (no duplicate-forever bug).
 */

export interface ScheduleOptions {
  tasks: Task[];
  events: CalendarEvent[];
  pinnedBlocks?: ScheduleBlock[];
  now?: Date;
  date?: Date;
  dayStartHour?: number;
  dayEndHour?: number;
  maxFocusMin?: number;
  breakMin?: number;
}

export interface ScheduleResult {
  blocks: ScheduleBlock[];
  unplaced: { taskId: string; title: string; minutes: number }[];
}

interface Gap {
  start: number;
  end: number;
}

interface Candidate {
  task: Task;
  remaining: number;
  score: number;
  risk: number;
  deadline: number;
}

function atHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeGaps(startMs: number, endMs: number, busy: { s: number; e: number }[]): Gap[] {
  const gaps: Gap[] = [];
  let cursor = startMs;
  const sorted = [...busy].sort((a, b) => a.s - b.s);
  for (const b of sorted) {
    if (b.s > cursor) gaps.push({ start: cursor, end: Math.min(b.s, endMs) });
    cursor = Math.max(cursor, b.e);
    if (cursor >= endMs) break;
  }
  if (cursor < endMs) gaps.push({ start: cursor, end: endMs });
  return gaps.filter((g) => g.end - g.start >= 10 * 60000);
}

let blockSeq = 0;
function blockId(prefix: string) {
  blockSeq += 1;
  return `${prefix}-${blockSeq}`;
}

function buildCandidates(tasks: Task[], events: CalendarEvent[], now: Date): Candidate[] {
  return tasks
    .filter((t) => t.status !== "done" && t.status !== "missed" && workRemainingMin(t) > 0)
    .map((t) => ({
      task: t,
      remaining: workRemainingMin(t),
      score: computePriority(t, { now }).score,
      risk: computeRisk(t, { now, events }).risk,
      deadline: new Date(t.deadline).getTime(),
    }))
    .sort((a, b) => b.score - a.score || a.deadline - b.deadline);
}

/** Fill one day's gaps from the shared candidate pool, depleting `remaining`. */
function fillDay(
  date: Date,
  now: Date,
  events: CalendarEvent[],
  pinnedBlocks: ScheduleBlock[],
  candidates: Candidate[],
  opts: { dayStart: number; dayEnd: number; maxFocus: number; breakMin: number }
): ScheduleBlock[] {
  const { dayStart, dayEnd, maxFocus, breakMin } = opts;
  const windowStart = sameDay(date, now)
    ? Math.max(now.getTime(), atHour(date, dayStart).getTime())
    : atHour(date, dayStart).getTime();
  const windowEnd = atHour(date, dayEnd).getTime();

  const dayEvents = events.filter((e) => sameDay(new Date(e.start), date));
  const busy = dayEvents.map((e) => ({ s: new Date(e.start).getTime(), e: new Date(e.end).getTime() }));

  const blocks: ScheduleBlock[] = dayEvents.map((e) => ({
    id: blockId("evt"),
    title: e.title,
    kind: "event",
    start: e.start,
    end: e.end,
  }));

  const dayPinned = pinnedBlocks.filter((b) => sameDay(new Date(b.start), date));
  for (const b of dayPinned) {
    if (b.taskId) {
      const cand = candidates.find((c) => c.task.id === b.taskId);
      if (cand) {
        const mins = (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000;
        cand.remaining = Math.max(0, cand.remaining - mins);
      }
    }
    busy.push({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime() });
    blocks.push({ ...b, pinned: true });
  }

  const gaps = computeGaps(windowStart, windowEnd, busy);
  let sinceBreak = 0;

  for (const gap of gaps) {
    let cursor = gap.start;
    while (cursor < gap.end) {
      // next candidate with work left and a deadline still ahead of the cursor
      const cand = candidates.find((c) => {
        if (c.remaining <= 0 || c.deadline <= cursor) return false;
        
        const taskDate = new Date(c.deadline);
        const isSameDay = taskDate.getFullYear() === date.getFullYear() && 
                          taskDate.getMonth() === date.getMonth() && 
                          taskDate.getDate() === date.getDate();
        
        // 1. If we've reached the exact day of the deadline (or we are overdue), schedule it!
        if (isSameDay || cursor >= c.deadline) return true;
        
        // 2. If it's a massive task (needs > 1 hour per day of pacing), let it start early.
        const daysUntilDeadline = (c.deadline - cursor) / (1000 * 3600 * 24);
        const maxHoursPerDay = (c.remaining / 60) / Math.max(1, daysUntilDeadline);
        if (maxHoursPerDay > 1.0) return true;

        // Otherwise, defer it! Don't schedule tasks days in advance if they can be done on the deadline.
        return false;
      });
      if (!cand) break;

      const gapLeft = (gap.end - cursor) / 60000;
      if (gapLeft < 15) break;

      if (sinceBreak >= 105 && gapLeft > breakMin + 15) {
        const bEnd = cursor + breakMin * 60000;
        blocks.push({ id: blockId("brk"), title: "Break", kind: "break", start: new Date(cursor).toISOString(), end: new Date(bEnd).toISOString() });
        cursor = bEnd;
        sinceBreak = 0;
        continue;
      }

      // never schedule past the task's own deadline
      const untilDeadline = (cand.deadline - cursor) / 60000;
      const chunk = Math.min(cand.remaining, maxFocus, gapLeft, untilDeadline);
      if (chunk < 15) {
        // can't use this candidate here; mark tiny leftover as unschedulable in this gap
        if (untilDeadline < 15) cand.remaining = Math.min(cand.remaining, 0.0001);
        break;
      }

      const bEnd = cursor + chunk * 60000;
      blocks.push({
        id: blockId("task"),
        title: cand.task.title,
        kind: "focus",
        start: new Date(cursor).toISOString(),
        end: new Date(bEnd).toISOString(),
        taskId: cand.task.id,
        category: cand.task.category,
        rescue: cand.risk >= 55,
      });
      cursor = bEnd;
      cand.remaining -= chunk;
      sinceBreak += chunk;
    }
  }

  blocks.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return blocks;
}

export function generateSchedule(opts: ScheduleOptions): ScheduleResult {
  const now = opts.now ?? new Date();
  const date = opts.date ?? now;
  const cfg = {
    dayStart: opts.dayStartHour ?? 8,
    dayEnd: opts.dayEndHour ?? 22,
    maxFocus: opts.maxFocusMin ?? 90,
    breakMin: opts.breakMin ?? 15,
  };

  const candidates = buildCandidates(opts.tasks, opts.events, now);
  const blocks = fillDay(date, now, opts.events, opts.pinnedBlocks || [], candidates, cfg);
  const unplaced = candidates
    .filter((c) => c.remaining >= 1)
    .map((c) => ({ taskId: c.task.id, title: c.task.title, minutes: Math.round(c.remaining) }));

  return { blocks, unplaced };
}

export interface RangeResult {
  days: { date: Date; blocks: ScheduleBlock[] }[];
  unplaced: { taskId: string; title: string; minutes: number }[];
}

/** Schedule several consecutive days, carrying each task's remaining work forward. */
export function generateRange(opts: {
  tasks: Task[];
  events: CalendarEvent[];
  pinnedBlocks?: ScheduleBlock[];
  now?: Date;
  days?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  maxFocusMin?: number;
  breakMin?: number;
}): RangeResult {
  const now = opts.now ?? new Date();
  const dayCount = opts.days ?? 7;
  const cfg = {
    dayStart: opts.dayStartHour ?? 8,
    dayEnd: opts.dayEndHour ?? 22,
    maxFocus: opts.maxFocusMin ?? 90,
    breakMin: opts.breakMin ?? 15,
  };

  const candidates = buildCandidates(opts.tasks, opts.events, now);
  const days: RangeResult["days"] = [];

  for (let i = 0; i < dayCount; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const blocks = fillDay(date, now, opts.events, opts.pinnedBlocks || [], candidates, cfg);
    days.push({ date, blocks });
  }

  const unplaced = candidates
    .filter((c) => c.remaining >= 1)
    .map((c) => ({ taskId: c.task.id, title: c.task.title, minutes: Math.round(c.remaining) }));

  return { days, unplaced };
}
