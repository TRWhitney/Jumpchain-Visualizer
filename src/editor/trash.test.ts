import { describe, expect, it } from "vitest";
import { Format1LanguageService } from "./languageService";
import { createStarterWorkspace } from "./model";
import {
  restoreAsset,
  restoreDeclaration,
  trashAsset,
  trashDeclaration,
} from "./trash";

const service = new Format1LanguageService();

describe("Editor trash commands", () => {
  it("moves a top-level declaration out of its file and restores it at the end", () => {
    const workspace = createStarterWorkspace("trash-declaration");
    const section = service
      .analyze(workspace.files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const trashed = trashDeclaration(
      workspace.files,
      section,
      "trash-section",
      "2026-07-22T00:00:00.000Z",
    );
    expect(trashed.changed).toBe(true);
    if (!trashed.changed) return;
    expect(trashed.value.entry).toMatchObject({
      kind: "declaration",
      declarationKind: "section",
      label: "introduction",
      originalFile: "jump.jdef",
    });
    expect(service.analyze(trashed.value.files).symbols).not.toContainEqual(
      expect.objectContaining({ kind: "section", handle: "introduction" }),
    );

    const changedFile = {
      ...trashed.value.files,
      "jump.jdef": `${trashed.value.files["jump.jdef"].trimEnd()}\n\n# changed after deletion\n`,
    };
    const restored = restoreDeclaration(changedFile, trashed.value.entry);
    expect(restored.changed).toBe(true);
    if (!restored.changed) return;
    expect(restored.value["jump.jdef"]).toContain("# changed after deletion");
    expect(service.analyze(restored.value).symbols).toContainEqual(
      expect.objectContaining({ kind: "section", handle: "introduction" }),
    );
  });

  it("rejects nested declarations and a missing original file", () => {
    const workspace = createStarterWorkspace("trash-nested");
    const text = service
      .analyze(workspace.files)
      .symbols.find((symbol) => symbol.kind === "text")!;
    expect(trashDeclaration(workspace.files, text, "nested", "now")).toEqual({
      changed: false,
      reason: "unsupported",
    });
    expect(
      restoreDeclaration(
        {},
        {
          id: "missing",
          kind: "declaration",
          declarationKind: "section",
          label: "intro",
          source: "section\n  handle: intro",
          originalFile: "missing.jdef",
          deletedAt: "now",
        },
      ),
    ).toEqual({ changed: false, reason: "missing-file" });
  });

  it("moves and restores asset bytes without overwriting a collision", () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const trashed = trashAsset(
      { "assets/pixel.png": bytes },
      "assets/pixel.png",
      "trash-asset",
      "2026-07-22T00:00:00.000Z",
    );
    expect(trashed.changed).toBe(true);
    if (!trashed.changed) return;
    expect(trashed.value.assets).toEqual({});
    expect(trashed.value.entry).toMatchObject({
      kind: "asset",
      label: "pixel.png",
      originalPath: "assets/pixel.png",
    });
    expect(restoreAsset({}, trashed.value.entry)).toEqual({
      changed: true,
      value: { "assets/pixel.png": bytes },
    });
    expect(
      restoreAsset(
        { "assets/pixel.png": Uint8Array.from([9]) },
        trashed.value.entry,
      ),
    ).toEqual({ changed: false, reason: "collision" });
  });
});
