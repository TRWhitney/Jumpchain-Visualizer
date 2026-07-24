import { describe, expect, it } from "vitest";
import { createRasterEditorDocument } from "./assetEditorModel";
import {
  distinctAssetHistoryBytes,
  trimAssetWorkspaceHistory,
  type AssetWorkspaceHistoryState,
} from "./assetHistory";

const entry = (
  bytes: Uint8Array,
  raster = false,
): AssetWorkspaceHistoryState => ({
  files: {},
  assets: { "assets/pixel.png": bytes },
  assetEditorDocuments: raster
    ? {
        "assets/pixel.png": createRasterEditorDocument("png", bytes, 1, 1),
      }
    : {},
  trash: [],
});

describe("asset workspace history budget", () => {
  it("counts shared byte snapshots once", () => {
    const shared = new Uint8Array(10);
    expect(distinctAssetHistoryBytes([entry(shared), entry(shared)])).toBe(10);
  });

  it("trims oldest raster entries first and retains current and previous", () => {
    const states = [
      entry(new Uint8Array(8), false),
      entry(new Uint8Array(8), true),
      entry(new Uint8Array(8), false),
      entry(new Uint8Array(8), false),
    ];
    const trimmed = trimAssetWorkspaceHistory(states, 100, 24);
    expect(trimmed).toHaveLength(3);
    expect(trimmed).toEqual([states[0], states[2], states[3]]);
    expect(trimmed.at(-2)).toBe(states.at(-2));
    expect(trimmed.at(-1)).toBe(states.at(-1));
  });
});
