import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "../tracker/ChainTracker";
import { createDenseTrackerFixture } from "../tracker/fixtures";
import { StaticTagRadar } from "../tracker/TagRadar";
import {
  tagCategories,
  trackerReducer,
  type TagDefinition,
} from "../tracker/model";
import {
  exampleWorkspaceId,
  routeFromPath,
  titleForRoute,
  workspaceForRoute,
} from "./routes";
import {
  chainRegistryReducer,
  createChainRegistryFixture,
  filterSavedChains,
  normalizeChainName,
  orderedChains,
  primaryTagForChain,
  type SavedChain,
} from "./chainRegistry";
import "../../documentation/styles.css";
import "../../documentation/application-design.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/tags-design.css";
import "../../documentation/supplements-design.css";
import "../../documentation/supplements-essential.css";
import "../../documentation/supplements-personal-reality.css";
import "../../documentation/supplements-universal-drawbacks.css";
import "../supplements/review.css";
import "../tracker/review.css";
import "./shell.css";

type ShellHistoryState = { jvIndex?: number } & Record<string, unknown>;

const currentHistoryIndex = () => {
  const value = (window.history.state as ShellHistoryState | null)?.jvIndex;
  return typeof value === "number" ? value : 0;
};

export type ApplicationPreferences = {
  colorChainNamesByPrimaryTag: boolean;
};

const defaultApplicationPreferences: ApplicationPreferences = {
  colorChainNamesByPrimaryTag: false,
};

export function AppShell({
  preferences = defaultApplicationPreferences,
}: {
  preferences?: ApplicationPreferences;
} = {}) {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [historyIndex, setHistoryIndex] = useState(currentHistoryIndex);
  const [historyMaximum, setHistoryMaximum] = useState(currentHistoryIndex);
  const [trackerState, trackerDispatch] = useReducer(
    trackerReducer,
    undefined,
    createDenseTrackerFixture,
  );
  const [chainRegistry, chainRegistryDispatch] = useReducer(
    chainRegistryReducer,
    undefined,
    createChainRegistryFixture,
  );
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const route = useMemo(() => routeFromPath(pathname), [pathname]);
  const workspace = workspaceForRoute(route);
  const savedChains = useMemo(
    () => orderedChains(chainRegistry),
    [chainRegistry],
  );
  const activeChain =
    route.kind === "chain-workspace"
      ? chainRegistry.chains[route.chainId]
      : undefined;

  useEffect(() => {
    const state = (window.history.state as ShellHistoryState | null) ?? {};
    if (typeof state.jvIndex !== "number")
      window.history.replaceState({ ...state, jvIndex: 0 }, "");
    const onPopState = (event: PopStateEvent) => {
      const nextIndex =
        typeof (event.state as ShellHistoryState | null)?.jvIndex === "number"
          ? (event.state as ShellHistoryState).jvIndex!
          : 0;
      setHistoryIndex(nextIndex);
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = titleForRoute(route, activeChain?.name);
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    window.requestAnimationFrame(() => {
      mainRef.current
        ?.querySelector<HTMLElement>(
          '[data-active-route="true"] [data-route-heading]',
        )
        ?.focus();
    });
  }, [activeChain?.name, pathname, route]);

  const navigate = useCallback(
    (nextPath: string) => {
      if (window.location.pathname === nextPath) return;
      const nextIndex = historyIndex + 1;
      window.history.pushState({ jvIndex: nextIndex }, "", nextPath);
      setHistoryIndex(nextIndex);
      setHistoryMaximum(nextIndex);
      setPathname(nextPath);
    },
    [historyIndex],
  );

  const isActive = (kind: typeof route.kind) => route.kind === kind;
  const knownEditor = route.kind === "editor-workspace" && route.available;
  const missingEditor = route.kind === "editor-workspace" && !route.available;
  const knownChain =
    route.kind === "chain-workspace" && activeChain !== undefined;
  const missingChain =
    route.kind === "chain-workspace" && activeChain === undefined;

  const openChain = useCallback(
    (chain: SavedChain) => {
      chainRegistryDispatch({ type: "open", id: chain.id });
      navigate(`/chain/${chain.id}`);
    },
    [navigate],
  );

  const createChain = useCallback(
    (name: string) => {
      const normalized = normalizeChainName(name);
      if (!normalized) return false;
      const id = `ch-new-${chainRegistry.nextSerial}`;
      chainRegistryDispatch({ type: "create", id, name: normalized });
      navigate(`/chain/${id}`);
      return true;
    },
    [chainRegistry.nextSerial, navigate],
  );

  return (
    <SupplementProviders>
      <div
        className="app-shell-mockup app-primary-shell"
        aria-label="Jumpchain Visualizer application"
      >
        <header className="app-mock-header">
          <button
            className="app-mock-brand"
            type="button"
            aria-pressed={workspace === "home"}
            onClick={() => navigate("/")}
          >
            <span aria-hidden="true">JV</span>
            <strong>Jumpchain Visualizer</strong>
          </button>
          <nav aria-label="Application workspaces">
            <button
              type="button"
              aria-pressed={workspace === "editor"}
              onClick={() => navigate("/editor")}
            >
              Editor
            </button>
            <button
              type="button"
              aria-pressed={workspace === "chain"}
              onClick={() => navigate("/chain")}
            >
              Chain Tracker
            </button>
          </nav>
          <button
            className="app-mock-settings"
            type="button"
            disabled
            title="Settings are not implemented yet"
          >
            Settings
          </button>
        </header>

        <div className="app-mock-location" aria-label="Application location">
          <button
            type="button"
            aria-label="Back"
            disabled={historyIndex <= 0}
            onClick={() => window.history.back()}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Forward"
            disabled={historyIndex >= historyMaximum}
            onClick={() => window.history.forward()}
          >
            →
          </button>
          <code>{route.path}</code>
          <span>{titleForRoute(route, activeChain?.name)}</span>
        </div>

        <main ref={mainRef} className="app-mock-views app-primary-views">
          <section
            hidden={!isActive("home")}
            inert={!isActive("home") || undefined}
            data-active-route={isActive("home")}
            aria-labelledby="app-home-heading"
          >
            <p className="app-mock-kicker">Choose a workspace</p>
            <h1
              id="app-home-heading"
              className="app-route-heading"
              data-route-heading
              tabIndex={-1}
            >
              What would you like to do?
            </h1>
            <div className="app-entry-grid">
              <article>
                <span className="app-entry-icon" aria-hidden="true">
                  ✎
                </span>
                <div>
                  <h4>Build a Jump</h4>
                  <p>Create or continue a package in the Editor.</p>
                </div>
                <button type="button" onClick={() => navigate("/editor")}>
                  Open Editor
                </button>
              </article>
              <article>
                <span className="app-entry-icon" aria-hidden="true">
                  ↝
                </span>
                <div>
                  <h4>Start a Chain</h4>
                  <p>Track choices across imported jumps.</p>
                </div>
                <button type="button" onClick={() => navigate("/chain")}>
                  Open Chain Tracker
                </button>
              </article>
            </div>
            <div className="app-home-recents">
              <section
                className="app-recent-section"
                aria-labelledby="recent-editor-heading"
              >
                <h4 id="recent-editor-heading">Editor workspaces</h4>
                <div className="app-recent-work">
                  <span>
                    <strong>Example Jump</strong>
                    <small>Edited today</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/editor/${exampleWorkspaceId}`)}
                  >
                    Resume
                  </button>
                </div>
              </section>
              <section
                className="app-recent-section"
                aria-labelledby="recent-chains-heading"
              >
                <h4 id="recent-chains-heading">Chains</h4>
                <div className="app-recent-list">
                  {savedChains.slice(0, 5).map((chain) => (
                    <RecentChain
                      key={chain.id}
                      chain={chain}
                      tags={trackerState.tags}
                      colorNameByPrimaryTag={
                        preferences.colorChainNamesByPrimaryTag
                      }
                      onOpen={() => openChain(chain)}
                    />
                  ))}
                  {savedChains.length > 5 && (
                    <button
                      className="app-view-all"
                      type="button"
                      onClick={() => navigate("/chain")}
                    >
                      View all {savedChains.length} chains
                    </button>
                  )}
                </div>
              </section>
            </div>
          </section>

          <section
            hidden={!isActive("editor-hub")}
            inert={!isActive("editor-hub") || undefined}
            data-active-route={isActive("editor-hub")}
            aria-labelledby="app-editor-heading"
          >
            <p className="app-mock-kicker">Editor hub</p>
            <h1
              id="app-editor-heading"
              className="app-route-heading"
              data-route-heading
              tabIndex={-1}
            >
              Create or open a Jump package
            </h1>
            <p>
              The hub owns project creation, folder access, portable imports,
              and recent Editor workspaces. Opening a project moves to its
              addressable workspace route.
            </p>
            <div className="app-route-actions">
              <button
                type="button"
                onClick={() => navigate(`/editor/${exampleWorkspaceId}`)}
              >
                Open Example Jump
              </button>
              <a href="/documentation/editor-design.html">
                View detailed Editor design
              </a>
            </div>
          </section>

          <section
            hidden={!knownEditor}
            inert={!knownEditor || undefined}
            data-active-route={knownEditor}
            aria-labelledby="app-editor-workspace-heading"
          >
            <p className="app-mock-kicker">Editor workspace</p>
            <h1
              id="app-editor-workspace-heading"
              className="app-route-heading"
              data-route-heading
              tabIndex={-1}
            >
              Example Jump
            </h1>
            <p>
              The established three-pane Editor will mount here. The shell
              retains responsibility only for product navigation, routing, and
              application-wide services.
            </p>
            <a href="/documentation/editor-design.html">
              Open the Editor mockup
            </a>
          </section>

          <RecoveryView
            type="Editor workspace"
            hidden={!missingEditor}
            returnLabel="Return to Editor"
            onReturn={() => navigate("/editor")}
          />

          <section
            className="app-chain-hub-route"
            hidden={!isActive("chain-hub")}
            inert={!isActive("chain-hub") || undefined}
            data-active-route={isActive("chain-hub")}
            aria-labelledby="app-chain-heading"
          >
            <ChainHub
              chains={savedChains}
              tags={trackerState.tags}
              colorNamesByPrimaryTag={preferences.colorChainNamesByPrimaryTag}
              onCreate={createChain}
              onOpen={openChain}
              onUpdateDetails={(id, name, description) =>
                chainRegistryDispatch({
                  type: "update-details",
                  id,
                  name,
                  description,
                })
              }
            />
          </section>

          <section
            className="app-chain-workspace"
            hidden={!knownChain}
            inert={!knownChain || undefined}
            data-active-route={knownChain}
            aria-labelledby="app-chain-workspace-heading"
          >
            <h1
              id="app-chain-workspace-heading"
              className="sr-only"
              data-route-heading
              tabIndex={-1}
            >
              {activeChain?.name ?? "Chain"}
            </h1>
            <ChainTracker
              state={{
                ...trackerState,
                chainName: activeChain?.name ?? trackerState.chainName,
              }}
              dispatch={trackerDispatch}
              showApplicationHeader={false}
            />
          </section>

          <RecoveryView
            type="Chain"
            hidden={!missingChain}
            returnLabel="Return to Chain Tracker"
            onReturn={() => navigate("/chain")}
          />

          <section
            hidden={!isActive("not-found")}
            inert={!isActive("not-found") || undefined}
            data-active-route={isActive("not-found")}
            aria-labelledby="app-not-found-heading"
          >
            <p className="app-mock-kicker">Unknown destination</p>
            <h1
              id="app-not-found-heading"
              className="app-route-heading"
              data-route-heading
              tabIndex={-1}
            >
              Page not found
            </h1>
            <p>
              This address does not identify an available application route.
            </p>
            <div className="app-route-actions">
              <button type="button" onClick={() => navigate("/")}>
                Return Home
              </button>
            </div>
          </section>
        </main>
      </div>
    </SupplementProviders>
  );
}

function RecentChain({
  chain,
  tags,
  colorNameByPrimaryTag,
  onOpen,
}: {
  chain: SavedChain;
  tags: Record<string, TagDefinition>;
  colorNameByPrimaryTag: boolean;
  onOpen: () => void;
}) {
  const primaryTag = primaryTagForChain(chain);
  const primaryTagDefinition = primaryTag ? tags[primaryTag] : null;
  return (
    <div className="app-recent-work">
      <span>
        <strong
          className={
            colorNameByPrimaryTag && primaryTagDefinition
              ? "is-primary-tag-colored"
              : undefined
          }
          style={
            colorNameByPrimaryTag && primaryTagDefinition
              ? ({
                  "--chain-name-color": primaryTagDefinition.color,
                } as CSSProperties)
              : undefined
          }
        >
          {chain.name}
        </strong>
        <small>
          {chain.jumpCount} {chain.jumpCount === 1 ? "jump" : "jumps"} ·{" "}
          {chain.lastOpenedLabel.toLocaleLowerCase()}
        </small>
      </span>
      <button type="button" onClick={onOpen}>
        Resume
      </button>
    </div>
  );
}

function ChainHub({
  chains,
  tags,
  colorNamesByPrimaryTag,
  onCreate,
  onOpen,
  onUpdateDetails,
}: {
  chains: readonly SavedChain[];
  tags: Record<string, TagDefinition>;
  colorNamesByPrimaryTag: boolean;
  onCreate: (name: string) => boolean;
  onOpen: (chain: SavedChain) => void;
  onUpdateDetails: (id: string, name: string, description: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const visibleChains = useMemo(
    () => filterSavedChains(chains, search),
    [chains, search],
  );
  return (
    <div className="app-chain-hub-content">
      <header className="app-chain-hub-heading">
        <div>
          <p className="app-mock-kicker">Chain Tracker</p>
          <h1
            id="app-chain-heading"
            className="app-route-heading"
            data-route-heading
            tabIndex={-1}
          >
            Your chains
          </h1>
          <p>
            Resume a journey, update its details, or set out on something new.
          </p>
        </div>
        <span>
          <strong>{chains.length}</strong>
          <small>saved chains</small>
        </span>
      </header>

      <form
        className="app-new-chain"
        onSubmit={(event) => {
          event.preventDefault();
          if (onCreate(newName)) setNewName("");
        }}
      >
        <span className="app-entry-icon" aria-hidden="true">
          +
        </span>
        <div>
          <label htmlFor="new-chain-name">Start a new chain</label>
          <p>Name it now. You can edit its details from this page later.</p>
        </div>
        <input
          id="new-chain-name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Chain name"
          maxLength={80}
          required
        />
        <button type="submit">Start Chain</button>
      </form>

      <section
        className="app-saved-chains"
        aria-labelledby="saved-chains-heading"
      >
        <div className="app-saved-chains-heading">
          <div>
            <h2 id="saved-chains-heading">All saved chains</h2>
            <p>Ordered by when you last opened them.</p>
          </div>
          <label className="app-chain-search">
            <span>Search saved chains</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or description"
            />
          </label>
          <span>
            {visibleChains.length === chains.length
              ? `${chains.length} total`
              : `${visibleChains.length} of ${chains.length}`}
          </span>
        </div>
        <div className="app-chain-card-list" tabIndex={0}>
          {visibleChains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              tags={tags}
              colorNameByPrimaryTag={colorNamesByPrimaryTag}
              onOpen={() => onOpen(chain)}
              onUpdateDetails={(name, description) =>
                onUpdateDetails(chain.id, name, description)
              }
            />
          ))}
          {!visibleChains.length && (
            <div className="app-chain-empty" role="status">
              <strong>No saved chains match “{search.trim()}”.</strong>
              <span>Try a chain name or words from its description.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ChainCard({
  chain,
  tags,
  colorNameByPrimaryTag,
  onOpen,
  onUpdateDetails,
}: {
  chain: SavedChain;
  tags: Record<string, TagDefinition>;
  colorNameByPrimaryTag: boolean;
  onOpen: () => void;
  onUpdateDetails: (name: string, description: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chain.name);
  const [description, setDescription] = useState(chain.description);
  const inputRef = useRef<HTMLInputElement>(null);
  const primaryTag = primaryTagForChain(chain);
  const primaryTagDefinition = primaryTag ? tags[primaryTag] : null;
  const totalPerks = tagCategories.reduce(
    (sum, category) => sum + chain.tagCounts[category],
    0,
  );
  const summaryId = `chain-summary-${chain.id}`;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  return (
    <article className={`app-chain-card${editing ? " is-editing" : ""}`}>
      <div className="app-chain-card-avatar">
        <button
          className="app-chain-card-mark"
          type="button"
          aria-describedby={summaryId}
          aria-label={`Show ${chain.name} tag summary`}
        >
          {chain.name.slice(0, 1).toUpperCase()}
        </button>
        <div id={summaryId} className="app-chain-tag-summary" role="tooltip">
          <header>
            <div>
              <span>Perk profile</span>
              <strong>{chain.name}</strong>
            </div>
            <span>{totalPerks} tagged perks</span>
          </header>
          <StaticTagRadar
            counts={chain.tagCounts}
            tags={tags}
            label={`${chain.name} perk category radar`}
          />
          <p>
            {primaryTagDefinition
              ? `Strongest category: ${primaryTagDefinition.label} with ${chain.tagCounts[primaryTag!]} perks.`
              : "No tagged perks yet."}
          </p>
        </div>
      </div>
      <div className="app-chain-card-copy">
        {editing ? (
          <form
            className="app-edit-chain"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeChainName(name);
              if (!normalized) return;
              onUpdateDetails(normalized, description);
              setName(normalized);
              setEditing(false);
            }}
          >
            <label htmlFor={`rename-${chain.id}`}>Chain name</label>
            <input
              ref={inputRef}
              id={`rename-${chain.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
            <label htmlFor={`description-${chain.id}`}>Description</label>
            <textarea
              id={`description-${chain.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
              rows={2}
              placeholder="Describe this chain"
            />
            <button type="submit">Save</button>
            <button
              type="button"
              onClick={() => {
                setName(chain.name);
                setDescription(chain.description);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h3
              data-primary-tag={primaryTag ?? undefined}
              style={
                colorNameByPrimaryTag && primaryTagDefinition
                  ? ({
                      "--chain-name-color": primaryTagDefinition.color,
                    } as CSSProperties)
                  : undefined
              }
              className={
                colorNameByPrimaryTag && primaryTagDefinition
                  ? "is-primary-tag-colored"
                  : undefined
              }
            >
              {chain.name}
            </h3>
            <p>{chain.description}</p>
          </>
        )}
        <small>{chain.lastOpenedLabel}</small>
      </div>
      <dl>
        <div>
          <dt>Jumps</dt>
          <dd>{chain.jumpCount}</dd>
        </div>
      </dl>
      {!editing && (
        <div className="app-chain-card-actions">
          <button type="button" onClick={onOpen}>
            Open
          </button>
          <button
            type="button"
            aria-label={`Edit ${chain.name}`}
            onClick={() => setEditing(true)}
          >
            Edit details
          </button>
        </div>
      )}
    </article>
  );
}

function RecoveryView({
  type,
  hidden,
  returnLabel,
  onReturn,
}: {
  type: "Editor workspace" | "Chain";
  hidden: boolean;
  returnLabel: string;
  onReturn: () => void;
}) {
  return (
    <section
      hidden={hidden}
      inert={hidden || undefined}
      data-active-route={!hidden}
      aria-labelledby={`app-${type === "Chain" ? "chain" : "editor"}-recovery-heading`}
    >
      <p className="app-mock-kicker">Recovery</p>
      <h1
        id={`app-${type === "Chain" ? "chain" : "editor"}-recovery-heading`}
        className="app-route-heading"
        data-route-heading
        tabIndex={-1}
      >
        {type} unavailable
      </h1>
      <p>
        The requested local record could not be restored. Its identifier was not
        replaced with another workspace or exposed as user data.
      </p>
      <div className="app-route-actions">
        <button type="button" onClick={onReturn}>
          {returnLabel}
        </button>
      </div>
    </section>
  );
}
