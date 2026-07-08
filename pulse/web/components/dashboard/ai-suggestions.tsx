"use client";

import { Sparkles, ShieldAlert, Battery, Focus, Lightbulb, CalendarClock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/components/providers/demo-store";
import { generateSuggestions } from "@/lib/intelligence";
import { Widget } from "./widget";
import { RichText } from "@/components/ui/rich-text";
import type { AiSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON: Record<AiSuggestion["kind"], { icon: typeof Sparkles; tone: string }> = {
  risk: { icon: ShieldAlert, tone: "text-critical bg-critical/12" },
  burnout: { icon: Battery, tone: "text-high bg-high/12" },
  focus: { icon: Focus, tone: "text-brand bg-brand/12" },
  insight: { icon: Lightbulb, tone: "text-medium bg-medium/12" },
  reschedule: { icon: CalendarClock, tone: "text-low bg-low/12" },
  break: { icon: Battery, tone: "text-low bg-low/12" },
};

export function AiSuggestions() {
  const { tasksDerived, events, history, regenerate, now } = useStore();
  const suggestions = generateSuggestions(tasksDerived, events, history, now);

  return (
    <Widget title="AI suggestions" icon={Sparkles}>
      <div className="space-y-2.5">
        {suggestions.map((s, i) => {
          const meta = ICON[s.kind];
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-border bg-surface/40 p-3"
            >
              <div className="flex items-start gap-3">
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.tone)}>
                  <meta.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    <RichText text={s.body} />
                  </p>
                  {s.cta && (
                    <button
                      onClick={regenerate}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand transition hover:gap-1.5"
                    >
                      {s.cta} <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Widget>
  );
}
