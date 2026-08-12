import { useCallback, useRef, useState } from "react";
import { ModulePage } from "./ModulePages";
import { SupplementDialog } from "./Dialogs";
import { BodyModProvider } from "./BodyModContext";
import { SupplementStateProvider } from "./SupplementStateContext";
import { handleRovingTabKeyDown } from "../ui/rovingTabs";
import { supplementTools } from "./toolCatalog";
import {
  hasEnabledSupplements,
  initialEnabled,
  modules,
  setModuleEnabled,
  type EnabledModules,
  type ModuleId,
  type ToolId,
} from "./model";
import "../../documentation/assets/styles.css";
import "../../documentation/development/chain-tracker-design.css";
import "../../documentation/development/supplements-design.css";
import "../../documentation/development/supplements-essential.css";
import "../../documentation/development/supplements-personal-reality.css";
import "../../documentation/development/supplements-universal-drawbacks.css";
import "../../documentation/development/supplements-limited-inheritance.css";
import "../../documentation/development/supplements-typography.css";
import type { InheritanceCandidate } from "./limitedInheritance";

const reviewInheritanceCandidates: readonly InheritanceCandidate[] = [
  {
    id: "record:review-perk",
    kind: "perk",
    sourceEntryId: "entry-1",
    entityId: "review-perk",
    name: "Gate Scholar",
    description: "A current-Jump perk that can continue through the chain.",
    tags: [],
    bundledRecordIds: ["review-perk"],
  },
  {
    id: "record:review-item",
    kind: "item",
    sourceEntryId: "entry-1",
    entityId: "review-item",
    name: "Traveler's Pack",
    description: "A current-Jump item with its complete acquired quantity.",
    tags: [],
    bundledRecordIds: ["review-item"],
  },
  {
    id: "companion:review-companion",
    kind: "companion",
    sourceEntryId: "entry-1",
    entityId: "review-companion",
    name: "Lyra",
    description: "A companion bundled with attached acquisitions.",
    tags: [],
    bundledRecordIds: ["review-companion-perk"],
  },
  {
    id: "form:review-form",
    kind: "form",
    sourceEntryId: "entry-1",
    entityId: "review-form",
    name: "Prism Form",
    description: "A form bundled with every attached record.",
    tags: [],
    bundledRecordIds: ["review-form-perk"],
  },
];
import "./review.css";

type PageId = "manage" | ModuleId;

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
function MainTabs({ active }: { active: "jump" | "supplements" }) {
  return (
    <div
      className="chain-main-tabs"
      role="tablist"
      aria-label="Chain workspace page"
    >
      <button type="button" role="tab" aria-selected={active === "jump"}>
        Chain &amp; Jump
      </button>
      <button type="button" role="tab" aria-selected="false" tabIndex={-1}>
        Inventory <span>5</span>
      </button>
      <button type="button" role="tab" aria-selected="false" tabIndex={-1}>
        Forms <span>2</span>
      </button>
      <button type="button" role="tab" aria-selected="false" tabIndex={-1}>
        Companions <span>2</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "supplements"}
        tabIndex={active === "supplements" ? 0 : -1}
      >
        Supplements
      </button>
    </div>
  );
}

function JumpScenario({
  enabled,
  openPage,
}: {
  enabled: EnabledModules;
  openPage: (id: ModuleId) => void;
}) {
  const [menuConfiguration, setMenuConfiguration] = useState<string | null>(
    null,
  );
  const [selectedTool, setSelectedTool] = useState<ToolId>("body");
  const availableTools = supplementTools.filter((tool) => enabled[tool.module]);
  const activeTool = availableTools.some((tool) => tool.id === selectedTool)
    ? selectedTool
    : availableTools[0]?.id;
  const suppButton = useRef<HTMLButtonElement>(null);
  const hasSupplements = hasEnabledSupplements(enabled);
  const enabledSignature = availableTools.map((tool) => tool.id).join("|");
  const menu = hasSupplements && menuConfiguration === enabledSignature;
  const closeMenu = () => {
    setMenuConfiguration(null);
    window.setTimeout(
      () => document.getElementById("review-open-supp")?.focus(),
      50,
    );
  };
  const openMenu = () => {
    setMenuConfiguration(enabledSignature);
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            "#review-supp-context nav [aria-pressed='true']",
          )
          ?.focus(),
      50,
    );
  };
  return (
    <div
      className="chain-mockup review-chain"
      aria-label="Chain and Jump contextual supplement scenario"
    >
      <ChainHeader />
      <MainTabs active="jump" />
      <div className="chain-page-stack">
        <section className="chain-workspace-page chain-jump-page">
          <aside className="chain-rail" aria-label="Chain and jump library">
            <div
              className="chain-rail-tabs"
              role="tablist"
              aria-label="Chain navigation"
            >
              <button type="button" role="tab" aria-selected="true">
                Chain
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="false"
                tabIndex={-1}
              >
                Library
              </button>
            </div>
            <section className="chain-rail-panel">
              <header>
                <div>
                  <p>Morgan&apos;s Chain</p>
                  <strong>3 Jumps</strong>
                </div>
                <div className="chain-rail-header-actions">
                  {hasSupplements && (
                    <button
                      id="review-open-supp"
                      ref={suppButton}
                      type="button"
                      aria-expanded={menu}
                      aria-controls="review-supp-context"
                      onClick={openMenu}
                    >
                      Supp
                    </button>
                  )}
                  <button type="button">+ Add</button>
                </div>
              </header>
              <dl className="chain-jump-summary">
                <div>
                  <dt>Currency</dt>
                  <dd>1000 CP</dd>
                </div>
                <div>
                  <dt>Origin</dt>
                  <dd>Not selected</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>Female</dd>
                </div>
                <div>
                  <dt>Age</dt>
                  <dd>24</dd>
                </div>
              </dl>
              <div className="chain-jump-list">
                <article className="chain-jump-card">
                  <span>Jump 3</span>
                  <strong>Cosmic Odyssey</strong>
                  <small>Version 2.1 · Built-in</small>
                </article>
                <article className="chain-jump-card is-current">
                  <span>Jump 2</span>
                  <strong>Arcane Realms</strong>
                  <small>Version 1.0 · Imported</small>
                </article>
                <article className="chain-jump-card">
                  <span>Jump 1</span>
                  <strong>First Step</strong>
                  <small>Version 1.0 · Built-in</small>
                </article>
              </div>
            </section>
          </aside>
          <div className="chain-jump-workspace">
            <header className="chain-context-header">
              <div>
                <p>Jump 2 of 3</p>
                <h3>Arcane Realms</h3>
                <span>Version 1.0 · Imported package · 2 choices</span>
              </div>
              <label className="chain-actor-control">
                <span>Make choices as</span>
                <select>
                  <option>Morgan · Jumper</option>
                </select>
              </label>
            </header>
            <div className="chain-view-panel">
              <div className="shared-renderer-label">
                <span>Shared Jump renderer</span>
                <small>Persistent chain state</small>
              </div>
              <article className="shared-jump-renderer">
                <header>
                  <div>
                    <p>Current Jump</p>
                    <h4>Arcane Realms</h4>
                    <span>
                      Build a life in a world of spellcraft and ancient
                      kingdoms.
                    </span>
                  </div>
                  <div className="tracker-budget">
                    <span>Available</span>
                    <output>1000 CP</output>
                  </div>
                </header>
                <section className="tracker-render-section">
                  <div>
                    <p>Origin</p>
                    <h5>Choose your beginning</h5>
                  </div>
                  <div className="tracker-choice-grid">
                    <button className="tracker-choice" type="button">
                      <span>
                        <strong>Wanderer</strong>
                        <small>Free</small>
                      </span>
                      <p>You arrive without local ties.</p>
                    </button>
                    <button className="tracker-choice" type="button">
                      <span>
                        <strong>Noble</strong>
                        <small>100 CP</small>
                      </span>
                      <p>You begin with status and obligations.</p>
                    </button>
                  </div>
                </section>
              </article>
            </div>
          </div>
          {menu && (
            <section
              id="review-supp-context"
              className="chain-supp-context"
              role="dialog"
              aria-modal="false"
              aria-label="Arcane Realms current-Jump supplements"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeMenu();
                }
              }}
            >
              <header>
                <div>
                  <p>Current-Jump supplements</p>
                  <h4>Arcane Realms</h4>
                </div>
                <button
                  type="button"
                  aria-label="Close current-Jump supplements"
                  onClick={closeMenu}
                >
                  ×
                </button>
              </header>
              <div className="chain-supp-context-layout">
                <nav aria-label="Enabled supplement tools">
                  {availableTools.map((tool, index) => (
                    <button
                      type="button"
                      key={tool.id}
                      aria-pressed={activeTool === tool.id}
                      onClick={() => setSelectedTool(tool.id)}
                      onKeyDown={(event) => {
                        let next: number;
                        if (event.key === "ArrowDown")
                          next = (index + 1) % availableTools.length;
                        else if (event.key === "ArrowUp")
                          next =
                            (index - 1 + availableTools.length) %
                            availableTools.length;
                        else if (event.key === "Home") next = 0;
                        else if (event.key === "End")
                          next = availableTools.length - 1;
                        else return;
                        event.preventDefault();
                        setSelectedTool(availableTools[next].id);
                        (
                          event.currentTarget.parentElement?.children[next] as
                            HTMLElement | undefined
                        )?.focus();
                      }}
                    >
                      <strong>{tool.name}</strong>
                      <span>{tool.job}</span>
                    </button>
                  ))}
                </nav>
                <div className="chain-supp-context-content">
                  {availableTools.map((tool) => (
                    <div
                      className="review-embedded-tool"
                      key={tool.id}
                      hidden={activeTool !== tool.id}
                    >
                      <SupplementDialog
                        tool={tool.id}
                        embedded
                        close={closeMenu}
                        inheritanceCandidates={reviewInheritanceCandidates}
                        openPage={(id) => {
                          closeMenu();
                          openPage(id);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

function Manage({
  enabled,
  change,
  open,
}: {
  enabled: EnabledModules;
  change: (id: ModuleId, value: boolean) => void;
  open: (id: ModuleId) => void;
}) {
  return (
    <section className="supplement-subpage" role="tabpanel">
      <header>
        <p>Supplement library</p>
        <h4>Manage supplements</h4>
        <span>
          Supported modules remain listed; enabled modules receive pages and
          current-Jump tools.
        </span>
      </header>
      <div className="supplement-manage-list">
        {modules.map((module) => (
          <article key={module.id}>
            <div>
              <strong>{module.name}</strong>
              <p>{module.description}</p>
            </div>
            <label>
              <input
                type="checkbox"
                checked={enabled[module.id]}
                onChange={(event) => change(module.id, event.target.checked)}
              />
              <span>Enabled</span>
            </label>
            <button
              type="button"
              disabled={!enabled[module.id]}
              onClick={() => open(module.id)}
            >
              Open page
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkspaceScenario({
  enabled,
  setEnabled,
  page,
  setPage,
}: {
  enabled: EnabledModules;
  setEnabled: (value: EnabledModules) => void;
  page: PageId;
  setPage: (value: PageId) => void;
}) {
  const pages = [
    { id: "manage" as const, label: "Manage" },
    ...modules
      .filter((module) => enabled[module.id])
      .map((module) => ({ id: module.id, label: module.shortName })),
  ];
  const activate = (id: PageId) => setPage(id);
  return (
    <div
      className="chain-mockup review-chain review-workspace"
      aria-label="Chain Tracker Supplements workspace scenario"
    >
      <ChainHeader />
      <MainTabs active="supplements" />
      <div className="chain-page-stack">
        <section className="chain-workspace-page chain-view-panel chain-supplement-page">
          <div
            className="supplement-tabs"
            role="tablist"
            aria-label="Supplement pages"
            onKeyDown={(event) =>
              handleRovingTabKeyDown(
                event,
                pages.map((item) => item.id),
                page,
                activate,
              )
            }
          >
            {pages.map((item) => (
              <button
                type="button"
                role="tab"
                key={item.id}
                aria-selected={page === item.id}
                tabIndex={page === item.id ? 0 : -1}
                onClick={() => activate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div hidden={page !== "manage"}>
            <Manage
              enabled={enabled}
              change={(id, value) => {
                const next = setModuleEnabled(enabled, id, value);
                setEnabled(next);
                if (!next[page as ModuleId]) setPage("manage");
              }}
              open={setPage}
            />
          </div>
          {modules.map((module) => (
            <section
              key={module.id}
              className="supplement-subpage review-module-page"
              role="tabpanel"
              hidden={page !== module.id}
            >
              <ModulePage id={module.id} />
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}

export function ReviewSupplements() {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [page, setPage] = useState<PageId>("manage");
  const openPage = useCallback((id: ModuleId) => {
    setPage(id);
    document
      .querySelector(
        '[aria-label="Chain Tracker Supplements workspace scenario"]',
      )
      ?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <BodyModProvider>
      <SupplementStateProvider>
        <main className="supplement-review">
          <section className="review-scenario">
            <h1>Chain &amp; Jump · Supplements</h1>
            <JumpScenario enabled={enabled} openPage={openPage} />
          </section>
          <section className="review-scenario">
            <h2>Chain Tracker · Supplements workspace</h2>
            <WorkspaceScenario
              enabled={enabled}
              setEnabled={setEnabled}
              page={page}
              setPage={setPage}
            />
          </section>
        </main>
      </SupplementStateProvider>
    </BodyModProvider>
  );
}
