"use client";

import { Reveal } from "./reveal";

const STATS = [
  { value: "94%", label: "of deadlines met after 2 weeks" },
  { value: "5.2h", label: "focus time reclaimed weekly" },
  { value: "60s", label: "to a full weekly plan" },
  { value: "0", label: "reminders you have to think about" },
];

export function Stats() {
  return (
    <section className="px-4 py-10">
      <Reveal>
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 rounded-3xl md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="glass card-sheen rounded-2xl px-5 py-6 text-center">
              <div className="font-display text-3xl font-bold text-gradient sm:text-4xl">{s.value}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
