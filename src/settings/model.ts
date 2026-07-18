import type { TagProfile } from "./tagProfile";

export const SETTINGS_SCHEMA_VERSION = 1;

export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "system" | "reduced" | "full";
export type NotificationClass =
  "confirmations" | "editor" | "chain" | "validation" | "errors";

export type KeybindingAction = "quickAdd" | "quickFix" | "find";
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
  schemaVersion: 1;
  appearance: {
    theme: ThemePreference;
    accentColor: string;
  };
  accessibility: { motion: MotionPreference };
  developer: {
    showAdditionalJumpInformation: boolean;
    useCustomPackageSizeLimits: boolean;
  } & PackageSizeLimits;
  editor: {
    saveMode: "autosave" | "explicit";
    warnMissingImageAlt: boolean;
    warnMissingLayoutTargets: boolean;
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
  quickAdd: { key: "Enter", primary: true, alt: false, shift: false },
  quickFix: { key: ".", primary: true, alt: false, shift: false },
  find: { key: "f", primary: true, alt: false, shift: false },
};

export function defaultSettings(profile: TagProfile): ApplicationSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    appearance: { theme: "system", accentColor: "#d4af37" },
    accessibility: { motion: "system" },
    developer: {
      showAdditionalJumpInformation: false,
      useCustomPackageSizeLimits: false,
      ...SAFE_PACKAGE_SIZE_LIMITS,
    },
    editor: {
      saveMode: "autosave",
      warnMissingImageAlt: true,
      warnMissingLayoutTargets: true,
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
): ApplicationSettings {
  const fallback = defaultSettings(defaultProfile);
  const root = record(value);
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
  for (const action of Object.keys(defaultKeybindings) as KeybindingAction[]) {
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
    },
    developer: {
      showAdditionalJumpInformation: bool(
        developer.showAdditionalJumpInformation,
        fallback.developer.showAdditionalJumpInformation,
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
  return `${chord.primary ? "P" : ""}${chord.alt ? "A" : ""}${chord.shift ? "S" : ""}:${chord.key.toLocaleLowerCase()}`;
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
  if (!chord.primary && !chord.alt && !chord.shift)
    return "Shortcuts must include a modifier key.";
  for (const candidate of Object.keys(
    defaultKeybindings,
  ) as KeybindingAction[]) {
    if (
      candidate !== action &&
      chordKey(chordFor(settings, candidate)) === normalized
    )
      return "That shortcut is already assigned.";
  }
  return null;
}
