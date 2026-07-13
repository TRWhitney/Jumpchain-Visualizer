import { describe, expect, it } from "vitest";
import { accentTokens, contrastRatio } from "./appearance";

describe("accessible accent derivation", () => {
  it.each(["light", "dark"] as const)(
    "derives readable text and focus tokens for %s mode",
    (theme) => {
      const tokens = accentTokens("#d4af37", theme);
      const background = theme === "dark" ? "#171717" : "#f6f5f1";
      expect(
        contrastRatio(tokens["--app-accent-text"], background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(tokens["--app-accent-focus"], background),
      ).toBeGreaterThanOrEqual(3);
      expect(tokens["--app-accent-fill-text"]).toMatch(/^#[0-9a-f]{6}$/);
    },
  );
});
