import { describe, expect, it } from "vitest";
import { nextRovingTabIndex } from "./rovingTabs";

describe("nextRovingTabIndex", () => {
  it("preserves wrapping, boundary, and orientation behavior", () => {
    expect(nextRovingTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextRovingTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextRovingTabIndex("Home", 2, 3)).toBe(0);
    expect(nextRovingTabIndex("End", 0, 3)).toBe(2);
    expect(nextRovingTabIndex("ArrowDown", 0, 3)).toBeNull();
    expect(nextRovingTabIndex("ArrowDown", 0, 3, "both")).toBe(1);
    expect(nextRovingTabIndex("ArrowRight", 0, 3, "vertical")).toBeNull();
    expect(nextRovingTabIndex("Enter", 0, 3)).toBeNull();
  });
});
