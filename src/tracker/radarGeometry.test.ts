import { describe, expect, it } from "vitest";
import { tagCategories, type TagCategory } from "../domain/tags";
import { radarAreaRatios } from "./radarGeometry";

const countsWith = (values: Partial<Record<TagCategory, number>>) =>
  Object.fromEntries(
    tagCategories.map((category) => [category, values[category] ?? 0]),
  ) as Record<TagCategory, number>;

describe("radar area geometry", () => {
  it("adds shoulders only where an isolated value would collapse to a line", () => {
    const ratios = radarAreaRatios(countsWith({ mental: 5, stealth: 2 }), 5);

    expect(ratios).toEqual([0.25, 1, 0.25, 0, 0.1, 0.4, 0.1, 0, 0, 0, 0, 0]);
  });

  it("leaves zero and already dimensional data unpadded", () => {
    expect(radarAreaRatios(countsWith({}), 5)).toEqual(
      tagCategories.map(() => 0),
    );
    expect(radarAreaRatios(countsWith({ social: 2, mental: 4 }), 5)).toEqual([
      0.4, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("never makes a shoulder longer than a very small spike", () => {
    const ratios = radarAreaRatios(countsWith({ mental: 1 }), 100);

    expect(ratios[0]).toBe(0.01);
    expect(ratios[1]).toBe(0.01);
    expect(ratios[2]).toBe(0.01);
  });
});
