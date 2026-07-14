import { universalDrawbacksPage } from "../supplements/catalogs";
import { questRows } from "../supplements/parityData";
import type { TrackerState } from "./model";

function entrySupplementState(state: TrackerState, entryId: string) {
  return {
    quest: state.entrySupplements[entryId]?.quest ?? state.supplements.quest,
    uds: state.entrySupplements[entryId]?.uds ?? state.supplements.uds,
    realityProgression:
      state.entrySupplements[entryId]?.realityProgression ??
      state.supplements.reality.progression,
  };
}

function pointGrantForEntry(state: TrackerState, entryId: string) {
  const supplements = entrySupplementState(state, entryId);
  let granted = 0;
  if (state.enabledSupplements["universal-drawbacks"]) {
    const selected = new Set([
      ...supplements.uds.chain,
      ...supplements.uds.jump,
    ]);
    for (const entry of universalDrawbacksPage) {
      if (!selected.has(entry.id)) continue;
      const cost = entry.costs[0] ?? 0;
      granted += supplements.uds.hiatus.includes(entry.id) ? -2 * cost : cost;
    }
  }
  if (state.enabledSupplements["quest-mode"]) {
    const checked = new Set(supplements.quest.checked);
    granted += questRows
      .filter(([id]) => checked.has(id))
      .reduce((sum, [, , award]) => sum + award, 0);
    granted += supplements.quest.switching
      .filter((quest) => checked.has(quest.id))
      .reduce((sum, quest) => sum + quest.award, 0);
    if (supplements.quest.rules.includes("drawback")) {
      if (checked.has("drawback-oathbound")) granted += 200;
      if (checked.has("drawback-mana-static")) granted += 100;
    }
  }
  if (state.enabledSupplements["personal-reality"])
    granted -= supplements.realityProgression.conversionCP;
  return granted;
}

export function supplementEvaluationInputs(
  state: TrackerState,
  order: readonly string[],
) {
  const supplementPointGrants = Object.fromEntries(
    order.map((entryId) => [entryId, pointGrantForEntry(state, entryId)]),
  );
  const jumpState = Object.fromEntries(
    Object.entries(state.jumpState).map(([entryId, entry]) => {
      const uds = entrySupplementState(state, entryId).uds;
      const supplementGauntlet =
        state.enabledSupplements["universal-drawbacks"] &&
        [...uds.chain, ...uds.jump].some((id) =>
          ["gauntlet-kun", "gauntlet-chain"].includes(id),
        );
      return [
        entryId,
        supplementGauntlet
          ? {
              ...entry,
              appliedGauntlet: [
                ...entry.appliedGauntlet.filter(
                  (source) => source.id !== "universal-drawbacks",
                ),
                {
                  id: "universal-drawbacks",
                  kind: "supplement" as const,
                  label: "Universal Drawbacks",
                },
              ],
            }
          : entry,
      ];
    }),
  );
  return {
    jumpState,
    supplementPointGrants,
    startingPointOverrides: state.enabledSupplements["quest-mode"]
      ? Object.fromEntries(order.map((entryId) => [entryId, 0]))
      : undefined,
  };
}
