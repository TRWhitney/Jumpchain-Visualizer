import type { TagProfile } from "./tagProfile";

export const SETTINGS_SCHEMA_VERSION = 5;

export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "system" | "reduced" | "full";
export type NotificationClass =
  "confirmations" | "editor" | "chain" | "validation" | "errors";

export const sourceKeybindingActions = [
  "find",
  "quickAdd",
  "format",
  "quickFix",
  "completions",
] as const;
export const assetToolKeybindingActions = [
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
] as const;
export const keybindingActions = [
  ...sourceKeybindingActions,
  ...assetToolKeybindingActions,
] as const;
export type KeybindingAction = (typeof keybindingActions)[number];
export type KeybindingChord = {
  key: string;
  primary: boolean;
  alt: boolean;
  shift: boolean;
};

export type PackageSizeLimits = {
  maxArchiveMiB: number;
  maxDefinitionFileMiB: number;
  maxAssetFileMiB: number;
  maxExpandedPackageMiB: number;
};

export const SAFE_PACKAGE_SIZE_LIMITS: Readonly<PackageSizeLimits> = {
  maxArchiveMiB: 64,
  maxDefinitionFileMiB: 2,
  maxAssetFileMiB: 16,
  maxExpandedPackageMiB: 96,
};

export const ABSOLUTE_PACKAGE_SIZE_LIMITS: Readonly<PackageSizeLimits> = {
  maxArchiveMiB: 512,
  maxDefinitionFileMiB: 16,
  maxAssetFileMiB: 256,
  maxExpandedPackageMiB: 1024,
};

export type ApplicationSettings = {
  schemaVersion: 5;
  onboarding: {
    welcomeTourStatus: "pending" | "in-progress" | "completed" | "dismissed";
  };
  general: {
    hideTechnicalLocations: boolean;
    collapseOptionalSectionsByDefault: boolean;
  };
  language: { tag: string };
  appearance: {
    theme: ThemePreference;
    accentColor: string;
  };
  accessibility: {
    motion: MotionPreference;
    imageAltTextHover: boolean;
  };
  developer: {
    showMockData: boolean;
    showAdditionalJumpInformation: boolean;
    showOpenProjectFolder: boolean;
    useCustomPackageSizeLimits: boolean;
  } & PackageSizeLimits;
  editor: {
    saveMode: "autosave" | "explicit";
    warnMissingImageAlt: boolean;
    warnMissingLayoutTargets: boolean;
    permanentlyDeleteSidebarItems: boolean;
    layoutPreviewPlaceholderCharacterLimit: number | null;
    collapseAdvancedViews: boolean;
    collapsePreviewInspectionTools: boolean;
    showExplanatoryText: boolean;
  };
  chain: {
    allowMultiplePackageVersions: boolean;
    allowDuplicateJumps: boolean;
    allowNegativePointBalances: boolean;
    allowRerolls: boolean;
    warnUpstreamChanges: boolean;
    colorNamesByPrimaryTag: boolean;
    includeItemTagsInRadar: boolean;
    aggregateSimilarInventory: boolean;
    compactJumpActions: boolean;
    collapseInventoryTagFilters: boolean;
  };
  notifications: {
    enabled: boolean;
    maxVisible: 1 | 2 | 3 | 4 | 5;
    durationMs: 3000 | 5000 | 8000 | 15000;
    classes: Record<NotificationClass, boolean>;
  };
  keybindings: {
    overrides: Partial<Record<KeybindingAction, KeybindingChord>>;
  };
  tags: { profile: TagProfile };
};

export type SettingsCategory =
  | "general"
  | "editor"
  | "chain"
  | "notifications"
  | "tags"
  | "keys"
  | "accessibility"
  | "developer";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) =>
  typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const record = (value: unknown) => (isObject(value) ? value : {});

export const defaultKeybindings: Record<KeybindingAction, KeybindingChord> = {
  find: { key: "f", primary: true, alt: false, shift: false },
  quickAdd: { key: "Enter", primary: true, alt: false, shift: false },
  format: { key: "f", primary: true, alt: false, shift: true },
  quickFix: { key: ".", primary: true, alt: false, shift: false },
  completions: { key: "Space", primary: true, alt: false, shift: false },
  assetSelectTool: { key: "v", primary: false, alt: false, shift: false },
  assetPanTool: { key: "h", primary: false, alt: false, shift: false },
  assetCropTool: { key: "c", primary: false, alt: false, shift: false },
  assetPaintTool: { key: "b", primary: false, alt: false, shift: false },
  assetEraserTool: { key: "e", primary: false, alt: false, shift: false },
  assetTextTool: { key: "t", primary: false, alt: false, shift: false },
  assetLineTool: { key: "l", primary: false, alt: false, shift: false },
  assetArrowTool: { key: "a", primary: false, alt: false, shift: false },
  assetRectangleTool: { key: "r", primary: false, alt: false, shift: false },
  assetEllipseTool: { key: "o", primary: false, alt: false, shift: false },
};

export const keybindingLabels: Record<KeybindingAction, string> = {
  find: "Find",
  quickAdd: "Quick Add",
  format: "Format",
  quickFix: "Quick Fix",
  completions: "All Completions",
  assetSelectTool: "Asset editor: Select",
  assetPanTool: "Asset editor: Pan",
  assetCropTool: "Asset editor: Crop",
  assetPaintTool: "Asset editor: Paint",
  assetEraserTool: "Asset editor: Eraser",
  assetTextTool: "Asset editor: Text",
  assetLineTool: "Asset editor: Line",
  assetArrowTool: "Asset editor: Arrow",
  assetRectangleTool: "Asset editor: Rectangle",
  assetEllipseTool: "Asset editor: Ellipse",
};

export function defaultSettings(profile: TagProfile): ApplicationSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    onboarding: { welcomeTourStatus: "pending" },
    general: {
      hideTechnicalLocations: false,
      collapseOptionalSectionsByDefault: false,
    },
    language: { tag: "en" },
    appearance: { theme: "system", accentColor: "#d4af37" },
    accessibility: { motion: "system", imageAltTextHover: true },
    developer: {
      showMockData: false,
      showAdditionalJumpInformation: false,
      showOpenProjectFolder: false,
      useCustomPackageSizeLimits: false,
      ...SAFE_PACKAGE_SIZE_LIMITS,
    },
    editor: {
      saveMode: "autosave",
      warnMissingImageAlt: true,
      warnMissingLayoutTargets: true,
      permanentlyDeleteSidebarItems: false,
      layoutPreviewPlaceholderCharacterLimit: null,
      collapseAdvancedViews: false,
      collapsePreviewInspectionTools: false,
      showExplanatoryText: false,
    },
    chain: {
      allowMultiplePackageVersions: false,
      allowDuplicateJumps: false,
      allowNegativePointBalances: false,
      allowRerolls: false,
      warnUpstreamChanges: false,
      colorNamesByPrimaryTag: false,
      includeItemTagsInRadar: false,
      aggregateSimilarInventory: true,
      compactJumpActions: false,
      collapseInventoryTagFilters: false,
    },
    notifications: {
      enabled: true,
      maxVisible: 3,
      durationMs: 5000,
      classes: {
        confirmations: true,
        editor: false,
        chain: true,
        validation: true,
        errors: true,
      },
    },
    keybindings: { overrides: {} },
    tags: { profile },
  };
}

export type InterfaceExperience = "advanced" | "beginner-friendly" | "custom";
export type InterfaceExperiencePreset = Exclude<InterfaceExperience, "custom">;

export const INTERFACE_EXPERIENCE_PRESETS = {
  advanced: {
    hideTechnicalLocations: false,
    collapseOptionalSectionsByDefault: false,
    collapseAdvancedViews: false,
    collapsePreviewInspectionTools: false,
    showExplanatoryText: false,
    compactJumpActions: false,
    collapseInventoryTagFilters: false,
    maxVisibleNotifications: 3,
  },
  "beginner-friendly": {
    hideTechnicalLocations: true,
    collapseOptionalSectionsByDefault: true,
    collapseAdvancedViews: true,
    collapsePreviewInspectionTools: true,
    showExplanatoryText: true,
    compactJumpActions: true,
    collapseInventoryTagFilters: true,
    maxVisibleNotifications: 1,
  },
} as const;

export function interfaceExperienceFor(
  settings: ApplicationSettings,
): InterfaceExperience {
  for (const preset of [
    "advanced",
    "beginner-friendly",
  ] as const satisfies readonly InterfaceExperiencePreset[]) {
    const values = INTERFACE_EXPERIENCE_PRESETS[preset];
    if (
      settings.general.hideTechnicalLocations ===
        values.hideTechnicalLocations &&
      settings.general.collapseOptionalSectionsByDefault ===
        values.collapseOptionalSectionsByDefault &&
      settings.editor.collapseAdvancedViews === values.collapseAdvancedViews &&
      settings.editor.collapsePreviewInspectionTools ===
        values.collapsePreviewInspectionTools &&
      settings.editor.showExplanatoryText === values.showExplanatoryText &&
      settings.chain.compactJumpActions === values.compactJumpActions &&
      settings.chain.collapseInventoryTagFilters ===
        values.collapseInventoryTagFilters &&
      settings.notifications.maxVisible === values.maxVisibleNotifications
    )
      return preset;
  }
  return "custom";
}

export function applyInterfaceExperience(
  settings: ApplicationSettings,
  preset: InterfaceExperiencePreset,
): ApplicationSettings {
  const values = INTERFACE_EXPERIENCE_PRESETS[preset];
  return {
    ...settings,
    general: {
      ...settings.general,
      hideTechnicalLocations: values.hideTechnicalLocations,
      collapseOptionalSectionsByDefault:
        values.collapseOptionalSectionsByDefault,
    },
    editor: {
      ...settings.editor,
      collapseAdvancedViews: values.collapseAdvancedViews,
      collapsePreviewInspectionTools: values.collapsePreviewInspectionTools,
      showExplanatoryText: values.showExplanatoryText,
    },
    chain: {
      ...settings.chain,
      compactJumpActions: values.compactJumpActions,
      collapseInventoryTagFilters: values.collapseInventoryTagFilters,
    },
    notifications: {
      ...settings.notifications,
      maxVisible: values.maxVisibleNotifications,
    },
  };
}

const isChord = (value: unknown): value is KeybindingChord => {
  if (!isObject(value) || typeof value.key !== "string" || !value.key.trim())
    return false;
  return [value.primary, value.alt, value.shift].every(
    (part) => typeof part === "boolean",
  );
};

const boundedWholeMiB = (value: unknown, maximum: number, fallback: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= maximum
    ? value
    : fallback;

const optionalBoundedWhole = (
  value: unknown,
  maximum: number,
  fallback: number | null,
) =>
  value === null || value === undefined
    ? fallback
    : typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= maximum
      ? value
      : fallback;

export function validatePackageSizeLimits(limits: PackageSizeLimits) {
  const entries = (
    [
      "maxArchiveMiB",
      "maxDefinitionFileMiB",
      "maxAssetFileMiB",
      "maxExpandedPackageMiB",
    ] as const
  ).map((key) => [key, limits[key]] as const);
  for (const [key, value] of entries) {
    if (!Number.isInteger(value) || value < 1)
      return "Package limits must be whole MiB values of at least 1.";
    if (value > ABSOLUTE_PACKAGE_SIZE_LIMITS[key])
      return `${key} exceeds the absolute application ceiling.`;
  }
  if (
    limits.maxDefinitionFileMiB > limits.maxExpandedPackageMiB ||
    limits.maxAssetFileMiB > limits.maxExpandedPackageMiB
  )
    return "Definition and asset limits cannot exceed the expanded package limit.";
  return null;
}

export function effectivePackageSizeLimits(
  developer: ApplicationSettings["developer"],
): Readonly<PackageSizeLimits> {
  return developer.useCustomPackageSizeLimits &&
    !validatePackageSizeLimits(developer)
    ? {
        maxArchiveMiB: developer.maxArchiveMiB,
        maxDefinitionFileMiB: developer.maxDefinitionFileMiB,
        maxAssetFileMiB: developer.maxAssetFileMiB,
        maxExpandedPackageMiB: developer.maxExpandedPackageMiB,
      }
    : SAFE_PACKAGE_SIZE_LIMITS;
}

export function hydrateSettings(
  value: unknown,
  defaultProfile: TagProfile,
  hydrateProfile: (value: unknown, fallback: TagProfile) => TagProfile,
  availableLanguageTags: readonly string[] = ["en"],
): ApplicationSettings {
  const fallback = defaultSettings(defaultProfile);
  const root = record(value);
  const storedSchemaVersion =
    typeof root.schemaVersion === "number" ? root.schemaVersion : 0;
  const onboarding = record(root.onboarding);
  const general = record(root.general);
  const language = record(root.language);
  const appearance = record(root.appearance);
  const accessibility = record(root.accessibility);
  const developer = record(root.developer);
  const editor = record(root.editor);
  const chain = record(root.chain);
  const notifications = record(root.notifications);
  const classes = record(notifications.classes);
  const keybindings = record(root.keybindings);
  const overrides = record(keybindings.overrides);
  const tags = record(root.tags);
  const maxVisible = [1, 2, 3, 4, 5].includes(Number(notifications.maxVisible))
    ? (Number(notifications.maxVisible) as 1 | 2 | 3 | 4 | 5)
    : fallback.notifications.maxVisible;
  const durationMs = [3000, 5000, 8000, 15000].includes(
    Number(notifications.durationMs),
  )
    ? (Number(notifications.durationMs) as 3000 | 5000 | 8000 | 15000)
    : fallback.notifications.durationMs;
  const validatedOverrides: Partial<Record<KeybindingAction, KeybindingChord>> =
    {};
  for (const action of keybindingActions) {
    if (isChord(overrides[action]))
      validatedOverrides[action] = overrides[action];
  }

  const hydratedPackageSizeLimits: PackageSizeLimits = {
    maxArchiveMiB: boundedWholeMiB(
      developer.maxArchiveMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxArchiveMiB,
      fallback.developer.maxArchiveMiB,
    ),
    maxDefinitionFileMiB: boundedWholeMiB(
      developer.maxDefinitionFileMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxDefinitionFileMiB,
      fallback.developer.maxDefinitionFileMiB,
    ),
    maxAssetFileMiB: boundedWholeMiB(
      developer.maxAssetFileMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxAssetFileMiB,
      fallback.developer.maxAssetFileMiB,
    ),
    maxExpandedPackageMiB: boundedWholeMiB(
      developer.maxExpandedPackageMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxExpandedPackageMiB,
      fallback.developer.maxExpandedPackageMiB,
    ),
  };
  const validHydratedPackageLimits = !validatePackageSizeLimits(
    hydratedPackageSizeLimits,
  );

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    onboarding: {
      welcomeTourStatus:
        storedSchemaVersion >= SETTINGS_SCHEMA_VERSION
          ? oneOf(
              onboarding.welcomeTourStatus,
              ["pending", "in-progress", "completed", "dismissed"] as const,
              fallback.onboarding.welcomeTourStatus,
            )
          : storedSchemaVersion > 0
            ? "dismissed"
            : fallback.onboarding.welcomeTourStatus,
    },
    general: {
      hideTechnicalLocations: bool(
        general.hideTechnicalLocations,
        fallback.general.hideTechnicalLocations,
      ),
      collapseOptionalSectionsByDefault: bool(
        general.collapseOptionalSectionsByDefault,
        fallback.general.collapseOptionalSectionsByDefault,
      ),
    },
    language: {
      tag:
        typeof language.tag === "string" &&
        availableLanguageTags.includes(language.tag)
          ? language.tag
          : fallback.language.tag,
    },
    appearance: {
      theme: oneOf(
        appearance.theme,
        ["system", "light", "dark"] as const,
        fallback.appearance.theme,
      ),
      accentColor:
        typeof appearance.accentColor === "string" &&
        /^#[0-9a-f]{6}$/i.test(appearance.accentColor)
          ? appearance.accentColor.toLowerCase()
          : fallback.appearance.accentColor,
    },
    accessibility: {
      motion: oneOf(
        accessibility.motion,
        ["system", "reduced", "full"] as const,
        fallback.accessibility.motion,
      ),
      imageAltTextHover: bool(
        accessibility.imageAltTextHover,
        fallback.accessibility.imageAltTextHover,
      ),
    },
    developer: {
      showMockData: bool(
        developer.showMockData,
        fallback.developer.showMockData,
      ),
      showAdditionalJumpInformation: bool(
        developer.showAdditionalJumpInformation,
        fallback.developer.showAdditionalJumpInformation,
      ),
      showOpenProjectFolder: bool(
        developer.showOpenProjectFolder,
        fallback.developer.showOpenProjectFolder,
      ),
      useCustomPackageSizeLimits:
        validHydratedPackageLimits &&
        bool(developer.useCustomPackageSizeLimits, false),
      ...hydratedPackageSizeLimits,
    },
    editor: {
      saveMode: oneOf(
        editor.saveMode,
        ["autosave", "explicit"] as const,
        fallback.editor.saveMode,
      ),
      warnMissingImageAlt: bool(
        editor.warnMissingImageAlt,
        fallback.editor.warnMissingImageAlt,
      ),
      warnMissingLayoutTargets: bool(
        editor.warnMissingLayoutTargets,
        fallback.editor.warnMissingLayoutTargets,
      ),
      permanentlyDeleteSidebarItems: bool(
        editor.permanentlyDeleteSidebarItems,
        fallback.editor.permanentlyDeleteSidebarItems,
      ),
      layoutPreviewPlaceholderCharacterLimit: optionalBoundedWhole(
        editor.layoutPreviewPlaceholderCharacterLimit,
        1_000,
        fallback.editor.layoutPreviewPlaceholderCharacterLimit,
      ),
      collapseAdvancedViews: bool(
        editor.collapseAdvancedViews,
        fallback.editor.collapseAdvancedViews,
      ),
      collapsePreviewInspectionTools: bool(
        editor.collapsePreviewInspectionTools,
        fallback.editor.collapsePreviewInspectionTools,
      ),
      showExplanatoryText: bool(
        editor.showExplanatoryText,
        fallback.editor.showExplanatoryText,
      ),
    },
    chain: {
      allowMultiplePackageVersions: bool(
        chain.allowMultiplePackageVersions,
        fallback.chain.allowMultiplePackageVersions,
      ),
      allowDuplicateJumps: bool(
        chain.allowDuplicateJumps,
        fallback.chain.allowDuplicateJumps,
      ),
      allowNegativePointBalances: bool(
        chain.allowNegativePointBalances,
        fallback.chain.allowNegativePointBalances,
      ),
      allowRerolls: bool(chain.allowRerolls, fallback.chain.allowRerolls),
      warnUpstreamChanges: bool(
        chain.warnUpstreamChanges,
        fallback.chain.warnUpstreamChanges,
      ),
      colorNamesByPrimaryTag: bool(
        chain.colorNamesByPrimaryTag,
        fallback.chain.colorNamesByPrimaryTag,
      ),
      includeItemTagsInRadar: bool(
        chain.includeItemTagsInRadar,
        fallback.chain.includeItemTagsInRadar,
      ),
      aggregateSimilarInventory: bool(
        chain.aggregateSimilarInventory,
        fallback.chain.aggregateSimilarInventory,
      ),
      compactJumpActions: bool(
        chain.compactJumpActions,
        fallback.chain.compactJumpActions,
      ),
      collapseInventoryTagFilters: bool(
        chain.collapseInventoryTagFilters,
        fallback.chain.collapseInventoryTagFilters,
      ),
    },
    notifications: {
      enabled: bool(notifications.enabled, fallback.notifications.enabled),
      maxVisible,
      durationMs,
      classes: {
        confirmations: bool(
          classes.confirmations,
          fallback.notifications.classes.confirmations,
        ),
        editor: bool(classes.editor, fallback.notifications.classes.editor),
        chain: bool(classes.chain, fallback.notifications.classes.chain),
        validation: bool(
          classes.validation,
          fallback.notifications.classes.validation,
        ),
        errors: bool(classes.errors, fallback.notifications.classes.errors),
      },
    },
    keybindings: { overrides: validatedOverrides },
    tags: { profile: hydrateProfile(tags.profile, defaultProfile) },
  };
}

export function chordFor(
  settings: ApplicationSettings,
  action: KeybindingAction,
) {
  return settings.keybindings.overrides[action] ?? defaultKeybindings[action];
}

export function chordKey(chord: KeybindingChord) {
  return `${chord.primary ? "P" : ""}${chord.alt ? "A" : ""}${chord.shift ? "S" : ""}:${normalizedKey(chord.key)}`;
}

const normalizedKey = (key: string) =>
  key === " " || key.toLocaleLowerCase() === "space"
    ? "space"
    : key.toLocaleLowerCase();

export function keybindingDisplay(chord: KeybindingChord, primaryLabel = "⌘") {
  const key = normalizedKey(chord.key);
  const keyLabel =
    key === "space"
      ? "Space"
      : chord.key.length === 1
        ? chord.key.toLocaleUpperCase()
        : chord.key;
  const modifiers = [
    chord.primary ? primaryLabel : "",
    chord.alt ? "Alt" : "",
    chord.shift ? "Shift" : "",
  ].filter(Boolean);
  return [...modifiers, keyLabel].join(" ");
}

export function matchesKeybinding(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  chord: KeybindingChord,
) {
  return (
    (event.ctrlKey || event.metaKey) === chord.primary &&
    event.altKey === chord.alt &&
    event.shiftKey === chord.shift &&
    normalizedKey(event.code === "Space" ? "Space" : event.key) ===
      normalizedKey(chord.key)
  );
}

export function validateKeybinding(
  settings: ApplicationSettings,
  action: KeybindingAction,
  chord: KeybindingChord,
) {
  const normalized = chordKey(chord);
  const reserved = new Set([
    "P:l",
    "P:r",
    "P:w",
    "P:t",
    "P:n",
    "P:q",
    "A:f4",
    ":f5",
  ]);
  if (reserved.has(normalized))
    return "That shortcut is reserved by the platform.";
  if (
    !chord.primary &&
    !chord.alt &&
    !chord.shift &&
    !assetToolKeybindingActions.includes(
      action as (typeof assetToolKeybindingActions)[number],
    )
  )
    return "Shortcuts must include a modifier key.";
  for (const candidate of keybindingActions) {
    if (
      candidate !== action &&
      chordKey(chordFor(settings, candidate)) === normalized
    )
      return "That shortcut is already assigned.";
  }
  return null;
}
