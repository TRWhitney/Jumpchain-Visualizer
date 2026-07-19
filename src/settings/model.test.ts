import { describe, expect, it } from "vitest";
import {
  SAFE_PACKAGE_SIZE_LIMITS,
  defaultKeybindings,
  defaultSettings,
  effectivePackageSizeLimits,
  hydrateSettings,
  keybindingActions,
  keybindingDisplay,
  matchesKeybinding,
  validateKeybinding,
  validatePackageSizeLimits,
} from "./model";
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
          includeItemTagsInRadar: true,
          aggregateSimilarInventory: false,
        },
        developer: {
          showAdditionalJumpInformation: true,
          showOpenProjectFolder: true,
        },
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
    expect(result.chain.includeItemTagsInRadar).toBe(true);
    expect(result.chain.aggregateSimilarInventory).toBe(false);
    expect(result.developer.showAdditionalJumpInformation).toBe(true);
    expect(result.developer.showOpenProjectFolder).toBe(true);
    expect(result.notifications.maxVisible).toBe(5);
    expect(result.notifications.durationMs).toBe(5000);
    expect(result.schemaVersion).toBe(2);
    expect(result.language.tag).toBe("en");
  });

  it("migrates v1 settings and accepts only discovered language tags", () => {
    const profile = createDefaultTagProfile();
    expect(
      hydrateSettings(
        { schemaVersion: 1, language: { tag: "fr" } },
        profile,
        hydrateTagProfile,
        ["en", "fr"],
      ).language.tag,
    ).toBe("fr");
    expect(
      hydrateSettings(
        { schemaVersion: 2, language: { tag: "missing" } },
        profile,
        hydrateTagProfile,
        ["en", "fr"],
      ).language.tag,
    ).toBe("en");
  });

  it("defaults similar inventory aggregation on when the stored field is absent", () => {
    const profile = createDefaultTagProfile();
    const result = hydrateSettings({}, profile, hydrateTagProfile);
    const malformed = hydrateSettings(
      { developer: { showOpenProjectFolder: "yes" } },
      profile,
      hydrateTagProfile,
    );
    expect(result.chain.aggregateSimilarInventory).toBe(true);
    expect(result.developer.showOpenProjectFolder).toBe(false);
    expect(malformed.developer.showOpenProjectFolder).toBe(false);
  });

  it("hydrates only bounded internally consistent package size overrides", () => {
    const profile = createDefaultTagProfile();
    const custom = hydrateSettings(
      {
        developer: {
          useCustomPackageSizeLimits: true,
          maxArchiveMiB: 128,
          maxDefinitionFileMiB: 4,
          maxAssetFileMiB: 64,
          maxExpandedPackageMiB: 256,
        },
      },
      profile,
      hydrateTagProfile,
    );
    expect(effectivePackageSizeLimits(custom.developer)).toEqual({
      maxArchiveMiB: 128,
      maxDefinitionFileMiB: 4,
      maxAssetFileMiB: 64,
      maxExpandedPackageMiB: 256,
    });

    const invalid = hydrateSettings(
      {
        developer: {
          useCustomPackageSizeLimits: true,
          maxArchiveMiB: 513,
          maxDefinitionFileMiB: 16,
          maxAssetFileMiB: 100,
          maxExpandedPackageMiB: 10,
        },
      },
      profile,
      hydrateTagProfile,
    );
    expect(invalid.developer.useCustomPackageSizeLimits).toBe(false);
    expect(effectivePackageSizeLimits(invalid.developer)).toEqual(
      SAFE_PACKAGE_SIZE_LIMITS,
    );
    expect(
      validatePackageSizeLimits({
        maxArchiveMiB: 64,
        maxDefinitionFileMiB: 2,
        maxAssetFileMiB: 17,
        maxExpandedPackageMiB: 16,
      }),
    ).toContain("cannot exceed");
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

  it("defines, displays, and matches every Editor command binding", () => {
    expect(keybindingActions).toEqual([
      "find",
      "quickAdd",
      "format",
      "quickFix",
      "completions",
    ]);
    expect(keybindingDisplay(defaultKeybindings.completions)).toBe("⌘ Space");
    expect(keybindingDisplay(defaultKeybindings.format)).toBe("⌘ Shift F");
    expect(
      matchesKeybinding(
        {
          key: "F",
          code: "KeyF",
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: true,
        },
        defaultKeybindings.format,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        {
          key: " ",
          code: "Space",
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        },
        defaultKeybindings.completions,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        {
          key: "p",
          code: "KeyP",
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        },
        { key: "p", primary: true, alt: false, shift: false },
      ),
    ).toBe(true);
  });
});
