import { describe, expect, it } from "vitest";
import { parseFormatFile } from "../markup";
import type { FormatSymbol } from "./languageService";
import {
  collapseLayoutLeaf,
  convertLayoutNode,
  createLayoutEditorTree,
  expandLayoutLeaf,
  insertLayoutChild,
  insertLayoutRoot,
  layoutAllowedNodeKinds,
  layoutContentTargetHandles,
  layoutNodeHasEditableFields,
  layoutNodeForPath,
  layoutNodeSourceSelection,
  layoutSelectionKey,
  layoutSlotTargets,
  moveLayoutNode,
  removeLayoutNode,
  reorderLayoutNode,
  setLayoutNodeTarget,
} from "./layoutEditor";

const layoutSource = `section-layout
  handle: section_page

  stack
    gap: md
    slot: name

    grid
      columns: 2
      text: introduction

      stack
        image: banner

    rule
`;

const files = (layout = layoutSource): Record<string, string> => ({
  "layout.jdef": layout,
});

const layout: FormatSymbol = {
  kind: "section-layout",
  handle: "section_page",
  file: "layout.jdef",
  from: 0,
  to: layoutSource.length,
  depth: 0,
};

const treeFor = (nextFiles: Readonly<Record<string, string>> = files()) =>
  createLayoutEditorTree(nextFiles, layout)!;

const node = (
  tree: NonNullable<ReturnType<typeof createLayoutEditorTree>>,
  path: string,
) => Object.values(tree.nodes).find((candidate) => candidate.path === path)!;

const structuralErrors = (source: string) =>
  parseFormatFile("layout.jdef", source).diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );

describe("schema-driven layout editor", () => {
  it("gives each handled layout a stable container-memory identity", () => {
    expect(layoutSelectionKey(layout)).toBe(
      layoutSelectionKey({ ...layout, from: 420 }),
    );
    expect(layoutSelectionKey(layout)).not.toBe(
      layoutSelectionKey({ ...layout, handle: "alternate_page" }),
    );
    expect(layoutSelectionKey({ ...layout, handle: undefined, from: 12 })).toBe(
      "layout.jdef\u0000section-layout\u0000@12",
    );
  });

  it.each([
    ["stack[1]", "stack"],
    ["stack[1]/slot[1]", "slot"],
    ["stack[1]/grid[2]", "grid"],
    ["stack[1]/grid[2]/text[1]", "text"],
  ])("maps preview path %s to its exact authored keyword", (path, keyword) => {
    const tree = treeFor();
    expect(layoutNodeForPath(tree, path)?.kind).toBe(keyword);
    const selection = layoutNodeSourceSelection(tree, path);
    expect(selection).not.toBeNull();
    expect(files()[selection!.file].slice(selection!.from, selection!.to)).toBe(
      keyword,
    );
  });

  it("merges compact fields and block nodes in exact source order", () => {
    const tree = treeFor();
    const root = tree.nodes[tree.rootId!];
    expect(root.path).toBe("stack[1]");
    expect(root.childIds.map((id) => tree.nodes[id].kind)).toEqual([
      "slot",
      "grid",
      "rule",
    ]);
    expect(tree.nodes[root.childIds[0]]).toMatchObject({
      compact: true,
      target: "name",
      path: "stack[1]/slot[1]",
    });
    const grid = tree.nodes[root.childIds[1]];
    expect(grid.childIds.map((id) => tree.nodes[id].kind)).toEqual([
      "text",
      "stack",
    ]);
    expect(tree.structurallySafe).toBe(true);
  });

  it("publishes the complete node and slot matrix from the schema", () => {
    expect(layoutAllowedNodeKinds("section-layout")).toEqual([
      "stack",
      "inline",
      "wrap",
      "grid",
      "slot",
      "text",
      "image",
      "rule",
      "choice",
      "expand",
    ]);
    expect(layoutAllowedNodeKinds("choice-layout")).toEqual([
      "stack",
      "inline",
      "wrap",
      "grid",
      "slot",
      "text",
      "image",
      "input",
      "rule",
    ]);
    expect(layoutAllowedNodeKinds("trait-layout")).toEqual([
      "stack",
      "inline",
      "wrap",
      "grid",
      "slot",
      "text",
      "image",
      "rule",
    ]);
    expect(layoutSlotTargets("section-layout")).toEqual(["name", "roll"]);
    expect(layoutSlotTargets("choice-layout")).toEqual([
      "name",
      "cost",
      "control",
      "roll",
      "tags",
    ]);
    expect(layoutSlotTargets("trait-layout")).toEqual(["name"]);
  });

  it("exposes editable fields only for node kinds that define them", () => {
    expect(layoutNodeHasEditableFields("choice")).toBe(true);
    expect(layoutNodeHasEditableFields("rule")).toBe(true);
    expect(layoutNodeHasEditableFields("not-a-layout-node")).toBe(false);
  });

  it("scopes content target handles to section, choice, and trait owners", () => {
    const contentFiles = {
      "content.jdef": `section
  handle: section_owner
  name: "Section owner"

  text
    handle: section_text
    content: "Section"

  image
    handle: section_image
    src: "section.png"
    alt: "Section"

choice
  handle: choice_owner
  name: "Choice owner"
  selection: toggle

  text
    handle: choice_text
    content: "Choice"

  input
    handle: choice_input
    selection: text

  grant
    kind: trait

    text
      handle: trait_text
      content: "Trait"

    image
      handle: trait_image
      src: "trait.png"
      alt: "Trait"
`,
    };

    expect(
      layoutContentTargetHandles(contentFiles, "section-layout", "text"),
    ).toEqual(["section_text"]);
    expect(
      layoutContentTargetHandles(contentFiles, "choice-layout", "text"),
    ).toEqual(["choice_text"]);
    expect(
      layoutContentTargetHandles(contentFiles, "choice-layout", "input"),
    ).toEqual(["choice_input"]);
    expect(
      layoutContentTargetHandles(contentFiles, "trait-layout", "text"),
    ).toEqual(["trait_text"]);
    expect(
      layoutContentTargetHandles(contentFiles, "trait-layout", "image"),
    ).toEqual(["trait_image"]);
    expect(
      layoutContentTargetHandles(contentFiles, "trait-layout", "input"),
    ).toEqual([]);
  });

  it("inserts only legal children into the selected container", () => {
    const tree = treeFor();
    const root = tree.nodes[tree.rootId!];
    const inserted = insertLayoutChild(files(), layout, root, "slot", {
      target: "roll",
    });
    expect(inserted.changed).toBe(true);
    expect(inserted.files["layout.jdef"]).toContain("    slot: roll");
    expect(
      treeFor(inserted.files).nodes[treeFor(inserted.files).rootId!].childIds,
    ).toHaveLength(4);
    expect(structuralErrors(inserted.files["layout.jdef"])).toEqual([]);

    const grid = insertLayoutChild(files(), layout, root, "grid");
    expect(grid.files["layout.jdef"]).toContain("    grid\n      columns: 2");
    expect(
      insertLayoutChild(files(), layout, root, "input", { target: "x" }),
    ).toMatchObject({ changed: false, reason: "invalid-target" });
    expect(
      insertLayoutChild(files(), layout, root, "slot", { target: "cost" }),
    ).toMatchObject({ changed: false, reason: "invalid-target" });
  });

  it("reorders complete sibling subtrees without changing unrelated bytes", () => {
    const tree = treeFor();
    const grid = node(tree, "stack[1]/grid[2]");
    const result = reorderLayoutNode(files(), layout, grid, "up");
    expect(result.changed).toBe(true);
    const next = treeFor(result.files);
    expect(
      next.nodes[next.rootId!].childIds.map((id) => next.nodes[id].kind),
    ).toEqual(["grid", "slot", "rule"]);
    expect(result.files["layout.jdef"]).toContain(
      "grid\n      columns: 2\n      text: introduction",
    );
    expect(structuralErrors(result.files["layout.jdef"])).toEqual([]);
    expect(
      reorderLayoutNode(result.files, layout, result.target!, "up"),
    ).toMatchObject({ changed: false, reason: "no-change" });
  });

  it("moves nodes only to non-descendant containers and appends there", () => {
    const tree = treeFor();
    const slot = node(tree, "stack[1]/slot[1]");
    const grid = node(tree, "stack[1]/grid[2]");
    const moved = moveLayoutNode(files(), layout, slot, grid);
    expect(moved.changed).toBe(true);
    const next = treeFor(moved.files);
    const nextGrid = Object.values(next.nodes).find(
      (candidate) => candidate.kind === "grid",
    )!;
    expect(nextGrid.childIds.map((id) => next.nodes[id].kind)).toEqual([
      "text",
      "stack",
      "slot",
    ]);
    expect(moved.files["layout.jdef"]).toContain("      slot: name");
    expect(structuralErrors(moved.files["layout.jdef"])).toEqual([]);

    const originalGrid = node(tree, "stack[1]/grid[2]");
    const nested = node(tree, "stack[1]/grid[2]/stack[2]");
    expect(moveLayoutNode(files(), layout, originalGrid, nested)).toMatchObject(
      { changed: false, reason: "invalid-target" },
    );
  });

  it("promotes a removed container's children at the same source position", () => {
    const source = layoutSource.replace(
      "    grid\n",
      "    # content group\n    grid\n",
    );
    const tree = treeFor(files(source));
    const grid = Object.values(tree.nodes).find(
      (candidate) => candidate.kind === "grid",
    )!;
    const removed = removeLayoutNode(files(source), layout, grid);
    expect(removed.changed).toBe(true);
    expect(removed.files["layout.jdef"]).not.toContain("columns: 2");
    expect(removed.files["layout.jdef"]).toContain("    text: introduction");
    expect(removed.files["layout.jdef"]).toContain(
      "    stack\n      image: banner",
    );
    expect(removed.files["layout.jdef"]).toContain("# content group");
    expect(structuralErrors(removed.files["layout.jdef"])).toEqual([]);
    expect(
      removeLayoutNode(files(), layout, tree.nodes[tree.rootId!]),
    ).toMatchObject({ changed: false, reason: "invalid-target" });
  });

  it("converts container flow while maintaining grid requirements", () => {
    const tree = treeFor();
    const nested = node(tree, "stack[1]/grid[2]/stack[2]");
    const grid = convertLayoutNode(files(), layout, nested, "grid");
    expect(grid.changed).toBe(true);
    expect(grid.files["layout.jdef"]).toContain(
      "      grid\n        columns: 2\n        image: banner",
    );
    const inline = convertLayoutNode(
      grid.files,
      layout,
      grid.target!,
      "inline",
    );
    expect(inline.changed).toBe(true);
    expect(inline.files["layout.jdef"]).toContain(
      "      inline\n        image: banner",
    );
    expect(inline.files["layout.jdef"]).not.toContain("        columns: 2");
    expect(structuralErrors(inline.files["layout.jdef"])).toEqual([]);
  });

  it("round-trips compact leaves through block presentation form", () => {
    const tree = treeFor();
    const text = node(tree, "stack[1]/grid[2]/text[1]");
    const expanded = expandLayoutLeaf(files(), layout, text);
    expect(expanded.changed).toBe(true);
    expect(expanded.files["layout.jdef"]).toContain(
      "      text\n        target: introduction",
    );
    const collapsed = collapseLayoutLeaf(
      expanded.files,
      layout,
      expanded.target!,
    );
    expect(collapsed.changed).toBe(true);
    expect(collapsed.files["layout.jdef"]).toContain(
      "      text: introduction",
    );
    expect(structuralErrors(collapsed.files["layout.jdef"])).toEqual([]);
  });

  it("round-trips direct choices through alignable block presentation", () => {
    const source = `section-layout
  handle: section_page

  inline
    choice: age
    choice: location
`;
    const symbol = { ...layout, to: source.length };
    const initial = createLayoutEditorTree(files(source), symbol)!;
    const location = node(initial, "inline[1]/choice[2]");
    const expanded = expandLayoutLeaf(files(source), symbol, {
      file: location.file,
      from: location.from,
      kind: location.kind,
      compact: location.compact,
    });
    expect(expanded.changed).toBe(true);
    expect(expanded.files["layout.jdef"]).toContain(
      "    choice\n      target: location",
    );
    const alignedFiles = files(
      expanded.files["layout.jdef"].replace(
        "      target: location",
        "      target: location\n      align: end",
      ),
    );
    const alignedTree = createLayoutEditorTree(alignedFiles, symbol)!;
    expect(node(alignedTree, "inline[1]/choice[2]").fieldNames).toEqual([
      "target",
      "align",
    ]);
    expect(structuralErrors(alignedFiles["layout.jdef"])).toEqual([]);
  });

  it("models every container and leaf presentation field with repeated targets", () => {
    const source = `choice-layout
  handle: card

  grid
    columns: 12
    gap: xl
    padding: sm
    background: surface
    align: center
    justify: between
    text-align: end
    text-size: lg
    text-color: primary

    image
      target: portrait
      padding: xs
      background: surface
      align: end
      text-align: center
      text-size: sm
      text-color: primary
      width: xl
      height: lg
      fit: cover

    image: portrait
`;
    const symbol = { ...layout, kind: "choice-layout", to: source.length };
    const tree = createLayoutEditorTree(files(source), symbol)!;
    const root = tree.nodes[tree.rootId!];
    expect(root.fieldNames).toEqual([
      "columns",
      "gap",
      "padding",
      "background",
      "align",
      "justify",
      "text-align",
      "text-size",
      "text-color",
    ]);
    const images = root.childIds.map((id) => tree.nodes[id]);
    expect(images).toHaveLength(2);
    expect(images.map((image) => image.target)).toEqual([
      "portrait",
      "portrait",
    ]);
    expect(images[0].fieldNames).toEqual([
      "target",
      "padding",
      "background",
      "align",
      "text-align",
      "text-size",
      "text-color",
      "width",
      "height",
      "fit",
    ]);
    expect(images[1].compact).toBe(true);
  });

  it.each([
    ["section-layout", "choice", "featured"],
    ["section-layout", "expand", undefined],
    ["choice-layout", "input", "quantity"],
    ["trait-layout", "image", "portrait"],
  ] as const)(
    "inserts the production-only %s %s capability without touching other files",
    (layoutKind, kind, target) => {
      const source = `${layoutKind}\n  handle: example\n\n  stack\n`;
      const symbol = { ...layout, kind: layoutKind, to: source.length };
      const nextFiles = { ...files(source), "notes.txt": "unchanged\n" };
      const tree = createLayoutEditorTree(nextFiles, symbol)!;
      const result = insertLayoutChild(
        nextFiles,
        symbol,
        tree.nodes[tree.rootId!],
        kind,
        target ? { target } : {},
      );
      expect(result.changed).toBe(true);
      expect(result.files["notes.txt"]).toBe("unchanged\n");
      expect(structuralErrors(result.files["layout.jdef"])).toEqual([]);
    },
  );

  it("creates a missing root and rejects stale, unsafe, and illegal targets", () => {
    const source = `trait-layout
  handle: trait_card
`;
    const symbol = { ...layout, kind: "trait-layout", to: source.length };
    const rooted = insertLayoutRoot(files(source), symbol, "grid");
    expect(rooted.changed).toBe(true);
    expect(rooted.files["layout.jdef"]).toContain("  grid\n    columns: 2");

    const tree = createLayoutEditorTree(rooted.files, symbol)!;
    const root = tree.nodes[tree.rootId!];
    const slot = insertLayoutChild(rooted.files, symbol, root, "slot", {
      target: "name",
    });
    expect(slot.changed).toBe(true);
    const invalidAuthoredTarget = setLayoutNodeTarget(
      slot.files,
      symbol,
      slot.target!,
      "cost",
    );
    expect(invalidAuthoredTarget.changed).toBe(true);
    expect(invalidAuthoredTarget.files["layout.jdef"]).toContain("slot: cost");
    expect(
      reorderLayoutNode(
        slot.files,
        symbol,
        { ...slot.target!, from: 99_999 },
        "up",
      ),
    ).toMatchObject({ changed: false, reason: "invalid-target" });

    const unsafeSource = `${source}\n  stack\n\n  grid\n    columns: 2\n`;
    const unsafeFiles = files(unsafeSource);
    const unsafeTree = createLayoutEditorTree(unsafeFiles, symbol)!;
    expect(unsafeTree.structurallySafe).toBe(false);
    expect(
      insertLayoutChild(
        unsafeFiles,
        symbol,
        unsafeTree.nodes[unsafeTree.rootId!],
        "slot",
        { target: "name" },
      ),
    ).toMatchObject({ changed: false, reason: "invalid-target" });
  });
});
