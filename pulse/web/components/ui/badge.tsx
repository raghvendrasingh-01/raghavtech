import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-muted",
        brand: "border-brand/30 bg-brand/10 text-brand",
        critical: "border-critical/30 bg-critical/10 text-critical",
        high: "border-high/30 bg-high/10 text-high",
        medium: "border-medium/30 bg-medium/10 text-medium",
        low: "border-low/30 bg-low/10 text-low",
        success: "border-success/30 bg-success/10 text-success",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Map a task Priority to a Badge tone. */
export function priorityTone(p: Priority): NonNullable<BadgeProps["tone"]> {
  return p; // Priority values map 1:1 onto tones
}
