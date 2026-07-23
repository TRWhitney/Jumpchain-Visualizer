import { useEffect, useRef } from "react";
import {
  autocompletion,
  completionKeymap,
  type Completion,
} from "@codemirror/autocomplete";
import { defaultKeymap } from "@codemirror/commands";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export function ConditionExpressionInput({
  value,
  label,
  completions,
  ariaInvalid,
  ariaDescribedBy,
  onChange,
  onBlur,
}: {
  value: string;
  label: string;
  completions: readonly Completion[];
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbackRef = useRef({ value, completions, onChange, onBlur });

  useEffect(() => {
    callbackRef.current = { value, completions, onChange, onBlur };
  }, [completions, onBlur, onChange, value]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: callbackRef.current.value,
        extensions: [
          EditorState.changeFilter.of(
            (transaction) => transaction.newDoc.lines === 1,
          ),
          Prec.highest(
            keymap.of([
              { key: "Enter", run: () => true },
              ...completionKeymap,
              ...defaultKeymap,
            ]),
          ),
          autocompletion({
            activateOnTyping: true,
            override: [
              (context) => {
                const word = context.matchBefore(/[a-z0-9_!<>=-]*/i);
                if (!word || (!context.explicit && word.from === word.to))
                  return null;
                return {
                  from: word.from,
                  options: callbackRef.current.completions,
                };
              },
            ],
          }),
          EditorView.contentAttributes.of({
            "aria-label": label,
            spellcheck: "false",
          }),
          EditorView.domEventHandlers({
            blur: () => {
              callbackRef.current.onBlur();
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            callbackRef.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [label]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const content = viewRef.current?.contentDOM;
    if (!content) return;
    if (ariaInvalid) content.setAttribute("aria-invalid", "true");
    else content.removeAttribute("aria-invalid");
    if (ariaDescribedBy)
      content.setAttribute("aria-describedby", ariaDescribedBy);
    else content.removeAttribute("aria-describedby");
  }, [ariaDescribedBy, ariaInvalid]);

  return (
    <div
      className="editor-condition-expression-input"
      ref={hostRef}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
    />
  );
}
