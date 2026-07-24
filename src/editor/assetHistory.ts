import type { AssetEditorDocument } from "./assetEditorModel";
import type { EditorTrashEntry } from "./model";

export type AssetWorkspaceHistoryState = {
  files: Record<string, string>;
  assets: Record<string, Uint8Array>;
  assetEditorDocuments: Record<string, AssetEditorDocument>;
  trash: EditorTrashEntry[];
};

const MAX_HISTORY_ENTRIES = 100;
const MAX_DISTINCT_ASSET_BYTES = 64 * 1024 * 1024;

export function distinctAssetHistoryBytes(
  entries: readonly AssetWorkspaceHistoryState[],
) {
  const seen = new Set<Uint8Array>();
  let bytes = 0;
  for (const entry of entries) {
    for (const value of Object.values(entry.assets))
      if (!seen.has(value)) {
        seen.add(value);
        bytes += value.byteLength;
      }
    for (const item of entry.trash)
      if (item.kind === "asset" && !seen.has(item.bytes)) {
        seen.add(item.bytes);
        bytes += item.bytes.byteLength;
      }
  }
  return bytes;
}

export function trimAssetWorkspaceHistory(
  entries: readonly AssetWorkspaceHistoryState[],
  maximumEntries = MAX_HISTORY_ENTRIES,
  maximumDistinctBytes = MAX_DISTINCT_ASSET_BYTES,
) {
  const next = entries.slice(-maximumEntries);
  while (
    next.length > 2 &&
    distinctAssetHistoryBytes(next) > maximumDistinctBytes
  ) {
    const rasterIndex = next
      .slice(0, -2)
      .findIndex((entry) =>
        Object.values(entry.assetEditorDocuments).some(
          (document) => document.kind === "raster",
        ),
      );
    next.splice(rasterIndex >= 0 ? rasterIndex : 0, 1);
  }
  return next;
}
