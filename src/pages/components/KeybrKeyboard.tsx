import { motion } from "framer-motion";
import type { CharStats } from "../typing/types";
import type { Theme } from "../typing/themes";
import { getKeyAccuracy } from "../typing/engine";

interface KeybrKeyboardProps {
  charStats: Record<string, CharStats>;
  activeChars: string[];
  theme: Theme;
  nextKey?: string;   // next char to press (lowercase) -> blue ring
  pressedKey?: string; // currently held key -> press animation
}

type Kind = "letter" | "sym" | "mod";

interface KeyDef {
  c?: string;      // tracked character (lowercase) if this key maps to one
  label: string;   // main glyph
  sub?: string;    // shifted glyph (shown above)
  w?: number;      // width in units (default 1)
  kind: Kind;
  home?: boolean;  // F / J bump dot
  align?: "left";  // modifier label alignment
}

// Full ANSI layout, keybr-style.
const ROWS: KeyDef[][] = [
  [
    { label: "`", sub: "~", kind: "sym" },
    { c: "1", label: "1", sub: "!", kind: "sym" },
    { c: "2", label: "2", sub: "@", kind: "sym" },
    { c: "3", label: "3", sub: "#", kind: "sym" },
    { c: "4", label: "4", sub: "$", kind: "sym" },
    { c: "5", label: "5", sub: "%", kind: "sym" },
    { c: "6", label: "6", sub: "^", kind: "sym" },
    { c: "7", label: "7", sub: "&", kind: "sym" },
    { c: "8", label: "8", sub: "*", kind: "sym" },
    { c: "9", label: "9", sub: "(", kind: "sym" },
    { c: "0", label: "0", sub: ")", kind: "sym" },
    { label: "-", sub: "_", kind: "sym" },
    { label: "=", sub: "+", kind: "sym" },
    { label: "Backspace", w: 2, kind: "mod", align: "left" },
  ],
  [
    { label: "Tab", w: 1.5, kind: "mod", align: "left" },
    { c: "q", label: "Q", kind: "letter" },
    { c: "w", label: "W", kind: "letter" },
    { c: "e", label: "E", kind: "letter" },
    { c: "r", label: "R", kind: "letter" },
    { c: "t", label: "T", kind: "letter" },
    { c: "y", label: "Y", kind: "letter" },
    { c: "u", label: "U", kind: "letter" },
    { c: "i", label: "I", kind: "letter" },
    { c: "o", label: "O", kind: "letter" },
    { c: "p", label: "P", kind: "letter" },
    { label: "[", sub: "{", kind: "sym" },
    { label: "]", sub: "}", kind: "sym" },
    { label: "\\", sub: "|", w: 1.5, kind: "sym" },
  ],
  [
    { label: "Caps", w: 1.75, kind: "mod", align: "left" },
    { c: "a", label: "A", kind: "letter" },
    { c: "s", label: "S", kind: "letter" },
    { c: "d", label: "D", kind: "letter" },
    { c: "f", label: "F", kind: "letter", home: true },
    { c: "g", label: "G", kind: "letter" },
    { c: "h", label: "H", kind: "letter" },
    { c: "j", label: "J", kind: "letter", home: true },
    { c: "k", label: "K", kind: "letter" },
    { c: "l", label: "L", kind: "letter" },
    { c: ";", label: ";", sub: ":", kind: "letter" },
    { label: "'", sub: '"', kind: "sym" },
    { label: "Enter", w: 2.25, kind: "mod", align: "left" },
  ],
  [
    { label: "Shift", w: 2.25, kind: "mod", align: "left" },
    { c: "z", label: "Z", kind: "letter" },
    { c: "x", label: "X", kind: "letter" },
    { c: "c", label: "C", kind: "letter" },
    { c: "v", label: "V", kind: "letter" },
    { c: "b", label: "B", kind: "letter" },
    { c: "n", label: "N", kind: "letter" },
    { c: "m", label: "M", kind: "letter" },
    { c: ",", label: ",", sub: "<", kind: "letter" },
    { c: ".", label: ".", sub: ">", kind: "letter" },
    { label: "/", sub: "?", kind: "sym" },
    { label: "Shift", w: 2.75, kind: "mod", align: "left" },
  ],
  [
    { label: "Ctrl", w: 1.5, kind: "mod", align: "left" },
    { label: "Alt", w: 1.5, kind: "mod", align: "left" },
    { c: " ", label: "", w: 7, kind: "letter" },
    { label: "Alt", w: 1.5, kind: "mod", align: "left" },
    { label: "Ctrl", w: 1.5, kind: "mod", align: "left" },
  ],
];

// 3-stop red -> yellow -> green gradient by accuracy.
const heatColor = (acc: number): string => {
  const t = Math.max(0, Math.min(1, (acc - 0.4) / 0.6)); // map 0.4..1.0 -> 0..1
  const stops = [
    [239, 68, 68], // red
    [234, 179, 8], // yellow
    [34, 197, 94], // green
  ];
  const seg = t < 0.5 ? 0 : 1;
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = stops[seg];
  const b = stops[seg + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * local);
  const g = Math.round(a[1] + (b[1] - a[1]) * local);
  const bl = Math.round(a[2] + (b[2] - a[2]) * local);
  return `rgb(${r},${g},${bl})`;
};

const UNIT = 2.55; // rem per key unit

const KeybrKeyboard: React.FC<KeybrKeyboardProps> = ({
  charStats,
  activeChars,
  theme,
  nextKey,
  pressedKey,
}) => {
  const next = nextKey?.toLowerCase();
  const pressed = pressedKey === " " ? " " : pressedKey?.toLowerCase();

  const styleFor = (key: KeyDef) => {
    const tracked = key.c !== undefined && activeChars.includes(key.c);
    if (key.kind === "mod") {
      return { bg: "rgba(255,255,255,0.04)", fg: theme.sub, faded: true };
    }
    if (!tracked) {
      return { bg: "rgba(255,255,255,0.05)", fg: theme.sub, faded: true };
    }
    const acc = getKeyAccuracy(charStats[key.c!]);
    if (acc < 0) {
      // active but no data yet — neutral muted tone
      return { bg: "rgba(120,140,120,0.35)", fg: theme.text, faded: false };
    }
    return { bg: heatColor(acc), fg: "rgba(255,255,255,0.95)", faded: false };
  };

  return (
    <div
      className="mx-auto w-full overflow-x-auto"
      style={{ maxWidth: "44rem" }}
    >
      <div
        className="inline-flex flex-col gap-1.5 p-3 rounded-2xl mx-auto"
        style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${theme.sub}22` }}
      >
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1.5 justify-center">
            {row.map((key, ki) => {
              const { bg, fg, faded } = styleFor(key);
              const isNext =
                next !== undefined && key.c !== undefined && key.c === next;
              const isPressed =
                pressed !== undefined && key.c !== undefined && key.c === pressed;
              const w = key.w ?? 1;

              return (
                <motion.div
                  key={`${ri}-${ki}`}
                  className="relative flex items-center justify-center rounded-md select-none font-mono"
                  style={{
                    width: `${w * UNIT}rem`,
                    height: `${UNIT}rem`,
                    background: bg,
                    color: fg,
                    opacity: faded ? 0.55 : 1,
                    border: `1px solid ${theme.sub}22`,
                    boxShadow: isNext
                      ? "0 0 0 3px #38bdf8, 0 0 16px 2px rgba(56,189,248,0.55)"
                      : "none",
                    zIndex: isNext ? 2 : 1,
                  }}
                  animate={{
                    y: isPressed ? 2 : 0,
                    scale: isPressed ? 0.94 : isNext ? 1.04 : 1,
                    filter: isPressed ? "brightness(1.4)" : "brightness(1)",
                  }}
                  transition={{ duration: 0.08 }}
                >
                  {key.sub && (
                    <span
                      className="absolute top-0.5 left-1 text-[9px] leading-none"
                      style={{ color: fg, opacity: 0.75 }}
                    >
                      {key.sub}
                    </span>
                  )}
                  <span
                    className={
                      key.kind === "mod"
                        ? "text-[10px] font-medium absolute left-1.5 bottom-1"
                        : key.sub
                        ? "text-sm font-semibold absolute bottom-1 left-1.5"
                        : "text-sm font-semibold"
                    }
                  >
                    {key.label}
                  </span>
                  {key.home && (
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-0.5 rounded-full"
                      style={{ background: fg, opacity: 0.7 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeybrKeyboard;
