/**
 * Renders a titled list of skills as coloured "pill" badges.
 *
 * @param {object}   props
 * @param {string}   props.title    Section heading (e.g. "Missing skills").
 * @param {string[]} props.skills   Skill names to display.
 * @param {"matched"|"missing"|"neutral"} [props.variant]  Colour scheme.
 * @param {string}   [props.emptyText]  Shown when the list is empty.
 */
export default function SkillList({
  title,
  skills = [],
  variant = "neutral",
  emptyText = "None",
}) {
  return (
    <div className="skills">
      <h3 className="skills__title">
        {title} <span className="skills__count">{skills.length}</span>
      </h3>
      {skills.length === 0 ? (
        <p className="skills__empty">{emptyText}</p>
      ) : (
        <ul className={`pill-list pill-list--${variant}`}>
          {skills.map((skill, i) => (
            <li key={skill} className="pill" style={{ "--i": i }}>
              {variant === "matched" && (
                <span className="pill__mark" aria-hidden>
                  ✓
                </span>
              )}
              {variant === "missing" && (
                <span className="pill__mark" aria-hidden>
                  ✕
                </span>
              )}
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
