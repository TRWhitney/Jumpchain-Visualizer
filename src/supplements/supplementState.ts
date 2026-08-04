import type { CatalogEntry } from "./model";

export type PurchaseMap = Record<string, number>;
export type EssentialState = {
  category: string;
  search: string;
  startingMode: string;
  essenceMode: string;
  advancementMode: string;
  accessMode: string;
  limiter: string;
  variants: string[];
  essences: string[];
  detail: string | null;
  essenceDetail: string;
  purchases: PurchaseMap;
  dialogFilter: "base" | "skills" | "supernatural";
  progression: {
    advancement: boolean;
    infusion: "none" | "lesser" | "greater";
    category: string;
    search: string;
    purchases: PurchaseMap;
    quests: number[];
  };
};
export type WarehouseState = {
  tab: "intro" | "utilities" | "structures" | "misc" | "review";
  selected: string[];
  stasisPods: number;
};
export type RealityState = {
  category: string;
  search: string;
  detail: string | null;
  coreMode:
    "upfront" | "incremental" | "unlimited" | "reasonable" | "therehouse";
  extraModes: string[];
  purchases: PurchaseMap;
  dialogFilter: "space" | "facilities" | "services";
  progression: {
    award: boolean;
    conversionCP: 0 | 50 | 100;
    category: string;
    search: string;
    purchases: PurchaseMap;
  };
};
export type UdsState = {
  category: string;
  search: string;
  filter: "all" | "selected" | "available";
  chain: string[];
  jump: string[];
  hiatus: string[];
  detail: string | null;
  dialogFilter: "all" | "chain" | "jump" | "choose" | "conflict";
  jumpSearch: string;
};
export type SwitchingQuest = {
  id: string;
  name: string;
  award: 100 | 200 | 400 | 600;
};
export type QuestState = {
  tab: "intro" | "tiers" | "rules";
  rules: string[];
  checked: string[];
  filter: 0 | 100 | 200 | 400 | 600;
  switching: SwitchingQuest[];
};
export type StoryChapter = { id: string; title: string; source: string };
export type StoryJump = { id: string; name: string; chapters: StoryChapter[] };
export type StoryState = {
  jumps: StoryJump[];
  selectedJump: string;
  selectedChapter: string | null;
  editingChapter: string | null;
  saved: string;
};
export type SupplementState = {
  essential: EssentialState;
  warehouse: WarehouseState;
  reality: RealityState;
  uds: UdsState;
  quest: QuestState;
  story: StoryState;
};

export const initialSupplementState: SupplementState = {
  essential: {
    category: "setup",
    search: "",
    startingMode: "standard",
    essenceMode: "single",
    advancementMode: "standard",
    accessMode: "standard",
    limiter: "none",
    variants: [],
    essences: ["Warlord"],
    detail: null,
    essenceDetail: "Warlord",
    purchases: {
      "physical-perfection": 2,
    },
    dialogFilter: "base",
    progression: {
      advancement: false,
      infusion: "none",
      category: "physical",
      search: "",
      purchases: {},
      quests: [],
    },
  },
  warehouse: {
    tab: "utilities",
    selected: [
      "Electricity",
      "Plumbing",
      "Heat / A.C.",
      "Shelving",
      "Terminal",
      "Workshop",
      "Portal",
      "Food Supply",
      "Loft",
    ],
    stasisPods: 0,
  },
  reality: {
    category: "setup",
    search: "",
    detail: null,
    coreMode: "incremental",
    extraModes: [],
    purchases: { "playing-portals": 1, power: 1, pipes: 1 },
    dialogFilter: "space",
    progression: {
      award: false,
      conversionCP: 0,
      category: "utilities",
      search: "",
      purchases: {},
    },
  },
  uds: {
    category: "chain",
    search: "",
    filter: "all",
    chain: ["without-why", "all-by-yourself", "limited-access"],
    jump: ["economic-impact"],
    hiatus: [],
    detail: null,
    dialogFilter: "all",
    jumpSearch: "",
  },
  quest: {
    tab: "intro",
    rules: ["drawback", "switching"],
    checked: ["expert", "form-org"],
    filter: 0,
    switching: [],
  },
  story: {
    selectedJump: "entry-1",
    selectedChapter: null,
    editingChapter: "entry-1:0",
    saved: "",
    jumps: [
      {
        id: "entry-0",
        name: "Threshold of a Thousand Roads",
        chapters: [
          {
            id: "door",
            title: "The First Door",
            source:
              "Morgan stepped through the first bright doorway and entered the city of a thousand roads.",
          },
          {
            id: "choice",
            title: "A Name for the Road",
            source:
              "The road ahead was frightening, but it was finally **theirs to choose**.",
          },
        ],
      },
      {
        id: "entry-1",
        name: "The Confluence Engine",
        chapters: [
          {
            id: "gates",
            title: "The Engine Wakes",
            source:
              "**The Confluence Engine** woke beneath a many-colored sky.",
          },
          {
            id: "market",
            title: "Prism Alignment",
            source:
              "I followed **Lyra** through the gallery, where *every rule* seemed to carry a price.",
          },
          {
            id: "oath",
            title: "",
            source:
              "By dusk, the old alignment was ~~broken~~ ++rewritten++ in {{#74d8a1|engine light}}.",
          },
        ],
      },
      {
        id: "entry-2",
        name: "The Last Trial",
        chapters: [],
      },
    ],
  },
};

export const createUntouchedSupplementState = (): SupplementState => ({
  essential: {
    ...structuredClone(initialSupplementState.essential),
    variants: [],
    essences: [],
    detail: null,
    essenceDetail: "",
    purchases: {},
    progression: {
      ...structuredClone(initialSupplementState.essential.progression),
      purchases: {},
      quests: [],
    },
  },
  warehouse: {
    ...structuredClone(initialSupplementState.warehouse),
    selected: [],
    stasisPods: 0,
  },
  reality: {
    ...structuredClone(initialSupplementState.reality),
    detail: null,
    extraModes: [],
    purchases: {},
    progression: {
      ...structuredClone(initialSupplementState.reality.progression),
      award: false,
      conversionCP: 0,
      purchases: {},
    },
  },
  uds: {
    ...structuredClone(initialSupplementState.uds),
    chain: [],
    jump: [],
    hiatus: [],
    detail: null,
  },
  quest: {
    ...structuredClone(initialSupplementState.quest),
    rules: [],
    checked: [],
    switching: [],
  },
  story: {
    selectedJump: "",
    selectedChapter: null,
    editingChapter: null,
    saved: "",
    jumps: [],
  },
});

export type SupplementAction =
  | { type: "essential"; update: Partial<EssentialState> }
  | {
      type: "essentialProgress";
      update: Partial<EssentialState["progression"]>;
    }
  | { type: "warehouse"; update: Partial<WarehouseState> }
  | { type: "reality"; update: Partial<RealityState> }
  | { type: "realityProgress"; update: Partial<RealityState["progression"]> }
  | { type: "uds"; update: Partial<UdsState> }
  | { type: "quest"; update: Partial<QuestState> }
  | { type: "story"; update: Partial<StoryState> };

export function supplementReducer(
  state: SupplementState,
  action: SupplementAction,
): SupplementState {
  if (action.type === "essentialProgress")
    return {
      ...state,
      essential: {
        ...state.essential,
        progression: { ...state.essential.progression, ...action.update },
      },
    };
  if (action.type === "realityProgress")
    return {
      ...state,
      reality: {
        ...state.reality,
        progression: { ...state.reality.progression, ...action.update },
      },
    };
  return {
    ...state,
    [action.type]: { ...state[action.type], ...action.update },
  } as SupplementState;
}

export const toggleValue = (values: readonly string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
export const purchaseTotal = (
  entries: readonly CatalogEntry[],
  purchases: PurchaseMap,
) =>
  entries.reduce(
    (sum, entry) =>
      sum +
      Array.from(
        { length: purchases[entry.id] ?? 0 },
        (_, index) => entry.costs[Math.min(index, entry.costs.length - 1)] ?? 0,
      ).reduce((a, b) => a + b, 0),
    0,
  );
export const tierPrice = (entry: CatalogEntry, tier: number) =>
  tier <= 0 || entry.included
    ? 0
    : (entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ?? 0);
export const nextTierCost = (
  entry: CatalogEntry,
  currentTier: number,
  targetTier: number,
) => Math.max(0, tierPrice(entry, targetTier) - tierPrice(entry, currentTier));
export const essentialAdvancementAward = (
  mode: string,
  recorded: boolean,
  quests: readonly number[],
) =>
  mode === "questing"
    ? quests.reduce((sum, award) => sum + award, 0)
    : recorded
      ? mode === "heroic"
        ? 50
        : mode === "meteoric"
          ? 100
          : 0
      : 0;
export const realityModeAward = (mode: string, recorded: boolean) =>
  recorded && mode === "incremental"
    ? 50
    : recorded && mode === "reasonable"
      ? 100
      : 0;
export const words = (source: string) =>
  source
    .replace(/\{\{#[0-9a-fA-F]{6}\|([^}\n]+?)\}\}/g, "$1")
    .replace(/\+\+/g, "")
    .replace(/<[^>]+>|[*~]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
export const storyWordCount = (story: StoryState, jumpId?: string) =>
  story.jumps
    .filter((jump) => !jumpId || jump.id === jumpId)
    .flatMap((jump) => jump.chapters)
    .reduce((sum, chapter) => sum + words(chapter.source), 0);
