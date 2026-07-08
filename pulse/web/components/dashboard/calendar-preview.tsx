"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { Widget } from "./widget";
import { formatTime, cn } from "@/lib/utils";

export function CalendarPreview() {
  const { events, tasksDerived, now } = useStore();

  // Week strip starting Monday.
  const monday = new Date(now);
  const dow = (monday.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(monday.getDate() - dow);
  monday.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toDateString();
    const evCount = events.filter((e) => new Date(e.start).toDateString() === ds).length;
    const dlCount = tasksDerived.filter(
      (t) => t.status !== "done" && new Date(t.deadline).toDateString() === ds
    ).length;
    return { d, isToday: ds === now.toDateString(), evCount, dlCount };
  });

  const upcoming = events
    .filter((e) => new Date(e.end).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3);

  return (
    <Widget title="Calendar" icon={CalendarDays} href="/calendar">
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ d, isToday, evCount, dlCount }) => (
          <div
            key={d.toISOString()}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl py-2",
              isToday ? "bg-brand/15 ring-1 ring-brand/30" : "bg-surface/40"
            )}
          >
            <span className="text-[9px] uppercase text-subtle">
              {d.toLocaleDateString("en-US", { weekday: "narrow" })}
            </span>
            <span className={cn("text-sm font-semibold", isToday ? "text-brand" : "text-fg")}>
              {d.getDate()}
            </span>
            <span className="flex h-1.5 items-center gap-0.5">
              {evCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-medium" />}
              {dlCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-critical" />}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {upcoming.length === 0 ? (
          <p className="text-center text-xs text-subtle">No more events this week.</p>
        ) : (
          upcoming.map((e) => (
            <Link
              key={e.id}
              href="/calendar"
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface/50"
            >
              <span className="h-8 w-1 rounded-full bg-gradient-to-b from-brand to-brand-3" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{e.title}</p>
                <p className="text-[11px] text-subtle">
                  {new Date(e.start).toLocaleDateString("en-US", { weekday: "short" })} · {formatTime(e.start)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </Widget>
  );
}
