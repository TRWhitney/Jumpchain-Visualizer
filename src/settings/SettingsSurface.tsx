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
  applyInterfaceExperience,
  chordFor,
  defaultSettings,
  effectivePackageSizeLimits,
  interfaceExperienceFor,
  assetToolKeybindingActions,
  keybindingDisplay,
  keybindingLabels,
  sourceKeybindingActions,
  validatePackageSizeLimits,
  validateKeybinding,
  type ApplicationSettings,
  type InterfaceExperiencePreset,
  type KeybindingAction,
  type KeybindingChord,
  type NotificationClass,
  type PackageSizeLimits,
  type SettingsCategory,
} from "./model";
import { createDefaultTagProfile } from "./tagProfile";
import { changeLanguage, translate, translationCatalog } from "../localization";
import { NumberStepper } from "../ui/NumberStepper";
import {
  categoriesFor,
  initiallyExpandedSections,
  searchValue,
  settingsDescriptorRegistry,
  type SettingsSectionId,
} from "./descriptors";

export function SettingsSurface({
  onClose,
  onResetMockData,
  onRestartWelcomeTour = () => undefined,
  direct = false,
  category,
  onCategoryChange,
}: {
  onClose: () => void;
  onResetMockData: () => Promise<boolean>;
  onRestartWelcomeTour?: () => void;
  direct?: boolean;
  category: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}) {
  const { settings, replace } = useSettings();
  const categories = categoriesFor();
  const [query, setQuery] = useState("");
  const [resetConfirm, setResetConfirm] = useState<"all" | "tags" | null>(null);
  const [packageRiskConfirm, setPackageRiskConfirm] = useState(false);
  const [expandedSections, setExpandedSections] = useState(
    initiallyExpandedSections,
  );
  const root = useRef<HTMLDivElement>(null);
  const defaults = useMemo(
    () => defaultSettings(createDefaultTagProfile()),
    [],
  );
  const results = settingsDescriptorRegistry.filter((entry) =>
    query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((term) =>
        `${translate(entry.labelKey)} ${entry.path} ${translate(entry.aliasesKey)} ${searchValue(entry.path, settings)}`
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
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex='0']",
        ),
      ].filter((element) => {
        if (element.closest("[hidden]")) return false;
        const closedSection = element.closest<HTMLDetailsElement>(
          "details:not([open])",
        );
        return (
          !closedSection ||
          element === closedSection.querySelector(":scope > summary")
        );
      });
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
      next.general = defaults.general;
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
      data-context-menu-suppress-noneditable-controls
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
                    key={entry.path}
                    type="button"
                    onClick={() => {
                      if (entry.section)
                        setExpandedSections((current) => ({
                          ...current,
                          [entry.section!]: true,
                        }));
                      activate(entry.category);
                      requestAnimationFrame(() => {
                        const target = document.getElementById(entry.anchor);
                        if (target?.getAttribute("role") === "tab")
                          target.click();
                        target?.focus();
                      });
                    }}
                  >
                    <span>
                      <strong>{translate(entry.labelKey)}</strong>
                      <small>
                        <code>{entry.path}</code> ·{" "}
                        {
                          categories.find(
                            (candidate) => candidate.id === entry.category,
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
            expandedSections={expandedSections}
            onSectionExpandedChange={(section, expanded) =>
              setExpandedSections((current) => ({
                ...current,
                [section]: expanded,
              }))
            }
            onRequestPackageLimitOverride={() => setPackageRiskConfirm(true)}
            onResetMockData={onResetMockData}
            onRestartWelcomeTour={onRestartWelcomeTour}
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
  expandedSections,
  onSectionExpandedChange,
  onRequestPackageLimitOverride,
  onResetMockData,
  onRestartWelcomeTour,
}: {
  category: SettingsCategory;
  settings: ApplicationSettings;
  defaults: ApplicationSettings;
  expandedSections: Record<SettingsSectionId, boolean>;
  onSectionExpandedChange: (
    section: SettingsSectionId,
    expanded: boolean,
  ) => void;
  onRequestPackageLimitOverride: () => void;
  onResetMockData: () => Promise<boolean>;
  onRestartWelcomeTour: () => void;
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
        <div className="settings-section-list">
          <SettingsSection
            id="general-essentials"
            label={translate("ui.settingsSurface.text.essentials")}
            expanded={expandedSections["general-essentials"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("general-essentials", expanded)
            }
          >
            <SettingRow
              id="interface-experience"
              label={translate("ui.settingsSurface.label.interfaceExperience")}
              description={translate(
                "ui.settingsSurface.description.applyAStartingCollectionOfPresentationPreferences",
              )}
              reset={() =>
                patch(
                  applyInterfaceExperience(settings, "advanced"),
                  "general.interfaceExperience",
                )
              }
            >
              <select
                id="interface-experience"
                value={interfaceExperienceFor(settings)}
                onChange={(event) => {
                  if (event.target.value === "custom") return;
                  patch(
                    applyInterfaceExperience(
                      settings,
                      event.target.value as InterfaceExperiencePreset,
                    ),
                    "general.interfaceExperience",
                  );
                }}
              >
                <option value="advanced">
                  {translate("ui.settingsSurface.text.experienced")}
                </option>
                <option value="beginner-friendly">
                  {translate("ui.settingsSurface.text.newUserFriendly")}
                </option>
                <option value="custom" disabled>
                  {translate("ui.settingsSurface.text.custom")}
                </option>
              </select>
            </SettingRow>
            <SettingRow
              id="language-selection"
              label={translate("settingsSearch.language_tag.label")}
              description={translate("language.description")}
              reset={() => {
                void changeLanguage(defaults.language.tag);
                patch(
                  { ...settings, language: defaults.language },
                  "language.tag",
                );
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
          </SettingsSection>
          <SettingsSection
            id="general-interface"
            label={translate("ui.settingsSurface.text.interfaceBehavior")}
            expanded={expandedSections["general-interface"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("general-interface", expanded)
            }
          >
            <CheckRow
              id="hide-technical-locations"
              label={translate("ui.settingsSurface.label.technicalLocations")}
              description={translate(
                "ui.settingsSurface.description.hideRawRouteIdentifiersWhileKeepingNavigationLabels",
              )}
              checked={settings.general.hideTechnicalLocations}
              text={translate("ui.settingsSurface.text.hideTechnicalLocations")}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    general: {
                      ...settings.general,
                      hideTechnicalLocations: value,
                    },
                  },
                  "general.hideTechnicalLocations",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    general: {
                      ...settings.general,
                      hideTechnicalLocations: false,
                    },
                  },
                  "general.hideTechnicalLocations",
                )
              }
            />
            <CheckRow
              id="collapse-optional-sections"
              label={translate(
                "ui.settingsSurface.label.optionalSectionDefaults",
              )}
              description={translate(
                "ui.settingsSurface.description.startFineGrainedEditorAndTagSectionsCollapsed",
              )}
              checked={settings.general.collapseOptionalSectionsByDefault}
              text={translate(
                "ui.settingsSurface.text.collapseOptionalSectionsByDefault",
              )}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    general: {
                      ...settings.general,
                      collapseOptionalSectionsByDefault: value,
                    },
                  },
                  "general.collapseOptionalSectionsByDefault",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    general: {
                      ...settings.general,
                      collapseOptionalSectionsByDefault: false,
                    },
                  },
                  "general.collapseOptionalSectionsByDefault",
                )
              }
            />
            <div className="setting-explanation">
              {translate(
                "ui.settingsSurface.text.homeIsAlwaysTheRootDestinationStartupRedirectionIs",
              )}
            </div>
          </SettingsSection>
          <SettingsSection
            id="general-welcome"
            label={translate("ui.settingsSurface.label.welcomeTour")}
            expanded={expandedSections["general-welcome"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("general-welcome", expanded)
            }
          >
            <SettingRow
              id="welcome-tour"
              label={translate("ui.settingsSurface.label.welcomeTour")}
              description={translate(
                "ui.settingsSurface.description.restartTheGuidedWelcomeTour",
              )}
            >
              <button type="button" onClick={onRestartWelcomeTour}>
                {translate("ui.settingsSurface.text.restartWelcomeTour")}
              </button>
            </SettingRow>
          </SettingsSection>
        </div>
      </section>
    );
  if (category === "editor")
    return (
      <section role="tabpanel" aria-labelledby="settings-editor-tab">
        <h4>{translate("ui.settingsSurface.text.editor")}</h4>
        <div className="settings-section-list">
          <SettingsSection
            id="editor-workflow"
            label={translate("ui.settingsSurface.text.workflow")}
            expanded={expandedSections["editor-workflow"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("editor-workflow", expanded)
            }
          >
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
          </SettingsSection>
          <SettingsSection
            id="editor-display"
            label={translate("ui.settingsSurface.text.displayAndGuidance")}
            expanded={expandedSections["editor-display"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("editor-display", expanded)
            }
          >
            <CheckRow
              id="show-explanatory-text"
              label={translate("ui.settingsSurface.label.editorExplanations")}
              description={translate(
                "ui.settingsSurface.description.showOptionalEditorGuidance",
              )}
              checked={settings.editor.showExplanatoryText}
              text={translate("ui.settingsSurface.text.showExplanatoryText")}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      showExplanatoryText: value,
                    },
                  },
                  "editor.showExplanatoryText",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      showExplanatoryText: false,
                    },
                  },
                  "editor.showExplanatoryText",
                )
              }
            />
            <CheckRow
              id="collapse-advanced-views"
              label={translate("ui.settingsSurface.label.advancedEditorViews")}
              description={translate(
                "ui.settingsSurface.description.startFilesSourceAndPropertiesBehindAdvancedViews",
              )}
              checked={settings.editor.collapseAdvancedViews}
              text={translate("ui.settingsSurface.text.collapseAdvancedViews")}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      collapseAdvancedViews: value,
                    },
                  },
                  "editor.collapseAdvancedViews",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      collapseAdvancedViews: false,
                    },
                  },
                  "editor.collapseAdvancedViews",
                )
              }
            />
            <CheckRow
              id="collapse-preview-inspection-tools"
              label={translate(
                "ui.settingsSurface.label.previewInspectionTools",
              )}
              description={translate(
                "ui.settingsSurface.description.startInspectAndStripColorBehindPreviewTools",
              )}
              checked={settings.editor.collapsePreviewInspectionTools}
              text={translate(
                "ui.settingsSurface.text.collapsePreviewInspectionTools",
              )}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      collapsePreviewInspectionTools: value,
                    },
                  },
                  "editor.collapsePreviewInspectionTools",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      collapsePreviewInspectionTools: false,
                    },
                  },
                  "editor.collapsePreviewInspectionTools",
                )
              }
            />
            <SettingRow
              id="layout-preview-placeholder-limit"
              label={translate(
                "ui.settingsSurface.label.layoutPreviewPlaceholderCharacterLimit",
              )}
              description={translate(
                "ui.settingsSurface.description.limitGeneratedLayoutPreviewPlaceholderText",
              )}
              reset={() =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      layoutPreviewPlaceholderCharacterLimit: null,
                    },
                  },
                  "editor.layoutPreviewPlaceholderCharacterLimit",
                )
              }
            >
              <span className="settings-number-stepper">
                <NumberStepper
                  id="layout-preview-placeholder-limit"
                  label={translate(
                    "ui.settingsSurface.label.layoutPreviewPlaceholderCharacterLimit",
                  )}
                  min={1}
                  max={1_000}
                  placeholder={translate(
                    "ui.settingsSurface.placeholder.unlimitedCharacters",
                  )}
                  fluid
                  value={settings.editor.layoutPreviewPlaceholderCharacterLimit}
                  onChange={(value) =>
                    patch(
                      {
                        ...settings,
                        editor: {
                          ...settings.editor,
                          layoutPreviewPlaceholderCharacterLimit:
                            value === null
                              ? null
                              : Math.min(1_000, Math.max(1, Math.trunc(value))),
                        },
                      },
                      "editor.layoutPreviewPlaceholderCharacterLimit",
                    )
                  }
                />
              </span>
            </SettingRow>
          </SettingsSection>
          <SettingsSection
            id="editor-warnings"
            label={translate("ui.settingsSurface.text.warnings")}
            expanded={expandedSections["editor-warnings"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("editor-warnings", expanded)
            }
          >
            <CheckRow
              id="warn-alt"
              label={translate(
                "ui.settingsSurface.label.missingImageAltWarning",
              )}
              description={translate(
                "ui.settingsSurface.description.warnWhenAnImageBlockOmitsAlternativeText",
              )}
              checked={settings.editor.warnMissingImageAlt}
              text={translate(
                "ui.settingsSurface.text.showAccessibilityWarning",
              )}
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
              text={translate(
                "ui.settingsSurface.text.showMissingTargetWarning",
              )}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      warnMissingLayoutTargets: value,
                    },
                  },
                  "editor.warnMissingLayoutTargets",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    editor: {
                      ...settings.editor,
                      warnMissingLayoutTargets: true,
                    },
                  },
                  "editor.warnMissingLayoutTargets",
                )
              }
            />
          </SettingsSection>
        </div>
      </section>
    );
  if (category === "chain")
    return (
      <section role="tabpanel" aria-labelledby="settings-chain-tab">
        <h4>{translate("ui.settingsSurface.text.chainTracker")}</h4>
        <div className="settings-section-list">
          <SettingsSection
            id="chain-controls"
            label={translate("ui.settingsSurface.text.controlsAndRules")}
            expanded={expandedSections["chain-controls"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("chain-controls", expanded)
            }
          >
            <CheckRow
              id="compact-jump-actions"
              label={translate("ui.settingsSurface.label.jumpRowActions")}
              description={translate(
                "ui.settingsSurface.description.replaceRepeatedMoveAndRemoveButtonsWithAnActionsMenu",
              )}
              checked={settings.chain.compactJumpActions}
              text={translate("ui.settingsSurface.text.compactJumpActions")}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    chain: { ...settings.chain, compactJumpActions: value },
                  },
                  "chain.compactJumpActions",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    chain: { ...settings.chain, compactJumpActions: false },
                  },
                  "chain.compactJumpActions",
                )
              }
            />
            <CheckRow
              id="collapse-inventory-tag-filters"
              label={translate("ui.settingsSurface.label.inventoryTagFilters")}
              description={translate(
                "ui.settingsSurface.description.startInventoryTagRelationshipsBehindAToolbarDisclosure",
              )}
              checked={settings.chain.collapseInventoryTagFilters}
              text={translate(
                "ui.settingsSurface.text.collapseInventoryTagFilters",
              )}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    chain: {
                      ...settings.chain,
                      collapseInventoryTagFilters: value,
                    },
                  },
                  "chain.collapseInventoryTagFilters",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    chain: {
                      ...settings.chain,
                      collapseInventoryTagFilters: false,
                    },
                  },
                  "chain.collapseInventoryTagFilters",
                )
              }
            />
            <CheckRow
              id="multiple-versions"
              label={translate(
                "ui.settingsSurface.label.addAnotherPackageVersion",
              )}
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
              label={translate(
                "ui.settingsSurface.label.negativePointBalances",
              )}
              description={translate(
                "ui.settingsSurface.description.permitActiveChoiceSelectionsThatWouldMakePrimaryJump",
              )}
              checked={settings.chain.allowNegativePointBalances}
              text={translate("ui.settingsSurface.text.allowNegativeBalances")}
              onChange={(value) =>
                patch(
                  {
                    ...settings,
                    chain: {
                      ...settings.chain,
                      allowNegativePointBalances: value,
                    },
                  },
                  "chain.allowNegativePointBalances",
                )
              }
              reset={() =>
                patch(
                  {
                    ...settings,
                    chain: {
                      ...settings.chain,
                      allowNegativePointBalances: false,
                    },
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
          </SettingsSection>
          <SettingsSection
            id="chain-inventory"
            label={translate("ui.settingsSurface.text.inventoryAndAppearance")}
            expanded={expandedSections["chain-inventory"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("chain-inventory", expanded)
            }
          >
            <CheckRow
              id="aggregate-similar-inventory"
              label={translate(
                "ui.settingsSurface.label.aggregateSimilarPerksAndItems",
              )}
              description={translate(
                "ui.settingsSurface.description.combineRecordsWithTheSameOwnerKindResolvedName",
              )}
              checked={settings.chain.aggregateSimilarInventory}
              text={translate(
                "ui.settingsSurface.text.aggregateSimilarRecords",
              )}
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
              label={translate(
                "ui.settingsSurface.label.includeItemTagsInRadar",
              )}
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
          </SettingsSection>
          <SettingsSection
            id="chain-warnings"
            label={translate("ui.settingsSurface.text.changeWarnings")}
            expanded={expandedSections["chain-warnings"]}
            onExpandedChange={(expanded) =>
              onSectionExpandedChange("chain-warnings", expanded)
            }
          >
            <CheckRow
              id="upstream"
              label={translate(
                "ui.settingsSurface.label.upstreamChangeWarnings",
              )}
              description={translate(
                "ui.settingsSurface.description.reviewReorderOrDeletionOnlyWhenAnExplicitActive",
              )}
              checked={settings.chain.warnUpstreamChanges}
              text={translate(
                "ui.settingsSurface.text.warnAboutUpstreamChanges",
              )}
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
          </SettingsSection>
        </div>
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
          {[
            {
              label: translate("ui.settingsSurface.text.sourceEditorShortcuts"),
              actions: sourceKeybindingActions,
            },
            {
              label: translate("ui.settingsSurface.text.assetEditorShortcuts"),
              actions: assetToolKeybindingActions,
            },
          ].map((group) => (
            <details key={group.label} open>
              <summary>{group.label}</summary>
              <div className="keybinding-section-body">
                {group.actions.map((action) => (
                  <KeybindingRow
                    key={action}
                    action={action}
                    settings={settings}
                  />
                ))}
              </div>
            </details>
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
                  <div className="developer-limit-field" key={key}>
                    <span>{label}</span>
                    <small>{description}</small>
                    <span>
                      <span className="settings-number-stepper">
                        <NumberStepper
                          label={`${label} limit`}
                          value={settings.developer[key]}
                          min={1}
                          max={ABSOLUTE_PACKAGE_SIZE_LIMITS[key]}
                          fluid
                          disabled={
                            !settings.developer.useCustomPackageSizeLimits
                          }
                          invalid={Boolean(packageLimitError)}
                          onChange={(value) => {
                            if (value !== null) updatePackageLimit(key, value);
                          }}
                        />
                      </span>
                      {translate("ui.settingsSurface.text.mib")}
                    </span>
                    <small>
                      {translate("ui.settingsSurface.text.absoluteCeiling")}
                      {ABSOLUTE_PACKAGE_SIZE_LIMITS[key]}{" "}
                      {translate("ui.settingsSurface.text.mib")}
                    </small>
                  </div>
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

function SettingsSection({
  id,
  label,
  expanded,
  onExpandedChange,
  children,
}: {
  id: SettingsSectionId;
  label: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <details
      className="settings-section"
      data-settings-section={id}
      open={expanded}
      onToggle={(event) => onExpandedChange(event.currentTarget.open)}
    >
      <summary>
        <h5>{label}</h5>
      </summary>
      <div className="settings-section-body">{children}</div>
    </details>
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
  reset?: () => void;
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
          {reset && (
            <button type="button" className="setting-reset" onClick={reset}>
              {translate("ui.settingsSurface.text.reset")}
            </button>
          )}
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
    <div className="keybinding-row">
      <span>
        {keybindingLabels[action]}
        {error && <small role="alert">{error}</small>}
      </span>
      <kbd>{capturing ? "Press shortcut…" : display}</kbd>
      <span className="keybinding-actions">
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
      </span>
    </div>
  );
}
