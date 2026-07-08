"use client";

import { Flame, Check, Code2, BookOpen, Dumbbell, Brain, Languages, Moon, Plus, type LucideIcon } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useStore } from "@/components/providers/demo-store";
import { computeStreak, weeklyCount, habitStrip } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { Habit } from "@/lib/types";

const HABIT_ICONS: Record<string, LucideIcon> = {
  Code2, BookOpen, Dumbbell, Brain, Languages, Moon,
};

const COLOR: Record<string, { text: string; bg: string; bar: string }> = {
  brand: { text: "text-brand", bg: "bg-brand/12", bar: "var(--color-brand)" },
  critical: { text: "text-critical", bg: "bg-critical/12", bar: "var(--color-critical)" },
  high: { text: "text-high", bg: "bg-high/12", bar: "var(--color-high)" },
  medium: { text: "text-medium", bg: "bg-medium/12", bar: "var(--color-medium)" },
  low: { text: "text-low", bg: "bg-low/12", bar: "var(--color-low)" },
};

export function HabitsView() {
  const { habits, toggleHabit, now } = useStore();
  const today = now.toISOString().slice(0, 10);

  const bestStreak = Math.max(0, ...habits.map((h) => computeStreak(h, now)));
  const weekPct = Math.round(
    (habits.reduce((s, h) => s + Math.min(weeklyCount(h, now), h.targetPerWeek), 0) /
      Math.max(1, habits.reduce((s, h) => s + h.targetPerWeek, 0))) *
      100
  );

  // Aggregate completions per day (last 14 days) across all habits.
  const chart = habitStrip(habits[0] ?? ({ completed: [] } as unknown as Habit), 14, now).map((d) => {
    const count = habits.filter((h) => h.completed.includes(d.date)).length;
    return { date: d.date.slice(5), count };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-fg">Habits</h2>
          <p className="text-xs text-subtle">Small daily wins compound. Keep the streak alive.</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Active habits" value={habits.length} />
          <Stat label="Best streak" value={`${bestStreak}d`} accent="text-high" />
          <Stat label="This week" value={`${weekPct}%`} accent="text-brand" />
        </div>
      </div>

      {/* Weekly chart */}
      <div className="glass card-sheen rounded-3xl p-5">
        <p className="mb-3 font-display text-sm font-semibold text-fg">Completions · last 14 days</p>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-subtle)" }} axisLine={false} tickLine={false} interval={1} />
              <Tooltip
                cursor={{ fill: "var(--color-surface-2)" }}
                contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-strong)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "var(--color-fg)" }}
              />
              <Bar dataKey="count" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Habit cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {habits.map((h) => {
          const Icon = HABIT_ICONS[h.icon] ?? Flame;
          const color = COLOR[h.color] ?? COLOR.brand;
          const streak = computeStreak(h, now);
          const week = weeklyCount(h, now);
          const strip = habitStrip(h, 14, now);
          const doneToday = h.completed.includes(today);
          return (
            <div key={h.id} className="glass card-sheen rounded-3xl p-5">
              <div className="flex items-center gap-3">
                <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", color.bg)}>
                  <Icon className={cn("h-5 w-5", color.text)} />
                </span>
                <div className="flex-1">
                  <p className="font-display text-sm font-semibold text-fg">{h.name}</p>
                  <p className="text-[11px] text-subtle capitalize">{h.cadence} · {h.targetPerWeek}×/week</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-high/12 px-2.5 py-1 text-xs font-semibold text-high">
                  <Flame className="h-3.5 w-3.5" /> {streak}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-[3px]">
                {strip.map((d) => (
                  <span
                    key={d.date}
                    title={d.date}
                    className={cn(
                      "h-6 flex-1 rounded-[4px]",
                      d.done ? color.bg.replace("/12", "/70") : "bg-surface-2"
                    )}
                    style={d.done ? { background: color.bar } : undefined}
                  />
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-subtle">{week}/{h.targetPerWeek} this week</span>
                <button
                  onClick={() => toggleHabit(h.id, today)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
                    doneToday
                      ? "bg-success/15 text-success"
                      : "border border-border text-muted hover:border-brand/40 hover:text-fg"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {doneToday ? "Done today" : "Mark done"}
                </button>
              </div>
            </div>
          );
        })}

        <button className="grid min-h-[8rem] place-items-center rounded-3xl border border-dashed border-border text-sm text-subtle transition hover:border-brand/40 hover:text-fg">
          <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New habit</span>
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-2.5 text-center">
      <div className={cn("font-display text-lg font-semibold", accent ?? "text-fg")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-subtle">{label}</div>
    </div>
  );
}
