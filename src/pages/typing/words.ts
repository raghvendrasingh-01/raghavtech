// ============ WORD & QUOTE DATA ============
// Common English words (monkeytype-style) for word-based test modes.

export const COMMON_WORDS: string[] = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
  "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
  "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "world",
  "find", "still", "between", "name", "should", "home", "big", "such", "follow", "act",
  "why", "ask", "men", "change", "went", "light", "kind", "off", "need", "house",
  "picture", "try", "again", "animal", "point", "mother", "form", "answer", "found", "study",
  "learn", "much", "play", "spell", "air", "away", "move", "live", "myself", "open",
  "seem", "together", "next", "white", "begin", "got", "walk", "example", "ease", "paper",
  "group", "always", "music", "those", "both", "mark", "often", "letter", "until", "mile",
  "river", "car", "feet", "care", "second", "book", "carry", "took", "science", "eat",
  "room", "friend", "began", "idea", "fish", "mountain", "stop", "once", "base", "hear",
  "horse", "cut", "sure", "watch", "color", "face", "wood", "main", "enough", "plain",
  "girl", "usual", "young", "ready", "above", "ever", "red", "list", "though", "feel",
  "talk", "bird", "soon", "body", "dog", "family", "direct", "pose", "leave", "song",
  "measure", "state", "product", "black", "short", "numeral", "class", "wind", "question", "happen",
  "complete", "ship", "area", "half", "rock", "order", "fire", "south", "problem", "piece",
  "told", "knew", "pass", "since", "top", "whole", "king", "space", "heard", "best",
  "hour", "better", "during", "hundred", "five", "remember", "step", "early", "hold", "west",
  "ground", "interest", "reach", "fast", "verb", "sing", "listen", "six", "table", "travel",
  "less", "morning", "ten", "simple", "several", "vowel", "toward", "war", "lay", "against",
  "pattern", "slow", "center", "love", "person", "money", "serve", "appear", "road", "map",
  "rain", "rule", "govern", "pull", "cold", "notice", "voice", "energy", "hunt", "probable",
  "bed", "brother", "egg", "ride", "cell", "believe", "fraction", "forest", "sit", "race",
  "window", "store", "summer", "train", "sleep", "prove", "lone", "leg", "exercise", "wall",
  "catch", "mount", "wish", "sky", "board", "joy", "winter", "written", "wild", "instrument",
  "kept", "glass", "grass", "cow", "job", "edge", "sign", "visit", "past", "soft",
  "fun", "bright", "gas", "weather", "month", "million", "bear", "finish", "happy", "hope",
  "flower", "clothe", "strange", "gone", "trade", "melody", "trip", "office", "receive", "row",
];

// Bigram-rich words to help with common key combinations
export const BIGRAM_WORDS: string[] = [
  "there", "where", "their", "other", "could", "would", "should", "people", "through", "because",
  "between", "another", "important", "different", "together", "something", "everything", "understand",
];

export interface Quote {
  text: string;
  source: string;
}

export const QUOTES: Quote[] = [
  { text: "The only way to do great work is to love what you do.", source: "Steve Jobs" },
  { text: "Life is what happens when you are busy making other plans.", source: "John Lennon" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", source: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", source: "Aristotle" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", source: "Winston Churchill" },
  { text: "The way to get started is to quit talking and begin doing.", source: "Walt Disney" },
  { text: "Do not watch the clock. Do what it does. Keep going.", source: "Sam Levenson" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", source: "Proverb" },
  { text: "Whether you think you can or you think you cannot, you are right.", source: "Henry Ford" },
  { text: "Your time is limited, so do not waste it living someone else's life.", source: "Steve Jobs" },
  { text: "Code is like humor. When you have to explain it, it is bad.", source: "Cory House" },
  { text: "First, solve the problem. Then, write the code.", source: "John Johnson" },
  { text: "Simplicity is the soul of efficiency.", source: "Austin Freeman" },
  { text: "Make it work, make it right, make it fast.", source: "Kent Beck" },
  { text: "Talk is cheap. Show me the code.", source: "Linus Torvalds" },
];

const PUNCTUATION = [".", ",", "!", "?", ";", ":"];

// Mulberry32 seeded PRNG for deterministic generation when needed.
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface WordGenOptions {
  count: number;
  punctuation?: boolean;
  numbers?: boolean;
  seed?: number;
}

// Generate a string of real words with optional punctuation & numbers.
export const generateWords = ({ count, punctuation = false, numbers = false, seed }: WordGenOptions): string => {
  const rng = seed !== undefined ? makeRng(seed) : Math.random;
  const pool = COMMON_WORDS;
  const out: string[] = [];
  let capitalizeNext = punctuation; // start with a capital in punctuation mode

  for (let i = 0; i < count; i++) {
    // Occasionally inject a number token
    if (numbers && rng() < 0.12) {
      const n = Math.floor(rng() * 1000);
      out.push(String(n));
      continue;
    }

    let word = pool[Math.floor(rng() * pool.length)];

    if (punctuation) {
      if (capitalizeNext) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
        capitalizeNext = false;
      }
      // End-of-sentence punctuation
      if (rng() < 0.12 && i < count - 1) {
        const mark = PUNCTUATION[Math.floor(rng() * PUNCTUATION.length)];
        word += mark;
        if (mark === "." || mark === "!" || mark === "?") capitalizeNext = true;
      } else if (rng() < 0.05) {
        word = '"' + word + '"';
      }
    }

    out.push(word);
  }

  return out.join(" ");
};

export const getRandomQuote = (): Quote => {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
};
