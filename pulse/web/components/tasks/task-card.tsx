"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ListTree, ShieldAlert, Clock, Pencil, Trash2, Paperclip } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CATEGORY_META } from "@/lib/ui-maps";
import { relativeTime, formatDuration, cn } from "@/lib/utils";
import type { TaskWithIntel } from "@/lib/types";
import { TaskEditDialog } from "./task-edit-dialog";

export function TaskCard({ task, defaultOpen = false }: { task: TaskWithIntel; defaultOpen?: boolean }) {
  const { toggleSubtask, completeTask, deleteTask, now } = useStore();
  const [open, setOpen] = React.useState(defaultOpen);
  const [editOpen, setEditOpen] = React.useState(false);
  const meta = CATEGORY_META[task.category];
  const done = task.status === "done";
  const overdue = !done && new Date(task.deadline).getTime() < now.getTime();
  const r = task.riskResult;

  return (
    <div className={cn("glass card-sheen overflow-hidden rounded-2xl transition-opacity", done && "opacity-55")}>
      <div className="flex items-center gap-3 p-3.5">
        <button
          onClick={() => completeTask(task.id)}
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-all",
            done ? "border-success bg-success text-white" : "border-border-strong text-transparent hover:border-success hover:text-success"
          )}
          aria-label="Complete task"
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", meta.bg)}>
          <meta.icon className={cn("h-4.5 w-4.5", meta.text)} />
        </span>

        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={cn("truncate text-sm font-medium text-fg", done && "line-through")}>{task.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={task.priorityResult.priority} className="scale-90">
              {task.priorityResult.priority}
            </Badge>
            <span className={cn("text-[11px]", overdue ? "text-critical" : "text-subtle")}>due {relativeTime(task.deadline, now)}</span>
            {task.subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
                <ListTree className="h-3 w-3" />
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
          </div>
        </button>

        {!done && (
          <div className="hidden text-right sm:block">
            <div className={cn("font-display text-sm font-semibold", r.risk >= 70 ? "text-critical" : r.risk >= 40 ? "text-high" : "text-low")}>
              {r.risk}%
            </div>
            <div className="text-[9px] uppercase tracking-wide text-subtle">risk</div>
          </div>
        )}

        <button onClick={() => setOpen((o) => !o)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:text-fg">
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <div className="px-3.5 pb-2">
        <Progress value={task.progress} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="space-y-4 border-t border-border px-4 py-4">
              {task.description && <p className="text-sm text-muted">{task.description}</p>}

              {/* Why this priority */}
              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="text-xs font-medium text-fg">Why {task.priorityResult.priority}?</p>
                <p className="mt-1 text-xs text-muted">{task.priorityResult.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {task.priorityResult.factors.map((f) => (
                    <span key={f.label} className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-subtle">
                      {f.label} {f.weight}
                    </span>
                  ))}
                </div>
              </div>

              {/* Risk */}
              {!done && (
                <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/40 p-3 text-xs">
                  <ShieldAlert className={cn("mt-0.5 h-4 w-4 shrink-0", r.risk >= 55 ? "text-critical" : "text-low")} />
                  <div>
                    <p className="text-muted">{r.message}</p>
                    <p className="mt-1 font-medium text-fg">{r.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Subtasks */}
              {task.subtasks.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted">Subtasks</p>
                  <div className="space-y-1">
                    {task.subtasks.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleSubtask(task.id, s.id)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface/50"
                      >
                        <span
                          className={cn(
                            "grid h-4.5 w-4.5 shrink-0 place-items-center rounded border",
                            s.done ? "border-brand bg-brand text-white" : "border-border-strong text-transparent"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className={cn("flex-1", s.done ? "text-subtle line-through" : "text-fg")}>{s.title}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
                          <Clock className="h-3 w-3" />
                          {formatDuration(s.estimateMin)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {task.attachments && task.attachments.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {task.attachments.map((url, i) => {
                      const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) != null || url.includes('image');
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative flex h-16 w-16 overflow-hidden rounded-lg border border-border bg-surface/50 transition hover:border-brand"
                          title="View attachment"
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="Attachment" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <Paperclip className="h-5 w-5 text-subtle transition group-hover:text-brand" />
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex items-center gap-2 pt-2 border-t border-border/50">
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-surface-2 py-2 text-xs font-medium text-fg transition hover:bg-surface-3"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-critical/10 py-2 text-xs font-medium text-critical transition hover:bg-critical/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {editOpen && <TaskEditDialog open={editOpen} onClose={() => setEditOpen(false)} task={task} />}
    </div>
  );
}
