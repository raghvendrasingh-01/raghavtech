import { cn } from "@/lib/utils";

/** Pulse wordmark + animated activity glyph. */
export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-3 shadow-[0_6px_20px_-6px_var(--color-brand)]">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2 6 4-14 2 8h6" />
        </svg>
        <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
      </span>
      {showWord && (
        <span className="font-display text-lg font-semibold tracking-tight text-fg">
          Pulse
        </span>
      )}
    </div>
  );
}
