import {
  canonicalizePackage,
  sha256,
  type CanonicalJumpPackage,
  type PackageDiagnostic,
} from "../markup";

export const EDITOR_WORKSPACE_SCHEMA_VERSION = 1;

export type EditorProjectLocation = "browser" | "desktop" | "imported";

export type EditorWorkspaceSnapshot = {
  schemaVersion: 1;
  id: string;
  location: EditorProjectLocation;
  externalFolder?: string;
  files: Record<string, string>;
  assets: Record<string, Uint8Array>;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  revision: number;
};

export type EditorWorkspaceRevision = {
  workspaceId: string;
  revision: number;
  createdAt: string;
  reason: "autosave" | "explicit-save" | "recovery" | "import";
  files: Record<string, string>;
};

export type EditorExternalConflict = {
  workspaceId: string;
  file: string;
  editorSource: string;
  diskSource: string;
  detectedAt: string;
};

export type EditorWorkspaceSummary = {
  id: string;
  name: string;
  authors: readonly string[];
  version: string;
  nativeGauntlet: boolean;
  sectionCount: number;
  choiceCount: number;
  description: string;
  diagnostics: readonly PackageDiagnostic[];
  tags: readonly string[];
  starred: boolean;
  location: EditorProjectLocation;
  lastOpenedAt: string;
  updatedAt: string;
};

const display = (value: { base?: string; variants: readonly unknown[] }) =>
  value.base?.trim() || "Untitled Jump";

export function exactHashForFiles(files: Readonly<Record<string, string>>) {
  return sha256(
    Object.entries(files)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, source]) => `${file}\0${source}`)
      .join("\0"),
  );
}

export function canonicalWorkspace(
  workspace: Pick<EditorWorkspaceSnapshot, "id" | "files">,
): CanonicalJumpPackage {
  return canonicalizePackage({
    id: workspace.id,
    logicalId: workspace.id,
    source: "imported",
    exactHash: exactHashForFiles(workspace.files),
    files: workspace.files,
  });
}

export function summarizeWorkspace(
  workspace: EditorWorkspaceSnapshot,
): EditorWorkspaceSummary {
  const packageItem = canonicalWorkspace(workspace);
  return {
    id: workspace.id,
    name: display(packageItem.name),
    authors: packageItem.authors,
    version: packageItem.version || "—",
    nativeGauntlet: packageItem.nativeGauntlet,
    sectionCount: packageItem.sections.length,
    choiceCount: packageItem.choices.length,
    description: packageItem.description || "No Jump description yet.",
    diagnostics: packageItem.diagnostics,
    tags: packageItem.tags,
    starred: workspace.starred,
    location: workspace.location,
    lastOpenedAt: workspace.lastOpenedAt,
    updatedAt: workspace.updatedAt,
  };
}

export function orderedEditorWorkspaces(
  workspaces: readonly EditorWorkspaceSnapshot[],
) {
  return [...workspaces].sort(
    (left, right) =>
      Number(right.starred) - Number(left.starred) ||
      Date.parse(right.lastOpenedAt) - Date.parse(left.lastOpenedAt) ||
      summarizeWorkspace(left).name.localeCompare(
        summarizeWorkspace(right).name,
      ),
  );
}

export function filterEditorWorkspaces(
  workspaces: readonly EditorWorkspaceSnapshot[],
  query: string,
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return workspaces;
  return workspaces.filter((workspace) => {
    const summary = summarizeWorkspace(workspace);
    const searchable = [
      summary.name,
      ...summary.authors,
      summary.version,
      ...summary.tags,
      ...summary.diagnostics.flatMap((item) => [item.code, item.message]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function createStarterWorkspace(
  id: string = globalThis.crypto?.randomUUID?.() ?? `workspace-${Date.now()}`,
  now = new Date().toISOString(),
): EditorWorkspaceSnapshot {
  return {
    schemaVersion: EDITOR_WORKSPACE_SCHEMA_VERSION,
    id,
    location: "browser",
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Untitled Jump"
  description: "An untitled Jump."
  author: "Anonymous"
  version: "0.1"
  starting-points: 1000
  points-name: "Choice Points"
  points-abbreviation: "CP"

section
  handle: introduction
  name: "Introduction"

  text
    handle: welcome
    content:
      """
      Begin your Jump here. Use Structured editing for guided fields or Source for precise Format 1 markup.
      """
`,
      "choices.jdef": "# Choices are placed here by the Editor.\n",
      "layout.jdef": "# Layouts and themes are placed here by the Editor.\n",
    },
    assets: {},
    starred: false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    revision: 0,
  };
}

export function hydrateEditorWorkspace(
  value: unknown,
): EditorWorkspaceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<EditorWorkspaceSnapshot>;
  if (
    candidate.schemaVersion !== EDITOR_WORKSPACE_SCHEMA_VERSION ||
    typeof candidate.id !== "string" ||
    !candidate.files ||
    typeof candidate.files !== "object" ||
    !["browser", "desktop", "imported"].includes(candidate.location ?? "")
  )
    return null;
  const now = new Date().toISOString();
  return {
    schemaVersion: EDITOR_WORKSPACE_SCHEMA_VERSION,
    id: candidate.id,
    location: candidate.location!,
    externalFolder:
      typeof candidate.externalFolder === "string"
        ? candidate.externalFolder
        : undefined,
    files: Object.fromEntries(
      Object.entries(candidate.files).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    assets:
      candidate.assets && typeof candidate.assets === "object"
        ? Object.fromEntries(
            Object.entries(
              candidate.assets as unknown as Record<string, unknown>,
            ).flatMap(([path, value]) => {
              if (value instanceof Uint8Array) return [[path, value]];
              if (
                Array.isArray(value) &&
                value.every(
                  (byte: unknown) =>
                    typeof byte === "number" &&
                    Number.isInteger(byte) &&
                    byte >= 0 &&
                    byte <= 255,
                )
              )
                return [[path, Uint8Array.from(value)]];
              return [];
            }),
          )
        : {},
    starred: Boolean(candidate.starred),
    createdAt:
      typeof candidate.createdAt === "string" ? candidate.createdAt : now,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
    lastOpenedAt:
      typeof candidate.lastOpenedAt === "string" ? candidate.lastOpenedAt : now,
    revision:
      typeof candidate.revision === "number" && candidate.revision >= 0
        ? Math.trunc(candidate.revision)
        : 0,
  };
}
