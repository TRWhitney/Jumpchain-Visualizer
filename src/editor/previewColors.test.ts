import { describe, expect, it } from "vitest";
import type { CanonicalJumpPackage, LayoutNode } from "../markup";
import { defaultCostAppearanceColors } from "../renderer/jumpAppearance";
import { stripPreviewColors } from "./previewColors";

const packageItem: CanonicalJumpPackage = {
  id: "color-preview-fixture",
  logicalId: "color-preview-fixture",
  exactHash: "0".repeat(64),
  format: 1,
  name: { base: "Color preview fixture", variants: [] },
  authors: ["Tester"],
  version: "1",
  description: "Color preview fixture",
  source: "mock",
  nativeGauntlet: false,
  startingPoints: 1_000,
  pointsName: { base: "Choice Points", variants: [] },
  pointsAbbreviation: { base: "CP", variants: [] },
  resources: [],
  sections: [],
  choices: [],
  themes: {
    surface: "#123456",
    foreground: "#fedcba",
    divider: "#ff0000",
  },
  appearance: {
    background: "surface",
    "text-color": "foreground",
    "cost-benefit-background": "#abcdef",
    corners: "lg",
  },
  layouts: [
    {
      kind: "choice-layout",
      handle: "colored_card",
      root: {
        kind: "stack",
        presentation: {
          gap: "sm",
          background: "surface",
          textColor: "foreground",
        },
        children: [
          {
            kind: "rule",
            presentation: {
              color: "divider",
              thickness: 2,
              style: "dash",
            },
            children: [],
          },
          {
            kind: "text",
            target: "description",
            presentation: {
              padding: "md",
              background: "red",
              textColor: "white",
              textSize: "lg",
            },
            children: [],
          },
        ],
      },
    },
  ],
  tags: [],
  diagnostics: [],
};

describe("stripPreviewColors", () => {
  it("removes authored colors at every layout depth while retaining presentation", () => {
    const stripped = stripPreviewColors(packageItem);
    const root = stripped.layouts[0].root;
    const [rule, text] = root.children as readonly LayoutNode[];

    expect(stripped.themes).toEqual({});
    expect(stripped.appearance).toEqual({
      corners: "lg",
      ...defaultCostAppearanceColors,
    });
    expect(root.presentation).toEqual({ gap: "sm" });
    expect(rule.presentation).toEqual({ thickness: 2, style: "dash" });
    expect(text.presentation).toEqual({ padding: "md", textSize: "lg" });
  });

  it("does not mutate the package used by the editor or persistence", () => {
    const stripped = stripPreviewColors(packageItem);

    expect(stripped).not.toBe(packageItem);
    expect(stripped.layouts).not.toBe(packageItem.layouts);
    expect(stripped.layouts[0].root).not.toBe(packageItem.layouts[0].root);
    expect(packageItem.themes).toEqual({
      surface: "#123456",
      foreground: "#fedcba",
      divider: "#ff0000",
    });
    expect(packageItem.appearance).toEqual({
      background: "surface",
      "text-color": "foreground",
      "cost-benefit-background": "#abcdef",
      corners: "lg",
    });
    expect(packageItem.layouts[0].root.presentation).toMatchObject({
      background: "surface",
      textColor: "foreground",
    });
    expect(packageItem.layouts[0].root.children[0].presentation.color).toBe(
      "divider",
    );
  });
});
