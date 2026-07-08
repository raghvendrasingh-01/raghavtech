"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-300",
          scrolled ? "glass-strong shadow-[0_10px_40px_-20px_#000]" : "border border-transparent"
        )}
      >
        <Link href="/" className="mr-2">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Open Pulse</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
