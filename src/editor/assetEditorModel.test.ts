import { describe, expect, it } from "vitest";
import {
  createRasterEditorDocument,
  eraseUnlockedLayers,
  hydrateAssetEditorDocument,
  isAnimatedPng,
  paintLayerBounds,
  rasterPreset,
  transformPaintLayerToBounds,
  transformLayerForResize,
  type RasterPaintLayer,
  type RasterShapeLayer,
} from "./assetEditorModel";

describe("asset editor documents", () => {
  it("round-trips bounded raster state and rejects corrupt or remote-shaped data", () => {
    const document = createRasterEditorDocument(
      "png",
      Uint8Array.from([137, 80, 78, 71]),
      32,
      24,
    );
    document.layers.push({
      id: "shape",
      kind: "shape",
      name: "Outline",
      visible: true,
      locked: false,
      opacity: 0.75,
      shape: "rectangle",
      x: 2,
      y: 3,
      width: 10,
      height: 8,
      rotation: 0,
      stroke: "#ff0000",
      fill: null,
      strokeWidth: 2,
    });
    const hydrated = hydrateAssetEditorDocument({
      ...structuredClone(document),
      baseBytes: [...document.baseBytes],
    });
    expect(hydrated).toMatchObject({
      kind: "raster",
      baseWidth: 32,
      layers: [{ kind: "shape", name: "Outline" }],
    });
    expect(
      hydrateAssetEditorDocument({
        ...document,
        layers: [{ kind: "image", href: "https://example.com/pixel.png" }],
      }),
    ).toBeNull();
    expect(
      hydrateAssetEditorDocument({ ...document, baseWidth: 100_000 }),
    ).toBeNull();
  });

  it("scales markup proportionally during pixel resize", () => {
    const layer: RasterShapeLayer = {
      id: "shape",
      kind: "shape",
      name: "Box",
      visible: true,
      locked: false,
      opacity: 1,
      shape: "rectangle",
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0,
      stroke: "#000000",
      fill: null,
      strokeWidth: 2,
    };
    expect(transformLayerForResize(layer, 2, 0.5)).toMatchObject({
      x: 20,
      y: 10,
      width: 60,
      height: 20,
      strokeWidth: 2,
    });
    const paint: RasterPaintLayer = {
      id: "paint",
      kind: "paint",
      name: "Paint",
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [
        {
          points: [
            { x: 4, y: 8 },
            { x: 12, y: 16 },
          ],
          color: "#ff0000",
          size: 8,
          hardness: 0.5,
          opacity: 1,
          erase: false,
        },
      ],
    };
    expect(transformLayerForResize(paint, 2, 0.5)).toMatchObject({
      strokes: [
        {
          points: [
            { x: 8, y: 4 },
            { x: 24, y: 8 },
          ],
          size: 8,
        },
      ],
    });
    const movedAndResized = transformPaintLayerToBounds(paint, {
      x: 20,
      y: 30,
      width: 16,
      height: 4,
    });
    expect(paintLayerBounds(movedAndResized)).toEqual({
      x: 20,
      y: 30,
      width: 16,
      height: 4,
    });
    expect(movedAndResized.strokes[0].size).toBe(8);
    const movedOnly = transformPaintLayerToBounds(movedAndResized, {
      ...paintLayerBounds(movedAndResized),
      x: 45,
      y: 55,
    });
    expect(paintLayerBounds(movedOnly)).toEqual({
      x: 45,
      y: 55,
      width: 16,
      height: 4,
    });
  });

  it("applies one erase gesture only to visible unlocked layers", () => {
    const document = createRasterEditorDocument(
      "png",
      Uint8Array.from([137, 80, 78, 71]),
      32,
      24,
    );
    const paint = {
      id: "paint",
      kind: "paint" as const,
      name: "Paint",
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [],
    };
    const locked = { ...paint, id: "locked", name: "Locked", locked: true };
    const hidden = { ...paint, id: "hidden", name: "Hidden", visible: false };
    const erasure = {
      points: [
        { x: 1, y: 2 },
        { x: 5, y: 6 },
      ],
      color: "#000000",
      size: 8,
      hardness: 0.5,
      opacity: 1,
      erase: true,
    };
    const layers = eraseUnlockedLayers([paint, locked, hidden], erasure);
    expect(layers[0].erasures).toEqual([erasure]);
    expect(layers[1].erasures).toBeUndefined();
    expect(layers[2].erasures).toBeUndefined();
    expect(document.layers).toEqual([]);
  });

  it("applies reversible preset values without mutating the current corrections", () => {
    const document = createRasterEditorDocument(
      "jpg",
      Uint8Array.from([0xff, 0xd8]),
      10,
      10,
    );
    const next = rasterPreset(document.corrections, "warm");
    expect(next).toMatchObject({
      temperature: 24,
      vibrance: 12,
      exposure: 0,
      contrast: 0,
      saturation: 0,
      tint: 0,
    });
    const reset = rasterPreset(
      { ...document.corrections, exposure: 80, tint: -40, blur: 30 },
      "monochrome",
    );
    expect(reset).toMatchObject({
      saturation: -100,
      exposure: 0,
      tint: 0,
      blur: 0,
    });
    expect(document.corrections.temperature).toBe(0);
  });

  it("detects APNG animation control before image data", () => {
    const type = new TextEncoder().encode("acTL");
    const bytes = new Uint8Array(40);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    bytes.set([0, 0, 0, 8], 8);
    bytes.set(type, 12);
    expect(isAnimatedPng(bytes)).toBe(true);
    expect(isAnimatedPng(Uint8Array.from([137, 80, 78, 71]))).toBe(false);
  });
});
