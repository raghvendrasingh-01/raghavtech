"use client";

import { CalendarClock, RefreshCw, Coffee, Zap, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/components/providers/demo-store";
import { Widget } from "./widget";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import type { TaskWithIntel } from "@/lib/types";
import * as React from "react";

export function TodaySchedule() {
  const { schedule, tasksDerived, regenerate, now } = useStore();
  const [editingTask, setEditingTask] = React.useState<TaskWithIntel | null>(null);

  // Only blocks that haven't fully ended yet, plus a little history.
  const blocks = schedule.filter((b) => new Date(b.end).getTime() > now.getTime() - 30 * 60000);

  return (
    <Widget
      title="Today's schedule"
      icon={CalendarClock}
      action={
        <button
          onClick={regenerate}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:text-fg"
        >
          <RefreshCw className="h-3 w-3" /> Regenerate
        </button>
      }
      href="/planner"
    >
      {blocks.length === 0 ? (
        <p className="py-8 text-center text-sm text-subtle">Nothing left scheduled today. Time to rest 🌙</p>
      ) : (
        <div className="relative space-y-1.5">
          {blocks.map((b, i) => {
            const isBreak = b.kind === "break";
            const isEvent = b.kind === "event";
            const Icon = isBreak ? Coffee : isEvent ? CalendarClock : b.rescue ? Zap : Sparkles;
            const live =
              new Date(b.start).getTime() <= now.getTime() && new Date(b.end).getTime() > now.getTime();
            return (
              <motion.div
                key={b.id}
                onClick={() => {
                  if (b.taskId) {
                    const task = tasksDerived.find(t => t.id === b.taskId);
                    if (task) setEditingTask(task);
                  }
                }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  b.taskId && "cursor-pointer hover:bg-surface-2/50",
                  live ? "border-brand/40 bg-brand/8" : "border-border bg-surface/40",
                  b.rescue && "border-critical/40 bg-critical/8"
                )}
              >
                <span className="w-24 shrink-0 font-mono text-[11px] text-subtle">
                  {formatTime(b.start)}–{formatTime(b.end)}
                </span>
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                    isBreak ? "bg-low/15 text-low" : isEvent ? "bg-medium/15 text-medium" : b.rescue ? "bg-critical/15 text-critical" : "bg-brand/15 text-brand"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 truncate text-sm text-fg">{b.title}</span>
                {live && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Now
                  </span>
                )}
                {b.rescue && !live && (
                  <span className="rounded-md bg-critical/15 px-1.5 py-0.5 text-[10px] font-medium text-critical">Rescue</span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
      {editingTask && (
        <TaskEditDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      )}
    </Widget>
  );
}
