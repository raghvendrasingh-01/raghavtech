"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "How is this different from a to-do list or reminders app?",
    a: "To-do lists are passive — they wait for you. Pulse is active: it plans your day around your calendar, scores each deadline's miss-risk, reschedules when things slip, and nudges you before it's too late. It does the thinking, not just the storing.",
  },
  {
    q: "How does the deadline prediction actually work?",
    a: "Pulse estimates the work left on a task and compares it to the free time genuinely available on your calendar before the deadline. If the work won't fit, the risk climbs — and it proposes a concrete fix like clearing an evening or breaking the task down.",
  },
  {
    q: "Do I need to connect my calendar?",
    a: "No, but it's better with it. Connect Google Calendar and Pulse schedules around your real meetings and classes. Without it, you still get prioritization, risk scoring, and AI planning.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your tasks and calendar stay yours. Pulse runs its planning intelligence on your data only to build your plan — never to train shared models.",
  },
  {
    q: "Is it really free for students?",
    a: "The core planner, deadline radar, and habit tracking are free forever for students. Pro adds unlimited AI planning, calendar auto-sync, and the burnout radar.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-4 py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="text-center">
            <p className="text-sm font-medium text-brand">FAQ</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
              Questions, answered
            </h2>
          </div>
        </Reveal>

        <div className="mt-12 space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} i={i}>
                <div className="glass card-sheen overflow-hidden rounded-2xl">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-medium text-fg">{item.q}</span>
                    <Plus
                      className={cn(
                        "h-5 w-5 shrink-0 text-brand transition-transform duration-300",
                        isOpen && "rotate-45"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
