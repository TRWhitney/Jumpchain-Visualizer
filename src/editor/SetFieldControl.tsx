import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translate } from "../localization";
import {
  FreeTextSuggestionCombobox,
  type FreeTextSuggestion,
} from "./FreeTextSuggestionCombobox";

export function SetFieldControl({
  kind,
  fieldName,
  label,
  help,
  showHelp = true,
  values,
  suggestions,
  placeholder,
  addLabel,
  addedListLabel,
  emptyValueLabel,
  removeLabel,
  normalize,
  renderValue,
  renderDetails,
  onAdd,
  onRemove,
}: {
  kind: "tag" | "group" | "author";
  fieldName?: string;
  label: string;
  help: string;
  showHelp?: boolean;
  values: readonly string[];
  suggestions: readonly FreeTextSuggestion[];
  placeholder: string;
  addLabel: string;
  addedListLabel: string;
  emptyValueLabel: string;
  removeLabel: (value: string) => string;
  normalize: (value: string) => string;
  renderValue?: (value: string, removeAction: ReactNode) => ReactNode;
  renderDetails?: (value: string, occurrence: number) => ReactNode;
  onAdd: (value: string) => void;
  onRemove: (occurrence: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const helpId = `editor-set-help-${useId().replaceAll(":", "-")}`;
  const pendingFocus = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const normalizedDraft = normalize(draft);
  const duplicate = values.some(
    (value) => normalize(value) === normalizedDraft,
  );
  const canAdd = Boolean(normalizedDraft) && !duplicate;

  const add = () => {
    if (!canAdd) return;
    onAdd(draft.trim());
    setDraft("");
  };

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const buttons = root.current?.querySelectorAll<HTMLButtonElement>(
      ".editor-set-pill-remove",
    );
    const target =
      buttons?.[
        Math.min(pendingFocus.current, Math.max(0, buttons.length - 1))
      ] ??
      root.current?.querySelector<HTMLInputElement>(
        ".editor-set-composer input",
      );
    target?.focus();
    pendingFocus.current = null;
  }, [values.length]);

  return (
    <div
      className={`editor-set-field is-${kind}`}
      data-editor-drag-boundary
      data-structured-field={fieldName}
      ref={root}
    >
      <span className="editor-set-field-label">{label}</span>
      {showHelp && (
        <small className="editor-set-field-help" id={helpId}>
          {help}
        </small>
      )}
      <div className="editor-set-composer">
        {kind === "author" ? (
          <input
            className="editor-set-text-input"
            aria-label={label}
            aria-describedby={showHelp ? helpId : undefined}
            type="text"
            spellCheck
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
          />
        ) : (
          <FreeTextSuggestionCombobox
            label={label}
            value={draft}
            suggestions={suggestions}
            placeholder={placeholder}
            spellCheck={false}
            showSuggestionsLabel={translate(
              "ui.editorWorkspace.combobox.showSuggestionsForField",
              { field: label },
            )}
            suggestionsLabel={translate(
              "ui.editorWorkspace.combobox.availableSuggestionsForField",
              { field: label },
            )}
            showDescriptions={showHelp}
            ariaDescribedBy={showHelp ? helpId : undefined}
            onChange={setDraft}
            onSubmit={add}
          />
        )}
        <button type="button" disabled={!canAdd} onClick={add}>
          {addLabel}
        </button>
      </div>
      {values.length > 0 && (
        <div
          className="editor-set-pill-list"
          role="list"
          aria-label={addedListLabel}
        >
          {values.map((value, occurrence) => {
            const displayed = value || emptyValueLabel;
            const removeAction = (
              <button
                className="editor-set-pill-remove"
                type="button"
                aria-label={removeLabel(displayed)}
                onClick={() => {
                  pendingFocus.current = occurrence;
                  onRemove(occurrence);
                }}
              >
                ×
              </button>
            );
            return (
              <div
                className={`editor-set-entry is-${kind}`}
                data-structured-occurrence={occurrence}
                role="listitem"
                key={`${occurrence}:${value}`}
              >
                <span
                  className={`editor-set-pill is-${kind}${value ? "" : " is-empty"}`}
                >
                  {renderValue ? (
                    renderValue(displayed, removeAction)
                  ) : kind === "group" ? (
                    <>
                      <code>{displayed}</code>
                      {removeAction}
                    </>
                  ) : (
                    <>
                      <span className="editor-set-pill-text">{displayed}</span>
                      {removeAction}
                    </>
                  )}
                </span>
                {renderDetails?.(value, occurrence)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
