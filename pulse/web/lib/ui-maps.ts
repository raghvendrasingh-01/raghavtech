import {
  GraduationCap,
  Briefcase,
  User,
  HeartPulse,
  Handshake,
  FolderKanban,
  Wallet,
  Circle,
  CheckCircle2,
  Plus,
  CalendarClock,
  AlarmClockOff,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type { Category, Priority, ScheduleBlockKind, ActivityItem } from "@/lib/types";

/** Visual metadata for task categories. `text` / `bg` use theme tokens. */
export const CATEGORY_META: Record<Category, { icon: LucideIcon; label: string; text: string; bg: string }> = {
  study: { icon: GraduationCap, label: "Study", text: "text-brand", bg: "bg-brand/12" },
  work: { icon: Briefcase, label: "Work", text: "text-medium", bg: "bg-medium/12" },
  personal: { icon: User, label: "Personal", text: "text-low", bg: "bg-low/12" },
  health: { icon: HeartPulse, label: "Health", text: "text-success", bg: "bg-success/12" },
  interview: { icon: Handshake, label: "Interview", text: "text-high", bg: "bg-high/12" },
  project: { icon: FolderKanban, label: "Project", text: "text-brand-3", bg: "bg-brand-3/12" },
  finance: { icon: Wallet, label: "Finance", text: "text-warning", bg: "bg-warning/12" },
  other: { icon: Circle, label: "Other", text: "text-subtle", bg: "bg-surface-2" },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Colour + label for schedule timeline blocks. */
export const SCHEDULE_KIND_META: Record<
  ScheduleBlockKind,
  { bar: string; dot: string; label: string }
> = {
  focus: { bar: "bg-brand", dot: "bg-brand", label: "Focus" },
  task: { bar: "bg-brand", dot: "bg-brand", label: "Task" },
  event: { bar: "bg-medium", dot: "bg-medium", label: "Event" },
  break: { bar: "bg-low", dot: "bg-low", label: "Break" },
  buffer: { bar: "bg-surface-2", dot: "bg-subtle", label: "Buffer" },
};

export const ACTIVITY_META: Record<ActivityItem["kind"], { icon: LucideIcon; text: string }> = {
  completed: { icon: CheckCircle2, text: "text-success" },
  created: { icon: Plus, text: "text-brand" },
  rescheduled: { icon: CalendarClock, text: "text-medium" },
  missed: { icon: AlarmClockOff, text: "text-critical" },
  streak: { icon: Flame, text: "text-high" },
};
