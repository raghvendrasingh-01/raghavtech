import type { Task, CalendarEvent, ScheduleBlock, Mutation } from "@/lib/types";
import { computePriority } from "./priority";
import { computeRisk } from "./risk";
import { generateSchedule, generateRange } from "./scheduler";
import { formatTime, formatDuration, hoursUntil } from "@/lib/utils";

/**
 * Rule-based planning brain for the AI chat.
 *
 * It classifies the user's intent and answers with a concrete plan grounded in
 * their actual tasks, priorities, and deadline-risk — never generic filler.
 * The AI adapter (lib/ai/adapter.ts) calls this by default and swaps in GPT
 * when an API key is configured, keeping the exact same return shape.
 */

export interface PlannerInput {
  message: string;
  tasks: Task[];
  events: CalendarEvent[];
  now?: Date;
}

export interface PlannerOutput {
  reply: string;
  schedule?: ScheduleBlock[];
  chips?: string[];
  /** Task mutations from GPT tool calling (remote backend only). */
  mutations?: Mutation[];
}

type Intent = "plan_day" | "plan_week" | "focus_now" | "risk" | "summary";

function classify(msg: string): Intent {
  const m = msg.toLowerCase();
  if (/(this week|week|next 7 days|weekly)/.test(m)) return "plan_week";
  if (/(plan|schedule|organi[sz]e).*(day|today|tomorrow)/.test(m)) return "plan_day";
  if (/(what.*(now|next|first)|focus|start with|should i do)/.test(m)) return "focus_now";
  if (/(miss|risk|behind|late|on track|make it)/.test(m)) return "risk";
  if (/(plan|schedule|organi[sz]e)/.test(m)) return "plan_day";
  return "summary";
}

function ranked(tasks: Task[], now: Date) {
  return tasks
    .filter((t) => t.status !== "done" && t.status !== "missed")
    .map((t) => ({ t, p: computePriority(t, { now }) }))
    .sort((a, b) => b.p.score - a.p.score);
}

export function planFromMessage(input: PlannerInput): PlannerOutput {
  const now = input.now ?? new Date();
  const intent = classify(input.message);
  const list = ranked(input.tasks, now);

  switch (intent) {
    case "focus_now": {
      if (!list.length)
        return { reply: "You're all clear — nothing open right now. Want me to pull tomorrow's work forward?", chips: ["Plan tomorrow"] };
      const top = list[0];
      const risk = computeRisk(top.t, { now, events: input.events });
      return {
        reply:
          `Do **${top.t.title}** next. ${top.p.reason}\n\n` +
          `It needs about ${formatDuration(top.t.estimateMin * (1 - top.t.progress))} more. ${risk.message} ${risk.recommendation}`,
        chips: ["Schedule it now", "Break it down", "Show my day"],
      };
    }

    case "risk": {
      const atRisk = list
        .map((x) => ({ ...x, r: computeRisk(x.t, { now, events: input.events }) }))
        .filter((x) => x.r.risk >= 55)
        .sort((a, b) => b.r.risk - a.r.risk);
      if (!atRisk.length)
        return { reply: "Good news — nothing is in the danger zone right now. Everything has enough runway before its deadline.", chips: ["Plan my day"] };
      const lines = atRisk
        .slice(0, 4)
        .map((x) => `- **${x.t.title}** — ${x.r.risk}% miss risk. ${x.r.message}`)
        .join("\n");
      return {
        reply: `Here's what could slip:\n\n${lines}\n\nWant me to rebuild your day around the riskiest ones?`,
        chips: ["Rescue my deadlines", "Break down the top one"],
      };
    }

    case "plan_week": {
      const { days: rangeDays, unplaced } = generateRange({ tasks: input.tasks, events: input.events, now, days: 7 });
      const lines: string[] = [];
      for (let d = 0; d < rangeDays.length; d++) {
        const { date, blocks } = rangeDays[d];
        const focus = blocks.filter((b) => b.kind === "focus");
        if (!focus.length) continue;
        const label = d === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "long" });
        // De-duplicate consecutive same-task blocks for a readable summary.
        const titles: string[] = [];
        for (const b of focus) if (titles[titles.length - 1] !== b.title) titles.push(b.title);
        const items = titles.slice(0, 3).map((t) => `${formatTime(focus.find((f) => f.title === t)!.start)} ${t}`).join(" · ");
        lines.push(`**${label}** — ${items}${titles.length > 3 ? " …" : ""}`);
      }
      const warn = unplaced.length
        ? `\n\n⚠️ ${unplaced.length} item${unplaced.length > 1 ? "s" : ""} won't fit this week (${unplaced.map((u) => u.title).slice(0, 2).join(", ")}). Consider trimming scope.`
        : "";
      return {
        reply:
          `Here's a plan for your week, weighted by priority and deadline risk:\n\n${lines.join("\n")}${warn}\n\n` +
          `I front-loaded the highest-risk work and spread the rest so nothing piles up. Say the word and I'll drop it on your calendar.`,
        schedule: generateSchedule({ tasks: input.tasks, events: input.events, now }).blocks,
        chips: ["Regenerate", "Show risks", "Add a task"],
      };
    }

    case "plan_day":
    default: {
      const { blocks, unplaced } = generateSchedule({ tasks: input.tasks, events: input.events, now });
      const focus = blocks.filter((b) => b.kind === "focus");
      if (!focus.length && !list.length)
        return { reply: "Nothing to schedule yet. Add a task or two and I'll build your day around them.", chips: ["Add a task"] };

      const timeline = blocks
        .filter((b) => b.kind !== "buffer")
        .slice(0, 8)
        .map((b) => {
          const tag = b.kind === "event" ? "📅" : b.kind === "break" ? "☕" : b.rescue ? "🚨" : "🎯";
          return `${formatTime(b.start)}–${formatTime(b.end)}  ${tag} ${b.title}`;
        })
        .join("\n");

      const warn = unplaced.length
        ? `\n\n⚠️ I couldn't fit ${unplaced.length} item${unplaced.length > 1 ? "s" : ""} today (${unplaced
            .map((u) => u.title)
            .slice(0, 2)
            .join(", ")}). They're tight — consider trimming scope or clearing an evening slot.`
        : "";

      const soonest = list[0]
        ? `\n\nStart with **${list[0].t.title}** — ${Math.round(hoursUntil(list[0].t.deadline, now))}h to its deadline.`
        : "";

      return {
        reply: `Here's your day, built around your meetings and weighted by priority:\n\n\`\`\`\n${timeline}\n\`\`\`${soonest}${warn}`,
        schedule: blocks,
        chips: ["Regenerate", "What's most urgent?", "Reschedule around a new meeting"],
      };
    }
  }
}
