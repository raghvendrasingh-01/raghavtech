import { useRef, useState } from "react";
import { FILE_ACCEPT_ATTR, validateResumeFile } from "../constants";

/**
 * Drag-and-drop (and click-to-browse) dropzone for a single résumé file
 * (PDF or DOCX).
 *
 * Validation errors are owned by the parent (passed in via `error` and reported
 * via `onError`) so there is a single source of truth and the parent's Reset
 * can clear them. Only transient drag-hover state is kept locally.
 *
 * @param {object}   props
 * @param {File|null} props.file        Currently selected file (controlled).
 * @param {(file: File|null) => void} props.onFileSelected  Selection callback.
 * @param {(message: string) => void} [props.onError]  Report a validation error.
 * @param {string}   [props.error]      Validation error message to display.
 * @param {boolean}  [props.disabled]   Disable interaction (e.g. while loading).
 * @param {string}   [props.labelledBy] id of an element labelling this control.
 */
export default function FileDropzone({
  file,
  onFileSelected,
  onError = () => {},
  error = "",
  disabled = false,
  labelledBy,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSelect = (candidate) => {
    if (!candidate) return;
    const validationError = validateResumeFile(candidate);
    if (validationError) {
      onError(validationError);
      onFileSelected(null);
      return;
    }
    onError("");
    onFileSelected(candidate);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    validateAndSelect(e.dataTransfer.files?.[0]);
  };

  const handleChange = (e) => validateAndSelect(e.target.files?.[0]);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  return (
    <div className="dropzone-wrap">
      <div
        className={
          "dropzone" +
          (isDragging ? " dropzone--active" : "") +
          (disabled ? " dropzone--disabled" : "") +
          (file ? " dropzone--has-file" : "")
        }
        role="button"
        tabIndex={0}
        aria-label={labelledBy ? undefined : "Upload résumé PDF or DOCX"}
        aria-labelledby={labelledBy}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          // Ignore dragleave events fired when moving onto child elements;
          // only clear the highlight when the pointer truly leaves the zone.
          if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT_ATTR}
          className="dropzone__input"
          onChange={handleChange}
          disabled={disabled}
          hidden
        />
        {file ? (
          <div className="dropzone__file">
            <span className="dropzone__file-chip" aria-hidden>
              📄
            </span>
            <div className="dropzone__file-meta">
              <div className="dropzone__filename">{file.name}</div>
              <div className="dropzone__hint">
                <span className="dropzone__status" aria-hidden>
                  ✓
                </span>
                Ready · {(file.size / 1024).toFixed(0)} KB · click to replace
              </div>
            </div>
            <button
              type="button"
              className="dropzone__remove"
              aria-label={`Remove ${file.name}`}
              disabled={disabled}
              onClick={(e) => {
                // Don't trigger the zone's click-to-browse handler.
                e.stopPropagation();
                onError("");
                onFileSelected(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="dropzone__empty">
            <span className="dropzone__icon" aria-hidden>
              ⬆
            </span>
            <p className="dropzone__title">
              Drag &amp; drop your résumé here
            </p>
            <p className="dropzone__hint">PDF or DOCX · click to browse</p>
          </div>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
