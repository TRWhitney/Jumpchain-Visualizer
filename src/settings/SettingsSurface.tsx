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

const categories: { id: SettingsCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "chain", label: "Chain Tracker" },
  { id: "notifications", label: "Notifications" },
  { id: "tags", label: "Tags" },
  { id: "keys", label: "Key bindings" },
  { id: "accessibility", label: "Accessibility" },
  { id: "developer", label: "Developer" },
];

const searchEntries = [
  [
    "Appearance",
    "appearance.theme",
    "general",
    "theme",
    "appearance theme system light dark color mode",
  ],
  [
    "Accent color",
    "appearance.accentColor",
    "general",
    "accent",
    "accent color colour hex gold theme appearance",
  ],
  [
    "Saving",
    "editor.saveMode",
    "editor",
    "save-mode",
    "saving save autosave explicit persistence editor",
  ],
  [
    "Missing image alt warning",
    "editor.warnMissingImageAlt",
    "editor",
    "warn-alt",
    "editor image alt alternative text accessibility warning",
  ],
  [
    "Missing layout target warning",
    "editor.warnMissingLayoutTargets",
    "editor",
    "warn-layout",
    "editor layout target reusable warning",
  ],
  [
    "Add another package version",
    "chain.allowMultiplePackageVersions",
    "chain",
    "multiple-versions",
    "chain add second package version multiple parallel",
  ],
  [
    "Allow duplicate jumps",
    "chain.allowDuplicateJumps",
    "chain",
    "duplicate-jumps",
    "chain add same exact jump package duplicate repeat again",
  ],
  [
    "Negative point balances",
    "chain.allowNegativePointBalances",
    "chain",
    "negative-balances",
    "chain negative point balance overspend currency",
  ],
  [
    "Allow rerolls",
    "chain.allowRerolls",
    "chain",
    "rerolls",
    "chain reroll random replace result",
  ],
  [
    "Include item tags in radar",
    "chain.includeItemTagsInRadar",
    "chain",
    "item-tags-radar",
    "chain radar stats count item tags jumper forms inventory",
  ],
  [
    "Aggregate similar perks and items",
    "chain.aggregateSimilarInventory",
    "chain",
    "aggregate-similar-inventory",
    "chain inventory aggregate similar same name rank perk item copies sources descriptions",
  ],
  [
    "Upstream change warnings",
    "chain.warnUpstreamChanges",
    "chain",
    "upstream",
    "chain upstream change warning reorder remove dependency",
  ],
  [
    "Color chain names by primary tag",
    "chain.colorNamesByPrimaryTag",
    "chain",
    "color-chain",
    "chain color names primary highest perk tag",
  ],
  [
    "Toast notifications",
    "notifications.*",
    "notifications",
    "notifications-enabled",
    "notifications toast enabled maximum duration confirmations editor chain validation errors",
  ],
  [
    "Tag profile",
    "tags.profile",
    "tags",
    "tag-profile-search",
    "tags profile category parent aliases badges colors gradients presentation import export",
  ],
  [
    "Key bindings",
    "keybindings.overrides",
    "keys",
    "keybindings",
    "keyboard key bindings shortcuts quick add quick fix find overrides",
  ],
  [
    "Motion",
    "accessibility.motion",
    "accessibility",
    "motion",
    "motion animation reduced full system accessibility",
  ],
  [
    "Session logs",
    "Developer → Logs",
    "developer",
    "developer-logs-tab",
    "developer logs logging viewer stack trace crash report debug session export clear",
  ],
  [
    "Show additional Jump information",
    "developer.showAdditionalJumpInformation",
    "developer",
    "additional-jump-information",
    "developer jump format additional information diagnostics format 1",
  ],
  [
    "Package size limits",
    "developer.packageSizeLimits",
    "developer",
    "custom-package-limits",
    "developer package archive definition asset expanded size limits mib import export at your own risk",
  ],
] as const;

const searchValue = (
  key: (typeof searchEntries)[number][1],
  settings: ApplicationSettings,
) => {
  switch (key) {
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
    case "Developer → Logs":
      return "session only";
    case "developer.showAdditionalJumpInformation":
      return String(settings.developer.showAdditionalJumpInformation);
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
  direct = false,
  category,
  onCategoryChange,
}: {
  onClose: () => void;
  direct?: boolean;
  category: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}) {
  const { settings, replace } = useSettings();
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
        `${entry[0]} ${entry[1]} ${entry[4]} ${searchValue(entry[1], settings)}`
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
    if (category === "general") next.appearance = defaults.appearance;
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
      aria-label="Application Settings"
    >
      <aside aria-label="Settings categories">
        <div className="settings-mock-title">
          <span aria-hidden="true">⚙</span>
          <strong>Settings</strong>
        </div>
        <label className="settings-mock-search">
          <span className="sr-only">Search settings</span>
          <input
            type="search"
            placeholder="Search settings"
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
        <nav role="tablist" aria-label="Setting category">
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
          Reset all settings
        </button>
      </aside>
      <div className="settings-mock-content">
        <header>
          <div>
            <p>Application settings</p>
            <h3 data-settings-heading tabIndex={-1}>
              Preferences
            </h3>
          </div>
          <div className="app-settings-header-actions">
            <button type="button" onClick={resetCategory}>
              Reset category
            </button>
            <button type="button" aria-label="Close Settings" onClick={onClose}>
              ×
            </button>
          </div>
        </header>
        {query ? (
          <section className="settings-search-panel" aria-live="polite">
            <h4>
              Search results{" "}
              <span>
                {results.length} {results.length === 1 ? "result" : "results"}
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
                      <strong>{entry[0]}</strong>
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
                No settings match this search.
              </p>
            )}
          </section>
        ) : (
          <CategoryPanel
            category={category}
            settings={settings}
            defaults={defaults}
            onRequestPackageLimitOverride={() => setPackageRiskConfirm(true)}
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
            <p>Destructive reset</p>
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
                Reset
              </button>
              <button
                autoFocus
                type="button"
                onClick={() => setResetConfirm(null)}
              >
                Cancel
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
            <p>Developer override</p>
            <h4 id="package-risk-heading">
              Increase package limits at your own risk
            </h4>
            <p>
              Larger packages can consume substantial memory, disk space, and
              processing time. These limits affect Editor import and export,
              desktop project loading, and Chain Tracker package installation.
            </p>
            <p>
              Path, file-type, compression-ratio, image, schema, and atomicity
              protections remain mandatory and cannot be disabled.
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
                I understand, enable
              </button>
              <button
                autoFocus
                type="button"
                onClick={() => setPackageRiskConfirm(false)}
              >
                Cancel
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
}: {
  category: SettingsCategory;
  settings: ApplicationSettings;
  defaults: ApplicationSettings;
  onRequestPackageLimitOverride: () => void;
}) {
  const { update, logger } = useSettings();
  const [developerPage, setDeveloperPage] = useState<"overview" | "logs">(
    "overview",
  );
  const [debugCapture, setDebugCapture] = useState(
    logger.isDebugCaptureEnabled(),
  );
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
        <h4>General</h4>
        <SettingRow
          id="theme"
          label="Appearance"
          description="Choose the application color theme."
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
            <option value="system">Use system setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </SettingRow>
        <SettingRow
          id="accent"
          label="Accent color"
          description="Choose the base color used to derive accessible application accents."
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
          Home is always the root destination. Startup redirection is an agreed
          application behavior, not a configurable preference.
        </div>
      </section>
    );
  if (category === "editor")
    return (
      <section role="tabpanel" aria-labelledby="settings-editor-tab">
        <h4>Editor</h4>
        <SettingRow
          id="save-mode"
          label="Saving"
          description="Choose whether Editor changes save automatically."
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
            <option value="autosave">Autosave</option>
            <option value="explicit">Explicit save</option>
          </select>
        </SettingRow>
        <CheckRow
          id="warn-alt"
          label="Missing image alt warning"
          description="Warn when an image block omits alternative text."
          checked={settings.editor.warnMissingImageAlt}
          text="Show accessibility warning"
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
          label="Missing layout target warning"
          description="Warn when a reusable layout target is absent."
          checked={settings.editor.warnMissingLayoutTargets}
          text="Show missing-target warning"
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
        <div className="setting-explanation">
          These preferences are persisted now; Editor behavior remains inert
          until the Editor workspace is implemented.
        </div>
      </section>
    );
  if (category === "chain")
    return (
      <section role="tabpanel" aria-labelledby="settings-chain-tab">
        <h4>Chain Tracker</h4>
        <CheckRow
          id="multiple-versions"
          label="Add another package version"
          description="Allow Add to place a second installed version of a logical Jump package into the current chain."
          checked={settings.chain.allowMultiplePackageVersions}
          text="Allow second version"
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
          label="Allow duplicate jumps"
          description="Allow the same exact Jump package to be added to this chain more than once as independent entries."
          checked={settings.chain.allowDuplicateJumps}
          text="Allow duplicate jumps"
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
          label="Negative point balances"
          description="Permit active choice selections that would make primary Jump points negative. Clearing choices and recalculation are never blocked."
          checked={settings.chain.allowNegativePointBalances}
          text="Allow negative balances"
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
          label="Rerolls"
          description="Allow a recorded random result to be replaced for the same chain entry."
          checked={settings.chain.allowRerolls}
          text="Allow rerolls"
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
          label="Aggregate similar perks and items"
          description="Combine records with the same owner, kind, resolved name, and rank while retaining every source, description, and tag."
          checked={settings.chain.aggregateSimilarInventory}
          text="Aggregate similar records"
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
          label="Include item tags in radar"
          description="Count tags from Jumper and form items in radar statistics. Companion perks and items never contribute."
          checked={settings.chain.includeItemTagsInRadar}
          text="Count item tags"
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
          label="Upstream change warnings"
          description="Review reorder or deletion only when an explicit active downstream dependency would become invalid."
          checked={settings.chain.warnUpstreamChanges}
          text="Warn about upstream changes"
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
          label="Color chain names by primary tag"
          description="Color saved-chain names from the category with the greatest eligible radar count."
          checked={settings.chain.colorNamesByPrimaryTag}
          text="Color chain names"
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
          Similar inventory aggregation is on by default; the other seven
          settings are off. Exact versions never duplicate, and upstream review
          remains material-only and undoable.
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
        <h4>Key bindings</h4>
        <div id="keybindings" className="keybinding-list">
          {(["quickAdd", "quickFix", "find"] as KeybindingAction[]).map(
            (action) => (
              <KeybindingRow key={action} action={action} settings={settings} />
            ),
          )}
        </div>
        <div className="setting-explanation">
          Overrides are user-local. Duplicate or platform-reserved bindings are
          reported before a change is accepted. Editor commands remain inert.
        </div>
      </section>
    );
  if (category === "accessibility")
    return (
      <section role="tabpanel" aria-labelledby="settings-accessibility-tab">
        <h4>Accessibility</h4>
        <SettingRow
          id="motion"
          label="Motion"
          description="Control nonessential interface animation."
          reset={() =>
            patch(
              { ...settings, accessibility: defaults.accessibility },
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
                    motion: event.target
                      .value as ApplicationSettings["accessibility"]["motion"],
                  },
                },
                "accessibility.motion",
              )
            }
          >
            <option value="system">Use system setting</option>
            <option value="reduced">Reduce motion</option>
            <option value="full">Full motion</option>
          </select>
        </SettingRow>
        <div className="setting-explanation">
          Reduced motion removes nonessential movement without hiding state
          changes or progress feedback.
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
        aria-label="Developer settings pages"
      >
        <button
          type="button"
          role="tab"
          aria-selected={developerPage === "overview"}
          onClick={() => setDeveloperPage("overview")}
        >
          Overview
        </button>
        <button
          id="developer-logs-tab"
          type="button"
          role="tab"
          aria-selected={developerPage === "logs"}
          onClick={() => setDeveloperPage("logs")}
        >
          Logs
        </button>
      </div>
      {developerPage === "overview" ? (
        <section className="developer-subpanel">
          <h4>Developer</h4>
          <CheckRow
            id="additional-jump-information"
            label="Show additional Jump information"
            description="Show the evaluated package format above ordinary rendered Jumps."
            checked={settings.developer.showAdditionalJumpInformation}
            text="Enable extra information"
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
          <div className="setting-row developer-package-limits">
            <div>
              <label htmlFor="custom-package-limits">Package size limits</label>
              <p>
                Byte budgets shared by Editor import/export, desktop projects,
                and Chain Tracker installation.
              </p>
              <dl className="developer-effective-limits">
                <div>
                  <dt>Archive</dt>
                  <dd>{effectiveLimits.maxArchiveMiB} MiB</dd>
                </div>
                <div>
                  <dt>Definition</dt>
                  <dd>{effectiveLimits.maxDefinitionFileMiB} MiB</dd>
                </div>
                <div>
                  <dt>Asset</dt>
                  <dd>{effectiveLimits.maxAssetFileMiB} MiB</dd>
                </div>
                <div>
                  <dt>Expanded</dt>
                  <dd>{effectiveLimits.maxExpandedPackageMiB} MiB</dd>
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
                <span>Use custom package limits</span>
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
                      MiB
                    </span>
                    <small>
                      Absolute ceiling: {ABSOLUTE_PACKAGE_SIZE_LIMITS[key]} MiB
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
                  <strong>At your own risk.</strong> Increased byte budgets may
                  use substantially more memory, disk space, and processing
                  time. Other malicious-file protections stay active.
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
                Reset package limits
              </button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="debug-events">Debug events</label>
              <p>Include detailed debug events until the application exits.</p>
            </div>
            <div>
              <span className="setting-state agreed">Session only</span>
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
                <span>Capture debug events</span>
              </label>
            </div>
          </div>
          <div className="setting-explanation">
            Logs are never persisted between launches. This session control is
            not stored as a preference.
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
            Reset
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
      <h4>Notifications</h4>
      <CheckRow
        id="notifications-enabled"
        label="Toast notifications"
        description="Show user-facing projections of selected session log events."
        checked={settings.notifications.enabled}
        text="Enable toast notifications"
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
        label="Maximum visible"
        description="Additional notifications wait in the queue."
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
        label="Toast duration"
        description="Interaction pauses automatic dismissal."
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
          <option value="3000">3 seconds</option>
          <option value="5000">5 seconds</option>
          <option value="8000">8 seconds</option>
          <option value="15000">15 seconds</option>
        </select>
      </SettingRow>
      <fieldset className="notification-class-settings">
        <legend>Trigger classes</legend>
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
          Preview toast
        </button>
        <div className="settings-toast-stage" aria-live="polite" />
      </div>
      <div className="setting-explanation">
        Input-driven candidates wait 500 ms. Repeated matching events update one
        toast and its occurrence count.
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
  const labels = { quickAdd: "Quick Add", quickFix: "Quick Fix", find: "Find" };
  const chord = chordFor(settings, action);
  const platformPrimary = /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
  const display = [
    chord.primary ? platformPrimary : "",
    chord.alt ? "Alt" : "",
    chord.shift ? "Shift" : "",
    chord.key.length === 1 ? chord.key.toLocaleUpperCase() : chord.key,
  ]
    .filter(Boolean)
    .join("+");
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
      key: event.key,
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
        {labels[action]}
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
          Reset
        </button>
      )}
    </div>
  );
}
