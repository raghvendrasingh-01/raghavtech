// ============ SHARED TYPES ============

export interface CharStats {
  attempts: number;
  errors: number;
  totalTime: number; // cumulative ms spent on correct presses of this char
  lastPracticed: number;
}

export type TestMode = "adaptive" | "words" | "time" | "quote";

export interface LessonState {
  activeChars: string[];
  charStats: Record<string, CharStats>;
  totalSessions: number;
  totalCharsTyped: number;
  totalCorrect: number;
  bestWpm: number;
  currentStreak: number;
  lastSessionDate: string;
  history: SessionRecord[];
}

export interface SessionRecord {
  date: number;
  mode: TestMode;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  charsTyped: number;
}

// A point sampled once per second for the live/results WPM graph.
export interface WpmSample {
  time: number;     // seconds elapsed
  wpm: number;      // net wpm at this moment
  raw: number;      // raw wpm at this moment
  errors: number;   // errors committed during this second
}

export interface SessionStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  charsTyped: number;
  errors: number;
  weakChars: string[];
  samples: WpmSample[];
  durationSec: number;
}

export interface TestConfig {
  mode: TestMode;
  timeSec: number;     // for time mode
  wordCount: number;   // for words mode
  punctuation: boolean;
  numbers: boolean;
}
