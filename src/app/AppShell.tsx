import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type CSSProperties,
} from "react";
import { SettingsSurface } from "../settings/SettingsSurface";
import { useOptionalSettings, useSettings } from "../settings/SettingsContext";
import type { SettingsCategory } from "../settings/model";
import { SettingsProvider } from "../settings/SettingsProvider";
import { MemorySettingsRepository } from "../settings/repository";
import { projectTagDefinitions } from "../settings/tagProfile";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "../tracker/ChainTracker";
import {
  createBlankTrackerFixture,
  createDenseTrackerFixture,
  createSampleTrackerFixture,
} from "../tracker/fixtures";
import { StaticTagRadar } from "../tracker/TagRadar";
import {
  tagCategories,
  trackerReducer,
  choiceMutationWasBlocked,
  type TrackerAction,
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
import {
  aggregateFromTracker,
  applyAggregate,
  createPlatformChainRepository,
} from "../tracker/repository";
import type { TrackerState } from "../tracker/model";
import { evaluateTracker } from "../tracker/evaluateTracker";
import "../../documentation/styles.css";
import "../../documentation/application-design.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/choice-rendering-design.css";
import "../tracker/jumpRenderer.css";
import "../../documentation/settings-design.css";
import "../../documentation/logging-design.css";
import "../../documentation/tags-design.css";
import "../../documentation/supplements-design.css";
import "../../documentation/supplements-essential.css";
import "../../documentation/supplements-personal-reality.css";
import "../../documentation/supplements-universal-drawbacks.css";
import "../supplements/review.css";
import "../tracker/review.css";
import "./shell.css";

type ShellHistoryState = {
  jvIndex?: number;
  settingsBackgroundPath?: string;
} & Record<string, unknown>;

const currentHistoryIndex = () => {
  const value = (window.history.state as ShellHistoryState | null)?.jvIndex;
  return typeof value === "number" ? value : 0;
};

export function AppShell() {
  const context = useOptionalSettings();
  const repository = useMemo(() => new MemorySettingsRepository(), []);
  if (!context)
    return (
      <SettingsProvider repository={repository}>
        <AppShellContent />
      </SettingsProvider>
    );
  return <AppShellContent />;
}

function AppShellContent() {
  const { settings, logger } = useSettings();
  const [pathname, setPathname] = useState(window.location.pathname);
  const [settingsBackgroundPath, setSettingsBackgroundPath] = useState<
    string | null
  >(() => {
    const state = window.history.state as ShellHistoryState | null;
    return window.location.pathname === "/settings" &&
      typeof state?.settingsBackgroundPath === "string"
      ? state.settingsBackgroundPath
      : null;
  });
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory>("general");
  const [historyIndex, setHistoryIndex] = useState(currentHistoryIndex);
  const [historyMaximum, setHistoryMaximum] = useState(currentHistoryIndex);
  const [chainRegistry, chainRegistryDispatch] = useReducer(
    chainRegistryReducer,
    undefined,
    createChainRegistryFixture,
  );
  const chainRepository = useMemo(() => createPlatformChainRepository(), []);
  const [chainStates, setChainStates] = useState<Record<string, TrackerState>>(
    () =>
      Object.fromEntries(
        Object.values(createChainRegistryFixture().chains).map(
          (chain, index) => [
            chain.id,
            index === 0
              ? { ...createDenseTrackerFixture(), chainName: chain.name }
              : createSampleTrackerFixture(
                  chain.name,
                  chain.jumpCount,
                  index * 2,
                ),
          ],
        ),
      ),
  );
  const chainStatesRef = useRef(chainStates);
  const [chainSaveError, setChainSaveError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const restoreSettingsFocus = useRef(false);
  const previousPathname = useRef(pathname);
  const route = useMemo(() => routeFromPath(pathname), [pathname]);
  const backgroundRoute = useMemo(
    () =>
      route.kind === "settings"
        ? routeFromPath(settingsBackgroundPath ?? "/")
        : route,
    [route, settingsBackgroundPath],
  );
  const workspace = workspaceForRoute(backgroundRoute);
  const savedChains = useMemo(
    () =>
      orderedChains(chainRegistry).map((chain) => {
        const value = chainStates[chain.id];
        if (!value) return chain;
        const evaluation = evaluateTracker(
          value,
          value.enabledSupplements["body-mod"] ? value.bodyMod : null,
        );
        const tagCounts = Object.fromEntries(
          tagCategories.map((category) => [
            category,
            evaluation.records.filter((record) =>
              record.tags.some((tag) => {
                let current: string | undefined = tag;
                while (current) {
                  if (current === category) return true;
                  current = value.tags[current]?.parent;
                }
                return false;
              }),
            ).length,
          ]),
        ) as SavedChain["tagCounts"];
        return {
          ...chain,
          jumpCount: value.order.filter(
            (entryId) => value.entries[entryId]?.kind === "jump",
          ).length,
          tagCounts,
        };
      }),
    [chainRegistry, chainStates],
  );
  const activeChain =
    backgroundRoute.kind === "chain-workspace"
      ? chainRegistry.chains[backgroundRoute.chainId]
      : undefined;
  const activeChainId = activeChain?.id ?? "ch-92b1";
  const trackerState =
    chainStates[activeChainId] ?? createBlankTrackerFixture(activeChain?.name);
  const projectedTags = useMemo(
    () => projectTagDefinitions(settings.tags.profile),
    [settings.tags.profile],
  );
  const trackerPreferences = useMemo(
    () => ({
      warnUpstreamChanges: settings.chain.warnUpstreamChanges,
      allowMultiplePackageVersions: settings.chain.allowMultiplePackageVersions,
      allowNegativePointBalances: settings.chain.allowNegativePointBalances,
      allowRerolls: settings.chain.allowRerolls,
      showAdditionalJumpInformation:
        settings.developer.showAdditionalJumpInformation,
    }),
    [settings.chain, settings.developer.showAdditionalJumpInformation],
  );
  const effectiveTrackerState = useMemo(
    () => ({
      ...trackerState,
      tags: projectedTags,
      preferences: trackerPreferences,
    }),
    [projectedTags, trackerPreferences, trackerState],
  );

  useEffect(() => {
    let live = true;
    void chainRepository
      .list()
      .then(async (stored) => {
        if (!live) return;
        if (!stored.length) {
          await Promise.all(
            Object.entries(chainStates).map(([id, value]) =>
              chainRepository.save(
                aggregateFromTracker(id, value, chainRegistry.chains[id]),
              ),
            ),
          );
          return;
        }
        for (const aggregate of stored)
          chainRegistryDispatch({
            type: "hydrate",
            id: aggregate.id,
            name: aggregate.name,
            description: aggregate.description,
            lastOpenedSequence: aggregate.lastOpenedSequence,
            lastOpenedLabel: aggregate.lastOpenedLabel,
          });
        setChainStates((current) => {
          const next = { ...current };
          for (const aggregate of stored) {
            const base =
              current[aggregate.id] ??
              createBlankTrackerFixture(aggregate.name);
            next[aggregate.id] = applyAggregate(base, aggregate);
          }
          return next;
        });
      })
      .catch(() => setChainSaveError("Saved chains could not be loaded."));
    return () => {
      live = false;
    };
    // The initial seed is intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainRepository]);

  useEffect(() => {
    if (!activeChain) return;
    const timeout = window.setTimeout(() => {
      void chainRepository
        .save(
          aggregateFromTracker(
            activeChain.id,
            {
              ...trackerState,
              chainName: activeChain.name,
            },
            activeChain,
          ),
        )
        .then(() => setChainSaveError(null))
        .catch(() =>
          setChainSaveError(
            "Autosave failed. Your in-memory changes are still available.",
          ),
        );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeChain, chainRepository, trackerState]);

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
      const nextState = event.state as ShellHistoryState | null;
      setSettingsBackgroundPath(
        window.location.pathname === "/settings" &&
          typeof nextState?.settingsBackgroundPath === "string"
          ? nextState.settingsBackgroundPath
          : null,
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = titleForRoute(route, activeChain?.name);
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (route.kind === "settings") return;
    window.requestAnimationFrame(() => {
      mainRef.current
        ?.querySelector<HTMLElement>(
          '[data-active-route="true"] [data-route-heading]',
        )
        ?.focus();
      if (restoreSettingsFocus.current) {
        restoreSettingsFocus.current = false;
        settingsButtonRef.current?.focus();
      }
    });
  }, [activeChain?.name, pathname, route]);

  const navigate = useCallback(
    (nextPath: string, extraState: Partial<ShellHistoryState> = {}) => {
      if (window.location.pathname === nextPath) return;
      const nextIndex = historyIndex + 1;
      window.history.pushState(
        { jvIndex: nextIndex, ...extraState },
        "",
        nextPath,
      );
      setHistoryIndex(nextIndex);
      setHistoryMaximum(nextIndex);
      setPathname(nextPath);
      setSettingsBackgroundPath(
        nextPath === "/settings" &&
          typeof extraState.settingsBackgroundPath === "string"
          ? extraState.settingsBackgroundPath
          : null,
      );
    },
    [historyIndex],
  );

  const isActive = (kind: typeof backgroundRoute.kind) =>
    backgroundRoute.kind === kind;
  const knownEditor =
    backgroundRoute.kind === "editor-workspace" && backgroundRoute.available;
  const missingEditor =
    backgroundRoute.kind === "editor-workspace" && !backgroundRoute.available;
  const knownChain =
    backgroundRoute.kind === "chain-workspace" && activeChain !== undefined;
  const missingChain =
    backgroundRoute.kind === "chain-workspace" && activeChain === undefined;

  const openSettings = () => {
    if (route.kind === "settings") return;
    navigate("/settings", { settingsBackgroundPath: pathname });
  };
  const closeSettings = () => {
    restoreSettingsFocus.current = Boolean(settingsBackgroundPath);
    if (settingsBackgroundPath && historyIndex > 0) window.history.back();
    else navigate("/");
  };
  const toggleSettings = () => {
    if (route.kind === "settings") closeSettings();
    else openSettings();
  };

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
      setChainStates((current) => ({
        ...current,
        [id]: createBlankTrackerFixture(normalized),
      }));
      logger.emit("chain.created", { attributes: { jumpCount: 0 } });
      navigate(`/chain/${id}`);
      return true;
    },
    [chainRegistry.nextSerial, logger, navigate],
  );

  const trackerDispatchRef = useRef<Dispatch<TrackerAction>>(() => undefined);
  const effectiveTrackerDispatch = useCallback<Dispatch<TrackerAction>>(
    (action) => {
      const currentState =
        chainStatesRef.current[activeChainId] ?? trackerState;
      const effectiveCurrentState = {
        ...currentState,
        tags: projectedTags,
        preferences: trackerPreferences,
      };
      const nextState = trackerReducer(effectiveCurrentState, action);
      if (
        choiceMutationWasBlocked(effectiveCurrentState, nextState, action) &&
        "entryId" in action &&
        "actorId" in action
      )
        logger.emit("chain.choice.overspend_blocked", {
          attributes: {
            entryId: action.entryId,
            actorId: action.actorId,
          },
        });
      if (action.type === "add-package") {
        const packageItem = effectiveCurrentState.packages[action.packageId];
        const exact = effectiveCurrentState.order.some(
          (id) =>
            effectiveCurrentState.entries[id].packageExactHash ===
            packageItem?.exactHash,
        );
        const parallel =
          packageItem &&
          effectiveCurrentState.order.some(
            (id) =>
              effectiveCurrentState.packages[
                effectiveCurrentState.entries[id].packageId
              ]?.logicalId === packageItem.logicalId,
          );
        if (exact) {
          // Opening an existing exact version is navigation, not a mutation.
        } else if (
          parallel &&
          !effectiveCurrentState.preferences.allowMultiplePackageVersions
        ) {
          logger.emit("chain.package.blocked", {
            attributes: { reason: "parallel-version-disabled" },
          });
        } else if (
          packageItem &&
          nextState.order.length > effectiveCurrentState.order.length
        ) {
          logger.emit("chain.package.added", {
            attributes: {
              source: packageItem.source,
              parallelVersion: Boolean(parallel),
            },
          });
        }
      }
      if (
        action.type !== "undo" &&
        action.type !== "dismiss-undo" &&
        nextState.order !== effectiveCurrentState.order &&
        nextState.order.join("\0") !== effectiveCurrentState.order.join("\0")
      ) {
        const removed =
          nextState.order.length < effectiveCurrentState.order.length;
        logger.emit(removed ? "chain.removed" : "chain.reordered", {
          attributes: {
            dependencyReview: Boolean(effectiveCurrentState.pending),
          },
          toast: nextState.undo
            ? {
                action: {
                  label: "Undo",
                  invoke: () => trackerDispatchRef.current({ type: "undo" }),
                },
                onDismiss: () =>
                  trackerDispatchRef.current({ type: "dismiss-undo" }),
              }
            : undefined,
        });
      }
      const nextStates = {
        ...chainStatesRef.current,
        [activeChainId]: nextState,
      };
      chainStatesRef.current = nextStates;
      setChainStates(nextStates);
    },
    [activeChainId, logger, projectedTags, trackerPreferences, trackerState],
  );

  useEffect(() => {
    trackerDispatchRef.current = effectiveTrackerDispatch;
  }, [effectiveTrackerDispatch]);

  useEffect(() => {
    chainStatesRef.current = chainStates;
  }, [chainStates]);

  return (
    <SupplementProviders
      bodyMod={effectiveTrackerState.bodyMod}
      onBodyModChange={(value) =>
        effectiveTrackerDispatch({ type: "set-body-mod", value })
      }
      supplementState={effectiveTrackerState.supplements}
      supplementDispatch={(action) =>
        effectiveTrackerDispatch({ type: "supplement-action", action })
      }
    >
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
            ref={settingsButtonRef}
            className="app-mock-settings"
            type="button"
            aria-pressed={route.kind === "settings"}
            onClick={toggleSettings}
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

        <main
          ref={mainRef}
          className="app-mock-views app-primary-views"
          hidden={route.kind === "settings" && !settingsBackgroundPath}
          inert={route.kind === "settings" || undefined}
          aria-hidden={
            route.kind === "settings" && Boolean(settingsBackgroundPath)
              ? true
              : undefined
          }
        >
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
                      tags={effectiveTrackerState.tags}
                      colorNameByPrimaryTag={
                        settings.chain.colorNamesByPrimaryTag
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
              tags={effectiveTrackerState.tags}
              colorNamesByPrimaryTag={settings.chain.colorNamesByPrimaryTag}
              onCreate={createChain}
              onOpen={openChain}
              onUpdateDetails={(id, name, description) => {
                const normalizedName = normalizeChainName(name);
                chainRegistryDispatch({
                  type: "update-details",
                  id,
                  name: normalizedName,
                  description,
                });
                const current = chainStatesRef.current[id];
                const metadata = chainRegistry.chains[id];
                if (current && metadata) {
                  const nextState = {
                    ...current,
                    chainName: normalizedName,
                  };
                  const nextStates = {
                    ...chainStatesRef.current,
                    [id]: nextState,
                  };
                  chainStatesRef.current = nextStates;
                  setChainStates(nextStates);
                  void chainRepository
                    .save(
                      aggregateFromTracker(id, nextState, {
                        description: description.trim(),
                        lastOpenedSequence: metadata.lastOpenedSequence,
                        lastOpenedLabel: metadata.lastOpenedLabel,
                      }),
                    )
                    .then(() => setChainSaveError(null))
                    .catch(() =>
                      setChainSaveError(
                        "Autosave failed. Your in-memory changes are still available.",
                      ),
                    );
                }
                logger.emit("chain.details.updated");
              }}
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
                ...effectiveTrackerState,
                chainName: activeChain?.name ?? effectiveTrackerState.chainName,
              }}
              dispatch={effectiveTrackerDispatch}
              showApplicationHeader={false}
            />
            {chainSaveError && (
              <div className="tracker-undo" role="alert">
                <span>{chainSaveError}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeChain) return;
                    void chainRepository
                      .save(
                        aggregateFromTracker(
                          activeChain.id,
                          effectiveTrackerState,
                          activeChain,
                        ),
                      )
                      .then(() => setChainSaveError(null));
                  }}
                >
                  Retry
                </button>
              </div>
            )}
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
        {route.kind === "settings" && (
          <div
            className={`app-settings-layer${settingsBackgroundPath ? " is-overlay" : " is-direct"}`}
            role={settingsBackgroundPath ? "dialog" : undefined}
            aria-modal={settingsBackgroundPath ? true : undefined}
            aria-label="Application settings"
          >
            <SettingsSurface
              onClose={closeSettings}
              direct={!settingsBackgroundPath}
              category={settingsCategory}
              onCategoryChange={setSettingsCategory}
            />
          </div>
        )}
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
  const avatarRef = useRef<HTMLDivElement>(null);
  const [summaryPosition, setSummaryPosition] = useState<CSSProperties | null>(
    null,
  );
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

  const positionSummary = () => {
    const trigger = avatarRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const gutter = 12;
    const width = 18 * 16;
    const estimatedHeight = 17.5 * 16;
    const openLeft = trigger.left > window.innerWidth / 2;
    setSummaryPosition({
      position: "fixed",
      left: Math.max(
        gutter,
        Math.min(
          window.innerWidth - width - gutter,
          openLeft ? trigger.left - width - gutter : trigger.right + gutter,
        ),
      ),
      top: Math.max(
        gutter,
        Math.min(trigger.top, window.innerHeight - estimatedHeight - gutter),
      ),
    });
  };

  return (
    <article className={`app-chain-card${editing ? " is-editing" : ""}`}>
      <div
        ref={avatarRef}
        className="app-chain-card-avatar"
        onMouseEnter={positionSummary}
      >
        <button
          className="app-chain-card-mark"
          type="button"
          aria-describedby={summaryId}
          aria-label={`Show ${chain.name} tag summary`}
          onFocus={positionSummary}
        >
          {chain.name.slice(0, 1).toUpperCase()}
        </button>
        <div
          id={summaryId}
          className="app-chain-tag-summary"
          role="tooltip"
          style={summaryPosition ?? undefined}
        >
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
