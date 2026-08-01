import { describe, expect, it } from "vitest";
import {
  canonicalWorkspace,
  createStarterWorkspace,
  filterEditorWorkspaces,
  hydrateEditorWorkspace,
  orderedEditorWorkspaces,
  summarizeWorkspace,
} from "./model";
import { createRasterEditorDocument } from "./assetEditorModel";
import { stringifyBinaryJson } from "./binaryJson";
import { MemoryEditorWorkspaceRepository } from "./repository";

describe("Editor workspaces", () => {
  it("creates a schema-valid Anonymous 0.1 starter with an Introduction", () => {
    const workspace = createStarterWorkspace(
      "workspace-one",
      "2026-01-01T00:00:00Z",
    );
    const packageItem = canonicalWorkspace(workspace);
    expect(packageItem.name.base).toBe("Untitled Jump");
    expect(packageItem.authors).toEqual(["Anonymous"]);
    expect(packageItem.version).toBe("0.1");
    expect(packageItem.sections.map((section) => section.name.base)).toEqual([
      "Introduction",
    ]);
    expect(summarizeWorkspace(workspace).description).toBe("An untitled Jump.");
    expect(
      packageItem.diagnostics.filter((item) => item.severity === "error"),
    ).toEqual([]);
  });

  it("orders starred projects first and searches canonical metadata and diagnostics", () => {
    const older = createStarterWorkspace("older", "2026-01-01T00:00:00Z");
    const newer = {
      ...createStarterWorkspace("newer", "2026-01-02T00:00:00Z"),
      starred: true,
      files: {
        "jump.jdef": createStarterWorkspace().files["jump.jdef"].replace(
          'name: "Untitled Jump"',
          'name: "Sky Roads"',
        ),
      },
    };
    expect(
      orderedEditorWorkspaces([older, newer]).map((item) => item.id),
    ).toEqual(["newer", "older"]);
    expect(filterEditorWorkspaces([older, newer], "sky anonymous")).toEqual([
      newer,
    ]);
    expect(summarizeWorkspace(newer)).toMatchObject({
      name: "Sky Roads",
      authors: ["Anonymous"],
      starred: true,
    });
  });

  it("round-trips snapshots through the repository", async () => {
    const repository = new MemoryEditorWorkspaceRepository();
    const workspace = createStarterWorkspace("round-trip");
    await repository.save(workspace);
    expect(await repository.list()).toEqual([workspace]);
    expect(await repository.load(workspace.id)).toEqual(workspace);
    await repository.remove(workspace.id);
    expect(await repository.load(workspace.id)).toBeNull();
  });

  it("hydrates native JSON asset arrays into bounded byte values", () => {
    const workspace = createStarterWorkspace("native-assets");
    const hydrated = hydrateEditorWorkspace({
      ...workspace,
      assets: { "assets/pixel.png": [137, 80, 78, 71] },
    });
    expect(hydrated?.assets["assets/pixel.png"]).toBeInstanceOf(Uint8Array);
    expect([...hydrated!.assets["assets/pixel.png"]]).toEqual([
      137, 80, 78, 71,
    ]);
  });

  it("hydrates compact desktop JSON assets and raster sidecars", () => {
    const workspace = createStarterWorkspace("desktop-assets");
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    workspace.assets["assets/pixel.png"] = bytes;
    workspace.assetEditorDocuments["assets/pixel.png"] =
      createRasterEditorDocument("png", bytes, 1, 1);
    const hydrated = hydrateEditorWorkspace(
      JSON.parse(stringifyBinaryJson(workspace)) as unknown,
    );
    expect(hydrated?.assets["assets/pixel.png"]).toEqual(bytes);
    expect(hydrated?.assetEditorDocuments["assets/pixel.png"]).toMatchObject({
      kind: "raster",
      baseBytes: bytes,
    });
  });

  it("hydrates recoverable Trash entries without exposing malformed paths", () => {
    const workspace = createStarterWorkspace("native-trash");
    const hydrated = hydrateEditorWorkspace({
      ...workspace,
      trash: [
        {
          id: "deleted-section",
          kind: "declaration",
          declarationKind: "section",
          label: "introduction",
          source: "section\n  handle: introduction",
          originalFile: "jump.jdef",
          deletedAt: "2026-07-22T00:00:00.000Z",
        },
        {
          id: "deleted-image",
          kind: "asset",
          label: "pixel.png",
          originalPath: "assets/images/pixel.png",
          bytes: [1, 2, 3],
          deletedAt: "2026-07-22T00:00:00.000Z",
        },
        {
          id: "unsafe-image",
          kind: "asset",
          label: "unsafe.png",
          originalPath: "../unsafe.png",
          bytes: [1],
          deletedAt: "2026-07-22T00:00:00.000Z",
        },
      ],
    });
    expect(hydrated?.trash).toHaveLength(2);
    expect(hydrated?.trash[1]).toMatchObject({
      kind: "asset",
      originalPath: "assets/images/pixel.png",
    });
    expect(
      hydrated?.trash[1]?.kind === "asset"
        ? [...hydrated.trash[1].bytes]
        : null,
    ).toEqual([1, 2, 3]);
  });

  it("hydrates valid editor sidecars and discards corrupt metadata without losing asset bytes", () => {
    const workspace = createStarterWorkspace("editor-sidecars");
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    const document = createRasterEditorDocument("png", bytes, 1, 1);
    const hydrated = hydrateEditorWorkspace({
      ...workspace,
      assets: {
        "assets/valid.png": [...bytes],
        "assets/corrupt.png": [...bytes],
      },
      assetEditorDocuments: {
        "assets/valid.png": document,
        "assets/corrupt.png": { ...document, baseWidth: 100_000 },
      },
    });
    expect(hydrated?.assetEditorDocuments["assets/valid.png"]).toMatchObject({
      kind: "raster",
      baseWidth: 1,
    });
    expect(
      hydrated?.assetEditorDocuments["assets/corrupt.png"],
    ).toBeUndefined();
    expect(hydrated?.assets["assets/corrupt.png"]).toEqual(bytes);
  });
});
