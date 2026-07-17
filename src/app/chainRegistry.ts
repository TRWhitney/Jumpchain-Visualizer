import { tagCategories, type TagCategory } from "../tracker/model";

export type SavedChain = {
  id: string;
  name: string;
  jumpCount: number;
  lastOpenedSequence: number;
  lastOpenedLabel: string;
  starred: boolean;
  description: string;
  tagCounts: Record<TagCategory, number>;
};

export type ChainRegistryState = {
  chains: Record<string, SavedChain>;
  nextSequence: number;
  nextSerial: number;
};

export type ChainRegistryAction =
  | { type: "open"; id: string }
  | { type: "create"; id: string; name: string }
  | {
      type: "hydrate";
      id: string;
      name: string;
      description: string;
      lastOpenedSequence: number;
      lastOpenedLabel: string;
      starred?: boolean;
    }
  | { type: "set-starred"; id: string; starred: boolean }
  | { type: "update-details"; id: string; name: string; description: string };

const tagCounts = (values: readonly number[]): Record<TagCategory, number> =>
  Object.fromEntries(
    tagCategories.map((category, index) => [category, values[index] ?? 0]),
  ) as Record<TagCategory, number>;

const fixtureChains: readonly SavedChain[] = [
  {
    id: "ch-92b1",
    name: "Morgan",
    jumpCount: 3,
    lastOpenedSequence: 80,
    lastOpenedLabel: "Opened yesterday",
    starred: false,
    description:
      "A three-Jump demonstration chain spanning every Format 1 capability.",
    tagCounts: tagCounts([4, 5, 3, 6, 5, 2, 4, 7, 5, 5, 6, 4]),
  },
];

export function createChainRegistryFixture(): ChainRegistryState {
  return {
    chains: Object.fromEntries(fixtureChains.map((chain) => [chain.id, chain])),
    nextSequence: 81,
    nextSerial: 1,
  };
}

export function orderedChains(state: ChainRegistryState) {
  return Object.values(state.chains).sort(
    (left, right) =>
      Number(right.starred) - Number(left.starred) ||
      right.lastOpenedSequence - left.lastOpenedSequence ||
      left.name.localeCompare(right.name),
  );
}

export function normalizeChainName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function filterSavedChains(
  chains: readonly SavedChain[],
  query: string,
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return chains;
  return chains.filter((chain) => {
    const searchable = `${chain.name} ${chain.description}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function primaryTagForChain(chain: SavedChain): TagCategory | null {
  return tagCategories.reduce<TagCategory | null>((primary, category) => {
    if (chain.tagCounts[category] <= 0) return primary;
    if (!primary || chain.tagCounts[category] > chain.tagCounts[primary])
      return category;
    return primary;
  }, null);
}

export function chainRegistryReducer(
  state: ChainRegistryState,
  action: ChainRegistryAction,
): ChainRegistryState {
  if (action.type === "hydrate") {
    const existing = state.chains[action.id];
    const sequence = Math.max(0, Math.trunc(action.lastOpenedSequence));
    const localSerial = action.id.match(/^ch-new-(\d+)$/)?.[1];
    return {
      ...state,
      chains: {
        ...state.chains,
        [action.id]: {
          id: action.id,
          name: normalizeChainName(action.name) || "Untitled Chain",
          description: action.description.trim(),
          lastOpenedSequence: sequence,
          lastOpenedLabel: action.lastOpenedLabel,
          starred: Boolean(action.starred),
          jumpCount: existing?.jumpCount ?? 0,
          tagCounts: existing?.tagCounts ?? tagCounts([]),
        },
      },
      nextSequence: Math.max(state.nextSequence, sequence + 1),
      nextSerial: localSerial
        ? Math.max(state.nextSerial, Number(localSerial) + 1)
        : state.nextSerial,
    };
  }
  if (action.type === "open") {
    const chain = state.chains[action.id];
    if (!chain) return state;
    return {
      ...state,
      chains: {
        ...state.chains,
        [action.id]: {
          ...chain,
          lastOpenedSequence: state.nextSequence,
          lastOpenedLabel: "Opened just now",
        },
      },
      nextSequence: state.nextSequence + 1,
    };
  }

  if (action.type === "set-starred") {
    const chain = state.chains[action.id];
    if (!chain || chain.starred === action.starred) return state;
    return {
      ...state,
      chains: {
        ...state.chains,
        [action.id]: { ...chain, starred: action.starred },
      },
    };
  }

  const name = normalizeChainName(action.name);
  if (!name) return state;

  if (action.type === "update-details") {
    const chain = state.chains[action.id];
    if (!chain) return state;
    return {
      ...state,
      chains: {
        ...state.chains,
        [action.id]: {
          ...chain,
          name,
          description: action.description.trim(),
        },
      },
    };
  }

  return {
    ...state,
    chains: {
      ...state.chains,
      [action.id]: {
        id: action.id,
        name,
        jumpCount: 0,
        lastOpenedSequence: state.nextSequence,
        lastOpenedLabel: "Opened just now",
        starred: false,
        description: "A new chain ready for its first Jump.",
        tagCounts: tagCounts([]),
      },
    },
    nextSequence: state.nextSequence + 1,
    nextSerial: state.nextSerial + 1,
  };
}
