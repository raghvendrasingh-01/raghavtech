import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Animated circular gauge visualising the semantic match score.
 *
 * A conic-gradient ring fills to the score; the colour shifts red → amber →
 * green by band. The card tilts toward the cursor for a tasteful sense of
 * depth (disabled for reduced-motion / coarse pointers). The numeric value
 * counts up via requestAnimationFrame.
 *
 * Accessibility: the wrapper keeps role="progressbar" with aria-valuenow/min/
 * max and a descriptive aria-valuetext bound to the *final* score (never the
 * in-flight count-up), so assistive tech announces the true result.
 *
 * @param {object} props
 * @param {number} props.score  Match score in the range 0–100.
 */
export default function ScoreBar({ score }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));

  // Pick a band colour by score threshold.
  const band =
    clamped >= 75
      ? "var(--matched)"
      : clamped >= 50
      ? "var(--moderate)"
      : "var(--missing)";
  const label =
    clamped >= 75
      ? "Strong match"
      : clamped >= 50
      ? "Moderate match"
      : "Weak match";

  // Animated conic fill percentage (drives the @property --p sweep).
  const [pct, setPct] = useState(REDUCED_MOTION ? clamped : 0);
  // Count-up display value.
  const [display, setDisplay] = useState(REDUCED_MOTION ? clamped : 0);
  // Mouse-reactive tilt state.
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const rectRef = useRef(null);

  // Kick off the ring fill on mount / score change (rAF keeps the setState out
  // of the synchronous effect body and lets the CSS transition animate the gap).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPct(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  // Count-up the numeric value, synced to the ~1s ring sweep.
  useEffect(() => {
    if (REDUCED_MOTION) {
      const raf = requestAnimationFrame(() => setDisplay(clamped));
      return () => cancelAnimationFrame(raf);
    }
    const duration = 1050;
    let start = null;
    let frame;
    const step = (ts) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // easeOutCubic to match the ring's cubic-bezier feel.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(clamped * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else setDisplay(clamped);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  const handleMove = (e) => {
    if (REDUCED_MOTION) return;
    const r = rectRef.current ?? e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 6, ry: px * 8, mx: (px + 0.5) * 100, my: (py + 0.5) * 100 });
  };
  const handleEnter = (e) => {
    rectRef.current = e.currentTarget.getBoundingClientRect();
  };
  const handleLeave = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });

  return (
    <div className="score">
      <span className="eyebrow score__eyebrow">Match score</span>

      <div
        className="tilt-stage"
        role="progressbar"
        aria-label="Match score"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${clamped.toFixed(1)}% — ${label}`}
      >
        <div
          className="tilt-card"
          onMouseMove={handleMove}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            "--mx": `${tilt.mx}%`,
            "--my": `${tilt.my}%`,
          }}
        >
          <div
            className="gauge"
            style={{ "--p": pct, "--band": band }}
            aria-hidden
          >
            <span className="gauge__sheen" />
          </div>
          <div className="gauge__center">
            <span className="gauge__value tnum" style={{ color: band }}>
              {display.toFixed(1)}
              <span className="gauge__value-pct">%</span>
            </span>
            <span className="gauge__band" style={{ color: band }}>
              {label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
