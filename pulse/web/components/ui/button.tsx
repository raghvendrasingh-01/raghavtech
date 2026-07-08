"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        primary:
          "text-white bg-gradient-to-br from-brand to-brand-2 shadow-[0_8px_30px_-8px_var(--color-brand)] hover:shadow-[0_10px_40px_-8px_var(--color-brand)] hover:brightness-110",
        secondary:
          "glass text-fg hover:bg-surface-2 hover:border-border-strong",
        outline:
          "border border-border text-fg hover:bg-surface hover:border-border-strong",
        ghost: "text-muted hover:text-fg hover:bg-surface",
        danger:
          "text-white bg-gradient-to-br from-critical to-high hover:brightness-110 shadow-[0_8px_30px_-10px_var(--color-critical)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { buttonVariants };
