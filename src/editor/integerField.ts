export type IntegerFieldBounds = {
  minimum?: number;
  maximum?: number;
  defaultValue?: number;
};

function authoredInteger(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function integerFieldControl(
  value: string,
  { minimum, maximum, defaultValue }: IntegerFieldBounds,
) {
  const effectiveValue = authoredInteger(value) ?? defaultValue ?? null;
  const step = (direction: -1 | 1) => {
    const baseline =
      effectiveValue ??
      (direction > 0 ? (minimum ?? 0) - 1 : (maximum ?? 0) + 1);
    return Math.max(
      minimum ?? -Infinity,
      Math.min(maximum ?? Infinity, baseline + direction),
    );
  };
  return {
    increaseDisabled:
      maximum !== undefined &&
      effectiveValue !== null &&
      effectiveValue >= maximum,
    decreaseDisabled:
      minimum !== undefined &&
      effectiveValue !== null &&
      effectiveValue <= minimum,
    increase: () => step(1),
    decrease: () => step(-1),
  };
}
