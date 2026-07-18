import { describe, expect, it } from "vitest";
import { generatedJumpPackages } from "../fixtures/generatedPackages";
import { canonicalizePackage, parseFormatFile, type LayoutNode } from ".";
import conformance from "../../schema/conformance.json";
import { sha256 } from "./sha256";

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
        .filter((item) => item.severity !== "info")
        .map((item) => `${packageItem.id}: ${item.code} ${item.message}`),
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
});
