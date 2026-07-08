"use client";

import * as React from "react";
import { buildSeed, type Seed } from "@/lib/seed/data";
import {
  computePriority,
  computeRisk,
  generateSchedule,
} from "@/lib/intelligence";
import type {
  Task,
  Subtask,
  Habit,
  Goal,
  ChatMessage,
  ActivityItem,
  ScheduleBlock,
  TaskWithIntel,
} from "@/lib/types";

export interface AppSettings {
  dayStartHour: number;
  dayEndHour: number;
  maxFocusMin: number;
  breakMin: number;
  categories: string[];
  calConnected?: boolean;
  tasksConnected?: boolean;
}

/**
 * Client-side demo store. Holds all app state, initialised from the seed at
 * mount (so timestamps are client-stable — no hydration drift), derives
 * priority + risk for every task, and exposes the mutations the UI needs.
 *
 * In Phase 6 the same actions become thin wrappers over the FastAPI/Supabase
 * API; components consuming this hook won't change.
 */

interface StoreValue extends Seed {
  now: Date;
  tasksDerived: TaskWithIntel[];
  schedule: ScheduleBlock[];
  pinnedBlocks: ScheduleBlock[];
  settings: AppSettings;
  // actions
  updateSettings: (s: Partial<AppSettings>) => void;
  addTask: (t: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleSubtask: (taskId: string, subId: string) => void;
  completeTask: (id: string) => void;
  setProgress: (id: string, progress: number) => void;
  toggleHabit: (id: string, day: string) => void;
  addGoal: (g: Goal) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  pushChat: (m: ChatMessage) => void;
  deleteTask: (id: string) => void;
  pinBlock: (b: ScheduleBlock) => void;
  unpinBlock: (id: string) => void;
  regenerate: () => void;
  resetData: () => void;
  syncCalendar: () => Promise<void>;
  syncGoogleTasks: () => Promise<void>;
}

const Ctx = React.createContext<StoreValue | null>(null);

export function useStore() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useStore must be used within <DemoStoreProvider>");
  return v;
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const [now] = React.useState(() => new Date());
  const [seed, setSeed] = React.useState<Seed>(() => buildSeed(now));
  const [scheduleNonce, setScheduleNonce] = React.useState(0);
  const [pinnedBlocks, setPinnedBlocks] = React.useState<ScheduleBlock[]>([]);
  const [settings, setSettings] = React.useState<AppSettings>({
    dayStartHour: 8,
    dayEndHour: 22,
    maxFocusMin: 90,
    breakMin: 15,
    categories: ["study", "work", "project", "interview", "personal", "health", "finance", "other"],
  });

  React.useEffect(() => {
    const savedSeed = localStorage.getItem("pulse-seed");
    if (savedSeed) {
      try { setSeed(JSON.parse(savedSeed)); } catch (e) {}
    }
    const savedPinned = localStorage.getItem("pulse-pinned");
    if (savedPinned) {
      try { setPinnedBlocks(JSON.parse(savedPinned)); } catch (e) {}
    }
    const savedSettings = localStorage.getItem("pulse-settings");
    if (savedSettings) {
      try { setSettings(JSON.parse(savedSettings)); } catch (e) {}
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted) localStorage.setItem("pulse-seed", JSON.stringify(seed));
  }, [seed, mounted]);

  React.useEffect(() => {
    if (mounted) localStorage.setItem("pulse-pinned", JSON.stringify(pinnedBlocks));
  }, [pinnedBlocks, mounted]);

  React.useEffect(() => {
    if (mounted) localStorage.setItem("pulse-settings", JSON.stringify(settings));
  }, [settings, mounted]);

  const addActivity = React.useCallback(
    (item: ActivityItem) =>
      setSeed((s) => ({ ...s, activity: [item, ...s.activity].slice(0, 30) })),
    []
  );

  const resetData = React.useCallback(() => {
    setSeed({
      tasks: [],
      events: [],
      goals: [],
      habits: [],
      activity: [],
      history: [],
      chat: [],
    });
    setPinnedBlocks([]);
  }, []);

  const syncCalendar = React.useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      if (!res.ok) {
        const errObj = await res.json().catch(() => null);
        throw new Error((errObj && errObj.error) ? errObj.error : "Network error");
      }
      const data = await res.json();
      if (data.events) {
        setSeed((s) => ({ ...s, events: data.events }));
        addActivity({ id: `act-cal-${Date.now()}`, kind: "completed", text: `Synced ${data.events.length} Google Calendar events`, at: new Date().toISOString() });
      }
    } catch (e: any) {
      console.error("Failed to sync calendar:", e);
      addActivity({ id: `act-cal-err-${Date.now()}`, kind: "missed", text: `Sync failed`, at: new Date().toISOString() });
      alert(e.message);
    }
  }, [addActivity]);

  const syncGoogleTasks = React.useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const errObj = await res.json().catch(() => null);
        throw new Error((errObj && errObj.error) ? errObj.error : "Network error");
      }
      const data = await res.json();
      if (data.tasks) {
        setSeed((s) => {
          const googleTasksMap = new Map<string, Task>(data.tasks.map((t: Task) => [t.id, t]));
          
          // 1. Keep native Pulse tasks, and keep Google Tasks that STILL exist in Google.
          // For Google Tasks that still exist, update them with the fresh data from Google.
          const updatedPulseTasks = s.tasks
            .filter(t => !t.id.startsWith("gtask-") || googleTasksMap.has(t.id))
            .map(t => t.id.startsWith("gtask-") ? { ...t, ...googleTasksMap.get(t.id) } : t);

          // 2. Add brand new Google Tasks that we didn't have before.
          const existingIds = new Set(s.tasks.map(t => t.id));
          const brandNewTasks = data.tasks.filter((t: Task) => !existingIds.has(t.id));

          return { ...s, tasks: [...updatedPulseTasks, ...brandNewTasks] };
        });
        addActivity({ id: `act-gtasks-${Date.now()}`, kind: "completed", text: `Synced ${data.tasks.length} Google Tasks`, at: new Date().toISOString() });
      }
    } catch (e: any) {
      console.error("Failed to sync Google Tasks:", e);
      addActivity({ id: `act-gtasks-err-${Date.now()}`, kind: "missed", text: `Tasks sync failed`, at: new Date().toISOString() });
      alert(e.message);
    }
  }, [addActivity]);

  const addTask = React.useCallback((t: Task) => {
    setSeed((s) => ({ ...s, tasks: [t, ...s.tasks] }));
    addActivity({ id: `act-${t.id}`, kind: "created", text: `Added “${t.title}”`, at: new Date().toISOString() });
  }, [addActivity]);

  const updateTask = React.useCallback((id: string, patch: Partial<Task>) => {
    setSeed((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const toggleSubtask = React.useCallback((taskId: string, subId: string) => {
    setSeed((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const subtasks: Subtask[] = t.subtasks.map((sub) => (sub.id === subId ? { ...sub, done: !sub.done } : sub));
        const done = subtasks.filter((x) => x.done).length;
        const progress = subtasks.length ? done / subtasks.length : t.progress;
        return { ...t, subtasks, progress, status: progress >= 1 ? "done" : t.status === "todo" ? "in_progress" : t.status };
      }),
    }));
  }, []);

  const setProgress = React.useCallback((id: string, progress: number) => {
    setSeed((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, progress, status: progress >= 1 ? "done" : t.status } : t)) }));
  }, []);

  const completeTask = React.useCallback((id: string) => {
    setSeed((s) => {
      const task = s.tasks.find((t) => t.id === id);
      return {
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "done", progress: 1 } : t)),
        activity: task
          ? [
              {
                id: `act-done-${id}-${Date.now()}`,
                kind: "completed" as const,
                text: `Completed “${task.title}”`,
                at: new Date().toISOString(),
              },
              ...s.activity,
            ].slice(0, 30)
          : s.activity,
      };
    });
  }, []);

  const deleteTask = React.useCallback((id: string) => {
    setSeed((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
    }));
  }, []);

  const toggleHabit = React.useCallback((id: string, day: string) => {
    setSeed((s) => ({
      ...s,
      habits: s.habits.map((h: Habit) =>
        h.id === id
          ? { ...h, completed: h.completed.includes(day) ? h.completed.filter((d) => d !== day) : [...h.completed, day] }
          : h
      ),
    }));
  }, []);

  const addGoal = React.useCallback((g: Goal) => {
    setSeed((s) => ({ ...s, goals: [g, ...s.goals] }));
  }, []);

  const toggleMilestone = React.useCallback((goalId: string, milestoneId: string) => {
    setSeed((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const milestones = g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
        const progress = milestones.length ? milestones.filter((m) => m.done).length / milestones.length : g.progress;
        return { ...g, milestones, progress };
      }),
    }));
  }, []);

  const pushChat = React.useCallback((m: ChatMessage) => {
    setSeed((s) => ({ ...s, chat: [...s.chat, m] }));
  }, []);

  const pinBlock = React.useCallback((b: ScheduleBlock) => {
    setPinnedBlocks((prev) => {
      // Don't duplicate if already pinned
      if (prev.some((p) => p.id === b.id)) return prev;
      return [...prev, { ...b, pinned: true }];
    });
    setScheduleNonce((n) => n + 1); // trigger re-optimize
  }, []);

  const unpinBlock = React.useCallback((id: string) => {
    setPinnedBlocks((prev) => prev.filter((b) => b.id !== id));
    setScheduleNonce((n) => n + 1); // trigger re-optimize
  }, []);
  
  const updateSettings = React.useCallback((s: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...s }));
    setScheduleNonce((n) => n + 1); // trigger re-optimize on schedule bounds change
  }, []);

  const regenerate = React.useCallback(() => setScheduleNonce((n) => n + 1), []);

  const tasksDerived = React.useMemo<TaskWithIntel[]>(
    () =>
      seed.tasks
        .map((t) => {
          let pr = computePriority(t, { now });
          if (t.manualPriority) {
            pr = {
              ...pr,
              priority: t.manualPriority,
              reason: "Manually overridden by user",
              factors: [{ label: "User Override", weight: 100, detail: "User dragged to this priority" }],
            };
          }
          return {
            ...t,
            priorityResult: pr,
            riskResult: computeRisk(t, { now, events: seed.events }),
          };
        })
        .sort((a, b) => b.priorityResult.score - a.priorityResult.score),
    [seed.tasks, seed.events, now]
  );

  const schedule = React.useMemo(
    () => generateSchedule({ 
      tasks: seed.tasks, 
      events: seed.events, 
      now, 
      pinnedBlocks,
      dayStartHour: settings.dayStartHour,
      dayEndHour: settings.dayEndHour,
      maxFocusMin: settings.maxFocusMin,
      breakMin: settings.breakMin,
    }).blocks,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed.tasks, seed.events, now, pinnedBlocks, settings, scheduleNonce]
  );

  // Auto-sync intervals (30 minutes)
  React.useEffect(() => {
    if (!mounted) return;

    // Initial sync on boot if connected
    if (settings.calConnected) syncCalendar();
    if (settings.tasksConnected) syncGoogleTasks();

    // Set up 2-minute polling (2 * 60 * 1000 = 120000 ms)
    const interval = setInterval(() => {
      if (settings.calConnected) syncCalendar();
      if (settings.tasksConnected) syncGoogleTasks();
    }, 120000);

    return () => clearInterval(interval);
  }, [mounted, settings.calConnected, settings.tasksConnected, syncCalendar, syncGoogleTasks]);

  const value: StoreValue = {
    ...seed,
    now,
    tasksDerived,
    schedule,
    addTask,
    updateTask,
    toggleSubtask,
    completeTask,
    setProgress,
    toggleHabit,
    addGoal,
    toggleMilestone,
    regenerate,
    pushChat,
    deleteTask,
    pinnedBlocks,
    pinBlock,
    unpinBlock,
    settings,
    updateSettings,
    resetData,
    syncCalendar,
    syncGoogleTasks,
  };

  if (!mounted) {
    // Client-only gate — avoids hydration drift and shows the skeleton shell.
    return <div className="min-h-screen" />;
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
