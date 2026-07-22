import { describe, expect, it } from "vitest";
import { generatedJumpPackages } from "../fixtures/generatedPackages";
import { canonicalizePackage, parseFormatFile, type LayoutNode } from ".";
import conformance from "../../schema/conformance.json";
import { sha256 } from "./sha256";
import { translateDiagnostic } from "../localization";

const conformanceSources = import.meta.glob("../../schema/fixtures/**/*.jdef", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const demonstrationSources = import.meta.glob("../fixtures/jumps/**/*.jdef", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("Format 1 source pipeline", () => {
  it("uses verified SHA-256 package identities", () => {
    expect(sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("parses all generated packages without errors", () => {
    expect(generatedJumpPackages).toHaveLength(3);
    const failures = generatedJumpPackages.flatMap((packageItem) =>
      packageItem.diagnostics
        .filter((item) => item.severity === "error")
        .map(
          (item) =>
            `${packageItem.id}: ${item.code} ${translateDiagnostic(item)}`,
        ),
    );
    expect(failures).toEqual([]);
    expect(
      new Set(generatedJumpPackages.map((item) => item.exactHash)).size,
    ).toBe(3);
  });

  it("uses native Gauntlet defaults and explicit starting points", () => {
    const trial = generatedJumpPackages.find(
      (item) => item.id === "last-trial",
    );
    const confluence = generatedJumpPackages.find(
      (item) => item.id === "confluence-engine",
    );
    expect(trial).toMatchObject({ nativeGauntlet: true, startingPoints: 0 });
    expect(confluence).toMatchObject({
      nativeGauntlet: false,
      startingPoints: 1600,
      description:
        "Align realities through an engine built from compatible rules.",
    });
    expect(trial?.description).toBe(
      "Complete a native Gauntlet at the final sealed gate.",
    );
    const trialCard = trial?.layouts.find(
      (layout) => layout.handle === "trial_card",
    );
    const nodes = trialCard
      ? [
          trialCard.root,
          ...trialCard.root.children.flatMap((node) => [
            node,
            ...node.children,
          ]),
        ]
      : [];
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "slot", target: "control" }),
        expect.objectContaining({ kind: "slot", target: "roll" }),
      ]),
    );
    expect(
      trialCard?.root.children.map((node) => [node.kind, node.target]),
    ).toEqual([
      ["inline", undefined],
      ["slot", "tags"],
      ["text", "description"],
      ["slot", "control"],
      ["slot", "roll"],
    ]);
    expect(
      trial?.choices.find((choice) => choice.handle === "random_age")
        ?.resolution,
    ).toBe("random");
  });

  it("uses the authored Jump description as canonical package metadata", () => {
    const packageItem = canonicalizePackage({
      id: "authored-description",
      exactHash: "d".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Described Jump"
  description: "Authored package description."
  author: "Tester"
  version: "1"
`,
      },
    });

    expect(packageItem.description).toBe("Authored package description.");
  });

  it("canonicalizes form ownership and explicit quantity measures", () => {
    const confluence = generatedJumpPackages.find(
      (item) => item.id === "confluence-engine",
    );
    expect(
      confluence?.choices.find((choice) => choice.handle === "prism_form")
        ?.grants[0],
    ).toMatchObject({ kind: "form", handle: "prism_form" });
    expect(
      confluence?.choices.find((choice) => choice.handle === "refractive_hide")
        ?.grants[0],
    ).toMatchObject({ kind: "perk", form: "prism_form", shorthand: true });
    expect(
      confluence?.choices.find((choice) => choice.handle === "facet_crates")
        ?.grants[0],
    ).toMatchObject({ kind: "item", measure: "quantity", shorthand: true });
  });

  it("canonicalizes companion targets for purchases and imports", () => {
    const trial = generatedJumpPackages.find(
      (item) => item.id === "last-trial",
    );
    const purchased = trial?.choices.find(
      (choice) => choice.handle === "aster_companion",
    );
    expect(purchased?.grants[0]).toMatchObject({
      kind: "companion",
      handle: "aster_companion",
      shorthand: true,
    });
    expect(purchased?.grants).toContainEqual(
      expect.objectContaining({
        kind: "perk",
        companion: "aster_companion",
      }),
    );
    const importChoice = trial?.choices.find(
      (choice) => choice.handle === "trial_company",
    );
    expect(importChoice?.inputs[0].grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "companion-import",
          handle: "trial_company",
        }),
        expect.objectContaining({
          kind: "resource",
          companion: "trial_company",
        }),
        expect.objectContaining({
          kind: "perk",
          companion: "trial_company",
        }),
      ]),
    );
  });

  it("covers the complete behaviorally distinct Format 1 demonstration catalogue", () => {
    const source = Object.values(demonstrationSources).join("\n");
    const allChoices = generatedJumpPackages.flatMap((item) => item.choices);
    const allLayouts = generatedJumpPackages.flatMap((item) => item.layouts);
    const walk = (node: LayoutNode): LayoutNode[] => [
      node,
      ...node.children.flatMap(walk),
    ];
    const nodes = allLayouts.flatMap((layout) => walk(layout.root));

    expect(new Set(allChoices.map((choice) => choice.selection))).toEqual(
      new Set(["toggle", "text", "integer", "select"]),
    );
    expect(new Set(allChoices.map((choice) => choice.resolution))).toEqual(
      new Set(["manual", "random", "either"]),
    );
    expect(new Set(nodes.map((node) => node.kind))).toEqual(
      new Set([
        "stack",
        "inline",
        "wrap",
        "grid",
        "slot",
        "text",
        "image",
        "input",
        "rule",
        "choice",
        "expand",
      ]),
    );
    for (const token of ["none", "xs", "sm", "md", "lg", "xl", "2xl"])
      expect(source).toMatch(
        new RegExp(`(?:gap|padding|size|text-size): ${token}\\b`),
      );
    for (const color of [
      "black",
      "white",
      "gray",
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "purple",
      "brown",
      "pink",
    ])
      expect(source).toContain(`background: ${color}`);
    for (const token of [
      "trivial",
      "small",
      "medium",
      "large",
      "major",
      "extreme",
      "add_trivial",
      "add_small",
      "add_medium",
      "add_large",
      "add_major",
      "add_extreme",
    ])
      expect(source).toMatch(new RegExp(`(?:cost|amount): ${token}\\b`));
    for (const condition of [
      "!engine_enabled",
      "engine_enabled = false",
      "tier != 0",
      "tier < 0",
      "tier <= 2",
      "tier > 2",
      "tier >= 3",
      " and ",
      " or ",
      '(tier >= 3 or engine_path = "Horizon")',
      "when gauntlet",
    ])
      expect(source).toContain(condition);
    expect(source).toContain("selection: companions");
    expect(source).toContain("mode: single");
    expect(source).toContain("mode: multi");
    expect(source).toContain("mode: each");
    expect(source).toContain("measure: rank");
    expect(source).toContain("measure: quantity");
    expect(source).toContain("form: prism_form");
    expect(source).toMatch(/companion: (?:trial_company|aster_companion)/);
    expect(source).toContain('background: "#315B66"');
    expect(source).toContain("background: engine_gold");
  });

  it("matches every machine-readable conformance fixture", () => {
    for (const fixture of conformance.cases) {
      const directory = `/schema/${fixture.directory}/`;
      const files = Object.fromEntries(
        Object.entries(conformanceSources).flatMap(([path, source]) =>
          path.includes(directory)
            ? [[path.slice(path.lastIndexOf("/") + 1), source]]
            : [],
        ),
      );
      const packageItem = canonicalizePackage({
        id: fixture.name,
        exactHash: fixture.name.padEnd(64, "0").slice(0, 64),
        files,
      });
      const actual = packageItem.diagnostics.map(
        (item) => `${item.severity}:${item.code}`,
      );
      for (const expected of fixture.diagnostics)
        expect(actual, fixture.name).toContain(expected);
      for (const diagnostic of packageItem.diagnostics)
        expect(translateDiagnostic(diagnostic), diagnostic.code).not.toBe(
          diagnostic.code,
        );
      expect(
        packageItem.diagnostics.every((item) => item.severity !== "error"),
        fixture.name,
      ).toBe(fixture.exportValid);
    }
  });

  it("reports malformed indentation and duplicate resource costs", () => {
    const malformed = parseFormatFile("jump.jdef", "jump\n   format: 1\n");
    expect(malformed.diagnostics.map((item) => item.code)).toContain(
      "syntax.indent",
    );
    const packageItem = canonicalizePackage({
      id: "bad",
      exactHash: "0".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Bad"
  author: "Tester"
  version: "1"

section
  handle: choices
  name: "Choices"

choice
  handle: duplicate
  name: "Duplicate"
  group: choices
  cost: 100
  cost: 200
`,
      },
    });
    expect(packageItem.diagnostics.map((item) => item.code)).toContain(
      "cost.unique_resource",
    );
  });

  it("rejects a second field embedded in an unquoted field value", () => {
    const source = `jump
  layout: points-name: "Choice Points"
  description: "A time: loop premise"
`;
    const parsed = parseFormatFile("jump.jdef", source);
    const diagnostic = parsed.diagnostics.find(
      (item) => item.code === "syntax.embedded_field",
    );
    expect(diagnostic).toBeDefined();
    expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
      "points-name:",
    );
    expect(
      parseFormatFile(
        "jump.jdef",
        'jump\n  description: "A time: loop premise"\n\nsection\n  layout: default_layout\n',
      ).diagnostics,
    ).toEqual([]);
  });

  it.each([
    ["boolean", "  gauntlet: maybe", "schema.value.type", "gauntlet"],
    [
      "integer",
      "  starting-points: 1.5",
      "schema.value.type",
      "starting-points",
    ],
    ["enum", "  selection: nonsense", "schema.value.type", "selection"],
    [
      "unknown field",
      "  slelection: toggle",
      "schema.field.unknownSuggested",
      "slelection",
    ],
    [
      "duplicate scalar",
      "  selection: toggle\n  selection: integer",
      "schema.field.duplicate",
      "selection",
    ],
  ])(
    "reports invalid %s values at their exact field",
    (_name, authored, code, field) => {
      const jumpField = ["gauntlet", "starting-points"].includes(field);
      const source = `jump
  format: 1
  name: "Diagnostics"
  author: "Tester"
  version: "1"
${jumpField ? authored : ""}

section
  handle: intro
  name: "Intro"

choice
  handle: example
  name: "Example"
  group: examples
${jumpField ? "" : authored}
`;
      const packageItem = canonicalizePackage({
        id: "schema-diagnostic",
        exactHash: "0".repeat(64),
        files: { "jump.jdef": source },
      });
      const diagnostic = packageItem.diagnostics.find(
        (item) => item.code === code && item.target?.field === field,
      );
      expect(diagnostic).toBeDefined();
      expect(diagnostic?.range?.file).toBe("jump.jdef");
      expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
        authored.trim().split("\n").at(-1)?.split(": ").at(-1),
      );
    },
  );

  it("reports a removed layout name through the generic unknown-field rule", () => {
    const source = `jump
  format: 1
  name: "Diagnostics"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

section-layout
  handle: card
  name: "No longer valid"

  stack
`;
    const packageItem = canonicalizePackage({
      id: "layout-name-diagnostic",
      exactHash: "0".repeat(64),
      files: { "jump.jdef": source },
    });
    const diagnostic = packageItem.diagnostics.find(
      (item) =>
        item.code === "schema.field.unknown" &&
        item.parameters?.declaration === "section-layout" &&
        item.target?.field === "name",
    );

    expect(diagnostic).toBeDefined();
    expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
      '"No longer valid"',
    );
  });

  it("reports a removed theme name through the generic unknown-field rule", () => {
    const source = `jump
  format: 1
  name: "Diagnostics"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

theme
  handle: accent
  name: "No longer valid"
  color: "#123456"
`;
    const packageItem = canonicalizePackage({
      id: "theme-name-diagnostic",
      exactHash: "0".repeat(64),
      files: { "jump.jdef": source },
    });
    const diagnostic = packageItem.diagnostics.find(
      (item) =>
        item.code === "schema.field.unknown" &&
        item.parameters?.declaration === "theme" &&
        item.target?.field === "name",
    );

    expect(diagnostic).toBeDefined();
    expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
      '"No longer valid"',
    );
  });

  it("canonicalizes rule presentation and diagnoses invalid values at their fields", () => {
    const valid = `jump
  format: 1
  name: "Rules"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

section-layout
  handle: ruled

  stack
    rule
      color: "#C85A71"
      thickness: 3
      style: rounded
`;
    const packageItem = canonicalizePackage({
      id: "rule-presentation",
      exactHash: "0".repeat(64),
      files: { "jump.jdef": valid },
    });
    expect(packageItem.layouts[0].root.children[0]).toMatchObject({
      kind: "rule",
      presentation: {
        color: "#C85A71",
        thickness: 3,
        style: "rounded",
      },
    });
    expect(
      packageItem.diagnostics.filter(
        (diagnostic) =>
          diagnostic.target?.field === "color" ||
          diagnostic.target?.field === "thickness" ||
          diagnostic.target?.field === "style",
      ),
    ).toEqual([]);

    const invalid = valid
      .replace("thickness: 3", "thickness: 0")
      .replace("style: rounded", "style: dotted");
    const diagnostics = canonicalizePackage({
      id: "invalid-rule-presentation",
      exactHash: "0".repeat(64),
      files: { "jump.jdef": invalid },
    }).diagnostics;
    expect(
      diagnostics.find(
        (diagnostic) =>
          diagnostic.code === "schema.value.bounds" &&
          diagnostic.target?.field === "thickness",
      ),
    ).toBeDefined();
    expect(
      diagnostics.find(
        (diagnostic) =>
          diagnostic.code === "schema.value.type" &&
          diagnostic.target?.field === "style",
      ),
    ).toBeDefined();
  });

  it.each(["stack", "inline", "wrap", "grid"])(
    "reports a removed %s handle through the generic unknown-field rule",
    (container) => {
      const source = `jump
  format: 1
  name: "Diagnostics"
  author: "Tester"
  version: "1"

section-layout
  handle: card

  ${container}
    handle: obsolete_container_id
${container === "grid" ? "    columns: 2\n" : ""}`;
      const packageItem = canonicalizePackage({
        id: `${container}-handle-diagnostic`,
        exactHash: "0".repeat(64),
        files: { "jump.jdef": source },
      });
      const diagnostic = packageItem.diagnostics.find(
        (item) =>
          item.code === "schema.field.unknown" &&
          item.parameters?.declaration === container &&
          item.target?.field === "handle",
      );

      expect(diagnostic).toBeDefined();
      expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
        "obsolete_container_id",
      );
    },
  );

  it.each([
    ["quoted string", "jump", "  description: unquoted", "description"],
    ["renderable string", "jump", "  points-name: unquoted", "points-name"],
    ["boolean", "jump", "  gauntlet: yes", "gauntlet"],
    ["integer", "jump", "  starting-points: 1.5", "starting-points"],
    ["enum", "choice", "  selection: invalid", "selection"],
    ["const", "jump", "  format: 2", "format"],
    ["tag", "choice", '  group: "---"', "group"],
    ["handle", "choiceChild", "  text\n    handle: Not_A_Handle", "handle"],
    ["handle reference", "section", "  layout: Not A Handle!", "layout"],
    [
      "rich text",
      "choiceChild",
      "  text\n    handle: prose\n    content: unquoted",
      "content",
    ],
    ["cost amount", "choice", "  cost: gigantic", "cost"],
    ["scalar grant", "choice", "  grant: nonsense", "grant"],
    [
      "grant amount",
      "choiceChild",
      "  grant\n    kind: resource\n    resource: jump_points\n    amount: gigantic",
      "amount",
    ],
    [
      "property value",
      "choiceChild",
      "  grant\n    kind: property\n    handle: signal\n    value: unquoted",
      "value",
    ],
    [
      "asset path",
      "choiceChild",
      '  image\n    handle: hero\n    src: "../hero.png"',
      "src",
    ],
    ["hex color", "top", "theme\n  handle: bad_theme\n  color: #12", "color"],
    ["spacing", "layout", "    gap: huge", "gap"],
    ["size", "layout", "    text-size: huge", "text-size"],
    ["alignment", "layout", "    align: sideways", "align"],
    ["justification", "layout", "    justify: sideways", "justify"],
    ["text alignment", "layout", "    text-align: sideways", "text-align"],
    ["color", "layout", "    background: @invalid", "background"],
    ["bounded integer", "grid", "    columns: 13", "columns"],
  ])("validates the %s schema type", (_type, scope, authored, field) => {
    const source = `jump
  format: 1
  name: "Schema types"
  author: "Tester"
  version: "1"
${scope === "jump" ? authored : ""}

section
  handle: intro
  name: "Intro"
${scope === "section" ? authored : ""}

choice
  handle: example
  name: "Example"
  group: examples
${scope === "choice" ? authored : ""}
${scope === "choiceChild" ? authored : ""}

${scope === "layout" ? `section-layout\n  handle: invalid_layout\n  stack\n${authored}` : ""}
${scope === "grid" ? `section-layout\n  handle: invalid_layout\n  grid\n${authored}` : ""}
${scope === "top" ? authored : ""}
`;
    const packageItem = canonicalizePackage({
      id: `schema-type-${_type}`,
      exactHash: "3".repeat(64),
      files: { "jump.jdef": source },
    });
    expect(packageItem.diagnostics).toContainEqual(
      expect.objectContaining({
        code: expect.stringMatching(
          /^(?:schema\.value\.(?:type|handle|handleReference|const|bounds)|tag\.empty)$/,
        ),
        target: expect.objectContaining({ field }),
      }),
    );
  });

  it("uses warning diagnostics in Editor and blocking diagnostics for distribution", () => {
    const source = `jump
  format: 1
  name: "Profiles"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  layout: missing_layout
`;
    const sources = {
      id: "profiles",
      exactHash: "1".repeat(64),
      files: { "jump.jdef": source },
    };
    const editor = canonicalizePackage(sources, { profile: "editor" });
    const distribution = canonicalizePackage(sources, {
      profile: "distribution",
    });
    const editorDiagnostic = editor.diagnostics.find(
      (item) => item.code === "layout.reference",
    );
    const distributionDiagnostic = distribution.diagnostics.find(
      (item) => item.code === "layout.reference",
    );
    expect(editorDiagnostic).toMatchObject({
      severity: "warning",
      target: { field: "layout", occurrence: 0 },
    });
    expect(distributionDiagnostic?.severity).toBe("error");
  });

  it("honors image warning preferences without suppressing export requirements", () => {
    const source = `jump
  format: 1
  name: "Images"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

  image
    handle: hero
`;
    const sources = {
      id: "images",
      exactHash: "2".repeat(64),
      files: { "jump.jdef": source },
    };
    const editor = canonicalizePackage(sources, {
      profile: "editor",
      assetPaths: [],
      warnings: { missingImageAlt: false },
    });
    expect(editor.diagnostics.map((item) => item.code)).not.toContain(
      "image.alt.missing",
    );
    expect(editor.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "image.src.missing",
        severity: "warning",
      }),
    );
    const distribution = canonicalizePackage(sources, {
      profile: "distribution",
      assetPaths: [],
    });
    expect(distribution.diagnostics).toContainEqual(
      expect.objectContaining({ code: "image.src.missing", severity: "error" }),
    );
  });

  it("honors the reusable-layout target warning preference", () => {
    const source = `jump
  format: 1
  name: "Layout warning preference"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  layout: detailed

section-layout
  handle: detailed
  stack
    text: absent_text
`;
    const sources = {
      id: "layout-warning-preference",
      exactHash: "4".repeat(64),
      files: { "jump.jdef": source },
    };
    expect(
      canonicalizePackage(sources, {
        profile: "editor",
        warnings: { missingLayoutTargets: false },
      }).diagnostics.map((item) => item.code),
    ).not.toContain("layout.typedTarget.missing");
    expect(
      canonicalizePackage(sources, {
        profile: "editor",
        warnings: { missingLayoutTargets: true },
      }).diagnostics,
    ).toContainEqual(
      expect.objectContaining({
        code: "layout.typedTarget.missing",
        severity: "warning",
        target: expect.objectContaining({ field: "text" }),
      }),
    );
  });
});
