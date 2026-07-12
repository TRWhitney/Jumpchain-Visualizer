export type ModuleId =
  | "body-mod"
  | "essential-body-mod"
  | "warehouse"
  | "personal-reality"
  | "universal-drawbacks"
  | "quest-mode"
  | "story";

export type ToolId =
  | "body"
  | "essential"
  | "essential-progress"
  | "warehouse"
  | "reality"
  | "reality-progress"
  | "drawbacks"
  | "quests"
  | "story";
export const toolModule: Record<ToolId, ModuleId> = {
  body: "body-mod",
  essential: "essential-body-mod",
  "essential-progress": "essential-body-mod",
  warehouse: "warehouse",
  reality: "personal-reality",
  "reality-progress": "personal-reality",
  drawbacks: "universal-drawbacks",
  quests: "quest-mode",
  story: "story",
};

export type SupplementModule = {
  id: ModuleId;
  shortName: string;
  name: string;
  description: string;
  family?: "foundation" | "space";
};

export const modules: readonly SupplementModule[] = [
  {
    id: "body-mod",
    shortName: "Body Mod",
    name: "Classic Body Mod",
    description: "Foundation alternative · full choices and statistics.",
    family: "foundation",
  },
  {
    id: "essential-body-mod",
    shortName: "Essential Body Mod",
    name: "Essential Body Modification",
    description: "Foundation alternative · mutually exclusive with Classic.",
    family: "foundation",
  },
  {
    id: "warehouse",
    shortName: "Cosmic Warehouse",
    name: "Cosmic Warehouse",
    description: "Persistent-space alternative.",
    family: "space",
  },
  {
    id: "personal-reality",
    shortName: "Personal Reality",
    name: "Personal Reality",
    description:
      "Persistent-space alternative · initial choices and accrued points.",
    family: "space",
  },
  {
    id: "universal-drawbacks",
    shortName: "Universal Drawbacks",
    name: "Universal Drawbacks",
    description: "Chain-wide and recurring rule effects.",
  },
  {
    id: "quest-mode",
    shortName: "Quest Mode",
    name: "Quest Mode",
    description: "Per-Jump quests replace ordinary starting CP.",
  },
  {
    id: "story",
    shortName: "Story",
    name: "Story",
    description: "One Live Preview narrative for every Jump.",
  },
] as const;

export type EnabledModules = Record<ModuleId, boolean>;

export const initialEnabled: EnabledModules = {
  "body-mod": true,
  "essential-body-mod": false,
  warehouse: false,
  "personal-reality": true,
  "universal-drawbacks": true,
  "quest-mode": true,
  story: true,
};

export const hasEnabledSupplements = (state: EnabledModules) =>
  modules.some((module) => state[module.id]);

export function setModuleEnabled(
  state: EnabledModules,
  id: ModuleId,
  enabled: boolean,
): EnabledModules {
  const next = { ...state, [id]: enabled };
  const selected = modules.find((module) => module.id === id);
  if (enabled && selected?.family) {
    for (const module of modules) {
      if (module.family === selected.family && module.id !== id)
        next[module.id] = false;
    }
  }
  return next;
}

export type CatalogEntry = {
  id: string;
  name: string;
  costs: readonly number[];
  summary: string;
  category: string;
  requires?: readonly string[];
  conflicts?: readonly string[];
  repeatLimit?: number;
  destination?: "CP" | "EP" | "WP";
  included?: boolean;
  scope?: "chain" | "jump" | "actor" | "supplement";
  sourceExceptions?: readonly string[];
};

export function catalogCost(entry: CatalogEntry, tier: number): number {
  if (tier <= 0) return 0;
  const capped = entry.repeatLimit ? Math.min(tier, entry.repeatLimit) : tier;
  return Array.from(
    { length: capped },
    (_, index) => entry.costs[Math.min(index, entry.costs.length - 1)] ?? 0,
  ).reduce((a, b) => a + b, 0);
}

export function catalogDiagnostics(
  entries: readonly CatalogEntry[],
  selected: ReadonlySet<string>,
): string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const problems: string[] = [];
  for (const id of selected) {
    const entry = byId.get(id);
    if (!entry) problems.push(`Unknown catalog entry: ${id}`);
    for (const requirement of entry?.requires ?? [])
      if (!selected.has(requirement))
        problems.push(
          `${entry?.name} requires ${byId.get(requirement)?.name ?? requirement}.`,
        );
    for (const conflict of entry?.conflicts ?? [])
      if (selected.has(conflict))
        problems.push(
          `${entry?.name} conflicts with ${byId.get(conflict)?.name ?? conflict}.`,
        );
  }
  return [...new Set(problems)];
}
