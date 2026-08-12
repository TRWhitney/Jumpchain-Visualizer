import { translate } from "../localization";

export type ModuleId =
  | "body-mod"
  | "essential-body-mod"
  | "warehouse"
  | "personal-reality"
  | "universal-drawbacks"
  | "quest-mode"
  | "story"
  | "limited-inheritance";

export type ToolId =
  | "body"
  | "essential"
  | "essential-progress"
  | "warehouse"
  | "reality"
  | "reality-progress"
  | "drawbacks"
  | "quests"
  | "story"
  | "limited-inheritance";
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
  "limited-inheritance": "limited-inheritance",
};

export type SupplementModule = {
  id: ModuleId;
  shortName: string;
  name: string;
  description: string;
  family?: "foundation" | "space";
};

const supplementModule = (
  id: ModuleId,
  family?: SupplementModule["family"],
): SupplementModule => ({
  id,
  get shortName() {
    return translate(`supplements.modules.${id}.shortName`);
  },
  get name() {
    return translate(`supplements.modules.${id}.name`);
  },
  get description() {
    return translate(`supplements.modules.${id}.description`);
  },
  family,
});

export const modules: readonly SupplementModule[] = [
  supplementModule("body-mod", "foundation"),
  supplementModule("essential-body-mod", "foundation"),
  supplementModule("warehouse", "space"),
  supplementModule("personal-reality", "space"),
  supplementModule("universal-drawbacks"),
  supplementModule("quest-mode"),
  supplementModule("story"),
  supplementModule("limited-inheritance"),
];

export type EnabledModules = Record<ModuleId, boolean>;

export const initialEnabled: EnabledModules = {
  "body-mod": true,
  "essential-body-mod": false,
  warehouse: false,
  "personal-reality": true,
  "universal-drawbacks": true,
  "quest-mode": true,
  story: true,
  "limited-inheritance": false,
};

export const createUntouchedEnabledModules = (): EnabledModules =>
  Object.fromEntries(
    modules.map((module) => [module.id, false]),
  ) as EnabledModules;

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
    if (!entry)
      problems.push(
        translate("supplements.catalogDiagnostics.unknown", { id }),
      );
    for (const requirement of entry?.requires ?? [])
      if (!selected.has(requirement))
        problems.push(
          translate("supplements.catalogDiagnostics.requires", {
            entry: entry?.name,
            requirement: byId.get(requirement)?.name ?? requirement,
          }),
        );
    for (const conflict of entry?.conflicts ?? [])
      if (selected.has(conflict))
        problems.push(
          translate("supplements.catalogDiagnostics.conflicts", {
            entry: entry?.name,
            conflict: byId.get(conflict)?.name ?? conflict,
          }),
        );
  }
  return [...new Set(problems)];
}
