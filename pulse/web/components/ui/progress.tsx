import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

/** Thin gradient progress bar (0–1). */
export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = clamp(value) * 100;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r from-brand to-brand-3 transition-[width] duration-500", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
