import { describe, expect, it } from "vitest";
import { Format1LanguageService } from "./languageService";
import {
  addDocumentField,
  createAndAssignDocumentResource,
  declarationFieldNames,
  fieldDefault,
  fieldDefinition,
  insertDocumentChild,
  moveDocumentChild,
  quickAddFieldMode,
  readConditionalSourceFieldGroups,
  readConditionalSourceFields,
  readSourceField,
  setConditionalDocumentField,
  setDocumentField,
  removeDocumentDeclaration,
  structuredContext,
} from "./documentEditor";

const source = `jump
  format: 1
  name: "Test"
  author: "Author"
  version: "1"

section
  handle: introduction
  name: "Introduction"
`;

describe("Format 1 structured document edits", () => {
  const service = new Format1LanguageService();

  it("identifies every static omission default without treating format as defaulted", () => {
    expect(
      [
        ["jump", "gauntlet"],
        ["jump", "starting-points"],
        ["jump", "points-name"],
        ["jump", "points-abbreviation"],
        ["resource", "initial"],
        ["choice-source", "mode"],
        ["choice-source", "resolution"],
        ["choice", "selection"],
        ["choice", "resolution"],
        ["cost", "mode"],
      ].map(([kind, field]) => [kind, field, fieldDefault(kind, field)]),
    ).toEqual([
      ["jump", "gauntlet", { kind: "value", value: false }],
      ["jump", "starting-points", { kind: "value", value: 1000 }],
      ["jump", "points-name", { kind: "value", value: "Choice Points" }],
      ["jump", "points-abbreviation", { kind: "value", value: "CP" }],
      ["resource", "initial", { kind: "value", value: 0 }],
      ["choice-source", "mode", { kind: "value", value: "multi" }],
      ["choice-source", "resolution", { kind: "value", value: "manual" }],
      ["choice", "selection", { kind: "value", value: "toggle" }],
      ["choice", "resolution", { kind: "value", value: "manual" }],
      ["cost", "mode", { kind: "value", value: "flat" }],
    ]);
    expect(fieldDefault("jump", "format")).toBeNull();
    expect(fieldDefault("choice", "continuity")).toBeNull();
    expect(
      fieldDefault("jump", "starting-points", { gauntlet: "true" }),
    ).toEqual({ kind: "value", value: 0 });
    expect(
      fieldDefault("choice", "measure", {
        integerVisibleGrant: "true",
      }),
    ).toEqual({ kind: "value", value: "rank" });
    expect(
      fieldDefault("grant", "measure", {
        integerVisibleGrant: "true",
      }),
    ).toEqual({ kind: "value", value: "rank" });
    expect(fieldDefault("input", "min", { selection: "companions" })).toEqual({
      kind: "value",
      value: 0,
    });
    expect(fieldDefault("input", "min", { selection: "integer" })).toBeNull();
  });

  it("identifies built-in section, choice, and trait layout fallbacks", () => {
    expect(fieldDefault("jump", "section-layout")).toEqual({
      kind: "built-in-layout",
      layout: "section",
    });
    expect(fieldDefault("section", "layout")).toEqual({
      kind: "built-in-layout",
      layout: "section",
    });
    expect(fieldDefault("jump", "choice-layout")).toEqual({
      kind: "built-in-layout",
      layout: "choice",
    });
    expect(fieldDefault("choice", "layout")).toEqual({
      kind: "built-in-layout",
      layout: "choice",
    });
    expect(fieldDefault("jump", "trait-layout")).toEqual({
      kind: "built-in-layout",
      layout: "trait",
    });
    expect(fieldDefault("grant", "layout")).toBeNull();
    expect(fieldDefault("grant", "layout", { grantKind: "trait" })).toEqual({
      kind: "built-in-layout",
      layout: "trait",
    });
    expect(
      fieldDefault("section", "layout", {
        sectionLayout: "authored_section",
      }),
    ).toEqual({ kind: "value", value: "authored_section" });
  });

  it("clears an optional field without consuming the adjacent handle", () => {
    const files = { "jump.jdef": source };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const withLayout = setDocumentField(
      files,
      section,
      "layout",
      "temporary_layout",
    );
    const current = service
      .analyze(withLayout.files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const cleared = setDocumentField(withLayout.files, current, "layout", "");

    expect(cleared.files["jump.jdef"]).not.toContain("layout:");
    expect(cleared.files["jump.jdef"]).toContain("  handle: introduction");
    expect(readSourceField(cleared.files["jump.jdef"], current, "layout")).toBe(
      "",
    );
  });

  it("changes only the selected value range", () => {
    const files = { "jump.jdef": source };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const changed = setDocumentField(files, section, "name", "Rewritten");

    expect(changed.files["jump.jdef"]).toBe(
      source.replace('name: "Introduction"', 'name: "Rewritten"'),
    );
  });

  it("keeps required empty strings syntactically isolated", () => {
    const files = { "jump.jdef": source };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const changed = setDocumentField(files, section, "name", "");

    expect(changed.files["jump.jdef"]).toContain('  name: ""');
    expect(changed.files["jump.jdef"]).toContain("  handle: introduction");
  });

  it("does not hide an unmatched quote from invalid authored source", () => {
    const invalid = source.replace('name: "Introduction"', 'name: "Incomplete');
    const files = { "jump.jdef": invalid };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;

    expect(readSourceField(invalid, section, "name")).toBe('"Incomplete');
  });

  it("adds repeated authors without rewriting the existing occurrence", () => {
    const files = { "jump.jdef": source };
    const jump = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    const changed = addDocumentField(files, jump, "author");

    expect(changed.files["jump.jdef"]).toContain('  author: "Author"');
    expect(changed.files["jump.jdef"].match(/author:/g)).toHaveLength(2);
  });

  it("returns an editing selection inside quotes or over a scalar starter", () => {
    const files = { "jump.jdef": 'jump\n  name: "Test"\n' };
    const jump = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    const author = addDocumentField(files, jump, "author");
    expect(author.selection).toBeDefined();
    expect(
      author.files["jump.jdef"].slice(
        author.selection!.from,
        author.selection!.to,
      ),
    ).toBe("");
    expect(
      author.files["jump.jdef"].slice(
        author.selection!.from - 1,
        author.selection!.to + 1,
      ),
    ).toBe('""');

    const format = addDocumentField(files, jump, "format");
    expect(format.selection).toBeDefined();
    expect(
      format.files["jump.jdef"].slice(
        format.selection!.from,
        format.selection!.to,
      ),
    ).toBe("1");
  });

  it("targets an existing empty required field without inserting a duplicate", () => {
    const files = {
      "jump.jdef": source.replace('version: "1"', 'version: ""'),
    };
    const jump = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    const version = addDocumentField(files, jump, "version");

    expect(quickAddFieldMode(files["jump.jdef"], jump, "version")).toBe(
      "complete",
    );
    expect(version.changed).toBe(false);
    expect(version.selection).toBeDefined();
    expect(version.files["jump.jdef"].match(/version:/g)).toHaveLength(1);
    expect(
      version.files["jump.jdef"].slice(
        version.selection!.from,
        version.selection!.to,
      ),
    ).toBe("");

    const completedFiles = {
      "jump.jdef": files["jump.jdef"].replace('version: ""', 'version: "1"'),
    };
    const completedJump = service
      .analyze(completedFiles)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    expect(
      quickAddFieldMode(completedFiles["jump.jdef"], completedJump, "version"),
    ).toBeNull();
  });

  it("updates one conditional value and condition by their exact ranges", () => {
    const conditional = `${source}\ntext\n  handle: premise\n  content: "Base"\n  content when actor.level > 2: "Advanced"\n`;
    const files = { "jump.jdef": conditional };
    const text = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "text")!;
    const changed = setConditionalDocumentField(
      files,
      text,
      "content",
      0,
      "actor.level > 3",
      "Expert",
    );

    expect(changed.files["jump.jdef"]).toBe(
      conditional.replace(
        'content when actor.level > 2: "Advanced"',
        'content when actor.level > 3: "Expert"',
      ),
    );
    expect(
      readConditionalSourceFields(changed.files["jump.jdef"], text, "content"),
    ).toEqual([{ condition: "actor.level > 3", value: "Expert" }]);
  });

  it("associates repeated option variants with the selected base occurrence", () => {
    const conditional = `${source}\nchoice\n  handle: select\n  name: "Select"\n  selection: select\n  option: "First"\n  option: "Second"\n`;
    const files = { "jump.jdef": conditional };
    const choice = service
      .analyze(files)
      .symbols.find(
        (symbol) => symbol.kind === "choice" && symbol.handle === "select",
      )!;
    const changed = setConditionalDocumentField(
      files,
      choice,
      "option",
      0,
      "route = true",
      "Conditional first",
      0,
    );
    expect(changed.files["jump.jdef"].indexOf("option when")).toBeLessThan(
      changed.files["jump.jdef"].indexOf('option: "Second"'),
    );
    expect(
      readConditionalSourceFieldGroups(
        changed.files["jump.jdef"],
        choice,
        "option",
      ),
    ).toEqual([
      {
        baseOccurrence: 0,
        occurrence: 0,
        condition: "route = true",
        value: "Conditional first",
      },
    ]);
  });

  it("replaces a fenced rich-text extent without leaving its old fence", () => {
    const fenced = `${source}\ntext\n  handle: premise\n  content:\n    """\n    First line\n    Second line\n    """\n`;
    const files = { "jump.jdef": fenced };
    const text = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "text")!;
    const changed = setDocumentField(
      files,
      text,
      "content",
      "Replaced first\nReplaced second",
    );

    expect(changed.files["jump.jdef"].match(/"""/g)).toHaveLength(2);
    expect(changed.files["jump.jdef"]).not.toContain("First line");
    expect(changed.files["jump.jdef"]).toContain("    Replaced first");
    expect(changed.files["jump.jdef"]).toContain("    Replaced second");
  });

  it("quotes Structured hex colors while leaving color tokens bare", () => {
    const files = {
      "layout.jdef": `theme
  handle: accent
  color: "#123456"

section-layout
  handle: main

  stack
    gap: md
`,
    };
    const symbols = service.analyze(files).symbols;
    const theme = symbols.find((symbol) => symbol.kind === "theme")!;
    const themeChanged = setDocumentField(files, theme, "color", "#A1B2C3");
    expect(themeChanged.files["layout.jdef"]).toContain('color: "#A1B2C3"');
    expect(
      readSourceField(
        themeChanged.files["layout.jdef"],
        service
          .analyze(themeChanged.files)
          .symbols.find((symbol) => symbol.kind === "theme")!,
        "color",
      ),
    ).toBe("#A1B2C3");

    const stack = service
      .analyze(themeChanged.files)
      .symbols.find((symbol) => symbol.kind === "stack")!;
    const hexChanged = setDocumentField(
      themeChanged.files,
      stack,
      "background",
      "#445566",
    );
    expect(hexChanged.files["layout.jdef"]).toContain('background: "#445566"');
    const currentStack = service
      .analyze(hexChanged.files)
      .symbols.find((symbol) => symbol.kind === "stack")!;
    const tokenChanged = setDocumentField(
      hexChanged.files,
      currentStack,
      "background",
      "blue",
    );
    expect(tokenChanged.files["layout.jdef"]).toContain("background: blue");
    expect(tokenChanged.files["layout.jdef"]).not.toContain(
      'background: "blue"',
    );
  });

  it("keeps sentinels byte-identical across every exposed declaration field", () => {
    const declarations = [
      "jump",
      "resource",
      "section",
      "choice-source",
      "choice",
      "text",
      "image",
      "input",
      "cost",
      "grant",
      "theme",
      "section-layout",
      "choice-layout",
      "trait-layout",
    ];
    for (const kind of declarations) {
      const authored = `# before sentinel\n${kind}\n  handle: audit_handle\n  name: "Audit name"\n# after sentinel\n`;
      const files = { "jump.jdef": authored };
      const symbol = service
        .analyze(files)
        .symbols.find((candidate) => candidate.kind === kind)!;
      for (const field of declarationFieldNames(kind)) {
        const definition = fieldDefinition(kind, field);
        const value =
          definition?.values?.[0] ??
          (definition?.type === "boolean"
            ? "true"
            : definition?.type === "integer" || definition?.type === "number"
              ? "7"
              : definition?.type?.includes("handle")
                ? "audit_reference"
                : "Audit value");
        const changed = setDocumentField(files, symbol, field, value);
        expect(changed.reason, `${kind}.${field}`).not.toBe("stale-target");
        expect(changed.files["jump.jdef"], `${kind}.${field}`).toContain(
          "# before sentinel\n",
        );
        expect(changed.files["jump.jdef"], `${kind}.${field}`).toContain(
          "\n# after sentinel\n",
        );
      }
    }
  });

  it("resolves declaration fields from ancestry and active control modes", () => {
    const files = {
      "jump.jdef": `${source}\n  choice\n    handle: placement\n    target: top_choice\n`,
      "choices.jdef": `choice\n  handle: top_choice\n  name: "Top"\n  selection: select\n  option: "One"\n\n  grant\n    kind: resource\n    resource: jump_points\n    amount: 10\n`,
    };
    const symbols = service.analyze(files).symbols;
    const direct = symbols.find(
      (symbol) => symbol.kind === "choice" && symbol.depth === 1,
    )!;
    const top = symbols.find(
      (symbol) => symbol.kind === "choice" && symbol.depth === 0,
    )!;
    const grant = symbols.find((symbol) => symbol.kind === "grant")!;

    expect(structuredContext(files, direct)?.visibleFields).toEqual([
      "handle",
      "target",
    ]);
    expect(structuredContext(files, top)?.visibleFields).toContain("option");
    expect(structuredContext(files, top)?.visibleFields).not.toContain("min");
    expect(structuredContext(files, grant)?.visibleFields).toEqual([
      "kind",
      "resource",
      "amount",
      "companion",
    ]);
    expect(service.contextualCompletions(files, direct).fields).toEqual([
      "handle",
      "target",
    ]);
  });

  it("returns exact created child targets and preserves owner navigation", () => {
    const files = { "jump.jdef": `${source}# after\n` };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const first = insertDocumentChild(files, section, "text");
    expect(first.changed).toBe(true);
    expect(first.target).toMatchObject({ kind: "text", handle: "new_text" });
    expect(first.focusField).toBe("content");
    expect(first.files["jump.jdef"]).toContain("# after\n");

    const currentSection = service
      .analyze(first.files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const second = insertDocumentChild(first.files, currentSection, "image");
    const nextSection = service
      .analyze(second.files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const secondContext = structuredContext(second.files, nextSection)!;
    const text = secondContext.children.find((child) => child.kind === "text")!;
    const moved = moveDocumentChild(second.files, nextSection, text, "down");
    expect(moved.changed).toBe(true);
    expect(
      structuredContext(moved.files, nextSection)?.children.map(
        (child) => child.kind,
      ),
    ).toEqual(["image", "text"]);
    const movedText = service
      .analyze(moved.files)
      .symbols.find((symbol) => symbol.kind === "text")!;
    const removed = removeDocumentDeclaration(moved.files, movedText);
    expect(removed.files["jump.jdef"]).not.toContain("handle: new_text");
    expect(removed.files["jump.jdef"]).toContain("# after\n");
  });

  it("creates and assigns a secondary resource atomically", () => {
    const files = {
      "jump.jdef": source,
      "choices.jdef": `choice\n  handle: priced\n  name: "Priced"\n\n  cost\n    resource: jump_points\n    amount: 10\n`,
    };
    const cost = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "cost")!;
    const result = createAndAssignDocumentResource(files, cost, {
      handle: "mana",
      name: "Mana",
      abbreviation: "MP",
      initial: "25",
    });
    expect(result.target).toMatchObject({ kind: "resource", handle: "mana" });
    expect(result.files["choices.jdef"]).toContain("resource: mana");
    expect(result.files["jump.jdef"]).toContain(
      'resource\n  handle: mana\n  name: "Mana"\n  abbreviation: "MP"\n  initial: 25',
    );
    expect(
      createAndAssignDocumentResource(files, cost, {
        handle: "unsafe",
        name: "Unsafe\nresource",
        initial: "0\nsection",
      }).changed,
    ).toBe(false);
  });

  it("resolves layout-node presentation fields without treating content declarations as nodes", () => {
    const files = {
      "jump.jdef": `${source}\ntext\n  handle: outside\n  content: "Text"\n`,
      "layout.jdef": `section-layout\n  handle: layout\n\n  grid\n    columns: 2\n`,
    };
    const symbols = service.analyze(files).symbols;
    const text = symbols.find(
      (symbol) => symbol.kind === "text" && symbol.file === "jump.jdef",
    )!;
    const grid = symbols.find((symbol) => symbol.kind === "grid")!;
    expect(structuredContext(files, text)?.visibleFields).toEqual([
      "handle",
      "content",
    ]);
    expect(structuredContext(files, grid)?.visibleFields).toContain("columns");
    expect(structuredContext(files, grid)?.visibleFields).not.toContain(
      "handle",
    );
    expect(structuredContext(files, grid)?.childKinds).toContain("expand");
  });
});
