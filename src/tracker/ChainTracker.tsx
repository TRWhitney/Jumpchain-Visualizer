import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  TrackerSupplementContext,
  TrackerSupplementWorkspace,
  type SupplementPageId,
} from "../supplements/TrackerSupplements";
import {
  hasEnabledSupplements,
  initialEnabled,
  type EnabledModules,
  type ModuleId,
} from "../supplements/model";
import { TagBadge, TagRadar } from "./TagRadar";
import {
  filteredInventory,
  packageForEntry,
  tagCategories,
  trackerPages,
  visibleCompanions,
  visibleForms,
  type FormRecord,
  type InventoryRecord,
  type TrackerAction,
  type TrackerPage,
  type TrackerState,
} from "./model";

const pageLabels: Record<TrackerPage, string> = {
  jump: "Chain & Jump",
  inventory: "Inventory",
  forms: "Forms",
  companions: "Companions",
  supplements: "Supplements",
};

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
          return (
            <option key={id} value={id}>
              {state.order.indexOf(id) + 1}. {item.name} · v{item.version}
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
  children,
}: {
  label: string;
  className: string;
  onClose: () => void;
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
      className={className}
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
  setActorId,
}: TrackerProps & {
  enabled: EnabledModules;
  openSupp: () => void;
  actorId: string;
  setActorId: (id: string) => void;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const selected = state.entries[state.selectedEntryId];
  const actor = state.actors[actorId] ?? state.actors.jumper;
  const balance = selected.actorBalances[actor.id] ?? 0;
  const filteredPackages = Object.values(state.packages).filter((item) => {
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
              <strong>{state.order.length} Jumps</strong>
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
                  <span>
                    {actorId === "jumper" ? "50 MP · Mana" : "4 Research Marks"}
                  </span>
                  <span>3 Renown</span>
                  <span>2 Destiny Tokens</span>
                </span>
              </dd>
            </div>
            <div className="chain-summary-hover chain-summary-origin">
              <dt>Origin</dt>
              <dd tabIndex={0}>
                <span>{selected.origin}</span>
                <span className="chain-summary-tooltip" role="tooltip">
                  <strong>{selected.origin}</strong>
                  <span>
                    A selected background with fixture-specific history.
                  </span>
                  <span>Location: {selected.location ?? "None selected"}</span>
                </span>
              </dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{actor.gender}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{actor.age}</dd>
            </div>
          </dl>
          <div
            className="chain-jump-list"
            aria-label="Ordered chain jumps, newest first"
          >
            {[...state.order].reverse().map((id) => {
              const entry = state.entries[id];
              const item = packageForEntry(state, id);
              const index = state.order.indexOf(id);
              const negative = Object.values(entry.actorBalances).some(
                (value) => value < 0,
              );
              return (
                <article
                  key={id}
                  className={`chain-jump-entry${state.selectedEntryId === id ? " is-selected" : ""}${negative ? " has-negative-balance" : ""}`}
                  draggable
                  onDragStart={(event) => {
                    setDragged(id);
                    event.dataTransfer.setData("text/plain", id);
                  }}
                  onDragOver={(event) => {
                    if (dragged && dragged !== id) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged && dragged !== id)
                      dispatch({
                        type: "request-move",
                        entryId: dragged,
                        toIndex: index,
                      });
                    setDragged(null);
                  }}
                  onDragEnd={() => setDragged(null)}
                >
                  <span
                    className="chain-jump-handle"
                    title="Drag to reorder"
                    aria-hidden="true"
                  >
                    ⠿
                  </span>
                  <button
                    type="button"
                    className="chain-jump-select"
                    aria-pressed={state.selectedEntryId === id}
                    onClick={() => {
                      dispatch({ type: "select-entry", entryId: id });
                      const ids = Object.keys(entry.actorBalances);
                      if (!ids.includes(actorId)) setActorId("jumper");
                    }}
                  >
                    <span>
                      {index + 1}. {item.name} · v{item.version}
                    </span>
                    <small>
                      {item.source === "builtin" ? "Built-in" : "Imported"} ·{" "}
                      {entry.status}
                    </small>
                  </button>
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
                      disabled={index === 0}
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
                      disabled={state.order.length <= 1}
                      aria-label={`Remove ${item.name} from the chain`}
                      onClick={() =>
                        dispatch({ type: "request-remove", entryId: id })
                      }
                    >
                      ×
                    </button>
                  </div>
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
              const existing = state.order.find(
                (id) => state.entries[id].packageId === item.id,
              );
              return (
                <article key={item.id} className="chain-library-card">
                  <div>
                    <strong>
                      {item.name} · v{item.version}
                    </strong>
                    <small>
                      {item.source === "builtin" ? "Built-in" : "Imported"} ·{" "}
                      {item.description}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "add-package", packageId: item.id })
                    }
                  >
                    {existing ? "Open chain entry" : "Add to chain"}
                  </button>
                </article>
              );
            })}
          </div>
          {!filteredPackages.length && (
            <p className="chain-empty">No available jumps match this filter.</p>
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
  setSupplementPage,
  jumpRenderer,
}: TrackerProps & {
  enabled: EnabledModules;
  setSupplementPage: (page: SupplementPageId) => void;
  jumpRenderer?: ReactNode;
}) {
  const [suppOpen, setSuppOpen] = useState(false);
  const [actorId, setActorId] = useState("jumper");
  const selected = state.entries[state.selectedEntryId];
  const item = packageForEntry(state, state.selectedEntryId);
  const actorIds = Object.keys(selected.actorBalances);
  const activeActorId = actorIds.includes(actorId) ? actorId : "jumper";
  const balance = selected.actorBalances[activeActorId] ?? 0;
  const negativeActors = actorIds.filter(
    (id) => (selected.actorBalances[id] ?? 0) < 0,
  );
  return (
    <section className="chain-workspace-page chain-jump-page" role="tabpanel">
      <ChainRail
        state={state}
        dispatch={dispatch}
        enabled={enabled}
        openSupp={() => setSuppOpen(true)}
        actorId={actorId}
        setActorId={setActorId}
      />
      <div className="chain-jump-workspace">
        <header className="chain-context-header">
          <div>
            <p>
              Jump {state.order.indexOf(state.selectedEntryId) + 1} of{" "}
              {state.order.length}
            </p>
            <h3>{item.name}</h3>
            <span>
              Version {item.version} ·{" "}
              {item.source === "builtin" ? "Built-in" : "Imported"} package ·{" "}
              {selected.status}
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
          <label className="chain-actor-control">
            <span>Make choices as</span>
            <select
              value={activeActorId}
              className={balance < 0 ? "has-negative-actor" : undefined}
              onChange={(event) => setActorId(event.target.value)}
            >
              {actorIds.map((id) => (
                <option key={id} value={id}>
                  {selected.actorBalances[id] < 0 ? "⚠ " : ""}
                  {state.actors[id]?.name ?? id} ·{" "}
                  {state.actors[id]?.role ?? "Companion"}
                  {selected.actorBalances[id] < 0
                    ? ` · ${selected.actorBalances[id]} CP`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </header>
        {jumpRenderer ?? (
          <div className="chain-view-panel tracker-renderer-placeholder">
            <div className="shared-renderer-label">
              <span>Shared Jump renderer</span>
              <small>Deferred in this implementation pass</small>
            </div>
            <article className="shared-jump-renderer">
              <header>
                <div>
                  <p>
                    Current Jump ·{" "}
                    {item.source === "builtin" ? "Built-in" : "Imported"}
                  </p>
                  <h4>{item.name}</h4>
                  <span>{item.description}</span>
                </div>
                <div className="tracker-budget">
                  <span>Available</span>
                  <output className={balance < 0 ? "is-negative" : undefined}>
                    {balance} CP
                  </output>
                </div>
              </header>
              <section className="tracker-placeholder-panel">
                <p>Renderer boundary</p>
                <h5>Jump rendering is not connected yet</h5>
                <span>
                  The tracker already preserves selected-entry identity, actor
                  context, balances, chronology, history, and supplement
                  projections. The shared package renderer will occupy this
                  frame in its own feature pass.
                </span>
                {balance < 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "resolve-deficit",
                        actorId: activeActorId,
                      })
                    }
                  >
                    Clear fixture deficit
                  </button>
                )}
              </section>
            </article>
          </div>
        )}
      </div>
      {suppOpen && (
        <TrackerSupplementContext
          jumpName={item.name}
          enabled={enabled}
          onClose={() => {
            setSuppOpen(false);
            window.setTimeout(
              () => document.getElementById("tracker-open-supp")?.focus(),
              20,
            );
          }}
          onOpenPage={(id: ModuleId) => {
            setSupplementPage(id);
            dispatch({ type: "set-page", page: "supplements" });
          }}
        />
      )}
    </section>
  );
}

function InventoryPage({ state, dispatch }: TrackerProps) {
  const records = filteredInventory(state);
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
        <section className="inventory-subpage" role="tabpanel">
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
                type="button"
                aria-pressed={state.inventoryTag === "all"}
                onClick={() =>
                  dispatch({ type: "set-inventory-tag", value: "all" })
                }
              >
                <span>All tags</span>
                <small>Exact inventory point</small>
              </button>
              {tagCategories.map((category) => (
                <div key={category} className="tracker-tag-filter-group">
                  <button
                    type="button"
                    aria-pressed={state.inventoryTag === category}
                    onClick={() =>
                      dispatch({ type: "set-inventory-tag", value: category })
                    }
                  >
                    <span>◆ {state.tags[category].label}</span>
                    <small>Includes descendants</small>
                  </button>
                  {Object.values(state.tags)
                    .filter((tag) => tag.parent === category)
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={state.inventoryTag === tag.id}
                        onClick={() =>
                          dispatch({ type: "set-inventory-tag", value: tag.id })
                        }
                      >
                        <span>└ {tag.label}</span>
                        <small>
                          {tag.aliases[0]
                            ? `Alias: ${tag.aliases[0]}`
                            : "Exact tag"}
                        </small>
                      </button>
                    ))}
                </div>
              ))}
            </aside>
            <div>
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
          {record.kind === "perk" ? "Perk" : "Item"} · {item.name}
        </p>
        <h5>{record.name}</h5>
      </div>
      <div>
        {record.tags
          .slice(0, 3)
          .map(
            (id) =>
              state.tags[id] && <TagBadge key={id} tag={state.tags[id]} />,
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

function RecordModal({ state, dispatch }: TrackerProps) {
  const record = state.records.find(
    (item) => item.id === state.selectedRecordId,
  );
  if (!record) return null;
  return (
    <FocusModal
      label={`${record.kind} details: ${record.name}`}
      className="record-detail-layer"
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
          Acquired in {packageForEntry(state, record.sourceEntryId).name}
          {record.ownerActorId !== "jumper"
            ? ` · ${state.actors[record.ownerActorId].name} record`
            : ""}
        </p>
        <div className="record-detail-tags" aria-label="Tags">
          {record.tags.map(
            (id) =>
              state.tags[id] && <TagBadge key={id} tag={state.tags[id]} />,
          )}
        </div>
        <h5>Description</h5>
        <p>{record.description}</p>
      </div>
    </FocusModal>
  );
}

function ProfileModal({ state, dispatch }: TrackerProps) {
  if (!state.activeProfile) return null;
  const isForm = state.activeProfile === "form";
  const form = state.forms.find((item) => item.id === state.selectedFormId);
  const companion = state.companions.find(
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
            />
          </>
        ) : companion ? (
          <>
            <ProfileRecords
              state={state}
              ids={companion.perkRecordIds}
              dispatch={dispatch}
              title="Perks"
            />
            <ProfileRecords
              state={state}
              ids={companion.itemRecordIds}
              dispatch={dispatch}
              title="Items"
            />
            <section>
              <h5>Imported into</h5>
              <ul>
                {companion.importedEntryIds.map(
                  (id) =>
                    state.entries[id] && (
                      <li key={id}>{packageForEntry(state, id).name}</li>
                    ),
                )}
              </ul>
            </section>
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
}: {
  state: TrackerState;
  ids: readonly string[];
  dispatch: Dispatch<TrackerAction>;
  title: string;
}) {
  return (
    <section>
      <h5>{title}</h5>
      <ul>
        {ids.map((id) => {
          const record = state.records.find((item) => item.id === id);
          return record ? (
            <li key={id}>
              <button
                type="button"
                onClick={() => dispatch({ type: "open-record", id })}
              >
                {record.name}
              </button>
            </li>
          ) : null;
        })}
      </ul>
    </section>
  );
}

function MutationModal({ state, dispatch }: TrackerProps) {
  if (!state.pending) return null;
  const item = packageForEntry(state, state.pending.entryId);
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
              : `Remove ${item.name}`}
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
            : "This deletion would remove a provider that a later Jump still imports. The installed package remains in the library."}
        </p>
        <h5>Affected dependencies</h5>
        <ul>
          {state.pending.impacts.map((impact) => (
            <li
              key={`${impact.kind}:${impact.subjectId}:${impact.providerEntryId}`}
            >
              <strong>{state.actors[impact.subjectId]?.name}</strong> is
              provided by {packageForEntry(state, impact.providerEntryId)?.name}{" "}
              and imported by{" "}
              {impact.consumerEntryIds
                .map((entryId) => packageForEntry(state, entryId)?.name)
                .join(", ")}
              .
            </li>
          ))}
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
            {state.pending.kind === "move" ? "Commit reorder" : "Remove Jump"}
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
}: TrackerProps & { jumpRenderer?: ReactNode }) {
  const [enabled, setEnabled] = useState<EnabledModules>(initialEnabled);
  const [supplementPage, setSupplementPage] =
    useState<SupplementPageId>("manage");
  const selectedRecord = state.selectedRecordId !== null;
  return (
    <div
      className="chain-mockup tracker-review-frame"
      aria-label="Interactive Chain Tracker workspace"
    >
      <ChainHeader />
      <MainTabs state={state} dispatch={dispatch} />
      <div className="chain-page-stack">
        {state.page === "jump" && (
          <JumpPage
            state={state}
            dispatch={dispatch}
            enabled={enabled}
            setSupplementPage={setSupplementPage}
            jumpRenderer={jumpRenderer}
          />
        )}
        {state.page === "inventory" && (
          <InventoryPage state={state} dispatch={dispatch} />
        )}
        {state.page === "forms" && (
          <FormsPage state={state} dispatch={dispatch} />
        )}
        {state.page === "companions" && (
          <CompanionsPage state={state} dispatch={dispatch} />
        )}
        {state.page === "supplements" && (
          <TrackerSupplementWorkspace
            enabled={enabled}
            onEnabledChange={setEnabled}
            page={supplementPage}
            onPageChange={setSupplementPage}
          />
        )}
      </div>
      {state.undo && (
        <div className="tracker-undo" role="status">
          <span>{state.undo.label} complete.</span>
          <button type="button" onClick={() => dispatch({ type: "undo" })}>
            Undo
          </button>
        </div>
      )}
      <MutationModal state={state} dispatch={dispatch} />
      <div
        aria-hidden={selectedRecord && state.activeProfile ? "true" : undefined}
        inert={selectedRecord && state.activeProfile ? true : undefined}
      >
        <ProfileModal state={state} dispatch={dispatch} />
      </div>
      <RecordModal state={state} dispatch={dispatch} />
    </div>
  );
}
