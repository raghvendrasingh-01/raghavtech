"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { generateRange } from "@/lib/intelligence";
import { formatTime, cn } from "@/lib/utils";
import type { ScheduleBlock, TaskWithIntel } from "@/lib/types";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";

const DAY_START = 7;
const DAY_END = 23;
const HOUR_PX = 46;

const BLOCK_STYLE: Record<string, string> = {
  event: "bg-medium/20 border-medium/40 text-fg",
  focus: "bg-brand/20 border-brand/40 text-fg",
  task: "bg-brand/20 border-brand/40 text-fg",
  break: "bg-low/15 border-low/30 text-muted",
  buffer: "bg-surface-2 border-border text-subtle",
};

export function CalendarView() {
  const { tasks, tasksDerived, events, now } = useStore();
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [editingTask, setEditingTask] = React.useState<TaskWithIntel | null>(null);

  const start = React.useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now, weekOffset]);

  // Schedule enough days to cover this window (offset can be future).
  const daysAhead = Math.max(0, weekOffset * 7);
  const { days: range } = React.useMemo(
    () => generateRange({ tasks, events, now, days: daysAhead + 7, dayStartHour: DAY_START, dayEndHour: DAY_END }),
    [tasks, events, now, daysAhead]
  );

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const entry = range.find((r) => r.date.toDateString() === date.toDateString());
    const blocks = entry?.blocks ?? events.filter((e) => new Date(e.start).toDateString() === date.toDateString()).map(toBlock);
    const deadlines = tasks.filter((t) => t.status !== "done" && new Date(t.deadline).toDateString() === date.toDateString());
    return { date, blocks, deadlines, isToday: date.toDateString() === now.toDateString() };
  });

  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(start.getTime() + 6 * 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-fg">Calendar</h2>
          <p className="text-xs text-subtle">Your meetings, plus the focus blocks Pulse scheduled for you.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:text-fg">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-36 text-center text-sm font-semibold text-fg">{label}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:text-fg">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-brand hover:underline">
              This week
            </button>
          )}
        </div>
      </div>

      <div className="glass card-sheen overflow-hidden rounded-3xl">
        {/* Day headers */}
        <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-border">
          <div />
          {week.map((d) => (
            <div key={d.date.toISOString()} className={cn("border-l border-border px-2 py-2 text-center", d.isToday && "bg-brand/8")}>
              <div className="text-[10px] uppercase tracking-wide text-subtle">
                {d.date.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className={cn("font-display text-sm font-semibold", d.isToday ? "text-brand" : "text-fg")}>{d.date.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[3rem_repeat(7,1fr)]" style={{ minWidth: 720 }}>
            {/* hour gutter */}
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-subtle" style={{ top: (h - DAY_START) * HOUR_PX }}>
                  {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "a" : "p"}
                </div>
              ))}
            </div>

            {/* day columns */}
            {week.map((d) => (
              <div key={d.date.toISOString()} className={cn("relative border-l border-border", d.isToday && "bg-brand/[0.04]")} style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: (h - DAY_START) * HOUR_PX }} />
                ))}

                {d.blocks.filter((b) => b.kind !== "buffer").map((b) => {
                  const top = pos(b.start);
                  const height = Math.max(18, pos(b.end) - top);
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        if (b.taskId) {
                          const task = tasksDerived.find((t) => t.id === b.taskId);
                          if (task) setEditingTask(task);
                        }
                      }}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-lg border px-1.5 py-1", 
                        BLOCK_STYLE[b.kind], 
                        b.rescue && "border-critical/50 bg-critical/15",
                        b.taskId && "cursor-pointer hover:opacity-80 transition-opacity"
                      )}
                      style={{ top: top + 1, height: height - 2 }}
                    >
                      <div className="truncate text-[10px] font-medium leading-tight">{b.title}</div>
                      {height > 30 && <div className="truncate text-[9px] text-subtle">{formatTime(b.start)}</div>}
                    </div>
                  );
                })}

                {/* deadline markers */}
                {d.deadlines.map((t) => (
                  <div 
                    key={t.id} 
                    onClick={() => {
                      const derived = tasksDerived.find(td => td.id === t.id);
                      if (derived) setEditingTask(derived);
                    }}
                    className="absolute inset-x-0 z-10 flex cursor-pointer items-center gap-1 hover:opacity-80 transition-opacity" 
                    style={{ top: pos(t.deadline) }}
                  >
                    <span className="h-px flex-1 bg-critical/60" />
                    <span className="rounded bg-critical/20 px-1 text-[8px] font-medium text-critical">⚑ {t.title.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-subtle">
        <Legend color="bg-medium" label="Meeting / event" />
        <Legend color="bg-brand" label="Focus block (AI)" />
        <Legend color="bg-critical" label="Deadline / rescue" />
        <span className="inline-flex items-center gap-1 text-brand"><Sparkles className="h-3 w-3" /> Focus blocks are auto-scheduled</span>
      </div>

      {editingTask && (
        <TaskEditDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      )}
    </div>
  );

  function pos(iso: string) {
    const d = new Date(iso);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, (h - DAY_START) * HOUR_PX);
  }
}

function toBlock(e: { id: string; title: string; start: string; end: string }): ScheduleBlock {
  return { id: e.id, title: e.title, kind: "event", start: e.start, end: e.end };
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", color)} />
      {label}
    </span>
  );
}
