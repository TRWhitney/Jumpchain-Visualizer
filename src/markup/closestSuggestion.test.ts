import { describe, expect, it } from "vitest";
import { closestSuggestion, editDistance } from "./closestSuggestion";

describe("closest schema suggestion", () => {
  it("preserves edit ranking and rejection thresholds", () => {
    expect(editDistance("section", "secton")).toBe(1);
    expect(closestSuggestion("secton", ["choice", "section", "resource"])).toBe(
      "section",
    );
    expect(closestSuggestion("unrelated", ["choice", "section"])).toBe(
      undefined,
    );
  });
});
