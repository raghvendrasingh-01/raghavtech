import { useMemo } from "react";
import type { WpmSample } from "../typing/types";
import type { Theme } from "../typing/themes";

interface WpmChartProps {
  samples: WpmSample[];
  theme: Theme;
  height?: number;
}

// SVG line chart of WPM (and raw WPM) over time, with error markers — like
// the monkeytype results graph. Pure SVG, no chart library.
const WpmChart: React.FC<WpmChartProps> = ({ samples, theme, height = 200 }) => {
  const width = 640;
  const padX = 38;
  const padY = 24;

  const { wpmPath, rawPath, maxWpm, ticks, errorDots } = useMemo(() => {
    if (samples.length === 0) {
      return { wpmPath: "", rawPath: "", maxWpm: 0, ticks: [] as number[], errorDots: [] as { x: number; y: number }[] };
    }
    const maxW = Math.max(40, ...samples.map((s) => Math.max(s.wpm, s.raw))) * 1.1;
    const n = samples.length;
    const xAt = (i: number) => padX + (i / Math.max(1, n - 1)) * (width - padX * 2);
    const yAt = (v: number) => height - padY - (v / maxW) * (height - padY * 2);

    const toPath = (key: "wpm" | "raw") =>
      samples
        .map((s, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(s[key]).toFixed(1)}`)
        .join(" ");

    const tickVals: number[] = [];
    const step = Math.max(10, Math.round(maxW / 4 / 10) * 10);
    for (let v = 0; v <= maxW; v += step) tickVals.push(v);

    const dots = samples
      .map((s, i) => (s.errors > 0 ? { x: xAt(i), y: yAt(s.wpm) } : null))
      .filter(Boolean) as { x: number; y: number }[];

    return { wpmPath: toPath("wpm"), rawPath: toPath("raw"), maxWpm: maxW, ticks: tickVals, errorDots: dots };
  }, [samples, height]);

  if (samples.length === 0) return null;

  const yAt = (v: number) => height - padY - (v / maxWpm) * (height - padY * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* gridlines + y labels */}
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={padX}
            x2={width - padX}
            y1={yAt(v)}
            y2={yAt(v)}
            stroke={theme.sub}
            strokeOpacity={0.18}
            strokeWidth={1}
          />
          <text x={padX - 8} y={yAt(v) + 4} fontSize={11} fill={theme.sub} textAnchor="end">
            {v}
          </text>
        </g>
      ))}

      {/* raw wpm (faint) */}
      <path d={rawPath} fill="none" stroke={theme.sub} strokeWidth={2} strokeOpacity={0.5} />
      {/* net wpm (accent) */}
      <path d={wpmPath} fill="none" stroke={theme.accent} strokeWidth={2.5} strokeLinejoin="round" />

      {/* error markers */}
      {errorDots.map((d, i) => (
        <g key={i}>
          <line x1={d.x} y1={padY} x2={d.x} y2={height - padY} stroke={theme.error} strokeOpacity={0.12} />
          <path
            d={`M ${d.x - 4} ${d.y - 4} L ${d.x + 4} ${d.y + 4} M ${d.x + 4} ${d.y - 4} L ${d.x - 4} ${d.y + 4}`}
            stroke={theme.error}
            strokeWidth={2}
          />
        </g>
      ))}

      {/* legend */}
      <g>
        <line x1={width - 168} y1={14} x2={width - 150} y2={14} stroke={theme.accent} strokeWidth={2.5} />
        <text x={width - 146} y={18} fontSize={11} fill={theme.text}>wpm</text>
        <line x1={width - 110} y1={14} x2={width - 92} y2={14} stroke={theme.sub} strokeWidth={2} />
        <text x={width - 88} y={18} fontSize={11} fill={theme.text}>raw</text>
        <path d={`M ${width - 56} 10 l 8 8 M ${width - 48} 10 l -8 8`} stroke={theme.error} strokeWidth={2} />
        <text x={width - 38} y={18} fontSize={11} fill={theme.text}>err</text>
      </g>
    </svg>
  );
};

export default WpmChart;
