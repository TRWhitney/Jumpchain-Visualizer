import { describe, expect, it } from "vitest";
import { storySegments, storyTokenParts } from "./storyRichText";

describe("story rich-text tokens", () => {
  it("preserves token precedence, delimiters, colors, and plain gaps", () => {
    expect(
      storySegments(
        "A **bold** *italic* ++under++ ~~strike~~ {{#12AbEF|color}} Z",
      ),
    ).toEqual([
      { type: "plain", raw: "A " },
      { type: "bold", raw: "**bold**" },
      { type: "plain", raw: " " },
      { type: "italic", raw: "*italic*" },
      { type: "plain", raw: " " },
      { type: "underline", raw: "++under++" },
      { type: "plain", raw: " " },
      { type: "strike", raw: "~~strike~~" },
      { type: "plain", raw: " " },
      { type: "color", raw: "{{#12AbEF|color}}" },
      { type: "plain", raw: " Z" },
    ]);
    expect(storyTokenParts("bold", "**bold**")).toEqual({
      open: "**",
      content: "bold",
      close: "**",
      color: "",
    });
    expect(storyTokenParts("color", "{{#12AbEF|color}}")).toEqual({
      open: "{{#12AbEF|",
      content: "color",
      close: "}}",
      color: "#12AbEF",
    });
  });

  it("leaves incomplete and multiline tokens byte-equivalent as plain text", () => {
    expect(storySegments("**open\nclose**")).toEqual([
      { type: "plain", raw: "**open\nclose**" },
    ]);
    expect(storySegments("")).toEqual([{ type: "plain", raw: "" }]);
  });
});
