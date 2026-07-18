import { describe, expect, it } from "vitest";
import { assignQuickAddMnemonics } from "./quickAdd";

describe("assignQuickAddMnemonics", () => {
  it("walks each word until it finds a unique mnemonic", () => {
    expect(assignQuickAddMnemonics(["author", "alt", "align"])).toEqual([
      { label: "author", key: "a", index: 0 },
      { label: "alt", key: "l", index: 1 },
      { label: "align", key: "i", index: 2 },
    ]);
  });

  it("avoids reserved keys and falls back without an underline", () => {
    expect(assignQuickAddMnemonics(["author", "aaa"], ["a", "u"])).toEqual([
      { label: "author", key: "t", index: 2 },
      { label: "aaa", key: null, index: -1 },
    ]);
  });
});
