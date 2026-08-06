import { describe, expect, it } from "vitest";
import {
  accentTokens,
  contrastRatio,
  resolveThemePreference,
} from "./appearance";

it("resolves system themes from the current platform preference", () => {
  expect(resolveThemePreference("system", false)).toBe("light");
  expect(resolveThemePreference("system", true)).toBe("dark");
  expect(resolveThemePreference("light", true)).toBe("light");
  expect(resolveThemePreference("dark", false)).toBe("dark");
});

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
