import { describe, expect, it } from "vitest";
import type { JumpChoice } from "../markup";
import { choiceRollDomain } from "./choiceRoll";

const choice = (
  selection: JumpChoice["selection"],
  extra: Partial<JumpChoice> = {},
): JumpChoice => ({
  handle: "roll_test",
  name: { base: "Roll test", variants: [] },
  tags: [],
  groups: [],
  selection,
  resolution: "random",
  options: [],
  text: [],
  images: [],
  inputs: [],
  costs: [],
  grants: [],
  ...extra,
});

describe("choice roll domains", () => {
  it("maps bounded integers without allocating every candidate", () => {
    const domain = choiceRollDomain(choice("integer", { min: 3, max: 7 }));

    expect(domain?.size).toBe(5);
    expect(domain?.valueAt(0)).toBe(3);
    expect(domain?.valueAt(4)).toBe(7);
    expect(domain?.valueAt(5)).toBeUndefined();
  });

  it("maps select options and rejects empty selections", () => {
    const domain = choiceRollDomain(
      choice("select", {
        options: [
          { base: "First", variants: [] },
          { base: "Second", variants: [] },
        ],
      }),
    );

    expect(domain?.size).toBe(2);
    expect(domain?.valueAt(1)).toBe("Second");
    expect(choiceRollDomain(choice("select"))).toBeNull();
  });

  it("rejects invalid selection kinds and unsafe integer ranges", () => {
    expect(choiceRollDomain(choice("toggle"))).toBeNull();
    expect(choiceRollDomain(choice("integer", { min: 10, max: 9 }))).toBeNull();
    expect(
      choiceRollDomain(choice("integer", { min: 0, max: 0x1_0000_0000 })),
    ).toBeNull();
  });
});
