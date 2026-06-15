import type { LessonState, CharStats, TestConfig } from "./types";
import { DEFAULT_THEME_ID } from "./themes";

// ============ PERSISTENCE ============

const STORAGE_KEY = "typingPractice_v2";
const PREFS_KEY = "typingPrefs_v1";
const LEGACY_KEY = "typingPractice_v1";

export const CHAR_PROGRESSION = [
  "a", "s", "d", "f", "j", "k", "l", ";",
  "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
  "z", "x", "c", "v", "b", "n", "m", ",", ".",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
];

export const INITIAL_CHARS = ["a", "s", "d", "f", "j", "k", "l"];

const defaultState = (): LessonState => {
  const initialStats: Record<string, CharStats> = {};
  INITIAL_CHARS.forEach((char) => {
    initialStats[char] = { attempts: 0, errors: 0, totalTime: 0, lastPracticed: Date.now() };
  });
  return {
    activeChars: [...INITIAL_CHARS],
    charStats: initialStats,
    totalSessions: 0,
    totalCharsTyped: 0,
    totalCorrect: 0,
    bestWpm: 0,
    currentStreak: 0,
    lastSessionDate: "",
    history: [],
  };
};

export const loadState = (): LessonState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<LessonState>;
      return { ...defaultState(), ...parsed, history: parsed.history || [] };
    }
    // Migrate from v1 if present
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<LessonState>;
      // backfill totalTime on char stats
      const stats = parsed.charStats || {};
      Object.values(stats).forEach((s) => {
        if (s && (s as CharStats).totalTime === undefined) (s as CharStats).totalTime = 0;
      });
      return { ...defaultState(), ...parsed, history: [] };
    }
  } catch (e) {
    console.error("Failed to load state:", e);
  }
  return defaultState();
};

export const saveState = (state: LessonState) => {
  try {
    // keep history bounded
    const bounded = { ...state, history: state.history.slice(-100) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch (e) {
    console.error("Failed to save state:", e);
  }
};

export const resetState = (): LessonState => {
  localStorage.removeItem(STORAGE_KEY);
  return defaultState();
};

// ============ PREFERENCES ============

export interface Prefs {
  themeId: string;
  sound: boolean;
  config: TestConfig;
}

export const DEFAULT_PREFS: Prefs = {
  themeId: DEFAULT_THEME_ID,
  sound: false,
  config: {
    mode: "adaptive",
    timeSec: 30,
    wordCount: 25,
    punctuation: false,
    numbers: false,
  },
};

export const loadPrefs = (): Prefs => {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Prefs>;
      return {
        ...DEFAULT_PREFS,
        ...parsed,
        config: { ...DEFAULT_PREFS.config, ...(parsed.config || {}) },
      };
    }
  } catch (e) {
    console.error("Failed to load prefs:", e);
  }
  return DEFAULT_PREFS;
};

export const savePrefs = (prefs: Prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Failed to save prefs:", e);
  }
};
