"use client";

import { Activity } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { Widget } from "./widget";
import { ACTIVITY_META } from "@/lib/ui-maps";
import { relativeTime, cn } from "@/lib/utils";

export function RecentActivity() {
  const { activity, now } = useStore();
  const items = activity.slice(0, 6);

  return (
    <Widget title="Recent activity" icon={Activity}>
      <ol className="relative space-y-3 pl-1">
        {items.map((a) => {
          const meta = ACTIVITY_META[a.kind];
          return (
            <li key={a.id} className="flex items-start gap-3">
              <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface", meta.text)}>
                <meta.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-fg">{a.text}</p>
                <p className="text-[11px] text-subtle">{relativeTime(a.at, now)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Widget>
  );
}
