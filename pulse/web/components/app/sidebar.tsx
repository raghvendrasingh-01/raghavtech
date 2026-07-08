"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
      <div className="glass-strong m-3 flex flex-1 flex-col rounded-2xl p-3">
        <div className="px-2 py-3">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <nav className="mt-2 flex-1 space-y-5 overflow-y-auto px-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group.id).map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        active ? "text-fg" : "text-muted hover:text-fg"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/20 to-brand-2/10 ring-1 ring-brand/30"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <item.icon className={cn("relative z-10 h-4.5 w-4.5", active && "text-brand")} />
                      <span className="relative z-10 font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <UpgradeCard />
      </div>
    </aside>
  );
}

function UpgradeCard() {
  return (
    <div className="card-sheen relative mt-3 overflow-hidden rounded-xl bg-gradient-to-br from-brand/20 to-brand-3/10 p-4">
      <p className="font-display text-sm font-semibold text-fg">Pulse Pro</p>
      <p className="mt-1 text-xs text-muted">
        Unlimited AI planning, Google Calendar sync & burnout radar.
      </p>
      <button className="mt-3 w-full rounded-lg bg-white/10 py-1.5 text-xs font-medium text-fg transition hover:bg-white/20">
        Upgrade
      </button>
    </div>
  );
}
