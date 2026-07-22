import { describe, expect, it } from "vitest";
import { integerFieldControl } from "./integerField";

describe("integer field controls", () => {
  it.each([
    ["authored value", "3", {}, 4, 2, false, false],
    [
      "omission default",
      "",
      { defaultValue: 1, minimum: 1 },
      2,
      1,
      false,
      true,
    ],
    ["minimum insertion", "", { minimum: 1 }, 1, 1, false, false],
    ["maximum insertion", "", { maximum: 12 }, 0, 12, false, false],
    ["bounded maximum", "12", { minimum: 1, maximum: 12 }, 12, 11, true, false],
  ] as const)(
    "steps from the %s",
    (
      _name,
      value,
      bounds,
      increased,
      decreased,
      increaseDisabled,
      decreaseDisabled,
    ) => {
      const control = integerFieldControl(value, bounds);
      expect(control.increase()).toBe(increased);
      expect(control.decrease()).toBe(decreased);
      expect(control.increaseDisabled).toBe(increaseDisabled);
      expect(control.decreaseDisabled).toBe(decreaseDisabled);
    },
  );
});
