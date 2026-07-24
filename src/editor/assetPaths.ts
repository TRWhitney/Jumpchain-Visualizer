import { parseFormatFile, type SourceNode } from "../markup";
import { assetArchivePath, assetRelativePath } from "../markup/assetPath";

export { assetArchivePath, assetRelativePath } from "../markup/assetPath";

const supportedAssetExtension = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export type AssetPathValidationCode =
  "empty" | "absolute" | "separator" | "segment" | "extension" | "collision";

export type AssetReference = {
  file: string;
  declarationFrom: number;
  valueFrom: number;
  valueTo: number;
};

export type AssetTreeFile = {
  kind: "file";
  archivePath: string;
  name: string;
};

export type AssetTreeFolder = {
  kind: "folder";
  path: string;
  name: string;
  children: AssetTreeEntry[];
};

export type AssetTreeEntry = AssetTreeFile | AssetTreeFolder;

const walk = (nodes: readonly SourceNode[]): SourceNode[] =>
  nodes.flatMap((node) => [node, ...walk(node.children)]);

const unquote = (value: string) =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;

export function assetBasename(archivePath: string) {
  return assetRelativePath(archivePath).split("/").at(-1) ?? "";
}

export function assetFolder(archivePath: string) {
  const parts = assetRelativePath(archivePath).split("/");
  parts.pop();
  return parts.join("/");
}

export function validateAssetRelativePath(
  relativePath: string,
  existingArchivePaths: readonly string[] = [],
  currentArchivePath?: string,
): AssetPathValidationCode | null {
  if (!relativePath) return "empty";
  if (/^(?:[a-z]:|\/)/i.test(relativePath)) return "absolute";
  if (relativePath.includes("\\") || relativePath.includes("\0"))
    return "separator";
  const segments = relativePath.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.trim() !== segment ||
        !/^[\p{L}\p{N}._ -]+$/u.test(segment) ||
        segment !== segment.normalize("NFC"),
    )
  )
    return "segment";
  if (!supportedAssetExtension.test(relativePath)) return "extension";
  const nextArchivePath = assetArchivePath(relativePath).toLocaleLowerCase();
  if (
    existingArchivePaths.some(
      (path) =>
        path !== currentArchivePath &&
        path.normalize("NFC").toLocaleLowerCase() === nextArchivePath,
    )
  )
    return "collision";
  return null;
}

export function assetReferences(
  files: Readonly<Record<string, string>>,
  relativePath: string,
): AssetReference[] {
  return Object.entries(files).flatMap(([file, source]) =>
    walk(parseFormatFile(file, source).tree).flatMap((node) => {
      if (node.kind !== "image") return [];
      return node.fields.flatMap((field) =>
        field.name === "src" && unquote(field.value) === relativePath
          ? [
              {
                file,
                declarationFrom: node.range.from,
                valueFrom: field.valueRange.from,
                valueTo: field.valueRange.to,
              },
            ]
          : [],
      );
    }),
  );
}

export function renameAssetReferences(
  files: Readonly<Record<string, string>>,
  fromRelativePath: string,
  toRelativePath: string,
) {
  const nextFiles = { ...files };
  for (const [file, source] of Object.entries(files)) {
    const replacements = assetReferences(
      { [file]: source },
      fromRelativePath,
    ).sort((left, right) => right.valueFrom - left.valueFrom);
    let nextSource = source;
    for (const replacement of replacements) {
      nextSource =
        nextSource.slice(0, replacement.valueFrom) +
        JSON.stringify(toRelativePath) +
        nextSource.slice(replacement.valueTo);
    }
    if (nextSource !== source) nextFiles[file] = nextSource;
  }
  return nextFiles;
}

export function buildAssetTree(archivePaths: readonly string[]) {
  type MutableFolder = {
    path: string;
    name: string;
    folders: Map<string, MutableFolder>;
    files: AssetTreeFile[];
  };
  const root: MutableFolder = {
    path: "",
    name: "",
    folders: new Map(),
    files: [],
  };
  for (const archivePath of [...archivePaths].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const parts = assetRelativePath(archivePath).split("/");
    const name = parts.pop();
    if (!name) continue;
    let folder = root;
    for (const part of parts) {
      const path = folder.path ? `${folder.path}/${part}` : part;
      let child = folder.folders.get(part);
      if (!child) {
        child = { path, name: part, folders: new Map(), files: [] };
        folder.folders.set(part, child);
      }
      folder = child;
    }
    folder.files.push({ kind: "file", archivePath, name });
  }
  const entries = (folder: MutableFolder): AssetTreeEntry[] => [
    ...[...folder.folders.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((child): AssetTreeFolder => ({
        kind: "folder",
        path: child.path,
        name: child.name,
        children: entries(child),
      })),
    ...folder.files.sort((left, right) => left.name.localeCompare(right.name)),
  ];
  return entries(root);
}
