import { useRef, useState } from "react";

/**
 * Drag-and-drop (and click-to-browse) dropzone for a single PDF file.
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
    const isPdf =
      candidate.type === "application/pdf" ||
      candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      onError("Please choose a PDF file.");
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
        aria-label={labelledBy ? undefined : "Upload résumé PDF"}
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
          accept="application/pdf,.pdf"
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
            <div>
              <div className="dropzone__filename">{file.name}</div>
              <div className="dropzone__hint">
                {(file.size / 1024).toFixed(0)} KB · click to replace
              </div>
            </div>
          </div>
        ) : (
          <div className="dropzone__empty">
            <span className="dropzone__icon" aria-hidden>
              ⬆
            </span>
            <p className="dropzone__title">
              Drag &amp; drop your résumé PDF here
            </p>
            <p className="dropzone__hint">or click to browse</p>
          </div>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
