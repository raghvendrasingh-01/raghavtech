"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-gradient-to-r from-brand to-brand-2" : "bg-surface-2"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
