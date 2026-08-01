import { useRef } from "react";
import type { ConditionPropertyDescriptor } from "../markup";
import { InsertValueControl } from "./ConditionalVariants";
import { SpellingTextArea } from "./SpellingTextControl";

export function InterpolatedTextArea({
  label,
  value,
  rows,
  autoFocus,
  ariaInvalid,
  ariaDescribedBy,
  properties,
  showExplanatoryText,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  rows: number;
  autoFocus: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  properties: readonly ConditionPropertyDescriptor[];
  showExplanatoryText: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const control = useRef<HTMLTextAreaElement>(null);
  const insert = (handle: string) => {
    const start = control.current?.selectionStart ?? value.length;
    const end = control.current?.selectionEnd ?? start;
    const token = `{{${handle}}}`;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      control.current?.focus();
      const caret = start + token.length;
      control.current?.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="editor-interpolated-text">
      <span className="editor-rich-text-toolbar">
        <InsertValueControl
          properties={properties}
          showDescriptions={showExplanatoryText}
          onInsert={insert}
        />
      </span>
      <SpellingTextArea
        ref={control}
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        rows={rows}
        value={value}
        onSpellingChange={onChange}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
