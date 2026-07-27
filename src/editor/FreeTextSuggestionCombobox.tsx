import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Chevron } from "../ui";

export type FreeTextSuggestion = {
  value: string;
  label: string;
  description?: string;
};

export function FreeTextSuggestionCombobox({
  label,
  value,
  suggestions,
  placeholder,
  autoFocus,
  disabled,
  spellCheck = false,
  ariaInvalid,
  ariaDescribedBy,
  showSuggestionsLabel,
  suggestionsLabel,
  createLabel,
  commitOnBlur = false,
  selectOnly = false,
  showDescriptions = true,
  onChange,
  onSubmit,
  onCreate,
  onBlur,
}: {
  label: string;
  value: string;
  suggestions: readonly FreeTextSuggestion[];
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  spellCheck?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  showSuggestionsLabel: string;
  suggestionsLabel: string;
  createLabel?: string;
  commitOnBlur?: boolean;
  selectOnly?: boolean;
  showDescriptions?: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onCreate?: () => void;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = `editor-suggestion-options-${useId().replaceAll(":", "-")}`;
  const uniqueSuggestions = suggestions.filter(
    (suggestion, index) =>
      suggestions.findIndex(
        (candidate) => candidate.value === suggestion.value,
      ) === index,
  );
  const selectedValue = commitOnBlur ? (draft ?? value) : value;
  const displayedValue = selectOnly
    ? (uniqueSuggestions.find(
        (suggestion) => suggestion.value === selectedValue,
      )?.label ?? selectedValue)
    : selectedValue;
  const optionCount = uniqueSuggestions.length + (onCreate ? 1 : 0);

  const commitDraft = useCallback(() => {
    const pendingDraft = draftRef.current;
    if (!commitOnBlur || pendingDraft === null) return;
    draftRef.current = null;
    setDraft(null);
    onChange(pendingDraft);
  }, [commitOnBlur, onChange]);

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        commitDraft();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [commitDraft, open]);

  const focusOption = (index: number) => {
    if (!optionCount) return;
    optionButtons.current[(index + optionCount) % optionCount]?.focus();
  };

  const optionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(optionCount - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      input.current?.focus();
    }
  };

  const openSuggestions = () => {
    if (!optionCount || disabled) return;
    const rootBounds = root.current?.getBoundingClientRect();
    const scrollBounds = root.current
      ?.closest(".editor-structured-scroll")
      ?.getBoundingClientRect();
    const boundaryTop = scrollBounds?.top ?? 0;
    const boundaryBottom = scrollBounds?.bottom ?? window.innerHeight;
    const roomAbove = rootBounds ? rootBounds.top - boundaryTop : 0;
    const roomBelow = rootBounds ? boundaryBottom - rootBounds.bottom : 0;
    setOpenAbove(roomBelow < Math.min(192, roomAbove));
    setOpen(true);
  };

  const inputBlur = (event: FocusEvent<HTMLInputElement>) => {
    commitDraft();
    if (!root.current?.contains(event.relatedTarget)) onBlur?.();
  };

  return (
    <div
      className={`editor-handle-control${selectOnly ? " is-select-only" : ""}`}
      data-editor-drag-boundary
      ref={root}
    >
      <div className="editor-handle-combobox">
        <input
          ref={input}
          role="combobox"
          aria-label={label}
          aria-autocomplete={selectOnly ? "none" : "list"}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={selectOnly}
          type="text"
          spellCheck={spellCheck}
          value={displayedValue}
          placeholder={placeholder}
          onClick={() => {
            if (!selectOnly) return;
            if (open) setOpen(false);
            else openSuggestions();
          }}
          onChange={(event) => {
            if (selectOnly) return;
            if (commitOnBlur) {
              draftRef.current = event.target.value;
              setDraft(event.target.value);
            } else onChange(event.target.value);
          }}
          onBlur={inputBlur}
          onKeyDown={(event) => {
            if (
              optionCount &&
              (event.key === "ArrowDown" || event.key === "ArrowUp")
            ) {
              event.preventDefault();
              openSuggestions();
              requestAnimationFrame(() =>
                focusOption(event.key === "ArrowDown" ? 0 : optionCount - 1),
              );
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
            } else if (
              selectOnly &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              if (open) setOpen(false);
              else {
                openSuggestions();
                const selectedIndex = uniqueSuggestions.findIndex(
                  (suggestion) => suggestion.value === selectedValue,
                );
                requestAnimationFrame(() =>
                  focusOption(selectedIndex < 0 ? 0 : selectedIndex),
                );
              }
            } else if (event.key === "Enter" && onSubmit) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <button
          type="button"
          aria-label={showSuggestionsLabel}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          disabled={disabled || !optionCount}
          onClick={() => {
            if (open) setOpen(false);
            else openSuggestions();
          }}
        >
          <Chevron
            className="editor-diagnostics-chevron"
            direction={open ? "up" : "down"}
          />
        </button>
      </div>
      {open && optionCount > 0 && (
        <div
          className={`editor-handle-popover${openAbove ? " is-above" : ""}`}
          id={listId}
          role="listbox"
          aria-label={suggestionsLabel}
        >
          {uniqueSuggestions.map((suggestion, index) => (
            <button
              type="button"
              role="option"
              aria-label={
                showDescriptions && suggestion.description
                  ? `${suggestion.label}. ${suggestion.description}`
                  : suggestion.label
              }
              aria-selected={suggestion.value === selectedValue}
              className={
                suggestion.value === selectedValue ? "is-selected" : undefined
              }
              key={suggestion.value}
              ref={(element) => {
                optionButtons.current[index] = element;
              }}
              onKeyDown={(event) => optionKeyDown(event, index)}
              onClick={() => {
                draftRef.current = null;
                setDraft(null);
                onChange(suggestion.value);
                setOpen(false);
                onBlur?.();
                input.current?.focus();
              }}
            >
              <span>{suggestion.label}</span>
              {showDescriptions && suggestion.description && (
                <small>{suggestion.description}</small>
              )}
            </button>
          ))}
          {onCreate && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="is-create"
              ref={(element) => {
                optionButtons.current[uniqueSuggestions.length] = element;
              }}
              onKeyDown={(event) =>
                optionKeyDown(event, uniqueSuggestions.length)
              }
              onClick={() => {
                draftRef.current = null;
                setDraft(null);
                setOpen(false);
                onCreate();
              }}
            >
              <span>{createLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
