import { describe, expect, it } from "vitest";
import { editorFieldControlKind } from "./fieldControlDispatch";

const classify = (
  overrides: Partial<Parameters<typeof editorFieldControlKind>[0]> = {},
) =>
  editorFieldControlKind({
    declarationKind: "choice",
    fieldName: "value",
    fieldType: "quotedString",
    hasEnumValues: false,
    enumHasDescriptions: false,
    hasReference: false,
    ...overrides,
  });

describe("Editor field control dispatch", () => {
  it("preserves the specialized control precedence", () => {
    expect(classify({ fieldType: "boolean", hasReference: true })).toBe(
      "boolean",
    );
    expect(
      classify({
        declarationKind: "image",
        fieldName: "rounded-intensity",
        fieldType: "number",
      }),
    ).toBe("image-effect-range");
    expect(classify({ fieldType: "color", hasEnumValues: true })).toBe("color");
    expect(
      classify({
        fieldType: "enum",
        hasEnumValues: true,
        enumHasDescriptions: true,
      }),
    ).toBe("described-enum");
  });

  it("selects every remaining control family", () => {
    expect(classify({ fieldType: "quotedString:assetRelativePath" })).toBe(
      "asset",
    );
    expect(classify({ fieldType: "imageDimension" })).toBe("image-dimension");
    expect(classify({ fieldType: "enum", hasEnumValues: true })).toBe("enum");
    expect(classify({ fieldName: "description" })).toBe("rich-text");
    expect(classify({ fieldType: "integer" })).toBe("number");
    expect(classify({ hasReference: true })).toBe("reference");
    expect(
      classify({ declarationKind: "choice-source", fieldName: "group" }),
    ).toBe("choice-source-group");
    expect(classify({ fieldName: "name" })).toBe("spelling-text");
    expect(classify()).toBe("text");
  });
});
