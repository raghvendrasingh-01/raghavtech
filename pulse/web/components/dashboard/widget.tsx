import Link from "next/link";
import { cn } from "@/lib/utils";

/** Titled glass panel used across the dashboard. */
export function Widget({
  title,
  icon: Icon,
  action,
  href,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  href?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("glass card-sheen flex flex-col rounded-3xl", className)}>
      <header className="flex items-center gap-2 px-5 pt-5">
        {Icon && <Icon className="h-4 w-4 text-brand" />}
        <h3 className="font-display text-sm font-semibold tracking-tight text-fg">{title}</h3>
        <div className="ml-auto flex items-center gap-2">
          {action}
          {href && (
            <Link href={href} className="text-xs text-subtle transition-colors hover:text-fg">
              View all
            </Link>
          )}
        </div>
      </header>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
