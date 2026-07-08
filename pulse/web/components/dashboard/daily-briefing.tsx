"use client";

import { motion } from "framer-motion";
import { ListTodo, ShieldAlert, Timer, CalendarDays, Trash2 } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { useAuth } from "@/components/providers/auth-provider";
import { generateBriefing } from "@/lib/intelligence";
import { RichText } from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";

export function DailyBriefing() {
  const { tasksDerived, events, schedule, now, resetData } = useStore();
  const user = useAuth();

  const briefing = generateBriefing(
    tasksDerived,
    events,
    now
  );
  const open = tasksDerived.filter((t) => t.status !== "done");
  const atRisk = open.filter((t) => t.riskResult.risk >= 55).length;
  const focusMin = schedule
    .filter((b) => b.kind === "focus")
    .reduce((s, b) => s + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000, 0);
  const meetingsToday = events.filter(
    (e) => new Date(e.start).toDateString() === now.toDateString()
  ).length;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { icon: ListTodo, label: "Open tasks", value: open.length, tone: "text-brand" },
    { icon: ShieldAlert, label: "At risk", value: atRisk, tone: "text-critical" },
    { icon: Timer, label: "Focus planned", value: `${(focusMin / 60).toFixed(1)}h`, tone: "text-medium" },
    { icon: CalendarDays, label: "Events today", value: meetingsToday, tone: "text-high" },
  ];

  return (
    <div className="mb-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {greeting}, {user.name.split(" ")[0]}
          </h2>
          <Button variant="outline" size="sm" onClick={resetData} className="text-critical border-critical/30 hover:bg-critical/10 flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset data</span>
          </Button>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          <RichText text={briefing} />
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass card-sheen flex items-center gap-3 rounded-2xl px-4 py-3"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface">
              <s.icon className={`h-4.5 w-4.5 ${s.tone}`} />
            </div>
            <div>
              <div className="font-display text-xl font-semibold leading-none text-fg">{s.value}</div>
              <div className="mt-1 text-[11px] text-subtle">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
