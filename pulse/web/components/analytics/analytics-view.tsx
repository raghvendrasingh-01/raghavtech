"use client";

import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CheckCircle2, Target, Timer, AlarmClockOff, Sparkles, TrendingUp } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { summarizeAnalytics } from "@/lib/metrics";
import { CATEGORY_META } from "@/lib/ui-maps";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  "var(--color-brand)", "var(--color-medium)", "var(--color-high)", "var(--color-low)",
  "var(--color-brand-3)", "var(--color-warning)", "var(--color-critical)", "var(--color-subtle)",
];

const chartTooltip = {
  contentStyle: { background: "var(--color-surface-2)", border: "1px solid var(--color-border-strong)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "var(--color-fg)" },
};

export function AnalyticsView() {
  const { history, tasks, activity } = useStore();
  const s = summarizeAnalytics(history, tasks, activity);

  const trend = history.map((d) => ({ date: d.date.slice(5), score: d.score }));
  const focus = history.slice(-14).map((d) => ({ date: d.date.slice(5), focus: d.focusHours }));

  const byCat = Object.entries(
    tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const recommendations = [
    { icon: TrendingUp, text: `Your score is up ${s.weekDelta >= 0 ? "+" : ""}${s.weekDelta} this week. Mornings are your most productive block — protect 9–11 AM.` },
    { icon: Timer, text: `You average ${s.avgFocusHours}h of focus a day. Adding one more 90-min deep block would lift your weekly output ~15%.` },
    { icon: AlarmClockOff, text: s.missedDeadlines > 0 ? `${s.missedDeadlines} missed recently — enable earlier risk alerts so Pulse warns you 2 days out.` : `Zero missed deadlines lately. Keep letting Pulse front-load risky work.` },
  ];

  const stats = [
    { icon: CheckCircle2, label: "Tasks completed", value: s.totalCompleted, tone: "text-success" },
    { icon: Target, label: "Success rate", value: `${s.successRate}%`, tone: "text-brand" },
    { icon: Timer, label: "Avg focus / day", value: `${s.avgFocusHours}h`, tone: "text-medium" },
    { icon: AlarmClockOff, label: "Missed deadlines", value: s.missedDeadlines, tone: "text-critical" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-fg">Analytics</h2>
        <p className="text-xs text-subtle">How you actually spend your time — and how to get better.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="glass card-sheen flex items-center gap-3 rounded-2xl px-4 py-3.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface">
              <st.icon className={cn("h-5 w-5", st.tone)} />
            </div>
            <div>
              <div className="font-display text-xl font-semibold text-fg">{st.value}</div>
              <div className="text-[11px] text-subtle">{st.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Productivity trend */}
        <div className="glass card-sheen rounded-3xl p-5 lg:col-span-2">
          <p className="mb-3 font-display text-sm font-semibold text-fg">Productivity trend · 21 days</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-subtle)" }} axisLine={false} tickLine={false} interval={3} />
                <YAxis domain={[30, 100]} tick={{ fontSize: 10, fill: "var(--color-subtle)" }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltip} />
                <Area type="monotone" dataKey="score" stroke="var(--color-brand)" strokeWidth={2} fill="url(#aGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category donut */}
        <div className="glass card-sheen rounded-3xl p-5">
          <p className="mb-3 font-display text-sm font-semibold text-fg">Work by category</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none">
                  {byCat.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {byCat.map((c, i) => (
              <span key={c.name} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {CATEGORY_META[c.name as keyof typeof CATEGORY_META]?.label ?? c.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Focus hours */}
        <div className="glass card-sheen rounded-3xl p-5 lg:col-span-2">
          <p className="mb-3 font-display text-sm font-semibold text-fg">Focus hours · last 14 days</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={focus} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-subtle)" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-subtle)" }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltip} cursor={{ fill: "var(--color-surface-2)" }} />
                <Bar dataKey="focus" fill="var(--color-brand-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI recommendations */}
        <div className="glass card-sheen rounded-3xl p-5">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" /> AI recommendations
          </div>
          <div className="space-y-2.5">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/40 p-3">
                <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p className="text-xs leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
