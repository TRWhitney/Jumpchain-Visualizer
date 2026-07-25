import { describe, expect, it } from "vitest";
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
});
