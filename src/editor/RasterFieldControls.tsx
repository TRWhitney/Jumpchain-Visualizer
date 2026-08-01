import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { translate } from "../localization";
import { NumberStepperButtons } from "../ui/NumberStepper";

export function RasterNumberInput({
  label,
  value,
  minimum,
  maximum,
  step = 1,
  autoFocus,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  autoFocus?: boolean;
  onChange: (value: number) => void;
  onBlur?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const setBounded = (next: number) => {
    const bounded = Math.max(
      minimum ?? -Infinity,
      Math.min(maximum ?? Infinity, next),
    );
    onChange(Math.round(bounded * 1_000_000) / 1_000_000);
  };
  const stepValue = (direction: -1 | 1) => {
    setBounded(value + step * direction);
    if (onBlur) window.setTimeout(onBlur, 0);
  };
  return (
    <span className="number-stepper editor-number-stepper asset-raster-number-stepper is-fluid">
      <input
        aria-label={label}
        type="number"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setBounded(Number(event.target.value))}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <NumberStepperButtons
        label={label}
        increaseDisabled={maximum !== undefined && value >= maximum}
        decreaseDisabled={minimum !== undefined && value <= minimum}
        onIncrease={() => stepValue(1)}
        onDecrease={() => stepValue(-1)}
      />
    </span>
  );
}

export function RangeField({
  label,
  value,
  minimum,
  maximum,
  step = 1,
  suffix = "",
  resetValue = 0,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  suffix?: string;
  resetValue?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const setBounded = (next: number) =>
    onChange(Math.max(minimum, Math.min(maximum, next)));
  const finish = () => {
    setEditing(false);
    onCommit?.();
  };
  return (
    <div className="asset-raster-range-field">
      <span>
        <span>{label}</span>
        <span className="asset-raster-range-actions">
          {editing ? (
            <RasterNumberInput
              label={translate("ui.editorWorkspace.asset.editor.fieldValue", {
                field: label,
              })}
              minimum={minimum}
              maximum={maximum}
              step={step}
              value={value}
              autoFocus
              onChange={setBounded}
              onBlur={finish}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="asset-raster-range-value"
              aria-label={translate(
                "ui.editorWorkspace.asset.editor.editFieldValue",
                { field: label },
              )}
              onClick={() => setEditing(true)}
            >
              {value}
              {suffix}
            </button>
          )}
          <button
            type="button"
            className="asset-raster-range-reset"
            aria-label={translate(
              "ui.editorWorkspace.asset.editor.resetField",
              { field: label },
            )}
            title={translate("ui.editorWorkspace.asset.editor.resetField", {
              field: label,
            })}
            disabled={value === resetValue}
            onClick={() => {
              setBounded(resetValue);
              window.setTimeout(() => onCommit?.(), 0);
            }}
          >
            ↺
          </button>
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => setBounded(Number(event.target.value))}
        onPointerUp={() => onCommit?.()}
        onKeyUp={() => onCommit?.()}
      />
    </div>
  );
}
