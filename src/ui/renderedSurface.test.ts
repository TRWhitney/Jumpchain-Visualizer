import { describe, expect, it } from "vitest";
import { compositeRenderedColors, parseRenderedColor } from "./renderedSurface";

describe("rendered surface colors", () => {
  it("parses computed rgb and rgba forms", () => {
    expect(parseRenderedColor("rgb(12, 34, 56)")).toEqual({
      red: 12,
      green: 34,
      blue: 56,
      alpha: 1,
    });
    expect(parseRenderedColor("rgba(20, 40, 60, 0.5)")).toEqual({
      red: 20,
      green: 40,
      blue: 60,
      alpha: 0.5,
    });
  });

  it("composites translucent layers before choosing readable text", () => {
    expect(
      compositeRenderedColors(
        { red: 255, green: 255, blue: 255, alpha: 0.5 },
        { red: 0, green: 0, blue: 0, alpha: 1 },
      ),
    ).toEqual({ red: 127.5, green: 127.5, blue: 127.5, alpha: 1 });
  });
});
