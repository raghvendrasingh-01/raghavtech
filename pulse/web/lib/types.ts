/**
 * Domain types for Pulse.
 * These mirror the Supabase schema (see /supabase/schema.sql) so the same
 * shapes flow through the local intelligence engine and, later, the API.
 */

export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "done" | "missed";
export type Category =
  | "study"
  | "work"
  | "personal"
  | "health"
  | "interview"
  | "project"
  | "finance"
  | "other"
  | (string & {});
export type Difficulty = "easy" | "medium" | "hard";
export type EnergyLevel = "low" | "medium" | "high";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  estimateMin: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  /** User-entered estimate in minutes. */
  estimateMin: number;
  /** ISO deadline. */
  deadline: string;
  status: TaskStatus;
  /** 0-1 fraction complete. */
  progress: number;
  subtasks: Subtask[];
  createdAt: string;
  /** Optional user-declared importance 1-5 (defaults derived from difficulty/category). */
  importance?: number;
  /** Best time-of-day window the user prefers, if any. */
  preferredWindow?: "morning" | "afternoon" | "evening";
  /** Manually overriden priority for the Kanban board */
  manualPriority?: Priority;
  /** Public URLs of files uploaded to Supabase Storage. */
  attachments?: string[];
}

/**
 * Task mutations returned by the AI chat backend (via GPT tool calling). The
 * backend is stateless, so instead of writing to a DB it returns these for the
 * frontend to apply to its in-memory store.
 */
export interface CreateMutation {
  type: "create";
  /** Partial task from the model — the store fills in id/defaults. */
  task: Partial<Task> & { title: string; deadline: string };
}
export interface UpdateMutation {
  type: "update";
  id: string;
  updates: Partial<Task>;
}
export interface DeleteMutation {
  type: "delete";
  id: string;
}
export type Mutation = CreateMutation | UpdateMutation | DeleteMutation;

/** Output of the priority engine — attached at read time, not stored raw. */
export interface PriorityResult {
  priority: Priority;
  /** 0-100 composite score. */
  score: number;
  /** Human-readable explanation of WHY this priority. */
  reason: string;
  factors: { label: string; weight: number; detail: string }[];
}

/** A task enriched with live priority + risk (what the store hands to the UI). */
export interface TaskWithIntel extends Task {
  priorityResult: PriorityResult;
  riskResult: RiskResult;
}

/** Output of the deadline-risk engine. */
export interface RiskResult {
  /** 0-100 probability of missing the deadline. */
  risk: number;
  level: "safe" | "watch" | "high" | "critical";
  workRemainingMin: number;
  freeTimeBeforeDeadlineMin: number;
  message: string;
  recommendation: string;
}

export type ScheduleBlockKind =
  | "task"
  | "event"
  | "break"
  | "focus"
  | "buffer";

export interface ScheduleBlock {
  id: string;
  title: string;
  kind: ScheduleBlockKind;
  start: string; // ISO
  end: string; // ISO
  taskId?: string;
  category?: Category;
  /** True when the scheduler placed this to hit an at-risk deadline. */
  rescue?: boolean;
  /** True when the user manually pinned this block in the timeline. */
  pinned?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: "meeting" | "class" | "event" | "personal";
  location?: string;
}

export type HabitCadence = "daily" | "weekdays" | "weekly";

export interface Habit {
  id: string;
  name: string;
  icon: string; // lucide icon name
  cadence: HabitCadence;
  color: Priority | "brand";
  /** ISO dates (yyyy-mm-dd) the habit was completed. */
  completed: string[];
  targetPerWeek: number;
}

export interface GoalMilestone {
  id: string;
  title: string;
  done: boolean;
  etaWeeks: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number; // 0-1
  milestones: GoalMilestone[];
  category: Category;
}

export interface AiSuggestion {
  id: string;
  kind: "reschedule" | "focus" | "break" | "risk" | "insight" | "burnout";
  title: string;
  body: string;
  createdAt: string;
  cta?: string;
}

export interface ActivityItem {
  id: string;
  kind: "completed" | "created" | "rescheduled" | "missed" | "streak";
  text: string;
  at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ProductivityDay {
  date: string; // yyyy-mm-dd
  completed: number;
  focusHours: number;
  score: number; // 0-100
}
