import {
  forwardRef,
  useEffect,
  useState,
  useSyncExternalStore,
  type InputHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type TextareaHTMLAttributes,
} from "react";
import i18next from "i18next";
import { translate } from "../localization";
import { useContextMenu } from "../ui";
import {
  loadEnglishSpellingEngine,
  spellingCorrectionAt,
  type SpellingEngine,
} from "./spelling";

type SpellingControlProps = {
  onSpellingChange: (value: string) => void;
  spellingEngine?: SpellingEngine;
};

function useSpellingEngine(override?: SpellingEngine) {
  const language = useSyncExternalStore(
    (notify) => {
      i18next.on("languageChanged", notify);
      return () => {
        i18next.off("languageChanged", notify);
      };
    },
    () =>
      i18next.resolvedLanguage ||
      i18next.language ||
      document.documentElement.lang,
    () => "en",
  );
  const english = language.toLowerCase().startsWith("en");
  const [loaded, setLoaded] = useState<SpellingEngine | null>(null);
  useEffect(() => {
    if (override || !english) return;
    let active = true;
    void loadEnglishSpellingEngine().then((engine) => {
      if (active) setLoaded(engine);
    });
    return () => {
      active = false;
    };
  }, [english, override]);
  return override ?? (english ? loaded : null);
}

function spellingControlProps<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  onSpellingChange: (value: string) => void,
  engine: SpellingEngine | null,
  openContextMenu: ReturnType<typeof useContextMenu>["openContextMenu"],
) {
  return {
    "data-spelling-suggestions": engine ? "ready" : "native",
    onContextMenu: (event: ReactMouseEvent<T>) => {
      if (!engine || event.shiftKey) return;
      const control = event.currentTarget;
      const correction = spellingCorrectionAt(
        value,
        control.selectionStart ?? 0,
        control.selectionEnd ?? control.selectionStart ?? 0,
        engine,
      );
      if (!correction) return;
      control.setSelectionRange(correction.from, correction.to);
      openContextMenu(event, {
        label: translate("ui.editorWorkspace.spelling.suggestionsFor", {
          word: correction.word,
        }),
        overrideNative: true,
        actions: correction.suggestions.map((suggestion, index) => ({
          id: `spelling-${index}`,
          label: suggestion,
          onAction: () => {
            onSpellingChange(
              `${value.slice(0, correction.from)}${suggestion}${value.slice(correction.to)}`,
            );
            requestAnimationFrame(() => {
              control.focus();
              const caret = correction.from + suggestion.length;
              control.setSelectionRange(caret, caret);
            });
          },
        })),
      });
    },
  };
}

export const SpellingTextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & SpellingControlProps
>(function SpellingTextArea(
  { onSpellingChange, spellingEngine, value = "", ...props },
  ref,
) {
  const engine = useSpellingEngine(spellingEngine);
  const { openContextMenu } = useContextMenu();
  return (
    <textarea
      {...props}
      {...spellingControlProps(
        String(value),
        onSpellingChange,
        engine,
        openContextMenu,
      )}
      ref={ref}
      spellCheck
      value={value}
    />
  );
});

export const SpellingTextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & SpellingControlProps
>(function SpellingTextInput(
  { onSpellingChange, spellingEngine, value = "", ...props },
  ref,
) {
  const engine = useSpellingEngine(spellingEngine);
  const { openContextMenu } = useContextMenu();
  return (
    <input
      {...props}
      {...spellingControlProps(
        String(value),
        onSpellingChange,
        engine,
        openContextMenu,
      )}
      ref={ref}
      spellCheck
      value={value}
    />
  );
});
