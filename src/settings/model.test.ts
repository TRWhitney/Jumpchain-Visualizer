import { describe, expect, it } from "vitest";
import {
  SAFE_PACKAGE_SIZE_LIMITS,
  applyInterfaceExperience,
  defaultKeybindings,
  defaultSettings,
  effectivePackageSizeLimits,
  hydrateSettings,
  interfaceExperienceFor,
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
        editor: {
          permanentlyDeleteSidebarItems: true,
          layoutPreviewPlaceholderCharacterLimit: 12,
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
    expect(result.developer.showMockData).toBe(false);
    expect(result.editor.permanentlyDeleteSidebarItems).toBe(true);
    expect(result.editor.layoutPreviewPlaceholderCharacterLimit).toBe(12);
    expect(result.notifications.maxVisible).toBe(5);
    expect(result.notifications.durationMs).toBe(5000);
    expect(result.schemaVersion).toBe(5);
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

  it("starts onboarding for new installs and does not interrupt upgraded users", () => {
    const profile = createDefaultTagProfile();
    expect(
      hydrateSettings({}, profile, hydrateTagProfile).onboarding
        .welcomeTourStatus,
    ).toBe("pending");
    expect(
      hydrateSettings({ schemaVersion: 4 }, profile, hydrateTagProfile)
        .onboarding.welcomeTourStatus,
    ).toBe("dismissed");
    expect(
      hydrateSettings(
        {
          schemaVersion: 5,
          onboarding: { welcomeTourStatus: "completed" },
        },
        profile,
        hydrateTagProfile,
      ).onboarding.welcomeTourStatus,
    ).toBe("completed");
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
    expect(result.general).toEqual({
      hideTechnicalLocations: false,
      collapseOptionalSectionsByDefault: false,
    });
    expect(result.editor.collapseAdvancedViews).toBe(false);
    expect(result.editor.collapsePreviewInspectionTools).toBe(false);
    expect(result.editor.showExplanatoryText).toBe(false);
    expect(result.chain.compactJumpActions).toBe(false);
    expect(result.chain.collapseInventoryTagFilters).toBe(false);
    expect(result.developer.showMockData).toBe(false);
    expect(result.developer.showOpenProjectFolder).toBe(false);
    expect(malformed.developer.showOpenProjectFolder).toBe(false);
    expect(result.editor.permanentlyDeleteSidebarItems).toBe(false);
    expect(result.editor.layoutPreviewPlaceholderCharacterLimit).toBeNull();
    expect(result.accessibility.imageAltTextHover).toBe(true);
    expect(
      hydrateSettings(
        { accessibility: { imageAltTextHover: false } },
        profile,
        hydrateTagProfile,
      ).accessibility.imageAltTextHover,
    ).toBe(false);
    expect(
      hydrateSettings(
        { accessibility: { imageAltTextHover: "no" } },
        profile,
        hydrateTagProfile,
      ).accessibility.imageAltTextHover,
    ).toBe(true);
    expect(
      hydrateSettings(
        { editor: { permanentlyDeleteSidebarItems: "yes" } },
        profile,
        hydrateTagProfile,
      ).editor.permanentlyDeleteSidebarItems,
    ).toBe(false);
    expect(
      hydrateSettings(
        { editor: { layoutPreviewPlaceholderCharacterLimit: 0 } },
        profile,
        hydrateTagProfile,
      ).editor.layoutPreviewPlaceholderCharacterLimit,
    ).toBeNull();
    expect(
      hydrateSettings(
        { editor: { layoutPreviewPlaceholderCharacterLimit: 1_001 } },
        profile,
        hydrateTagProfile,
      ).editor.layoutPreviewPlaceholderCharacterLimit,
    ).toBeNull();
  });

  it("migrates schema v3 settings and hydrates explanatory text as schema v5", () => {
    const profile = createDefaultTagProfile();
    const result = hydrateSettings(
      {
        schemaVersion: 3,
        general: {
          hideTechnicalLocations: true,
          collapseOptionalSectionsByDefault: "yes",
        },
        editor: {
          collapseAdvancedViews: true,
          collapsePreviewInspectionTools: false,
          showExplanatoryText: true,
        },
        chain: {
          compactJumpActions: true,
          collapseInventoryTagFilters: true,
        },
      },
      profile,
      hydrateTagProfile,
    );
    expect(result.schemaVersion).toBe(5);
    expect(result.general.hideTechnicalLocations).toBe(true);
    expect(result.general.collapseOptionalSectionsByDefault).toBe(false);
    expect(result.editor.collapseAdvancedViews).toBe(true);
    expect(result.editor.collapsePreviewInspectionTools).toBe(false);
    expect(result.editor.showExplanatoryText).toBe(true);
    expect(result.chain.compactJumpActions).toBe(true);
    expect(result.chain.collapseInventoryTagFilters).toBe(true);
  });

  it("applies and identifies interface experience presets", () => {
    const settings = defaultSettings(createDefaultTagProfile());
    expect(interfaceExperienceFor(settings)).toBe("advanced");

    const novice = applyInterfaceExperience(settings, "beginner-friendly");
    expect(interfaceExperienceFor(novice)).toBe("beginner-friendly");
    expect(novice.general).toEqual({
      hideTechnicalLocations: true,
      collapseOptionalSectionsByDefault: true,
    });
    expect(novice.editor.collapseAdvancedViews).toBe(true);
    expect(novice.editor.collapsePreviewInspectionTools).toBe(true);
    expect(novice.editor.showExplanatoryText).toBe(true);
    expect(novice.chain.compactJumpActions).toBe(true);
    expect(novice.chain.collapseInventoryTagFilters).toBe(true);
    expect(novice.notifications.maxVisible).toBe(1);

    expect(
      interfaceExperienceFor({
        ...novice,
        chain: { ...novice.chain, compactJumpActions: false },
      }),
    ).toBe("custom");
    expect(
      interfaceExperienceFor({
        ...novice,
        editor: { ...novice.editor, showExplanatoryText: false },
      }),
    ).toBe("custom");
    expect(
      interfaceExperienceFor(applyInterfaceExperience(novice, "advanced")),
    ).toBe("advanced");
  });

  it("hydrates only boolean mock-data visibility and defaults it off", () => {
    const profile = createDefaultTagProfile();
    expect(
      hydrateSettings(
        { developer: { showMockData: true } },
        profile,
        hydrateTagProfile,
      ).developer.showMockData,
    ).toBe(true);
    expect(
      hydrateSettings(
        { developer: { showMockData: "yes" } },
        profile,
        hydrateTagProfile,
      ).developer.showMockData,
    ).toBe(false);
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
    const settings = defaultSettings(createDefaultTagProfile());
    expect(keybindingActions).toEqual([
      "find",
      "quickAdd",
      "format",
      "quickFix",
      "completions",
      "assetSelectTool",
      "assetPanTool",
      "assetCropTool",
      "assetPaintTool",
      "assetEraserTool",
      "assetTextTool",
      "assetLineTool",
      "assetArrowTool",
      "assetRectangleTool",
      "assetEllipseTool",
    ]);
    expect(keybindingDisplay(defaultKeybindings.completions)).toBe("⌘ Space");
    expect(keybindingDisplay(defaultKeybindings.format)).toBe("⌘ Shift F");
    expect(keybindingDisplay(defaultKeybindings.assetPaintTool)).toBe("B");
    expect(
      validateKeybinding(settings, "assetPaintTool", {
        key: "p",
        primary: false,
        alt: false,
        shift: false,
      }),
    ).toBeNull();
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
