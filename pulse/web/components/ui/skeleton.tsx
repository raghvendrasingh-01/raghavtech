import { cn } from "@/lib/utils";

/** Shimmering skeleton placeholder for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-gradient-to-r from-surface via-surface-2 to-surface",
        className
      )}
    />
  );
}
