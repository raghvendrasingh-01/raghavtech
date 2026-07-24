/**
 * Build and download a JSON report of an analysis result.
 *
 * Assembles a self-contained snapshot (score, skills, breakdown, quick wins,
 * plus the JD and a timestamp) and triggers a client-side file download. No
 * network or server involvement — everything is already in the browser.
 */

/**
 * @param {object} result  The AnalyzeResponse object.
 * @param {string} jobDescription  The JD text the résumé was scored against.
 * @param {object} [suggestions]  Optional AI suggestions object.
 * @returns {object} The plain report object (also useful for tests).
 */
export function buildReport(result, jobDescription, suggestions = null) {
  const skills = result?.skills ?? {};
  return {
    generated_at: new Date().toISOString(),
    filename: result?.filename ?? null,
    match_score: result?.match_score ?? null,
    score_breakdown: result?.score_breakdown ?? null,
    skills: {
      required: skills.required ?? [],
      matched: skills.matched ?? [],
      missing: skills.missing ?? [],
      missing_ranked: skills.missing_ranked ?? [],
      quick_wins: skills.quick_wins ?? [],
    },
    suggestions: suggestions ?? null,
    job_description: jobDescription ?? "",
  };
}

/**
 * Trigger a browser download of the report as a formatted JSON file.
 *
 * @param {object} result
 * @param {string} jobDescription
 * @param {object} [suggestions]
 */
export function downloadReport(result, jobDescription, suggestions = null) {
  const report = buildReport(result, jobDescription, suggestions);
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = (result?.filename || "resume")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w-]+/g, "_");

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resume-report-${base}-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
