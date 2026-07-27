import { useEffect, useId, useRef, useState } from "react";
import { translate } from "../localization";
import { Chevron } from "../ui";

export function ImageDimensionFieldControl({
  label,
  value,
  tokens,
  autoFocus,
  ariaInvalid,
  ariaDescribedBy,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  tokens: readonly string[];
  autoFocus?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = `editor-image-dimensions-${useId().replaceAll(":", "-")}`;

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [open]);

  return (
    <div
      className="editor-image-dimension-control"
      data-editor-drag-boundary
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <div className="editor-image-dimension-combobox">
        <input
          aria-label={label}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoFocus={autoFocus}
          type="text"
          spellCheck={false}
          value={value}
          placeholder={translate(
            "ui.editorWorkspace.imageDimension.tokenOrExactPlaceholder",
          )}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          ref={trigger}
          aria-haspopup="listbox"
          aria-label={translate(
            "ui.editorWorkspace.imageDimension.showChoicesForField",
            { field: label },
          )}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
        >
          <Chevron
            className="editor-diagnostics-chevron"
            direction={open ? "up" : "down"}
          />
        </button>
      </div>
      {open && (
        <div
          className="editor-image-dimension-popover"
          id={listId}
          role="listbox"
          aria-label={translate(
            "ui.editorWorkspace.imageDimension.availableTokens",
          )}
        >
          {tokens.map((token) => (
            <button
              className={token === value ? "is-selected" : undefined}
              type="button"
              role="option"
              aria-selected={token === value}
              key={token}
              onClick={() => {
                onChange(token);
                setOpen(false);
              }}
            >
              {token}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
