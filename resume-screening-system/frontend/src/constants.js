/**
 * Shared client-side upload rules.
 *
 * Kept in sync with the backend caps (`MAX_UPLOAD_BYTES`, accepted formats) so
 * the UI can reject bad files before the network round-trip. The backend still
 * re-validates — this is a UX optimisation, not the security boundary.
 */

// Must match the backend's MAX_UPLOAD_BYTES (5 MB).
export const MAX_UPLOAD_MB = 5;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Accepted résumé formats (PDF + Word .docx).
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

// localStorage key for the user's chosen AI model. Shared with the portfolio
// client so a selection carries across both surfaces.
export const MODEL_STORAGE_KEY = "resume-screener-selected-model";
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// `accept` attribute string for the <input type="file"> element.
export const FILE_ACCEPT_ATTR = [
  ...ACCEPTED_MIME_TYPES,
  ...ACCEPTED_EXTENSIONS,
].join(",");

/**
 * Validate a candidate résumé file against the format + size rules.
 *
 * @param {File|null|undefined} file
 * @returns {string} An error message, or "" when the file is acceptable.
 */
export function validateResumeFile(file) {
  if (!file) return "";

  const name = (file.name || "").toLowerCase();
  const okExt = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const okMime = file.type && ACCEPTED_MIME_TYPES.includes(file.type);
  if (!okExt && !okMime) {
    return "Please choose a PDF or DOCX file.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (max ${MAX_UPLOAD_MB} MB).`;
  }

  return "";
}
