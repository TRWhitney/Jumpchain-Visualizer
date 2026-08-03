import { describe, expect, it } from "vitest";
import { parseRichText } from "./richText";

describe("Format 1 rich text", () => {
  it("produces an allowlisted token model and strips imported HTML", () => {
    const blocks = parseRichText(
      "A **bold** start <script>alert(1)</script>.\n\n- one\n- two",
    );
    expect(blocks[0]).toMatchObject({ kind: "paragraph" });
    expect(JSON.stringify(blocks)).not.toContain("<script>");
    expect(blocks[1]).toMatchObject({ kind: "list" });
  });

  it("keeps ordinary source lines flowing and marks explicit hard breaks", () => {
    expect(parseRichText("first\nsecond")).toEqual([
      {
        kind: "paragraph",
        content: [{ text: "first" }, { text: " " }, { text: "second" }],
      },
    ]);
    expect(parseRichText("first \\\nsecond")).toEqual([
      {
        kind: "paragraph",
        content: [{ text: "first", breakAfter: true }, { text: "second" }],
      },
    ]);
  });
});
