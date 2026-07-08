"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function CTA() {
  return (
    <section className="px-4 py-20">
      <Reveal>
        <div className="card-sheen relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] p-10 text-center sm:p-16">
          {/* glow backdrop */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-brand/25 via-brand-2/10 to-brand-3/20" />
            <div className="absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-brand/30 blur-[100px]" />
          </div>
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            Stop reacting to deadlines. <span className="text-gradient">Start beating them.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted">
            Give Pulse your week. Get back a plan, a clear head, and deadlines
            that no longer sneak up on you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="group">
                Open Pulse free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <span className="text-xs text-subtle">No card · Free for students</span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
