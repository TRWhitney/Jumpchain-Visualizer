import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { translate } from "../localization";
import { normalizeFormat1HexColor } from "../markup/format1Colors";

export type EditorColorChoice = {
  value: string;
  color: string;
  source: "built-in" | "theme";
};

export function ColorFieldControl({
  label,
  value,
  choices,
  allowTokens,
  autoFocus,
  ariaInvalid,
  ariaDescribedBy,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  choices: readonly EditorColorChoice[];
  allowTokens: boolean;
  autoFocus?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choiceListId = `editor-color-choices-${useId().replaceAll(":", "-")}`;
  const displayedValue = draft ?? value;
  const selectedChoice = choices.find(
    (choice) => choice.value === displayedValue,
  );
  const committedDraft =
    normalizeFormat1HexColor(displayedValue) ?? displayedValue;
  const pickerValue =
    normalizeFormat1HexColor(displayedValue) ??
    selectedChoice?.color ??
    "#000000";

  useEffect(() => {
    if (draft === null) return;
    const update = window.setTimeout(() => {
      onChange(committedDraft);
      setDraft(null);
    }, 120);
    return () => window.clearTimeout(update);
  }, [committedDraft, draft, onChange]);

  useEffect(() => {
    if (!choicesOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setChoicesOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [choicesOpen]);

  const groups = [
    {
      source: "built-in" as const,
      label: translate("ui.editorWorkspace.color.builtInTokens"),
    },
    {
      source: "theme" as const,
      label: translate("ui.editorWorkspace.color.themeTokens"),
    },
  ];

  return (
    <div
      className="editor-color-control"
      data-editor-drag-boundary
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !choicesOpen) return;
        event.preventDefault();
        setChoicesOpen(false);
        trigger.current?.focus();
      }}
    >
      <div
        className={`editor-color-combobox${allowTokens ? " has-choices" : ""}`}
      >
        <input
          className="editor-color-picker"
          ref={picker}
          type="color"
          aria-label={translate("ui.editorWorkspace.color.chooseWithPicker", {
            field: label,
          })}
          aria-describedby={ariaDescribedBy}
          title={translate("ui.editorWorkspace.color.chooseWithPicker", {
            field: label,
          })}
          value={pickerValue}
          onPointerDown={() => setChoicesOpen(false)}
          onFocus={() => setChoicesOpen(false)}
          onChange={(event) => {
            const nextValue = normalizeFormat1HexColor(event.target.value);
            if (!nextValue) return;
            setDraft(null);
            onChange(nextValue);
          }}
          onBlur={onBlur}
        />
        <input
          className="editor-color-value"
          aria-label={label}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoFocus={autoFocus}
          type="text"
          spellCheck={false}
          value={displayedValue}
          placeholder={translate(
            allowTokens
              ? "ui.editorWorkspace.color.hexOrTokenPlaceholder"
              : "ui.editorWorkspace.color.hexPlaceholder",
          )}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== null) {
              onChange(committedDraft);
              setDraft(null);
            }
            onBlur();
          }}
        />
        {allowTokens && (
          <button
            className="editor-color-choice-trigger"
            type="button"
            ref={trigger}
            aria-haspopup="true"
            aria-label={translate(
              "ui.editorWorkspace.color.showChoicesForField",
              { field: label },
            )}
            aria-expanded={choicesOpen}
            aria-controls={choiceListId}
            onPointerDown={() => picker.current?.blur()}
            onClick={() => setChoicesOpen((current) => !current)}
          >
            <span className="editor-diagnostics-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        )}
      </div>
      {allowTokens && choicesOpen && (
        <div
          className="editor-color-choice-popover"
          id={choiceListId}
          role="group"
          aria-label={translate("ui.editorWorkspace.color.availableTokens")}
        >
          {groups.map((group) => {
            const groupChoices = choices.filter(
              (choice) => choice.source === group.source,
            );
            if (!groupChoices.length) return null;
            return (
              <section className={`is-${group.source}`} key={group.source}>
                <strong>{group.label}</strong>
                <div>
                  {groupChoices.map((choice) => (
                    <button
                      type="button"
                      className={
                        choice.value === displayedValue
                          ? "editor-color-choice is-selected"
                          : "editor-color-choice"
                      }
                      aria-pressed={choice.value === displayedValue}
                      title={choice.value}
                      aria-label={translate(
                        "ui.editorWorkspace.color.useToken",
                        { token: choice.value },
                      )}
                      key={choice.value}
                      onClick={() => {
                        setDraft(null);
                        onChange(choice.value);
                        setChoicesOpen(false);
                        trigger.current?.focus();
                      }}
                    >
                      <i
                        aria-hidden="true"
                        style={
                          {
                            "--editor-color-token": choice.color,
                          } as CSSProperties
                        }
                      />
                      <span>{choice.value}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
