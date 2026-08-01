import { translate } from "../localization";
import { Chevron } from "./Chevron";

type Props = {
  id?: string;
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  placeholder?: string;
  fluid?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: number | null) => void;
};

export function NumberStepperButtons({
  label,
  increaseDisabled = false,
  decreaseDisabled = false,
  onIncrease,
  onDecrease,
}: {
  label: string;
  increaseDisabled?: boolean;
  decreaseDisabled?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <span className="number-stepper-buttons">
      <button
        type="button"
        aria-label={translate("ui.numberStepper.ariaLabel.increase")}
        title={`Increase ${label}`}
        disabled={increaseDisabled}
        onClick={onIncrease}
      >
        <Chevron direction="up" />
      </button>
      <button
        type="button"
        aria-label={translate("ui.numberStepper.ariaLabel.decrease")}
        title={`Decrease ${label}`}
        disabled={decreaseDisabled}
        onClick={onDecrease}
      >
        <Chevron direction="down" />
      </button>
    </span>
  );
}

export function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  placeholder = "Unset",
  fluid = false,
  disabled = false,
  invalid = false,
  onChange,
}: Props) {
  const step = (amount: -1 | 1) => {
    const baseline = value ?? (amount > 0 ? (min ?? 0) - 1 : (max ?? 1) + 1);
    const next = Math.max(
      min ?? -Infinity,
      Math.min(max ?? Infinity, baseline + amount),
    );
    onChange(next);
  };
  return (
    <span className={`number-stepper${fluid ? " is-fluid" : ""}`}>
      <label>
        <span className="sr-only">{label}</span>
        <input
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          type="number"
          min={min}
          max={max}
          placeholder={placeholder}
          value={value ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : event.target.valueAsNumber,
            )
          }
        />
      </label>
      <NumberStepperButtons
        label={label}
        increaseDisabled={
          disabled || (max !== undefined && value !== null && value >= max)
        }
        decreaseDisabled={
          disabled || (min !== undefined && value !== null && value <= min)
        }
        onIncrease={() => step(1)}
        onDecrease={() => step(-1)}
      />
    </span>
  );
}
