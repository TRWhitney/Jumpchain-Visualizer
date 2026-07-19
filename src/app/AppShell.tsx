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
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
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
import "./light-theme.css";
import {
  isStructuredCommandError,
  translate,
  translateError,
} from "../localization";

type ShellHistoryState = {
  jvIndex?: number;
  settingsBackgroundPath?: string;
} & Record<string, unknown>;

type DeletionTarget =
  | { kind: "chain"; id: string; name: string }
  | { kind: "editor"; id: string; name: string };

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
  const editorSavingIndicatorTimer = useRef<number | null>(null);
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
  const chainInitializationRef = useRef<Promise<void>>(Promise.resolve());
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
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(
    null,
  );
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    () => projectTagDefinitions(settings.tags.profile, settings.language.tag),
    [settings.tags.profile, settings.language.tag],
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
        setEditorError(translate("errors.EDITOR_PROJECTS_LOAD_FAILED"));
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
    const initialize = Promise.all([
      chainRepository.list(),
      chainRepository.isInitialized(),
    ])
      .then(async ([stored, initialized]) => {
        if (!live) return;
        if (!initialized) {
          await Promise.all(
            Object.entries(chainStates).map(([id, value]) =>
              chainRepository.save(
                aggregateFromTracker(id, value, chainRegistry.chains[id]),
              ),
            ),
          );
          return;
        }
        chainRegistryDispatch({ type: "clear" });
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
        const next = Object.fromEntries(
          stored.map((aggregate) => {
            const base =
              chainStates[aggregate.id] ??
              createBlankTrackerFixture(aggregate.name);
            return [
              aggregate.id,
              reconcileDemonstrationPackageBindings(
                applyAggregate(base, aggregate),
                aggregate.id,
              ),
            ];
          }),
        );
        chainStatesRef.current = next;
        setChainStates(next);
      })
      .catch(() =>
        setChainSaveError(translate("errors.SAVED_CHAINS_LOAD_FAILED")),
      );
    chainInitializationRef.current = initialize;
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
            translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED"),
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
    async (workspace: EditorWorkspaceSnapshot, updateSaveState = true) => {
      try {
        await editorRepository.save(workspace);
        persistedEditorWorkspacesRef.current = {
          ...persistedEditorWorkspacesRef.current,
          [workspace.id]: workspace,
        };
        if (updateSaveState) setEditorSaveState("Saved");
        setEditorError(null);
        return true;
      } catch {
        if (updateSaveState) {
          setEditorSaveState("Save failed");
          setEditorError(
            translate("errors.EDITOR_AUTOSAVE_FAILED_MEMORY_RETAINED"),
          );
        }
        return false;
      }
    },
    [editorRepository],
  );

  const changeEditorWorkspace = useCallback(
    (next: EditorWorkspaceSnapshot) => {
      const nextWorkspaces = {
        ...editorWorkspacesRef.current,
        [next.id]: next,
      };
      editorWorkspacesRef.current = nextWorkspaces;
      setEditorWorkspaces(nextWorkspaces);
      setEditorSaveState("Unsaved");
      if (settings.editor.saveMode !== "autosave") return;
      if (editorSaveTimer.current) window.clearTimeout(editorSaveTimer.current);
      if (editorSavingIndicatorTimer.current)
        window.clearTimeout(editorSavingIndicatorTimer.current);
      editorSaveTimer.current = window.setTimeout(() => {
        const saving = editorWorkspacesRef.current[next.id];
        editorSavingIndicatorTimer.current = window.setTimeout(() => {
          if (
            editorWorkspacesRef.current[next.id]?.revision === saving.revision
          )
            setEditorSaveState("Saving");
        }, 150);
        void persistEditorWorkspace(saving, false)
          .then((saved) => {
            if (
              editorWorkspacesRef.current[next.id]?.revision !== saving.revision
            )
              return;
            if (saved) {
              setEditorSaveState("Saved");
              setEditorError(null);
            } else {
              setEditorSaveState("Save failed");
              setEditorError(
                translate("errors.EDITOR_AUTOSAVE_FAILED_MEMORY_RETAINED"),
              );
            }
          })
          .finally(() => {
            if (editorSavingIndicatorTimer.current)
              window.clearTimeout(editorSavingIndicatorTimer.current);
            editorSavingIndicatorTimer.current = null;
          });
      }, 500);
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

  const confirmDeletion = useCallback(async () => {
    const target = deletionTarget;
    if (!target || deleting) return;
    setDeleting(true);
    setDeletionError(null);
    try {
      if (target.kind === "editor") {
        if (editorSaveTimer.current) {
          window.clearTimeout(editorSaveTimer.current);
          editorSaveTimer.current = null;
        }
        if (editorSavingIndicatorTimer.current) {
          window.clearTimeout(editorSavingIndicatorTimer.current);
          editorSavingIndicatorTimer.current = null;
        }
        await editorRepository.remove(target.id);
        const next = { ...editorWorkspacesRef.current };
        delete next[target.id];
        editorWorkspacesRef.current = next;
        setEditorWorkspaces(next);
        const persisted = { ...persistedEditorWorkspacesRef.current };
        delete persisted[target.id];
        persistedEditorWorkspacesRef.current = persisted;
        setEditorError(null);
        logger.emit("editor.project.deleted");
      } else {
        await chainInitializationRef.current;
        await chainRepository.remove(target.id);
        chainRegistryDispatch({ type: "remove", id: target.id });
        const next = { ...chainStatesRef.current };
        delete next[target.id];
        chainStatesRef.current = next;
        setChainStates(next);
        setLastActiveChainId((current) =>
          current === target.id ? (Object.keys(next)[0] ?? "") : current,
        );
        setChainSaveError(null);
        logger.emit("chain.deleted");
      }
      setDeletionTarget(null);
    } catch {
      setDeletionError(
        target.kind === "editor"
          ? "The project could not be deleted. Nothing was removed."
          : "The chain could not be deleted. Nothing was removed.",
      );
    } finally {
      setDeleting(false);
    }
  }, [chainRepository, deleting, deletionTarget, editorRepository, logger]);

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
      .catch((error: unknown) => setEditorError(translateError(error)));
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
            translate("errors.DESKTOP_EDITOR_FOLDER_PERMISSION_LOST"),
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
              translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED"),
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
        aria-label={translate(
          "ui.appShell.ariaLabel.jumpchainVisualizerApplication",
        )}
      >
        <header className="app-mock-header">
          <button
            className="app-mock-brand"
            type="button"
            aria-pressed={workspace === "home"}
            onClick={() => navigate("/")}
          >
            <span aria-hidden="true">{translate("ui.appShell.text.jv")}</span>
            <strong>{translate("ui.appShell.text.jumpchainVisualizer")}</strong>
          </button>
          <nav
            aria-label={translate(
              "ui.appShell.ariaLabel.applicationWorkspaces",
            )}
          >
            <button
              type="button"
              aria-pressed={workspace === "editor"}
              onClick={() => navigate("/editor")}
            >
              {translate("ui.appShell.text.editor")}
            </button>
            <button
              type="button"
              aria-pressed={workspace === "chain"}
              onClick={() => navigate("/chain")}
            >
              {translate("ui.appShell.text.chainTracker")}
            </button>
          </nav>
          <button
            ref={settingsButtonRef}
            className="app-mock-settings"
            type="button"
            aria-pressed={route.kind === "settings"}
            onClick={toggleSettings}
          >
            {translate("ui.appShell.text.settings")}
          </button>
        </header>

        <div
          className="app-mock-location"
          aria-label={translate("ui.appShell.ariaLabel.applicationLocation")}
        >
          <button
            type="button"
            aria-label={translate("ui.appShell.ariaLabel.back")}
            disabled={historyIndex <= 0}
            onClick={() => window.history.back()}
          >
            ←
          </button>
          <button
            type="button"
            aria-label={translate("ui.appShell.ariaLabel.forward")}
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
          inert={route.kind === "settings" || deletionTarget ? true : undefined}
          aria-hidden={
            deletionTarget ||
            (route.kind === "settings" && Boolean(settingsBackgroundPath))
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
            <p className="app-mock-kicker">
              {translate("ui.appShell.text.chooseAWorkspace")}
            </p>
            <h1
              id="app-home-heading"
              className="app-route-heading"
              data-route-heading
              tabIndex={-1}
            >
              {translate("ui.appShell.text.whatWouldYouLikeToDo")}
            </h1>
            <div className="app-entry-grid">
              <article>
                <span className="app-entry-icon" aria-hidden="true">
                  ✎
                </span>
                <div>
                  <h4>{translate("ui.appShell.text.buildAJump")}</h4>
                  <p>
                    {translate(
                      "ui.appShell.text.createOrContinueAPackageInTheEditor",
                    )}
                  </p>
                </div>
                <button type="button" onClick={() => navigate("/editor")}>
                  {translate("ui.appShell.text.openEditor")}
                </button>
              </article>
              <article>
                <span className="app-entry-icon" aria-hidden="true">
                  ↝
                </span>
                <div>
                  <h4>{translate("ui.appShell.text.startAChain")}</h4>
                  <p>
                    {translate(
                      "ui.appShell.text.trackChoicesAcrossImportedJumps",
                    )}
                  </p>
                </div>
                <button type="button" onClick={() => navigate("/chain")}>
                  {translate("ui.appShell.text.openChainTracker")}
                </button>
              </article>
            </div>
            <div className="app-home-recents">
              <section
                className="app-recent-section"
                aria-labelledby="recent-editor-heading"
              >
                <h4 id="recent-editor-heading">
                  {translate("ui.appShell.text.editorWorkspaces")}
                </h4>
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
                            {translate("ui.appShell.text.resume")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!savedEditorWorkspaces.length && (
                    <div className="app-recent-work is-empty">
                      <span>
                        <strong>
                          {translate("ui.appShell.text.noRecentEditorProjects")}
                        </strong>
                        <small>
                          {translate(
                            "ui.appShell.text.createOrImportAJumpToBegin",
                          )}
                        </small>
                      </span>
                    </div>
                  )}
                </div>
              </section>
              <section
                className="app-recent-section"
                aria-labelledby="recent-chains-heading"
              >
                <h4 id="recent-chains-heading">
                  {translate("ui.appShell.text.chains")}
                </h4>
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
                      {translate("ui.appShell.text.viewAll")}
                      {savedChains.length}{" "}
                      {translate("ui.appShell.text.chainsCountSuffix")}
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
              onDelete={(workspace) => {
                setDeletionError(null);
                setDeletionTarget({
                  kind: "editor",
                  id: workspace.id,
                  name: summarizeWorkspace(workspace).name,
                });
              }}
            />
          </section>

          <section
            className="app-editor-workspace"
            hidden={!knownEditor}
            inert={!knownEditor || undefined}
            data-active-route={knownEditor}
            aria-label={translate("ui.appShell.ariaLabel.editorWorkspace")}
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
                  onFeedback={(eventName) => logger.emit(eventName)}
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
              active={route.kind === "chain-hub"}
              chains={savedChains}
              tags={effectiveTrackerState.tags}
              colorNamesByPrimaryTag={settings.chain.colorNamesByPrimaryTag}
              includeItemTags={settings.chain.includeItemTagsInRadar}
              onCreate={createChain}
              onOpen={openChain}
              onToggleStar={(chain) => setChainStarred(chain, !chain.starred)}
              onDelete={(chain) => {
                setDeletionError(null);
                setDeletionTarget({
                  kind: "chain",
                  id: chain.id,
                  name: chain.name,
                });
              }}
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
                        translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED"),
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
                  {translate("ui.appShell.text.retry")}
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
            <p className="app-mock-kicker">
              {translate("ui.appShell.text.unknownDestination")}
            </p>
            <h1
              id="app-not-found-heading"
              className="app-route-heading"
              data-route-heading
              tabIndex={-1}
            >
              {translate("ui.appShell.text.pageNotFound")}
            </h1>
            <p>
              {translate(
                "ui.appShell.text.thisAddressDoesNotIdentifyAnAvailableApplicationRoute",
              )}
            </p>
            <div className="app-route-actions">
              <button type="button" onClick={() => navigate("/")}>
                {translate("ui.appShell.text.returnHome")}
              </button>
            </div>
          </section>
        </main>
        {deletionTarget && (
          <ConfirmationDialog
            application
            title={`Delete ${deletionTarget.name}?`}
            confirmLabel={
              deletionTarget.kind === "chain"
                ? "Delete chain"
                : "Delete project"
            }
            busy={deleting}
            error={deletionError}
            onCancel={() => {
              if (deleting) return;
              setDeletionTarget(null);
              setDeletionError(null);
            }}
            onConfirm={() => void confirmDeletion()}
          >
            {translate("ui.appShell.text.areYouSureYouWantToDelete")}
            {deletionTarget.name}
            {translate("ui.appShell.text.thisCannotBeUndone")}
          </ConfirmationDialog>
        )}
        {route.kind === "settings" && (
          <div
            className={`app-settings-layer${settingsBackgroundPath ? " is-overlay" : " is-direct"}`}
            role={settingsBackgroundPath ? "dialog" : undefined}
            aria-modal={settingsBackgroundPath ? true : undefined}
            aria-label={translate("ui.appShell.ariaLabel.applicationSettings")}
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
              <p>{translate("ui.appShell.text.unsavedSource")}</p>
              <h2 id="editor-departure-heading">
                {translate("ui.appShell.text.saveBeforeLeavingTheEditor")}
              </h2>
              <p>
                {translate(
                  "ui.appShell.text.thisProjectUsesExplicitSavesLeavingNowWithoutSaving",
                )}
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
                  {translate("ui.appShell.text.saveAndLeave")}
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
                  {translate("ui.appShell.text.discard")}
                </button>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setPendingEditorNavigation(null)}
                >
                  {translate("ui.appShell.text.cancel")}
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
              <p>{translate("ui.appShell.text.externalChangeDetected")}</p>
              <h2 id="editor-conflict-heading">
                {translate("ui.appShell.text.theProjectChangedOnDisk")}
              </h2>
              <p>
                {translate("ui.appShell.text.autosaveIsPausedFor")}
                {externalEditorConflict.file}
                {translate(
                  "ui.appShell.text.compareBothVersionsKeepTheEditorBufferOrUse",
                )}
              </p>
              <details>
                <summary>
                  {translate("ui.appShell.text.compare")}
                  {externalEditorConflict.file}
                </summary>
                <div className="editor-conflict-compare">
                  <section>
                    <strong>
                      {translate("ui.appShell.text.editorVersion")}
                    </strong>
                    <pre>
                      {activeEditorWorkspace.files[
                        externalEditorConflict.file
                      ] ?? "(missing)"}
                    </pre>
                  </section>
                  <section>
                    <strong>{translate("ui.appShell.text.diskVersion")}</strong>
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
                  {translate("ui.appShell.text.keepEditorVersion")}
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
                  {translate("ui.appShell.text.useDiskVersion")}
                </button>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setExternalEditorConflict(null)}
                >
                  {translate("ui.appShell.text.continueComparing")}
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
          : isStructuredCommandError(caught)
            ? translateError(caught)
            : translate("errors.EXPORT_FAILED"),
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
        <p>{translate("ui.appShell.text.preflightAndExport")}</p>
        <h2 id="editor-export-heading">
          {translate("ui.appShell.text.export")}
          {summary.name} {translate("ui.appShell.text.asJmp")}
        </h2>
        <p>
          {translate(
            "ui.appShell.text.everySourceFileAndAssetWillBeValidatedBefore",
          )}
        </p>
        <div className="editor-export-limits">
          <strong>{translate("ui.appShell.text.effectiveLimits")}</strong>
          <span>
            {translate("ui.appShell.text.archive")}
            {limits.maxArchiveMiB} {translate("ui.appShell.text.mib")}
          </span>
          <span>
            {translate("ui.appShell.text.definition")}
            {limits.maxDefinitionFileMiB} {translate("ui.appShell.text.mib")}
          </span>
          <span>
            {translate("ui.appShell.text.asset")}
            {limits.maxAssetFileMiB} {translate("ui.appShell.text.mib")}
          </span>
          <span>
            {translate("ui.appShell.text.expanded")}
            {limits.maxExpandedPackageMiB} {translate("ui.appShell.text.mib")}
          </span>
        </div>
        {settings.developer.useCustomPackageSizeLimits && (
          <p className="editor-export-risk">
            <strong>{translate("ui.appShell.text.atYourOwnRisk")}</strong>{" "}
            {translate(
              "ui.appShell.text.customPackageByteBudgetsAreActiveMandatorySecurityChecks",
            )}
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
            {translate("ui.appShell.text.cancel")}
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
          {translate("ui.appShell.text.resume")}
        </button>
      </div>
    </div>
  );
}

function ChainHub({
  active,
  chains,
  tags,
  colorNamesByPrimaryTag,
  includeItemTags,
  onCreate,
  onOpen,
  onToggleStar,
  onDelete,
  onUpdateDetails,
}: {
  active: boolean;
  chains: readonly SavedChain[];
  tags: Record<string, TagDefinition>;
  colorNamesByPrimaryTag: boolean;
  includeItemTags: boolean;
  onCreate: (name: string) => boolean;
  onOpen: (chain: SavedChain) => void;
  onToggleStar: (chain: SavedChain) => void;
  onDelete: (chain: SavedChain) => void;
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
          <p className="app-mock-kicker">
            {translate("ui.appShell.text.chainTracker")}
          </p>
          <h1
            id="app-chain-heading"
            className="app-route-heading"
            data-route-heading
            tabIndex={-1}
          >
            {translate("ui.appShell.text.yourChains")}
          </h1>
          <p>
            {translate(
              "ui.appShell.text.resumeAJourneyUpdateItsDetailsOrSetOut",
            )}
          </p>
        </div>
        <span>
          <strong>{chains.length}</strong>
          <small>{translate("ui.appShell.text.savedChains")}</small>
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
          <label htmlFor="new-chain-name">
            {translate("ui.appShell.text.startANewChain")}
          </label>
          <p>
            {translate("ui.appShell.text.nameItNowYouCanEditItsDetailsFrom")}
          </p>
        </div>
        <input
          id="new-chain-name"
          spellCheck
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={translate("ui.appShell.placeholder.chainName")}
          maxLength={80}
          required
        />
        <button type="submit">
          {translate("ui.appShell.text.startChain")}
        </button>
      </form>

      <section
        className="app-saved-chains"
        aria-labelledby="saved-chains-heading"
      >
        <div className="app-saved-chains-heading">
          <div>
            <h2 id="saved-chains-heading">
              {translate("ui.appShell.text.allSavedChains")}
            </h2>
            <p>
              {translate(
                "ui.appShell.text.starredChainsFirstThenByWhenYouLastOpened",
              )}
            </p>
          </div>
          <label className="app-chain-search">
            <span>{translate("ui.appShell.text.searchSavedChains")}</span>
            <input
              type="search"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translate(
                "ui.appShell.placeholder.nameOrDescription",
              )}
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
              key={`${chain.id}:${active ? "active" : "inactive"}`}
              chain={chain}
              tags={tags}
              colorNameByPrimaryTag={colorNamesByPrimaryTag}
              includeItemTags={includeItemTags}
              onOpen={() => onOpen(chain)}
              onToggleStar={() => onToggleStar(chain)}
              onDelete={() => onDelete(chain)}
              onUpdateDetails={(name, description) =>
                onUpdateDetails(chain.id, name, description)
              }
            />
          ))}
          {!visibleChains.length && (
            <div className="app-chain-empty" role="status">
              <strong>
                {translate("ui.appShell.text.noSavedChainsMatch")}
                {search.trim()}”.
              </strong>
              <span>
                {translate(
                  "ui.appShell.text.tryAChainNameOrWordsFromItsDescription",
                )}
              </span>
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
  onDelete,
  onUpdateDetails,
}: {
  chain: SavedChain;
  tags: Record<string, TagDefinition>;
  colorNameByPrimaryTag: boolean;
  includeItemTags: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
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
              {totalTagged} {translate("ui.appShell.text.tagged")}
              {includeItemTags ? "records" : "perks"}
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
            <label htmlFor={`rename-${chain.id}`}>
              {translate("ui.appShell.text.chainName")}
            </label>
            <input
              ref={inputRef}
              id={`rename-${chain.id}`}
              value={name}
              spellCheck
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
            <label htmlFor={`description-${chain.id}`}>
              {translate("ui.appShell.text.description")}
            </label>
            <textarea
              id={`description-${chain.id}`}
              value={description}
              spellCheck
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
              rows={2}
              placeholder={translate(
                "ui.appShell.placeholder.describeThisChain",
              )}
            />
            <button type="submit">{translate("ui.appShell.text.save")}</button>
            <button
              type="button"
              onClick={() => {
                setName(chain.name);
                setDescription(chain.description);
                setEditing(false);
              }}
            >
              {translate("ui.appShell.text.cancel")}
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
          <dt>{translate("ui.appShell.text.jumps")}</dt>
          <dd>{chain.jumpCount}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="app-card-delete"
        aria-label={`Delete ${chain.name}`}
        title={`Delete ${chain.name}`}
        onClick={onDelete}
      >
        {translate("ui.appShell.text.delete")}
      </button>
      {!editing && (
        <div className="app-chain-card-actions">
          <button type="button" onClick={onOpen}>
            {translate("ui.appShell.text.open")}
          </button>
          <button
            type="button"
            className="app-chain-secondary-action"
            aria-label={`Edit ${chain.name}`}
            onClick={() => setEditing(true)}
          >
            {translate("ui.appShell.text.editDetails")}
          </button>
          <ChainStarButton chain={chain} onToggle={onToggleStar} />
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
      <p className="app-mock-kicker">
        {translate("ui.appShell.text.recovery")}
      </p>
      <h1
        id={`app-${type === "Chain" ? "chain" : "editor"}-recovery-heading`}
        className="app-route-heading"
        data-route-heading
        tabIndex={-1}
      >
        {type} {translate("ui.appShell.text.unavailable")}
      </h1>
      <p>
        {translate(
          "ui.appShell.text.theRequestedLocalRecordCouldNotBeRestoredIts",
        )}
      </p>
      <div className="app-route-actions">
        <button type="button" onClick={onReturn}>
          {returnLabel}
        </button>
      </div>
    </section>
  );
}
