"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { computeProductivityScore } from "@/lib/intelligence";
import { Widget } from "./widget";
import { cn } from "@/lib/utils";

export function ProductivityCard() {
  const { tasksDerived, history, now } = useStore();
  const { score, delta, label } = computeProductivityScore(tasksDerived, history, now);
  const up = delta >= 0;
  const data = history.slice(-14).map((d) => ({ date: d.date, score: d.score }));

  return (
    <Widget title="Productivity score" icon={TrendingUp} href="/analytics">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-fg">{score}</span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                up ? "text-success" : "text-critical"
              )}
            >
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {up ? "+" : ""}
              {delta}
            </span>
          </div>
          <div className="mt-1 text-xs text-subtle">{label} · vs last week</div>
        </div>
      </div>

      <div className="mt-3 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[30, 100]} />
            <Tooltip
              cursor={{ stroke: "var(--color-border-strong)" }}
              contentStyle={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--color-fg)",
              }}
              labelFormatter={() => ""}
              formatter={(v) => [`${v}`, "score"]}
            />
            <Area type="monotone" dataKey="score" stroke="var(--color-brand)" strokeWidth={2} fill="url(#prodGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  );
}
