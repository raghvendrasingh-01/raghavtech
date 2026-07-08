"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Animated circular gauge — the "Deadline Radar" dial. Reused on the landing
 * hero and the dashboard. Colour shifts with the value so a high risk reads
 * red at a glance.
 */
export function RadialGauge({
  value,
  size = 160,
  stroke = 12,
  label,
  sublabel,
  tone,
  className,
}: {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: "auto" | "brand" | "critical" | "high" | "low";
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;

  const resolved =
    tone && tone !== "auto"
      ? tone
      : pct >= 70
        ? "critical"
        : pct >= 40
          ? "high"
          : "low";

  const grad = {
    brand: ["var(--color-brand)", "var(--color-brand-3)"],
    critical: ["var(--color-critical)", "var(--color-high)"],
    high: ["var(--color-high)", "var(--color-warning)"],
    low: ["var(--color-low)", "var(--color-success)"],
  }[resolved];

  const gid = `gauge-${resolved}`;

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={grad[0]} />
            <stop offset="100%" stopColor={grad[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl font-bold text-fg">
            {label ?? `${Math.round(pct)}%`}
          </div>
          {sublabel && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-subtle">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
