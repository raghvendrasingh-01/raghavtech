"use client";

import {
  ShieldAlert,
  CalendarClock,
  MessageSquareText,
  Target,
  Flame,
  BarChart3,
  Mic,
  Bell,
  BrainCircuit,
} from "lucide-react";
import { Reveal } from "./reveal";
import { RadialGauge } from "@/components/ui/radial-gauge";

/**
 * Bento feature grid. The hero card (Deadline Prediction) spans two columns
 * and shows a live gauge; the rest are compact capability cards.
 */
export function Features() {
  return (
    <section id="features" className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-brand">Not another to-do list</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
              An AI that <span className="text-gradient">acts</span>, not just reminds
            </h2>
            <p className="mt-4 text-muted">
              Passive reminders get ignored. Pulse reads your calendar, does the
              math, and intervenes before a deadline turns into a crisis.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {/* Hero feature — spans 2 cols */}
          <Reveal className="md:col-span-2">
            <div className="card-sheen glass group relative h-full overflow-hidden rounded-3xl p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full border border-critical/30 bg-critical/10 px-2.5 py-1 text-xs font-medium text-critical">
                    <ShieldAlert className="h-3.5 w-3.5" /> Deadline Prediction
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-fg">
                    Risk scored before you fall behind
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-muted">
                    Pulse compares work remaining against the free time actually
                    left on your calendar and gives every deadline a live miss-risk
                    score — with a plan to fix it.
                  </p>
                  <div className="mt-4 rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted">
                    <span className="font-medium text-critical">92% risk</span> · 6h of work,
                    2h free before tomorrow. “Start immediately — I’ll clear your evening.”
                  </div>
                </div>
                <RadialGauge value={92} size={150} sublabel="miss risk" className="mx-auto shrink-0" />
              </div>
            </div>
          </Reveal>

          <Reveal i={1}>
            <FeatureCard
              icon={CalendarClock}
              title="Smart Scheduler"
              body="Auto-builds your day around meetings and free slots, with focus blocks and breaks. Regenerate anytime."
              tone="text-brand"
            />
          </Reveal>

          <Reveal i={2}>
            <FeatureCard
              icon={MessageSquareText}
              title="AI Planner Chat"
              body="“Plan my week — 2 assignments, an interview, and an exam.” Get a full daily plan in seconds."
              tone="text-medium"
            />
          </Reveal>

          <Reveal i={3}>
            <FeatureCard
              icon={BrainCircuit}
              title="Accountability Coach"
              body="Checks in, reschedules what slipped, breaks big tasks down, and keeps you moving — kindly but relentlessly."
              tone="text-high"
            />
          </Reveal>

          <Reveal i={4}>
            <FeatureCard
              icon={Target}
              title="Goal Planner"
              body="“Crack a Google internship” becomes a milestone roadmap with a daily plan you actually follow."
              tone="text-low"
            />
          </Reveal>

          <Reveal i={5}>
            <FeatureCard
              icon={Flame}
              title="Habits & Streaks"
              body="Track coding, reading, workouts and more. Streaks and weekly graphs keep momentum visible."
              tone="text-critical"
            />
          </Reveal>

          <Reveal i={6}>
            <FeatureCard
              icon={BarChart3}
              title="Productivity Analytics"
              body="Focus hours, success rate, missed deadlines and AI recommendations to get better each week."
              tone="text-brand-3"
            />
          </Reveal>

          <Reveal i={7}>
            <FeatureCard
              icon={Bell}
              title="Smart Reminders"
              body="Not “due tomorrow.” Instead: “2h on YouTube today — start in 30 min or you’ll miss it.”"
              tone="text-high"
            />
          </Reveal>

          <Reveal i={8}>
            <FeatureCard
              icon={Mic}
              title="Voice Capture"
              body="“Remind me to finish my assignment tomorrow evening.” Pulse turns it into a scheduled task."
              tone="text-medium"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <div className="card-sheen glass group h-full rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-surface-2/40">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface">
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
