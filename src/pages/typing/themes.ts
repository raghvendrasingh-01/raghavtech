// ============ THEMES ============
// Monkeytype-style color themes. Each defines background, main text, accent,
// correct/error colors, and the sub (untyped) text color.

export interface Theme {
  id: string;
  name: string;
  bg: string;
  bgAccent: string; // for cards / panels
  text: string;     // typed-correct / primary text
  sub: string;      // untyped text
  caret: string;
  accent: string;   // primary highlight (wpm, buttons)
  error: string;
  errorExtra: string;
}

export const THEMES: Theme[] = [
  {
    id: "cosmic",
    name: "Cosmic",
    bg: "#050816",
    bgAccent: "rgba(255,255,255,0.05)",
    text: "#e2e8f0",
    sub: "#64748b",
    caret: "#818cf8",
    accent: "#818cf8",
    error: "#fb7185",
    errorExtra: "#f43f5e",
  },
  {
    id: "serika",
    name: "Serika Dark",
    bg: "#323437",
    bgAccent: "rgba(226,183,20,0.08)",
    text: "#d1d0c5",
    sub: "#646669",
    caret: "#e2b714",
    accent: "#e2b714",
    error: "#ca4754",
    errorExtra: "#7e2a33",
  },
  {
    id: "dracula",
    name: "Dracula",
    bg: "#282a36",
    bgAccent: "rgba(189,147,249,0.08)",
    text: "#f8f8f2",
    sub: "#6272a4",
    caret: "#bd93f9",
    accent: "#bd93f9",
    error: "#ff5555",
    errorExtra: "#ff79c6",
  },
  {
    id: "nord",
    name: "Nord",
    bg: "#2e3440",
    bgAccent: "rgba(136,192,208,0.08)",
    text: "#eceff4",
    sub: "#4c566a",
    caret: "#88c0d0",
    accent: "#88c0d0",
    error: "#bf616a",
    errorExtra: "#d08770",
  },
  {
    id: "matrix",
    name: "Matrix",
    bg: "#0d0208",
    bgAccent: "rgba(0,255,65,0.06)",
    text: "#00ff41",
    sub: "#1f4a1f",
    caret: "#00ff41",
    accent: "#00ff41",
    error: "#ff0043",
    errorExtra: "#ff5470",
  },
  {
    id: "rose",
    name: "Rosé",
    bg: "#191724",
    bgAccent: "rgba(235,188,186,0.08)",
    text: "#e0def4",
    sub: "#6e6a86",
    caret: "#ebbcba",
    accent: "#ebbcba",
    error: "#eb6f92",
    errorExtra: "#f6c177",
  },
];

export const DEFAULT_THEME_ID = "cosmic";

export const getTheme = (id: string): Theme =>
  THEMES.find((t) => t.id === id) || THEMES[0];
