import type { TaskWithIntel } from "@/lib/types";
import { hoursUntil } from "@/lib/utils";

/**
 * Smart reminders — the proactive, context-aware nudges from the brief. Built
 * live from the intelligence engine (deadline risk, tight timing) rather than
 * dumb "due tomorrow" alerts. These feed the in-app notification center and,
 * when FCM is configured, push notifications.
 */

export interface Notification {
  id: string;
  kind: "risk" | "reminder" | "briefing";
  title: string;
  body: string;
  at: string;
  taskId?: string;
}

export function buildNotifications(tasks: TaskWithIntel[], now: Date): Notification[] {
  const out: Notification[] = [];
  const open = tasks.filter((t) => t.status !== "done");

  // Risk alerts — highest first.
  open
    .filter((t) => t.riskResult.risk >= 55)
    .sort((a, b) => b.riskResult.risk - a.riskResult.risk)
    .slice(0, 3)
    .forEach((t) =>
      out.push({
        id: `n-risk-${t.id}`,
        kind: "risk",
        title: `${t.riskResult.risk}% risk — ${t.title}`,
        body: t.riskResult.message,
        at: now.toISOString(),
        taskId: t.id,
      })
    );

  // Imminent deadlines (next 6h) that aren't already flagged as risk.
  open
    .filter((t) => {
      const h = hoursUntil(t.deadline, now);
      return h > 0 && h <= 6 && t.riskResult.risk < 55;
    })
    .slice(0, 2)
    .forEach((t) =>
      out.push({
        id: `n-due-${t.id}`,
        kind: "reminder",
        title: `Due soon — ${t.title}`,
        body: `Deadline in ${Math.round(hoursUntil(t.deadline, now))}h. A focus block now keeps it comfortable.`,
        at: now.toISOString(),
        taskId: t.id,
      })
    );

  return out;
}
