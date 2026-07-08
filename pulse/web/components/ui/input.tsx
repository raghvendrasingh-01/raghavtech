import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-fg placeholder:text-subtle transition-colors focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "min-h-20 resize-none", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(base, "appearance-none bg-[right_0.75rem_center] pr-9", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("block", className)}>
      <div className="mb-1.5 block text-xs font-medium text-muted">{label}</div>
      {children}
      {hint && <div className="mt-1 block text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}
