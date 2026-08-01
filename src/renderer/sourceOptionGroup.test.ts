import { describe, expect, it } from "vitest";
import { sourceOptionGroupName } from "./sourceOptionGroup";

describe("sourceOptionGroupName", () => {
  it("separates sources that reuse a handle for different choice groups", () => {
    const manual = sourceOptionGroupName("entry-2", "jumper", {
      handle: "assignment",
      group: "single_manual",
    });
    const random = sourceOptionGroupName("entry-2", "jumper", {
      handle: "assignment",
      group: "single_random",
    });

    expect(manual).not.toBe(random);
  });

  it("separates the same semantic group by entry and actor", () => {
    const source = { handle: "assignment", group: "single_manual" };

    expect(sourceOptionGroupName("entry-2", "jumper", source)).not.toBe(
      sourceOptionGroupName("entry-3", "jumper", source),
    );
    expect(sourceOptionGroupName("entry-2", "jumper", source)).not.toBe(
      sourceOptionGroupName("entry-2", "companion", source),
    );
  });
});
