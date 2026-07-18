import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type Ref,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  dropEdgeAtPointer,
  dropIndexForTarget,
  type DropEdge,
} from "../ui/dragReorder";
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
import { TagBadge, TagRadar } from "./TagRadar";
import { JumpRenderer } from "./JumpRenderer";
import type { RandomIndexSource } from "../domain";
import { EarthJumpRenderer } from "./EarthJumpRenderer";
import {
  JumpPackageImportService,
  PackageSecurityError,
  type PackageImportReview,
} from "../archive";
import { PackageReview } from "../editor/EditorHub";
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
} from "./jumpImages";
import {
  aggregateInventoryRecords,
  filteredInventory,
  inventoryRecordTagProjection,
  inventoryTagTree,
  EARTH_ENTRY_STATUS,
  jumpEntryIds,
  jumpNumber,
  packageForEntry,
  trackerPages,
  visibleCompanions,
  visibleForms,
  visibleAtInspection,
  type FormRecord,
  type InventoryRecord,
  type InventoryTagNode,
  type TrackerAction,
  type TrackerPage,
  type TrackerState,
  type EvaluatedJumpRuntime,
  supplementStateForEntry,
} from "./model";

const PROFILE_RECORDS_BEFORE_SCROLL = 5;
const PROFILE_IMPORTS_BEFORE_SCROLL = 9;
const RECORD_ACQUISITIONS_BEFORE_SCROLL = 3;

const pageLabels: Record<TrackerPage, string> = {
  jump: "Chain & Jump",
  inventory: "Inventory",
  forms: "Forms",
  companions: "Companions",
  supplements: "Supplements",
};

function TruncatedText({ children }: { children: string }) {
  const ref = useRef<HTMLElement>(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setTruncated(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);
  return (
    <small ref={ref} title={truncated ? children : undefined}>
      {children}
    </small>
  );
}

function ChainHeader() {
  return (
    <header className="chain-mock-header">
      <div>
        <span className="chain-mock-mark" aria-hidden="true">
          JV
        </span>
        <div>
          <p>Chain Tracker</p>
          <strong>Morgan</strong>
        </div>
      </div>
      <nav aria-label="Application workspace switch">
        <button type="button">Editor</button>
        <button type="button" aria-current="page">
          Chain Tracker
        </button>
      </nav>
      <button type="button">Settings</button>
    </header>
  );
}

function MainTabs({ state, dispatch }: TrackerProps) {
  const counts = {
    inventory: filteredInventory({
      ...state,
      inventoryKind: "all",
      inventoryTag: "all",
      inventorySearch: "",
    }).length,
    forms: visibleForms(state).length,
    companions: visibleCompanions(state).length,
  };
  return (
    <div
      className="chain-main-tabs"
      role="tablist"
      aria-label="Chain workspace page"
      onKeyDown={(event) => {
        const index = trackerPages.indexOf(state.page);
        let next = index;
        if (event.key === "ArrowRight")
          next = (index + 1) % trackerPages.length;
        else if (event.key === "ArrowLeft")
          next = (index - 1 + trackerPages.length) % trackerPages.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = trackerPages.length - 1;
        else return;
        event.preventDefault();
        dispatch({ type: "set-page", page: trackerPages[next] });
        requestAnimationFrame(() =>
          (event.currentTarget.children[next] as HTMLElement)?.focus(),
        );
      }}
    >
      {trackerPages.map((page) => (
        <button
          key={page}
          type="button"
          role="tab"
          aria-selected={state.page === page}
          tabIndex={state.page === page ? 0 : -1}
          onClick={() => dispatch({ type: "set-page", page })}
        >
          {pageLabels[page]}
          {page === "inventory" && <span>{counts.inventory}</span>}
          {page === "forms" && <span>{counts.forms}</span>}
          {page === "companions" && <span>{counts.companions}</span>}
        </button>
      ))}
    </div>
  );
}

function HistoricalSelect({
  state,
  dispatch,
  label,
}: TrackerProps & { label: string }) {
  return (
    <label className="chain-point-control">
      <span>{label}</span>
      <select
        aria-label={`${label} historical cutoff`}
        value={state.inspectionPointId}
        onChange={(event) =>
          dispatch({ type: "set-inspection", entryId: event.target.value })
        }
      >
        {[...state.order].reverse().map((id) => {
          const item = packageForEntry(state, id);
          const number = jumpNumber(state, id);
          return (
            <option key={id} value={id}>
              {number ? `${number}. ` : ""}
              {item.name} · {number ? `v${item.version}` : "Chain beginning"}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function FocusModal({
  label,
  className,
  onClose,
  applicationOverlay = false,
  inactive = false,
  children,
}: {
  label: string;
  className: string;
  onClose: () => void;
  applicationOverlay?: boolean;
  inactive?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => [
      ...(root.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex="0"]',
      ) ?? []),
    ];
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      const dialogs = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        ),
      ];
      if (dialogs.at(-1) !== root.current?.querySelector('[role="dialog"]'))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [onClose]);
  const dialogClass =
    className === "record-detail-layer"
      ? "record-detail-dialog"
      : className === "companion-profile-layer"
        ? "companion-profile-dialog"
        : "tracker-impact-dialog";
  return (
    <div
      ref={root}
      className={`${className}${applicationOverlay ? " app-settings-layer is-overlay tracker-dialog-application-layer" : ""}`}
      inert={inactive || undefined}
      aria-hidden={inactive || undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </section>
    </div>
  );
}

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
    const source =
      state.librarySource === "all" || item.source === state.librarySource;
    const query = `${item.name} ${item.version} ${item.description}`
      .toLocaleLowerCase()
      .includes(state.librarySearch.toLocaleLowerCase());
    return source && query;
  });
  return (
    <aside className="chain-rail" aria-label="Chain and jump library">
      <div
        className="chain-rail-tabs"
        role="tablist"
        aria-label="Chain navigation"
      >
        {(["chain", "library"] as const).map((page) => (
          <button
            key={page}
            type="button"
            role="tab"
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
              <strong>{jumpEntryIds(state).length} Jumps</strong>
            </div>
            <div className="chain-rail-header-actions">
              {hasEnabledSupplements(enabled) && (
                <button
                  id="tracker-open-supp"
                  type="button"
                  aria-haspopup="dialog"
                  onClick={openSupp}
                >
                  Supp
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "set-rail-page", page: "library" })
                }
              >
                + Add
              </button>
            </div>
          </header>
          <dl className="chain-jump-summary" aria-label="Current jump summary">
            <div className="chain-summary-hover">
              <dt>Currency</dt>
              <dd tabIndex={0}>
                <span className={balance < 0 ? "is-negative" : undefined}>
                  {balance} CP
                </span>
                <span className="chain-summary-tooltip" role="tooltip">
                  <strong>Alternative currencies remaining</strong>
                  {alternativeResources.length ? (
                    alternativeResources.map((resource) => (
                      <span key={resource.handle}>
                        {resource.balance} {resource.abbreviation} ·{" "}
                        {resource.name}
                      </span>
                    ))
                  ) : (
                    <span>No alternative currencies in this Jump.</span>
                  )}
                </span>
              </dd>
            </div>
            <div className="chain-summary-hover chain-summary-origin">
              <dt>Origin</dt>
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
                    Species: {evaluation?.properties.species?.value ?? "Human"}
                  </span>
                  <span>
                    Location:{" "}
                    {evaluation?.properties.location?.value ?? "Unknown"}
                  </span>
                </span>
              </dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{evaluation?.properties.gender?.value ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{evaluation?.properties.age?.value ?? "Unknown"}</dd>
            </div>
          </dl>
          <div
            className="chain-jump-list"
            aria-label="Ordered chain jumps, newest first"
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
                : `${item.source === "builtin" ? "Built-in" : "Imported"} · ${entry.status}${runtime[id]?.gauntlet.active ? " · Gauntlet" : ""}`;
              return (
                <article
                  key={id}
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
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      ⠿
                    </span>
                  )}
                  <button
                    type="button"
                    className="chain-jump-select"
                    aria-pressed={state.selectedEntryId === id}
                    onPointerEnter={() => preloadEntry(id)}
                    onFocus={() => preloadEntry(id)}
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
                      <button
                        type="button"
                        disabled={index === state.order.length - 1}
                        aria-label={`Move ${item.name} later in the chain`}
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
                        aria-label={`Move ${item.name} earlier in the chain`}
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
                        disabled={false}
                        aria-label={`Remove ${item.name} from the chain`}
                        onClick={() =>
                          dispatch({ type: "request-remove", entryId: id })
                        }
                      >
                        ×
                      </button>
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
              <p>Parallel versions enabled</p>
              <strong>Available packages</strong>
            </div>
            <button
              type="button"
              className="chain-library-import"
              onClick={() => packageInput.current?.click()}
            >
              Import .jmp
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
                            "The package could not be inspected safely.",
                          );
                    setPackageImport({
                      kind: "blocked",
                      code: blocked.code,
                      message: blocked.message,
                    });
                  })
                  .finally(() => {
                    if (packageInput.current) packageInput.current.value = "";
                  });
              }}
            />
          </header>
          <label className="chain-library-search">
            <span className="sr-only">Find available jump</span>
            <input
              type="search"
              value={state.librarySearch}
              placeholder="Find a jump"
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
            aria-label="Jump source filter"
          >
            {(["all", "builtin", "imported"] as const).map((source) => (
              <button
                key={source}
                type="button"
                aria-pressed={state.librarySource === source}
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
                <article key={item.id} className="chain-library-card">
                  <div>
                    <strong>
                      {item.name} · v{item.version}
                    </strong>
                    <small>
                      {item.source === "builtin" ? "Built-in" : "Imported"} ·{" "}
                      {item.description}
                      {item.nativeGauntlet && " · Native Gauntlet"}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "add-package", packageId: item.id })
                    }
                  >
                    {actionLabel}
                  </button>
                </article>
              );
            })}
          </div>
          {!filteredPackages.length && (
            <p className="chain-empty">No available jumps match this filter.</p>
          )}
          {packageImport.kind !== "idle" && (
            <div className="package-review-backdrop">
              {packageImport.kind === "inspecting" ? (
                <section
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="chain-import-inspecting-heading"
                >
                  <p>Secure package inspection</p>
                  <h2 id="chain-import-inspecting-heading">
                    Inspecting every entry…
                  </h2>
                  <p>
                    Nothing enters the immutable package library until archive,
                    image, source, schema, reference, and size validation
                    completes.
                  </p>
                </section>
              ) : packageImport.kind === "blocked" ? (
                <section
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="chain-import-blocked-heading"
                >
                  <p>Installation blocked</p>
                  <h2 id="chain-import-blocked-heading">
                    This package may be unsafe or malformed
                  </h2>
                  <p>{packageImport.message}</p>
                  <code>{packageImport.code}</code>
                  <p>
                    <strong>
                      Nothing was installed, extracted, or added to the chain.
                    </strong>
                  </p>
                  <div>
                    <button
                      autoFocus
                      type="button"
                      onClick={() => setPackageImport({ kind: "idle" })}
                    >
                      Close
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
                    dispatch({
                      type: "install-package",
                      packageItem: {
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
                      },
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
            Preparing selected Jump…
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
  const assetUrls = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(item.assets ?? {}).map(([path, bytes]) => [
          path,
          URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer])),
        ]),
      ),
    [item.assets],
  );
  useEffect(
    () => () => {
      for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url);
    },
    [assetUrls],
  );
  return (
    <div
      ref={workspaceRef}
      className={`chain-jump-workspace${staged ? " is-atomic-stage" : ""}`}
      data-jump-entry-id={entryId}
      inert={staged || undefined}
      aria-hidden={staged || undefined}
    >
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
              ? `Version ${item.version} · ${item.source === "builtin" ? "Built-in" : "Imported"} package${selected.status === "Negative balance" ? "" : ` · ${selected.status}`}`
              : EARTH_ENTRY_STATUS}
          </span>
          {negativeActors.length > 0 && (
            <strong className="chain-negative-status" role="status">
              ⚠{" "}
              {negativeActors
                .map((id) => state.actors[id]?.name ?? id)
                .join(", ")}{" "}
              {negativeActors.length === 1 ? "has" : "have"} a negative point
              balance
            </strong>
          )}
        </div>
        <div className="chain-context-actions">
          <label className="chain-actor-control">
            <span>Make choices as</span>
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
              resolveAsset={(path) => assetUrls[path]}
              randomIndex={randomIndex}
              dispatch={dispatch}
            />
          ) : (
            <div className="chain-view-panel tracker-renderer-placeholder">
              <p>
                This exact package is unavailable. Stored selections are
                preserved until it is restored.
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
          <p>Accrued inventory</p>
          <h4>Perks and items</h4>
          <span>
            Through {packageForEntry(state, state.inspectionPointId).name}
          </span>
        </div>
        <HistoricalSelect
          state={state}
          dispatch={dispatch}
          label="Inventory through"
        />
      </header>
      <div
        className="inventory-subtabs"
        role="tablist"
        aria-label="Inventory view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={state.inventoryView === "search"}
          onClick={() =>
            dispatch({ type: "set-inventory-view", value: "search" })
          }
        >
          Search
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={state.inventoryView === "stats"}
          onClick={() =>
            dispatch({ type: "set-inventory-view", value: "stats" })
          }
        >
          Stats
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
              aria-label="Search inventory"
              placeholder="Search names, tags, aliases, or jumps"
              value={state.inventorySearch}
              onChange={(event) =>
                dispatch({
                  type: "set-inventory-search",
                  value: event.target.value,
                })
              }
            />
            <div role="group" aria-label="Inventory record kind">
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
          </div>
          <div className="inventory-search-layout">
            <aside className="inventory-tag-dialog" aria-label="Tag search">
              <header>
                <p>Tag search</p>
                <h5>Relationships</h5>
              </header>
              <button
                className="inventory-all-tags"
                type="button"
                aria-pressed={state.inventoryTag === "all"}
                onClick={() =>
                  dispatch({ type: "set-inventory-tag", value: "all" })
                }
              >
                <span>All tags</span>
                <small>Exact inventory point</small>
              </button>
              <div className="inventory-tag-tree-scroll">
                {tagTree.map((category) => {
                  const expanded = expandedTagCategories.has(category.id);
                  return (
                    <div key={category.id} className="tracker-tag-filter-group">
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
                          <small>Includes descendants</small>
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
            <div className="inventory-results-pane">
              <div className="inventory-result-note" role="status">
                {records.length} {records.length === 1 ? "record" : "records"}{" "}
                through {packageForEntry(state, state.inspectionPointId).name}.
              </div>
              <div className="chain-record-list">
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
                  No inventory records match these filters.
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
              {tagProjection.hiddenCount} more tags. Hover or focus to show all
              tags.
            </span>
            <span
              id={tagTooltipId}
              className="inventory-tag-overflow-tooltip"
              role="tooltip"
            >
              <strong>All tags</strong>
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
          <p>Accrued bodies</p>
          <h4>Forms</h4>
          <span>
            Through {packageForEntry(state, state.inspectionPointId).name}
          </span>
        </div>
        <HistoricalSelect
          state={state}
          dispatch={dispatch}
          label="Forms through"
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
              View
            </button>
          </article>
        ))}
      </div>
      {!forms.length && (
        <p className="chain-record-empty">
          No forms are available at this point.
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
        <p>Form record</p>
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
          Full details
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "select-form", id: null })}
        >
          Close
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
          <p>Accrued roster</p>
          <h4>Companions</h4>
          <span>
            Through {packageForEntry(state, state.inspectionPointId).name}
          </span>
        </div>
        <HistoricalSelect
          state={state}
          dispatch={dispatch}
          label="Roster through"
        />
      </header>
      {selected && (
        <section className="chain-companion-detail">
          <div>
            <p>Companion record</p>
            <h5 tabIndex={-1}>{state.actors[selected.actorId].name}</h5>
            <span>
              Joined in {packageForEntry(state, selected.sourceEntryId).name}
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
              Full profile
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "select-companion", id: null })}
            >
              Close
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
                  Joined in{" "}
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
                View
              </button>
            </article>
          );
        })}
      </div>
      {!companions.length && (
        <p className="chain-record-empty">
          No companions have joined by this point.
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
          <p>{record.kind === "perk" ? "Perk" : "Item"} details</p>
          <h4 tabIndex={0}>{record.name}</h4>
        </div>
        <button
          type="button"
          aria-label="Close perk or item details"
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
        <div className="record-detail-tags" aria-label="Tags">
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
              <dt>Quantity</dt>
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
            aria-label="Acquisition details"
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
                  Acquired in{" "}
                  {packageForEntry(state, acquisition.sourceEntryId).name}
                  {" · "}Jump {jumpNumber(state, acquisition.sourceEntryId)}
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
              <h5>Details</h5>
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
              title="Form perks"
              emptyMessage="Form has no perks"
            />
          </>
        ) : companion ? (
          <>
            <ProfileRecords
              state={state}
              ids={companion.perkRecordIds}
              dispatch={dispatch}
              title="Perks"
              emptyMessage="Companion has no perks"
            />
            <ProfileRecords
              state={state}
              ids={companion.itemRecordIds}
              dispatch={dispatch}
              title="Items"
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
          <h5>Imported into</h5>
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
          Companion has not been imported into any jumps
        </p>
      )}
    </section>
  );
}

function MutationModal({ state, dispatch }: TrackerProps) {
  if (!state.pending) return null;
  const item = packageForEntry(state, state.pending.entryId);
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
      label={`Review ${state.pending.kind}`}
      className="tracker-impact-layer"
      onClose={() => dispatch({ type: "cancel-mutation" })}
    >
      <header>
        <div>
          <p>Dependency review</p>
          <h4>
            {state.pending.kind === "move"
              ? `Reorder ${item.name}`
              : state.pending.kind === "remove"
                ? `Remove ${item.name}`
                : `Remove ${formName(state.pending.impacts[0]?.formHandle ?? "form")}`}
          </h4>
        </div>
        <button
          type="button"
          aria-label="Close dependency review"
          onClick={() => dispatch({ type: "cancel-mutation" })}
        >
          ×
        </button>
      </header>
      <div className="tracker-impact-body">
        <p>
          {state.pending.kind === "move"
            ? "This reorder would place an active dependency before the Jump that provides it."
            : state.pending.kind === "remove"
              ? "This deletion would remove a provider that a later Jump still imports. The installed package remains in the library."
              : "Removing this form also clears active perks assigned to it."}
        </p>
        <h5>Affected dependencies</h5>
        <ul>
          {state.pending.impacts.map((impact) =>
            impact.kind === "form-perk" ? (
              <li key={`${impact.kind}:${impact.formHandle}`}>
                <strong>{formName(impact.formHandle)}</strong> owns active{" "}
                {impact.dependentChoiceHandles
                  .map((handle) => choiceName(handle))
                  .join(", ")}
                .
              </li>
            ) : (
              <li
                key={`${impact.kind}:${impact.subjectId}:${impact.providerEntryId}`}
              >
                <strong>{state.actors[impact.subjectId]?.name}</strong> is
                provided by{" "}
                {packageForEntry(state, impact.providerEntryId)?.name} and
                imported by{" "}
                {impact.consumerEntryIds
                  .map((entryId) => packageForEntry(state, entryId)?.name)
                  .join(", ")}
                .
              </li>
            ),
          )}
        </ul>
        <div>
          <button
            type="button"
            onClick={() => dispatch({ type: "cancel-mutation" })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "commit-mutation" })}
          >
            {state.pending.kind === "move"
              ? "Commit reorder"
              : state.pending.kind === "remove"
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
        aria-label="Interactive Chain Tracker workspace"
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
