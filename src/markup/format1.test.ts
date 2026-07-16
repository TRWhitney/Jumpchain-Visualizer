import { describe, expect, it } from "vitest";
import { generatedJumpPackages } from "../fixtures/generatedPackages";
import { canonicalizePackage, parseFormatFile } from ".";
import conformance from "../../schema/conformance.json";
import { sha256 } from "./sha256";

const conformanceSources = import.meta.glob("../../schema/fixtures/**/*.jdef", {
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
    expect(generatedJumpPackages).toHaveLength(24);
    const failures = generatedJumpPackages.flatMap((packageItem) =>
      packageItem.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => `${packageItem.id}: ${item.code} ${item.message}`),
    );
    expect(failures).toEqual([]);
    expect(
      new Set(generatedJumpPackages.map((item) => item.exactHash)).size,
    ).toBe(24);
  });

  it("uses native Gauntlet defaults and explicit starting points", () => {
    const cosmic = generatedJumpPackages.find(
      (item) => item.id === "cosmic-odyssey",
    );
    const shadow = generatedJumpPackages.find(
      (item) => item.id === "shadow-court",
    );
    expect(cosmic).toMatchObject({ nativeGauntlet: true, startingPoints: 0 });
    expect(shadow).toMatchObject({
      nativeGauntlet: false,
      startingPoints: 800,
    });
  });

  it("canonicalizes form ownership and explicit quantity measures", () => {
    const arcane = generatedJumpPackages.find(
      (item) => item.id === "arcane-realms",
    );
    const cosmic = generatedJumpPackages.find(
      (item) => item.id === "cosmic-odyssey",
    );
    expect(
      arcane?.choices.find((choice) => choice.handle === "dragon_form")
        ?.grants[0],
    ).toMatchObject({ kind: "form", handle: "dragon_form" });
    expect(
      arcane?.choices.find((choice) => choice.handle === "draconic_resilience")
        ?.grants[0],
    ).toMatchObject({ kind: "perk", form: "dragon_form", shorthand: true });
    expect(
      cosmic?.choices.find((choice) => choice.handle === "training_manuals")
        ?.grants[0],
    ).toMatchObject({ kind: "item", measure: "quantity", shorthand: true });
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
});
