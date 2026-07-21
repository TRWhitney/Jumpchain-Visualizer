import { describe, expect, it } from "vitest";
import format1Schema from "../../schema/format-1.json";
import {
  format1BuiltInColors,
  isFormat1HexColor,
  normalizeFormat1HexColor,
} from "./format1Colors";

describe("Format 1 colors", () => {
  it("provides a rendered swatch for every schema color token", () => {
    expect(Object.keys(format1BuiltInColors)).toEqual(
      format1Schema.types.color.builtInTokens,
    );
    expect(Object.values(format1BuiltInColors).every(isFormat1HexColor)).toBe(
      true,
    );
  });

  it.each([
    ["#a1b2c3", "#A1B2C3"],
    ["#A1B2C3", "#A1B2C3"],
    ["#abc", null],
    ["blue", null],
  ])("normalizes valid six-digit colors (%s)", (value, expected) => {
    expect(normalizeFormat1HexColor(value)).toBe(expected);
  });
});
