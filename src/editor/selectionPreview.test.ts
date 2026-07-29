import { describe, expect, it } from "vitest";
import type { CanonicalJumpPackage, JumpChoice, JumpLayout } from "../markup";
import { selectedChoicePreviewPackage } from "./selectionPreview";

const choice = (handle: string, layout?: string): JumpChoice => ({
  handle,
  name: { base: handle, variants: [] },
  layout,
  tags: [],
  groups: [],
  selection: "toggle",
  resolution: "either",
  options: [],
  text: [],
  images: [],
  inputs: [],
  costs: [],
  grants: [],
});

const layout = (handle: string): JumpLayout => ({
  kind: "choice-layout",
  handle,
  root: {
    kind: "stack",
    presentation: {},
    children: [],
  },
});

const packageItem = (
  choices: readonly JumpChoice[],
  layouts: readonly JumpLayout[],
): CanonicalJumpPackage => ({
  id: "preview",
  logicalId: "preview",
  exactHash: "0".repeat(64),
  format: 1,
  name: { base: "Preview", variants: [] },
  authors: ["Tester"],
  version: "1",
  description: "Preview",
  source: "mock",
  nativeGauntlet: false,
  startingPoints: 1000,
  pointsName: { base: "Choice Points", variants: [] },
  pointsAbbreviation: { base: "CP", variants: [] },
  resources: [],
  sections: [],
  choices,
  layouts,
  themes: {},
  tags: [],
  diagnostics: [],
});

describe("selected Choice preview package", () => {
  it("overlays the current Choice and Choice-layout namespace on a valid fallback", () => {
    const fallback = packageItem(
      [choice("dropin"), choice("stable")],
      [layout("stale")],
    );
    const current = {
      ...packageItem([choice("dropin", "origin")], [layout("origin")]),
      themes: { accent: "#112233" },
    };

    const preview = selectedChoicePreviewPackage(fallback, current, "dropin");

    expect(preview.choices).toEqual([
      choice("stable"),
      choice("dropin", "origin"),
    ]);
    expect(preview.layouts).toEqual([layout("origin")]);
    expect(preview.themes).toEqual({ accent: "#112233" });
  });

  it("does not retain a stale custom or default Choice layout after clearing it", () => {
    const fallback = {
      ...packageItem([choice("dropin", "origin")], [layout("origin")]),
      defaultChoiceLayout: "origin",
    };
    const current = packageItem([choice("dropin")], []);

    const preview = selectedChoicePreviewPackage(fallback, current, "dropin");

    expect(preview.choices[0].layout).toBeUndefined();
    expect(preview.defaultChoiceLayout).toBeUndefined();
    expect(preview.layouts).toEqual([]);
  });
});
