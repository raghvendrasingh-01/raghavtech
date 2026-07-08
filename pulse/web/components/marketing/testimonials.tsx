"use client";

import { Star } from "lucide-react";
import { Reveal } from "./reveal";

const QUOTES = [
  {
    quote:
      "I stopped pulling all-nighters. Pulse flagged my thesis chapter as 88% at-risk four days early and rebuilt my week around it.",
    name: "Aisha K.",
    role: "PhD student, Cambridge",
    initials: "AK",
    tone: "from-brand to-brand-2",
  },
  {
    quote:
      "It feels like having a chief of staff. I dump everything in the chat and it hands me back a plan I actually follow.",
    name: "Marco B.",
    role: "Founder, seed-stage startup",
    initials: "MB",
    tone: "from-medium to-brand-3",
  },
  {
    quote:
      "The deadline radar is genuinely scary-good. It caught two client deliverables I'd underestimated by hours.",
    name: "Priya S.",
    role: "Freelance designer",
    initials: "PS",
    tone: "from-high to-critical",
  },
];

export function Testimonials() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-brand">Loved by busy people</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
              People stop dropping the ball
            </h2>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} i={i}>
              <figure className="card-sheen glass flex h-full flex-col rounded-3xl p-6">
                <div className="flex gap-0.5 text-high">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-fg">
                  “{q.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${q.tone} text-xs font-semibold text-white`}>
                    {q.initials}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-fg">{q.name}</div>
                    <div className="text-xs text-subtle">{q.role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
