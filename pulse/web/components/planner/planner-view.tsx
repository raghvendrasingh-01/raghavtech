"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Timer,
  CalendarClock,
  Coffee,
  AlertTriangle,
  Send,
  Loader2,
} from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { generateRange } from "@/lib/intelligence";
import { chatPlan } from "@/lib/ai/adapter";
import { ScheduleTimeline } from "./schedule-timeline";
import { Button } from "@/components/ui/button";
import { MessageContent } from "@/components/ui/message-content";
import { formatDuration, cn } from "@/lib/utils";

export function PlannerView() {
  const { tasks, events, now, regenerate, pinnedBlocks, settings } = useStore();
  const [mode, setMode] = React.useState<"day" | "week">("day");
  const [dayOffset, setDayOffset] = React.useState(0);
  const [nonce, setNonce] = React.useState(0);
  const [prompt, setPrompt] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [reply, setReply] = React.useState<string | null>(null);

  const selectedDate = React.useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [now, dayOffset]);

  // One deadline-aware simulation drives the day timeline AND the "couldn't
  // fit" panel, so leftover work carries across days and "unplaced" means
  // "won't fit before its deadline" — not merely "not today".
  const horizonDays = Math.max(14, dayOffset + 2);
  const range = React.useMemo(
    () => generateRange({ 
      tasks, 
      events, 
      now, 
      days: horizonDays, 
      pinnedBlocks,
      dayStartHour: settings.dayStartHour,
      dayEndHour: settings.dayEndHour,
      maxFocusMin: settings.maxFocusMin,
      breakMin: settings.breakMin,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, events, now, horizonDays, nonce, pinnedBlocks, settings]
  );
  const blocks = React.useMemo(
    () => range.days.find((d) => d.date.toDateString() === selectedDate.toDateString())?.blocks ?? [],
    [range, selectedDate]
  );
  const unplaced = range.unplaced;

  const focusMin = blocks.filter((b) => b.kind === "focus").reduce((s, b) => s + dur(b), 0);
  const meetingMin = blocks.filter((b) => b.kind === "event").reduce((s, b) => s + dur(b), 0);
  const breakMin = blocks.filter((b) => b.kind === "break").reduce((s, b) => s + dur(b), 0);

  async function runPrompt(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    setPrompt("");
    setThinking(true);
    const res = await chatPlan({ message: content, tasks, events, now });
    setReply(res.reply);
    setThinking(false);
    setNonce((n) => n + 1);
  }

  function reoptimize() {
    regenerate();
    setNonce((n) => n + 1);
  }

  const dateLabel =
    dayOffset === 0
      ? "Today"
      : dayOffset === 1
        ? "Tomorrow"
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-fg">AI Planner</h2>
          <p className="text-xs text-subtle">Pulse built this around your calendar, weighted by priority & risk.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl border border-border p-0.5">
            {(["day", "week"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                  mode === m ? "bg-surface-2 text-fg" : "text-subtle hover:text-fg"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={reoptimize}>
            <RefreshCw className="h-4 w-4" /> Re-optimize
          </Button>
        </div>
      </div>

      {/* Command bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runPrompt(prompt);
        }}
        className="glass flex items-center gap-2 rounded-2xl p-2"
      >
        <Sparkles className="ml-2 h-4 w-4 text-brand" />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Tell Pulse what changed — “I have a 3pm dentist”, “plan my week”, “what’s most urgent?”"
          className="flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-subtle focus:outline-none"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || thinking}
          className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {reply && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass card-sheen rounded-2xl p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Pulse
          </div>
          <MessageContent text={reply} />
        </motion.div>
      )}

      {mode === "day" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          {/* Timeline */}
          <div className="glass card-sheen rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => setDayOffset((d) => d - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:text-fg">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-28 text-center text-sm font-semibold text-fg">{dateLabel}</span>
                <button onClick={() => setDayOffset((d) => d + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:text-fg">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {dayOffset !== 0 && (
                <button onClick={() => setDayOffset(0)} className="text-xs text-brand hover:underline">
                  Back to today
                </button>
              )}
            </div>
            <ScheduleTimeline blocks={blocks} now={now} />
          </div>

          {/* Side stats */}
          <div className="space-y-3">
            <StatRow icon={Timer} label="Deep focus" value={formatDuration(focusMin)} tone="text-brand" />
            <StatRow icon={CalendarClock} label="Meetings" value={formatDuration(meetingMin)} tone="text-medium" />
            <StatRow icon={Coffee} label="Breaks" value={formatDuration(breakMin)} tone="text-low" />

            {unplaced.length > 0 && (
              <div className="rounded-2xl border border-high/30 bg-high/8 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-high">
                  <AlertTriangle className="h-3.5 w-3.5" /> Couldn&apos;t fit {unplaced.length}
                </div>
                <ul className="space-y-1.5">
                  {unplaced.map((u) => (
                    <li key={u.taskId} className="text-xs text-muted">
                      <span className="text-fg">{u.title}</span> · needs {formatDuration(u.minutes)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-subtle">Trim scope or free an evening — ask Pulse above.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <WeekView />
      )}
    </div>
  );
}

function WeekView() {
  const { tasks, events, now } = useStore();
  const { days: range } = generateRange({ tasks, events, now, days: 7 });
  const days = range.map(({ date, blocks }) => ({
    date,
    focus: blocks.filter((b) => b.kind === "focus"),
    events: blocks.filter((b) => b.kind === "event"),
  }));

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {days.map(({ date, focus, events: evs }, i) => (
        <div key={i} className="glass card-sheen rounded-2xl p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-fg">
              {i === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
            <span className="text-[11px] text-subtle">{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
          <div className="space-y-1.5">
            {[...evs, ...focus]
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .slice(0, 5)
              .map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <span className={cn("h-6 w-0.5 rounded-full", b.kind === "event" ? "bg-medium" : b.rescue ? "bg-critical" : "bg-brand")} />
                  <span className="w-12 shrink-0 font-mono text-[10px] text-subtle">
                    {new Date(b.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="truncate text-muted">{b.title}</span>
                </div>
              ))}
            {focus.length + evs.length === 0 && <p className="text-xs text-subtle">Free day</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface">
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <div>
        <div className="font-display text-lg font-semibold leading-none text-fg">{value}</div>
        <div className="mt-0.5 text-[11px] text-subtle">{label}</div>
      </div>
    </div>
  );
}

function dur(b: { start: string; end: string }) {
  return (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000;
}
