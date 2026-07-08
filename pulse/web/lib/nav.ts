import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  Sparkles,
  MessageSquare,
  Flame,
  Target,
  BarChart3,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Section grouping in the sidebar. */
  group: "main" | "ai" | "growth";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, group: "main" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, group: "main" },
  { href: "/planner", label: "AI Planner", icon: Sparkles, group: "ai" },
  { href: "/chat", label: "AI Chat", icon: MessageSquare, group: "ai" },
  { href: "/habits", label: "Habits", icon: Flame, group: "growth" },
  { href: "/goals", label: "Goals", icon: Target, group: "growth" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "growth" },
  { href: "/settings", label: "Settings", icon: Settings, group: "growth" },
];

export const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "main", label: "Workspace" },
  { id: "ai", label: "Intelligence" },
  { id: "growth", label: "Growth" },
];
