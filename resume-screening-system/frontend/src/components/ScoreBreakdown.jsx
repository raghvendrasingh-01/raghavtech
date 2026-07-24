/**
 * Component-level breakdown of the headline match score.
 *
 * Renders small horizontal bars for the semantic similarity and skills-coverage
 * components, plus a per-section similarity list when the backend detected
 * résumé sections. Everything is optional — the component renders nothing if no
 * breakdown was returned, so it is safe against older backends.
 *
 * @param {object} props
 * @param {{
 *   semantic_similarity?: number,
 *   skills_coverage?: number,
 *   sections?: Array<{ section: string, score: number }>,
 * }} [props.breakdown]  The `score_breakdown` object from AnalyzeResponse.
 */
function bandColor(value) {
  if (value >= 75) return "var(--matched)";
  if (value >= 50) return "var(--moderate)";
  return "var(--missing)";
}

function Bar({ label, value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="breakdown__row">
      <div className="breakdown__row-head">
        <span className="breakdown__label">{label}</span>
        <span className="breakdown__value tnum">{pct.toFixed(1)}%</span>
      </div>
      <div className="breakdown__track" aria-hidden>
        <div
          className="breakdown__fill"
          style={{ width: `${pct}%`, background: bandColor(pct) }}
        />
      </div>
    </div>
  );
}

export default function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;

  const { semantic_similarity, skills_coverage, sections = [] } = breakdown;

  return (
    <div className="breakdown">
      <h3 className="breakdown__title">Score breakdown</h3>

      {typeof semantic_similarity === "number" && (
        <Bar label="Semantic similarity" value={semantic_similarity} />
      )}
      {typeof skills_coverage === "number" && (
        <Bar label="Skills coverage" value={skills_coverage} />
      )}

      {sections.length > 0 && (
        <div className="breakdown__sections">
          <span className="breakdown__subhead">By résumé section</span>
          {sections.map((s) => (
            <Bar key={s.section} label={s.section} value={s.score} />
          ))}
        </div>
      )}
    </div>
  );
}
