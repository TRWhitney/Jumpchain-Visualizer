type Props = {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  placeholder?: string;
  fluid?: boolean;
  onChange: (value: number | null) => void;
};

export function NumberStepper({
  label,
  value,
  min,
  max,
  placeholder = "Unset",
  fluid = false,
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
          aria-label={label}
          type="number"
          min={min}
          max={max}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : event.target.valueAsNumber,
            )
          }
        />
      </label>
      <span className="number-stepper-buttons">
        <button
          type="button"
          aria-label="Increase"
          title={`Increase ${label}`}
          disabled={max !== undefined && value !== null && value >= max}
          onClick={() => step(1)}
        />
        <button
          type="button"
          aria-label="Decrease"
          title={`Decrease ${label}`}
          disabled={min !== undefined && value !== null && value <= min}
          onClick={() => step(-1)}
        />
      </span>
    </span>
  );
}
