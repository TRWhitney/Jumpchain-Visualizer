import { describe, expect, it } from "vitest";

describe("browser test scaffold", () => {
  it("runs in a browser document", () => {
    expect(document.documentElement).toBeInstanceOf(HTMLElement);
  });
});
