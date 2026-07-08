import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clamp a number between min and max. */
export function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

/** Round to a given number of decimals. */
export function round(n: number, dp = 0) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Human "in 3 hours" / "in 2 days" / "5 hours ago" from an ISO string. */
export function relativeTime(iso: string, now = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  let value: string;
  if (mins < 60) value = `${mins}m`;
  else if (hours < 24) value = `${hours}h`;
  else value = `${days}d`;

  if (mins < 1) return "now";
  return past ? `${value} ago` : `in ${value}`;
}

/** Hours (float) until an ISO deadline; negative if past. */
export function hoursUntil(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000;
}

/** Format an ISO time as "9:30 AM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format an ISO date as "Mon, Jul 7". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Format a duration in minutes as "1h 30m" / "45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Deterministic pseudo-random in [0,1) from a string seed — stable across renders. */
export function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
