import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import { mockChainDefinition } from "../fixtures/mockData";
import { translate } from "../localization";
import type { EventPipeline } from "../settings/logging";
import { evaluateTracker, projectEvaluation } from "../tracker/evaluateTracker";
import {
  createBlankTrackerFixture,
  createDenseTrackerFixture,
  DEMONSTRATION_CHAIN_ID,
  reconcileDemonstrationPackageBindings,
} from "../tracker/fixtures";
import {
  choiceMutationWasBlocked,
  isSamePackageIdentity,
  radarCounts,
  trackerTagDefinitions,
  trackerReducer,
  type TagDefinition,
  type TrackerAction,
  type TrackerPreferences,
  type TrackerState,
  type InstalledPackage,
} from "../tracker/model";
import { restoreStoredChainPackage } from "../tracker/importedPackage";
import {
  createPlatformChainPackageRepository,
  storedChainPackage,
  type ChainPackageRepository,
} from "../tracker/packageRepository";
import {
  aggregateFromTracker,
  applyAggregate,
  createPlatformChainRepository,
  type ChainRepository,
} from "../tracker/repository";
import {
  chainRegistryReducer,
  chainsVisibleWithMockSetting,
  createChainRegistryFixture,
  normalizeChainName,
  orderedChains,
  type SavedChain,
} from "./chainRegistry";

export function useChainController({
  routeChainId,
  tags,
  preferences,
  showMockData,
  logger,
  repositoryFactory = createPlatformChainRepository,
  packageRepositoryFactory = createPlatformChainPackageRepository,
}: {
  routeChainId: string | null;
  tags: Readonly<Record<string, TagDefinition>>;
  preferences: TrackerPreferences;
  showMockData: boolean;
  logger: EventPipeline;
  repositoryFactory?: () => ChainRepository;
  packageRepositoryFactory?: () => ChainPackageRepository;
}) {
  const [registry, registryDispatch] = useReducer(
    chainRegistryReducer,
    undefined,
    createChainRegistryFixture,
  );
  const repository = useMemo(() => repositoryFactory(), [repositoryFactory]);
  const packageRepository = useMemo(
    () => packageRepositoryFactory(),
    [packageRepositoryFactory],
  );
  const initializationRef = useRef<Promise<void>>(Promise.resolve());
  const chainWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const packageWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [initialized, setInitialized] = useState(false);
  const [states, setStates] = useState<Record<string, TrackerState>>(() =>
    Object.fromEntries(
      Object.values(createChainRegistryFixture().chains).map((chain) => [
        chain.id,
        { ...createDenseTrackerFixture(), chainName: chain.name },
      ]),
    ),
  );
  const statesRef = useRef(states);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastActiveId, setLastActiveId] = useState(DEMONSTRATION_CHAIN_ID);

  const queueChainSave = useCallback(
    (aggregate: ReturnType<typeof aggregateFromTracker>) => {
      const pending = initializationRef.current.then(() => {
        const write = chainWriteQueueRef.current.then(() =>
          repository.save(aggregate),
        );
        chainWriteQueueRef.current = write.catch(() => undefined);
        return write;
      });
      return pending;
    },
    [repository],
  );

  const queuePackageOperation = useCallback(
    (operation: () => Promise<void>) => {
      const pending = initializationRef.current.then(() => {
        const write = packageWriteQueueRef.current.then(operation);
        packageWriteQueueRef.current = write.catch(() => undefined);
        return write;
      });
      return pending;
    },
    [],
  );
  const activeChain = routeChainId ? registry.chains[routeChainId] : undefined;
  const activeId = activeChain?.id ?? lastActiveId;
  const trackerState = reconcileDemonstrationPackageBindings(
    states[activeId] ?? createBlankTrackerFixture(activeChain?.name),
    activeId,
  );
  const effectiveState = useMemo(() => {
    const base = { ...trackerState, tags, preferences };
    return { ...base, tags: trackerTagDefinitions(base) };
  }, [preferences, tags, trackerState]);
  const allSavedChains = useMemo(
    () =>
      orderedChains(registry).map((chain) => {
        const value = states[chain.id];
        if (!value) return chain;
        const evaluation = evaluateTracker(
          value,
          value.enabledSupplements["body-mod"] ? value.bodyMod : null,
        );
        const base = {
          ...value,
          tags,
          preferences: {
            ...value.preferences,
            includeItemTagsInRadar: preferences.includeItemTagsInRadar,
          },
        };
        const projected = projectEvaluation(
          { ...base, tags: trackerTagDefinitions(base) },
          evaluation,
        );
        return {
          ...chain,
          jumpCount: value.order.filter(
            (entryId) => value.entries[entryId]?.kind === "jump",
          ).length,
          tagCounts: radarCounts(projected),
        };
      }),
    [preferences.includeItemTagsInRadar, registry, states, tags],
  );
  const savedChains = useMemo(
    () => chainsVisibleWithMockSetting(allSavedChains, showMockData),
    [allSavedChains, showMockData],
  );

  useEffect(() => {
    let live = true;
    const initialize = Promise.all([
      repository.list(),
      repository.isInitialized(),
    ])
      .then(async ([stored, initialized]) => {
        if (!live) return;
        if (!initialized) {
          await Promise.all(
            Object.entries(states).map(([id, value]) =>
              repository.save(
                aggregateFromTracker(id, value, registry.chains[id]),
              ),
            ),
          );
          if (live) setInitialized(true);
          return;
        }
        registryDispatch({ type: "clear" });
        for (const aggregate of stored)
          registryDispatch({
            type: "hydrate",
            id: aggregate.id,
            name: aggregate.name,
            description: aggregate.description,
            lastOpenedSequence: aggregate.lastOpenedSequence,
            lastOpenedLabel: aggregate.lastOpenedLabel,
            starred: aggregate.starred ?? false,
          });
        const storedPackages = await Promise.all(
          stored.map((aggregate) => packageRepository.list(aggregate.id)),
        );
        const restoredPackages = await Promise.all(
          storedPackages.map(async (records) =>
            (await Promise.all(records.map(restoreStoredChainPackage))).filter(
              (item): item is InstalledPackage => item !== null,
            ),
          ),
        );
        const next = Object.fromEntries(
          stored.map((aggregate, index) => {
            const base =
              states[aggregate.id] ?? createBlankTrackerFixture(aggregate.name);
            const packages = Object.fromEntries(
              restoredPackages[index].map((item) => [item.id, item]),
            );
            return [
              aggregate.id,
              reconcileDemonstrationPackageBindings(
                applyAggregate(
                  { ...base, packages: { ...base.packages, ...packages } },
                  aggregate,
                ),
                aggregate.id,
              ),
            ];
          }),
        );
        statesRef.current = next;
        setStates(next);
        setInitialized(true);
      })
      .catch(() => setSaveError(translate("errors.SAVED_CHAINS_LOAD_FAILED")));
    initializationRef.current = initialize;
    return () => {
      live = false;
    };
    // The initial seed is intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageRepository, repository]);

  useEffect(() => {
    if (!activeChain || !initialized) return;
    const timeout = window.setTimeout(() => {
      void queueChainSave(
        aggregateFromTracker(
          activeChain.id,
          { ...trackerState, chainName: activeChain.name },
          activeChain,
        ),
      )
        .then(() => setSaveError(null))
        .catch(() =>
          setSaveError(translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED")),
        );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeChain, initialized, queueChainSave, trackerState]);

  const open = useCallback((chain: SavedChain) => {
    setLastActiveId(chain.id);
    registryDispatch({ type: "open", id: chain.id });
  }, []);
  const rememberActive = useCallback((id: string) => setLastActiveId(id), []);

  const create = useCallback(
    (name: string) => {
      const normalized = normalizeChainName(name);
      if (!normalized) return null;
      const id = `ch-new-${registry.nextSerial}`;
      const nextState = createBlankTrackerFixture(normalized);
      const nextStates = { ...statesRef.current, [id]: nextState };
      setLastActiveId(id);
      registryDispatch({ type: "create", id, name: normalized });
      statesRef.current = nextStates;
      setStates(nextStates);
      void queueChainSave(
        aggregateFromTracker(id, nextState, {
          description: "A new chain ready for its first Jump.",
          lastOpenedSequence: registry.nextSequence,
          lastOpenedLabel: "Opened just now",
          starred: false,
        }),
      )
        .then(() => setSaveError(null))
        .catch(() =>
          setSaveError(translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED")),
        );
      logger.emit("chain.created", { attributes: { jumpCount: 0 } });
      return id;
    },
    [logger, queueChainSave, registry.nextSequence, registry.nextSerial],
  );

  const setStarred = useCallback(
    (chain: SavedChain, starred: boolean) => {
      registryDispatch({ type: "set-starred", id: chain.id, starred });
      const current = statesRef.current[chain.id];
      if (current)
        void queueChainSave(
          aggregateFromTracker(chain.id, current, {
            description: chain.description,
            lastOpenedSequence: chain.lastOpenedSequence,
            lastOpenedLabel: chain.lastOpenedLabel,
            starred,
          }),
        )
          .then(() => setSaveError(null))
          .catch(() =>
            setSaveError(translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED")),
          );
      logger.emit(starred ? "chain.starred" : "chain.unstarred");
    },
    [logger, queueChainSave],
  );

  const trackerDispatchRef = useRef<Dispatch<TrackerAction>>(() => undefined);
  const persistPackageChanges = useCallback(
    (
      chainId: string,
      previous: TrackerState["packages"],
      next: TrackerState["packages"],
    ) => {
      const operations: Promise<void>[] = [];
      for (const packageItem of Object.values(previous))
        if (packageItem.source === "imported" && !next[packageItem.id])
          operations.push(
            queuePackageOperation(() =>
              packageRepository.remove(chainId, packageItem.id),
            ),
          );
      for (const packageItem of Object.values(next)) {
        if (
          packageItem.source !== "imported" ||
          previous[packageItem.id] ||
          !packageItem.archive ||
          !packageItem.archiveLimits
        )
          continue;
        const value = storedChainPackage(
          chainId,
          packageItem.id,
          packageItem.archive,
          packageItem.archiveLimits,
        );
        operations.push(
          queuePackageOperation(() => packageRepository.save(value)),
        );
      }
      if (operations.length)
        void Promise.all(operations)
          .then(() => setSaveError(null))
          .catch(() =>
            setSaveError(translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED")),
          );
    },
    [packageRepository, queuePackageOperation],
  );
  const dispatch = useCallback<Dispatch<TrackerAction>>(
    (action) => {
      const currentState = statesRef.current[activeId] ?? trackerState;
      const baseCurrentState = {
        ...reconcileDemonstrationPackageBindings(currentState, activeId),
        tags,
        preferences,
      };
      const effectiveCurrentState = {
        ...baseCurrentState,
        tags: trackerTagDefinitions(baseCurrentState),
      };
      const nextState = trackerReducer(effectiveCurrentState, action);
      if (
        choiceMutationWasBlocked(effectiveCurrentState, nextState, action) &&
        "entryId" in action &&
        "actorId" in action
      )
        logger.emit("chain.choice.overspend_blocked", {
          attributes: { entryId: action.entryId, actorId: action.actorId },
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
          effectiveCurrentState.order.some((id) => {
            const installed =
              effectiveCurrentState.packages[
                effectiveCurrentState.entries[id].packageId
              ];
            return Boolean(
              installed && isSamePackageIdentity(installed, packageItem),
            );
          });
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
      if (nextState.packages !== effectiveCurrentState.packages)
        persistPackageChanges(
          activeId,
          effectiveCurrentState.packages,
          nextState.packages,
        );
      const nextStates = { ...statesRef.current, [activeId]: nextState };
      statesRef.current = nextStates;
      setStates(nextStates);
    },
    [activeId, logger, persistPackageChanges, preferences, tags, trackerState],
  );

  useEffect(() => {
    trackerDispatchRef.current = dispatch;
  }, [dispatch]);

  const installPackage = useCallback(
    async (packageItem: InstalledPackage) => {
      if (
        packageItem.source !== "imported" ||
        !packageItem.archive ||
        !packageItem.archiveLimits
      )
        throw new Error("The imported Jump archive is unavailable.");
      await queuePackageOperation(() =>
        packageRepository.save(
          storedChainPackage(
            activeId,
            packageItem.id,
            packageItem.archive!,
            packageItem.archiveLimits!,
          ),
        ),
      );
      dispatch({ type: "install-package", packageItem });
    },
    [activeId, dispatch, packageRepository, queuePackageOperation],
  );

  const updateDetails = useCallback(
    (id: string, name: string, description: string) => {
      const normalizedName = normalizeChainName(name);
      registryDispatch({
        type: "update-details",
        id,
        name: normalizedName,
        description,
      });
      const current = statesRef.current[id];
      const metadata = registry.chains[id];
      if (current && metadata) {
        const nextState = { ...current, chainName: normalizedName };
        const nextStates = { ...statesRef.current, [id]: nextState };
        statesRef.current = nextStates;
        setStates(nextStates);
        void queueChainSave(
          aggregateFromTracker(id, nextState, {
            description: description.trim(),
            lastOpenedSequence: metadata.lastOpenedSequence,
            lastOpenedLabel: metadata.lastOpenedLabel,
            starred: metadata.starred,
          }),
        )
          .then(() => setSaveError(null))
          .catch(() =>
            setSaveError(translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED")),
          );
      }
      logger.emit("chain.details.updated");
    },
    [logger, queueChainSave, registry.chains],
  );

  const remove = useCallback(
    async (id: string) => {
      await initializationRef.current;
      await Promise.all([
        chainWriteQueueRef.current,
        packageWriteQueueRef.current,
      ]);
      await repository.remove(id);
      await packageRepository.removeChain(id);
      registryDispatch({ type: "remove", id });
      const next = { ...statesRef.current };
      delete next[id];
      statesRef.current = next;
      setStates(next);
      setLastActiveId((current) =>
        current === id ? (Object.keys(next)[0] ?? "") : current,
      );
      setSaveError(null);
      logger.emit("chain.deleted");
    },
    [logger, packageRepository, repository],
  );

  const resetMockData = useCallback(async () => {
    const restored = createDenseTrackerFixture();
    const aggregate = aggregateFromTracker(
      mockChainDefinition.id,
      restored,
      mockChainDefinition,
    );
    try {
      await queueChainSave(aggregate);
      registryDispatch({
        type: "hydrate",
        id: mockChainDefinition.id,
        name: mockChainDefinition.name,
        description: mockChainDefinition.description,
        lastOpenedSequence: mockChainDefinition.lastOpenedSequence,
        lastOpenedLabel: mockChainDefinition.lastOpenedLabel,
        starred: mockChainDefinition.starred,
      });
      const next = { ...statesRef.current, [mockChainDefinition.id]: restored };
      statesRef.current = next;
      setStates(next);
      setSaveError(null);
      logger.emit("mock_data.reset");
      return true;
    } catch {
      logger.emit("mock_data.reset_failed");
      return false;
    }
  }, [logger, queueChainSave]);

  const retrySave = useCallback(async () => {
    if (!activeChain) return;
    await queueChainSave(
      aggregateFromTracker(activeChain.id, effectiveState, activeChain),
    );
    setSaveError(null);
  }, [activeChain, effectiveState, queueChainSave]);

  const commands = useMemo(
    () => ({
      open,
      rememberActive,
      create,
      setStarred,
      updateDetails,
      remove,
      resetMockData,
      retrySave,
      installPackage,
    }),
    [
      create,
      open,
      rememberActive,
      remove,
      resetMockData,
      retrySave,
      installPackage,
      setStarred,
      updateDetails,
    ],
  );

  return {
    initialized,
    savedChains,
    activeChain,
    effectiveState,
    dispatch,
    saveError,
    commands,
  } as const;
}
