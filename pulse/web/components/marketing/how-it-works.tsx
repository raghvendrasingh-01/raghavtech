"use client";

import { PlugZap, Wand2, TrendingUp } from "lucide-react";
import { Reveal } from "./reveal";

const STEPS = [
  {
    icon: PlugZap,
    step: "01",
    title: "Connect & brain-dump",
    body: "Add your tasks and connect Google Calendar. Or just talk — “I have an exam Friday and a hackathon this weekend.”",
  },
  {
    icon: Wand2,
    step: "02",
    title: "Pulse plans everything",
    body: "It prioritizes with reasons, scores deadline risk, and drops focus blocks into the real gaps in your day.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "It keeps you on track",
    body: "As the day shifts, Pulse reschedules, nudges, and protects your deadlines — so nothing slips.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-brand">How it works</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
              From chaos to a plan in 60 seconds
            </h2>
          </div>
        </Reveal>

        <div className="relative mt-14 grid gap-4 md:grid-cols-3">
          {/* connecting line */}
          <div className="pointer-events-none absolute inset-x-12 top-11 hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent md:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.step} i={i}>
              <div className="card-sheen glass relative h-full rounded-3xl p-7 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand/20 to-brand-3/10 ring-1 ring-brand/20">
                  <s.icon className="h-7 w-7 text-brand" />
                </div>
                <div className="mt-4 font-mono text-xs text-subtle">{s.step}</div>
                <h3 className="mt-1 font-display text-lg font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
