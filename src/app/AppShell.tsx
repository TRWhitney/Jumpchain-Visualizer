import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsSurface } from "../settings/SettingsSurface";
import { useOptionalSettings, useSettings } from "../settings/SettingsContext";
import {
  applyInterfaceExperience,
  effectivePackageSizeLimits,
} from "../settings/model";
import { SettingsProvider } from "../settings/SettingsProvider";
import { MemorySettingsRepository } from "../settings/repository";
import { isTauriRuntime } from "../platform/runtime";
import { projectTagDefinitions } from "../settings/tagProfile";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "../tracker/ChainTracker";
import { routeFromPath, titleForRoute, workspaceForRoute } from "./routes";
import {
  EditorHub,
  EditorWorkspace,
  exactHashForFiles,
  hydrateEditorWorkspace,
  orderedEditorWorkspaces,
  summarizeWorkspace,
  type EditorWorkspaceSnapshot,
} from "../editor";
import { type PackageImportReview } from "../archive";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { ThemeIcon, useContextMenu } from "../ui";
import "../../documentation/assets/styles.css";
import "../../documentation/development/application-design.css";
import "../../documentation/development/chain-tracker-design.css";
import "../../documentation/development/choice-rendering-design.css";
import "../tracker/jumpRenderer.css";
import "../../documentation/development/settings-design.css";
import "../../documentation/development/logging-design.css";
import "../../documentation/development/tags-design.css";
import "../../documentation/development/supplements-design.css";
import "../../documentation/development/supplements-essential.css";
import "../../documentation/development/supplements-personal-reality.css";
import "../../documentation/development/supplements-universal-drawbacks.css";
import "../supplements/review.css";
import "../tracker/review.css";
import "./shell.css";
import "../editor/editor.css";
import "./light-theme.css";
import { translate, translateError } from "../localization";
import {
  WelcomeTourOverlay,
  createWelcomeTourSession,
  stageWelcomeTourSession,
  useWelcomeTourPersistence,
  useWelcomeTourTransitions,
} from "../tour";
import { type ShellHistoryState, useShellHistory } from "./useShellHistory";
import { EditorExportReview } from "./EditorExportReview";
import { RecoveryView } from "./RecoveryView";
import { ChainHub, RecentChain } from "./ChainSurfaces";
import {
  type DeletionTarget,
  useDeletionController,
} from "./useDeletionController";
import { useEditorWorkspaceController } from "./useEditorWorkspaceController";
import { useChainController } from "./useChainController";
import { useSettingsOverlayController } from "./useSettingsOverlayController";

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
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const { settings, effectiveTheme, logger, update, replace } = useSettings();
  const {
    pathname,
    setPathname,
    settingsBackgroundPath,
    setSettingsBackgroundPath,
    historyIndex,
    historyMaximum,
    pushHistory,
    replaceHistory,
  } = useShellHistory();
  const {
    repository: tourRepository,
    session: tourSession,
    setSession: setTourSession,
    sessionRef: tourSessionRef,
    saveQueue: tourSaveQueue,
    persist: persistTourSession,
  } = useWelcomeTourPersistence(logger);
  const [pendingEditorNavigation, setPendingEditorNavigation] = useState<{
    path: string;
    state: Partial<ShellHistoryState>;
  } | null>(null);
  const [pendingTourRestart, setPendingTourRestart] = useState<{
    returnPath: string;
  } | null>(null);
  const [exportWorkspace, setExportWorkspace] =
    useState<EditorWorkspaceSnapshot | null>(null);
  const [externalEditorConflict, setExternalEditorConflict] = useState<{
    disk: EditorWorkspaceSnapshot;
    file: string;
  } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const route = useMemo(() => routeFromPath(pathname), [pathname]);
  const backgroundRoute = useMemo(
    () =>
      route.kind === "settings"
        ? routeFromPath(settingsBackgroundPath ?? "/")
        : route,
    [route, settingsBackgroundPath],
  );
  useEffect(() => {
    const status = settings.onboarding.welcomeTourStatus;
    if (status === "completed" || status === "dismissed") {
      return;
    }
    if (tourSession) return;
    let live = true;
    const initialize = async () => {
      const returnPath =
        pathname === "/settings" ? (settingsBackgroundPath ?? "/") : pathname;
      const stored =
        status === "in-progress" ? await tourRepository.load() : null;
      const next = stored ?? createWelcomeTourSession(returnPath);
      if (!live) return;
      persistTourSession(next);
      if (status !== "in-progress")
        update(
          (current) => ({
            ...current,
            onboarding: {
              ...current.onboarding,
              welcomeTourStatus: "in-progress",
            },
          }),
          "onboarding.welcomeTourStatus",
        );
    };
    void initialize().catch((error: unknown) => {
      logger.emit("storage.recovery_used", {
        attributes: {
          aggregate: "welcome-tour",
          reason: "invalid-or-missing-session",
        },
        error,
      });
      if (!live) return;
      const next = createWelcomeTourSession("/");
      persistTourSession(next);
    });
    return () => {
      live = false;
    };
  }, [
    logger,
    pathname,
    persistTourSession,
    settings.onboarding.welcomeTourStatus,
    settingsBackgroundPath,
    tourRepository,
    tourSession,
    update,
  ]);

  useEffect(() => {
    if (!tourSession || window.location.pathname === "/") return;
    const frame = window.requestAnimationFrame(() => {
      const state = (window.history.state as ShellHistoryState | null) ?? {};
      window.history.replaceState(state, "", "/");
      setPathname("/");
      setSettingsBackgroundPath(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [setPathname, setSettingsBackgroundPath, tourSession]);

  const workspace =
    tourSession?.activeBranch ?? workspaceForRoute(backgroundRoute);
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
      showMockData: settings.developer.showMockData,
    }),
    [
      settings.chain,
      settings.developer.showAdditionalJumpInformation,
      settings.developer.showMockData,
    ],
  );
  const editor = useEditorWorkspaceController(settings.editor.saveMode);
  const {
    workspaces: editorWorkspaces,
    loading: editorLoading,
    error: editorError,
    saveState: editorSaveState,
  } = editor;
  const activeEditorWorkspace =
    backgroundRoute.kind === "editor-workspace"
      ? editorWorkspaces[backgroundRoute.workspaceId]
      : undefined;
  const savedEditorWorkspaces = useMemo(
    () => orderedEditorWorkspaces(Object.values(editorWorkspaces)),
    [editorWorkspaces],
  );
  const chain = useChainController({
    routeChainId:
      backgroundRoute.kind === "chain-workspace"
        ? backgroundRoute.chainId
        : null,
    tags: projectedTags,
    preferences: trackerPreferences,
    showMockData: settings.developer.showMockData,
    logger,
  });
  const {
    initialized: chainInitialized,
    savedChains,
    activeChain,
    effectiveState: effectiveTrackerState,
    dispatch: effectiveTrackerDispatch,
    saveError: chainSaveError,
  } = chain;

  const performNavigation = useCallback(
    (nextPath: string, extraState: Partial<ShellHistoryState> = {}) => {
      if (window.location.pathname === nextPath) return;
      if (backgroundRoute.kind === "chain-workspace")
        chain.commands.rememberActive(backgroundRoute.chainId);
      pushHistory(nextPath, extraState);
    },
    [backgroundRoute, chain.commands, pushHistory],
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
        editorSaveState !== "saved"
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
  const {
    category: settingsCategory,
    buttonRef: settingsButtonRef,
    commands: settingsCommands,
  } = useSettingsOverlayController({
    routeIsSettings: route.kind === "settings",
    pathname,
    backgroundPath: settingsBackgroundPath,
    historyIndex,
    navigate,
  });

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
      settingsCommands.restoreAfterNavigation();
    });
  }, [
    activeChain?.name,
    activeEditorWorkspace,
    pathname,
    route,
    settingsCommands,
  ]);

  const isActive = (kind: typeof backgroundRoute.kind) =>
    tourSession
      ? kind === "home" && tourSession.activeBranch === null
      : backgroundRoute.kind === kind;
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

  const saveActiveEditor = useCallback(async () => {
    if (backgroundRoute.kind !== "editor-workspace") return false;
    return editor.commands.save(backgroundRoute.workspaceId);
  }, [backgroundRoute, editor.commands]);

  const createEditorProject = useCallback(() => {
    const created = editor.commands.create();
    logger.emit("editor.project.created", {
      attributes: { location: created.location },
    });
    navigate(`/editor/${encodeURIComponent(created.id)}`);
  }, [editor.commands, logger, navigate]);

  const openEditorProject = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      const opened = editor.commands.open(workspace);
      navigate(`/editor/${encodeURIComponent(opened.id)}`);
    },
    [editor.commands, navigate],
  );

  const toggleEditorStar = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      const nextWorkspace = editor.commands.toggleStar(workspace);
      logger.emit(
        nextWorkspace.starred ? "editor.starred" : "editor.unstarred",
      );
    },
    [editor.commands, logger],
  );

  const performDeletion = useCallback(
    async (target: DeletionTarget) => {
      if (target.kind === "editor") {
        await editor.commands.remove(target.id);
        logger.emit("editor.project.deleted");
        return;
      }
      await chain.commands.remove(target.id);
    },
    [chain.commands, editor.commands, logger],
  );
  const deletion = useDeletionController(performDeletion);
  const deletionTarget = deletion.target;

  const importEditorProject = useCallback(
    (review: PackageImportReview) => {
      const imported = editor.commands.importReview(review);
      logger.emit("editor.package.imported", {
        attributes: {
          warningOverride: review.status === "warning",
          definitionCount: review.definitionCount,
          assetCount: review.assetCount,
        },
      });
      navigate(`/editor/${encodeURIComponent(imported.id)}`);
    },
    [editor.commands, logger, navigate],
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
      .catch((error: unknown) =>
        editor.commands.reportError(translateError(error)),
      );
  }, [editor.commands, openEditorProject, settings.developer]);

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
          assets: activeEditorWorkspace.assets,
          assetEditorDocuments: activeEditorWorkspace.assetEditorDocuments,
          updatedAt: new Date().toISOString(),
          revision: activeEditorWorkspace.revision + 1,
        });
        if (
          !disk ||
          exactHashForFiles(disk.files) ===
            exactHashForFiles(activeEditorWorkspace.files)
        )
          return;
        if (editorSaveState === "saved") {
          editor.commands.acceptExternal(disk);
          return;
        }
        const file =
          Object.keys(disk.files).find(
            (path) => disk.files[path] !== activeEditorWorkspace.files[path],
          ) ?? "jump.jdef";
        setExternalEditorConflict({ disk, file });
      } catch {
        if (live)
          editor.commands.reportError(
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
    editor.commands,
    editorSaveState,
    externalEditorConflict,
    settings.developer,
  ]);

  const openChain = useCallback(
    (chainItem: (typeof savedChains)[number]) => {
      chain.commands.open(chainItem);
      navigate(`/chain/${chainItem.id}`);
    },
    [chain.commands, navigate],
  );

  const createChain = useCallback(
    (name: string) => {
      const id = chain.commands.create(name);
      if (!id) return false;
      navigate(`/chain/${id}`);
      return true;
    },
    [chain.commands, navigate],
  );

  const setChainStarred = chain.commands.setStarred;
  const tourTransitions = useWelcomeTourTransitions({
    session: tourSession,
    sessionRef: tourSessionRef,
    persist: persistTourSession,
  });
  const chooseTourMode = useCallback(
    (mode: "advanced" | "beginner-friendly" | "keep-current") => {
      if (!tourSession?.pendingOutcome) return;
      const returnPath = tourSession.returnPath || "/";
      const outcome = tourSession.pendingOutcome;
      replace(
        mode === "keep-current"
          ? {
              ...settings,
              onboarding: {
                ...settings.onboarding,
                welcomeTourStatus: outcome,
              },
            }
          : {
              ...applyInterfaceExperience(settings, mode),
              onboarding: {
                ...settings.onboarding,
                welcomeTourStatus: outcome,
              },
            },
        "onboarding.welcomeTourStatus",
      );
      tourSessionRef.current = null;
      setTourSession(null);
      void tourSaveQueue.current.finally(() => tourRepository.clear());
      const nextIndex = historyIndex + 1;
      replaceHistory(returnPath, nextIndex);
    },
    [
      historyIndex,
      replace,
      replaceHistory,
      setTourSession,
      settings,
      tourRepository,
      tourSaveQueue,
      tourSession,
      tourSessionRef,
    ],
  );

  const startFreshWelcomeTour = useCallback(
    (returnPath: string) => {
      const next = createWelcomeTourSession(returnPath, true);
      stageWelcomeTourSession(next);
      tourSessionRef.current = next;
      setTourSession(next);
      void tourRepository.clear().finally(() => persistTourSession(next));
      update(
        (current) => ({
          ...current,
          onboarding: {
            ...current.onboarding,
            welcomeTourStatus: "in-progress",
          },
        }),
        "onboarding.welcomeTourStatus",
      );
    },
    [
      persistTourSession,
      setTourSession,
      tourRepository,
      tourSessionRef,
      update,
    ],
  );

  const restartWelcomeTour = useCallback(() => {
    const returnPath =
      settingsBackgroundPath ?? (pathname === "/settings" ? "/" : pathname);
    if (
      backgroundRoute.kind === "editor-workspace" &&
      settings.editor.saveMode === "explicit" &&
      editorSaveState !== "saved"
    ) {
      setPendingTourRestart({ returnPath });
      setPendingEditorNavigation({ path: "/", state: {} });
      return;
    }
    startFreshWelcomeTour(returnPath);
  }, [
    backgroundRoute.kind,
    editorSaveState,
    pathname,
    settings.editor.saveMode,
    settingsBackgroundPath,
    startFreshWelcomeTour,
  ]);

  const resetMockData = chain.commands.resetMockData;

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
        <header className="app-mock-header" data-tour-target="app-navigation">
          <button
            className="app-mock-brand"
            type="button"
            aria-pressed={workspace === "home"}
            onClick={() => {
              if (!tourSession) navigate("/");
            }}
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
              onClick={() => {
                if (!tourSession) navigate("/editor");
              }}
            >
              {translate("ui.appShell.text.editor")}
            </button>
            <button
              type="button"
              aria-pressed={workspace === "chain"}
              onClick={() => {
                if (!tourSession) navigate("/chain");
              }}
            >
              {translate("ui.appShell.text.chainTracker")}
            </button>
          </nav>
          <button
            className="app-mock-theme-toggle"
            type="button"
            data-theme={effectiveTheme}
            aria-label={translate(
              effectiveTheme === "light"
                ? "ui.appShell.ariaLabel.switchToDarkTheme"
                : "ui.appShell.ariaLabel.switchToLightTheme",
            )}
            title={translate(
              effectiveTheme === "light"
                ? "ui.appShell.ariaLabel.switchToDarkTheme"
                : "ui.appShell.ariaLabel.switchToLightTheme",
            )}
            onClick={() => {
              if (tourSession) return;
              update(
                (current) => ({
                  ...current,
                  appearance: {
                    ...current.appearance,
                    theme: effectiveTheme === "light" ? "dark" : "light",
                  },
                }),
                "appearance.theme",
              );
            }}
          >
            <ThemeIcon theme={effectiveTheme} />
          </button>
          <button
            ref={settingsButtonRef}
            className="app-mock-settings"
            type="button"
            aria-pressed={route.kind === "settings"}
            onClick={() => {
              if (!tourSession) settingsCommands.toggle();
            }}
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
          {!settings.general.hideTechnicalLocations && (
            <code>{route.path}</code>
          )}
          <span>{titleForRoute(route, activeChain?.name)}</span>
        </div>

        <main
          ref={mainRef}
          className={`app-mock-views app-primary-views${knownEditor ? " is-editor-workspace" : ""}`}
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
            <div className="app-entry-grid" data-tour-target="home-workspaces">
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
                <button
                  type="button"
                  onClick={() => {
                    if (!tourSession) navigate("/editor");
                  }}
                >
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
                <button
                  type="button"
                  onClick={() => {
                    if (!tourSession) navigate("/chain");
                  }}
                >
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
                    const menu = {
                      label: translate(
                        "ui.editorHub.ariaLabel.projectActions",
                        { project: summary.name },
                      ),
                      actions: [
                        {
                          id: "open",
                          label: translate("common.open"),
                          onAction: () => openEditorProject(workspace),
                        },
                        {
                          id: "star",
                          label: translate(
                            workspace.starred ? "common.unstar" : "common.star",
                          ),
                          onAction: () => toggleEditorStar(workspace),
                        },
                        {
                          id: "export",
                          label: translate("common.exportJmp"),
                          onAction: () => setExportWorkspace(workspace),
                        },
                        {
                          id: "delete",
                          label: translate("common.deleteProject"),
                          danger: true,
                          separatorBefore: true,
                          onAction: () => {
                            deletion.request({
                              kind: "editor",
                              id: workspace.id,
                              name: summary.name,
                            });
                          },
                        },
                      ],
                    };
                    return (
                      <div
                        className="app-recent-work"
                        key={workspace.id}
                        onContextMenu={(event) => openContextMenu(event, menu)}
                      >
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
                            aria-haspopup="menu"
                            onKeyDown={(event) =>
                              openContextMenuFromKeyboard(event, menu)
                            }
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
                      onToggleStar={() =>
                        setChainStarred(chain, !chain.starred)
                      }
                      onDelete={() => {
                        deletion.request({
                          kind: "chain",
                          id: chain.id,
                          name: chain.name,
                        });
                      }}
                    />
                  ))}
                  {!savedChains.length && (
                    <div className="app-recent-work is-empty">
                      <span>
                        <strong>
                          {translate("ui.appShell.text.noRecentChains")}
                        </strong>
                        <small>
                          {translate("ui.appShell.text.startAChainToBegin")}
                        </small>
                      </span>
                    </div>
                  )}
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
            className="app-editor-workspace"
            data-welcome-tour-scope="editor"
            hidden={tourSession?.activeBranch !== "editor"}
            inert={tourSession?.activeBranch !== "editor" || undefined}
            aria-label={translate("ui.appShell.ariaLabel.editorWorkspace")}
            data-tour-target="editor-workspace"
          >
            {tourSession?.activeBranch === "editor" && (
              <EditorWorkspace
                workspace={tourSession.editorWorkspace}
                settings={applyInterfaceExperience(
                  settings,
                  "beginner-friendly",
                )}
                tags={projectedTags}
                saveState="saved"
                onChange={tourTransitions.commands.changeEditorWorkspace}
                onSave={() => undefined}
                onExport={() => undefined}
                onFeedback={(eventName) => logger.emit(eventName)}
                tour={{
                  stepId: tourSession.stepId,
                  advancedOpen: tourSession.editorAdvancedOpen,
                  onAdvancedOpenChange:
                    tourTransitions.commands.setEditorAdvancedOpen,
                  onNavigate: tourTransitions.commands.recordEditorNavigation,
                }}
              />
            )}
          </section>

          <section
            className="app-chain-workspace"
            data-welcome-tour-scope="tracker"
            hidden={tourSession?.activeBranch !== "tracker"}
            inert={tourSession?.activeBranch !== "tracker" || undefined}
            data-tour-target="tracker-workspace"
          >
            {tourSession?.activeBranch === "tracker" && (
              <ChainTracker
                state={tourSession.trackerState}
                dispatch={tourTransitions.commands.trackerDispatch}
                showApplicationHeader={false}
                active
              />
            )}
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
              onExport={setExportWorkspace}
              onDelete={(workspace) => {
                deletion.request({
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
                  tags={projectedTags}
                  saveState={editorSaveState}
                  onChange={editor.commands.change}
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
                deletion.request({
                  kind: "chain",
                  id: chain.id,
                  name: chain.name,
                });
              }}
              onUpdateDetails={chain.commands.updateDetails}
            />
          </section>

          <section
            className="app-chain-workspace"
            hidden={!knownChain}
            inert={!knownChain || !chainInitialized || undefined}
            aria-busy={!chainInitialized}
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
              installPackage={chain.commands.installPackage}
              showApplicationHeader={false}
              active={knownChain && chainInitialized}
            />
            {chainSaveError && (
              <div className="tracker-undo" role="alert">
                <span>{chainSaveError}</span>
                <button
                  type="button"
                  onClick={() => void chain.commands.retrySave()}
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
            busy={deletion.deleting}
            error={deletion.error}
            onCancel={deletion.cancel}
            onConfirm={() => void deletion.confirm()}
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
              onClose={settingsCommands.close}
              onResetMockData={resetMockData}
              onRestartWelcomeTour={restartWelcomeTour}
              direct={!settingsBackgroundPath}
              category={settingsCategory}
              onCategoryChange={settingsCommands.setCategory}
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
                      const restart = pendingTourRestart;
                      setPendingEditorNavigation(null);
                      setPendingTourRestart(null);
                      performNavigation(pending.path, pending.state);
                      if (restart) startFreshWelcomeTour(restart.returnPath);
                    });
                  }}
                >
                  {translate("ui.appShell.text.saveAndLeave")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pending = pendingEditorNavigation;
                    if (backgroundRoute.kind === "editor-workspace")
                      editor.commands.restorePersisted(
                        backgroundRoute.workspaceId,
                      );
                    setPendingEditorNavigation(null);
                    const restart = pendingTourRestart;
                    setPendingTourRestart(null);
                    performNavigation(pending.path, pending.state);
                    if (restart) startFreshWelcomeTour(restart.returnPath);
                  }}
                >
                  {translate("ui.appShell.text.discard")}
                </button>
                <button
                  autoFocus
                  type="button"
                  onClick={() => {
                    setPendingEditorNavigation(null);
                    setPendingTourRestart(null);
                  }}
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
                    editor.commands.acceptExternal(disk, true);
                    setExternalEditorConflict(null);
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
        {tourSession && (
          <WelcomeTourOverlay
            session={tourSession}
            actionComplete={tourTransitions.actionComplete}
            onContinue={tourTransitions.commands.continue}
            onBack={tourTransitions.commands.back}
            onSkip={tourTransitions.commands.skip}
            onExit={tourTransitions.commands.exit}
            onChooseBranch={tourTransitions.commands.chooseBranch}
            onChooseAdvanced={tourTransitions.commands.chooseAdvanced}
            onFinishBranch={tourTransitions.commands.finishBranch}
            onChooseMode={chooseTourMode}
          />
        )}
      </div>
    </SupplementProviders>
  );
}
