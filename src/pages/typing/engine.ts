import type { LessonState, CharStats, WpmSample } from "./types";
import { CHAR_PROGRESSION } from "./storage";
import { generateWords, getRandomQuote } from "./words";

// ============ TUNING CONSTANTS ============
export const ACCURACY_THRESHOLD = 0.85; // 85% accuracy to unlock new char
export const MIN_ATTEMPTS_TO_UNLOCK = 20;

// ============ ADAPTIVE LESSON GENERATOR ============
// Weighted pseudo-word generation biased toward weak/active characters (keybr-style).
export const generateAdaptiveLesson = (state: LessonState, length = 220): string => {
  const { activeChars, charStats } = state;
  const words: string[] = [];

  const charWeights: Record<string, number> = {};
  let totalWeight = 0;

  activeChars.forEach((char) => {
    const stats = charStats[char] || { attempts: 0, errors: 0 };
    const accuracy = stats.attempts > 0 ? 1 - stats.errors / stats.attempts : 0.5;
    const weight = Math.max(0.2, 1.5 - accuracy);
    charWeights[char] = weight;
    totalWeight += weight;
  });

  const selectChar = (r: number): string => {
    let threshold = r * totalWeight;
    for (const char of activeChars) {
      threshold -= charWeights[char];
      if (threshold <= 0) return char;
    }
    return activeChars[0];
  };

  let charCount = 0;
  while (charCount < length) {
    const wordLength = 3 + Math.floor(Math.random() * 5);
    let word = "";
    for (let i = 0; i < wordLength && charCount + word.length < length; i++) {
      word += selectChar(Math.random());
    }
    words.push(word);
    charCount += word.length + 1;
  }

  return words.join(" ");
};

// ============ MODE DISPATCH ============
export interface GeneratedTest {
  text: string;
  source?: string;
}

export const generateTest = (
  mode: string,
  state: LessonState,
  opts: { wordCount: number; punctuation: boolean; numbers: boolean }
): GeneratedTest => {
  switch (mode) {
    case "words":
      return { text: generateWords({ count: opts.wordCount, punctuation: opts.punctuation, numbers: opts.numbers }) };
    case "time":
      // generate a long buffer; the timer ends the test
      return { text: generateWords({ count: 200, punctuation: opts.punctuation, numbers: opts.numbers }) };
    case "quote": {
      const q = getRandomQuote();
      return { text: q.text, source: q.source };
    }
    case "adaptive":
    default:
      return { text: generateAdaptiveLesson(state) };
  }
};

// ============ ADAPTIVE UNLOCK ============
export const checkForUnlock = (state: LessonState): string | null => {
  const { activeChars, charStats } = state;
  for (const char of activeChars) {
    const stats = charStats[char];
    if (!stats || stats.attempts < MIN_ATTEMPTS_TO_UNLOCK) return null;
    const accuracy = 1 - stats.errors / stats.attempts;
    if (accuracy < ACCURACY_THRESHOLD) return null;
  }
  for (const char of CHAR_PROGRESSION) {
    if (!activeChars.includes(char)) return char;
  }
  return null;
};

export const getWeakChars = (
  charStats: Record<string, CharStats>,
  activeChars: string[]
): string[] => {
  return activeChars
    .filter((char) => {
      const stats = charStats[char];
      if (!stats || stats.attempts < 5) return false;
      return 1 - stats.errors / stats.attempts < ACCURACY_THRESHOLD;
    })
    .sort((a, b) => {
      const aAcc = charStats[a] ? 1 - charStats[a].errors / charStats[a].attempts : 1;
      const bAcc = charStats[b] ? 1 - charStats[b].errors / charStats[b].attempts : 1;
      return aAcc - bAcc;
    })
    .slice(0, 5);
};

// ============ STATS MATH ============

// Consistency = how steady your raw WPM is across the test (monkeytype-style).
// Derived from the coefficient of variation of per-second raw wpm.
export const computeConsistency = (samples: WpmSample[]): number => {
  const raws = samples.map((s) => s.raw).filter((r) => r > 0);
  if (raws.length < 2) return 100;
  const mean = raws.reduce((a, b) => a + b, 0) / raws.length;
  if (mean === 0) return 0;
  const variance = raws.reduce((a, b) => a + (b - mean) ** 2, 0) / raws.length;
  const cv = Math.sqrt(variance) / mean;
  // Map CV (0 = perfect) to a 0-100 score.
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
};

// Per-key typing speed in characters-per-minute, from cumulative timing.
export const getKeySpeed = (stats: CharStats | undefined): number => {
  if (!stats || stats.totalTime <= 0) return 0;
  const correct = Math.max(1, stats.attempts - stats.errors);
  const avgMs = stats.totalTime / correct;
  if (avgMs <= 0) return 0;
  return Math.round(60000 / avgMs); // chars per minute
};

export const getKeyAccuracy = (stats: CharStats | undefined): number => {
  if (!stats || stats.attempts === 0) return -1;
  return 1 - stats.errors / stats.attempts;
};
