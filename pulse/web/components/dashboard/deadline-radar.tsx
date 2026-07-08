"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, Wand2, Check, Scissors, ArrowRight } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import type { TaskWithIntel } from "@/lib/types";

/**
 * The Deadline Radar — surfaces the single most at-risk task with its live
 * miss-risk gauge and one-click recovery actions. This is Pulse's signature
 * "save me from myself" moment.
 */
export function DeadlineRadar() {
  const { tasksDerived, regenerate, now } = useStore();
  const [rescued, setRescued] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithIntel | null>(null);

  const top = tasksDerived
    .filter((t) => t.status !== "done")
    .sort((a, b) => b.riskResult.risk - a.riskResult.risk)[0];

  if (!top) return null;
  const { riskResult: r } = top;
  const calm = r.risk < 40;

  return (
    <div 
      className="card-sheen glass relative cursor-pointer overflow-hidden rounded-3xl p-6 transition-all hover:ring-1 hover:ring-brand/30"
      onClick={() => setEditingTask(top)}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: calm ? "var(--color-low)" : r.risk >= 70 ? "var(--color-critical)" : "var(--color-high)", opacity: 0.14 }}
      />
      <div className="flex items-center gap-2 text-xs font-medium">
        <ShieldAlert className={calm ? "h-4 w-4 text-low" : "h-4 w-4 text-critical"} />
        <span className={calm ? "text-low" : "text-critical"}>Deadline Radar</span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <RadialGauge value={r.risk} size={150} sublabel="miss risk" className="shrink-0" />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h3 className="truncate font-display text-xl font-semibold text-fg">{top.title}</h3>
          <p className="mt-0.5 text-xs text-subtle">
            due {relativeTime(top.deadline, now)} · {Math.round(r.workRemainingMin / 60 * 10) / 10}h left of work
          </p>
          <p className="mt-3 text-sm text-muted">{r.message}</p>
          <p className="mt-1 text-sm font-medium text-fg">{r.recommendation}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button
              size="sm"
              variant={calm ? "secondary" : "primary"}
              onClick={(e) => {
                e.stopPropagation();
                regenerate();
                setRescued(true);
                setTimeout(() => setRescued(false), 2600);
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {rescued ? (
                  <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Day rebuilt
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5">
                    <Wand2 className="h-4 w-4" /> Rescue my day
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                setEditingTask(top);
              }}
            >
              <Scissors className="h-4 w-4" /> Break it down
            </Button>
            <Link href="/planner" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost">
                Plan around it <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {editingTask && (
        <TaskEditDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      )}
    </div>
  );
}
