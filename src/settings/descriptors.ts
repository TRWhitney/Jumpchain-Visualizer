import { translate } from "../localization";
import {
  interfaceExperienceFor,
  type ApplicationSettings,
  type SettingsCategory,
} from "./model";

export const categoriesFor = (): { id: SettingsCategory; label: string }[] => {
  return [
    { id: "general", label: translate("settings.categories.general") },
    { id: "editor", label: translate("settings.categories.editor") },
    { id: "chain", label: translate("settings.categories.chain") },
    {
      id: "notifications",
      label: translate("settings.categories.notifications"),
    },
    { id: "tags", label: translate("settings.categories.tags") },
    { id: "keys", label: translate("settings.categories.keys") },
    {
      id: "accessibility",
      label: translate("settings.categories.accessibility"),
    },
    { id: "developer", label: translate("settings.categories.developer") },
  ];
};

export type SettingsSectionId =
  | "general-essentials"
  | "general-interface"
  | "general-welcome"
  | "editor-workflow"
  | "editor-display"
  | "editor-warnings"
  | "chain-controls"
  | "chain-inventory"
  | "chain-warnings";

export const initiallyExpandedSections: Record<SettingsSectionId, boolean> = {
  "general-essentials": true,
  "general-interface": true,
  "general-welcome": true,
  "editor-workflow": true,
  "editor-display": true,
  "editor-warnings": true,
  "chain-controls": true,
  "chain-inventory": true,
  "chain-warnings": true,
};

export const sectionForSettingId: Partial<Record<string, SettingsSectionId>> = {
  "interface-experience": "general-essentials",
  "language-selection": "general-essentials",
  theme: "general-essentials",
  accent: "general-essentials",
  "hide-technical-locations": "general-interface",
  "collapse-optional-sections": "general-interface",
  "welcome-tour": "general-welcome",
  "save-mode": "editor-workflow",
  "permanent-sidebar-delete": "editor-workflow",
  "show-explanatory-text": "editor-display",
  "collapse-advanced-views": "editor-display",
  "collapse-preview-inspection-tools": "editor-display",
  "layout-preview-placeholder-limit": "editor-display",
  "warn-alt": "editor-warnings",
  "warn-layout": "editor-warnings",
  "compact-jump-actions": "chain-controls",
  "collapse-inventory-tag-filters": "chain-controls",
  "multiple-versions": "chain-controls",
  "duplicate-jumps": "chain-controls",
  "negative-balances": "chain-controls",
  rerolls: "chain-controls",
  "aggregate-similar-inventory": "chain-inventory",
  "item-tags-radar": "chain-inventory",
  "color-chain": "chain-inventory",
  upstream: "chain-warnings",
};

export const searchEntries = [
  [
    "settingsSearch.interfaceExperience.label",
    "general.interfaceExperience",
    "general",
    "interface-experience",
    "settingsSearch.interfaceExperience.aliases",
  ],
  [
    "settingsSearch.general_hideTechnicalLocations.label",
    "general.hideTechnicalLocations",
    "general",
    "hide-technical-locations",
    "settingsSearch.general_hideTechnicalLocations.aliases",
  ],
  [
    "settingsSearch.general_collapseOptionalSectionsByDefault.label",
    "general.collapseOptionalSectionsByDefault",
    "general",
    "collapse-optional-sections",
    "settingsSearch.general_collapseOptionalSectionsByDefault.aliases",
  ],
  [
    "settingsSearch.language_tag.label",
    "language.tag",
    "general",
    "language-selection",
    "settingsSearch.language_tag.aliases",
  ],
  [
    "settingsSearch.appearance_theme.label",
    "appearance.theme",
    "general",
    "theme",
    "settingsSearch.appearance_theme.aliases",
  ],
  [
    "settingsSearch.appearance_accentColor.label",
    "appearance.accentColor",
    "general",
    "accent",
    "settingsSearch.appearance_accentColor.aliases",
  ],
  [
    "settingsSearch.editor_saveMode.label",
    "editor.saveMode",
    "editor",
    "save-mode",
    "settingsSearch.editor_saveMode.aliases",
  ],
  [
    "settingsSearch.editor_layoutPreviewPlaceholderCharacterLimit.label",
    "editor.layoutPreviewPlaceholderCharacterLimit",
    "editor",
    "layout-preview-placeholder-limit",
    "settingsSearch.editor_layoutPreviewPlaceholderCharacterLimit.aliases",
  ],
  [
    "settingsSearch.editor_warnMissingImageAlt.label",
    "editor.warnMissingImageAlt",
    "editor",
    "warn-alt",
    "settingsSearch.editor_warnMissingImageAlt.aliases",
  ],
  [
    "settingsSearch.editor_warnMissingLayoutTargets.label",
    "editor.warnMissingLayoutTargets",
    "editor",
    "warn-layout",
    "settingsSearch.editor_warnMissingLayoutTargets.aliases",
  ],
  [
    "settingsSearch.editor_permanentlyDeleteSidebarItems.label",
    "editor.permanentlyDeleteSidebarItems",
    "editor",
    "permanent-sidebar-delete",
    "settingsSearch.editor_permanentlyDeleteSidebarItems.aliases",
  ],
  [
    "settingsSearch.editor_collapseAdvancedViews.label",
    "editor.collapseAdvancedViews",
    "editor",
    "collapse-advanced-views",
    "settingsSearch.editor_collapseAdvancedViews.aliases",
  ],
  [
    "settingsSearch.editor_collapsePreviewInspectionTools.label",
    "editor.collapsePreviewInspectionTools",
    "editor",
    "collapse-preview-inspection-tools",
    "settingsSearch.editor_collapsePreviewInspectionTools.aliases",
  ],
  [
    "settingsSearch.editor_showExplanatoryText.label",
    "editor.showExplanatoryText",
    "editor",
    "show-explanatory-text",
    "settingsSearch.editor_showExplanatoryText.aliases",
  ],
  [
    "settingsSearch.chain_allowMultiplePackageVersions.label",
    "chain.allowMultiplePackageVersions",
    "chain",
    "multiple-versions",
    "settingsSearch.chain_allowMultiplePackageVersions.aliases",
  ],
  [
    "settingsSearch.chain_allowDuplicateJumps.label",
    "chain.allowDuplicateJumps",
    "chain",
    "duplicate-jumps",
    "settingsSearch.chain_allowDuplicateJumps.aliases",
  ],
  [
    "settingsSearch.chain_allowNegativePointBalances.label",
    "chain.allowNegativePointBalances",
    "chain",
    "negative-balances",
    "settingsSearch.chain_allowNegativePointBalances.aliases",
  ],
  [
    "settingsSearch.chain_allowRerolls.label",
    "chain.allowRerolls",
    "chain",
    "rerolls",
    "settingsSearch.chain_allowRerolls.aliases",
  ],
  [
    "settingsSearch.chain_includeItemTagsInRadar.label",
    "chain.includeItemTagsInRadar",
    "chain",
    "item-tags-radar",
    "settingsSearch.chain_includeItemTagsInRadar.aliases",
  ],
  [
    "settingsSearch.chain_aggregateSimilarInventory.label",
    "chain.aggregateSimilarInventory",
    "chain",
    "aggregate-similar-inventory",
    "settingsSearch.chain_aggregateSimilarInventory.aliases",
  ],
  [
    "settingsSearch.chain_warnUpstreamChanges.label",
    "chain.warnUpstreamChanges",
    "chain",
    "upstream",
    "settingsSearch.chain_warnUpstreamChanges.aliases",
  ],
  [
    "settingsSearch.chain_colorNamesByPrimaryTag.label",
    "chain.colorNamesByPrimaryTag",
    "chain",
    "color-chain",
    "settingsSearch.chain_colorNamesByPrimaryTag.aliases",
  ],
  [
    "settingsSearch.chain_compactJumpActions.label",
    "chain.compactJumpActions",
    "chain",
    "compact-jump-actions",
    "settingsSearch.chain_compactJumpActions.aliases",
  ],
  [
    "settingsSearch.chain_collapseInventoryTagFilters.label",
    "chain.collapseInventoryTagFilters",
    "chain",
    "collapse-inventory-tag-filters",
    "settingsSearch.chain_collapseInventoryTagFilters.aliases",
  ],
  [
    "settingsSearch.notifications_.label",
    "notifications.*",
    "notifications",
    "notifications-enabled",
    "settingsSearch.notifications_.aliases",
  ],
  [
    "settingsSearch.tags_profile.label",
    "tags.profile",
    "tags",
    "tag-profile-search",
    "settingsSearch.tags_profile.aliases",
  ],
  [
    "settingsSearch.keybindings_overrides.label",
    "keybindings.overrides",
    "keys",
    "keybindings",
    "settingsSearch.keybindings_overrides.aliases",
  ],
  [
    "settingsSearch.accessibility_motion.label",
    "accessibility.motion",
    "accessibility",
    "motion",
    "settingsSearch.accessibility_motion.aliases",
  ],
  [
    "settingsSearch.accessibility_imageAltTextHover.label",
    "accessibility.imageAltTextHover",
    "accessibility",
    "image-alt-text-hover",
    "settingsSearch.accessibility_imageAltTextHover.aliases",
  ],
  [
    "settingsSearch.Developer_Logs.label",
    "Developer → Logs",
    "developer",
    "developer-logs-tab",
    "settingsSearch.Developer_Logs.aliases",
  ],
  [
    "settingsSearch.developer_showMockData.label",
    "developer.showMockData",
    "developer",
    "see-mock-data",
    "settingsSearch.developer_showMockData.aliases",
  ],
  [
    "settingsSearch.developer_showAdditionalJumpInformation.label",
    "developer.showAdditionalJumpInformation",
    "developer",
    "additional-jump-information",
    "settingsSearch.developer_showAdditionalJumpInformation.aliases",
  ],
  [
    "settingsSearch.developer_showOpenProjectFolder.label",
    "developer.showOpenProjectFolder",
    "developer",
    "show-open-project-folder",
    "settingsSearch.developer_showOpenProjectFolder.aliases",
  ],
  [
    "settingsSearch.developer_packageSizeLimits.label",
    "developer.packageSizeLimits",
    "developer",
    "custom-package-limits",
    "settingsSearch.developer_packageSizeLimits.aliases",
  ],
] as const;

export const searchValue = (
  key: (typeof searchEntries)[number][1],
  settings: ApplicationSettings,
) => {
  switch (key) {
    case "general.interfaceExperience":
      return interfaceExperienceFor(settings);
    case "general.hideTechnicalLocations":
      return String(settings.general.hideTechnicalLocations);
    case "general.collapseOptionalSectionsByDefault":
      return String(settings.general.collapseOptionalSectionsByDefault);
    case "language.tag":
      return settings.language.tag;
    case "appearance.theme":
      return settings.appearance.theme;
    case "appearance.accentColor":
      return settings.appearance.accentColor;
    case "editor.saveMode":
      return settings.editor.saveMode;
    case "editor.layoutPreviewPlaceholderCharacterLimit":
      return String(
        settings.editor.layoutPreviewPlaceholderCharacterLimit ?? "unlimited",
      );
    case "editor.warnMissingImageAlt":
      return String(settings.editor.warnMissingImageAlt);
    case "editor.warnMissingLayoutTargets":
      return String(settings.editor.warnMissingLayoutTargets);
    case "editor.collapseAdvancedViews":
      return String(settings.editor.collapseAdvancedViews);
    case "editor.collapsePreviewInspectionTools":
      return String(settings.editor.collapsePreviewInspectionTools);
    case "editor.showExplanatoryText":
      return String(settings.editor.showExplanatoryText);
    case "chain.allowMultiplePackageVersions":
      return String(settings.chain.allowMultiplePackageVersions);
    case "chain.allowDuplicateJumps":
      return String(settings.chain.allowDuplicateJumps);
    case "chain.allowNegativePointBalances":
      return String(settings.chain.allowNegativePointBalances);
    case "chain.allowRerolls":
      return String(settings.chain.allowRerolls);
    case "chain.includeItemTagsInRadar":
      return String(settings.chain.includeItemTagsInRadar);
    case "chain.aggregateSimilarInventory":
      return String(settings.chain.aggregateSimilarInventory);
    case "chain.warnUpstreamChanges":
      return String(settings.chain.warnUpstreamChanges);
    case "chain.colorNamesByPrimaryTag":
      return String(settings.chain.colorNamesByPrimaryTag);
    case "chain.compactJumpActions":
      return String(settings.chain.compactJumpActions);
    case "chain.collapseInventoryTagFilters":
      return String(settings.chain.collapseInventoryTagFilters);
    case "notifications.*":
      return JSON.stringify(settings.notifications);
    case "tags.profile":
      return Object.values(settings.tags.profile.tags)
        .flatMap((tag) => [tag.name, ...tag.aliases])
        .join(" ");
    case "keybindings.overrides":
      return JSON.stringify(settings.keybindings.overrides);
    case "accessibility.motion":
      return settings.accessibility.motion;
    case "accessibility.imageAltTextHover":
      return String(settings.accessibility.imageAltTextHover);
    case "Developer → Logs":
      return "session only";
    case "developer.showMockData":
      return String(settings.developer.showMockData);
    case "developer.showAdditionalJumpInformation":
      return String(settings.developer.showAdditionalJumpInformation);
    case "developer.showOpenProjectFolder":
      return String(settings.developer.showOpenProjectFolder);
    case "developer.packageSizeLimits":
      return JSON.stringify({
        enabled: settings.developer.useCustomPackageSizeLimits,
        maxArchiveMiB: settings.developer.maxArchiveMiB,
        maxDefinitionFileMiB: settings.developer.maxDefinitionFileMiB,
        maxAssetFileMiB: settings.developer.maxAssetFileMiB,
        maxExpandedPackageMiB: settings.developer.maxExpandedPackageMiB,
      });
  }
};

export type SettingsDescriptor = {
  labelKey: (typeof searchEntries)[number][0];
  path: (typeof searchEntries)[number][1];
  category: SettingsCategory;
  anchor: (typeof searchEntries)[number][3];
  aliasesKey: (typeof searchEntries)[number][4];
  section: SettingsSectionId | undefined;
  controlOwner: SettingsCategory;
  defaultValue: (defaults: ApplicationSettings) => string | undefined;
};

export const settingsDescriptorRegistry: readonly SettingsDescriptor[] =
  searchEntries.map(([labelKey, path, category, anchor, aliasesKey]) => ({
    labelKey,
    path,
    category,
    anchor,
    aliasesKey,
    section: sectionForSettingId[anchor],
    controlOwner: category,
    defaultValue: (defaults) => searchValue(path, defaults),
  }));
