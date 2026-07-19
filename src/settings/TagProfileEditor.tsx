import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useSettings } from "./SettingsContext";
import { CanonicalTagBadge } from "./TagBadge";
import {
  addTag,
  canonicalTagAlias,
  deleteTag,
  exportTagProfile,
  importTagProfile,
  installedTagCandidates,
  normalizeTag,
  refreshInstalledTags,
  removeAlias,
  resetTag,
  setTagParent,
  tagAliasesForPresentation,
  tagLabelForPresentation,
  toggleAlias,
  updateTagPresentation,
  type TagPresentation,
  type TagProfile,
} from "./tagProfile";
import { primaryTagIds } from "./builtinTags";
import { translate } from "../localization";

const sourceLabels = {
  builtin: "Built-in",
  acquired: "Installed jump",
  manual: "Custom",
  imported: "Imported profile",
};
const animationLabels: Record<TagPresentation["animation"], string> = {
  none: "None",
  rainbow: "Rainbow",
  marquee: "Marquee",
  ghost: "Ghost",
  bounce: "Bounce",
};

export function TagProfileEditor() {
  const { settings, update, logger, installedPackages } = useSettings();
  const profile = settings.tags.profile;
  const languageTag = settings.language.tag;
  const [selectedId, setSelectedId] = useState(
    profile.tags.physical ? "physical" : Object.keys(profile.tags)[0],
  );
  const [search, setSearch] = useState("");
  const [addPanel, setAddPanel] = useState<"manual" | "acquired" | null>(null);
  const [manualName, setManualName] = useState("");
  const [message, setMessage] = useState("");
  const [jsonMode, setJsonMode] = useState<"export" | "import" | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [pendingImport, setPendingImport] = useState<{
    profile: TagProfile;
    count: number;
  } | null>(null);
  const [aliasTarget, setAliasTarget] = useState("");
  const [selectedStop, setSelectedStop] = useState(1);
  const [animationOpen, setAnimationOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    primary: false,
    builtin: false,
    acquired: true,
  });
  const tag = profile.tags[selectedId] ?? Object.values(profile.tags)[0];
  const entries = Object.values(profile.tags);
  const displayName = (entry: (typeof entries)[number]) =>
    tagLabelForPresentation(entry, languageTag);
  const displayAliases = (entry: (typeof entries)[number]) =>
    tagAliasesForPresentation(entry, languageTag);
  const visible = entries.filter((entry) =>
    [displayName(entry), ...displayAliases(entry), entry.name, ...entry.aliases]
      .join(" ")
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const acquiredCandidates = installedTagCandidates(profile, installedPackages);

  const replaceProfile = (
    next: TagProfile,
    key = "tags.profile",
    continuous = false,
  ) =>
    update(
      (current) => ({ ...current, tags: { profile: next } }),
      key,
      continuous,
    );
  const patchPresentation = (
    patch: Partial<TagPresentation>,
    continuous = false,
  ) =>
    replaceProfile(
      updateTagPresentation(profile, tag.id, patch),
      `tags.profile.${tag.id}.presentation`,
      continuous,
    );
  const select = (id: string) => {
    setSelectedId(id);
    setSelectedStop(1);
    setAliasTarget("");
    setMessage("");
  };

  const groups = [
    {
      id: "primary" as const,
      label: "Primary Tags",
      entries: visible.filter((entry) => primaryTagIds.has(entry.id)),
    },
    {
      id: "builtin" as const,
      label: "Built-In Tags",
      entries: visible.filter(
        (entry) => entry.source === "builtin" && !primaryTagIds.has(entry.id),
      ),
    },
    {
      id: "acquired" as const,
      label: "Acquired Tags",
      entries: visible.filter((entry) => entry.source !== "builtin"),
    },
  ];
  const aliasCandidates = entries.filter(
    (candidate) =>
      candidate.id !== tag.id &&
      !tag.aliases.some(
        (alias) => normalizeTag(alias) === normalizeTag(candidate.name),
      ) &&
      candidate.parent !== tag.id &&
      tag.parent !== candidate.id,
  );

  const openJson = (mode: "export" | "import") => {
    setJsonMode(mode);
    setAddPanel(null);
    setMessage(
      mode === "export"
        ? "Export includes user relationships and presentation, not acquired records or Jump content."
        : "Nothing changes until the document validates and the import is applied.",
    );
    setJsonText(mode === "export" ? exportTagProfile(profile) : "");
    setPendingImport(null);
    if (mode === "export")
      logger.emit("settings.tag_profile.exported", {
        attributes: { entryCount: entries.length },
      });
  };
  const applyImport = () => {
    if (pendingImport) {
      replaceProfile(pendingImport.profile);
      setMessage(
        `Imported ${pendingImport.count} tag ${pendingImport.count === 1 ? "entry" : "entries"}.`,
      );
      logger.emit("settings.tag_profile.imported", {
        attributes: { mode: importMode, entryCount: pendingImport.count },
      });
      setPendingImport(null);
      return;
    }
    const result = importTagProfile(profile, jsonText, importMode);
    if (result.error) {
      setMessage(`Import not applied: ${result.error}`);
      logger.emit("settings.value_rejected", {
        attributes: { settingKey: "tags.profile", reason: result.error },
      });
      return;
    }
    setPendingImport({
      profile: result.profile,
      count: result.importedCount ?? 0,
    });
    setMessage(
      `Review ready: ${result.importedCount} tag ${result.importedCount === 1 ? "entry" : "entries"} will be ${importMode === "replace" ? "replaced" : "merged"}. No changes have been applied.`,
    );
  };
  const addManualTag = () => {
    const result = addTag(profile, manualName, "manual");
    if (result.error) {
      setMessage(result.error);
      if (result.selectedId) select(result.selectedId);
      return;
    }
    replaceProfile(result.profile);
    select(result.selectedId!);
    setManualName("");
    setAddPanel(null);
  };

  if (!tag) return null;
  const presentation = tag.presentation;
  const endpoint =
    selectedStop === 0 || selectedStop === presentation.colors.length - 1;
  const gradientEnabled = presentation.background === "gradient";

  return (
    <div className="tag-profile-editor" data-toc-ignore>
      <header className="tag-profile-toolbar">
        <div>
          <p>{translate("ui.tagProfileEditor.text.userTagProfile")}</p>
          <h4>
            {translate("ui.tagProfileEditor.text.categoryRelationship")}
            <br />
            {translate("ui.tagProfileEditor.text.andBadgeEditor")}
          </h4>
        </div>
        <div>
          <button type="button" onClick={() => openJson("import")}>
            {translate("ui.tagProfileEditor.text.import")}
            <br />
            {translate("ui.tagProfileEditor.text.json")}
          </button>
          <button type="button" onClick={() => openJson("export")}>
            {translate("ui.tagProfileEditor.text.export")}
            <br />
            {translate("ui.tagProfileEditor.text.json")}
          </button>
        </div>
      </header>
      {jsonMode && (
        <section className="tag-json-panel" aria-labelledby="tag-json-heading">
          <div>
            <p>
              {translate("ui.tagProfileEditor.text.portableUserConfiguration")}
            </p>
            <h4 id="tag-json-heading">
              {jsonMode === "export" ? "Export" : "Import"}{" "}
              {translate("ui.tagProfileEditor.text.tagProfileJSON")}
            </h4>
          </div>
          <label htmlFor="tag-json-content">
            {translate("ui.tagProfileEditor.text.jsonDocument")}
          </label>
          <textarea
            id="tag-json-content"
            spellCheck={false}
            readOnly={jsonMode === "export"}
            value={jsonText}
            placeholder={
              jsonMode === "import"
                ? "Paste a versioned tag profile JSON document here."
                : undefined
            }
            onChange={(event) => {
              setJsonText(event.target.value);
              setPendingImport(null);
            }}
          />
          {jsonMode === "import" && (
            <div className="tag-json-import-options">
              <label htmlFor="tag-json-mode">
                {translate("ui.tagProfileEditor.text.importBehavior")}
              </label>
              <select
                id="tag-json-mode"
                value={importMode}
                onChange={(event) => {
                  setImportMode(event.target.value as typeof importMode);
                  setPendingImport(null);
                }}
              >
                <option value="merge">
                  {translate("ui.tagProfileEditor.text.mergeWithThisProfile")}
                </option>
                <option value="replace">
                  {translate(
                    "ui.tagProfileEditor.text.replaceManualImportedTagsAndOverrides",
                  )}
                </option>
              </select>
            </div>
          )}
          <p role="status">{message}</p>
          <div>
            {jsonMode === "import" && (
              <button type="button" onClick={applyImport}>
                {pendingImport ? "Apply reviewed import" : "Review import"}
              </button>
            )}
            <button type="button" onClick={() => setJsonMode(null)}>
              {translate("ui.tagProfileEditor.text.close")}
            </button>
          </div>
        </section>
      )}
      <div className="tag-profile-workspace">
        <aside
          className="tag-profile-list-pane"
          aria-labelledby="tag-profile-list-heading"
        >
          <div className="tag-profile-list-fixed">
            <h4 id="tag-profile-list-heading">
              {translate("ui.tagProfileEditor.text.tags")}
            </h4>
            <label>
              <span className="sr-only">
                {translate("ui.tagProfileEditor.text.findTag")}
              </span>
              <input
                type="search"
                spellCheck={false}
                placeholder={translate(
                  "ui.tagProfileEditor.placeholder.findTag",
                )}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="tag-profile-list">
            {groups.map((group) =>
              group.entries.length || !search.trim() ? (
                <section
                  className="tag-profile-group"
                  data-tag-group={group.id}
                  key={group.label}
                >
                  <h5>
                    <button
                      type="button"
                      aria-expanded={
                        expandedGroups[group.id] || Boolean(search.trim())
                      }
                      onClick={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [group.id]: !current[group.id],
                        }))
                      }
                    >
                      <span>{group.label}</span>
                      <small>{group.entries.length}</small>
                      <span aria-hidden="true">
                        {expandedGroups[group.id] || Boolean(search.trim())
                          ? "▾"
                          : "▸"}
                      </span>
                    </button>
                  </h5>
                  {(expandedGroups[group.id] || Boolean(search.trim())) &&
                    group.entries
                      .sort((a, b) =>
                        displayName(a).localeCompare(
                          displayName(b),
                          languageTag,
                        ),
                      )
                      .map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className="tag-profile-item"
                          aria-selected={entry.id === tag.id}
                          onClick={() => select(entry.id)}
                        >
                          <span>
                            {displayName(entry)}
                            <small>
                              {entry.source === "builtin"
                                ? entry.parent
                                  ? `Built-in · From ${profile.tags[entry.parent] ? displayName(profile.tags[entry.parent]) : entry.parent}`
                                  : "Built-in"
                                : `${sourceLabels[entry.source]} · ${entry.appearanceSource === "derived" ? `From ${profile.tags[entry.parent ?? "miscellaneous"]?.name ?? "Miscellaneous"}` : "Custom appearance"}`}
                            </small>
                          </span>
                          <i
                            className="profile-color-dot"
                            style={
                              {
                                "--profile-color": entry.presentation.colors[0],
                              } as CSSProperties
                            }
                          />
                        </button>
                      ))}
                </section>
              ) : null,
            )}
            {!visible.length && (
              <p className="tag-profile-empty">
                {translate("ui.tagProfileEditor.text.noTagsMatchThisSearch")}
              </p>
            )}
          </div>
          <div className="tag-profile-add-actions">
            <button
              type="button"
              onClick={() =>
                setAddPanel(addPanel === "acquired" ? null : "acquired")
              }
            >
              {translate("ui.tagProfileEditor.text.refreshAcquiredTags")}
            </button>
            <button
              type="button"
              onClick={() =>
                setAddPanel(addPanel === "manual" ? null : "manual")
              }
            >
              {translate("ui.tagProfileEditor.text.enterTagManually")}
            </button>
          </div>
          {addPanel === "acquired" && (
            <section className="tag-add-panel">
              <h5>{translate("ui.tagProfileEditor.text.newlyDetectedTags")}</h5>
              {acquiredCandidates.length ? (
                <ul>
                  {acquiredCandidates.map((candidate) => (
                    <li key={candidate.name}>
                      {candidate.name}
                      <small>{candidate.packageNames.join(", ")}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {translate(
                    "ui.tagProfileEditor.text.everyNormalizedTagStringFromInstalledJumpsIsAlready",
                  )}
                </p>
              )}
              <p>
                {translate(
                  "ui.tagProfileEditor.text.missingStringsBeginUnderMiscellaneousExistingNamesAndAliases",
                )}
              </p>
              <div>
                {acquiredCandidates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const result = refreshInstalledTags(
                        profile,
                        installedPackages,
                      );
                      replaceProfile(result.profile);
                      setMessage(
                        `Added ${result.added.length} installed Jump ${result.added.length === 1 ? "tag" : "tags"}.`,
                      );
                      logger.emit("settings.tag_profile.acquired_refreshed", {
                        attributes: { addedCount: result.added.length },
                      });
                      setAddPanel(null);
                    }}
                  >
                    {translate("ui.tagProfileEditor.text.add")}
                    {acquiredCandidates.length}{" "}
                    {translate("ui.tagProfileEditor.text.detected")}
                  </button>
                )}
                <button type="button" onClick={() => setAddPanel(null)}>
                  {acquiredCandidates.length ? "Cancel" : "Done"}
                </button>
              </div>
            </section>
          )}
          {addPanel === "manual" && (
            <section className="tag-add-panel">
              <h5>{translate("ui.tagProfileEditor.text.enterTagString")}</h5>
              <label>
                <span>{translate("ui.tagProfileEditor.text.tag")}</span>
                <input
                  autoFocus
                  spellCheck
                  value={manualName}
                  placeholder={translate(
                    "ui.tagProfileEditor.placeholder.exampleSummoning",
                  )}
                  onChange={(event) => setManualName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addManualTag();
                    }
                  }}
                />
              </label>
              <p role="status">
                {message || "New tags begin under Miscellaneous."}
              </p>
              <div>
                <button type="button" onClick={addManualTag}>
                  {translate("ui.tagProfileEditor.text.addTag")}
                </button>
                <button type="button" onClick={() => setAddPanel(null)}>
                  {translate("ui.tagProfileEditor.text.cancel")}
                </button>
              </div>
            </section>
          )}
        </aside>

        <section
          className="tag-profile-form-pane"
          aria-labelledby="tag-profile-form-heading"
        >
          <header>
            <div>
              <p>
                {tag.source === "builtin"
                  ? tag.appearanceSource === "custom"
                    ? "Built-in · Custom appearance"
                    : "Built-in"
                  : `${sourceLabels[tag.source]} · ${tag.appearanceSource === "derived" ? `Derived from ${profile.tags[tag.parent ?? "miscellaneous"]?.name}` : "Custom appearance"}`}
              </p>
              <h4 id="tag-profile-form-heading">{displayName(tag)}</h4>
            </div>
            <div className="tag-profile-form-actions">
              {(tag.source === "manual" || tag.source === "imported") && (
                <button
                  type="button"
                  onClick={() => {
                    const parent = tag.parent ?? "miscellaneous";
                    replaceProfile(deleteTag(profile, tag.id));
                    select(parent);
                  }}
                >
                  {translate("ui.tagProfileEditor.text.delete")}
                </button>
              )}
              <button
                type="button"
                aria-label={
                  tag.source === "builtin"
                    ? "Reset to the built-in appearance"
                    : `Reset to appearance derived from ${profile.tags[tag.parent ?? "miscellaneous"]?.name}`
                }
                onClick={() => replaceProfile(resetTag(profile, tag.id))}
              >
                {translate("ui.tagProfileEditor.text.reset")}
              </button>
            </div>
          </header>
          <div className="tag-profile-form-scroll">
            <fieldset>
              <legend>
                {translate("ui.tagProfileEditor.text.identityAndCategory")}
              </legend>
              <label className="field-wide">
                <span>{translate("ui.tagProfileEditor.text.tagString")}</span>
                <input value={tag.name} readOnly />
              </label>
              <label
                className={`field-wide${primaryTagIds.has(tag.id) ? " is-locked" : ""}`}
              >
                <span>{translate("ui.tagProfileEditor.text.parent")}</span>
                <select
                  aria-label={translate("ui.tagProfileEditor.ariaLabel.parent")}
                  value={tag.parent ?? ""}
                  disabled={primaryTagIds.has(tag.id)}
                  onChange={(event) => {
                    const result = setTagParent(
                      profile,
                      tag.id,
                      event.target.value,
                    );
                    if (result.error) setMessage(result.error);
                    else replaceProfile(result.profile);
                  }}
                >
                  {primaryTagIds.has(tag.id) ? (
                    <option value="">
                      {translate("ui.tagProfileEditor.text.topLevelFixed")}
                    </option>
                  ) : (
                    entries
                      .filter((candidate) => candidate.id !== tag.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {displayName(candidate)}
                        </option>
                      ))
                  )}
                </select>
                {primaryTagIds.has(tag.id) && (
                  <small className="field-lock-reason">
                    {translate(
                      "ui.tagProfileEditor.text.primaryTagsAreAlwaysTopLevel",
                    )}
                  </small>
                )}
              </label>
              <div className="tag-alias-editor field-wide">
                <span>{translate("ui.tagProfileEditor.text.aliases")}</span>
                <div className="tag-alias-list">
                  {displayAliases(tag).length ? (
                    displayAliases(tag).map((alias) => {
                      return (
                        <span className="tag-alias-chip" key={alias}>
                          {alias}
                          <button
                            type="button"
                            aria-label={`Unlink alias ${alias}`}
                            onClick={() =>
                              replaceProfile(
                                removeAlias(
                                  profile,
                                  tag.id,
                                  canonicalTagAlias(tag, alias, languageTag),
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      );
                    })
                  ) : (
                    <span className="tag-alias-empty">
                      {translate("ui.tagProfileEditor.text.noAliasesLinked")}
                    </span>
                  )}
                </div>
                <div className="tag-alias-add">
                  <select
                    aria-label={translate(
                      "ui.tagProfileEditor.ariaLabel.tagToLinkAsAnAlias",
                    )}
                    value={aliasTarget}
                    onChange={(event) => setAliasTarget(event.target.value)}
                  >
                    <option value="">
                      {translate("ui.tagProfileEditor.text.chooseATag")}
                    </option>
                    {aliasCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {displayName(candidate)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!aliasTarget}
                    onClick={() => {
                      const result = toggleAlias(profile, tag.id, aliasTarget);
                      if (result.error) setMessage(result.error);
                      else replaceProfile(result.profile);
                      setAliasTarget("");
                    }}
                  >
                    {translate("ui.tagProfileEditor.text.linkAlias")}
                  </button>
                </div>
                <small>
                  {translate(
                    "ui.tagProfileEditor.text.aliasLinksAreReciprocalLinkingTwoTagsOnceUpdates",
                  )}
                </small>
              </div>
            </fieldset>

            <fieldset>
              <legend>
                {translate("ui.tagProfileEditor.text.backgroundAndBorder")}
              </legend>
              <SelectField
                label={translate("ui.tagProfileEditor.label.background")}
                ariaLabel="Background"
                value={presentation.background}
                onChange={(value) =>
                  patchPresentation({
                    background: value as TagPresentation["background"],
                  })
                }
                options={["solid", "gradient", "transparent"]}
              />
              <label
                className={
                  presentation.background !== "solid" ? "is-locked" : ""
                }
              >
                <span>{translate("ui.tagProfileEditor.text.solidColor")}</span>
                <input
                  type="color"
                  disabled={presentation.background !== "solid"}
                  value={presentation.colors[0]}
                  onChange={(event) =>
                    patchPresentation(
                      {
                        colors: [
                          event.target.value,
                          ...presentation.colors.slice(1),
                        ],
                      },
                      true,
                    )
                  }
                />
                <small className="field-lock-reason">
                  {translate(
                    "ui.tagProfileEditor.text.availableWhenBackgroundIsSolid",
                  )}
                </small>
              </label>
              <div
                className={`tag-gradient-editor field-wide${!gradientEnabled ? " is-locked" : ""}`}
                aria-disabled={!gradientEnabled}
              >
                <div className="tag-gradient-heading">
                  <div>
                    <span>
                      {translate("ui.tagProfileEditor.text.gradientStops")}
                    </span>
                    <small>
                      {translate(
                        "ui.tagProfileEditor.text.dragInteriorNodesToPositionThem",
                      )}
                    </small>
                  </div>
                  <button
                    type="button"
                    disabled={
                      !gradientEnabled || presentation.colors.length >= 6
                    }
                    onClick={() => {
                      const largest = presentation.positions
                        .slice(0, -1)
                        .map((position, index) => ({
                          index,
                          gap: presentation.positions[index + 1] - position,
                        }))
                        .sort((a, b) => b.gap - a.gap)[0];
                      const index = largest.index + 1;
                      const positions = [...presentation.positions];
                      const colors = [...presentation.colors];
                      positions.splice(
                        index,
                        0,
                        Math.round(
                          (positions[index - 1] + positions[index]) / 2,
                        ),
                      );
                      colors.splice(index, 0, presentation.colors[index - 1]);
                      setSelectedStop(index);
                      patchPresentation({ positions, colors });
                    }}
                  >
                    {translate("ui.tagProfileEditor.text.addStop")}
                  </button>
                </div>
                <GradientTrack
                  presentation={presentation}
                  enabled={gradientEnabled}
                  selected={selectedStop}
                  onSelect={setSelectedStop}
                  onMove={(index, position) => {
                    if (
                      index === 0 ||
                      index === presentation.positions.length - 1
                    )
                      return;
                    const positions = [...presentation.positions];
                    positions[index] = Math.max(
                      positions[index - 1] + 1,
                      Math.min(positions[index + 1] - 1, position),
                    );
                    patchPresentation({ positions }, true);
                  }}
                />
                <div className="tag-gradient-stop-controls">
                  <label>
                    <span>
                      {translate("ui.tagProfileEditor.text.selectedColor")}
                    </span>
                    <input
                      type="color"
                      disabled={!gradientEnabled}
                      value={
                        presentation.colors[selectedStop] ??
                        presentation.colors[0]
                      }
                      onChange={(event) => {
                        const colors = [...presentation.colors];
                        colors[selectedStop] = event.target.value;
                        patchPresentation({ colors }, true);
                      }}
                    />
                  </label>
                  <label className={endpoint ? "is-locked" : ""}>
                    <span>
                      {translate("ui.tagProfileEditor.text.position")}
                    </span>
                    <span className="tag-gradient-position">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        disabled={!gradientEnabled || endpoint}
                        value={presentation.positions[selectedStop] ?? 0}
                        onChange={(event) => {
                          const positions = [...presentation.positions];
                          positions[selectedStop] = Number(event.target.value);
                          patchPresentation({ positions }, true);
                        }}
                      />
                      <output>{presentation.positions[selectedStop]}%</output>
                    </span>
                    <small className="field-lock-reason">
                      {translate(
                        "ui.tagProfileEditor.text.endpointPositionsStayAt0And100",
                      )}
                    </small>
                  </label>
                  <button
                    type="button"
                    disabled={!gradientEnabled || endpoint}
                    onClick={() => {
                      const colors = [...presentation.colors];
                      const positions = [...presentation.positions];
                      colors.splice(selectedStop, 1);
                      positions.splice(selectedStop, 1);
                      setSelectedStop(Math.max(1, selectedStop - 1));
                      patchPresentation({ colors, positions });
                    }}
                  >
                    {translate("ui.tagProfileEditor.text.removeStop")}
                  </button>
                  <label>
                    <span>{translate("ui.tagProfileEditor.text.angle")}</span>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      disabled={!gradientEnabled}
                      value={presentation.angle}
                      onChange={(event) =>
                        patchPresentation(
                          {
                            angle: Math.max(
                              0,
                              Math.min(360, Number(event.target.value)),
                            ),
                          },
                          true,
                        )
                      }
                    />
                  </label>
                </div>
                <p className="field-lock-reason">
                  {translate(
                    "ui.tagProfileEditor.text.gradientControlsAreAvailableWhenBackgroundIsGradient",
                  )}
                </p>
              </div>
              <label>
                <span>{translate("ui.tagProfileEditor.text.borderColor")}</span>
                <input
                  type="color"
                  value={presentation.borderColor}
                  onChange={(event) =>
                    patchPresentation({ borderColor: event.target.value }, true)
                  }
                />
              </label>
              <SelectField
                label={translate("ui.tagProfileEditor.label.borderWidth")}
                value={presentation.borderWidth}
                onChange={(value) =>
                  patchPresentation({
                    borderWidth: value as TagPresentation["borderWidth"],
                  })
                }
                options={["none", "thin", "medium"]}
              />
              <SelectField
                label={translate("ui.tagProfileEditor.label.cornerStyle")}
                value={presentation.corners}
                onChange={(value) =>
                  patchPresentation({
                    corners: value as TagPresentation["corners"],
                  })
                }
                options={["pill", "rounded", "square"]}
              />
              <SelectField
                label={translate("ui.tagProfileEditor.label.padding")}
                value={presentation.padding}
                onChange={(value) =>
                  patchPresentation({
                    padding: value as TagPresentation["padding"],
                  })
                }
                options={["compact", "standard", "roomy"]}
              />
            </fieldset>

            <fieldset>
              <legend>{translate("ui.tagProfileEditor.text.text")}</legend>
              <SelectField
                label={translate("ui.tagProfileEditor.label.textColorMode")}
                value={presentation.textMode}
                onChange={(value) =>
                  patchPresentation({
                    textMode: value as TagPresentation["textMode"],
                  })
                }
                options={["auto", "custom"]}
              />
              <label
                className={
                  presentation.textMode !== "custom" ? "is-locked" : ""
                }
              >
                <span>{translate("ui.tagProfileEditor.text.textColor")}</span>
                <input
                  type="color"
                  disabled={presentation.textMode !== "custom"}
                  value={presentation.textColor}
                  onChange={(event) =>
                    patchPresentation({ textColor: event.target.value }, true)
                  }
                />
                <small className="field-lock-reason">
                  {translate(
                    "ui.tagProfileEditor.text.chooseCustomTextColorModeToEdit",
                  )}
                </small>
              </label>
              <SelectField
                label={translate("ui.tagProfileEditor.label.weight")}
                value={presentation.weight}
                onChange={(value) =>
                  patchPresentation({
                    weight: value as TagPresentation["weight"],
                  })
                }
                options={["normal", "medium", "bold"]}
              />
              <SelectField
                label={translate("ui.tagProfileEditor.label.style")}
                value={presentation.fontStyle}
                onChange={(value) =>
                  patchPresentation({
                    fontStyle: value as TagPresentation["fontStyle"],
                  })
                }
                options={["normal", "italic"]}
              />
              <SelectField
                label={translate("ui.tagProfileEditor.label.decoration")}
                value={presentation.decoration}
                onChange={(value) =>
                  patchPresentation({
                    decoration: value as TagPresentation["decoration"],
                  })
                }
                options={["none", "underline", "strike"]}
              />
              <SelectField
                label={translate("ui.tagProfileEditor.label.textEffect")}
                value={presentation.textEffect}
                onChange={(value) =>
                  patchPresentation({
                    textEffect: value as TagPresentation["textEffect"],
                  })
                }
                options={["none", "outline", "shadow", "glow"]}
              />
              <p className="field-note field-wide">
                {translate(
                  "ui.tagProfileEditor.text.textEffectsAreStaticPresetsAnimationIsConfiguredSeparately",
                )}
              </p>
            </fieldset>
            <fieldset>
              <legend>{translate("ui.tagProfileEditor.text.animation")}</legend>
              <div className="tag-animation-field">
                <span>{translate("ui.tagProfileEditor.text.animation")}</span>
                <div className="tag-animation-select">
                  <button
                    className="tag-animation-trigger"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={animationOpen}
                    onClick={() => setAnimationOpen(!animationOpen)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowDown" ||
                        event.key === "ArrowUp"
                      ) {
                        event.preventDefault();
                        setAnimationOpen(true);
                      }
                    }}
                  >
                    <AnimatedText
                      text={animationLabels[presentation.animation]}
                      animation={presentation.animation}
                    />
                    <span aria-hidden="true">▾</span>
                  </button>
                  {animationOpen && (
                    <div
                      className="tag-animation-menu"
                      role="listbox"
                      aria-label={translate(
                        "ui.tagProfileEditor.ariaLabel.tagAnimation",
                      )}
                    >
                      {Object.entries(animationLabels).map(
                        ([value, label], index, all) => (
                          <button
                            key={value}
                            type="button"
                            role="option"
                            aria-selected={presentation.animation === value}
                            onClick={() => {
                              patchPresentation({
                                animation:
                                  value as TagPresentation["animation"],
                              });
                              setAnimationOpen(false);
                            }}
                            onKeyDown={(event) =>
                              animationKey(event, index, all.length, () =>
                                setAnimationOpen(false),
                              )
                            }
                          >
                            <AnimatedText
                              text={label}
                              animation={value as TagPresentation["animation"]}
                            />
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className="field-note">
                {translate(
                  "ui.tagProfileEditor.text.reducedMotionShowsTheOriginalTextColorAtFull",
                )}
              </p>
            </fieldset>
            {message && (
              <p className="tag-profile-status" role="status">
                {message}
              </p>
            )}
          </div>
        </section>

        <aside
          className="tag-profile-preview-pane"
          aria-labelledby="tag-profile-preview-heading"
        >
          <header>
            <p>{translate("ui.tagProfileEditor.text.liveBadgePreview")}</p>
            <h4 id="tag-profile-preview-heading">{displayName(tag)}</h4>
          </header>
          <div className="tag-profile-preview-surface is-dark">
            <BadgePreview
              tag={tag}
              label={displayName(tag)}
              surface="#20201e"
            />
          </div>
          <div className="tag-profile-preview-surface is-light">
            <BadgePreview
              tag={tag}
              label={displayName(tag)}
              surface="#f5f1e6"
            />
          </div>
          <dl>
            <div>
              <dt>{translate("ui.tagProfileEditor.text.source")}</dt>
              <dd>{sourceLabels[tag.source]}</dd>
            </div>
            <div>
              <dt>{translate("ui.tagProfileEditor.text.parent")}</dt>
              <dd>
                {tag.parent
                  ? profile.tags[tag.parent]
                    ? displayName(profile.tags[tag.parent])
                    : tag.parent
                  : "Top level"}
              </dd>
            </div>
            <div>
              <dt>{translate("ui.tagProfileEditor.text.aliases")}</dt>
              <dd>{displayAliases(tag).join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>{translate("ui.tagProfileEditor.text.appearance")}</dt>
              <dd>
                {tag.appearanceSource === "builtin"
                  ? "Built-in"
                  : tag.appearanceSource === "derived"
                    ? `Derived from ${profile.tags[tag.parent ?? "miscellaneous"]?.name}`
                    : "Custom override"}
              </dd>
            </div>
          </dl>
          <p>
            {translate(
              "ui.tagProfileEditor.text.changesAffectThisUserProfileOnlyTheSourceJump",
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}

function SelectField({
  label,
  ariaLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {option[0].toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}

function GradientTrack({
  presentation,
  enabled,
  selected,
  onSelect,
  onMove,
}: {
  presentation: TagPresentation;
  enabled: boolean;
  selected: number;
  onSelect: (value: number) => void;
  onMove: (index: number, value: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={track}
      className="tag-gradient-track"
      aria-label={translate(
        "ui.tagProfileEditor.ariaLabel.gradientStopPositions",
      )}
      style={{
        background: `linear-gradient(90deg, ${presentation.colors.map((color, index) => `${color} ${presentation.positions[index]}%`).join(", ")})`,
      }}
    >
      {presentation.colors.map((color, index) => (
        <button
          key={`${index}-${color}`}
          type="button"
          disabled={!enabled}
          className={`tag-gradient-node${selected === index ? " is-selected" : ""}`}
          style={
            {
              left: `${presentation.positions[index]}%`,
              "--stop-color": color,
            } as CSSProperties
          }
          aria-label={`Gradient stop ${index + 1} at ${presentation.positions[index]} percent`}
          onClick={() => onSelect(index)}
          onPointerDown={(event) => {
            if (
              !enabled ||
              index === 0 ||
              index === presentation.colors.length - 1 ||
              !track.current
            )
              return;
            onSelect(index);
            event.currentTarget.setPointerCapture(event.pointerId);
            const move = (pointer: PointerEvent) => {
              const bounds = track.current!.getBoundingClientRect();
              onMove(
                index,
                Math.round(
                  ((pointer.clientX - bounds.left) / bounds.width) * 100,
                ),
              );
            };
            const finish = () =>
              window.removeEventListener("pointermove", move);
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", finish, { once: true });
          }}
        />
      ))}
    </div>
  );
}

function AnimatedText({
  text,
  animation,
}: {
  text: string;
  animation: TagPresentation["animation"];
}) {
  return (
    <span className={`tag-animated-text is-${animation}`}>
      {animation === "marquee" || animation === "bounce"
        ? [...text].map((character, index) => (
            <i
              key={`${character}-${index}`}
              style={{ "--letter-index": index } as CSSProperties}
            >
              {character === " " ? "\u00a0" : character}
            </i>
          ))
        : text}
    </span>
  );
}

function BadgePreview({
  tag,
  label,
  surface,
}: {
  tag: { name: string; presentation: TagPresentation };
  label: string;
  surface: string;
}) {
  return (
    <CanonicalTagBadge
      label={label}
      presentation={tag.presentation}
      surface={surface}
    />
  );
}

function animationKey(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  length: number,
  close: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  const options =
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      "[role='option']",
    );
  if (!options) return;
  let target = -1;
  if (event.key === "Home") target = 0;
  else if (event.key === "End") target = length - 1;
  else if (event.key === "ArrowDown") target = (index + 1) % length;
  else if (event.key === "ArrowUp") target = (index - 1 + length) % length;
  if (target >= 0) {
    event.preventDefault();
    options[target].focus();
  }
}
