"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Play, Zap, CalendarClock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadialGauge } from "@/components/ui/radial-gauge";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-36 pb-20 sm:pt-40">
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-grid opacity-40" />
        <div className="absolute left-1/2 top-24 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Notion AI + Motion + Calendar, in one Chief of Staff
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.06 }}
          className="mx-auto mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-fg sm:text-6xl md:text-7xl"
        >
          Never miss a deadline{" "}
          <span className="text-gradient">again.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.14 }}
          className="mx-auto mt-6 max-w-xl text-lg text-muted"
        >
          Pulse is the AI that actively runs your day — planning your schedule,
          prioritizing what matters, and predicting a missed deadline before it
          happens. Not another to-do list.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.22 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link href="/dashboard">
            <Button size="lg" className="group">
              Start planning free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <Button size="lg" variant="secondary">
            <Play className="h-4 w-4" />
            Watch 90s demo
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-6 text-xs text-subtle"
        >
          Free forever for students · No credit card · Set up in 60 seconds
        </motion.p>
      </div>

      <HeroVisual />
    </section>
  );
}

function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, ease, delay: 0.3 }}
      style={{ perspective: 1200 }}
      className="relative mx-auto mt-16 max-w-5xl"
    >
      <div className="card-sheen glass-strong relative overflow-hidden rounded-3xl p-4 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          {/* left: schedule preview */}
          <div className="rounded-2xl bg-bg/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-semibold text-fg">Today · AI-generated plan</p>
                <p className="text-xs text-subtle">Built around 3 meetings & 2 deadlines</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                <Zap className="h-3 w-3" /> Optimized
              </span>
            </div>
            <div className="space-y-2">
              {SCHEDULE.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.09, ease }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 px-3 py-2"
                >
                  <span className="w-14 shrink-0 font-mono text-[11px] text-subtle">{s.time}</span>
                  <span className={`h-8 w-1 rounded-full ${s.bar}`} />
                  <span className="flex-1 truncate text-sm text-fg">{s.label}</span>
                  {s.tag && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${s.tagCls}`}>{s.tag}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* right: deadline radar */}
          <div className="flex flex-col gap-4">
            <div className="card-sheen relative flex flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-critical/15 to-high/5 p-5 text-center">
              <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-critical">
                <ShieldAlert className="h-3.5 w-3.5" /> Deadline Radar
              </div>
              <RadialGauge value={77} size={140} sublabel="miss risk" />
              <p className="mt-2 text-xs text-muted">
                <span className="font-medium text-fg">DS Assignment 3</span> — start now or it slips.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface/50 px-4 py-3">
              <CalendarClock className="h-5 w-5 text-brand" />
              <p className="text-xs text-muted">
                Pulse moved <span className="text-fg">DP prep</span> to tonight to protect your deadline.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* floating accent chips */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-4 top-24 hidden rounded-2xl glass-strong px-4 py-3 md:block"
      >
        <p className="text-[10px] uppercase tracking-wider text-subtle">Productivity</p>
        <p className="font-display text-xl font-bold text-fg">
          87<span className="text-sm text-success"> ↑12</span>
        </p>
      </motion.div>
      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-4 bottom-16 hidden rounded-2xl glass-strong px-4 py-3 md:block"
      >
        <p className="text-[10px] uppercase tracking-wider text-subtle">🔥 Coding streak</p>
        <p className="font-display text-xl font-bold text-fg">12 days</p>
      </motion.div>
    </motion.div>
  );
}

const SCHEDULE = [
  { time: "9:00", label: "Team standup", bar: "bg-medium", tag: "Meeting", tagCls: "bg-medium/15 text-medium" },
  { time: "9:30", label: "Deep work — DS Assignment 3", bar: "bg-critical", tag: "🚨 Rescue", tagCls: "bg-critical/15 text-critical" },
  { time: "11:00", label: "Algorithms lecture", bar: "bg-brand", tag: "Class", tagCls: "bg-brand/15 text-brand" },
  { time: "13:30", label: "Interview prep — DP", bar: "bg-high", tag: "Focus", tagCls: "bg-high/15 text-high" },
  { time: "15:15", label: "Break", bar: "bg-low", tag: "☕", tagCls: "bg-low/15 text-low" },
];
