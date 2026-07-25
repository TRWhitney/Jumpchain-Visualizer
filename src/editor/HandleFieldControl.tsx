import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { translate } from "../localization";
import { Chevron } from "../ui";

export function HandleFieldControl({
  label,
  value,
  options,
  placeholder,
  autoFocus,
  ariaInvalid,
  ariaDescribedBy,
  createLabel,
  commitOnBlur = false,
  onChange,
  onCreate,
  onBlur,
}: {
  label: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  autoFocus?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  createLabel?: string;
  commitOnBlur?: boolean;
  onChange: (value: string) => void;
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
  const listId = `editor-handle-options-${useId().replaceAll(":", "-")}`;
  const displayedValue = commitOnBlur ? (draft ?? value) : value;
  const uniqueOptions = options.filter(
    (option, index) => options.indexOf(option) === index,
  );
  const optionCount = uniqueOptions.length + (onCreate ? 1 : 0);

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

  const openOptions = () => {
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

  const toggleOpen = () => {
    if (open) setOpen(false);
    else openOptions();
  };

  const inputBlur = (event: FocusEvent<HTMLInputElement>) => {
    commitDraft();
    if (!root.current?.contains(event.relatedTarget)) {
      onBlur?.();
    }
  };

  return (
    <div className="editor-handle-control" data-editor-drag-boundary ref={root}>
      <div className="editor-handle-combobox">
        <input
          ref={input}
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoFocus={autoFocus}
          type="text"
          spellCheck={false}
          value={displayedValue}
          placeholder={placeholder}
          onChange={(event) => {
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
              openOptions();
              requestAnimationFrame(() =>
                focusOption(event.key === "ArrowDown" ? 0 : optionCount - 1),
              );
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          aria-label={translate(
            "ui.editorWorkspace.handle.showChoicesForField",
            { field: label },
          )}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          disabled={!optionCount}
          onClick={toggleOpen}
        >
          <Chevron
            className="editor-diagnostics-chevron"
            direction={open ? "down" : "right"}
          />
        </button>
      </div>
      {open && optionCount > 0 && (
        <div
          className={`editor-handle-popover${openAbove ? " is-above" : ""}`}
          id={listId}
          role="listbox"
          aria-label={translate(
            "ui.editorWorkspace.handle.availableHandlesForField",
            { field: label },
          )}
        >
          {uniqueOptions.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option === displayedValue}
              className={option === displayedValue ? "is-selected" : undefined}
              key={option}
              ref={(element) => {
                optionButtons.current[index] = element;
              }}
              onKeyDown={(event) => optionKeyDown(event, index)}
              onClick={() => {
                draftRef.current = null;
                setDraft(null);
                onChange(option);
                setOpen(false);
                onBlur?.();
                input.current?.focus();
              }}
            >
              {option}
            </button>
          ))}
          {onCreate && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="is-create"
              ref={(element) => {
                optionButtons.current[uniqueOptions.length] = element;
              }}
              onKeyDown={(event) => optionKeyDown(event, uniqueOptions.length)}
              onClick={() => {
                draftRef.current = null;
                setDraft(null);
                setOpen(false);
                onCreate();
              }}
            >
              {createLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
