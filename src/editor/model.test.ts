import { describe, expect, it } from "vitest";
import {
  canonicalWorkspace,
  createStarterWorkspace,
  filterEditorWorkspaces,
  hydrateEditorWorkspace,
  orderedEditorWorkspaces,
  summarizeWorkspace,
} from "./model";
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
});
