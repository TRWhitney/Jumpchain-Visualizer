import { describe, expect, it } from "vitest";
import format1Schema from "../../schema/format-1.json";
import { format1DeclarationWords } from "./format1Syntax";

describe("Format 1 syntax highlighting vocabulary", () => {
  it("tracks every declaration and layout node in the schema", () => {
    const expected = new Set([
      ...Object.keys(format1Schema.declarations),
      ...Object.keys(format1Schema.layoutNodes),
    ]);

    expect([...format1DeclarationWords].sort()).toEqual([...expected].sort());
    expect(format1DeclarationWords).toContain("jump-appearance");
  });
});
