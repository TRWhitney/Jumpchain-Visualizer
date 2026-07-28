import { describe, expect, it } from "vitest";
import { parseFormatFile } from "../markup";
import { insertJumpAppearanceSource } from "./appearanceSource";

describe("Jump appearance source placement", () => {
  it("inserts after leading comments and before themes and layouts", () => {
    expect(
      insertJumpAppearanceSource(`# Package presentation
# Keep this note
theme
  handle: paper
  color: "#ffffff"

section-layout
  handle: cards
`),
    ).toBe(`# Package presentation
# Keep this note
jump-appearance

theme
  handle: paper
  color: "#ffffff"

section-layout
  handle: cards
`);
  });

  it("keeps adjacent declarations valid Format 1 source", () => {
    const parsed = parseFormatFile(
      "layout.jdef",
      `jump-appearance
theme
  handle: paper
  color: "#ffffff"
`,
    );
    expect(parsed.tree.map((node) => node.kind)).toEqual([
      "jump-appearance",
      "theme",
    ]);
    expect(parsed.diagnostics).toEqual([]);
  });
});
