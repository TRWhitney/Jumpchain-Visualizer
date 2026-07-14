import { describe, expect, it } from "vitest";
import { dropEdgeAtPointer, dropIndexForTarget } from "./dragReorder";

describe("drag reorder positioning", () => {
  it("selects the edge nearest the pointer", () => {
    const bounds = { top: 100, height: 40 } as DOMRect;
    expect(dropEdgeAtPointer(101, bounds)).toBe("before");
    expect(dropEdgeAtPointer(119, bounds)).toBe("before");
    expect(dropEdgeAtPointer(120, bounds)).toBe("after");
    expect(dropEdgeAtPointer(139, bounds)).toBe("after");
  });

  it("places chapters on the indicated edge in forward display order", () => {
    expect(dropIndexForTarget(0, 2, "before", "forward")).toBe(1);
    expect(dropIndexForTarget(0, 2, "after", "forward")).toBe(2);
    expect(dropIndexForTarget(2, 0, "before", "forward")).toBe(0);
    expect(dropIndexForTarget(2, 0, "after", "forward")).toBe(1);
  });

  it("places chain jumps on the indicated edge in reverse display order", () => {
    expect(dropIndexForTarget(1, 3, "before", "reverse")).toBe(3);
    expect(dropIndexForTarget(1, 3, "after", "reverse")).toBe(2);
    expect(dropIndexForTarget(3, 1, "before", "reverse")).toBe(2);
    expect(dropIndexForTarget(3, 1, "after", "reverse")).toBe(1);
  });
});
