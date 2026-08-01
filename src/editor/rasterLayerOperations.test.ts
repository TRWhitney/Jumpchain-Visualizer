import { describe, expect, it } from "vitest";
import { createRasterEditorDocument } from "./assetEditorModel";
import {
  duplicateRasterLayer,
  removeRasterLayer,
  renameRasterLayer,
  reorderRasterLayer,
  updateRasterLayer,
} from "./rasterLayerOperations";

const documentWithLayers = () => {
  const document = createRasterEditorDocument(
    "png",
    Uint8Array.from([137, 80, 78, 71]),
    8,
    6,
  );
  document.layers = [
    {
      id: "first",
      kind: "text",
      name: "First",
      visible: true,
      locked: false,
      opacity: 1,
      erasures: [],
      x: 1,
      y: 2,
      width: 20,
      rotation: 0,
      text: "one",
      family: "sans",
      size: 12,
      weight: "normal",
      align: "left",
      color: "#000000",
      background: null,
    },
    {
      id: "second",
      kind: "shape",
      name: "Second",
      visible: true,
      locked: false,
      opacity: 1,
      erasures: [],
      x: 3,
      y: 4,
      width: 5,
      height: 6,
      rotation: 0,
      shape: "rectangle",
      stroke: "#ffffff",
      strokeWidth: 1,
      fill: null,
    },
  ];
  document.selectedLayerId = "first";
  return document;
};

describe("raster layer operations", () => {
  it("preserves update selection and untouched layer identity", () => {
    const document = documentWithLayers();
    const next = updateRasterLayer(document, "second", (layer) => ({
      ...layer,
      visible: false,
    }));
    expect(next.selectedLayerId).toBe("second");
    expect(next.layers[0]).toBe(document.layers[0]);
    expect(next.layers[1]).toMatchObject({ id: "second", visible: false });
  });

  it("preserves rename, reorder, duplicate, and removal ordering", () => {
    const document = documentWithLayers();
    const renamed = renameRasterLayer(document, "first", "Renamed");
    expect(renamed.layers.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "first", name: "Renamed" },
      { id: "second", name: "Second" },
    ]);

    const reordered = reorderRasterLayer(renamed, "first", 1);
    expect(reordered.layers.map((layer) => layer.id)).toEqual([
      "second",
      "first",
    ]);
    expect(reordered.selectedLayerId).toBe("first");

    const duplicated = duplicateRasterLayer(reordered, "first", "copy");
    expect(duplicated.layers.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "second", name: "Second" },
      { id: "first", name: "Renamed" },
      { id: "copy", name: "Renamed copy" },
    ]);
    expect(duplicated.selectedLayerId).toBe("copy");
    expect(duplicated.layers[1]).not.toBe(duplicated.layers[2]);

    const removedCopy = removeRasterLayer(duplicated, "copy");
    expect(removedCopy.layers.map((layer) => layer.id)).toEqual([
      "second",
      "first",
    ]);
    expect(removedCopy.selectedLayerId).toBeNull();
    expect(removeRasterLayer(reordered, "second").selectedLayerId).toBe(
      "first",
    );
  });
});
