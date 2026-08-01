import { describe, expect, it } from "vitest";
import { defaultExplorerGroupExpanded } from "./useEditorDisclosureController";

describe("defaultExplorerGroupExpanded", () => {
  it("preserves novice defaults without collapsing primary content", () => {
    expect(defaultExplorerGroupExpanded("content:sections", true)).toBe(true);
    expect(defaultExplorerGroupExpanded("content:layouts", true)).toBe(false);
    expect(defaultExplorerGroupExpanded("files:trash", true)).toBe(false);
    expect(defaultExplorerGroupExpanded("content:layouts", false)).toBe(true);
  });
});
