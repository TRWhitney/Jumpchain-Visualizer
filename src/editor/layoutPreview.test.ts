import { describe, expect, it } from "vitest";
import type { CanonicalJumpPackage, JumpLayout, LayoutNode } from "../markup";
import { createLayoutPreviewFixture } from "./layoutPreview";

const leaf = (kind: LayoutNode["kind"], target?: string): LayoutNode => ({
  kind,
  target,
  presentation: {},
  children: [],
});

const root = (...children: readonly LayoutNode[]): LayoutNode => ({
  kind: "stack",
  presentation: { gap: "md" },
  children,
});

const choiceLayout: JumpLayout = {
  kind: "choice-layout",
  handle: "choice_card",
  root: root(
    leaf("slot", "name"),
    leaf("slot", "cost"),
    leaf("slot", "tags"),
    leaf("text", "description"),
    leaf("image", "hero"),
    leaf("input", "notes"),
    leaf("slot", "control"),
    leaf("slot", "roll"),
  ),
};

const sectionLayout: JumpLayout = {
  kind: "section-layout",
  handle: "section_page",
  root: root(
    leaf("slot", "name"),
    leaf("slot", "roll"),
    leaf("text", "introduction"),
    leaf("image", "banner"),
    {
      kind: "expand",
      source: "main",
      using: choiceLayout.handle,
      presentation: {},
      children: [],
    },
    leaf("choice", "featured"),
  ),
};

const traitLayout: JumpLayout = {
  kind: "trait-layout",
  handle: "trait_card",
  root: root(
    leaf("slot", "name"),
    leaf("text", "details"),
    leaf("image", "icon"),
  ),
};

const packageItem: CanonicalJumpPackage = {
  id: "layout-fixture",
  logicalId: "layout-fixture",
  exactHash: "0".repeat(64),
  format: 1,
  name: { base: "Fixture", variants: [] },
  authors: ["Tester"],
  version: "1",
  description: "Fixture",
  source: "mock",
  nativeGauntlet: false,
  startingPoints: 1_000,
  pointsName: { base: "Choice Points", variants: [] },
  pointsAbbreviation: { base: "CP", variants: [] },
  resources: [],
  sections: [],
  choices: [],
  layouts: [sectionLayout, choiceLayout, traitLayout],
  themes: {},
  tags: [],
  diagnostics: [],
};

describe("layout preview fixtures", () => {
  it("keeps representative text complete by default and truncates every placeholder when configured", () => {
    const complete = createLayoutPreviewFixture(packageItem, sectionLayout);
    const truncated = createLayoutPreviewFixture(
      packageItem,
      sectionLayout,
      10,
    );
    expect(complete.kind).toBe("section-layout");
    expect(truncated.kind).toBe("section-layout");
    if (complete.kind !== "section-layout") return;
    if (truncated.kind !== "section-layout") return;

    expect(complete.section.name.base).toBe("Example section");
    expect(complete.section.text[0].content.base).toBe(
      "Example content for “introduction”.",
    );
    expect(truncated.section.name.base).toBe("Example se");
    expect(truncated.section.text[0].content.base).toBe("Example co");
    expect(
      truncated.packageItem.choices.every(
        (choice) =>
          [...(choice.name.base ?? "")].length <= 10 &&
          choice.text.every(
            (text) => [...(text.content.base ?? "")].length <= 10,
          ),
      ),
    ).toBe(true);
  });

  it("populates section fields, expands, and direct choices", () => {
    const fixture = createLayoutPreviewFixture(packageItem, sectionLayout);
    expect(fixture.kind).toBe("section-layout");
    if (fixture.kind !== "section-layout") return;

    expect(fixture.section.layout).toBe(sectionLayout.handle);
    expect(fixture.section.text.map((item) => item.handle)).toEqual([
      "introduction",
    ]);
    expect(fixture.section.images.map((item) => item.handle)).toEqual([
      "banner",
    ]);
    expect(fixture.section.sources).toMatchObject([
      { handle: "main", group: "preview_group_1" },
    ]);
    expect(fixture.section.directChoices).toEqual([
      { handle: "featured", target: "preview_direct_choice_1" },
    ]);
    expect(fixture.packageItem.choices).toHaveLength(3);
    expect(fixture.activeChoiceHandles).toEqual([
      "preview_source_1_choice_1",
      "preview_source_1_choice_2",
    ]);
    expect(fixture.packageItem.choices[0]).toMatchObject({
      layout: choiceLayout.handle,
      groups: ["preview_group_1"],
    });
    expect(fixture.packageItem.choices[0].text[0].handle).toBe("description");
    expect(fixture.packageItem.choices[0].images[0].handle).toBe("hero");
    expect(fixture.packageItem.choices[0].inputs[0].handle).toBe("notes");
  });

  it("populates every choice-layout content namespace and built-in slot data", () => {
    const fixture = createLayoutPreviewFixture(packageItem, choiceLayout);
    expect(fixture.kind).toBe("choice-layout");
    if (fixture.kind !== "choice-layout") return;

    expect(fixture.choice.layout).toBe(choiceLayout.handle);
    expect(fixture.choice.name.base).toContain("1");
    expect(fixture.choice.costs).toHaveLength(1);
    expect(fixture.choice.tags).toHaveLength(1);
    expect(fixture.choice.text.map((item) => item.handle)).toEqual([
      "description",
    ]);
    expect(fixture.choice.images.map((item) => item.handle)).toEqual(["hero"]);
    expect(fixture.choice.inputs.map((item) => item.handle)).toEqual(["notes"]);
    expect(fixture.activeChoiceHandles).toEqual([fixture.choice.handle]);
  });

  it("populates trait names, text, and images", () => {
    const fixture = createLayoutPreviewFixture(packageItem, traitLayout);
    expect(fixture.kind).toBe("trait-layout");
    if (fixture.kind !== "trait-layout") return;

    expect(fixture.trait.layout).toBe(traitLayout.handle);
    expect(fixture.trait.name).toBeTruthy();
    expect(fixture.trait.text?.map((item) => item.handle)).toEqual(["details"]);
    expect(fixture.trait.images?.map((item) => item.handle)).toEqual(["icon"]);
  });
});
