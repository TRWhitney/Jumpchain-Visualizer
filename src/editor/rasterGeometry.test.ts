import { describe, expect, it } from "vitest";
import type { RasterStroke } from "./assetEditorModel";
import { transformStrokes, translateStrokes } from "./rasterGeometry";

const stroke: RasterStroke = {
  color: "#123456",
  erase: false,
  hardness: 0.5,
  opacity: 0.75,
  points: [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ],
  size: 4,
};

describe("raster stroke geometry", () => {
  it("translates cloned points without changing stroke metadata", () => {
    expect(translateStrokes([stroke], 5, -1)).toEqual([
      {
        ...stroke,
        points: [
          { x: 6, y: 1 },
          { x: 8, y: 3 },
        ],
      },
    ]);
    expect(stroke.points).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it("applies rotation and scale around the previous origin", () => {
    expect(transformStrokes([stroke], 1, 2, 0, 10, 20, 2, 3, 90)).toEqual([
      {
        ...stroke,
        size: 4 * Math.sqrt(6),
        points: [
          { x: 10, y: 20 },
          { x: 4, y: 24 },
        ],
      },
    ]);
  });

  it("preserves absent stroke collections", () => {
    expect(translateStrokes(undefined, 1, 1)).toBeUndefined();
    expect(transformStrokes(undefined, 0, 0, 0, 0, 0, 1, 1, 0)).toBeUndefined();
  });
});
