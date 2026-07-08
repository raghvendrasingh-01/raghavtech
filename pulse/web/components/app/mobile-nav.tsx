"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, Sparkles, Flame, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/planner", label: "Planner", icon: Sparkles },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="glass-strong mx-3 mb-3 flex items-center justify-around rounded-2xl px-2 py-2">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-[10px] font-medium transition-colors",
                active ? "text-brand" : "text-subtle"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
