import { describe, expect, it } from "vitest";
import {
  spellingCorrectionAt,
  spellingWordRange,
  type SpellingEngine,
} from "./spelling";

const engine: SpellingEngine = {
  correct: (word) => word.toLowerCase() !== "thd",
  suggest: (word) => (word.toLowerCase() === "thd" ? ["the", "tad"] : []),
};

describe("Structured field spelling", () => {
  it("finds the selected word or the word next to the caret", () => {
    expect(spellingWordRange("Fix thd word.", 4, 7)).toEqual({
      word: "thd",
      from: 4,
      to: 7,
    });
    expect(spellingWordRange("Fix thd word.", 7, 7)).toEqual({
      word: "thd",
      from: 4,
      to: 7,
    });
  });

  it("does not spell check authored interpolation handles", () => {
    expect(spellingWordRange("Hello {{thd}}.", 9, 9)).toBeNull();
  });

  it("returns bounded suggestions while preserving authored casing", () => {
    expect(spellingCorrectionAt("Thd value", 0, 3, engine)).toEqual({
      word: "Thd",
      from: 0,
      to: 3,
      suggestions: ["The", "Tad"],
    });
    expect(spellingCorrectionAt("The value", 0, 3, engine)).toBeNull();
  });
});
