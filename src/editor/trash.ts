import { removeDocumentDeclaration } from "./documentEditor";
import type { FormatSymbol } from "./languageService";
import type { EditorTrashAsset, EditorTrashDeclaration } from "./model";

export type TrashCommandResult<T> =
  | { changed: true; value: T }
  | {
      changed: false;
      reason: "collision" | "missing-file" | "missing-target" | "unsupported";
    };

export function trashDeclaration(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  id: string,
  deletedAt: string,
): TrashCommandResult<{
  files: Record<string, string>;
  entry: EditorTrashDeclaration;
}> {
  if (symbol.depth !== 0 || symbol.kind === "jump")
    return { changed: false, reason: "unsupported" };
  const source = files[symbol.file];
  if (source === undefined || symbol.from < 0 || symbol.to > source.length)
    return { changed: false, reason: "missing-target" };
  const removed = removeDocumentDeclaration(files, symbol);
  if (!removed.changed) return { changed: false, reason: "missing-target" };
  return {
    changed: true,
    value: {
      files: removed.files,
      entry: {
        id,
        kind: "declaration",
        declarationKind: symbol.kind,
        label: symbol.handle || symbol.kind.replaceAll("-", " "),
        source: source.slice(symbol.from, symbol.to).trimEnd(),
        originalFile: symbol.file,
        deletedAt,
      },
    },
  };
}

export function restoreDeclaration(
  files: Readonly<Record<string, string>>,
  entry: EditorTrashDeclaration,
): TrashCommandResult<Record<string, string>> {
  const original = files[entry.originalFile];
  if (original === undefined) return { changed: false, reason: "missing-file" };
  const prefix = original.trimEnd();
  return {
    changed: true,
    value: {
      ...files,
      [entry.originalFile]: `${prefix}${prefix ? "\n\n" : ""}${entry.source.trim()}\n`,
    },
  };
}

export function trashAsset(
  assets: Readonly<Record<string, Uint8Array>>,
  path: string,
  id: string,
  deletedAt: string,
): TrashCommandResult<{
  assets: Record<string, Uint8Array>;
  entry: EditorTrashAsset;
}> {
  const bytes = assets[path];
  if (!bytes) return { changed: false, reason: "missing-target" };
  const nextAssets = { ...assets };
  delete nextAssets[path];
  return {
    changed: true,
    value: {
      assets: nextAssets,
      entry: {
        id,
        kind: "asset",
        label: path.split("/").at(-1) ?? path,
        originalPath: path,
        bytes,
        deletedAt,
      },
    },
  };
}

export function restoreAsset(
  assets: Readonly<Record<string, Uint8Array>>,
  entry: EditorTrashAsset,
): TrashCommandResult<Record<string, Uint8Array>> {
  if (assets[entry.originalPath])
    return { changed: false, reason: "collision" };
  return {
    changed: true,
    value: { ...assets, [entry.originalPath]: entry.bytes },
  };
}
