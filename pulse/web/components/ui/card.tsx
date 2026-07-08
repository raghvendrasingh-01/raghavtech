import * as React from "react";
import { cn } from "@/lib/utils";

/** Premium glass card with an optional gradient hairline (`sheen`). */
export function Card({
  className,
  sheen = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { sheen?: boolean }) {
  return (
    <div
      className={cn(
        "glass rounded-2xl",
        sheen && "card-sheen",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 px-5 pt-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-sm font-semibold tracking-tight text-fg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-subtle", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
