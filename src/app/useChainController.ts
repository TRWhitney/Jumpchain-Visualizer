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
  trackerReducer,
  type TagDefinition,
  type TrackerAction,
  type TrackerPreferences,
  type TrackerState,
} from "../tracker/model";
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
}: {
  routeChainId: string | null;
  tags: Readonly<Record<string, TagDefinition>>;
  preferences: TrackerPreferences;
  showMockData: boolean;
  logger: EventPipeline;
  repositoryFactory?: () => ChainRepository;
}) {
  const [registry, registryDispatch] = useReducer(
    chainRegistryReducer,
    undefined,
    createChainRegistryFixture,
  );
  const repository = useMemo(() => repositoryFactory(), [repositoryFactory]);
  const initializationRef = useRef<Promise<void>>(Promise.resolve());
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
  const activeChain = routeChainId ? registry.chains[routeChainId] : undefined;
  const activeId = activeChain?.id ?? lastActiveId;
  const trackerState = reconcileDemonstrationPackageBindings(
    states[activeId] ?? createBlankTrackerFixture(activeChain?.name),
    activeId,
  );
  const effectiveState = useMemo(
    () => ({ ...trackerState, tags, preferences }),
    [preferences, tags, trackerState],
  );
  const allSavedChains = useMemo(
    () =>
      orderedChains(registry).map((chain) => {
        const value = states[chain.id];
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
              includeItemTagsInRadar: preferences.includeItemTagsInRadar,
            },
          },
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
    [preferences.includeItemTagsInRadar, registry, states],
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
        const next = Object.fromEntries(
          stored.map((aggregate) => {
            const base =
              states[aggregate.id] ?? createBlankTrackerFixture(aggregate.name);
            return [
              aggregate.id,
              reconcileDemonstrationPackageBindings(
                applyAggregate(base, aggregate),
                aggregate.id,
              ),
            ];
          }),
        );
        statesRef.current = next;
        setStates(next);
      })
      .catch(() => setSaveError(translate("errors.SAVED_CHAINS_LOAD_FAILED")));
    initializationRef.current = initialize;
    return () => {
      live = false;
    };
    // The initial seed is intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  useEffect(() => {
    if (!activeChain) return;
    const timeout = window.setTimeout(() => {
      void repository
        .save(
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
  }, [activeChain, repository, trackerState]);

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
      void initializationRef.current
        .then(() =>
          repository.save(
            aggregateFromTracker(id, nextState, {
              description: "A new chain ready for its first Jump.",
              lastOpenedSequence: registry.nextSequence,
              lastOpenedLabel: "Opened just now",
              starred: false,
            }),
          ),
        )
        .then(() => setSaveError(null))
        .catch(() =>
          setSaveError(translate("errors.AUTOSAVE_FAILED_MEMORY_RETAINED")),
        );
      logger.emit("chain.created", { attributes: { jumpCount: 0 } });
      return id;
    },
    [logger, registry.nextSequence, registry.nextSerial, repository],
  );

  const setStarred = useCallback(
    (chain: SavedChain, starred: boolean) => {
      registryDispatch({ type: "set-starred", id: chain.id, starred });
      const current = statesRef.current[chain.id];
      if (current)
        void repository
          .save(
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
    [logger, repository],
  );

  const trackerDispatchRef = useRef<Dispatch<TrackerAction>>(() => undefined);
  const dispatch = useCallback<Dispatch<TrackerAction>>(
    (action) => {
      const currentState = statesRef.current[activeId] ?? trackerState;
      const effectiveCurrentState = {
        ...reconcileDemonstrationPackageBindings(currentState, activeId),
        tags,
        preferences,
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
      const nextStates = { ...statesRef.current, [activeId]: nextState };
      statesRef.current = nextStates;
      setStates(nextStates);
    },
    [activeId, logger, preferences, tags, trackerState],
  );

  useEffect(() => {
    trackerDispatchRef.current = dispatch;
  }, [dispatch]);

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
        void repository
          .save(
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
    [logger, registry.chains, repository],
  );

  const remove = useCallback(
    async (id: string) => {
      await initializationRef.current;
      await repository.remove(id);
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
    [logger, repository],
  );

  const resetMockData = useCallback(async () => {
    const restored = createDenseTrackerFixture();
    const aggregate = aggregateFromTracker(
      mockChainDefinition.id,
      restored,
      mockChainDefinition,
    );
    try {
      await initializationRef.current;
      await repository.save(aggregate);
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
  }, [logger, repository]);

  const retrySave = useCallback(async () => {
    if (!activeChain) return;
    await repository.save(
      aggregateFromTracker(activeChain.id, effectiveState, activeChain),
    );
    setSaveError(null);
  }, [activeChain, effectiveState, repository]);

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
    }),
    [
      create,
      open,
      rememberActive,
      remove,
      resetMockData,
      retrySave,
      setStarred,
      updateDetails,
    ],
  );

  return {
    savedChains,
    activeChain,
    effectiveState,
    dispatch,
    saveError,
    commands,
  } as const;
}
