import { tagCategories, type TagCategory } from "../tracker/model";

export type SavedChain = {
  id: string;
  name: string;
  jumpCount: number;
  lastOpenedSequence: number;
  lastOpenedLabel: string;
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
  | { type: "update-details"; id: string; name: string; description: string };

const tagCounts = (values: readonly number[]): Record<TagCategory, number> =>
  Object.fromEntries(
    tagCategories.map((category, index) => [category, values[index] ?? 0]),
  ) as Record<TagCategory, number>;

const fixtureChains: readonly SavedChain[] = [
  {
    id: "ch-92b1",
    name: "Morgan",
    jumpCount: 8,
    lastOpenedSequence: 80,
    lastOpenedLabel: "Opened yesterday",
    description:
      "A broad chain spanning magic, technology, and distant worlds.",
    tagCounts: tagCounts([8, 13, 9, 24, 5, 7, 18, 16, 12, 11, 19, 6]),
  },
  {
    id: "ch-a410",
    name: "The Ashen Road",
    jumpCount: 14,
    lastOpenedSequence: 70,
    lastOpenedLabel: "Opened 3 days ago",
    description: "A hard-won path built around survival and restoration.",
    tagCounts: tagCounts([5, 8, 16, 9, 3, 11, 27, 25, 22, 7, 4, 8]),
  },
  {
    id: "ch-c208",
    name: "Quiet Stars",
    jumpCount: 6,
    lastOpenedSequence: 60,
    lastOpenedLabel: "Opened last week",
    description: "Exploration, first contact, and a steadily growing crew.",
    tagCounts: tagCounts([18, 17, 5, 3, 6, 8, 9, 7, 12, 14, 28, 10]),
  },
  {
    id: "ch-f731",
    name: "Knights Errant",
    jumpCount: 11,
    lastOpenedSequence: 50,
    lastOpenedLabel: "Opened 2 weeks ago",
    description: "Heroes, rival courts, and promises carried between worlds.",
    tagCounts: tagCounts([26, 8, 14, 12, 4, 5, 17, 29, 21, 6, 3, 7]),
  },
  {
    id: "ch-44de",
    name: "Workshop of Worlds",
    jumpCount: 9,
    lastOpenedSequence: 40,
    lastOpenedLabel: "Opened 3 weeks ago",
    description: "Crafting, invention, and increasingly ambitious projects.",
    tagCounts: tagCounts([4, 14, 6, 15, 7, 3, 10, 8, 12, 31, 27, 5]),
  },
  {
    id: "ch-b890",
    name: "Second Chances",
    jumpCount: 4,
    lastOpenedSequence: 30,
    lastOpenedLabel: "Opened last month",
    description: "A small chain about repair, redemption, and found family.",
    tagCounts: tagCounts([23, 12, 19, 8, 3, 4, 11, 6, 14, 9, 5, 7]),
  },
  {
    id: "ch-701c",
    name: "The Long Library",
    jumpCount: 22,
    lastOpenedSequence: 20,
    lastOpenedLabel: "Opened 2 months ago",
    description: "Knowledge gathered from twenty-two very different settings.",
    tagCounts: tagCounts([15, 34, 23, 31, 18, 12, 20, 17, 19, 26, 29, 14]),
  },
  {
    id: "ch-e117",
    name: "Untamed Horizons",
    jumpCount: 7,
    lastOpenedSequence: 10,
    lastOpenedLabel: "Opened 4 months ago",
    description: "Wild places, strange forms, and no permanent address.",
    tagCounts: tagCounts([9, 11, 15, 18, 2, 17, 32, 21, 16, 8, 6, 13]),
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
        description: "A new chain ready for its first Jump.",
        tagCounts: tagCounts([]),
      },
    },
    nextSequence: state.nextSequence + 1,
    nextSerial: state.nextSerial + 1,
  };
}
