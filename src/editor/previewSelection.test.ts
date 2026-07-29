import { describe, expect, it } from "vitest";
import { Format1LanguageService } from "./languageService";
import { previewSelectionForSymbol } from "./previewSelection";

const source = `jump
  format: 1
  name: "Preview"
  author: "Tester"
  version: "1"

section
  handle: introduction
  name: "Introduction"

  text
    handle: body
    content: "Body"

  image
    handle: visual
    src: "visual.png"
    alt: "Visual"

  choice-source
    handle: available
    group: options

  choice
    handle: featured
    target: alpha

choice
  handle: alpha
  name: "Alpha"
  selection: toggle

section-layout
  handle: shared_layout

  stack
    slot: name

choice-layout
  handle: shared_layout

  stack
    slot: name

trait-layout
  handle: shared_layout

  stack
    slot: name
`;

describe("Structured preview selection", () => {
  const files = { "jump.jdef": source };
  const symbols = new Format1LanguageService().analyze(files).symbols;
  const symbol = (kind: string, handle: string) =>
    symbols.find((item) => item.kind === kind && item.handle === handle)!;

  it.each([
    ["text", "body", { kind: "section", handle: "introduction" }],
    [
      "image",
      "visual",
      {
        kind: "image",
        handle: "visual",
        src: "visual.png",
        alt: "Visual",
        sectionHandle: "introduction",
      },
    ],
    [
      "choice-source",
      "available",
      {
        kind: "choice-source",
        handle: "available",
        sectionHandle: "introduction",
      },
    ],
    [
      "choice",
      "featured",
      { kind: "choice", handle: "alpha", sectionHandle: "introduction" },
    ],
  ])("maps %s %s to its relevant preview", (kind, handle, expected) => {
    expect(previewSelectionForSymbol(files, symbol(kind, handle))).toEqual(
      expected,
    );
  });

  it.each(["section-layout", "choice-layout", "trait-layout"])(
    "preserves the %s namespace when layout handles collide",
    (kind) => {
      expect(
        previewSelectionForSymbol(files, symbol(kind, "shared_layout")),
      ).toEqual({
        kind: "layout",
        handle: "shared_layout",
        layoutKind: kind,
      });
    },
  );
});
