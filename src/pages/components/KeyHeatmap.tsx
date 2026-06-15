import type { CharStats } from "../typing/types";
import type { Theme } from "../typing/themes";
import { getKeySpeed, getKeyAccuracy } from "../typing/engine";

interface KeyHeatmapProps {
  charStats: Record<string, CharStats>;
  activeChars: string[];
  theme: Theme;
  metric: "speed" | "accuracy";
}

const KEY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", "."],
];

// Blend two hex colors by t in [0,1].
const lerpColor = (a: string, b: string, t: number): string => {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
};

// keybr-style heatmap of the keyboard: each key tinted by your speed or accuracy.
const KeyHeatmap: React.FC<KeyHeatmapProps> = ({ charStats, activeChars, theme, metric }) => {
  // Determine max speed for normalization
  const speeds = activeChars.map((c) => getKeySpeed(charStats[c])).filter((s) => s > 0);
  const maxSpeed = Math.max(120, ...speeds);

  const colorFor = (char: string): { bg: string; label: string } => {
    const stats = charStats[char];
    const active = activeChars.includes(char);
    if (!active || !stats || stats.attempts === 0) {
      return { bg: "rgba(255,255,255,0.04)", label: "" };
    }
    if (metric === "speed") {
      const sp = getKeySpeed(stats);
      if (sp === 0) return { bg: "rgba(255,255,255,0.06)", label: "" };
      const t = Math.min(1, sp / maxSpeed);
      // slow (error red) -> fast (accent)
      return { bg: lerpColor("#ef4444", theme.accent, t), label: String(sp) };
    } else {
      const acc = getKeyAccuracy(stats);
      if (acc < 0) return { bg: "rgba(255,255,255,0.06)", label: "" };
      const t = Math.max(0, Math.min(1, (acc - 0.5) / 0.5));
      return { bg: lerpColor("#ef4444", "#22c55e", t), label: `${Math.round(acc * 100)}` };
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEY_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1.5" style={{ marginLeft: ri * 14 }}>
          {row.map((char) => {
            const { bg, label } = colorFor(char);
            return (
              <div
                key={char}
                className="relative w-11 h-11 rounded-lg flex flex-col items-center justify-center font-mono transition-colors"
                style={{ background: bg, border: `1px solid ${theme.sub}33` }}
              >
                <span className="text-sm font-bold" style={{ color: theme.text }}>
                  {char.toUpperCase()}
                </span>
                {label && (
                  <span className="text-[9px] leading-none opacity-80" style={{ color: theme.text }}>
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: theme.sub }}>
        <span>{metric === "speed" ? "slow" : "low acc"}</span>
        <div
          className="h-2 w-32 rounded-full"
          style={{
            background:
              metric === "speed"
                ? `linear-gradient(90deg, #ef4444, ${theme.accent})`
                : "linear-gradient(90deg, #ef4444, #22c55e)",
          }}
        />
        <span>{metric === "speed" ? "fast" : "high acc"}</span>
      </div>
    </div>
  );
};

export default KeyHeatmap;
