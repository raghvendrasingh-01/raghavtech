"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Sparkles, Check, Wand2, Plus, Flag } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { suggestMilestones } from "@/lib/intelligence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { CATEGORY_META } from "@/lib/ui-maps";
import { formatDate, cn } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export function GoalsView() {
  const { goals, addGoal, toggleMilestone, now } = useStore();
  const [title, setTitle] = React.useState("");

  const preview = title.trim().length > 2 ? suggestMilestones(title) : [];

  function create() {
    if (preview.length === 0) return;
    const totalWeeks = preview.reduce((s, m) => s + m.etaWeeks, 0);
    const target = new Date(now);
    target.setDate(target.getDate() + totalWeeks * 7);
    const goal: Goal = {
      id: `g-${now.getTime()}`,
      title: title.trim(),
      description: "AI-generated roadmap",
      targetDate: target.toISOString(),
      progress: 0,
      category: "project",
      milestones: preview.map((m, i) => ({ id: `gm-${i}-${now.getTime()}`, title: m.title, done: false, etaWeeks: m.etaWeeks })),
    };
    addGoal(goal);
    setTitle("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-fg">Goals</h2>
        <p className="text-xs text-subtle">Tell Pulse a goal — it builds the roadmap and the daily plan.</p>
      </div>

      {/* AI Goal Planner */}
      <div className="glass card-sheen rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-brand">
          <Wand2 className="h-3.5 w-3.5" /> AI Goal Planner
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="e.g. Crack a Google internship, get fit, launch my app…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create} disabled={preview.length === 0} className="shrink-0">
            <Sparkles className="h-4 w-4" /> Generate plan
          </Button>
        </div>

        <AnimatePresence>
          {preview.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <p className="mb-2 text-xs text-subtle">Pulse suggests this roadmap:</p>
              <div className="flex flex-wrap gap-2">
                {preview.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/40 px-2.5 py-1.5 text-xs text-fg">
                    <Flag className="h-3 w-3 text-brand" />
                    {m.title}
                    <span className="text-subtle">· {m.etaWeeks}w</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Goal cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((g) => {
          const meta = CATEGORY_META[g.category];
          const doneCount = g.milestones.filter((m) => m.done).length;
          return (
            <div key={g.id} className="glass card-sheen rounded-3xl p-5">
              <div className="flex items-start gap-4">
                <RadialGauge value={Math.round(g.progress * 100)} size={84} stroke={8} tone="brand" sublabel="done" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("grid h-6 w-6 place-items-center rounded-lg", meta.bg)}>
                      <meta.icon className={cn("h-3.5 w-3.5", meta.text)} />
                    </span>
                    <h3 className="truncate font-display text-base font-semibold text-fg">{g.title}</h3>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    Target {formatDate(g.targetDate)} · {doneCount}/{g.milestones.length} milestones
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {g.milestones.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMilestone(g.id, m.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface/50"
                  >
                    <span
                      className={cn(
                        "grid h-4.5 w-4.5 shrink-0 place-items-center rounded border",
                        m.done ? "border-brand bg-brand text-white" : "border-border-strong text-transparent"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className={cn("flex-1", m.done ? "text-subtle line-through" : "text-fg")}>{m.title}</span>
                    <span className="text-[11px] text-subtle">{m.etaWeeks}w</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
