import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { translate } from "../localization";
import { normalizeFormat1HexColor } from "../markup/format1Colors";
import {
  platformScreenColorSampler,
  type ScreenColorSampler,
} from "./screenColorSampler";
import { Chevron } from "../ui";

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
  onCreateTheme,
  onBlur,
  screenColorSampler = platformScreenColorSampler,
}: {
  label: string;
  value: string;
  choices: readonly EditorColorChoice[];
  allowTokens: boolean;
  autoFocus?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onChange: (value: string) => void;
  onCreateTheme?: (value: string, resolvedColor: string) => void;
  onBlur: () => void;
  screenColorSampler?: ScreenColorSampler;
}) {
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [screenSamplerAvailable, setScreenSamplerAvailable] = useState(false);
  const [screenSampling, setScreenSampling] = useState(false);
  const [screenSamplingFailed, setScreenSamplingFailed] = useState(false);
  const draftRef = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choiceListId = `editor-color-choices-${useId().replaceAll(":", "-")}`;
  const displayedValue = draft ?? value;
  const selectedChoice = choices.find(
    (choice) => choice.value === displayedValue,
  );
  const pickerValue =
    normalizeFormat1HexColor(displayedValue) ??
    selectedChoice?.color ??
    "#000000";

  const updateDraft = useCallback((nextDraft: string | null) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, []);

  const commitDraft = useCallback(() => {
    const pendingDraft = draftRef.current;
    if (pendingDraft === null) return;
    const nextValue = normalizeFormat1HexColor(pendingDraft) ?? pendingDraft;
    draftRef.current = null;
    setDraft(null);
    onChange(nextValue);
  }, [onChange]);

  useEffect(() => {
    if (draft === null) return;
    const update = window.setTimeout(commitDraft, 120);
    return () => window.clearTimeout(update);
  }, [commitDraft, draft]);

  useEffect(() => {
    if (!choicesOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setChoicesOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [choicesOpen]);

  useEffect(() => {
    if (allowTokens) return;
    let active = true;
    void screenColorSampler.isAvailable().then((available) => {
      if (active) setScreenSamplerAvailable(available);
    });
    return () => {
      active = false;
    };
  }, [allowTokens, screenColorSampler]);

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
        className={`editor-color-combobox${allowTokens ? " has-choices" : ""}${!allowTokens && screenSamplerAvailable ? " has-screen-sampler" : ""}`}
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
            updateDraft(nextValue);
          }}
          onBlur={() => {
            commitDraft();
            onBlur();
          }}
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
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={() => {
            commitDraft();
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
            <Chevron
              className="editor-diagnostics-chevron"
              direction={choicesOpen ? "up" : "down"}
            />
          </button>
        )}
        {!allowTokens && screenSamplerAvailable && (
          <button
            className="editor-color-screen-sampler"
            type="button"
            aria-label={translate(
              "ui.editorWorkspace.color.sampleFromScreenForField",
              { field: label },
            )}
            title={translate(
              "ui.editorWorkspace.color.sampleFromScreenForField",
              { field: label },
            )}
            aria-busy={screenSampling || undefined}
            disabled={screenSampling}
            onClick={async () => {
              setScreenSampling(true);
              setScreenSamplingFailed(false);
              const result = await screenColorSampler.sample().catch(() => ({
                status: "unavailable" as const,
              }));
              setScreenSampling(false);
              if (result.status === "selected") {
                const nextColor = normalizeFormat1HexColor(result.color);
                if (nextColor) {
                  updateDraft(null);
                  onChange(nextColor);
                  onBlur();
                }
                return;
              }
              if (result.status === "unavailable") {
                setScreenSamplerAvailable(false);
                setScreenSamplingFailed(true);
              }
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m9.4 2 4.6 4.6-2 2-.9-.9-5.3 5.3-3 .8.8-3 5.3-5.3-.9-.9 2-2Zm.6 3.4-5 5-.3 1.1 1.1-.3 5-5Z" />
            </svg>
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {screenSamplingFailed
          ? translate("ui.editorWorkspace.color.screenSamplingUnavailable")
          : ""}
      </span>
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
                        updateDraft(null);
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
          {onCreateTheme && (
            <button
              type="button"
              className="editor-color-create-theme"
              onClick={() => {
                updateDraft(null);
                setChoicesOpen(false);
                onCreateTheme(displayedValue, pickerValue);
              }}
            >
              {translate("ui.editorWorkspace.color.createThemeColor")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
