import Link from "next/link";
import { Logo } from "@/components/app/logo";

const GROUPS = [
  { title: "Product", links: ["Features", "AI Planner", "Deadline Radar", "Pricing"] },
  { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms", "Security"] },
];

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.5fr_2fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Your AI Chief of Staff. Plans your day, protects your deadlines, and
            keeps you moving.
          </p>
          <p className="mt-6 text-xs text-subtle">© {2026} Pulse. Built for the last-minute life.</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{g.title}</p>
              <ul className="mt-3 space-y-2">
                {g.links.map((l) => (
                  <li key={l}>
                    <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-fg">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
