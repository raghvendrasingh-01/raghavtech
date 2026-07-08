"use client";

import { CalendarClock } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { Widget } from "./widget";
import { CATEGORY_META } from "@/lib/ui-maps";
import { formatDate, formatTime, relativeTime, cn } from "@/lib/utils";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import type { TaskWithIntel } from "@/lib/types";
import * as React from "react";

export function UpcomingDeadlines() {
  const { tasksDerived, now } = useStore();
  const [editingTask, setEditingTask] = React.useState<TaskWithIntel | null>(null);
  const deadlines = tasksDerived
    .filter((t) => t.status !== "done")
    .slice()
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  return (
    <Widget title="Upcoming deadlines" icon={CalendarClock} href="/tasks">
      <div className="space-y-1">
        {deadlines.map((t) => {
          const meta = CATEGORY_META[t.category];
          const soon = new Date(t.deadline).getTime() - now.getTime() < 12 * 3_600_000;
          return (
            <div 
              key={t.id} 
              onClick={() => setEditingTask(t)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface/50"
            >
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.bg)}>
                <meta.icon className={cn("h-4 w-4", meta.text)} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{t.title}</p>
                <p className="text-[11px] text-subtle">
                  {formatDate(t.deadline)} · {formatTime(t.deadline)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium",
                  soon ? "bg-critical/12 text-critical" : "bg-surface-2 text-muted"
                )}
              >
                {relativeTime(t.deadline, now)}
              </span>
            </div>
          );
        })}
      </div>
      {editingTask && (
        <TaskEditDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      )}
    </Widget>
  );
}
