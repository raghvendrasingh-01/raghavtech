"use client";

import { motion } from "framer-motion";
import { Coffee, CalendarClock, Zap, Sparkles, Lock, Unlock } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { formatTime, formatDuration, cn } from "@/lib/utils";
import type { ScheduleBlock } from "@/lib/types";

const KIND_STYLE = {
  focus: { icon: Sparkles, ring: "text-brand", chip: "bg-brand/15 text-brand", label: "Focus" },
  task: { icon: Sparkles, ring: "text-brand", chip: "bg-brand/15 text-brand", label: "Task" },
  event: { icon: CalendarClock, ring: "text-medium", chip: "bg-medium/15 text-medium", label: "Event" },
  break: { icon: Coffee, ring: "text-low", chip: "bg-low/15 text-low", label: "Break" },
  buffer: { icon: Coffee, ring: "text-subtle", chip: "bg-surface-2 text-subtle", label: "Buffer" },
} as const;

export function ScheduleTimeline({ blocks, now }: { blocks: ScheduleBlock[]; now: Date }) {
  const { pinBlock, unpinBlock } = useStore();
  
  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-subtle">
        No blocks scheduled — you&apos;re free. Add tasks and Pulse will fill the gaps.
      </div>
    );
  }

  return (
    <div className="relative pl-3">
      <div className="absolute left-[7.25rem] top-2 bottom-2 w-px bg-border" />
      <div className="space-y-2">
        {blocks.map((b, i) => {
          const style = KIND_STYLE[b.kind];
          const Icon = b.rescue ? Zap : style.icon;
          const mins = (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000;
          const live = new Date(b.start).getTime() <= now.getTime() && new Date(b.end).getTime() > now.getTime();
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.5) }}
              className="relative flex items-stretch gap-4"
            >
              <div className="w-24 shrink-0 pt-2 text-right font-mono text-[11px] text-subtle">
                {formatTime(b.start)}
              </div>
              <div className="relative z-10 flex w-6 justify-center pt-2.5">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full border-2 border-bg bg-surface-2",
                    b.rescue ? "text-critical" : style.ring
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
              </div>
              <div
                className={cn(
                  "mb-1 flex flex-1 items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors",
                  live ? "border-brand/40 bg-brand/8" : "border-border bg-surface/40",
                  b.rescue && "border-critical/40 bg-critical/8",
                  b.pinned && "ring-1 ring-brand/30 border-brand/40"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{b.title}</p>
                  <p className="text-[11px] text-subtle">
                    {formatTime(b.start)}–{formatTime(b.end)} · {formatDuration(mins)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {live && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Now
                    </span>
                  )}
                  {b.rescue && !live ? (
                    <span className="rounded-md bg-critical/15 px-1.5 py-0.5 text-[10px] font-medium text-critical">Rescue</span>
                  ) : (
                    !live && <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", style.chip)}>{style.label}</span>
                  )}
                  
                  {b.kind === "focus" && (
                    <button
                      onClick={() => b.pinned ? unpinBlock(b.id) : pinBlock(b)}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-lg transition hover:bg-surface-3",
                        b.pinned ? "text-brand" : "text-subtle hover:text-fg"
                      )}
                      title={b.pinned ? "Unpin block" : "Pin block to time slot"}
                    >
                      {b.pinned ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
