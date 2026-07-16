import { describe, expect, it } from "vitest";
import { defaultSettings, hydrateSettings, validateKeybinding } from "./model";
import { createDefaultTagProfile, hydrateTagProfile } from "./tagProfile";

describe("application settings", () => {
  it("hydrates valid values while defaulting invalid values independently", () => {
    const profile = createDefaultTagProfile();
    const result = hydrateSettings(
      {
        schemaVersion: 0,
        appearance: { theme: "dark", accentColor: "javascript:bad" },
        chain: {
          warnUpstreamChanges: true,
          allowRerolls: "yes",
          allowDuplicateJumps: true,
        },
        developer: { showAdditionalJumpInformation: true },
        notifications: { maxVisible: 5, durationMs: 1234 },
      },
      profile,
      hydrateTagProfile,
    );
    expect(result.appearance.theme).toBe("dark");
    expect(result.appearance.accentColor).toBe("#d4af37");
    expect(result.chain.warnUpstreamChanges).toBe(true);
    expect(result.chain.allowRerolls).toBe(false);
    expect(result.chain.allowDuplicateJumps).toBe(true);
    expect(result.developer.showAdditionalJumpInformation).toBe(true);
    expect(result.notifications.maxVisible).toBe(5);
    expect(result.notifications.durationMs).toBe(5000);
  });

  it("rejects duplicate, unmodified, and platform-reserved bindings", () => {
    const settings = defaultSettings(createDefaultTagProfile());
    expect(
      validateKeybinding(settings, "quickAdd", {
        key: "f",
        primary: true,
        alt: false,
        shift: false,
      }),
    ).toContain("already assigned");
    expect(
      validateKeybinding(settings, "quickAdd", {
        key: "x",
        primary: false,
        alt: false,
        shift: false,
      }),
    ).toContain("modifier");
    expect(
      validateKeybinding(settings, "quickAdd", {
        key: "l",
        primary: true,
        alt: false,
        shift: false,
      }),
    ).toContain("reserved");
  });
});
