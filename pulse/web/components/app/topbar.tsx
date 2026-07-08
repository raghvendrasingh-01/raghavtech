"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles, Plus } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { aiMode } from "@/lib/ai/adapter";
import { NotificationCenter } from "./notification-center";
import { useAuth } from "@/components/providers/auth-provider";
import { authMode } from "@/lib/auth";
import { UserButton } from "@clerk/nextjs";

export function Topbar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((i) => pathname.startsWith(i.href));
  const mode = aiMode();
  const user = useAuth();

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 px-4 pt-3 sm:-mx-6 sm:px-6">
      <div className="glass flex h-14 items-center gap-3 rounded-2xl px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-display text-sm font-semibold text-fg sm:text-base">
            {current?.label ?? "Dashboard"}
          </h1>
          <span className="hidden items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand sm:inline-flex">
            <Sparkles className="h-3 w-3" />
            {mode === "gpt" ? "GPT" : "AI"} active
          </span>
        </div>

        <div className="ml-auto hidden items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-1.5 text-sm text-subtle md:flex">
          <Search className="h-4 w-4" />
          <input
            placeholder="Ask Pulse or search…"
            className="w-44 bg-transparent text-fg placeholder:text-subtle focus:outline-none lg:w-56"
          />
          <kbd className="rounded border border-border px-1.5 text-[10px] text-subtle">⌘K</kbd>
        </div>

        <NotificationCenter />

        <Link href="/tasks?new=1">
          <Button size="sm" className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </Link>

        {authMode() === "clerk" ? (
          <div className="flex h-9 w-9 items-center justify-center">
            <UserButton />
          </div>
        ) : (
          <Link
            href="/settings"
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-semibold text-white"
            title={user.name}
          >
            {user.initials}
          </Link>
        )}
      </div>
    </header>
  );
}
