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
import {
  effectivePackageSizeLimits,
  type SettingsCategory,
} from "../settings/model";
import { SettingsProvider } from "../settings/SettingsProvider";
import {
  isTauriRuntime,
  MemorySettingsRepository,
} from "../settings/repository";
import { projectTagDefinitions } from "../settings/tagProfile";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "../tracker/ChainTracker";
import {
  createBlankTrackerFixture,
  createDenseTrackerFixture,
  DEMONSTRATION_CHAIN_ID,
  reconcileDemonstrationPackageBindings,
} from "../tracker/fixtures";
import { StaticTagRadar } from "../tracker/TagRadar";
import {
  tagCategories,
  radarCounts,
  trackerReducer,
  choiceMutationWasBlocked,
  type TrackerAction,
  type TagDefinition,
} from "../tracker/model";
import { routeFromPath, titleForRoute, workspaceForRoute } from "./routes";
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
import { evaluateTracker, projectEvaluation } from "../tracker/evaluateTracker";
import {
  createPlatformEditorWorkspaceRepository,
  createStarterWorkspace,
  EditorHub,
  EditorWorkspace,
  exactHashForFiles,
  hydrateEditorWorkspace,
  orderedEditorWorkspaces,
  summarizeWorkspace,
  type EditorWorkspaceSnapshot,
} from "../editor";
import { JumpPackageImportService, type PackageImportReview } from "../archive";
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
import "../editor/editor.css";

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
  const editorRepository = useMemo(
    () => createPlatformEditorWorkspaceRepository(),
    [],
  );
  const [editorWorkspaces, setEditorWorkspaces] = useState<
    Record<string, EditorWorkspaceSnapshot>
  >({});
  const editorWorkspacesRef = useRef(editorWorkspaces);
  const persistedEditorWorkspacesRef = useRef<
    Record<string, EditorWorkspaceSnapshot>
  >({});
  const [editorLoading, setEditorLoading] = useState(true);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorSaveState, setEditorSaveState] = useState<
    "Saved" | "Saving" | "Unsaved" | "Save failed"
  >("Saved");
  const editorSaveTimer = useRef<number | null>(null);
  const [pendingEditorNavigation, setPendingEditorNavigation] = useState<{
    path: string;
    state: Partial<ShellHistoryState>;
  } | null>(null);
  const [exportWorkspace, setExportWorkspace] =
    useState<EditorWorkspaceSnapshot | null>(null);
  const [externalEditorConflict, setExternalEditorConflict] = useState<{
    disk: EditorWorkspaceSnapshot;
    file: string;
  } | null>(null);
  const chainRepository = useMemo(() => createPlatformChainRepository(), []);
  const [chainStates, setChainStates] = useState<Record<string, TrackerState>>(
    () =>
      Object.fromEntries(
        Object.values(createChainRegistryFixture().chains).map((chain) => [
          chain.id,
          { ...createDenseTrackerFixture(), chainName: chain.name },
        ]),
      ),
  );
  const chainStatesRef = useRef(chainStates);
  const [chainSaveError, setChainSaveError] = useState<string | null>(null);
  const [lastActiveChainId, setLastActiveChainId] = useState(
    DEMONSTRATION_CHAIN_ID,
  );
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
  const activeEditorWorkspace =
    backgroundRoute.kind === "editor-workspace"
      ? editorWorkspaces[backgroundRoute.workspaceId]
      : undefined;
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
        const projected = projectEvaluation(
          {
            ...value,
            preferences: {
              ...value.preferences,
              includeItemTagsInRadar: settings.chain.includeItemTagsInRadar,
            },
          },
          evaluation,
        );
        const tagCounts = radarCounts(projected);
        return {
          ...chain,
          jumpCount: value.order.filter(
            (entryId) => value.entries[entryId]?.kind === "jump",
          ).length,
          tagCounts,
        };
      }),
    [chainRegistry, chainStates, settings.chain.includeItemTagsInRadar],
  );
  const savedEditorWorkspaces = useMemo(
    () => orderedEditorWorkspaces(Object.values(editorWorkspaces)),
    [editorWorkspaces],
  );
  const activeChain =
    backgroundRoute.kind === "chain-workspace"
      ? chainRegistry.chains[backgroundRoute.chainId]
      : undefined;
  const activeChainId = activeChain?.id ?? lastActiveChainId;
  const trackerState = reconcileDemonstrationPackageBindings(
    chainStates[activeChainId] ?? createBlankTrackerFixture(activeChain?.name),
    activeChainId,
  );
  const projectedTags = useMemo(
    () => projectTagDefinitions(settings.tags.profile),
    [settings.tags.profile],
  );
  const trackerPreferences = useMemo(
    () => ({
      warnUpstreamChanges: settings.chain.warnUpstreamChanges,
      allowMultiplePackageVersions: settings.chain.allowMultiplePackageVersions,
      allowDuplicateJumps: settings.chain.allowDuplicateJumps,
      allowNegativePointBalances: settings.chain.allowNegativePointBalances,
      allowRerolls: settings.chain.allowRerolls,
      includeItemTagsInRadar: settings.chain.includeItemTagsInRadar,
      aggregateSimilarInventory: settings.chain.aggregateSimilarInventory,
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
    void editorRepository
      .list()
      .then((stored) => {
        if (!live) return;
        const storedById = Object.fromEntries(
          stored.map((workspace) => [workspace.id, workspace]),
        );
        const indexed = { ...storedById, ...editorWorkspacesRef.current };
        editorWorkspacesRef.current = indexed;
        persistedEditorWorkspacesRef.current = indexed;
        setEditorWorkspaces(indexed);
        setEditorError(null);
        setEditorLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setEditorError("Saved Editor projects could not be loaded.");
        setEditorLoading(false);
      });
    return () => {
      live = false;
    };
  }, [editorRepository]);

  useEffect(() => {
    editorWorkspacesRef.current = editorWorkspaces;
  }, [editorWorkspaces]);

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
            starred: aggregate.starred ?? false,
          });
        setChainStates((current) => {
          const next = { ...current };
          for (const aggregate of stored) {
            const base =
              current[aggregate.id] ??
              createBlankTrackerFixture(aggregate.name);
            next[aggregate.id] = reconcileDemonstrationPackageBindings(
              applyAggregate(base, aggregate),
              aggregate.id,
            );
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
    document.title =
      route.kind === "editor-workspace" && activeEditorWorkspace
        ? `${summarizeWorkspace(activeEditorWorkspace).name} · Editor`
        : titleForRoute(route, activeChain?.name);
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
  }, [activeChain?.name, activeEditorWorkspace, pathname, route]);

  const performNavigation = useCallback(
    (nextPath: string, extraState: Partial<ShellHistoryState> = {}) => {
      if (window.location.pathname === nextPath) return;
      if (backgroundRoute.kind === "chain-workspace")
        setLastActiveChainId(backgroundRoute.chainId);
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
    [backgroundRoute, historyIndex],
  );

  const navigate = useCallback(
    (nextPath: string, extraState: Partial<ShellHistoryState> = {}) => {
      const leavingEditor =
        backgroundRoute.kind === "editor-workspace" &&
        !nextPath.startsWith(`/editor/${backgroundRoute.workspaceId}`) &&
        nextPath !== "/settings";
      if (
        leavingEditor &&
        settings.editor.saveMode === "explicit" &&
        editorSaveState !== "Saved"
      ) {
        setPendingEditorNavigation({ path: nextPath, state: extraState });
        return;
      }
      performNavigation(nextPath, extraState);
    },
    [
      backgroundRoute,
      editorSaveState,
      performNavigation,
      settings.editor.saveMode,
    ],
  );

  const isActive = (kind: typeof backgroundRoute.kind) =>
    backgroundRoute.kind === kind;
  const knownEditor =
    backgroundRoute.kind === "editor-workspace" &&
    activeEditorWorkspace !== undefined;
  const missingEditor =
    backgroundRoute.kind === "editor-workspace" &&
    !editorLoading &&
    activeEditorWorkspace === undefined;
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

  const persistEditorWorkspace = useCallback(
    async (workspace: EditorWorkspaceSnapshot) => {
      try {
        await editorRepository.save(workspace);
        persistedEditorWorkspacesRef.current = {
          ...persistedEditorWorkspacesRef.current,
          [workspace.id]: workspace,
        };
        setEditorSaveState("Saved");
        setEditorError(null);
        return true;
      } catch {
        setEditorSaveState("Save failed");
        setEditorError(
          "Editor autosave failed. Your in-memory source is still available.",
        );
        return false;
      }
    },
    [editorRepository],
  );

  const changeEditorWorkspace = useCallback(
    (next: EditorWorkspaceSnapshot, continuous = false) => {
      const nextWorkspaces = {
        ...editorWorkspacesRef.current,
        [next.id]: next,
      };
      editorWorkspacesRef.current = nextWorkspaces;
      setEditorWorkspaces(nextWorkspaces);
      setEditorSaveState("Unsaved");
      if (settings.editor.saveMode !== "autosave") return;
      setEditorSaveState("Saving");
      if (editorSaveTimer.current) window.clearTimeout(editorSaveTimer.current);
      editorSaveTimer.current = window.setTimeout(
        () => void persistEditorWorkspace(next),
        continuous ? 350 : 80,
      );
    },
    [persistEditorWorkspace, settings.editor.saveMode],
  );

  const saveActiveEditor = useCallback(async () => {
    if (backgroundRoute.kind !== "editor-workspace") return false;
    const current = editorWorkspacesRef.current[backgroundRoute.workspaceId];
    if (!current) return false;
    setEditorSaveState("Saving");
    return persistEditorWorkspace(current);
  }, [backgroundRoute, persistEditorWorkspace]);

  const createEditorProject = useCallback(() => {
    const created = createStarterWorkspace();
    const next = { ...editorWorkspacesRef.current, [created.id]: created };
    editorWorkspacesRef.current = next;
    setEditorWorkspaces(next);
    setEditorSaveState("Saved");
    void persistEditorWorkspace(created);
    logger.emit("editor.project.created", {
      attributes: { location: created.location },
    });
    navigate(`/editor/${encodeURIComponent(created.id)}`);
  }, [logger, navigate, persistEditorWorkspace]);

  const openEditorProject = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      const opened = {
        ...workspace,
        lastOpenedAt: new Date().toISOString(),
      };
      const next = { ...editorWorkspacesRef.current, [opened.id]: opened };
      editorWorkspacesRef.current = next;
      setEditorWorkspaces(next);
      setEditorSaveState("Saved");
      void persistEditorWorkspace(opened);
      navigate(`/editor/${encodeURIComponent(opened.id)}`);
    },
    [navigate, persistEditorWorkspace],
  );

  const toggleEditorStar = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      const nextWorkspace = { ...workspace, starred: !workspace.starred };
      const next = {
        ...editorWorkspacesRef.current,
        [workspace.id]: nextWorkspace,
      };
      editorWorkspacesRef.current = next;
      setEditorWorkspaces(next);
      void persistEditorWorkspace(nextWorkspace);
      logger.emit(
        nextWorkspace.starred ? "editor.starred" : "editor.unstarred",
      );
    },
    [logger, persistEditorWorkspace],
  );

  const importEditorProject = useCallback(
    (review: PackageImportReview) => {
      const now = new Date().toISOString();
      const imported: EditorWorkspaceSnapshot = {
        schemaVersion: 1,
        id: globalThis.crypto.randomUUID(),
        location: "imported",
        files: { ...review.files.definitions },
        assets: { ...review.files.assets },
        starred: false,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        revision: 0,
      };
      const next = { ...editorWorkspacesRef.current, [imported.id]: imported };
      editorWorkspacesRef.current = next;
      setEditorWorkspaces(next);
      void persistEditorWorkspace(imported);
      logger.emit("editor.package.imported", {
        attributes: {
          warningOverride: review.status === "warning",
          definitionCount: review.definitionCount,
          assetCount: review.assetCount,
        },
      });
      navigate(`/editor/${encodeURIComponent(imported.id)}`);
    },
    [logger, navigate, persistEditorWorkspace],
  );

  const openEditorFolder = useCallback(() => {
    if (!isTauriRuntime()) return;
    void import("@tauri-apps/api/core")
      .then(({ invoke }) =>
        invoke<EditorWorkspaceSnapshot | null>("open_editor_project_folder", {
          limits: effectivePackageSizeLimits(settings.developer),
        }),
      )
      .then((opened) => {
        if (opened) openEditorProject(opened);
      })
      .catch(() =>
        setEditorError(
          "The project folder could not be opened safely or permission was lost.",
        ),
      );
  }, [openEditorProject, settings.developer]);

  useEffect(() => {
    if (
      !isTauriRuntime() ||
      !activeEditorWorkspace?.externalFolder ||
      activeEditorWorkspace.location !== "desktop" ||
      externalEditorConflict
    )
      return;
    let live = true;
    const scan = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const diskValue = await invoke<unknown>("scan_editor_project_folder", {
          folder: activeEditorWorkspace.externalFolder,
          limits: effectivePackageSizeLimits(settings.developer),
        });
        if (!live || !diskValue || typeof diskValue !== "object") return;
        const disk = hydrateEditorWorkspace({
          ...activeEditorWorkspace,
          ...(diskValue as object),
          updatedAt: new Date().toISOString(),
          revision: activeEditorWorkspace.revision + 1,
        });
        if (
          !disk ||
          exactHashForFiles(disk.files) ===
            exactHashForFiles(activeEditorWorkspace.files)
        )
          return;
        if (editorSaveState === "Saved") {
          const next = { ...editorWorkspacesRef.current, [disk.id]: disk };
          editorWorkspacesRef.current = next;
          setEditorWorkspaces(next);
          persistedEditorWorkspacesRef.current = {
            ...persistedEditorWorkspacesRef.current,
            [disk.id]: disk,
          };
          return;
        }
        const file =
          Object.keys(disk.files).find(
            (path) => disk.files[path] !== activeEditorWorkspace.files[path],
          ) ?? "jump.jdef";
        setExternalEditorConflict({ disk, file });
      } catch {
        if (live)
          setEditorError(
            "The desktop project folder is unavailable or its permission was lost. Your Editor buffers and recovery copy are retained.",
          );
      }
    };
    const timer = window.setInterval(() => void scan(), 2_000);
    void scan();
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [
    activeEditorWorkspace,
    editorSaveState,
    externalEditorConflict,
    settings.developer,
  ]);

  const openChain = useCallback(
    (chain: SavedChain) => {
      setLastActiveChainId(chain.id);
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
      setLastActiveChainId(id);
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

  const setChainStarred = useCallback(
    (chain: SavedChain, starred: boolean) => {
      chainRegistryDispatch({ type: "set-starred", id: chain.id, starred });
      const current = chainStatesRef.current[chain.id];
      if (current)
        void chainRepository
          .save(
            aggregateFromTracker(chain.id, current, {
              description: chain.description,
              lastOpenedSequence: chain.lastOpenedSequence,
              lastOpenedLabel: chain.lastOpenedLabel,
              starred,
            }),
          )
          .then(() => setChainSaveError(null))
          .catch(() =>
            setChainSaveError(
              "Autosave failed. Your in-memory changes are still available.",
            ),
          );
      logger.emit(starred ? "chain.starred" : "chain.unstarred");
    },
    [chainRepository, logger],
  );

  const trackerDispatchRef = useRef<Dispatch<TrackerAction>>(() => undefined);
  const effectiveTrackerDispatch = useCallback<Dispatch<TrackerAction>>(
    (action) => {
      const currentState =
        chainStatesRef.current[activeChainId] ?? trackerState;
      const effectiveCurrentState = {
        ...reconcileDemonstrationPackageBindings(currentState, activeChainId),
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
        if (exact && !effectiveCurrentState.preferences.allowDuplicateJumps) {
          // Opening an existing exact version is navigation, not a mutation.
        } else if (
          parallel &&
          !exact &&
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
                <div className="app-recent-list">
                  {savedEditorWorkspaces.slice(0, 5).map((workspace) => {
                    const summary = summarizeWorkspace(workspace);
                    return (
                      <div className="app-recent-work" key={workspace.id}>
                        <span>
                          <strong>{summary.name}</strong>
                          <small>
                            {summary.authors.join(", ") || "Unknown author"} · v
                            {summary.version}
                          </small>
                        </span>
                        <div className="app-recent-actions">
                          {workspace.starred && (
                            <span
                              className="app-chain-star-indicator"
                              role="img"
                              aria-label={`${summary.name} is starred`}
                            >
                              ★
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditorProject(workspace)}
                          >
                            Resume
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!savedEditorWorkspaces.length && (
                    <div className="app-recent-work is-empty">
                      <span>
                        <strong>No recent Editor projects</strong>
                        <small>Create or import a Jump to begin.</small>
                      </span>
                    </div>
                  )}
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
            className="app-editor-hub-route"
            hidden={!isActive("editor-hub")}
            inert={!isActive("editor-hub") || undefined}
            data-active-route={isActive("editor-hub")}
            aria-labelledby="app-editor-heading"
          >
            <EditorHub
              workspaces={savedEditorWorkspaces}
              loading={editorLoading}
              error={editorError}
              desktop={isTauriRuntime()}
              onCreate={createEditorProject}
              onOpen={openEditorProject}
              onOpenFolder={openEditorFolder}
              onImport={importEditorProject}
              onToggleStar={toggleEditorStar}
            />
          </section>

          <section
            className="app-editor-workspace"
            hidden={!knownEditor}
            inert={!knownEditor || undefined}
            data-active-route={knownEditor}
            aria-label="Editor workspace"
          >
            {activeEditorWorkspace && (
              <>
                <h1 className="sr-only" data-route-heading tabIndex={-1}>
                  {summarizeWorkspace(activeEditorWorkspace).name}
                </h1>
                <EditorWorkspace
                  workspace={activeEditorWorkspace}
                  settings={settings}
                  saveState={editorSaveState}
                  onChange={changeEditorWorkspace}
                  onSave={() => void saveActiveEditor()}
                  onExport={() => setExportWorkspace(activeEditorWorkspace)}
                />
              </>
            )}
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
              includeItemTags={settings.chain.includeItemTagsInRadar}
              onCreate={createChain}
              onOpen={openChain}
              onToggleStar={(chain) => setChainStarred(chain, !chain.starred)}
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
                        starred: metadata.starred,
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
              active={knownChain}
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
        {pendingEditorNavigation && (
          <div className="editor-departure-backdrop">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="editor-departure-heading"
            >
              <p>Unsaved source</p>
              <h2 id="editor-departure-heading">
                Save before leaving the Editor?
              </h2>
              <p>
                This project uses explicit saves. Leaving now without saving
                discards the in-memory source changes from this session.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const pending = pendingEditorNavigation;
                    void saveActiveEditor().then((saved) => {
                      if (!saved) return;
                      setPendingEditorNavigation(null);
                      performNavigation(pending.path, pending.state);
                    });
                  }}
                >
                  Save and Leave
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pending = pendingEditorNavigation;
                    if (backgroundRoute.kind === "editor-workspace") {
                      const saved =
                        persistedEditorWorkspacesRef.current[
                          backgroundRoute.workspaceId
                        ];
                      if (saved) {
                        const next = {
                          ...editorWorkspacesRef.current,
                          [saved.id]: saved,
                        };
                        editorWorkspacesRef.current = next;
                        setEditorWorkspaces(next);
                      }
                    }
                    setPendingEditorNavigation(null);
                    setEditorSaveState("Saved");
                    performNavigation(pending.path, pending.state);
                  }}
                >
                  Discard
                </button>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setPendingEditorNavigation(null)}
                >
                  Cancel
                </button>
              </div>
            </section>
          </div>
        )}
        {exportWorkspace && (
          <EditorExportReview
            workspace={exportWorkspace}
            settings={settings}
            onClose={() => setExportWorkspace(null)}
            onOverrideUse={() =>
              logger.emit("package.limits.override_used", {
                attributes: { operation: "editor-export" },
              })
            }
          />
        )}
        {externalEditorConflict && activeEditorWorkspace && (
          <div className="editor-departure-backdrop">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="editor-conflict-heading"
            >
              <p>External change detected</p>
              <h2 id="editor-conflict-heading">The project changed on disk</h2>
              <p>
                Autosave is paused for {externalEditorConflict.file}. Compare
                both versions, keep the Editor buffer, or use the disk version.
              </p>
              <details>
                <summary>Compare {externalEditorConflict.file}</summary>
                <div className="editor-conflict-compare">
                  <section>
                    <strong>Editor version</strong>
                    <pre>
                      {activeEditorWorkspace.files[
                        externalEditorConflict.file
                      ] ?? "(missing)"}
                    </pre>
                  </section>
                  <section>
                    <strong>Disk version</strong>
                    <pre>
                      {externalEditorConflict.disk.files[
                        externalEditorConflict.file
                      ] ?? "(missing)"}
                    </pre>
                  </section>
                </div>
              </details>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setExternalEditorConflict(null);
                    void saveActiveEditor();
                  }}
                >
                  Keep Editor Version
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const disk = externalEditorConflict.disk;
                    const next = {
                      ...editorWorkspacesRef.current,
                      [disk.id]: disk,
                    };
                    editorWorkspacesRef.current = next;
                    persistedEditorWorkspacesRef.current = {
                      ...persistedEditorWorkspacesRef.current,
                      [disk.id]: disk,
                    };
                    setEditorWorkspaces(next);
                    setEditorSaveState("Saved");
                    setExternalEditorConflict(null);
                    void editorRepository.save(disk);
                  }}
                >
                  Use Disk Version
                </button>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setExternalEditorConflict(null)}
                >
                  Continue Comparing
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </SupplementProviders>
  );
}

function EditorExportReview({
  workspace,
  settings,
  onClose,
  onOverrideUse,
}: {
  workspace: EditorWorkspaceSnapshot;
  settings: ReturnType<typeof useSettings>["settings"];
  onClose: () => void;
  onOverrideUse: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const limits = effectivePackageSizeLimits(settings.developer);
  const summary = summarizeWorkspace(workspace);
  const perform = async () => {
    setExporting(true);
    setError(null);
    try {
      const archive = await new JumpPackageImportService().export(
        { definitions: workspace.files, assets: workspace.assets },
        limits,
      );
      if (settings.developer.useCustomPackageSizeLimits) onOverrideUse();
      const safeName =
        summary.name
          .toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "jump-package";
      if (isTauriRuntime()) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_editor_package", {
          suggestedName: `${safeName}.jmp`,
          bytes: [...archive],
          limits,
        });
      } else {
        const url = URL.createObjectURL(new Blob([archive.slice().buffer]));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeName}.jmp`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Export could not be completed safely.",
      );
      setExporting(false);
    }
  };
  return (
    <div className="editor-departure-backdrop">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="editor-export-heading"
      >
        <p>Preflight and export</p>
        <h2 id="editor-export-heading">Export {summary.name} as .jmp?</h2>
        <p>
          Every source file and asset will be validated before compression.
          Export is blocked if any effective limit or mandatory image/file
          protection fails.
        </p>
        <div className="editor-export-limits">
          <strong>Effective limits</strong>
          <span>Archive {limits.maxArchiveMiB} MiB</span>
          <span>Definition {limits.maxDefinitionFileMiB} MiB</span>
          <span>Asset {limits.maxAssetFileMiB} MiB</span>
          <span>Expanded {limits.maxExpandedPackageMiB} MiB</span>
        </div>
        {settings.developer.useCustomPackageSizeLimits && (
          <p className="editor-export-risk">
            <strong>At your own risk.</strong> Custom package byte budgets are
            active. Mandatory security checks remain enabled.
          </p>
        )}
        {error && (
          <p className="editor-export-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void perform()}
          >
            {exporting ? "Exporting…" : "Export Package"}
          </button>
          <button
            autoFocus
            type="button"
            disabled={exporting}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

function ChainStarButton({
  chain,
  onToggle,
}: {
  chain: SavedChain;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="app-chain-star"
      aria-label={`${chain.starred ? "Unstar" : "Star"} ${chain.name}`}
      aria-pressed={chain.starred}
      title={`${chain.starred ? "Unstar" : "Star"} ${chain.name}`}
      onClick={onToggle}
    >
      <span aria-hidden="true">{chain.starred ? "★" : "☆"}</span>
    </button>
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
      <div className="app-recent-actions">
        {chain.starred && (
          <span
            className="app-chain-star-indicator"
            role="img"
            aria-label={`${chain.name} is starred`}
          >
            ★
          </span>
        )}
        <button type="button" onClick={onOpen}>
          Resume
        </button>
      </div>
    </div>
  );
}

function ChainHub({
  chains,
  tags,
  colorNamesByPrimaryTag,
  includeItemTags,
  onCreate,
  onOpen,
  onToggleStar,
  onUpdateDetails,
}: {
  chains: readonly SavedChain[];
  tags: Record<string, TagDefinition>;
  colorNamesByPrimaryTag: boolean;
  includeItemTags: boolean;
  onCreate: (name: string) => boolean;
  onOpen: (chain: SavedChain) => void;
  onToggleStar: (chain: SavedChain) => void;
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
            <p>Starred chains first, then by when you last opened them.</p>
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
              includeItemTags={includeItemTags}
              onOpen={() => onOpen(chain)}
              onToggleStar={() => onToggleStar(chain)}
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
  includeItemTags,
  onOpen,
  onToggleStar,
  onUpdateDetails,
}: {
  chain: SavedChain;
  tags: Record<string, TagDefinition>;
  colorNameByPrimaryTag: boolean;
  includeItemTags: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
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
  const totalTagged = tagCategories.reduce(
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
              <span>
                {includeItemTags ? "Perk and item profile" : "Perk profile"}
              </span>
              <strong>{chain.name}</strong>
            </div>
            <span>
              {totalTagged} tagged {includeItemTags ? "records" : "perks"}
            </span>
          </header>
          <StaticTagRadar
            counts={chain.tagCounts}
            tags={tags}
            label={`${chain.name} ${includeItemTags ? "perk and item" : "perk"} category radar`}
            unitLabel={includeItemTags ? "records" : "perks"}
          />
          <p>
            {primaryTagDefinition
              ? `Strongest category: ${primaryTagDefinition.label} with ${chain.tagCounts[primaryTag!]} ${includeItemTags ? "records" : "perks"}.`
              : `No tagged ${includeItemTags ? "records" : "perks"} yet.`}
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
      <ChainStarButton chain={chain} onToggle={onToggleStar} />
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
