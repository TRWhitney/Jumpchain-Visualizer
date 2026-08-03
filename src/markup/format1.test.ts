import { describe, expect, it } from "vitest";
import { generatedJumpPackages } from "../fixtures/generatedPackages";
import {
  canonicalizePackage,
  packageIsValid,
  parseFormatFile,
  type LayoutNode,
} from ".";
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
  it("canonicalizes one jump appearance and rejects duplicates", () => {
    const files = {
      "jump.jdef": `jump
  format: 1
  name: "Appearance"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
`,
      "layout.jdef": `jump-appearance
  background: paper
  text-color: "#112233"

theme
  handle: paper
  color: "#fefefe"
`,
    };
    const packageItem = canonicalizePackage({
      id: "appearance",
      exactHash: "a".repeat(64),
      files,
    });
    expect(packageItem.appearance).toEqual({
      background: "paper",
      "text-color": "#112233",
    });
    expect(
      packageItem.diagnostics.filter((item) => item.severity === "error"),
    ).toEqual([]);

    const duplicate = canonicalizePackage({
      id: "appearance-duplicate",
      exactHash: "b".repeat(64),
      files: {
        ...files,
        "layout.jdef": `${files["layout.jdef"]}\njump-appearance\n`,
      },
    });
    expect(duplicate.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "jump-appearance.cardinality",
          severity: "error",
        }),
      ]),
    );
  });

  it("includes jump appearance in presentation mixed-placement warnings", () => {
    const packageItem = canonicalizePackage({
      id: "appearance-mixed-placement",
      exactHash: "f".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Appearance"
  author: "Tester"
  version: "1"

jump-appearance

section
  handle: content
  name: "Content"
`,
        "layout.jdef": `theme
  handle: paper
  color: "#ffffff"
`,
      },
    });

    expect(packageItem.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "file.layout.mixed",
          severity: "warning",
          range: expect.objectContaining({ file: "jump.jdef" }),
        }),
      ]),
    );
  });

  it("reports resolved contrast as warning-only diagnostics", () => {
    const packageItem = canonicalizePackage({
      id: "appearance-contrast",
      exactHash: "c".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Appearance"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
`,
        "layout.jdef": `jump-appearance
  background: "#ffffff"
  text-color: "#eeeeee"
`,
      },
    });
    const contrast = packageItem.diagnostics.filter(
      (item) => item.code === "appearance.contrast",
    );
    expect(contrast.length).toBeGreaterThan(0);
    expect(contrast.every((item) => item.severity === "warning")).toBe(true);
    expect(contrast[0].parameters).toMatchObject({
      measured: expect.any(String),
      expected: expect.any(String),
    });
    expect(contrast[0].structuredTargets).toEqual([
      expect.objectContaining({ field: "surface-text" }),
      expect.objectContaining({ field: "surface-background" }),
    ]);
    expect(packageIsValid(packageItem)).toBe(true);
  });

  it("targets Gender Default with an actionable continuity diagnostic", () => {
    const source = `jump
  format: 1
  name: "Continuity"
  author: "Tester"
  version: "1"

section
  handle: identity
  name: "Identity"

choice
  handle: gender_control
  name: "Gender"
  selection: select
  continuity: previous
  option: "Male"
  option: "Female"
`;
    const invalid = canonicalizePackage({
      id: "continuity-invalid",
      exactHash: "d".repeat(64),
      files: { "jump.jdef": source },
    });
    const diagnostic = invalid.diagnostics.find(
      (item) => item.code === "choice.continuity.domain",
    );
    expect(diagnostic).toMatchObject({
      messageKey: "diagnostics.choice.continuity.propertyMissing",
      target: {
        file: "jump.jdef",
        field: "continuity",
        occurrence: 0,
        part: "value",
      },
    });
    expect(source.slice(diagnostic?.range?.from, diagnostic?.range?.to)).toBe(
      "previous",
    );
    expect(translateDiagnostic(diagnostic!)).toContain(
      "Add a Grant, set Award Type to Property and Answer Name to gender",
    );

    const valid = canonicalizePackage({
      id: "continuity-valid",
      exactHash: "e".repeat(64),
      files: {
        "jump.jdef": `${source}
  grant
    kind: property
    handle: gender
`,
      },
    });
    expect(
      valid.diagnostics.some(
        (item) => item.code === "choice.continuity.domain",
      ),
    ).toBe(false);

    const implicit = canonicalizePackage({
      id: "continuity-implicit-valid",
      exactHash: "i".repeat(64),
      files: {
        "jump.jdef": source.replace("gender_control", "gender"),
      },
    });
    expect(
      implicit.diagnostics.some(
        (item) => item.code === "choice.continuity.domain",
      ),
    ).toBe(false);
  });

  it("explains when Gender Default uses an incompatible Selection Type", () => {
    const packageItem = canonicalizePackage({
      id: "continuity-selection-invalid",
      exactHash: "f".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Continuity"
  author: "Tester"
  version: "1"

section
  handle: identity
  name: "Identity"

choice
  handle: gender
  name: "Gender"
  selection: toggle
  continuity: previous
`,
      },
    });
    const diagnostic = packageItem.diagnostics.find(
      (item) => item.code === "choice.continuity.domain",
    );
    expect(diagnostic?.messageKey).toBe(
      "diagnostics.choice.continuity.selection",
    );
    expect(diagnostic?.structuredTargets).toEqual([
      expect.objectContaining({ field: "continuity" }),
      expect.objectContaining({ field: "selection" }),
    ]);
    expect(translateDiagnostic(diagnostic!)).toContain(
      "Change Selection Type to Select",
    );
  });

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
    expect(importChoice).toMatchObject({
      selection: "companions",
      min: 1,
      max: 2,
    });
    expect(importChoice?.grants).toEqual(
      expect.arrayContaining([
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

  it("defaults omitted companion-selection bounds to one", () => {
    const packageItem = canonicalizePackage({
      id: "default-companion-bounds",
      exactHash: "d".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Default companion bounds"
  author: "Tester"
  version: "1"

section
  handle: companions
  name: "Companions"

choice
  handle: company
  name: "Company"
  selection: companions

  grant
    kind: resource
    resource: jump_points
    amount: 100
    companion: company
`,
      },
    });

    expect(packageItem.choices[0]).toMatchObject({
      selection: "companions",
      min: 1,
      max: 1,
    });
    expect(
      packageItem.diagnostics.some(
        (diagnostic) => diagnostic.code === "choice.companions.max",
      ),
    ).toBe(false);
  });

  it("canonicalizes control placeholders and rejects one on a toggle", () => {
    const source = `jump
  format: 1
  name: "Placeholders"
  author: "Tester"
  version: "1"

section
  handle: controls
  name: "Controls"

  choice
    handle: answer_field
    target: answer

choice
  handle: answer
  name: "Answer"
  selection: text
  placeholder: "Type {{answer_name}}"

  input
    handle: detail
    selection: select
    placeholder: "Choose a detail"
    option: "One"

  grant
    kind: property
    handle: answer_name

choice
  handle: invalid_toggle
  name: "Invalid"
  placeholder: "Not rendered"
`;
    const packageItem = canonicalizePackage({
      id: "placeholder-controls",
      exactHash: "p".repeat(64),
      files: { "jump.jdef": source },
    });
    const answer = packageItem.choices.find(
      (choice) => choice.handle === "answer",
    );
    expect(answer).toMatchObject({
      placeholder: "Type {{answer_name}}",
      inputs: [{ placeholder: "Choose a detail" }],
    });
    expect(packageItem.diagnostics.map((item) => item.code)).toContain(
      "choice.placeholder.domain",
    );
  });

  it("shares one namespace between created and selected companion targets", () => {
    const source = `jump
  format: 1
  name: "Companion namespace"
  author: "Tester"
  version: "1"

section
  handle: companions
  name: "Companions"

choice
  handle: import_team
  name: "Import team"
  selection: companions
  max: 2

  grant
    kind: resource
    resource: jump_points
    amount: 100
    companion: import_team

choice
  handle: create_team
  name: "Create team"

  grant
    kind: companion
    handle: import_team
`;
    const packageItem = canonicalizePackage({
      id: "companion-namespace",
      exactHash: "n".repeat(64),
      files: { "jump.jdef": source },
    });

    expect(
      packageItem.diagnostics.filter(
        (item) => item.code === "grant.companion.handle",
      ),
    ).toHaveLength(1);
  });

  it("targets an unknown interpolation token at its exact source text", () => {
    const source = `jump
  format: 1
  name: "Unknown value"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"

  choice
    handle: answer
    target: answer

choice
  handle: answer
  name: "Answer"

  text
    handle: description
    content: "Before {{missing_answer}} after"
`;
    const packageItem = canonicalizePackage(
      {
        id: "unknown-interpolation",
        exactHash: "u".repeat(64),
        files: { "jump.jdef": source },
      },
      { profile: "editor" },
    );
    const diagnostic = packageItem.diagnostics.find(
      (item) => item.code === "placeholder.property.unresolved",
    );
    expect(source.slice(diagnostic?.range?.from, diagnostic?.range?.to)).toBe(
      "{{missing_answer}}",
    );
  });

  it("does not resolve a direct Choice target from its placement handle", () => {
    const source = `jump
  format: 1
  name: "Choice namespaces"
  author: "Tester"
  version: "1"

section
  handle: origin
  name: "Origin"

  choice
    handle: dropinloc
    target: dropinloc
`;
    const unresolved = canonicalizePackage({
      id: "choice-placement-namespace",
      exactHash: "c".repeat(64),
      files: { "jump.jdef": source },
    });
    const diagnostic = unresolved.diagnostics.find(
      (item) =>
        item.code === "section.choice.target" &&
        item.target?.field === "target",
    );

    expect(diagnostic).toBeDefined();
    expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
      "dropinloc",
    );

    const resolved = canonicalizePackage({
      id: "choice-declaration-namespace",
      exactHash: "d".repeat(64),
      files: {
        "jump.jdef": `${source}
choice
  handle: dropinloc
  name: "Drop-in"
`,
      },
    });
    expect(
      resolved.diagnostics.filter(
        (item) => item.code === "section.choice.target",
      ),
    ).toEqual([]);
  });

  it("accepts owning Choice and supporting Input answers in Text conditions and interpolation", () => {
    const source = `choice
  handle: answer
  name: "Answer"
  selection: text

  text
    handle: description
    content: "{{answer}}"
    content when detail = "Ready": "{{answer}} / {{detail}}"

  input
    handle: detail
    selection: text
`;
    const packageItem = canonicalizePackage(
      {
        id: "contextual-control-answers",
        exactHash: "a".repeat(64),
        files: { "jump.jdef": source },
      },
      { profile: "editor" },
    );

    expect(
      packageItem.diagnostics.filter((item) =>
        [
          "condition.property.unresolved",
          "placeholder.property.unresolved",
        ].includes(item.code),
      ),
    ).toEqual([]);
  });

  it("diagnoses only Inputs omitted by an explicit Choice layout", () => {
    const source = `jump
  format: 1
  name: "Input placement"
  author: "Tester"
  version: "1"

section
  handle: controls
  name: "Controls"

  choice
    handle: configured
    target: configured

  choice
    handle: built_in
    target: built_in

choice
  handle: configured
  name: "Configured"
  layout: configured_layout

  input
    handle: placed
    selection: text

  input
    handle: missing
    selection: integer

choice
  handle: built_in
  name: "Built in"

  input
    handle: automatic
    selection: text

choice-layout
  handle: configured_layout

  stack
    slot: control
    input: placed
`;
    const packageItem = canonicalizePackage(
      {
        id: "input-placement",
        exactHash: "i".repeat(64),
        files: { "jump.jdef": source },
      },
      { profile: "editor" },
    );
    const placementDiagnostics = packageItem.diagnostics.filter(
      (item) => item.code === "layout.input.unreachable",
    );

    expect(placementDiagnostics).toHaveLength(1);
    expect(placementDiagnostics[0]).toMatchObject({
      parameters: {
        input: "missing",
        layout: "configured_layout",
      },
      target: {
        field: "handle",
        part: "value",
      },
    });
    expect(
      source.slice(
        placementDiagnostics[0].range?.from,
        placementDiagnostics[0].range?.to,
      ),
    ).toBe("missing");
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
      new Set(["toggle", "text", "integer", "select", "companions"]),
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

  it("targets an exact duplicate ordered option at the duplicate occurrence", () => {
    const source = `jump
  format: 1
  name: "Diagnostics"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

choice
  handle: example
  name: "Example"
  selection: select
  option: "First"
  option: "Second"
  option: "Second"
`;
    const packageItem = canonicalizePackage({
      id: "ordered-option-diagnostic",
      exactHash: "0".repeat(64),
      files: { "jump.jdef": source },
    });
    const duplicate = packageItem.diagnostics.find(
      (item) => item.code === "schema.field.exactDuplicate",
    );
    expect(duplicate?.target).toMatchObject({
      field: "option",
      occurrence: 2,
    });
    expect(source.slice(duplicate!.range!.from, duplicate!.range!.to)).toBe(
      '"Second"',
    );
  });

  it("targets and omits empty Choice and Input options", () => {
    const source = `jump
  format: 1
  name: "Empty options"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

  choice
    handle: route
    target: route

choice
  handle: route
  name: "Route"
  selection: select
  option: "Alpha"
  option when gauntlet = true: ""
  option: ""
  option when gauntlet = true: "Orphaned variant"
  option: "   "
  option: "Omega"

  input
    handle: detail
    selection: select
    option: "North"
    option: ""
    option: "South"

choice
  handle: unusable
  name: "Unusable"
  selection: select
  option: ""
`;
    const packageItem = canonicalizePackage({
      id: "empty-options",
      exactHash: "0".repeat(64),
      files: { "jump.jdef": source },
    });
    const route = packageItem.choices.find(
      (choice) => choice.handle === "route",
    )!;

    expect(route.options).toEqual([
      { base: "Alpha", variants: [] },
      { base: "Omega", variants: [] },
    ]);
    expect(route.inputs[0]?.options).toEqual([
      { base: "North", variants: [] },
      { base: "South", variants: [] },
    ]);
    expect(
      packageItem.diagnostics
        .filter((diagnostic) => diagnostic.code === "option.empty")
        .map((diagnostic) => diagnostic.target),
    ).toEqual([
      expect.objectContaining({
        field: "option",
        occurrence: 1,
      }),
      expect.objectContaining({
        field: "option",
        occurrence: 2,
      }),
      expect.objectContaining({
        field: "option",
        occurrence: 4,
      }),
      expect.objectContaining({
        field: "option",
        occurrence: 1,
      }),
      expect.objectContaining({
        field: "option",
        occurrence: 0,
      }),
    ]);
    expect(
      packageItem.diagnostics.filter(
        (diagnostic) =>
          diagnostic.code === "choice.select.options" &&
          diagnostic.target?.declarationFrom ===
            source.indexOf("\nchoice\n  handle: unusable") + 1,
      ),
    ).toEqual([
      expect.objectContaining({
        severity: "warning",
        target: expect.objectContaining({ field: "option" }),
      }),
    ]);
  });

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

  it("treats an ungrouped Choice as reachable when a Section directly references it", () => {
    const unreachableSource = `jump
  format: 1
  name: "Direct reachability"
  author: "Tester"
  version: "1"

section
  handle: identity
  name: "Identity"

choice
  handle: identity_choice
  name: "Identity Choice"
`;
    const unreachable = canonicalizePackage({
      id: "ungrouped-unreachable",
      exactHash: "3".repeat(64),
      files: { "jump.jdef": unreachableSource },
    });
    const warning = unreachable.diagnostics.find(
      (diagnostic) => diagnostic.code === "choice.group.missing",
    );
    expect(warning).toMatchObject({
      severity: "warning",
      target: {
        field: "group",
        occurrence: 0,
        part: "declaration",
      },
    });
    expect(translateDiagnostic(warning!)).toBe(
      "This choice belongs to no group and is not directly referenced, making it unreachable.",
    );
    expect(
      unreachable.diagnostics.some(
        (diagnostic) => diagnostic.code === "choice.unreachable",
      ),
    ).toBe(false);

    const reachableSource = unreachableSource.replace(
      '  name: "Identity"\n',
      `  name: "Identity"

  choice
    handle: identity_field
    target: identity_choice
`,
    );
    const reachable = canonicalizePackage({
      id: "ungrouped-reachable",
      exactHash: "4".repeat(64),
      files: { "jump.jdef": reachableSource },
    });
    expect(
      reachable.diagnostics.filter((diagnostic) =>
        ["choice.group.missing", "choice.unreachable"].includes(
          diagnostic.code,
        ),
      ),
    ).toEqual([]);
  });

  it("canonicalizes direct-choice leaf presentation", () => {
    const source = `jump
  format: 1
  name: "Aligned choices"
  author: "Tester"
  version: "1"

section
  handle: identity
  name: "Identity"
  layout: identity_layout

  choice
    handle: age_field
    target: age

choice
  handle: age
  name: "Age"
  selection: integer
  min: 1
  max: 100

section-layout
  handle: identity_layout

  inline
    choice
      target: age_field
      padding: sm
      background: surface
      align: end
`;
    const packageItem = canonicalizePackage({
      id: "direct-choice-presentation",
      exactHash: "4".repeat(64),
      files: { "jump.jdef": source },
    });
    expect(packageItem.layouts[0]?.root.children[0]).toMatchObject({
      kind: "choice",
      target: "age_field",
      presentation: {
        padding: "sm",
        background: "surface",
        align: "end",
      },
    });
    expect(
      packageItem.diagnostics.filter(
        (diagnostic) =>
          diagnostic.target?.declarationFrom ===
          source.lastIndexOf("    choice\n"),
      ),
    ).toEqual([]);
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
    [
      "image dimension",
      "layout",
      "    image\n      target: hero\n      width: gigantic",
      "width",
    ],
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

  it("diagnoses unused ordinary Grant content while allowing trait layout content", () => {
    const packageForGrant = (kind: string, content: string) =>
      canonicalizePackage({
        id: `grant-content-${kind}`,
        exactHash: "3".repeat(64),
        files: {
          "jump.jdef": `jump
  format: 1
  name: "Grant content"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

choice
  handle: award
  name: "Award"

  grant
    kind: ${kind}
${content}
`,
        },
      });

    const ordinary = packageForGrant(
      "perk",
      `    text
      handle: extra
      content: "Not consumed"

    image
      handle: unused
      src: "unused.png"`,
    );
    expect(ordinary.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "schema.value.const",
        target: expect.objectContaining({ field: "handle" }),
      }),
    );
    expect(ordinary.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "schema.child.invalid",
        parameters: expect.objectContaining({ child: "image" }),
      }),
    );

    const trait = packageForGrant(
      "trait",
      `    text
      handle: details
      content: "Trait layout content"

    image
      handle: portrait
      src: "portrait.png"`,
    );
    expect(
      trait.diagnostics.filter((diagnostic) =>
        [
          "schema.value.const",
          "schema.child.invalid",
          "schema.declaration.context",
        ].includes(diagnostic.code),
      ),
    ).toEqual([]);
  });

  it.each(["xs", "2xl", "320px", "11.5rem", "0px"])(
    "accepts %s as an image dimension",
    (dimension) => {
      const packageItem = canonicalizePackage({
        id: `image-dimension-${dimension}`,
        exactHash: "3".repeat(64),
        files: {
          "jump.jdef": `jump
  format: 1
  name: "Image dimensions"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  image
    handle: hero
    src: "hero.png"

section-layout
  handle: image_layout
  stack
    image
      target: hero
      size: ${dimension}
`,
        },
      });
      expect(
        packageItem.diagnostics.filter(
          (diagnostic) => diagnostic.target?.field === "size",
        ),
      ).toEqual([]);
    },
  );

  it("diagnoses text-only presentation fields on image layout nodes generically", () => {
    const packageItem = canonicalizePackage({
      id: "image-text-presentation",
      exactHash: "3".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Image presentation"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

section-layout
  handle: image_layout
  stack
    image
      target: hero
      text-align: center
      text-size: lg
      text-color: red
`,
      },
    });
    expect(
      packageItem.diagnostics
        .filter((diagnostic) => diagnostic.code === "schema.field.unknown")
        .map((diagnostic) => diagnostic.target?.field),
    ).toEqual(["text-align", "text-size", "text-color"]);
  });

  it("canonicalizes independent image effects and validates fade intensity", () => {
    const source = `jump
  format: 1
  name: "Image effects"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

  image
    handle: hero
    src: "hero.png"
    alt: "A hero"
    rounded-corners: true
    rounded-intensity: 80
    fade-edges: true
    fade-intensity: 60
`;
    const packageItem = canonicalizePackage(
      {
        id: "image-effects",
        exactHash: "e".repeat(64),
        files: { "jump.jdef": source },
      },
      { profile: "editor", assetPaths: ["hero.png"] },
    );

    expect(packageItem.sections[0].images[0].effects).toEqual({
      roundedCorners: true,
      roundedIntensity: 80,
      fadeEdges: true,
      fadeIntensity: 60,
    });
    expect(packageItem.diagnostics).toEqual([]);

    const invalid = canonicalizePackage({
      id: "invalid-image-effects",
      exactHash: "f".repeat(64),
      files: {
        "jump.jdef": source.replace(
          "fade-intensity: 60",
          "fade-intensity: 101",
        ),
      },
    });
    expect(invalid.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "schema.value.bounds",
        target: expect.objectContaining({ field: "fade-intensity" }),
      }),
    );
  });

  it("allows inner alignment but rejects text styling on control and roll slots", () => {
    const packageItem = canonicalizePackage({
      id: "slot-text-presentation",
      exactHash: "4".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Slot presentation"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

choice-layout
  handle: controls

  stack
    slot
      target: name
      text-align: center
      text-size: lg
      text-color: red

    slot
      target: control
      text-align: end
      text-size: 2xl
      text-color: blue

section-layout
  handle: section_controls

  stack
    slot
      target: roll
      text-align: end
      text-size: 2xl
      text-color: blue

trait-layout
  handle: trait_name

  stack
    slot
      target: name
      text-align: center
      text-size: lg
      text-color: red
`,
      },
    });

    const unknown = packageItem.diagnostics.filter(
      (diagnostic) => diagnostic.code === "schema.field.unknown",
    );
    expect(unknown.map((diagnostic) => diagnostic.target?.field)).toEqual([
      "text-size",
      "text-color",
      "text-size",
      "text-color",
    ]);
    expect(
      new Set(unknown.map((diagnostic) => diagnostic.target?.declarationFrom))
        .size,
    ).toBe(2);
  });

  it("allows control adornments only on control and roll slots", () => {
    const packageItem = canonicalizePackage({
      id: "slot-control-adornments",
      exactHash: "5".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Control adornments"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"

choice-layout
  handle: choice_controls

  stack
    slot
      target: name
      control-adornments: false

    slot
      target: control
      control-adornments: false

section-layout
  handle: section_controls

  stack
    slot
      target: roll
      control-adornments: false

trait-layout
  handle: trait_name

  stack
    slot
      target: name
      control-adornments: false
`,
      },
    });

    expect(
      packageItem.diagnostics
        .filter((diagnostic) => diagnostic.code === "schema.field.unknown")
        .map((diagnostic) => diagnostic.target?.field),
    ).toEqual(["control-adornments", "control-adornments"]);
    expect(
      packageItem.layouts
        .find((layout) => layout.handle === "choice_controls")
        ?.root.children.find((node) => node.target === "control")?.presentation,
    ).toMatchObject({ controlAdornments: false });
    expect(
      packageItem.layouts
        .find((layout) => layout.handle === "section_controls")
        ?.root.children.find((node) => node.target === "roll")?.presentation,
    ).toMatchObject({ controlAdornments: false });
  });

  it("canonicalizes additive semantic-fidelity presentation fields", () => {
    const source = `jump
  format: 1
  name: "Fidelity"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  layout: fidelity
  text
    handle: prose
    content
      """
      First \\
      Second
      """

section-layout
  handle: fidelity

  grid
    columns: 3
    column-weight: 3
    column-weight: 4
    column-weight: 2
    stack
      column-span: 2
      padding-block: xs
      padding-inline: lg
      min-width: 8rem
      min-height: 48px
      aspect-ratio: 16/9
      text
        target: prose
        grow: 1
        text-size: 3rem
        font-family: condensed
        font-weight: black
        line-height: tight
        letter-spacing: wide
        list-marker: dash
        list-indent: sm
        list-gap: xs
`;
    const packageItem = canonicalizePackage({
      id: "fidelity-presentation",
      exactHash: "9".repeat(64),
      files: { "jump.jdef": source },
    });
    expect(
      packageItem.diagnostics.filter((diagnostic) =>
        ["schema.value.type", "layout.grid.weightCount"].includes(
          diagnostic.code,
        ),
      ),
    ).toEqual([]);
    expect(packageItem.layouts[0].root.presentation.columnWeights).toEqual([
      3, 4, 2,
    ]);
    expect(packageItem.layouts[0].root.children[0].presentation).toMatchObject({
      columnSpan: 2,
      paddingBlock: "xs",
      paddingInline: "lg",
      minWidth: "8rem",
      minHeight: "48px",
      aspectRatio: "16/9",
    });
    expect(
      packageItem.layouts[0].root.children[0].children[0].presentation,
    ).toMatchObject({
      grow: 1,
      textSize: "3rem",
      fontFamily: "condensed",
      fontWeight: "black",
      lineHeight: "tight",
      letterSpacing: "wide",
      listMarker: "dash",
      listIndent: "sm",
      listGap: "xs",
    });
  });

  it.each([
    "xs",
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "8px",
    "512px",
    ".5rem",
    "32rem",
  ])("accepts %s through the shared text-size source field", (textSize) => {
    const packageItem = canonicalizePackage({
      id: `text-size-${textSize}`,
      exactHash: "6".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Text size"
  author: "Tester"
  version: "1"

section-layout
  handle: text_size
  stack
    text
      target: prose
      text-size: ${textSize}
`,
      },
    });
    expect(
      packageItem.diagnostics.filter(
        (diagnostic) => diagnostic.target?.field === "text-size",
      ),
    ).toEqual([]);
    expect(packageItem.layouts[0].root.children[0].presentation.textSize).toBe(
      textSize,
    );
  });

  it("diagnoses invalid fidelity values and placement relationships", () => {
    const source = `jump
  format: 1
  name: "Invalid fidelity"
  author: "Tester"
  version: "1"

section-layout
  handle: invalid
  grid
    columns: 2
    column-weight: 1
    text
      target: missing
      grow: 1
      text-size: 513px
      aspect-ratio: 0/1
`;
    const packageItem = canonicalizePackage({
      id: "invalid-fidelity-presentation",
      exactHash: "8".repeat(64),
      files: { "jump.jdef": source },
    });
    expect(
      packageItem.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(
      expect.arrayContaining([
        "layout.grid.weightCount",
        "layout.grow.parent",
        "schema.value.type",
      ]),
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

  it("targets condition tokens and promotes unresolved properties for distribution", () => {
    const source = `jump
  format: 1
  name: "Conditions"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  text
    handle: body
    content: "Base"
    content when missing_property: "Draft"
    content when tier + 1: "Broken"

choice
  handle: tier_control
  name: "Tier"
  selection: integer
  grant
    kind: property
    handle: tier
`;
    const sources = {
      id: "condition-targets",
      exactHash: "c".repeat(64),
      files: { "jump.jdef": source },
    };
    const editor = canonicalizePackage(sources, { profile: "editor" });
    const unresolved = editor.diagnostics.find(
      (item) => item.code === "condition.property.unresolved",
    );
    const syntax = editor.diagnostics.find(
      (item) => item.code === "condition.syntax",
    );
    expect(unresolved).toMatchObject({
      severity: "warning",
      parameters: { property: "missing_property" },
      target: {
        field: "content",
        baseOccurrence: 0,
        variantOccurrence: 0,
        part: "condition",
      },
    });
    expect(source.slice(unresolved!.range!.from, unresolved!.range!.to)).toBe(
      "missing_property",
    );
    expect(source.slice(syntax!.range!.from, syntax!.range!.to)).toBe("+");
    expect(translateDiagnostic(unresolved!)).toContain("missing_property");
    expect(
      canonicalizePackage(sources, { profile: "distribution" }).diagnostics,
    ).toContainEqual(
      expect.objectContaining({
        code: "condition.property.unresolved",
        severity: "error",
      }),
    );
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

  it("keeps reusable-layout target diagnostics in the matching layout namespace", () => {
    const source = `jump
  format: 1
  name: "Layout namespaces"
  author: "Tester"
  version: "1"

section
  handle: origin
  name: "Origin"
  layout: origin

choice
  handle: dropin
  name: "Drop-In"
  layout: origin
  selection: toggle

section-layout
  handle: origin

  stack
    slot: name

choice-layout
  handle: origin

  stack
    text: description

trait-layout
  handle: origin

  stack
    text: trait_description
`;
    const packageItem = canonicalizePackage(
      {
        id: "layout-namespace-diagnostics",
        exactHash: "5".repeat(64),
        files: { "jump.jdef": source },
      },
      {
        profile: "editor",
        warnings: { missingLayoutTargets: true },
      },
    );
    const missing = packageItem.diagnostics.filter(
      (diagnostic) => diagnostic.code === "layout.typedTarget.missing",
    );

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      parameters: {
        kind: "text",
        target: "description",
        owner: "choice dropin",
      },
      target: expect.objectContaining({ field: "text" }),
    });
    expect(
      missing.some((diagnostic) =>
        String(diagnostic.parameters?.owner).includes("section"),
      ),
    ).toBe(false);
    expect(
      missing.some((diagnostic) =>
        String(diagnostic.parameters?.target).includes("trait_description"),
      ),
    ).toBe(false);
  });

  it("canonicalizes owner-local background images and validates their field relationships", () => {
    const packageItem = canonicalizePackage(
      {
        id: "layout-backgrounds",
        exactHash: "b".repeat(64),
        files: {
          "jump.jdef": `jump
  format: 1
  name: "Backgrounds"
  author: "Tester"
  version: "1"
  section-layout: card

section
  handle: content
  name: "Content"
  image
    handle: texture
    src: "texture.png"
    alt: ""

section-layout
  handle: card

  stack
    background-image: texture
    background-fit: tile
    slot: name

    inline
      background: white
      background-image: texture
      slot: name

    inline
      background-fit: contain
      slot: name
`,
        },
      },
      {
        profile: "editor",
        assetPaths: ["texture.png"],
        warnings: { missingLayoutTargets: true },
      },
    );

    expect(packageItem.layouts[0].root.presentation).toMatchObject({
      backgroundImage: "texture",
      backgroundFit: "tile",
    });
    expect(packageItem.diagnostics).toContainEqual(
      expect.objectContaining({ code: "schema.field.exclusive" }),
    );
    expect(packageItem.layouts[0].root.children[2].presentation).toMatchObject({
      backgroundFit: "contain",
    });
    expect(
      packageItem.diagnostics.filter(
        (diagnostic) => diagnostic.code === "layout.typedTarget.missing",
      ),
    ).toHaveLength(0);
  });

  it("warns only for layout consumers missing an owner-local background image", () => {
    const packageItem = canonicalizePackage(
      {
        id: "layout-background-consumers",
        exactHash: "c".repeat(64),
        files: {
          "jump.jdef": `jump
  format: 1
  name: "Background consumers"
  author: "Tester"
  version: "1"
  section-layout: card

section
  handle: illustrated
  name: "Illustrated"
  image
    handle: texture
    src: "texture.png"
    alt: ""

section
  handle: plain
  name: "Plain"

section-layout
  handle: card

  stack
    background-image: texture
    slot: name
`,
        },
      },
      {
        profile: "editor",
        assetPaths: ["texture.png"],
        warnings: { missingLayoutTargets: true },
      },
    );

    expect(packageItem.layouts[0].root.presentation.backgroundImage).toBe(
      "texture",
    );
    expect(
      packageItem.diagnostics.filter(
        (diagnostic) => diagnostic.code === "layout.typedTarget.missing",
      ),
    ).toEqual([
      expect.objectContaining({
        severity: "warning",
        parameters: expect.objectContaining({
          kind: "image",
          target: "texture",
          owner: "section plain",
        }),
      }),
    ]);
  });

  it("checks Trait layout targets against the Trait grant that uses the layout", () => {
    const source = `jump
  format: 1
  name: "Trait layout diagnostics"
  author: "Tester"
  version: "1"

choice
  handle: layered_trait
  name: "Layered trait"
  selection: toggle

  text
    handle: choice_copy
    content: "Choice copy"

  grant
    kind: trait
    layout: shared_layout

    text
      handle: trait_copy
      content: "Trait copy"

choice-layout
  handle: shared_layout

  stack
    text: choice_copy

trait-layout
  handle: shared_layout

  stack
    text: missing_trait_copy
`;
    const packageItem = canonicalizePackage(
      {
        id: "trait-layout-namespace-diagnostics",
        exactHash: "6".repeat(64),
        files: { "jump.jdef": source },
      },
      {
        profile: "editor",
        warnings: { missingLayoutTargets: true },
      },
    );
    const missing = packageItem.diagnostics.filter(
      (diagnostic) => diagnostic.code === "layout.typedTarget.missing",
    );

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      parameters: {
        kind: "text",
        target: "missing_trait_copy",
        owner: "trait layered_trait",
      },
      target: expect.objectContaining({ field: "text" }),
    });
  });

  it("canonicalizes gap-closure mechanics and keeps Tag rendering user-owned", () => {
    const packageItem = canonicalizePackage({
      id: "gap-closure",
      exactHash: "8".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Gap Closure"
  author: "Tester"
  version: "1"
  discount-stacking: stack
  discount-floor: negative
  grant
    kind: trait
    name: "Terms"

section
  handle: content
  name: "Content"
  locked: true
  layout: section_layout
  choice-source
    handle: flaws
    group: flaws
    mode: multi
    max: 2

choice
  handle: origin
  name: "Origin"
  lock: content
  unlock: content
  discount
    group: flaws
    mode: percent
    amount: 50

choice
  handle: flaw
  name: "Flaw"
  group: flaws

section-layout
  handle: section_layout
  inline
    rule
      orientation: vertical
    expand
      source: flaws
`,
      },
    });
    expect(
      packageItem.diagnostics.filter((item) => item.severity === "error"),
    ).toEqual([]);
    expect(packageItem).toMatchObject({
      discountStacking: "stack",
      discountFloor: "negative",
      grants: [expect.objectContaining({ kind: "trait" })],
      sections: [
        expect.objectContaining({
          locked: true,
          sources: [expect.objectContaining({ max: 2 })],
        }),
      ],
      choices: [
        expect.objectContaining({
          locks: ["content"],
          unlocks: ["content"],
          discounts: [expect.objectContaining({ group: "flaws", amount: 50 })],
        }),
        expect.anything(),
      ],
    });

    const authoredTags = canonicalizePackage({
      id: "authored-tags",
      exactHash: "9".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Tags"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"

choice-layout
  handle: card
  stack
    slot
      target: tags
      text-size: 3rem
      text-color: red
      font-family: condensed
      font-weight: black
      line-height: tight
      letter-spacing: wide
`,
      },
    });
    expect(
      authoredTags.diagnostics
        .filter((diagnostic) => diagnostic.code === "schema.field.unknown")
        .map((diagnostic) => diagnostic.target?.field),
    ).toEqual(
      expect.arrayContaining([
        "text-size",
        "text-color",
        "font-family",
        "font-weight",
        "line-height",
        "letter-spacing",
      ]),
    );

    const invalidMechanics = canonicalizePackage({
      id: "invalid-gap-closure",
      exactHash: "7".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Invalid mechanics"
  author: "Tester"
  version: "1"

  grant
    kind: property
    handle: location

section
  handle: content
  name: "Content"

  choice-source
    handle: choices
    group: choices
    mode: single
    max: 2

choice
  handle: invalid
  name: "Invalid"
  group: choices
  lock: content
  lock: content

  discount
    group: choices
    mode: flat
    amount: 10
    resource: missing_points
`,
      },
    });
    expect(invalidMechanics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "grant.property.jump_value" }),
        expect.objectContaining({ code: "choiceSource.max.domain" }),
        expect.objectContaining({ code: "schema.field.exactDuplicate" }),
        expect.objectContaining({ code: "resource.reference" }),
      ]),
    );
  });
});
