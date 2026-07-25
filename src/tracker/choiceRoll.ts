import type { JumpChoice, Renderable } from "../markup";

const maximumRandomCandidateCount = 0x1_0000_0000;

export type ChoiceRollDomain = {
  size: number;
  valueAt: (index: number) => string | number | undefined;
};

const label = (value: Renderable) =>
  value.base ?? value.variants[0]?.value ?? "";

export function choiceRollDomain(choice: JumpChoice): ChoiceRollDomain | null {
  if (choice.selection === "integer") {
    const minimum = choice.min ?? 0;
    const maximum = choice.max ?? Math.max(minimum, 5);
    const size = maximum - minimum + 1;
    if (
      !Number.isSafeInteger(minimum) ||
      !Number.isSafeInteger(maximum) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > maximumRandomCandidateCount
    )
      return null;
    return {
      size,
      valueAt: (index) =>
        Number.isSafeInteger(index) && index >= 0 && index < size
          ? minimum + index
          : undefined,
    };
  }

  if (choice.selection === "select") {
    const values = choice.options.map(label);
    if (!values.length) return null;
    return {
      size: values.length,
      valueAt: (index) =>
        Number.isSafeInteger(index) && index >= 0 && index < values.length
          ? values[index]
          : undefined,
    };
  }

  return null;
}
