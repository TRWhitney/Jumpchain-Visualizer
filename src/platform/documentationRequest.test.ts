import { describe, expect, it } from "vitest";
import { documentationRequestNeedsVite } from "./documentationRequest";

describe("documentation development requests", () => {
  it("leaves CSS module requests to Vite while directly serving documentation assets", () => {
    expect(documentationRequestNeedsVite("/styles.css", "script")).toBe(true);
    expect(documentationRequestNeedsVite("/styles.css?import", "style")).toBe(
      true,
    );
    expect(documentationRequestNeedsVite("/styles.css", "style")).toBe(false);
    expect(documentationRequestNeedsVite("/editor-design.js", "script")).toBe(
      false,
    );
  });
});
