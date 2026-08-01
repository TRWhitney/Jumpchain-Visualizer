import { describe, expect, it } from "vitest";
import { exactHashForSourceFiles } from "./packageSources";

describe("source-file package identity", () => {
  it("is stable across object insertion order and sensitive to file identity", () => {
    const first = exactHashForSourceFiles({ b: "second", a: "first" });
    expect(exactHashForSourceFiles({ a: "first", b: "second" })).toBe(first);
    expect(exactHashForSourceFiles({ a: "first", c: "second" })).not.toBe(
      first,
    );
  });
});
