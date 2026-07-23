import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { LoggingViewer } from "./LoggingViewer";
import { TagProfileEditor } from "./TagProfileEditor";
import { useSettings } from "./SettingsContext";
import {
  ABSOLUTE_PACKAGE_SIZE_LIMITS,
  SAFE_PACKAGE_SIZE_LIMITS,
  chordFor,
  defaultSettings,
  effectivePackageSizeLimits,
  keybindingActions,
  keybindingDisplay,
  keybindingLabels,
  validatePackageSizeLimits,
  validateKeybinding,
  type ApplicationSettings,
  type KeybindingAction,
  type KeybindingChord,
  type NotificationClass,
  type PackageSizeLimits,
  type SettingsCategory,
} from "./model";
import { createDefaultTagProfile } from "./tagProfile";
import { changeLanguage, translate, translationCatalog } from "../localization";

const categoriesFor = (): { id: SettingsCategory; label: string }[] => {
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

const searchEntries = [
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

const searchValue = (
  key: (typeof searchEntries)[number][1],
  settings: ApplicationSettings,
) => {
  switch (key) {
    case "language.tag":
      return settings.language.tag;
    case "appearance.theme":
      return settings.appearance.theme;
    case "appearance.accentColor":
      return settings.appearance.accentColor;
    case "editor.saveMode":
      return settings.editor.saveMode;
    case "editor.warnMissingImageAlt":
      return String(settings.editor.warnMissingImageAlt);
    case "editor.warnMissingLayoutTargets":
      return String(settings.editor.warnMissingLayoutTargets);
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

export function SettingsSurface({
  onClose,
  onResetMockData,
  direct = false,
  category,
  onCategoryChange,
}: {
  onClose: () => void;
  onResetMockData: () => Promise<boolean>;
  direct?: boolean;
  category: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}) {
  const { settings, replace } = useSettings();
  const categories = categoriesFor();
  const [query, setQuery] = useState("");
  const [resetConfirm, setResetConfirm] = useState<"all" | "tags" | null>(null);
  const [packageRiskConfirm, setPackageRiskConfirm] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const defaults = useMemo(
    () => defaultSettings(createDefaultTagProfile()),
    [],
  );
  const results = searchEntries.filter((entry) =>
    query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((term) =>
        `${translate(entry[0])} ${entry[1]} ${translate(entry[4])} ${searchValue(entry[1], settings)}`
          .toLocaleLowerCase()
          .includes(term),
      ),
  );

  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>("[data-settings-heading]")
      ?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (resetConfirm || packageRiskConfirm) {
        if (event.key === "Escape") {
          event.preventDefault();
          setResetConfirm(null);
          setPackageRiskConfirm(false);
          return;
        }
        if (event.key !== "Tab") return;
        const dialog = root.current?.querySelector<HTMLElement>(
          ".settings-confirm-backdrop [role='alertdialog']",
        );
        const controls = [
          ...(dialog?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
          ) ?? []),
        ];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || direct || !root.current) return;
      const focusable = [
        ...root.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']",
        ),
      ].filter((element) => !element.closest("[hidden]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [direct, onClose, packageRiskConfirm, resetConfirm]);

  const activate = (next: SettingsCategory, focus = false) => {
    onCategoryChange(next);
    setQuery("");
    if (focus)
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLElement>(`#settings-${next}-tab`)
          ?.focus(),
      );
  };
  const handleTabKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = -1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = (index + 1) % categories.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index - 1 + categories.length) % categories.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = categories.length - 1;
    if (next >= 0) {
      event.preventDefault();
      activate(categories[next].id, true);
    }
  };
  const resetCategory = () => {
    if (category === "tags") {
      setResetConfirm("tags");
      return;
    }
    const next = structuredClone(settings);
    if (category === "general") {
      next.language = defaults.language;
      next.appearance = defaults.appearance;
    }
    if (category === "editor") next.editor = defaults.editor;
    if (category === "chain") next.chain = defaults.chain;
    if (category === "notifications")
      next.notifications = defaults.notifications;
    if (category === "keys") next.keybindings = defaults.keybindings;
    if (category === "accessibility")
      next.accessibility = defaults.accessibility;
    if (category === "developer") next.developer = defaults.developer;
    replace(next, `${category}.reset`);
  };

  return (
    <div
      ref={root}
      className={`settings-mockup app-settings-surface${direct ? " is-direct" : ""}`}
      aria-label={translate("common.applicationSettings")}
    >
      <aside aria-label={translate("common.settings")}>
        <div className="settings-mock-title">
          <span aria-hidden="true">⚙</span>
          <strong>{translate("common.settings")}</strong>
        </div>
        <label className="settings-mock-search">
          <span className="sr-only">{translate("common.searchSettings")}</span>
          <input
            type="search"
            placeholder={translate("common.searchSettings")}
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
        </label>
        <nav
          role="tablist"
          aria-label={translate("ui.settingsSurface.ariaLabel.settingCategory")}
        >
          {categories.map((entry, index) => (
            <button
              id={`settings-${entry.id}-tab`}
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={category === entry.id}
              tabIndex={category === entry.id ? 0 : -1}
              onClick={() => activate(entry.id)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <button
          className="settings-reset-all"
          type="button"
          onClick={() => setResetConfirm("all")}
        >
          {translate("common.resetAllSettings")}
        </button>
      </aside>
      <div className="settings-mock-content">
        <header>
          <div>
            <p>{translate("common.applicationSettings")}</p>
            <h3 data-settings-heading tabIndex={-1}>
              {translate("common.preferences")}
            </h3>
          </div>
          <div className="app-settings-header-actions">
            <button type="button" onClick={resetCategory}>
              {translate("common.resetCategory")}
            </button>
            <button
              type="button"
              aria-label={translate("common.closeSettings")}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>
        {query ? (
          <section className="settings-search-panel" aria-live="polite">
            <h4>
              {translate("settings.searchResults")}{" "}
              <span>
                {translate("settings.result", { count: results.length })}
              </span>
            </h4>
            {results.length ? (
              <div className="settings-search-list">
                {results.map((entry) => (
                  <button
                    key={entry[1]}
                    type="button"
                    onClick={() => {
                      activate(entry[2]);
                      requestAnimationFrame(() => {
                        const target = document.getElementById(entry[3]);
                        if (target?.getAttribute("role") === "tab")
                          target.click();
                        target?.focus();
                      });
                    }}
                  >
                    <span>
                      <strong>{translate(entry[0])}</strong>
                      <small>
                        <code>{entry[1]}</code> ·{" "}
                        {
                          categories.find(
                            (candidate) => candidate.id === entry[2],
                          )?.label
                        }
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="settings-search-empty">
                {translate("settings.noResults")}
              </p>
            )}
          </section>
        ) : (
          <CategoryPanel
            category={category}
            settings={settings}
            defaults={defaults}
            onRequestPackageLimitOverride={() => setPackageRiskConfirm(true)}
            onResetMockData={onResetMockData}
          />
        )}
      </div>
      {resetConfirm && (
        <div className="settings-confirm-backdrop">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="settings-reset-heading"
          >
            <p>{translate("ui.settingsSurface.text.destructiveReset")}</p>
            <h4 id="settings-reset-heading">
              {resetConfirm === "all"
                ? "Reset every application setting?"
                : "Reset the complete tag profile?"}
            </h4>
            <p>
              {resetConfirm === "all"
                ? "This restores every preference and removes manual/imported profile configuration. Projects and chains are not deleted."
                : "Built-in tags remain, while manual/imported tags, relationships, and presentation overrides are removed."}
            </p>
            <div>
              <button
                type="button"
                onClick={() => {
                  replace(
                    resetConfirm === "all"
                      ? defaults
                      : { ...settings, tags: defaults.tags },
                    resetConfirm === "all"
                      ? "settings.reset"
                      : "tags.profile.reset",
                  );
                  setResetConfirm(null);
                }}
              >
                {translate("ui.settingsSurface.text.reset")}
              </button>
              <button
                autoFocus
                type="button"
                onClick={() => setResetConfirm(null)}
              >
                {translate("ui.settingsSurface.text.cancel")}
              </button>
            </div>
          </section>
        </div>
      )}
      {packageRiskConfirm && (
        <div className="settings-confirm-backdrop">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="package-risk-heading"
          >
            <p>{translate("ui.settingsSurface.text.developerOverride")}</p>
            <h4 id="package-risk-heading">
              {translate(
                "ui.settingsSurface.text.increasePackageLimitsAtYourOwnRisk",
              )}
            </h4>
            <p>
              {translate(
                "ui.settingsSurface.text.largerPackagesCanConsumeSubstantialMemoryDiskSpaceAnd",
              )}
            </p>
            <p>
              {translate(
                "ui.settingsSurface.text.pathFileTypeCompressionRatioImageSchemaAndAtomicity",
              )}
            </p>
            <div>
              <button
                type="button"
                onClick={() => {
                  replace(
                    {
                      ...settings,
                      developer: {
                        ...settings.developer,
                        useCustomPackageSizeLimits: true,
                      },
                    },
                    "developer.packageSizeLimits.enabled",
                  );
                  setPackageRiskConfirm(false);
                }}
              >
                {translate("ui.settingsSurface.text.iUnderstandEnable")}
              </button>
              <button
                autoFocus
                type="button"
                onClick={() => setPackageRiskConfirm(false)}
              >
                {translate("ui.settingsSurface.text.cancel")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CategoryPanel({
  category,
  settings,
  defaults,
  onRequestPackageLimitOverride,
  onResetMockData,
}: {
  category: SettingsCategory;
  settings: ApplicationSettings;
  defaults: ApplicationSettings;
  onRequestPackageLimitOverride: () => void;
  onResetMockData: () => Promise<boolean>;
}) {
  const { update, logger } = useSettings();
  const [developerPage, setDeveloperPage] = useState<"overview" | "logs">(
    "overview",
  );
  const [debugCapture, setDebugCapture] = useState(
    logger.isDebugCaptureEnabled(),
  );
  const [mockResetState, setMockResetState] = useState<
    "idle" | "resetting" | "success" | "error"
  >("idle");
  const patch = (next: ApplicationSettings, key: string, continuous = false) =>
    update(() => next, key, continuous);
  const packageLimitError = validatePackageSizeLimits(settings.developer);
  const effectiveLimits = effectivePackageSizeLimits(settings.developer);
  const updatePackageLimit = (key: keyof PackageSizeLimits, value: number) => {
    if (!Number.isFinite(value)) return;
    patch(
      {
        ...settings,
        developer: {
          ...settings.developer,
          [key]: value,
        },
      },
      `developer.packageSizeLimits.${key}`,
      true,
    );
  };
  if (category === "general")
    return (
      <section role="tabpanel" aria-labelledby="settings-general-tab">
        <h4>{translate("ui.settingsSurface.text.general")}</h4>
        <SettingRow
          id="language-selection"
          label={translate("settingsSearch.language_tag.label")}
          description={translate("language.description")}
          reset={() => {
            void changeLanguage(defaults.language.tag);
            patch({ ...settings, language: defaults.language }, "language.tag");
          }}
        >
          <select
            id="language-selection"
            value={settings.language.tag}
            onChange={(event) => {
              const languageTag = event.target.value;
              void changeLanguage(languageTag);
              patch(
                { ...settings, language: { tag: languageTag } },
                "language.tag",
              );
            }}
          >
            {translationCatalog.languages.map((pack) => (
              <option
                key={pack.languageTag}
                value={pack.languageTag}
                lang={pack.languageTag}
                dir={pack.direction}
              >
                {pack.name}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow
          id="theme"
          label={translate("ui.settingsSurface.label.appearance")}
          description={translate(
            "ui.settingsSurface.description.chooseTheApplicationColorTheme",
          )}
          reset={() =>
            patch(
              {
                ...settings,
                appearance: {
                  ...settings.appearance,
                  theme: defaults.appearance.theme,
                },
              },
              "appearance.theme",
            )
          }
        >
          <select
            id="theme"
            value={settings.appearance.theme}
            onChange={(event) =>
              patch(
                {
                  ...settings,
                  appearance: {
                    ...settings.appearance,
                    theme: event.target
                      .value as ApplicationSettings["appearance"]["theme"],
                  },
                },
                "appearance.theme",
              )
            }
          >
            <option value="system">
              {translate("ui.settingsSurface.text.useSystemSetting")}
            </option>
            <option value="light">
              {translate("ui.settingsSurface.text.light")}
            </option>
            <option value="dark">
              {translate("ui.settingsSurface.text.dark")}
            </option>
          </select>
        </SettingRow>
        <SettingRow
          id="accent"
          label={translate("ui.settingsSurface.label.accentColor")}
          description={translate(
            "ui.settingsSurface.description.chooseTheBaseColorUsedToDeriveAccessibleApplication",
          )}
          reset={() =>
            patch(
              {
                ...settings,
                appearance: {
                  ...settings.appearance,
                  accentColor: defaults.appearance.accentColor,
                },
              },
              "appearance.accentColor",
            )
          }
        >
          <div className="accent-color-control">
            <input
              id="accent"
              type="color"
              value={settings.appearance.accentColor}
              onChange={(event) =>
                patch(
                  {
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      accentColor: event.target.value,
                    },
                  },
                  "appearance.accentColor",
                  true,
                )
              }
            />
            <output>{settings.appearance.accentColor.toUpperCase()}</output>
          </div>
        </SettingRow>
        <div className="setting-explanation">
          {translate(
            "ui.settingsSurface.text.homeIsAlwaysTheRootDestinationStartupRedirectionIs",
          )}
        </div>
      </section>
    );
  if (category === "editor")
    return (
      <section role="tabpanel" aria-labelledby="settings-editor-tab">
        <h4>{translate("ui.settingsSurface.text.editor")}</h4>
        <SettingRow
          id="save-mode"
          label={translate("ui.settingsSurface.label.saving")}
          description={translate(
            "ui.settingsSurface.description.chooseWhetherEditorChangesSaveAutomatically",
          )}
          reset={() =>
            patch(
              {
                ...settings,
                editor: {
                  ...settings.editor,
                  saveMode: defaults.editor.saveMode,
                },
              },
              "editor.saveMode",
            )
          }
        >
          <select
            id="save-mode"
            value={settings.editor.saveMode}
            onChange={(event) =>
              patch(
                {
                  ...settings,
                  editor: {
                    ...settings.editor,
                    saveMode: event.target.value as "autosave" | "explicit",
                  },
                },
                "editor.saveMode",
              )
            }
          >
            <option value="autosave">
              {translate("ui.settingsSurface.text.autosave")}
            </option>
            <option value="explicit">
              {translate("ui.settingsSurface.text.explicitSave")}
            </option>
          </select>
        </SettingRow>
        <CheckRow
          id="warn-alt"
          label={translate("ui.settingsSurface.label.missingImageAltWarning")}
          description={translate(
            "ui.settingsSurface.description.warnWhenAnImageBlockOmitsAlternativeText",
          )}
          checked={settings.editor.warnMissingImageAlt}
          text={translate("ui.settingsSurface.text.showAccessibilityWarning")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                editor: { ...settings.editor, warnMissingImageAlt: value },
              },
              "editor.warnMissingImageAlt",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                editor: { ...settings.editor, warnMissingImageAlt: true },
              },
              "editor.warnMissingImageAlt",
            )
          }
        />
        <CheckRow
          id="warn-layout"
          label={translate(
            "ui.settingsSurface.label.missingLayoutTargetWarning",
          )}
          description={translate(
            "ui.settingsSurface.description.warnWhenAReusableLayoutTargetIsAbsent",
          )}
          checked={settings.editor.warnMissingLayoutTargets}
          text={translate("ui.settingsSurface.text.showMissingTargetWarning")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                editor: { ...settings.editor, warnMissingLayoutTargets: value },
              },
              "editor.warnMissingLayoutTargets",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                editor: { ...settings.editor, warnMissingLayoutTargets: true },
              },
              "editor.warnMissingLayoutTargets",
            )
          }
        />
        <CheckRow
          id="permanent-sidebar-delete"
          label={translate("ui.settingsSurface.label.sidebarItemDeletion")}
          description={translate(
            "ui.settingsSurface.description.chooseWhetherSidebarDeleteUsesTrashOrPermanentRemoval",
          )}
          checked={settings.editor.permanentlyDeleteSidebarItems}
          text={translate(
            "ui.settingsSurface.text.permanentlyDeleteSidebarItems",
          )}
          onChange={(value) =>
            patch(
              {
                ...settings,
                editor: {
                  ...settings.editor,
                  permanentlyDeleteSidebarItems: value,
                },
              },
              "editor.permanentlyDeleteSidebarItems",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                editor: {
                  ...settings.editor,
                  permanentlyDeleteSidebarItems: false,
                },
              },
              "editor.permanentlyDeleteSidebarItems",
            )
          }
        />
        <div className="setting-explanation">
          {translate(
            "ui.settingsSurface.text.editorPreferencesApplyImmediatelyAndPersist",
          )}
        </div>
      </section>
    );
  if (category === "chain")
    return (
      <section role="tabpanel" aria-labelledby="settings-chain-tab">
        <h4>{translate("ui.settingsSurface.text.chainTracker")}</h4>
        <CheckRow
          id="multiple-versions"
          label={translate("ui.settingsSurface.label.addAnotherPackageVersion")}
          description={translate(
            "ui.settingsSurface.description.allowAddToPlaceASecondInstalledVersionOf",
          )}
          checked={settings.chain.allowMultiplePackageVersions}
          text={translate("ui.settingsSurface.text.allowSecondVersion")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: {
                  ...settings.chain,
                  allowMultiplePackageVersions: value,
                },
              },
              "chain.allowMultiplePackageVersions",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: {
                  ...settings.chain,
                  allowMultiplePackageVersions: false,
                },
              },
              "chain.allowMultiplePackageVersions",
            )
          }
        />
        <CheckRow
          id="duplicate-jumps"
          label={translate("ui.settingsSurface.label.allowDuplicateJumps")}
          description={translate(
            "ui.settingsSurface.description.allowTheSameExactJumpPackageToBeAdded",
          )}
          checked={settings.chain.allowDuplicateJumps}
          text={translate("ui.settingsSurface.text.allowDuplicateJumps")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: {
                  ...settings.chain,
                  allowDuplicateJumps: value,
                },
              },
              "chain.allowDuplicateJumps",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: {
                  ...settings.chain,
                  allowDuplicateJumps: false,
                },
              },
              "chain.allowDuplicateJumps",
            )
          }
        />
        <CheckRow
          id="negative-balances"
          label={translate("ui.settingsSurface.label.negativePointBalances")}
          description={translate(
            "ui.settingsSurface.description.permitActiveChoiceSelectionsThatWouldMakePrimaryJump",
          )}
          checked={settings.chain.allowNegativePointBalances}
          text={translate("ui.settingsSurface.text.allowNegativeBalances")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, allowNegativePointBalances: value },
              },
              "chain.allowNegativePointBalances",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, allowNegativePointBalances: false },
              },
              "chain.allowNegativePointBalances",
            )
          }
        />
        <CheckRow
          id="rerolls"
          label={translate("ui.settingsSurface.label.rerolls")}
          description={translate(
            "ui.settingsSurface.description.allowARecordedRandomResultToBeReplacedFor",
          )}
          checked={settings.chain.allowRerolls}
          text={translate("ui.settingsSurface.text.allowRerolls")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, allowRerolls: value },
              },
              "chain.allowRerolls",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, allowRerolls: false },
              },
              "chain.allowRerolls",
            )
          }
        />
        <CheckRow
          id="aggregate-similar-inventory"
          label={translate(
            "ui.settingsSurface.label.aggregateSimilarPerksAndItems",
          )}
          description={translate(
            "ui.settingsSurface.description.combineRecordsWithTheSameOwnerKindResolvedName",
          )}
          checked={settings.chain.aggregateSimilarInventory}
          text={translate("ui.settingsSurface.text.aggregateSimilarRecords")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: {
                  ...settings.chain,
                  aggregateSimilarInventory: value,
                },
              },
              "chain.aggregateSimilarInventory",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: {
                  ...settings.chain,
                  aggregateSimilarInventory: true,
                },
              },
              "chain.aggregateSimilarInventory",
            )
          }
        />
        <CheckRow
          id="item-tags-radar"
          label={translate("ui.settingsSurface.label.includeItemTagsInRadar")}
          description={translate(
            "ui.settingsSurface.description.countTagsFromJumperAndFormItemsInRadar",
          )}
          checked={settings.chain.includeItemTagsInRadar}
          text={translate("ui.settingsSurface.text.countItemTags")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, includeItemTagsInRadar: value },
              },
              "chain.includeItemTagsInRadar",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, includeItemTagsInRadar: false },
              },
              "chain.includeItemTagsInRadar",
            )
          }
        />
        <CheckRow
          id="upstream"
          label={translate("ui.settingsSurface.label.upstreamChangeWarnings")}
          description={translate(
            "ui.settingsSurface.description.reviewReorderOrDeletionOnlyWhenAnExplicitActive",
          )}
          checked={settings.chain.warnUpstreamChanges}
          text={translate("ui.settingsSurface.text.warnAboutUpstreamChanges")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, warnUpstreamChanges: value },
              },
              "chain.warnUpstreamChanges",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, warnUpstreamChanges: false },
              },
              "chain.warnUpstreamChanges",
            )
          }
        />
        <CheckRow
          id="color-chain"
          label={translate(
            "ui.settingsSurface.label.colorChainNamesByPrimaryTag",
          )}
          description={translate(
            "ui.settingsSurface.description.colorSavedChainNamesFromTheCategoryWithThe",
          )}
          checked={settings.chain.colorNamesByPrimaryTag}
          text={translate("ui.settingsSurface.text.colorChainNames")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, colorNamesByPrimaryTag: value },
              },
              "chain.colorNamesByPrimaryTag",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                chain: { ...settings.chain, colorNamesByPrimaryTag: false },
              },
              "chain.colorNamesByPrimaryTag",
            )
          }
        />
        <div className="setting-explanation">
          {translate(
            "ui.settingsSurface.text.similarInventoryAggregationIsOnByDefaultTheOther",
          )}
        </div>
      </section>
    );
  if (category === "notifications")
    return <NotificationsPanel settings={settings} patch={patch} />;
  if (category === "tags")
    return (
      <section
        className="settings-tags-panel"
        role="tabpanel"
        aria-labelledby="settings-tags-tab"
      >
        <TagProfileEditor />
      </section>
    );
  if (category === "keys")
    return (
      <section role="tabpanel" aria-labelledby="settings-keys-tab">
        <h4>{translate("ui.settingsSurface.text.keyBindings")}</h4>
        <div id="keybindings" className="keybinding-list">
          {keybindingActions.map((action) => (
            <KeybindingRow key={action} action={action} settings={settings} />
          ))}
        </div>
        <div className="setting-explanation">
          {translate(
            "ui.settingsSurface.text.overridesAreUserLocalDuplicateOrPlatformReservedBindings",
          )}
        </div>
      </section>
    );
  if (category === "accessibility")
    return (
      <section role="tabpanel" aria-labelledby="settings-accessibility-tab">
        <h4>{translate("ui.settingsSurface.text.accessibility")}</h4>
        <SettingRow
          id="motion"
          label={translate("ui.settingsSurface.label.motion")}
          description={translate(
            "ui.settingsSurface.description.controlNonessentialInterfaceAnimation",
          )}
          reset={() =>
            patch(
              {
                ...settings,
                accessibility: {
                  ...settings.accessibility,
                  motion: defaults.accessibility.motion,
                },
              },
              "accessibility.motion",
            )
          }
        >
          <select
            id="motion"
            value={settings.accessibility.motion}
            onChange={(event) =>
              patch(
                {
                  ...settings,
                  accessibility: {
                    ...settings.accessibility,
                    motion: event.target
                      .value as ApplicationSettings["accessibility"]["motion"],
                  },
                },
                "accessibility.motion",
              )
            }
          >
            <option value="system">
              {translate("ui.settingsSurface.text.useSystemSetting")}
            </option>
            <option value="reduced">
              {translate("ui.settingsSurface.text.reduceMotion")}
            </option>
            <option value="full">
              {translate("ui.settingsSurface.text.fullMotion")}
            </option>
          </select>
        </SettingRow>
        <CheckRow
          id="image-alt-text-hover"
          label={translate("ui.settingsSurface.label.altTextHoverForImages")}
          description={translate(
            "ui.settingsSurface.description.showAuthoredAlternativeTextWhenHoveringImagesInPreviews",
          )}
          checked={settings.accessibility.imageAltTextHover}
          text={translate("ui.settingsSurface.text.showAltTextOnHover")}
          onChange={(value) =>
            patch(
              {
                ...settings,
                accessibility: {
                  ...settings.accessibility,
                  imageAltTextHover: value,
                },
              },
              "accessibility.imageAltTextHover",
            )
          }
          reset={() =>
            patch(
              {
                ...settings,
                accessibility: {
                  ...settings.accessibility,
                  imageAltTextHover: defaults.accessibility.imageAltTextHover,
                },
              },
              "accessibility.imageAltTextHover",
            )
          }
        />
        <div className="setting-explanation">
          {translate(
            "ui.settingsSurface.text.reducedMotionRemovesNonessentialMovementWithoutHidingStateChanges",
          )}
        </div>
      </section>
    );
  return (
    <section
      className="settings-developer-panel"
      role="tabpanel"
      aria-labelledby="settings-developer-tab"
    >
      <div
        className="settings-subtabs"
        role="tablist"
        aria-label={translate(
          "ui.settingsSurface.ariaLabel.developerSettingsPages",
        )}
      >
        <button
          type="button"
          role="tab"
          aria-selected={developerPage === "overview"}
          onClick={() => setDeveloperPage("overview")}
        >
          {translate("ui.settingsSurface.text.overview")}
        </button>
        <button
          id="developer-logs-tab"
          type="button"
          role="tab"
          aria-selected={developerPage === "logs"}
          onClick={() => setDeveloperPage("logs")}
        >
          {translate("ui.settingsSurface.text.logs")}
        </button>
      </div>
      {developerPage === "overview" ? (
        <section className="developer-subpanel">
          <h4>{translate("ui.settingsSurface.text.developer")}</h4>
          <CheckRow
            id="see-mock-data"
            label={translate("ui.settingsSurface.label.seeMockData")}
            description={translate(
              "ui.settingsSurface.description.showApplicationOwnedMockJumpsAndChains",
            )}
            checked={settings.developer.showMockData}
            text={translate("ui.settingsSurface.text.showMockFixtures")}
            onChange={(value) => {
              setMockResetState("idle");
              patch(
                {
                  ...settings,
                  developer: {
                    ...settings.developer,
                    showMockData: value,
                  },
                },
                "developer.showMockData",
              );
            }}
            reset={() => {
              setMockResetState("idle");
              patch(
                {
                  ...settings,
                  developer: {
                    ...settings.developer,
                    showMockData: defaults.developer.showMockData,
                  },
                },
                "developer.showMockData",
              );
            }}
          />
          <div className="setting-row" id="reset-mock-data">
            <div>
              <label htmlFor="reset-mock-data-button">
                {translate("ui.settingsSurface.text.resetMockData")}
              </label>
              <p>
                {translate(
                  "ui.settingsSurface.description.restoreMorganAndDefaultMockChoices",
                )}
              </p>
            </div>
            <div>
              <button
                id="reset-mock-data-button"
                className="setting-reset"
                type="button"
                disabled={
                  !settings.developer.showMockData ||
                  mockResetState === "resetting"
                }
                onClick={() => {
                  setMockResetState("resetting");
                  void onResetMockData().then((reset) =>
                    setMockResetState(reset ? "success" : "error"),
                  );
                }}
              >
                {mockResetState === "resetting"
                  ? translate("ui.settingsSurface.text.resettingMockData")
                  : translate("ui.settingsSurface.text.resetMockData")}
              </button>
              {mockResetState === "success" && (
                <p role="status">
                  {translate("ui.settingsSurface.text.mockDataReset")}
                </p>
              )}
              {mockResetState === "error" && (
                <p className="developer-limit-error" role="alert">
                  {translate("ui.settingsSurface.text.mockDataResetFailed")}
                </p>
              )}
            </div>
          </div>
          <CheckRow
            id="additional-jump-information"
            label={translate(
              "ui.settingsSurface.label.showAdditionalJumpInformation",
            )}
            description={translate(
              "ui.settingsSurface.description.showTheEvaluatedPackageFormatAboveOrdinaryRenderedJumps",
            )}
            checked={settings.developer.showAdditionalJumpInformation}
            text={translate("ui.settingsSurface.text.enableExtraInformation")}
            onChange={(value) =>
              patch(
                {
                  ...settings,
                  developer: {
                    ...settings.developer,
                    showAdditionalJumpInformation: value,
                  },
                },
                "developer.showAdditionalJumpInformation",
              )
            }
            reset={() =>
              patch(
                {
                  ...settings,
                  developer: {
                    ...settings.developer,
                    showAdditionalJumpInformation:
                      defaults.developer.showAdditionalJumpInformation,
                  },
                },
                "developer.showAdditionalJumpInformation",
              )
            }
          />
          <CheckRow
            id="show-open-project-folder"
            label={translate("ui.settingsSurface.label.showOpenProjectFolder")}
            description={translate(
              "ui.settingsSurface.description.showTheDesktopOnlyExternalFolderWorkflowOnThe",
            )}
            checked={settings.developer.showOpenProjectFolder}
            text={translate("ui.settingsSurface.text.showFolderAction")}
            onChange={(value) =>
              patch(
                {
                  ...settings,
                  developer: {
                    ...settings.developer,
                    showOpenProjectFolder: value,
                  },
                },
                "developer.showOpenProjectFolder",
              )
            }
            reset={() =>
              patch(
                {
                  ...settings,
                  developer: {
                    ...settings.developer,
                    showOpenProjectFolder:
                      defaults.developer.showOpenProjectFolder,
                  },
                },
                "developer.showOpenProjectFolder",
              )
            }
          />
          <div className="setting-row developer-package-limits">
            <div>
              <label htmlFor="custom-package-limits">
                {translate("ui.settingsSurface.text.packageSizeLimits")}
              </label>
              <p>
                {translate(
                  "ui.settingsSurface.text.byteBudgetsSharedByEditorImportExportDesktopProjects",
                )}
              </p>
              <dl className="developer-effective-limits">
                <div>
                  <dt>{translate("ui.settingsSurface.text.archive")}</dt>
                  <dd>
                    {effectiveLimits.maxArchiveMiB}{" "}
                    {translate("ui.settingsSurface.text.mib")}
                  </dd>
                </div>
                <div>
                  <dt>{translate("ui.settingsSurface.text.definition")}</dt>
                  <dd>
                    {effectiveLimits.maxDefinitionFileMiB}{" "}
                    {translate("ui.settingsSurface.text.mib")}
                  </dd>
                </div>
                <div>
                  <dt>{translate("ui.settingsSurface.text.asset")}</dt>
                  <dd>
                    {effectiveLimits.maxAssetFileMiB}{" "}
                    {translate("ui.settingsSurface.text.mib")}
                  </dd>
                </div>
                <div>
                  <dt>{translate("ui.settingsSurface.text.expanded")}</dt>
                  <dd>
                    {effectiveLimits.maxExpandedPackageMiB}{" "}
                    {translate("ui.settingsSurface.text.mib")}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="developer-package-limit-controls">
              <label className="setting-check">
                <input
                  id="custom-package-limits"
                  type="checkbox"
                  checked={settings.developer.useCustomPackageSizeLimits}
                  onChange={(event) => {
                    if (event.target.checked) onRequestPackageLimitOverride();
                    else
                      patch(
                        {
                          ...settings,
                          developer: {
                            ...settings.developer,
                            useCustomPackageSizeLimits: false,
                          },
                        },
                        "developer.packageSizeLimits.enabled",
                      );
                  }}
                />
                <span>
                  {translate("ui.settingsSurface.text.useCustomPackageLimits")}
                </span>
              </label>
              <div
                className="developer-limit-grid"
                aria-describedby={
                  packageLimitError ? "package-limit-error" : undefined
                }
              >
                {(
                  [
                    ["maxArchiveMiB", "Archive", "Compressed .jmp file"],
                    [
                      "maxDefinitionFileMiB",
                      "Definition file",
                      "Individual .jdef file",
                    ],
                    ["maxAssetFileMiB", "Asset file", "Individual asset"],
                    [
                      "maxExpandedPackageMiB",
                      "Expanded package",
                      "All expanded files",
                    ],
                  ] as const
                ).map(([key, label, description]) => (
                  <label className="developer-limit-field" key={key}>
                    <span>{label}</span>
                    <small>{description}</small>
                    <span>
                      <input
                        type="number"
                        min={1}
                        max={ABSOLUTE_PACKAGE_SIZE_LIMITS[key]}
                        step={1}
                        inputMode="numeric"
                        disabled={
                          !settings.developer.useCustomPackageSizeLimits
                        }
                        value={settings.developer[key]}
                        aria-invalid={Boolean(packageLimitError)}
                        onChange={(event) =>
                          updatePackageLimit(key, event.target.valueAsNumber)
                        }
                      />
                      {translate("ui.settingsSurface.text.mib")}
                    </span>
                    <small>
                      {translate("ui.settingsSurface.text.absoluteCeiling")}
                      {ABSOLUTE_PACKAGE_SIZE_LIMITS[key]}{" "}
                      {translate("ui.settingsSurface.text.mib")}
                    </small>
                  </label>
                ))}
              </div>
              {packageLimitError && (
                <p
                  id="package-limit-error"
                  className="developer-limit-error"
                  role="alert"
                >
                  {packageLimitError}
                </p>
              )}
              {settings.developer.useCustomPackageSizeLimits && (
                <p className="developer-risk-warning" role="status">
                  <strong>
                    {translate("ui.settingsSurface.text.atYourOwnRisk")}
                  </strong>{" "}
                  {translate(
                    "ui.settingsSurface.text.increasedByteBudgetsMayUseSubstantiallyMoreMemoryDisk",
                  )}
                </p>
              )}
              <button
                className="setting-reset developer-limit-reset"
                type="button"
                onClick={() =>
                  patch(
                    {
                      ...settings,
                      developer: {
                        ...settings.developer,
                        useCustomPackageSizeLimits: false,
                        ...SAFE_PACKAGE_SIZE_LIMITS,
                      },
                    },
                    "developer.packageSizeLimits.reset",
                  )
                }
              >
                {translate("ui.settingsSurface.text.resetPackageLimits")}
              </button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="debug-events">
                {translate("ui.settingsSurface.text.debugEvents")}
              </label>
              <p>
                {translate(
                  "ui.settingsSurface.text.includeDetailedDebugEventsUntilTheApplicationExits",
                )}
              </p>
            </div>
            <div>
              <span className="setting-state agreed">
                {translate("ui.settingsSurface.text.sessionOnly")}
              </span>
              <label className="setting-check">
                <input
                  id="debug-events"
                  type="checkbox"
                  checked={debugCapture}
                  onChange={(event) => {
                    logger.setDebugCapture(event.target.checked);
                    setDebugCapture(event.target.checked);
                    if (event.target.checked)
                      logger.emit("renderer.cache.reused", {
                        attributes: {
                          routeKind: "settings",
                          cache: "settings-preview",
                        },
                      });
                  }}
                />
                <span>
                  {translate("ui.settingsSurface.text.captureDebugEvents")}
                </span>
              </label>
            </div>
          </div>
          <div className="setting-explanation">
            {translate(
              "ui.settingsSurface.text.logsAreNeverPersistedBetweenLaunchesThisSessionControl",
            )}
          </div>
        </section>
      ) : (
        <section className="developer-subpanel developer-logs-panel">
          <LoggingViewer />
        </section>
      )}
    </section>
  );
}

function SettingRow({
  id,
  label,
  description,
  children,
  reset,
}: {
  id: string;
  label: string;
  description: string;
  children: React.ReactNode;
  reset: () => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <label htmlFor={id}>{label}</label>
        <p>{description}</p>
      </div>
      <div>
        <div className="setting-control-with-reset">
          {children}
          <button type="button" className="setting-reset" onClick={reset}>
            {translate("ui.settingsSurface.text.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}
function CheckRow(props: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  text: string;
  onChange: (value: boolean) => void;
  reset: () => void;
}) {
  return (
    <SettingRow
      id={props.id}
      label={props.label}
      description={props.description}
      reset={props.reset}
    >
      <label className="setting-check">
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        <span>{props.text}</span>
      </label>
    </SettingRow>
  );
}

function NotificationsPanel({
  settings,
  patch,
}: {
  settings: ApplicationSettings;
  patch: (settings: ApplicationSettings, key: string) => void;
}) {
  const { logger } = useSettings();
  const classes: {
    id: NotificationClass;
    label: string;
    description: string;
  }[] = [
    {
      id: "confirmations",
      label: "Action confirmations",
      description: "Save, export, copy, add, remove, and reorder completion",
    },
    {
      id: "editor",
      label: "Editor activity",
      description: "Autosave, formatting, quick fixes, and preview recovery",
    },
    {
      id: "chain",
      label: "Chain activity",
      description: "Jumps, companions, supplements, rolls, and balances",
    },
    {
      id: "validation",
      label: "Validation",
      description: "New diagnostics and blocked operations",
    },
    {
      id: "errors",
      label: "Errors and recovery",
      description:
        "Failed operations, permission loss, fallback recovery, and crashes",
    },
  ];
  const disabled = !settings.notifications.enabled;
  return (
    <section
      className="settings-notifications-panel"
      role="tabpanel"
      aria-labelledby="settings-notifications-tab"
    >
      <h4>{translate("ui.settingsSurface.text.notifications")}</h4>
      <CheckRow
        id="notifications-enabled"
        label={translate("ui.settingsSurface.label.toastNotifications")}
        description={translate(
          "ui.settingsSurface.description.showUserFacingProjectionsOfSelectedSessionLogEvents",
        )}
        checked={settings.notifications.enabled}
        text={translate("ui.settingsSurface.text.enableToastNotifications")}
        onChange={(value) =>
          patch(
            {
              ...settings,
              notifications: { ...settings.notifications, enabled: value },
            },
            "notifications.enabled",
          )
        }
        reset={() =>
          patch(
            {
              ...settings,
              notifications: { ...settings.notifications, enabled: true },
            },
            "notifications.enabled",
          )
        }
      />
      <SettingRow
        id="notifications-max"
        label={translate("ui.settingsSurface.label.maximumVisible")}
        description={translate(
          "ui.settingsSurface.description.additionalNotificationsWaitInTheQueue",
        )}
        reset={() =>
          patch(
            {
              ...settings,
              notifications: { ...settings.notifications, maxVisible: 3 },
            },
            "notifications.maxVisible",
          )
        }
      >
        <select
          id="notifications-max"
          disabled={disabled}
          value={settings.notifications.maxVisible}
          onChange={(event) =>
            patch(
              {
                ...settings,
                notifications: {
                  ...settings.notifications,
                  maxVisible: Number(event.target.value) as 1 | 2 | 3 | 4 | 5,
                },
              },
              "notifications.maxVisible",
            )
          }
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "toast" : "toasts"}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow
        id="notifications-duration"
        label={translate("ui.settingsSurface.label.toastDuration")}
        description={translate(
          "ui.settingsSurface.description.interactionPausesAutomaticDismissal",
        )}
        reset={() =>
          patch(
            {
              ...settings,
              notifications: { ...settings.notifications, durationMs: 5000 },
            },
            "notifications.durationMs",
          )
        }
      >
        <select
          id="notifications-duration"
          disabled={disabled}
          value={settings.notifications.durationMs}
          onChange={(event) =>
            patch(
              {
                ...settings,
                notifications: {
                  ...settings.notifications,
                  durationMs: Number(event.target.value) as
                    3000 | 5000 | 8000 | 15000,
                },
              },
              "notifications.durationMs",
            )
          }
        >
          <option value="3000">
            {translate("ui.settingsSurface.text.3Seconds")}
          </option>
          <option value="5000">
            {translate("ui.settingsSurface.text.5Seconds")}
          </option>
          <option value="8000">
            {translate("ui.settingsSurface.text.8Seconds")}
          </option>
          <option value="15000">
            {translate("ui.settingsSurface.text.15Seconds")}
          </option>
        </select>
      </SettingRow>
      <fieldset className="notification-class-settings">
        <legend>{translate("ui.settingsSurface.text.triggerClasses")}</legend>
        {classes.map((entry) => (
          <label key={entry.id}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={settings.notifications.classes[entry.id]}
              onChange={(event) =>
                patch(
                  {
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      classes: {
                        ...settings.notifications.classes,
                        [entry.id]: event.target.checked,
                      },
                    },
                  },
                  `notifications.classes.${entry.id}`,
                )
              }
            />
            <span>
              <strong>{entry.label}</strong>
              <small>{entry.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="settings-toast-demo">
        <button
          type="button"
          disabled={disabled || !settings.notifications.classes.confirmations}
          onClick={() => logger.emit("settings.notification.previewed")}
        >
          {translate("ui.settingsSurface.text.previewToast")}
        </button>
        <div className="settings-toast-stage" aria-live="polite" />
      </div>
      <div className="setting-explanation">
        {translate(
          "ui.settingsSurface.text.inputDrivenCandidatesWait500MsRepeatedMatchingEvents",
        )}
      </div>
    </section>
  );
}

function KeybindingRow({
  action,
  settings,
}: {
  action: KeybindingAction;
  settings: ApplicationSettings;
}) {
  const { update, logger } = useSettings();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const chord = chordFor(settings, action);
  const display = keybindingDisplay(chord);
  const capture = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return;
    event.preventDefault();
    if (event.key === "Escape") {
      setCapturing(false);
      setError("");
      return;
    }
    if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) return;
    const next: KeybindingChord = {
      key: event.code === "Space" ? "Space" : event.key,
      primary: event.ctrlKey || event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
    };
    const invalid = validateKeybinding(settings, action, next);
    if (invalid) {
      setError(invalid);
      logger.emit("settings.value_rejected", {
        attributes: { settingKey: `keybindings.${action}`, reason: invalid },
      });
      return;
    }
    update(
      (current) => ({
        ...current,
        keybindings: {
          overrides: { ...current.keybindings.overrides, [action]: next },
        },
      }),
      `keybindings.${action}`,
    );
    setCapturing(false);
    setError("");
  };
  return (
    <div>
      <span>
        {keybindingLabels[action]}
        {error && <small role="alert">{error}</small>}
      </span>
      <kbd>{capturing ? "Press shortcut…" : display}</kbd>
      <button
        type="button"
        onClick={() => setCapturing(!capturing)}
        onKeyDown={capture}
      >
        {capturing ? "Cancel" : "Change"}
      </button>
      {settings.keybindings.overrides[action] && (
        <button
          type="button"
          onClick={() =>
            update((current) => {
              const overrides = { ...current.keybindings.overrides };
              delete overrides[action];
              return { ...current, keybindings: { overrides } };
            }, `keybindings.${action}`)
          }
        >
          {translate("ui.settingsSurface.text.reset")}
        </button>
      )}
    </div>
  );
}
