"use client";

import { Flame, Check } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { Widget } from "./widget";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CATEGORY_META } from "@/lib/ui-maps";
import { relativeTime, cn } from "@/lib/utils";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import type { TaskWithIntel } from "@/lib/types";
import * as React from "react";

export function UrgentTasks() {
  const { tasksDerived, completeTask, now } = useStore();
  const [editingTask, setEditingTask] = React.useState<TaskWithIntel | null>(null);

  const tasks = tasksDerived
    .filter((t) => t.status !== "done")
    .filter((t) => {
      const days = (new Date(t.deadline).getTime() - now.getTime()) / (1000 * 3600 * 24);
      return t.priorityResult.priority === "urgent" || t.priorityResult.priority === "high" || days <= 3;
    })
    .slice(0, 5);

  return (
    <Widget title="Urgent tasks" icon={Flame} href="/tasks">
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-border border-dashed bg-surface/30 px-3 py-6 text-center text-sm text-subtle">
            No urgent tasks right now. You're all caught up!
          </div>
        ) : (
          tasks.map((t) => {
            const meta = CATEGORY_META[t.category];
            const overdue = new Date(t.deadline).getTime() < now.getTime();
            return (
              <div
                key={t.id}
                onClick={() => setEditingTask(t)}
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface/40 px-3 py-2.5 transition-colors hover:bg-surface-2/40"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    completeTask(t.id);
                  }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border-strong text-transparent transition-all hover:border-success hover:text-success"
                  aria-label="Complete task"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.bg)}>
                  <meta.icon className={cn("h-4 w-4", meta.text)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{t.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={t.priorityResult.priority} className="scale-90">
                      {t.priorityResult.priority}
                    </Badge>
                    <span className={cn("text-[11px]", overdue ? "text-critical" : "text-subtle")}>
                      due {relativeTime(t.deadline, now)}
                    </span>
                  </div>
                </div>
                <div className="hidden w-20 shrink-0 sm:block">
                  <Progress value={t.progress} />
                  <div className="mt-1 text-right text-[10px] text-subtle">{Math.round(t.progress * 100)}%</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {editingTask && (
        <TaskEditDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      )}
    </Widget>
  );
}
