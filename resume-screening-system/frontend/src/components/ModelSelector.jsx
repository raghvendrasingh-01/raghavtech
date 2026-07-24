import { useEffect, useRef, useState } from "react";

/**
 * Accessible custom model selector (a WAI-ARIA listbox pattern).
 *
 * A native <select> can't show the two-line name/provider rows and Free/Premium
 * badges we want, so this is a custom widget with full keyboard support:
 * Enter/Space/↓ opens, ↑/↓ move, Enter/Space selects, Esc closes, and an
 * outside click dismisses it. The chosen model id is lifted to the parent via
 * `onSelect` — the parent owns persistence and sends it to the backend.
 *
 * @param {object} props
 * @param {Array<{id:string,name:string,provider:string}>} props.models
 * @param {string} props.selectedId
 * @param {(id: string) => void} props.onSelect
 * @param {boolean} [props.disabled]
 */
function isFree(id) {
  return id.endsWith(":free") || id === "openrouter/free";
}

export default function ModelSelector({
  models,
  selectedId,
  onSelect,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef(null);
  const listRef = useRef(null);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // When opening, focus the active option so arrow keys work immediately.
  useEffect(() => {
    if (open) {
      const idx = Math.max(
        0,
        models.findIndex((m) => m.id === selectedId)
      );
      setActiveIndex(idx);
    }
  }, [open, models, selectedId]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[activeIndex];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  const selected = models.find((m) => m.id === selectedId);

  const commit = (id) => {
    onSelect(id);
    setOpen(false);
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(models.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const m = models[activeIndex];
      if (m) commit(m.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(models.length - 1);
    }
  };

  return (
    <div
      ref={ref}
      className={`model-selector${open ? " model-selector--open" : ""}`}
    >
      <button
        type="button"
        className="model-selector__trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          selected
            ? `AI model: ${selected.name} by ${selected.provider}. Change model.`
            : "Select AI model"
        }
      >
        <span className="model-selector__trigger-left">
          <span className="model-selector__name">
            {selected?.name ?? "Select model"}
          </span>
          {selected && (
            <span className="model-selector__provider">
              {selected.provider}
              <span
                className={`model-selector__tag${
                  isFree(selected.id) ? "" : " model-selector__tag--premium"
                }`}
              >
                {isFree(selected.id) ? "Free" : "Premium"}
              </span>
            </span>
          )}
        </span>
        <svg
          className="model-selector__chevron"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          className="model-selector__dropdown"
          role="listbox"
          tabIndex={-1}
          aria-label="AI models"
          aria-activedescendant={
            models[activeIndex] ? `model-opt-${activeIndex}` : undefined
          }
          onKeyDown={onListKeyDown}
          // Single callback ref: store the node and focus it on mount so
          // keyboard navigation takes over immediately.
          ref={(node) => {
            listRef.current = node;
            node?.focus();
          }}
        >
          {models.map((m, i) => (
            <li
              key={m.id}
              id={`model-opt-${i}`}
              role="option"
              aria-selected={m.id === selectedId}
              className={`model-selector__option${
                m.id === selectedId ? " model-selector__option--selected" : ""
              }${i === activeIndex ? " model-selector__option--active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => commit(m.id)}
            >
              <span className="model-selector__option-left">
                <span className="model-selector__option-name">{m.name}</span>
                <span className="model-selector__option-provider">
                  {m.provider}
                </span>
              </span>

              <span
                className={`model-selector__badge${
                  isFree(m.id) ? "" : " model-selector__badge--premium"
                }`}
              >
                {isFree(m.id) ? "Free" : "Premium"}
              </span>

              {m.id === selectedId && (
                <svg
                  className="model-selector__check"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
