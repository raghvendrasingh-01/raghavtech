import type {
  Task,
  CalendarEvent,
  Habit,
  Goal,
  ProductivityDay,
  ActivityItem,
  ChatMessage,
} from "@/lib/types";

/**
 * Demo dataset. Everything is anchored to a `now` passed in at runtime so the
 * intelligence engine (priority / risk / schedule) always produces live,
 * believable output regardless of when the demo is run.
 */

function iso(now: Date, dayOffset: number, hour: number, min = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}
/**
 * Deadline `h` hours from `now`. Used for the time-sensitive tasks so the
 * deadline-risk demo is dramatic and stable no matter what time it's run —
 * a task needing 6h of work due in 5h is always high-risk.
 */
function isoIn(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}
function ymd(now: Date, dayOffset: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

export interface Seed {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  goals: Goal[];
  history: ProductivityDay[];
  activity: ActivityItem[];
  chat: ChatMessage[];
}

export function buildSeed(now: Date = new Date()): Seed {
  const tasks: Task[] = [
    {
      id: "t1",
      title: "Data Structures Assignment 3",
      description: "Implement AVL tree + write the analysis section. Submit on the portal.",
      category: "study",
      difficulty: "hard",
      estimateMin: 480,
      deadline: isoIn(now, 5),
      status: "in_progress",
      progress: 0.2,
      importance: 4,
      preferredWindow: "morning",
      createdAt: iso(now, -2, 10),
      subtasks: [
        { id: "t1s1", title: "AVL insert + rotations", done: true, estimateMin: 90 },
        { id: "t1s2", title: "AVL delete", done: false, estimateMin: 90 },
        { id: "t1s3", title: "Complexity analysis writeup", done: false, estimateMin: 120 },
        { id: "t1s4", title: "Test cases + submit", done: false, estimateMin: 60 },
      ],
    },
    {
      id: "t2",
      title: "Google interview prep — Dynamic Programming",
      description: "Grind 15 DP problems, revise the patterns sheet.",
      category: "interview",
      difficulty: "hard",
      estimateMin: 300,
      deadline: iso(now, 3, 18, 0),
      status: "in_progress",
      progress: 0.3,
      importance: 5,
      preferredWindow: "evening",
      createdAt: iso(now, -4, 20),
      subtasks: [
        { id: "t2s1", title: "1D DP set", done: true, estimateMin: 90 },
        { id: "t2s2", title: "2D grid DP", done: false, estimateMin: 90 },
        { id: "t2s3", title: "Knapsack variants", done: false, estimateMin: 120 },
      ],
    },
    {
      id: "t3",
      title: "Pay credit card bill",
      description: "Autopay failed last month — do it manually this time.",
      category: "finance",
      difficulty: "easy",
      estimateMin: 15,
      deadline: isoIn(now, 4),
      status: "todo",
      progress: 0,
      importance: 4,
      createdAt: iso(now, -1, 9),
      subtasks: [],
    },
    {
      id: "t4",
      title: "Ship Pulse hackathon MVP",
      description: "Dashboard + AI planner + deadline radar. Deploy to Vercel.",
      category: "project",
      difficulty: "hard",
      estimateMin: 480,
      deadline: isoIn(now, 7),
      status: "in_progress",
      progress: 0.4,
      importance: 5,
      preferredWindow: "afternoon",
      createdAt: iso(now, -3, 14),
      subtasks: [
        { id: "t4s1", title: "Design system + landing", done: true, estimateMin: 120 },
        { id: "t4s2", title: "Dashboard + intelligence", done: false, estimateMin: 180 },
        { id: "t4s3", title: "AI chat planner", done: false, estimateMin: 120 },
        { id: "t4s4", title: "Deploy + demo script", done: false, estimateMin: 60 },
      ],
    },
    {
      id: "t5",
      title: "Physics problem set 6",
      description: "Electromagnetism — problems 1–12.",
      category: "study",
      difficulty: "medium",
      estimateMin: 180,
      deadline: iso(now, 4, 17, 0),
      status: "todo",
      progress: 0,
      importance: 3,
      createdAt: iso(now, -1, 11),
      subtasks: [],
    },
    {
      id: "t6",
      title: "Send standup notes to team",
      category: "work",
      difficulty: "easy",
      estimateMin: 20,
      deadline: isoIn(now, 3),
      status: "todo",
      progress: 0,
      importance: 2,
      createdAt: iso(now, 0, 8),
      subtasks: [],
    },
    {
      id: "t7",
      title: "Read DDIA — Chapter 4 (Encoding)",
      description: "Notes on Avro vs Protobuf for the system design goal.",
      category: "personal",
      difficulty: "medium",
      estimateMin: 90,
      deadline: iso(now, 5, 22, 0),
      status: "in_progress",
      progress: 0.5,
      importance: 3,
      createdAt: iso(now, -6, 21),
      subtasks: [],
    },
  ];

  const events: CalendarEvent[] = [
    { id: "e1", title: "Daily standup", start: iso(now, 0, 9, 0), end: iso(now, 0, 9, 15), kind: "meeting" },
    { id: "e2", title: "Algorithms lecture", start: iso(now, 0, 10, 0), end: iso(now, 0, 12, 0), kind: "class", location: "Hall C" },
    { id: "e3", title: "1:1 with mentor", start: iso(now, 0, 14, 0), end: iso(now, 0, 14, 30), kind: "meeting" },
    { id: "e4", title: "Gym", start: iso(now, 0, 18, 0), end: iso(now, 0, 19, 0), kind: "personal" },
    { id: "e5", title: "Client demo", start: iso(now, 1, 11, 0), end: iso(now, 1, 12, 0), kind: "meeting" },
    { id: "e6", title: "DBMS lab", start: iso(now, 1, 14, 0), end: iso(now, 1, 16, 0), kind: "class", location: "Lab 2" },
    { id: "e7", title: "Hackathon check-in", start: iso(now, 2, 17, 0), end: iso(now, 2, 17, 30), kind: "event" },
  ];

  const habits: Habit[] = [
    { id: "h1", name: "Coding", icon: "Code2", cadence: "daily", color: "brand", targetPerWeek: 7, completed: streak(now, [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12]) },
    { id: "h2", name: "Reading", icon: "BookOpen", cadence: "daily", color: "medium", targetPerWeek: 5, completed: streak(now, [1, 2, 4, 5, 7, 9, 11]) },
    { id: "h3", name: "Workout", icon: "Dumbbell", cadence: "weekdays", color: "high", targetPerWeek: 5, completed: streak(now, [0, 2, 3, 5, 7, 8, 10]) },
    { id: "h4", name: "Meditation", icon: "Brain", cadence: "daily", color: "low", targetPerWeek: 7, completed: streak(now, [0, 1, 2, 3, 4, 6, 8, 9]) },
    { id: "h5", name: "Japanese", icon: "Languages", cadence: "daily", color: "critical", targetPerWeek: 6, completed: streak(now, [1, 3, 4, 6, 8, 10]) },
    { id: "h6", name: "Sleep 7h+", icon: "Moon", cadence: "daily", color: "brand", targetPerWeek: 7, completed: streak(now, [0, 1, 3, 4, 5, 7, 9, 10, 12]) },
  ];

  const goals: Goal[] = [
    {
      id: "g1",
      title: "Crack a Google internship",
      description: "SWE intern offer by end of semester.",
      targetDate: iso(now, 75, 18),
      progress: 0.42,
      category: "interview",
      milestones: [
        { id: "g1m1", title: "Finish DSA patterns (Grind 75)", done: true, etaWeeks: 3 },
        { id: "g1m2", title: "System design fundamentals", done: false, etaWeeks: 3 },
        { id: "g1m3", title: "2 portfolio projects shipped", done: false, etaWeeks: 4 },
        { id: "g1m4", title: "Resume reviewed + polished", done: true, etaWeeks: 1 },
        { id: "g1m5", title: "10 mock interviews", done: false, etaWeeks: 4 },
      ],
    },
    {
      id: "g2",
      title: "Grow Pulse to 100 users",
      description: "Launch the productivity app publicly and get first users.",
      targetDate: iso(now, 40, 18),
      progress: 0.25,
      category: "project",
      milestones: [
        { id: "g2m1", title: "MVP shipped", done: false, etaWeeks: 1 },
        { id: "g2m2", title: "Landing + waitlist live", done: true, etaWeeks: 1 },
        { id: "g2m3", title: "Product Hunt launch", done: false, etaWeeks: 2 },
      ],
    },
  ];

  // 21 days of productivity history with a gentle upward trend + noise.
  const history: ProductivityDay[] = Array.from({ length: 21 }, (_, i) => {
    const dayOffset = i - 20;
    const base = 58 + i * 1.1;
    const noise = ((i * 37) % 17) - 8;
    const score = Math.max(35, Math.min(96, Math.round(base + noise)));
    return {
      date: ymd(now, dayOffset),
      completed: Math.max(0, Math.round(score / 18 + ((i * 13) % 3))),
      focusHours: Math.round((score / 22) * 10) / 10,
      score,
    };
  });

  const activity: ActivityItem[] = [
    { id: "a1", kind: "completed", text: "Completed “AVL insert + rotations”", at: iso(now, 0, 8, 40) },
    { id: "a2", kind: "streak", text: "🔥 12-day Coding streak", at: iso(now, 0, 8, 5) },
    { id: "a3", kind: "rescheduled", text: "Pulse moved DP prep to tonight to protect your deadline", at: iso(now, -1, 22, 10) },
    { id: "a4", kind: "created", text: "Added “Physics problem set 6”", at: iso(now, -1, 11, 0) },
    { id: "a5", kind: "completed", text: "Completed “Resume review”", at: iso(now, -1, 16, 30) },
    { id: "a6", kind: "missed", text: "Missed “Water the plants” 🪴", at: iso(now, -2, 20, 0) },
  ];

  const chat: ChatMessage[] = [
    {
      id: "c0",
      role: "assistant",
      content:
        "Morning! I've reviewed your day. **Data Structures Assignment 3** is your biggest risk — due tomorrow with ~4.8h of work left. Want me to build your day around it?",
      at: iso(now, 0, 8, 0),
    },
  ];

  return { tasks, events, habits, goals, history, activity, chat };
}

function streak(now: Date, daysAgo: number[]): string[] {
  return daysAgo.map((d) => ymd(now, -d));
}
