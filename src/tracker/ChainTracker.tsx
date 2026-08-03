import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import {
  dropEdgeAtPointer,
  dropIndexForTarget,
  type DropEdge,
} from "../ui/dragReorder";
import { Chevron, useContextMenu, useSettingDefaultedState } from "../ui";
import {
  TrackerSupplementContext,
  SupplementProviders,
  TrackerSupplementWorkspace,
} from "../supplements/TrackerSupplements";
import {
  hasEnabledSupplements,
  type EnabledModules,
  type ModuleId,
} from "../supplements/model";
import { TagRadar } from "./TagRadar";
import { TagBadge } from "../ui/TagBadge";
import { JumpRenderer } from "./JumpRenderer";
import type { RandomIndexSource } from "../domain";
import { EarthJumpRenderer } from "./EarthJumpRenderer";
import {
  JumpPackageImportService,
  PackageSecurityError,
  type PackageImportReview,
} from "../archive";
import { PackageReview } from "../ui/PackageReview";
import { useOptionalSettings } from "../settings/SettingsContext";
import {
  effectivePackageSizeLimits,
  SAFE_PACKAGE_SIZE_LIMITS,
} from "../settings/model";
import { evaluateTracker, projectEvaluation } from "./evaluateTracker";
import {
  jumpPackageImageSources,
  preloadJumpImages,
  waitForRenderedJumpImages,
} from "../renderer/jumpImages";
import { useAssetObjectUrls } from "../ui/useAssetObjectUrls";
import { FocusModal } from "./FocusModal";
import {
  aggregateInventoryRecords,
  filteredInventory,
  inventoryRecordTagProjection,
  inventoryTagTree,
  EARTH_ENTRY_ID,
  EARTH_ENTRY_STATUS,
  jumpEntryIds,
  jumpNumber,
  packageForEntry,
  packageInstallConflict,
  visibleCompanions,
  visibleForms,
  visibleAtInspection,
  type FormRecord,
  type InventoryRecord,
  type InventoryTagNode,
  type InstalledPackage,
  type TrackerAction,
  type TrackerState,
  type EvaluatedJumpRuntime,
  supplementStateForEntry,
} from "./model";
import {
  ChainHeader,
  HistoricalSelect,
  MainTabs,
  TruncatedText,
} from "./ChainNavigation";

const packageSourceLabel = (source: InstalledPackage["source"]) =>
  source === "builtin" ? "Built-in" : source === "mock" ? "Mock" : "Imported";
import { translate, translateDiagnostic } from "../localization";

const PROFILE_RECORDS_BEFORE_SCROLL = 5;
const PROFILE_IMPORTS_BEFORE_SCROLL = 9;
const RECORD_ACQUISITIONS_BEFORE_SCROLL = 3;
const noInstalledAssets: Readonly<Record<string, readonly number[]>> = {};

function ChainRail({
  state,
  dispatch,
  enabled,
  openSupp,
  actorId,
  runtime,
  preloadEntry,
}: TrackerProps & {
  enabled: EnabledModules;
  openSupp: () => void;
  actorId: string;
  runtime: EvaluatedJumpRuntime;
  preloadEntry: (entryId: string) => void;
}) {
  const {
    openContextMenu,
    openContextMenuFromKeyboard,
    openContextMenuFromTrigger,
  } = useContextMenu();
  const settingsContext = useOptionalSettings();
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    entryId: string;
    edge: DropEdge;
  } | null>(null);
  const packageInput = useRef<HTMLInputElement>(null);
  const [packageImport, setPackageImport] = useState<
    | { kind: "idle" }
    | { kind: "inspecting" }
    | { kind: "review"; review: PackageImportReview }
    | { kind: "blocked"; code: string; message: string }
    | {
        kind: "conflict";
        reason: "same-version" | "parallel-version-disabled";
        name: string;
        version: string;
      }
  >({ kind: "idle" });
  const requestedActorId = runtime[state.selectedEntryId]?.actors[actorId]
    ? actorId
    : "jumper";
  const actor = state.actors[requestedActorId] ?? state.actors.jumper;
  const evaluation = runtime[state.selectedEntryId]?.actors[actor.id];
  const balance = evaluation?.balance ?? 0;
  const alternativeResources = Object.values(
    evaluation?.resources ?? {},
  ).filter((resource) => resource.handle !== "jump_points");
  const filteredPackages = Object.values(state.packages).filter((item) => {
    if (item.availability === "foundation") return false;
    if (item.source === "mock" && !state.preferences.showMockData) return false;
    const selectedSource =
      state.librarySource === "mock" && !state.preferences.showMockData
        ? "all"
        : state.librarySource;
    const source = selectedSource === "all" || item.source === selectedSource;
    const query = `${item.name} ${item.version} ${item.description}`
      .toLocaleLowerCase()
      .includes(state.librarySearch.toLocaleLowerCase());
    return source && query;
  });
  return (
    <aside
      className="chain-rail"
      aria-label={translate("ui.chainTracker.ariaLabel.chainAndJumpLibrary")}
    >
      <div
        className="chain-rail-tabs"
        role="tablist"
        aria-label={translate("ui.chainTracker.ariaLabel.chainNavigation")}
      >
        {(["chain", "library"] as const).map((page) => (
          <button
            key={page}
            type="button"
            role="tab"
            data-tour-target={
              page === "library" ? "tracker-library-tab" : undefined
            }
            aria-selected={state.railPage === page}
            tabIndex={state.railPage === page ? 0 : -1}
            onClick={() => dispatch({ type: "set-rail-page", page })}
          >
            {page === "chain" ? "Chain" : "Library"}
          </button>
        ))}
      </div>
      {state.railPage === "chain" ? (
        <section className="chain-rail-panel" role="tabpanel">
          <header>
            <div>
              <p>{state.chainName}</p>
              <strong>
                {jumpEntryIds(state).length}{" "}
                {translate("ui.chainTracker.text.jumps")}
              </strong>
            </div>
            <div className="chain-rail-header-actions">
              {hasEnabledSupplements(enabled) && (
                <button
                  id="tracker-open-supp"
                  type="button"
                  aria-haspopup="dialog"
                  onClick={openSupp}
                >
                  {translate("ui.chainTracker.text.supp")}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "set-rail-page", page: "library" })
                }
              >
                {translate("ui.chainTracker.text.add")}
              </button>
            </div>
          </header>
          <dl
            className="chain-jump-summary"
            aria-label={translate(
              "ui.chainTracker.ariaLabel.currentJumpSummary",
            )}
          >
            <div className="chain-summary-hover">
              <dt>{translate("ui.chainTracker.text.currency")}</dt>
              <dd tabIndex={0}>
                <span className={balance < 0 ? "is-negative" : undefined}>
                  {balance} {translate("ui.chainTracker.text.cp")}
                </span>
                <span className="chain-summary-tooltip" role="tooltip">
                  <strong>
                    {translate(
                      "ui.chainTracker.text.alternativeCurrenciesRemaining",
                    )}
                  </strong>
                  {alternativeResources.length ? (
                    alternativeResources.map((resource) => (
                      <span key={resource.handle}>
                        {resource.balance} {resource.abbreviation} ·{" "}
                        {resource.name}
                      </span>
                    ))
                  ) : (
                    <span>
                      {translate(
                        "ui.chainTracker.text.noAlternativeCurrenciesInThisJump",
                      )}
                    </span>
                  )}
                </span>
              </dd>
            </div>
            <div className="chain-summary-hover chain-summary-origin">
              <dt>{translate("ui.chainTracker.text.origin")}</dt>
              <dd tabIndex={0}>
                <span>{evaluation?.properties.origin?.value ?? "Unknown"}</span>
                <span className="chain-summary-tooltip" role="tooltip">
                  <strong>
                    {evaluation?.properties.origin?.value ?? "Unknown"}
                  </strong>
                  <span>
                    {evaluation?.properties.origin?.description ??
                      "No Origin has been selected for this Jump."}
                  </span>
                  <span>
                    {translate("ui.chainTracker.text.species")}
                    {evaluation?.properties.species?.value ?? "Human"}
                  </span>
                  <span>
                    {translate("ui.chainTracker.text.location")}{" "}
                    {evaluation?.properties.location?.value ?? "Unknown"}
                  </span>
                </span>
              </dd>
            </div>
            <div>
              <dt>{translate("ui.chainTracker.text.gender")}</dt>
              <dd>{evaluation?.properties.gender?.value ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>{translate("ui.chainTracker.text.age")}</dt>
              <dd>{evaluation?.properties.age?.value ?? "Unknown"}</dd>
            </div>
          </dl>
          <div
            className="chain-jump-list"
            data-tour-target="tracker-chain-list"
            aria-label={translate(
              "ui.chainTracker.ariaLabel.orderedChainJumpsNewestFirst",
            )}
            onDragLeave={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom
              )
                setDropIndicator(null);
            }}
          >
            {[...state.order].reverse().map((id) => {
              const entry = state.entries[id];
              const item = packageForEntry(state, id);
              const index = state.order.indexOf(id);
              const earth = entry.kind === "earth";
              const number = jumpNumber(state, id);
              const negative = Object.values(runtime[id]?.actors ?? {}).some(
                (value) => value.balance < 0,
              );
              const metadata = earth
                ? EARTH_ENTRY_STATUS
                : `${packageSourceLabel(item.source)} · ${entry.status}${runtime[id]?.gauntlet.active ? " · Gauntlet" : ""}`;
              const earthChoices =
                state.jumpState[EARTH_ENTRY_ID]?.actors.jumper?.choices ?? {};
              const menu = {
                label: translate(
                  "ui.chainTracker.ariaLabel.chainEntryActions",
                  {
                    entry: item.name,
                  },
                ),
                actions: earth
                  ? [
                      {
                        id: "open",
                        label: translate(
                          "ui.chainTracker.text.openIdentitySetup",
                        ),
                        onAction: () =>
                          dispatch({ type: "select-entry", entryId: id }),
                      },
                      ...(typeof earthChoices.earth_gender === "string"
                        ? [
                            {
                              id: "clear-gender",
                              label: translate(
                                "ui.chainTracker.text.clearStartingGender",
                              ),
                              onAction: () =>
                                dispatch({
                                  type: "set-choice" as const,
                                  entryId: EARTH_ENTRY_ID,
                                  actorId: "jumper",
                                  choiceHandle: "earth_gender",
                                  value: null,
                                }),
                            },
                          ]
                        : []),
                      ...(typeof earthChoices.earth_age === "number"
                        ? [
                            {
                              id: "clear-age",
                              label: translate(
                                "ui.chainTracker.text.clearStartingAge",
                              ),
                              onAction: () =>
                                dispatch({
                                  type: "set-choice" as const,
                                  entryId: EARTH_ENTRY_ID,
                                  actorId: "jumper",
                                  choiceHandle: "earth_age",
                                  value: null,
                                }),
                            },
                          ]
                        : []),
                    ]
                  : [
                      {
                        id: "open",
                        label: translate("common.open"),
                        onAction: () =>
                          dispatch({ type: "select-entry", entryId: id }),
                      },
                      {
                        id: "later",
                        label: translate("ui.chainTracker.text.moveLater"),
                        disabled: index === state.order.length - 1,
                        onAction: () =>
                          dispatch({
                            type: "request-move",
                            entryId: id,
                            toIndex: index + 1,
                          }),
                      },
                      {
                        id: "earlier",
                        label: translate("ui.chainTracker.text.moveEarlier"),
                        disabled: index <= 1,
                        onAction: () =>
                          dispatch({
                            type: "request-move",
                            entryId: id,
                            toIndex: index - 1,
                          }),
                      },
                      {
                        id: "remove",
                        label: translate(
                          "ui.chainTracker.text.removeFromChain",
                        ),
                        danger: true,
                        separatorBefore: true,
                        onAction: () =>
                          dispatch({ type: "request-remove", entryId: id }),
                      },
                    ],
              };
              return (
                <article
                  key={id}
                  data-tour-target={
                    state.selectedEntryId === id
                      ? "tracker-selected-entry"
                      : undefined
                  }
                  onContextMenu={(event) => openContextMenu(event, menu)}
                  className={`chain-jump-entry${earth ? " is-earth" : ""}${state.selectedEntryId === id ? " is-selected" : ""}${negative ? " has-negative-balance" : ""}${dragged === id ? " is-dragging" : ""}${dropIndicator?.entryId === id ? ` is-drop-${dropIndicator.edge}` : ""}`}
                  draggable={!earth}
                  onDragStart={(event) => {
                    if (earth) return;
                    setDragged(id);
                    setDropIndicator(null);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", id);
                  }}
                  onDragOver={(event) => {
                    if (earth || !dragged || dragged === id) {
                      if (dragged) setDropIndicator(null);
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const edge = dropEdgeAtPointer(
                      event.clientY,
                      event.currentTarget.getBoundingClientRect(),
                    );
                    setDropIndicator((current) =>
                      current?.entryId === id && current.edge === edge
                        ? current
                        : { entryId: id, edge },
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!earth && dragged && dragged !== id) {
                      const fromIndex = state.order.indexOf(dragged);
                      const edge = dropEdgeAtPointer(
                        event.clientY,
                        event.currentTarget.getBoundingClientRect(),
                      );
                      const toIndex = dropIndexForTarget(
                        fromIndex,
                        index,
                        edge,
                        "reverse",
                      );
                      if (fromIndex !== toIndex)
                        dispatch({
                          type: "request-move",
                          entryId: dragged,
                          toIndex,
                        });
                    }
                    setDragged(null);
                    setDropIndicator(null);
                  }}
                  onDragEnd={() => {
                    setDragged(null);
                    setDropIndicator(null);
                  }}
                >
                  {!earth && (
                    <span
                      className="chain-jump-handle"
                      title={translate("ui.chainTracker.title.dragToReorder")}
                      aria-hidden="true"
                    >
                      ⠿
                    </span>
                  )}
                  <button
                    type="button"
                    className="chain-jump-select"
                    aria-haspopup="menu"
                    aria-pressed={state.selectedEntryId === id}
                    onPointerEnter={() => preloadEntry(id)}
                    onFocus={() => preloadEntry(id)}
                    onKeyDown={(event) =>
                      openContextMenuFromKeyboard(event, menu)
                    }
                    onClick={() =>
                      dispatch({ type: "select-entry", entryId: id })
                    }
                  >
                    <span>
                      {number ? `${number}. ` : ""}
                      {item.name}
                      {!earth && ` · v${item.version}`}
                    </span>
                    <TruncatedText>{metadata}</TruncatedText>
                  </button>
                  {!earth && (
                    <div className="chain-jump-actions">
                      {settingsContext?.settings.chain.compactJumpActions ? (
                        <button
                          className="chain-jump-more-actions"
                          type="button"
                          aria-haspopup="menu"
                          aria-label={translate(
                            "ui.chainTracker.ariaLabel.moreActionsForJump",
                            { jump: item.name },
                          )}
                          onClick={(event) =>
                            openContextMenuFromTrigger(
                              event.currentTarget,
                              menu,
                            )
                          }
                        >
                          <span aria-hidden="true">•••</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={index === state.order.length - 1}
                            aria-label={translate(
                              "ui.chainTracker.ariaLabel.moveJumpLater",
                              { jump: item.name },
                            )}
                            onClick={() =>
                              dispatch({
                                type: "request-move",
                                entryId: id,
                                toIndex: index + 1,
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={index <= 1}
                            aria-label={translate(
                              "ui.chainTracker.ariaLabel.moveJumpEarlier",
                              { jump: item.name },
                            )}
                            onClick={() =>
                              dispatch({
                                type: "request-move",
                                entryId: id,
                                toIndex: index - 1,
                              })
                            }
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            aria-label={translate(
                              "ui.chainTracker.ariaLabel.removeJumpFromChain",
                              { jump: item.name },
                            )}
                            onClick={() =>
                              dispatch({ type: "request-remove", entryId: id })
                            }
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="chain-rail-panel" role="tabpanel">
          <header>
            <div>
              <p>
                {translate(
                  state.preferences.allowMultiplePackageVersions
                    ? "ui.chainTracker.text.parallelVersionsEnabled"
                    : "ui.chainTracker.text.oneVersionPerJump",
                )}
              </p>
              <strong>
                {translate("ui.chainTracker.text.availablePackages")}
              </strong>
            </div>
            <button
              type="button"
              className="chain-library-import"
              onClick={() => packageInput.current?.click()}
            >
              {translate("ui.chainTracker.text.importJmp")}
            </button>
            <input
              ref={packageInput}
              className="sr-only"
              type="file"
              accept=".jmp,application/zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setPackageImport({ kind: "inspecting" });
                void file
                  .arrayBuffer()
                  .then((buffer) =>
                    new JumpPackageImportService().inspect(
                      new Uint8Array(buffer),
                      settingsContext
                        ? effectivePackageSizeLimits(
                            settingsContext.settings.developer,
                          )
                        : SAFE_PACKAGE_SIZE_LIMITS,
                    ),
                  )
                  .then((review) => {
                    if (
                      settingsContext?.settings.developer
                        .useCustomPackageSizeLimits
                    )
                      settingsContext.logger.emit(
                        "package.limits.override_used",
                        {
                          attributes: { operation: "chain-install" },
                        },
                      );
                    setPackageImport({ kind: "review", review });
                  })
                  .catch((error: unknown) => {
                    const blocked =
                      error instanceof PackageSecurityError
                        ? error
                        : new PackageSecurityError(
                            "archive.inspect_failed",
                            {},
                          );
                    setPackageImport({
                      kind: "blocked",
                      code: blocked.code,
                      message: translate(`packageErrors.${blocked.code}`, {
                        ...blocked.parameters,
                        ...(blocked.diagnostic
                          ? {
                              value0: translateDiagnostic(blocked.diagnostic),
                            }
                          : {}),
                      }),
                    });
                  })
                  .finally(() => {
                    if (packageInput.current) packageInput.current.value = "";
                  });
              }}
            />
          </header>
          <label className="chain-library-search">
            <span className="sr-only">
              {translate("ui.chainTracker.text.findAvailableJump")}
            </span>
            <input
              type="search"
              spellCheck={false}
              value={state.librarySearch}
              placeholder={translate("ui.chainTracker.placeholder.findAJump")}
              onChange={(event) =>
                dispatch({
                  type: "set-library-search",
                  value: event.target.value,
                })
              }
            />
          </label>
          <div
            className="chain-library-source"
            role="group"
            aria-label={translate("ui.chainTracker.ariaLabel.jumpSourceFilter")}
          >
            {(state.preferences.showMockData
              ? (["all", "builtin", "imported", "mock"] as const)
              : (["all", "builtin", "imported"] as const)
            ).map((source) => (
              <button
                key={source}
                type="button"
                aria-pressed={
                  (state.librarySource === "mock" &&
                  !state.preferences.showMockData
                    ? "all"
                    : state.librarySource) === source
                }
                onClick={() =>
                  dispatch({ type: "set-library-source", value: source })
                }
              >
                {source[0].toUpperCase() + source.slice(1)}
              </button>
            ))}
          </div>
          <div className="chain-library-list">
            {filteredPackages.map((item) => {
              const existingCount = state.order.filter(
                (id) => state.entries[id].packageExactHash === item.exactHash,
              ).length;
              const existing = existingCount > 0;
              const actionLabel = !existing
                ? "Add to chain"
                : state.preferences.allowDuplicateJumps
                  ? `Add to chain again (x${existingCount + 1})`
                  : "Open chain entity";
              return (
                <article
                  key={item.id}
                  className="chain-library-card"
                  data-tour-target={
                    item.id === "welcome-tour-crossroads"
                      ? "tracker-add-tutorial"
                      : undefined
                  }
                >
                  <div>
                    <strong>
                      {item.name} · v{item.version}
                    </strong>
                    <small>
                      {packageSourceLabel(item.source)} · {item.description}
                      {item.nativeGauntlet && " · Native Gauntlet"}
                    </small>
                  </div>
                  <div className="chain-library-actions">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "add-package", packageId: item.id })
                      }
                    >
                      {actionLabel}
                    </button>
                    {item.source === "imported" && (
                      <button
                        type="button"
                        className="chain-library-remove"
                        aria-label={translate(
                          "ui.chainTracker.ariaLabel.removePackageFromLibrary",
                          { jump: item.name },
                        )}
                        onClick={() =>
                          dispatch({
                            type: "request-uninstall-package",
                            packageId: item.id,
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!filteredPackages.length && (
            <p className="chain-empty">
              {translate(
                "ui.chainTracker.text.noAvailableJumpsMatchThisFilter",
              )}
            </p>
          )}
          {packageImport.kind !== "idle" && (
            <div className="package-review-backdrop">
              {packageImport.kind === "inspecting" ? (
                <section
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="chain-import-inspecting-heading"
                >
                  <p>
                    {translate("ui.chainTracker.text.securePackageInspection")}
                  </p>
                  <h2 id="chain-import-inspecting-heading">
                    {translate("ui.chainTracker.text.inspectingEveryEntry")}
                  </h2>
                  <p>
                    {translate(
                      "ui.chainTracker.text.nothingEntersTheImmutablePackageLibraryUntilArchiveImage",
                    )}
                  </p>
                </section>
              ) : packageImport.kind === "blocked" ? (
                <section
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="chain-import-blocked-heading"
                >
                  <p>{translate("ui.chainTracker.text.installationBlocked")}</p>
                  <h2 id="chain-import-blocked-heading">
                    {translate(
                      "ui.chainTracker.text.thisPackageMayBeUnsafeOrMalformed",
                    )}
                  </h2>
                  <p>{packageImport.message}</p>
                  <code>{packageImport.code}</code>
                  <p>
                    <strong>
                      {translate(
                        "ui.chainTracker.text.nothingWasInstalledExtractedOrAddedToTheChain",
                      )}
                    </strong>
                  </p>
                  <div>
                    <button
                      autoFocus
                      type="button"
                      onClick={() => setPackageImport({ kind: "idle" })}
                    >
                      {translate("ui.chainTracker.text.close")}
                    </button>
                  </div>
                </section>
              ) : packageImport.kind === "conflict" ? (
                <section
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="chain-import-conflict-heading"
                >
                  <p>{translate("ui.chainTracker.text.installationBlocked")}</p>
                  <h2 id="chain-import-conflict-heading">
                    {translate("ui.chainTracker.text.packageAlreadyInstalled")}
                  </h2>
                  <p>
                    {packageImport.reason === "same-version"
                      ? translate(
                          "ui.chainTracker.text.samePackageVersionAlreadyInstalled",
                          {
                            name: packageImport.name,
                            version: packageImport.version,
                          },
                        )
                      : translate(
                          "ui.chainTracker.text.anotherPackageVersionAlreadyInstalled",
                          { name: packageImport.name },
                        )}
                  </p>
                  <p>
                    <strong>
                      {translate(
                        "ui.chainTracker.text.existingPackageWasNotChanged",
                      )}
                    </strong>
                  </p>
                  <div>
                    <button
                      autoFocus
                      type="button"
                      onClick={() => setPackageImport({ kind: "idle" })}
                    >
                      {translate("ui.chainTracker.text.close")}
                    </button>
                  </div>
                </section>
              ) : (
                <PackageReview
                  review={packageImport.review}
                  customLimits={Boolean(
                    settingsContext?.settings.developer
                      .useCustomPackageSizeLimits,
                  )}
                  onCancel={() => setPackageImport({ kind: "idle" })}
                  onImport={() => {
                    const review = packageImport.review;
                    const packageItem: InstalledPackage = {
                      id: `imported-${review.hash}`,
                      logicalId: review.packageItem.logicalId,
                      exactHash: review.hash,
                      name: review.name,
                      version: review.version,
                      source: "imported",
                      description: review.packageItem.description,
                      tags: review.packageItem.tags,
                      authors: review.packageItem.authors,
                      nativeGauntlet: review.packageItem.nativeGauntlet,
                      availability: "library",
                      document: review.packageItem,
                      assets: review.files.assets,
                    };
                    const conflict = packageInstallConflict(state, packageItem);
                    if (conflict) {
                      setPackageImport({
                        kind: "conflict",
                        reason: conflict,
                        name: packageItem.name,
                        version: packageItem.version,
                      });
                      return;
                    }
                    dispatch({
                      type: "install-package",
                      packageItem,
                    });
                    settingsContext?.logger.emit("chain.package.installed", {
                      attributes: {
                        warningOverride: review.status === "warning",
                        definitionCount: review.definitionCount,
                        assetCount: review.assetCount,
                      },
                    });
                    setPackageImport({ kind: "idle" });
                  }}
                />
              )}
            </div>
          )}
        </section>
      )}
    </aside>
  );
}

function JumpPage({
  state,
  dispatch,
  enabled,
  openSupp,
  jumpRenderer,
  runtime,
  randomIndex,
}: TrackerProps & {
  enabled: EnabledModules;
  openSupp: () => void;
  jumpRenderer?: ReactNode;
  runtime: EvaluatedJumpRuntime;
  randomIndex?: RandomIndexSource;
}) {
  const [actorId, setActorId] = useState("jumper");
  const requestedEntryId = state.selectedEntryId;
  const [displayedEntryId, setDisplayedEntryId] = useState<string | null>(
    () => {
      const packageDocument = packageForEntry(state, requestedEntryId).document;
      const requiresImagePreparation =
        Boolean(jumpRenderer) ||
        Boolean(
          packageDocument && jumpPackageImageSources(packageDocument).length,
        );
      return requiresImagePreparation ? null : requestedEntryId;
    },
  );
  const visibleEntryId =
    displayedEntryId && state.entries[displayedEntryId]
      ? displayedEntryId
      : null;
  const transitioning = visibleEntryId !== requestedEntryId;
  const stagedWorkspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!transitioning) return;
    const root = stagedWorkspace.current;
    if (!root) return;
    let cancelled = false;
    let promotionFrame = 0;
    void waitForRenderedJumpImages(root).then(() => {
      promotionFrame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        if (!runtime[requestedEntryId]?.actors[actorId]) setActorId("jumper");
        setDisplayedEntryId(requestedEntryId);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(promotionFrame);
    };
  }, [actorId, requestedEntryId, runtime, transitioning, visibleEntryId]);
  const preloadEntry = (entryId: string) => {
    const packageItem = packageForEntry(state, entryId).document;
    if (packageItem) void preloadJumpImages(packageItem);
  };
  const workspaceEntryIds = visibleEntryId
    ? transitioning
      ? [visibleEntryId, requestedEntryId]
      : [visibleEntryId]
    : [requestedEntryId];
  return (
    <section className="chain-workspace-page chain-jump-page" role="tabpanel">
      <ChainRail
        state={state}
        dispatch={dispatch}
        enabled={enabled}
        openSupp={openSupp}
        actorId={actorId}
        runtime={runtime}
        preloadEntry={preloadEntry}
      />
      <div className="atomic-jump-switcher" aria-busy={transitioning}>
        {!visibleEntryId && (
          <div className="atomic-jump-preparing" role="status">
            <span aria-hidden="true" />
            {translate("ui.chainTracker.text.preparingSelectedJump")}
          </div>
        )}
        {workspaceEntryIds.map((entryId) => {
          const staged = entryId !== visibleEntryId;
          return (
            <JumpWorkspace
              key={entryId}
              state={state}
              dispatch={dispatch}
              entryId={entryId}
              actorId={actorId}
              setActorId={setActorId}
              jumpRenderer={jumpRenderer}
              runtime={runtime}
              randomIndex={randomIndex}
              staged={staged}
              workspaceRef={staged ? stagedWorkspace : undefined}
            />
          );
        })}
        <span className="sr-only" role="status">
          {visibleEntryId && transitioning
            ? "Preparing selected Jump images"
            : ""}
        </span>
      </div>
    </section>
  );
}

function JumpWorkspace({
  state,
  dispatch,
  entryId,
  actorId,
  setActorId,
  jumpRenderer,
  runtime,
  randomIndex,
  staged,
  workspaceRef,
}: TrackerProps & {
  entryId: string;
  actorId: string;
  setActorId: (id: string) => void;
  jumpRenderer?: ReactNode;
  runtime: EvaluatedJumpRuntime;
  randomIndex?: RandomIndexSource;
  staged: boolean;
  workspaceRef?: Ref<HTMLDivElement>;
}) {
  const selected = state.entries[entryId];
  const item = packageForEntry(state, entryId);
  const actorIds = Object.keys(runtime[entryId]?.actors ?? {});
  const activeActorId = actorIds.includes(actorId) ? actorId : "jumper";
  const evaluation = runtime[entryId]?.actors[activeActorId];
  const balance = evaluation?.balance ?? 0;
  const negativeActors = actorIds.filter(
    (id) => (runtime[entryId]?.actors[id]?.balance ?? 0) < 0,
  );
  const number = jumpNumber(state, entryId);
  const gauntlet = runtime[entryId]?.gauntlet;
  const assetUrls = useAssetObjectUrls(item.assets ?? noInstalledAssets);
  const packagedAssetsReady =
    !item.assets ||
    Object.keys(item.assets).every((path) => Boolean(assetUrls[path]));
  return (
    <div
      ref={workspaceRef}
      className={`chain-jump-workspace${staged ? " is-atomic-stage" : ""}`}
      data-jump-entry-id={entryId}
      inert={staged || undefined}
      aria-hidden={staged || undefined}
    >
      {!packagedAssetsReady && (
        <span data-jump-assets-pending hidden aria-hidden="true" />
      )}
      <header className="chain-context-header">
        <div>
          <p>
            {number
              ? `${gauntlet?.active ? "Gauntlet · " : ""}Jump ${number} of ${jumpEntryIds(state).length}`
              : "Before Jump 1"}
          </p>
          <h3>{item.name}</h3>
          <span>
            {number
              ? `Version ${item.version} · ${packageSourceLabel(item.source)} package${selected.status === "Negative balance" ? "" : ` · ${selected.status}`}`
              : EARTH_ENTRY_STATUS}
          </span>
          {negativeActors.length > 0 && (
            <strong className="chain-negative-status" role="status">
              ⚠{" "}
              {negativeActors
                .map((id) => state.actors[id]?.name ?? id)
                .join(", ")}{" "}
              {negativeActors.length === 1 ? "has" : "have"}{" "}
              {translate("ui.chainTracker.text.aNegativePointBalance")}
            </strong>
          )}
        </div>
        <div className="chain-context-actions">
          <label className="chain-actor-control">
            <span>{translate("ui.chainTracker.text.makeChoicesAs")}</span>
            <select
              value={activeActorId}
              className={balance < 0 ? "has-negative-actor" : undefined}
              onChange={(event) => setActorId(event.target.value)}
            >
              {actorIds.map((id) => (
                <option key={id} value={id}>
                  {(runtime[entryId]?.actors[id]?.balance ?? 0) < 0 ? "⚠ " : ""}
                  {state.actors[id]?.name ?? id} ·{" "}
                  {state.actors[id]?.role ?? "Companion"}
                  {(runtime[entryId]?.actors[id]?.balance ?? 0) < 0
                    ? ` · ${runtime[entryId]?.actors[id]?.balance} CP`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          {selected.kind === "jump" && (
            <button
              type="button"
              className="chain-gauntlet-action"
              disabled={Boolean(gauntlet?.native)}
              title={gauntlet?.sources.map((source) => source.label).join(", ")}
              onClick={() =>
                dispatch({
                  type: "toggle-applied-gauntlet",
                  entryId,
                })
              }
            >
              {gauntlet?.native
                ? "Native Gauntlet"
                : gauntlet?.active
                  ? "Remove Gauntlet rules"
                  : "Apply Gauntlet rules"}
            </button>
          )}
        </div>
      </header>
      {jumpRenderer ??
        (evaluation &&
          (selected.kind === "earth" ? (
            <EarthJumpRenderer
              state={state}
              dispatch={dispatch}
              evaluation={evaluation}
            />
          ) : item.document ? (
            <JumpRenderer
              packageItem={item.document}
              entryId={entryId}
              actorId={activeActorId}
              state={
                state.jumpState[entryId]?.actors[activeActorId] ?? {
                  choices: {},
                  inputs: {},
                  sourceSelections: {},
                  choiceRolls: {},
                  sourceRolls: {},
                }
              }
              evaluation={evaluation}
              preferences={state.preferences}
              tags={state.tags}
              companions={Object.values(state.actors)
                .filter(
                  (actor) =>
                    actor.role === "Companion" &&
                    Boolean(actor.joinedEntryId) &&
                    state.order.indexOf(actor.joinedEntryId!) <
                      state.order.indexOf(entryId),
                )
                .map((actor) => ({ id: actor.id, name: actor.name }))}
              gauntletActive={Boolean(gauntlet?.active)}
              resolveAsset={
                item.assets ? (path) => assetUrls[`assets/${path}`] : undefined
              }
              randomIndex={randomIndex}
              dispatch={dispatch}
            />
          ) : (
            <div className="chain-view-panel tracker-renderer-placeholder">
              <p>
                {translate(
                  "ui.chainTracker.text.thisExactPackageIsUnavailableStoredSelectionsArePreserved",
                )}
              </p>
            </div>
          )))}
    </div>
  );
}

function flattenInventoryTagNodes(
  nodes: readonly InventoryTagNode[],
  depth = 1,
): { node: InventoryTagNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenInventoryTagNodes(node.children, depth + 1),
  ]);
}

function InventoryPage({ state, dispatch }: TrackerProps) {
  const records = filteredInventory(state);
  const tagTree = useMemo(() => inventoryTagTree(state), [state]);
  const settingsContext = useOptionalSettings();
  const collapseTagFilters =
    settingsContext?.settings.chain.collapseInventoryTagFilters ?? false;
  const [tagFiltersOpen, setTagFiltersOpen] = useSettingDefaultedState(
    collapseTagFilters,
    !collapseTagFilters,
  );
  const [expandedTagCategories, setExpandedTagCategories] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const availableTagIds = useMemo(() => {
    const ids = new Set<string>();
    const visit = (nodes: readonly InventoryTagNode[]) => {
      for (const node of nodes) {
        ids.add(node.id);
        visit(node.children);
      }
    };
    visit(tagTree);
    return ids;
  }, [tagTree]);
  useEffect(() => {
    if (
      state.inventoryTag !== "all" &&
      !availableTagIds.has(state.inventoryTag)
    )
      dispatch({ type: "set-inventory-tag", value: "all" });
  }, [availableTagIds, dispatch, state.inventoryTag]);
  const toggleCategory = (id: string) =>
    setExpandedTagCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <section
      className="chain-workspace-page chain-view-panel chain-inventory-panel"
      role="tabpanel"
    >
      <header>
        <div>
          <p>{translate("ui.chainTracker.text.accruedInventory")}</p>
          <h4>{translate("ui.chainTracker.text.perksAndItems")}</h4>
          <span>
            {translate("ui.chainTracker.text.through")}
            {packageForEntry(state, state.inspectionPointId).name}
          </span>
        </div>
        <HistoricalSelect
          state={state}
          dispatch={dispatch}
          label={translate("ui.chainTracker.label.inventoryThrough")}
        />
      </header>
      <div
        className="inventory-subtabs"
        role="tablist"
        aria-label={translate("ui.chainTracker.ariaLabel.inventoryView")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={state.inventoryView === "search"}
          onClick={() =>
            dispatch({ type: "set-inventory-view", value: "search" })
          }
        >
          {translate("ui.chainTracker.text.search")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={state.inventoryView === "stats"}
          onClick={() =>
            dispatch({ type: "set-inventory-view", value: "stats" })
          }
        >
          {translate("ui.chainTracker.text.stats")}
        </button>
      </div>
      {state.inventoryView === "search" ? (
        <section
          className="inventory-subpage inventory-search-subpage"
          role="tabpanel"
        >
          <div className="inventory-search-toolbar">
            <input
              type="search"
              spellCheck={false}
              aria-label={translate(
                "ui.chainTracker.ariaLabel.searchInventory",
              )}
              placeholder={translate(
                "ui.chainTracker.placeholder.searchNamesTagsAliasesOrJumps",
              )}
              value={state.inventorySearch}
              onChange={(event) =>
                dispatch({
                  type: "set-inventory-search",
                  value: event.target.value,
                })
              }
            />
            <div
              role="group"
              aria-label={translate(
                "ui.chainTracker.ariaLabel.inventoryRecordKind",
              )}
            >
              {(["all", "perk", "item"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={state.inventoryKind === kind}
                  onClick={() =>
                    dispatch({ type: "set-inventory-kind", value: kind })
                  }
                >
                  {kind[0].toUpperCase() + kind.slice(1)}
                  {kind !== "all" ? "s" : ""}
                </button>
              ))}
            </div>
            {collapseTagFilters && (
              <button
                className="inventory-tag-filter-toggle"
                type="button"
                aria-expanded={tagFiltersOpen}
                aria-controls="inventory-tag-relationships"
                onClick={() => setTagFiltersOpen(!tagFiltersOpen)}
              >
                <span aria-hidden="true">⌕</span>
                <span>
                  {translate("ui.chainTracker.text.tagsFilter", {
                    tag:
                      state.inventoryTag === "all"
                        ? translate("ui.chainTracker.text.all")
                        : (state.tags[state.inventoryTag]?.label ??
                          state.inventoryTag),
                  })}
                </span>
                <Chevron direction={tagFiltersOpen ? "down" : "right"} />
              </button>
            )}
          </div>
          <div
            className={`inventory-search-layout${tagFiltersOpen ? "" : " is-tag-filter-collapsed"}`}
          >
            {tagFiltersOpen && (
              <aside
                id="inventory-tag-relationships"
                className="inventory-tag-dialog"
                aria-label={translate("ui.chainTracker.ariaLabel.tagSearch")}
              >
                <header>
                  <p>{translate("ui.chainTracker.text.tagSearch")}</p>
                  <h5>{translate("ui.chainTracker.text.relationships")}</h5>
                </header>
                <button
                  className="inventory-all-tags"
                  type="button"
                  aria-pressed={state.inventoryTag === "all"}
                  onClick={() =>
                    dispatch({ type: "set-inventory-tag", value: "all" })
                  }
                >
                  <span>{translate("ui.chainTracker.text.allTags")}</span>
                  <small>
                    {translate("ui.chainTracker.text.exactInventoryPoint")}
                  </small>
                </button>
                <div className="inventory-tag-tree-scroll">
                  {tagTree.map((category) => {
                    const expanded = expandedTagCategories.has(category.id);
                    return (
                      <div
                        key={category.id}
                        className="tracker-tag-filter-group"
                      >
                        <div className="inventory-tag-root-row">
                          <button
                            className="inventory-tag-select"
                            type="button"
                            aria-pressed={state.inventoryTag === category.id}
                            onClick={() =>
                              dispatch({
                                type: "set-inventory-tag",
                                value: category.id,
                              })
                            }
                          >
                            <span>◆ {state.tags[category.id].label}</span>
                            <small>
                              {translate(
                                "ui.chainTracker.text.includesDescendants",
                              )}
                            </small>
                          </button>
                          {category.children.length > 0 && (
                            <button
                              className="inventory-tag-expander"
                              type="button"
                              aria-label={`${expanded ? "Collapse" : "Expand"} ${state.tags[category.id].label} tags`}
                              aria-expanded={expanded}
                              onClick={() => toggleCategory(category.id)}
                            >
                              <span aria-hidden="true">›</span>
                            </button>
                          )}
                        </div>
                        {expanded &&
                          flattenInventoryTagNodes(category.children).map(
                            ({ node, depth }) => (
                              <button
                                key={node.id}
                                className="inventory-tag-select inventory-tag-descendant"
                                style={
                                  {
                                    "--inventory-tag-depth": depth,
                                  } as CSSProperties
                                }
                                type="button"
                                aria-pressed={state.inventoryTag === node.id}
                                onClick={() =>
                                  dispatch({
                                    type: "set-inventory-tag",
                                    value: node.id,
                                  })
                                }
                              >
                                <span>└ {state.tags[node.id].label}</span>
                                <small>
                                  {state.tags[node.id].aliases[0]
                                    ? `Alias: ${state.tags[node.id].aliases[0]}`
                                    : "Exact tag"}
                                </small>
                              </button>
                            ),
                          )}
                      </div>
                    );
                  })}
                </div>
              </aside>
            )}
            <div className="inventory-results-pane">
              <div className="inventory-result-note" role="status">
                {records.length} {records.length === 1 ? "record" : "records"}{" "}
                {translate("ui.chainTracker.text.throughRangeSeparator")}
                {packageForEntry(state, state.inspectionPointId).name}.
              </div>
              <div
                className="chain-record-list"
                data-tour-target={
                  records.some(
                    (record) =>
                      record.grantHandle === "field_training" ||
                      record.grantHandle === "travel_pack",
                  )
                    ? "tracker-inventory-tutorial-results"
                    : undefined
                }
              >
                {records.map((record) => (
                  <RecordCard
                    key={record.id}
                    state={state}
                    record={record}
                    open={() =>
                      dispatch({ type: "open-record", id: record.id })
                    }
                  />
                ))}
              </div>
              {!records.length && (
                <p className="chain-record-empty">
                  {translate(
                    "ui.chainTracker.text.noInventoryRecordsMatchTheseFilters",
                  )}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section
          className="inventory-subpage tracker-radar-page"
          role="tabpanel"
        >
          <TagRadar state={state} dispatch={dispatch} />
        </section>
      )}
    </section>
  );
}

function RecordCard({
  state,
  record,
  open,
}: {
  state: TrackerState;
  record: InventoryRecord;
  open: () => void;
}) {
  const item = packageForEntry(state, record.sourceEntryId);
  const acquisitionCount = record.acquisitions?.length ?? 1;
  const tagTooltipId = useId();
  const tagProjection = inventoryRecordTagProjection(state, record);
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`View full details for ${record.name}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div>
        <p>
          {record.kind === "perk" ? "Perk" : "Item"} ·{" "}
          {acquisitionCount > 1
            ? `${acquisitionCount} acquisitions`
            : item.name}
        </p>
        <div className="inventory-record-title">
          <h5>{record.name}</h5>
          <div className="inventory-record-measures">
            {record.measure && (
              <span className="record-measure">
                {record.measure.kind === "rank"
                  ? `Rank ${record.measure.value}`
                  : `x${record.measure.value}`}
              </span>
            )}
            {record.aggregateQuantity && (
              <span className="record-measure">
                x{record.aggregateQuantity}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="inventory-record-tags">
        {tagProjection.visibleIds.map((id) => (
          <TagBadge key={id} tag={state.tags[id]} />
        ))}
        {tagProjection.hiddenCount > 0 && (
          <span
            className="inventory-tag-overflow"
            tabIndex={0}
            aria-describedby={tagTooltipId}
            onClick={(event) => event.stopPropagation()}
          >
            <span aria-hidden="true">…</span>
            <span className="sr-only">
              {tagProjection.hiddenCount}{" "}
              {translate(
                "ui.chainTracker.text.moreTagsHoverOrFocusToShowAllTags",
              )}
            </span>
            <span
              id={tagTooltipId}
              className="inventory-tag-overflow-tooltip"
              role="tooltip"
            >
              <strong>{translate("ui.chainTracker.text.allTags")}</strong>
              <span className="inventory-tag-overflow-list">
                {tagProjection.allIds.map((id) => (
                  <TagBadge key={id} tag={state.tags[id]} />
                ))}
              </span>
            </span>
          </span>
        )}
      </div>
    </article>
  );
}

function FormsPage({ state, dispatch }: TrackerProps) {
  const forms = visibleForms(state);
  const selected = forms.find((form) => form.id === state.selectedFormId);
  return (
    <section
      className="chain-workspace-page chain-view-panel tracker-roster-page"
      role="tabpanel"
    >
      <header className="chain-panel-heading">
        <div>
          <p>{translate("ui.chainTracker.text.accruedBodies")}</p>
          <h4>{translate("ui.chainTracker.text.forms")}</h4>
          <span>
            {translate("ui.chainTracker.text.through")}
            {packageForEntry(state, state.inspectionPointId).name}
          </span>
        </div>
        <HistoricalSelect
          state={state}
          dispatch={dispatch}
          label={translate("ui.chainTracker.label.formsThrough")}
        />
      </header>
      {selected && (
        <FormDetail form={selected} state={state} dispatch={dispatch} />
      )}
      <div className="chain-form-grid">
        {forms.map((form) => (
          <article key={form.id}>
            <div>
              <p>
                {form.id === "form-0"
                  ? "Base form"
                  : `Alt form · ${packageForEntry(state, form.sourceEntryId).name}`}
              </p>
              <h5>{form.name}</h5>
              <span>{form.subtitle}</span>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "select-form", id: form.id })}
            >
              {translate("ui.chainTracker.text.view")}
            </button>
          </article>
        ))}
      </div>
      {!forms.length && (
        <p className="chain-record-empty">
          {translate("ui.chainTracker.text.noFormsAreAvailableAtThisPoint")}
        </p>
      )}
    </section>
  );
}

function FormDetail({
  form,
  state,
  dispatch,
}: { form: FormRecord } & TrackerProps) {
  return (
    <section className="chain-form-detail">
      <div>
        <p>{translate("ui.chainTracker.text.formRecord")}</p>
        <h5 tabIndex={-1}>{form.name}</h5>
        <span>
          {form.id === "form-0" ? "Base form" : "Alt form"} ·{" "}
          {packageForEntry(state, form.sourceEntryId).name}
        </span>
      </div>
      <p>{form.description}</p>
      <div className="chain-form-detail-actions">
        <button
          type="button"
          onClick={() => dispatch({ type: "open-profile", profile: "form" })}
        >
          {translate("ui.chainTracker.text.fullDetails")}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "select-form", id: null })}
        >
          {translate("ui.chainTracker.text.close")}
        </button>
      </div>
    </section>
  );
}

function CompanionsPage({ state, dispatch }: TrackerProps) {
  const companions = visibleCompanions(state);
  const selected = companions.find(
    (item) => item.actorId === state.selectedCompanionId,
  );
  return (
    <section
      className="chain-workspace-page chain-view-panel tracker-roster-page"
      role="tabpanel"
    >
      <header className="chain-panel-heading">
        <div>
          <p>{translate("ui.chainTracker.text.accruedRoster")}</p>
          <h4>{translate("ui.chainTracker.text.companions")}</h4>
          <span>
            {translate("ui.chainTracker.text.through")}
            {packageForEntry(state, state.inspectionPointId).name}
          </span>
        </div>
        <HistoricalSelect
          state={state}
          dispatch={dispatch}
          label={translate("ui.chainTracker.label.rosterThrough")}
        />
      </header>
      {selected && (
        <section className="chain-companion-detail">
          <div>
            <p>{translate("ui.chainTracker.text.companionRecord")}</p>
            <h5 tabIndex={-1}>{state.actors[selected.actorId].name}</h5>
            <span>
              {translate("ui.chainTracker.text.joinedIn")}
              {packageForEntry(state, selected.sourceEntryId).name}
            </span>
          </div>
          <p>{state.actors[selected.actorId].summary}</p>
          <div className="chain-companion-detail-actions">
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "open-profile", profile: "companion" })
              }
            >
              {translate("ui.chainTracker.text.fullProfile")}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "select-companion", id: null })}
            >
              {translate("ui.chainTracker.text.close")}
            </button>
          </div>
        </section>
      )}
      <div className="chain-companion-grid">
        {companions.map((companion) => {
          const actor = state.actors[companion.actorId];
          return (
            <article key={companion.actorId}>
              <span aria-hidden="true">{actor.initials}</span>
              <div>
                <h5>{actor.name}</h5>
                <p>
                  {translate("ui.chainTracker.text.joinedInLabel")}{" "}
                  {packageForEntry(state, companion.sourceEntryId).name}
                </p>
                <div>
                  {companion.tags.map(
                    (id) =>
                      state.tags[id] && (
                        <TagBadge key={id} tag={state.tags[id]} />
                      ),
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "select-companion", id: companion.actorId })
                }
              >
                {translate("ui.chainTracker.text.view")}
              </button>
            </article>
          );
        })}
      </div>
      {!companions.length && (
        <p className="chain-record-empty">
          {translate("ui.chainTracker.text.noCompanionsHaveJoinedByThisPoint")}
        </p>
      )}
    </section>
  );
}

function RecordModal({
  state,
  dispatch,
  applicationOverlay,
}: TrackerProps & { applicationOverlay: boolean }) {
  const record = aggregateInventoryRecords(
    state.records.filter((item) =>
      visibleAtInspection(state, item.sourceEntryId),
    ),
    state.preferences.aggregateSimilarInventory,
  ).find((item) => item.id === state.selectedRecordId);
  if (!record) return null;
  return (
    <FocusModal
      label={`${record.kind} details: ${record.name}`}
      className="record-detail-layer"
      applicationOverlay={applicationOverlay}
      onClose={() => dispatch({ type: "open-record", id: null })}
    >
      <header>
        <div>
          <p>
            {record.kind === "perk" ? "Perk" : "Item"}{" "}
            {translate("ui.chainTracker.text.details")}
          </p>
          <h4 tabIndex={0}>{record.name}</h4>
        </div>
        <button
          type="button"
          aria-label={translate(
            "ui.chainTracker.ariaLabel.closePerkOrItemDetails",
          )}
          onClick={() => dispatch({ type: "open-record", id: null })}
        >
          ×
        </button>
      </header>
      <div className="record-detail-body">
        <p className="record-detail-source">
          {(record.acquisitions?.length ?? 1) > 1
            ? `${record.acquisitions?.length} acquisitions`
            : `Acquired in ${packageForEntry(state, record.sourceEntryId).name}`}
          {record.ownerFormId
            ? ` · ${state.forms.find((form) => form.id === record.ownerFormId)?.name ?? "Form"} record`
            : record.ownerActorId && record.ownerActorId !== "jumper"
              ? ` · ${state.actors[record.ownerActorId].name} record`
              : ""}
        </p>
        <div
          className="record-detail-tags"
          aria-label={translate("ui.chainTracker.ariaLabel.tags")}
        >
          {record.tags.map(
            (id) =>
              state.tags[id] && <TagBadge key={id} tag={state.tags[id]} />,
          )}
        </div>
        {record.measure && (
          <dl className="record-detail-measure">
            <div>
              <dt>{record.measure.kind === "rank" ? "Rank" : "Quantity"}</dt>
              <dd>{record.measure.value}</dd>
            </div>
          </dl>
        )}
        {record.aggregateQuantity && (
          <dl className="record-detail-measure">
            <div>
              <dt>{translate("ui.chainTracker.text.quantity")}</dt>
              <dd>{record.aggregateQuantity}</dd>
            </div>
          </dl>
        )}
        <h5>
          {(record.acquisitions?.length ?? 0) > 1
            ? "Acquisitions and descriptions"
            : "Description"}
        </h5>
        {(record.acquisitions?.length ?? 0) > 1 ? (
          <ul
            className={`record-detail-acquisitions${(record.acquisitions?.length ?? 0) > RECORD_ACQUISITIONS_BEFORE_SCROLL ? " is-scrollable" : ""}`}
            aria-label={translate(
              "ui.chainTracker.ariaLabel.acquisitionDetails",
            )}
            tabIndex={
              (record.acquisitions?.length ?? 0) >
              RECORD_ACQUISITIONS_BEFORE_SCROLL
                ? 0
                : undefined
            }
          >
            {record.acquisitions?.map((acquisition) => (
              <li key={acquisition.recordId}>
                <strong>
                  {translate("ui.chainTracker.text.acquiredIn")}{" "}
                  {packageForEntry(state, acquisition.sourceEntryId).name}
                  {" · "}
                  {translate("ui.chainTracker.text.jump")}
                  {jumpNumber(state, acquisition.sourceEntryId)}
                  {acquisition.quantity > 1 && ` · x${acquisition.quantity}`}
                </strong>
                <p>{acquisition.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{record.acquisitions?.[0]?.description ?? record.description}</p>
        )}
      </div>
    </FocusModal>
  );
}

function ProfileModal({
  state,
  dispatch,
  applicationOverlay,
  inactive,
}: TrackerProps & { applicationOverlay: boolean; inactive: boolean }) {
  if (!state.activeProfile) return null;
  const isForm = state.activeProfile === "form";
  const form = isForm
    ? state.forms.find((item) => item.id === state.selectedFormId)
    : undefined;
  const companion = isForm
    ? undefined
    : state.companions.find(
        (item) => item.actorId === state.selectedCompanionId,
      );
  if ((isForm && !form) || (!isForm && !companion)) return null;
  const actor = companion ? state.actors[companion.actorId] : null;
  const name = form?.name ?? actor?.name ?? "Profile";
  const recordIds = form?.perkRecordIds ?? [
    ...(companion?.perkRecordIds ?? []),
    ...(companion?.itemRecordIds ?? []),
  ];
  return (
    <FocusModal
      label={`${isForm ? "Form details" : "Companion profile"}: ${name}`}
      className="companion-profile-layer"
      applicationOverlay={applicationOverlay}
      inactive={inactive}
      onClose={() => dispatch({ type: "open-profile", profile: null })}
    >
      <header>
        <div>
          <p>{isForm ? "Form details" : "Companion profile"}</p>
          <h4 tabIndex={0}>{name}</h4>
        </div>
        <button
          type="button"
          aria-label={`Close ${isForm ? "form details" : "companion profile"}`}
          onClick={() => dispatch({ type: "open-profile", profile: null })}
        >
          ×
        </button>
      </header>
      <div className="companion-profile-summary">
        <span aria-hidden="true">{form?.initials ?? actor?.initials}</span>
        <div>
          <strong>{name}</strong>
          <p>{form?.description ?? actor?.summary}</p>
        </div>
      </div>
      <div className="companion-profile-columns">
        {isForm && form ? (
          <>
            <section>
              <h5>{translate("ui.chainTracker.text.detailsLabel")}</h5>
              <ul>
                {form.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </section>
            <ProfileRecords
              state={state}
              ids={recordIds}
              dispatch={dispatch}
              title={translate("ui.chainTracker.title.formPerks")}
              emptyMessage="Form has no perks"
            />
          </>
        ) : companion ? (
          <>
            <ProfileRecords
              state={state}
              ids={companion.perkRecordIds}
              dispatch={dispatch}
              title={translate("ui.chainTracker.title.perks")}
              emptyMessage="Companion has no perks"
            />
            <ProfileRecords
              state={state}
              ids={companion.itemRecordIds}
              dispatch={dispatch}
              title={translate("ui.chainTracker.title.items")}
              emptyMessage="Companion has no items"
            />
            <ProfileImports state={state} ids={companion.importedEntryIds} />
          </>
        ) : null}
      </div>
    </FocusModal>
  );
}

function ProfileRecords({
  state,
  ids,
  dispatch,
  title,
  emptyMessage,
}: {
  state: TrackerState;
  ids: readonly string[];
  dispatch: Dispatch<TrackerAction>;
  title: string;
  emptyMessage: string;
}) {
  const records = aggregateInventoryRecords(
    state.records.filter(
      (record) =>
        ids.includes(record.id) &&
        visibleAtInspection(state, record.sourceEntryId),
    ),
    state.preferences.aggregateSimilarInventory,
  );
  return (
    <section>
      {records.length ? (
        <>
          <h5>{title}</h5>
          <ul
            className={`companion-profile-list${records.length > PROFILE_RECORDS_BEFORE_SCROLL ? " is-scrollable" : ""}`}
          >
            {records.map((record) => {
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "open-record", id: record.id })
                    }
                  >
                    {record.name}
                    {record.measure?.kind === "rank" &&
                      ` · Rank ${record.measure.value}`}
                    {record.measure?.kind === "quantity" &&
                      ` · x${record.measure.value}`}
                    {record.aggregateQuantity &&
                      ` · x${record.aggregateQuantity}`}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="companion-profile-empty">{emptyMessage}</p>
      )}
    </section>
  );
}

function ProfileImports({
  state,
  ids,
}: {
  state: TrackerState;
  ids: readonly string[];
}) {
  const entries = ids.flatMap((id) =>
    state.entries[id] ? [{ id, name: packageForEntry(state, id).name }] : [],
  );
  return (
    <section>
      {entries.length ? (
        <>
          <h5>{translate("ui.chainTracker.text.importedInto")}</h5>
          <ul
            className={`companion-profile-list is-imports${entries.length > PROFILE_IMPORTS_BEFORE_SCROLL ? " is-scrollable" : ""}`}
          >
            {entries.map((entry) => (
              <li key={entry.id}>{entry.name}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="companion-profile-empty">
          {translate(
            "ui.chainTracker.text.companionHasNotBeenImportedIntoAnyJumps",
          )}
        </p>
      )}
    </section>
  );
}

function PackageUninstallModal({
  state,
  dispatch,
  pending,
}: TrackerProps & {
  pending: Extract<
    NonNullable<TrackerState["pending"]>,
    { kind: "uninstall-package" }
  >;
}) {
  const item = state.packages[pending.packageId];
  if (!item) return null;
  const removalLabel = translate("ui.chainTracker.text.removePackage", {
    name: item.name,
  });
  return (
    <FocusModal
      label={removalLabel}
      className="tracker-impact-layer"
      onClose={() => dispatch({ type: "cancel-mutation" })}
    >
      <header>
        <div>
          <p>{translate("ui.chainTracker.text.packageRemoval")}</p>
          <h4>{removalLabel}</h4>
        </div>
        <button
          type="button"
          aria-label={translate(
            "ui.chainTracker.ariaLabel.closeDependencyReview",
          )}
          onClick={() => dispatch({ type: "cancel-mutation" })}
        >
          ×
        </button>
      </header>
      <div className="tracker-impact-body">
        <p>
          {pending.entryIds.length > 0
            ? translate(
                pending.entryIds.length === 1
                  ? "ui.chainTracker.text.removingPackageAlsoRemovesOneChainEntity"
                  : "ui.chainTracker.text.removingPackageAlsoRemovesChainEntities",
                { count: pending.entryIds.length },
              )
            : translate(
                "ui.chainTracker.text.removingPackageDeletesItFromLibrary",
              )}
        </p>
        {pending.impacts.length > 0 && (
          <>
            <h5>{translate("ui.chainTracker.text.affectedDependencies")}</h5>
            <ul>
              {pending.impacts.map((impact) => (
                <li
                  key={`${impact.kind}:${impact.subjectId}:${impact.providerEntryId}`}
                >
                  <strong>{state.actors[impact.subjectId]?.name}</strong>{" "}
                  {translate("ui.chainTracker.text.isProvidedBy")} {item.name}{" "}
                  {translate("ui.chainTracker.text.andImportedBy")}{" "}
                  {impact.consumerEntryIds
                    .map((entryId) => packageForEntry(state, entryId).name)
                    .join(", ")}
                  .
                </li>
              ))}
            </ul>
          </>
        )}
        <div>
          <button
            type="button"
            onClick={() => dispatch({ type: "cancel-mutation" })}
          >
            {translate("ui.chainTracker.text.cancel")}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "commit-mutation" })}
          >
            {translate(
              pending.entryIds.length === 1
                ? "ui.chainTracker.text.removePackageAndOneEntry"
                : "ui.chainTracker.text.removePackageAndEntries",
              { count: pending.entryIds.length },
            )}
          </button>
        </div>
      </div>
    </FocusModal>
  );
}

function MutationModal({ state, dispatch }: TrackerProps) {
  const pending = state.pending;
  if (!pending) return null;
  if (pending.kind === "uninstall-package")
    return (
      <PackageUninstallModal
        state={state}
        dispatch={dispatch}
        pending={pending}
      />
    );
  const item = packageForEntry(state, pending.entryId);
  const choiceName = (handle: string) =>
    item.document?.choices.find((choice) => choice.handle === handle)?.name
      .base ?? handle;
  const formName = (handle: string) =>
    item.document?.choices.find((choice) =>
      choice.grants.some(
        (grant) => grant.kind === "form" && grant.handle === handle,
      ),
    )?.name.base ?? handle;
  return (
    <FocusModal
      label={`Review ${pending.kind}`}
      className="tracker-impact-layer"
      onClose={() => dispatch({ type: "cancel-mutation" })}
    >
      <header>
        <div>
          <p>{translate("ui.chainTracker.text.dependencyReview")}</p>
          <h4>
            {pending.kind === "move"
              ? `Reorder ${item.name}`
              : pending.kind === "remove"
                ? `Remove ${item.name}`
                : `Remove ${formName(pending.impacts[0]?.formHandle ?? "form")}`}
          </h4>
        </div>
        <button
          type="button"
          aria-label={translate(
            "ui.chainTracker.ariaLabel.closeDependencyReview",
          )}
          onClick={() => dispatch({ type: "cancel-mutation" })}
        >
          ×
        </button>
      </header>
      <div className="tracker-impact-body">
        <p>
          {pending.kind === "move"
            ? "This reorder would place an active dependency before the Jump that provides it."
            : pending.kind === "remove"
              ? "This deletion would remove a provider that a later Jump still imports. The installed package remains in the library."
              : "Removing this form also clears active perks assigned to it."}
        </p>
        {pending.impacts.length > 0 && (
          <>
            <h5>{translate("ui.chainTracker.text.affectedDependencies")}</h5>
            <ul>
              {pending.impacts.map((impact) =>
                impact.kind === "form-perk" ? (
                  <li key={`${impact.kind}:${impact.formHandle}`}>
                    <strong>{formName(impact.formHandle)}</strong>{" "}
                    {translate("ui.chainTracker.text.ownsActive")}{" "}
                    {impact.dependentChoiceHandles
                      .map((handle) => choiceName(handle))
                      .join(", ")}
                    .
                  </li>
                ) : (
                  <li
                    key={`${impact.kind}:${impact.subjectId}:${impact.providerEntryId}`}
                  >
                    <strong>{state.actors[impact.subjectId]?.name}</strong>{" "}
                    {translate("ui.chainTracker.text.isProvidedBy")}{" "}
                    {packageForEntry(state, impact.providerEntryId)?.name}{" "}
                    {translate("ui.chainTracker.text.andImportedBy")}{" "}
                    {impact.consumerEntryIds
                      .map((entryId) => packageForEntry(state, entryId)?.name)
                      .join(", ")}
                    .
                  </li>
                ),
              )}
            </ul>
          </>
        )}
        <div>
          <button
            type="button"
            onClick={() => dispatch({ type: "cancel-mutation" })}
          >
            {translate("ui.chainTracker.text.cancel")}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "commit-mutation" })}
          >
            {pending.kind === "move"
              ? "Commit reorder"
              : pending.kind === "remove"
                ? "Remove Jump"
                : "Remove form and perks"}
          </button>
        </div>
      </div>
    </FocusModal>
  );
}

export type TrackerProps = {
  state: TrackerState;
  dispatch: Dispatch<TrackerAction>;
};

export function ChainTracker({
  state,
  dispatch,
  jumpRenderer,
  randomIndex,
  showApplicationHeader = true,
  active = true,
}: TrackerProps & {
  jumpRenderer?: ReactNode;
  showApplicationHeader?: boolean;
  randomIndex?: RandomIndexSource;
  active?: boolean;
}) {
  const [suppOpen, setSuppOpen] = useState(false);
  const enabled = state.enabledSupplements;
  const supplementPage = state.supplementPage;
  const bodyMod = state.bodyMod;
  const evaluation = useMemo(
    () => evaluateTracker(state, enabled["body-mod"] ? bodyMod : null),
    [bodyMod, enabled, state],
  );
  const projectedState = useMemo(
    () => projectEvaluation(state, evaluation),
    [evaluation, state],
  );
  const runtime = evaluation.runtime;
  const activeSupplementState = supplementStateForEntry(projectedState);
  const selectedRecord = projectedState.selectedRecordId !== null;
  const selectedItem = packageForEntry(
    projectedState,
    projectedState.selectedEntryId,
  );
  const selectedNumber = jumpNumber(
    projectedState,
    projectedState.selectedEntryId,
  );
  const selectedGauntlet = runtime[projectedState.selectedEntryId]?.gauntlet;
  const applicationShell =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>(".app-primary-shell");
  useEffect(() => {
    if (
      active ||
      (!suppOpen &&
        !state.activeProfile &&
        !state.selectedRecordId &&
        !state.pending)
    )
      return;
    const frame = window.requestAnimationFrame(() => {
      setSuppOpen(false);
      if (state.activeProfile || state.selectedRecordId || state.pending)
        dispatch({ type: "close-dialogs" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    active,
    dispatch,
    suppOpen,
    state.activeProfile,
    state.pending,
    state.selectedRecordId,
  ]);
  const closeSupplement = () => {
    setSuppOpen(false);
    window.setTimeout(
      () => document.getElementById("tracker-open-supp")?.focus(),
      20,
    );
  };
  const supplementDialog =
    active && suppOpen && projectedState.page === "jump" ? (
      <TrackerSupplementContext
        jumpName={selectedItem.name}
        jumpEntryId={projectedState.selectedEntryId}
        jumpNumber={selectedNumber ?? 0}
        gauntlet={Boolean(selectedGauntlet?.active)}
        enabled={enabled}
        onClose={closeSupplement}
        onOpenPage={(id: ModuleId) => {
          setSuppOpen(false);
          dispatch({ type: "set-supplement-page", value: id });
          dispatch({ type: "set-page", page: "supplements" });
        }}
      />
    ) : null;
  const supplementLayer = supplementDialog ? (
    <div
      className={
        applicationShell
          ? "app-settings-layer is-overlay tracker-supp-application-layer"
          : "tracker-supp-layer"
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSupplement();
      }}
    >
      {supplementDialog}
    </div>
  ) : null;
  const profileOpen = projectedState.activeProfile !== null;
  const applicationModalOpen =
    Boolean(applicationShell) &&
    active &&
    (suppOpen || selectedRecord || profileOpen);
  const trackerDialogs = active ? (
    <>
      <ProfileModal
        state={projectedState}
        dispatch={dispatch}
        applicationOverlay={Boolean(applicationShell)}
        inactive={selectedRecord && profileOpen}
      />
      <RecordModal
        state={projectedState}
        dispatch={dispatch}
        applicationOverlay={Boolean(applicationShell)}
      />
    </>
  ) : null;
  return (
    <SupplementProviders
      bodyMod={projectedState.bodyMod}
      onBodyModChange={(value) => dispatch({ type: "set-body-mod", value })}
      supplementState={activeSupplementState}
      supplementDispatch={(action) =>
        dispatch({ type: "supplement-action", action })
      }
    >
      <div
        className={`chain-mockup tracker-review-frame${showApplicationHeader ? "" : " is-shell-embedded"}`}
        aria-label={translate(
          "ui.chainTracker.ariaLabel.interactiveChainTrackerWorkspace",
        )}
        inert={applicationModalOpen || undefined}
        aria-hidden={applicationModalOpen || undefined}
      >
        {showApplicationHeader && <ChainHeader />}
        <MainTabs state={projectedState} dispatch={dispatch} />
        <div
          className="chain-page-stack"
          inert={suppOpen || undefined}
          aria-hidden={suppOpen || undefined}
        >
          {projectedState.page === "jump" && (
            <JumpPage
              state={projectedState}
              dispatch={dispatch}
              enabled={enabled}
              openSupp={() => setSuppOpen(true)}
              jumpRenderer={jumpRenderer}
              runtime={runtime}
              randomIndex={randomIndex}
            />
          )}
          {projectedState.page === "inventory" && (
            <InventoryPage state={projectedState} dispatch={dispatch} />
          )}
          {projectedState.page === "forms" && (
            <FormsPage state={projectedState} dispatch={dispatch} />
          )}
          {projectedState.page === "companions" && (
            <CompanionsPage state={projectedState} dispatch={dispatch} />
          )}
          {projectedState.page === "supplements" && (
            <TrackerSupplementWorkspace
              enabled={enabled}
              onEnabledChange={(value) =>
                dispatch({ type: "set-enabled-supplements", value })
              }
              page={supplementPage}
              onPageChange={(value) =>
                dispatch({ type: "set-supplement-page", value })
              }
            />
          )}
        </div>
        {!applicationShell && supplementLayer}
        <MutationModal state={projectedState} dispatch={dispatch} />
        {!applicationShell && trackerDialogs}
      </div>
      {applicationShell && supplementLayer
        ? createPortal(supplementLayer, applicationShell)
        : null}
      {applicationShell && trackerDialogs
        ? createPortal(trackerDialogs, applicationShell)
        : null}
    </SupplementProviders>
  );
}
