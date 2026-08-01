import { describe, expect, it } from "vitest";
import { editableSnippetSelection, sourceLine } from "./sourceSelection";

describe("Editor source selection", () => {
  it("projects offsets to one-based source lines", () => {
    expect(sourceLine("first\nsecond\nthird", 0)).toBe(1);
    expect(sourceLine("first\nsecond\nthird", 7)).toBe(2);
  });

  it("selects quoted and unquoted declaration values", () => {
    expect(editableSnippetSelection('name: "Example"')).toEqual({
      from: 7,
      to: 14,
    });
    expect(editableSnippetSelection("amount: 25")).toEqual({
      from: 8,
      to: 10,
    });
  });

  it("places the caret at the end when no field value exists", () => {
    expect(editableSnippetSelection("choice")).toEqual({ from: 6, to: 6 });
  });
});
