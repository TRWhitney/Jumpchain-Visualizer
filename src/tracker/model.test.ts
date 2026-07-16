import { describe, expect, it } from "vitest";
import {
  createDenseTrackerFixture,
  createReferenceTrackerFixture,
} from "./fixtures";
import {
  aggregateInventoryRecords,
  filteredInventory,
  EARTH_ENTRY_ID,
  jumpEntryIds,
  jumpNumber,
  moveDependencyImpacts,
  packageForEntry,
  radarCounts,
  removeDependencyImpacts,
  tagCategories,
  tagBreakdown,
  tagIsWithin,
  trackerReducer,
  visibleTagBreakdownSlices,
  visibleCompanions,
  visibleForms,
} from "./model";
import { evaluateTracker, projectEvaluation } from "./evaluateTracker";

function heroAcademyState(
  choices: Record<string, boolean | string | number | null>,
  allowNegativePointBalances = false,
) {
  const added = trackerReducer(
    createDenseTrackerFixture({ allowNegativePointBalances }),
    { type: "add-package", packageId: "hero-academy" },
  );
  const entryId = added.selectedEntryId;
  const entry = added.jumpState[entryId];
  const actor = entry.actors.jumper;
  return {
    entryId,
    state: {
      ...added,
      jumpState: {
        ...added.jumpState,
        [entryId]: {
          ...entry,
          actors: {
            ...entry.actors,
            jumper: { ...actor, choices },
          },
        },
      },
    },
  };
}

function firstStepWithoutSupplementPoints() {
  const fixture = createDenseTrackerFixture({
    allowNegativePointBalances: true,
  });
  const entryId = "entry-0";
  const current = fixture.entrySupplements[entryId];
  return {
    ...fixture,
    selectedEntryId: entryId,
    enabledSupplements: {
      ...fixture.enabledSupplements,
      "quest-mode": false,
    },
    entrySupplements: {
      ...fixture.entrySupplements,
      [entryId]: {
        ...current,
        uds: { ...current.uds, chain: [], jump: [] },
      },
    },
  };
}

describe("Chain Tracker aggregate", () => {
  it("ships complete deterministic dense and reference fixtures", () => {
    const dense = createDenseTrackerFixture();
    const reference = createReferenceTrackerFixture();
    expect(dense.order).toHaveLength(9);
    expect(dense.order[0]).toBe(EARTH_ENTRY_ID);
    expect(jumpEntryIds(dense)).toHaveLength(8);
    expect(Object.keys(dense.packages).length).toBeGreaterThanOrEqual(12);
    expect(
      Object.values(dense.packages)
        .filter((packageItem) => packageItem.availability !== "foundation")
        .every((packageItem) => packageItem.tags.length),
    ).toBe(true);
    expect(dense.records).toHaveLength(60);
    expect(
      dense.records.filter((record) => record.kind === "perk"),
    ).toHaveLength(40);
    expect(
      dense.records.filter((record) => record.kind === "item"),
    ).toHaveLength(20);
    expect(dense.forms).toHaveLength(0);
    expect(dense.companions).toHaveLength(7);
    expect(
      Object.values(dense.tags).filter((tag) => tag.parent).length,
    ).toBeGreaterThanOrEqual(37);
    expect(reference.order).toHaveLength(4);
    expect(jumpEntryIds(reference)).toHaveLength(3);
  });

  it("projects substantive inventory, companions, and radar data from evaluated choices", () => {
    const fixture = createDenseTrackerFixture();
    const evaluation = evaluateTracker(fixture, fixture.bodyMod);
    const projected = projectEvaluation(fixture, evaluation);
    expect(projected.records.length).toBeGreaterThanOrEqual(60);
    expect(
      Object.values(projected.actors).filter(
        (actor) => actor.role === "Companion",
      ).length,
    ).toBeGreaterThanOrEqual(7);
    expect(projected.companions.length).toBeGreaterThanOrEqual(7);
    expect(projected.forms).toMatchObject([
      { handle: "dragon_form", name: "Dragon Form" },
    ]);
    expect(
      projected.records.filter((record) => record.name === "Impossible Vessel"),
    ).toHaveLength(3);
    expect(
      filteredInventory(projected).filter(
        (record) => record.name === "Impossible Vessel",
      ),
    ).toMatchObject([{ ownerActorId: "jumper" }]);
    expect(
      filteredInventory(projected).some(
        (record) => record.name === "Draconic Resilience",
      ),
    ).toBe(false);
    expect(
      projected.records.find((record) => record.name === "Random Training")
        ?.measure,
    ).toEqual({ kind: "rank", value: 3 });
    expect(
      Object.values(radarCounts(projected)).every((count) => count > 0),
    ).toBe(true);
    const magic = tagBreakdown(projected, "magic");
    expect(magic?.children.length).toBeGreaterThan(9);
  });

  it("preserves stored selections while disabling an unavailable exact package", () => {
    const fixture = createDenseTrackerFixture();
    const lastValidatedEvaluation = evaluateTracker(fixture, fixture.bodyMod);
    const unavailable = {
      ...fixture,
      lastValidatedEvaluation,
      entries: {
        ...fixture.entries,
        "entry-2": {
          ...fixture.entries["entry-2"],
          packageExactHash: "sha256:package-version-not-installed",
        },
      },
    };
    const storedChoices = unavailable.jumpState["entry-2"].actors.jumper;

    expect(packageForEntry(unavailable, "entry-2").document).toBeUndefined();
    const recovered = evaluateTracker(unavailable, unavailable.bodyMod);
    expect(recovered.runtime["entry-2"]).toEqual(
      lastValidatedEvaluation.runtime["entry-2"],
    );
    expect(
      recovered.records.some((record) => record.sourceEntryId === "entry-2"),
    ).toBe(true);
    expect(unavailable.jumpState["entry-2"].actors.jumper).toBe(storedChoices);
  });

  it("keeps stable entry identity through reviewed reorder and undo", () => {
    const initial = createDenseTrackerFixture({ warnUpstreamChanges: true });
    const requested = trackerReducer(initial, {
      type: "request-move",
      entryId: "entry-1",
      toIndex: 7,
    });
    expect(requested.pending?.kind).toBe("move");
    const moved = trackerReducer(requested, { type: "commit-mutation" });
    expect(moved.order[7]).toBe("entry-1");
    expect(moved.entries["entry-1"].packageId).toBe("arcane-realms");
    expect(trackerReducer(moved, { type: "undo" }).order).toEqual(
      initial.order,
    );
  });

  it("commits an unaffected reorder immediately", () => {
    const initial = trackerReducer(createDenseTrackerFixture(), {
      type: "add-package",
      packageId: "hero-academy",
    });
    const moved = trackerReducer(initial, {
      type: "request-move",
      entryId: "entry-8",
      toIndex: 2,
    });
    expect(moved.pending).toBeNull();
    expect(moved.order[2]).toBe("entry-8");
    expect(moved.undo?.label).toBe("Reorder");
    const dismissed = trackerReducer(moved, { type: "dismiss-undo" });
    expect(dismissed.order).toEqual(moved.order);
    expect(dismissed.undo).toBeNull();
  });

  it("commits material changes immediately when upstream warnings are disabled", () => {
    const initial = createDenseTrackerFixture();
    const moved = trackerReducer(initial, {
      type: "request-move",
      entryId: "entry-1",
      toIndex: 7,
    });
    expect(moved.pending).toBeNull();
    expect(moved.order[7]).toBe("entry-1");
    expect(moved.undo?.label).toBe("Reorder");
  });

  it("warns only when reorder invalidates a valid companion import", () => {
    const state = createDenseTrackerFixture({ warnUpstreamChanges: true });
    const impacts = moveDependencyImpacts(state, "entry-1", 7);
    expect(impacts).toEqual([
      expect.objectContaining({
        kind: "companion-import",
        subjectId: "companion:entry-1:jumper:spellcraft_foundations:4",
        providerEntryId: "entry-1",
        consumerEntryIds: ["entry-5"],
      }),
    ]);
    const withUnrelatedEntry = trackerReducer(state, {
      type: "add-package",
      packageId: "hero-academy",
    });
    const unaffected = trackerReducer(withUnrelatedEntry, {
      type: "request-move",
      entryId: "entry-8",
      toIndex: 6,
    });
    expect(unaffected.pending).toBeNull();
  });

  it("reviews destructive removal, restores it through undo, and re-adds a fresh entry", () => {
    const initial = createDenseTrackerFixture({ warnUpstreamChanges: true });
    const requested = trackerReducer(initial, {
      type: "request-remove",
      entryId: "entry-6",
    });
    expect(requested.pending?.impacts).toEqual([
      expect.objectContaining({
        subjectId: "companion:entry-6:jumper:banner_command:4",
        providerEntryId: "entry-6",
      }),
    ]);
    const removed = trackerReducer(requested, { type: "commit-mutation" });
    expect(removed.entries["entry-6"]).toBeUndefined();
    expect(removed.jumpState["entry-6"]).toBeUndefined();
    const restored = trackerReducer(removed, { type: "undo" });
    expect(restored.entries["entry-6"].packageId).toBe("war-of-crowns");
    expect(restored.jumpState["entry-6"]).toBeDefined();
    const removedAgain = trackerReducer(
      trackerReducer(restored, {
        type: "request-remove",
        entryId: "entry-6",
      }),
      { type: "commit-mutation" },
    );
    const added = trackerReducer(removedAgain, {
      type: "add-package",
      packageId: "war-of-crowns",
    });
    expect(added.selectedEntryId).toBe("entry-8");
  });

  it("does not warn when deleting only a companion importer", () => {
    const initial = createDenseTrackerFixture({ warnUpstreamChanges: true });
    expect(removeDependencyImpacts(initial, "entry-7")).toEqual([]);
    const removed = trackerReducer(initial, {
      type: "request-remove",
      entryId: "entry-7",
    });
    expect(removed.pending).toBeNull();
    expect(removed.entries["entry-7"]).toBeUndefined();
  });

  it("applies application package policy without duplicating exact versions", () => {
    const initial = createDenseTrackerFixture();
    const blocked = trackerReducer(initial, {
      type: "add-package",
      packageId: "arcane-realms-v1-1",
    });
    expect(blocked.order).toHaveLength(initial.order.length);
    const enabled = trackerReducer(initial, {
      type: "apply-application-settings",
      preferences: {
        ...initial.preferences,
        allowMultiplePackageVersions: true,
      },
      tags: initial.tags,
    });
    const added = trackerReducer(enabled, {
      type: "add-package",
      packageId: "arcane-realms-v1-1",
    });
    expect(added.order).toHaveLength(initial.order.length + 1);
    const duplicate = trackerReducer(added, {
      type: "add-package",
      packageId: "arcane-realms-v1-1",
    });
    expect(duplicate.order).toHaveLength(added.order.length);

    const duplicateEnabled = trackerReducer(added, {
      type: "apply-application-settings",
      preferences: { ...added.preferences, allowDuplicateJumps: true },
      tags: added.tags,
    });
    const duplicated = trackerReducer(duplicateEnabled, {
      type: "add-package",
      packageId: "arcane-realms-v1-1",
    });
    expect(duplicated.order).toHaveLength(added.order.length + 1);
    expect(
      duplicated.jumpState[duplicated.selectedEntryId].actors.jumper.choices,
    ).toEqual({});
  });

  it("aggregates identical ranks as copies while keeping different ranks separate", () => {
    const common = {
      kind: "perk" as const,
      name: "Random Training",
      ownerActorId: "jumper",
      tags: [],
      description: "Training resolved for this Jump.",
      grantHandle: "random_training:0",
      sourcePackageId: "cosmic-odyssey",
      sourcePackageExactHash: "same-hash",
    };
    const records = aggregateInventoryRecords([
      {
        ...common,
        id: "one",
        sourceEntryId: "entry-2",
        measure: { kind: "rank", value: 3 },
      },
      {
        ...common,
        id: "two",
        sourceEntryId: "entry-9",
        measure: { kind: "rank", value: 3 },
      },
      {
        ...common,
        id: "three",
        sourceEntryId: "entry-10",
        measure: { kind: "rank", value: 2 },
      },
    ]);
    expect(records).toMatchObject([
      { measure: { kind: "rank", value: 3 }, aggregateQuantity: 2 },
      { measure: { kind: "rank", value: 2 }, aggregateQuantity: undefined },
    ]);
  });

  it("rejects form-targeted perks without their form and clears dependents with it", () => {
    const initial = createDenseTrackerFixture();
    const reviewed = trackerReducer(initial, {
      type: "set-choice",
      entryId: "entry-1",
      actorId: "jumper",
      choiceHandle: "dragon_form",
      value: false,
    });
    expect(reviewed.pending).toMatchObject({ kind: "clear-form" });
    const cleared = trackerReducer(reviewed, { type: "commit-mutation" });
    expect(
      cleared.jumpState["entry-1"].actors.jumper.choices.draconic_resilience,
    ).toBeNull();
    const rejected = trackerReducer(cleared, {
      type: "set-choice",
      entryId: "entry-1",
      actorId: "jumper",
      choiceHandle: "draconic_resilience",
      value: true,
    });
    expect(rejected).toBe(cleared);
  });

  it("derives historical rosters without changing the selected Jump", () => {
    const fixture = createDenseTrackerFixture();
    let state = projectEvaluation(
      fixture,
      evaluateTracker(fixture, fixture.bodyMod),
    );
    state = trackerReducer(state, {
      type: "set-inspection",
      entryId: "entry-2",
    });
    expect(state.selectedEntryId).toBe("entry-7");
    expect(visibleForms(state)).toHaveLength(1);
    expect(visibleCompanions(state)).toHaveLength(3);
    expect(
      filteredInventory(state).every((record) => {
        const position = state.order.indexOf(record.sourceEntryId);
        return position >= 1 && position <= 3;
      }),
    ).toBe(true);
  });

  it("keeps Earth unnumbered and rejects every mutation path", () => {
    const initial = createDenseTrackerFixture();
    expect(jumpNumber(initial, EARTH_ENTRY_ID)).toBeNull();
    expect(jumpNumber(initial, "entry-0")).toBe(1);
    expect(
      trackerReducer(initial, {
        type: "request-move",
        entryId: EARTH_ENTRY_ID,
        toIndex: 4,
      }),
    ).toBe(initial);
    expect(
      trackerReducer(initial, {
        type: "request-remove",
        entryId: EARTH_ENTRY_ID,
      }),
    ).toBe(initial);
    const moved = trackerReducer(initial, {
      type: "request-move",
      entryId: "entry-0",
      toIndex: 0,
    });
    expect(moved.order[0]).toBe(EARTH_ENTRY_ID);
    expect(moved.order[1]).toBe("entry-0");
  });

  it("uses Earth as an empty, unnumbered historical cutoff", () => {
    const state = trackerReducer(createDenseTrackerFixture(), {
      type: "set-inspection",
      entryId: EARTH_ENTRY_ID,
    });
    expect(filteredInventory(state)).toEqual([]);
    expect(visibleForms(state)).toEqual([]);
    expect(visibleCompanions(state)).toEqual([]);
    expect(state.selectedEntryId).toBe("entry-7");
  });

  it("filters by descendant tags and aliases", () => {
    let state = createDenseTrackerFixture();
    expect(tagIsWithin(state, "pyrokinesis", "magic")).toBe(true);
    state = trackerReducer(state, {
      type: "set-inventory-tag",
      value: "magic",
    });
    expect(
      filteredInventory(state).every((record) =>
        record.tags.some((tag) => tagIsWithin(state, tag, "magic")),
      ),
    ).toBe(true);
    state = trackerReducer(state, {
      type: "set-inventory-search",
      value: "Fire Control",
    });
    expect(
      filteredInventory(state).some((record) =>
        record.tags.includes("pyrokinesis"),
      ),
    ).toBe(true);
  });

  it("scopes Inventory to the Jumper and radar records to the Jumper and forms", () => {
    const fixture = createDenseTrackerFixture();
    const template = fixture.records[0];
    const state = {
      ...fixture,
      records: [
        {
          ...template,
          id: "jumper-perk",
          kind: "perk" as const,
          ownerActorId: "jumper",
          ownerFormId: undefined,
          tags: ["magic"],
        },
        {
          ...template,
          id: "form-perk",
          kind: "perk" as const,
          ownerActorId: undefined,
          ownerFormId: "form:magic",
          tags: ["magic"],
        },
        {
          ...template,
          id: "companion-perk",
          kind: "perk" as const,
          ownerActorId: "ash",
          ownerFormId: undefined,
          tags: ["magic"],
        },
        {
          ...template,
          id: "jumper-item",
          kind: "item" as const,
          ownerActorId: "jumper",
          ownerFormId: undefined,
          tags: ["magic"],
        },
        {
          ...template,
          id: "form-item",
          kind: "item" as const,
          ownerActorId: undefined,
          ownerFormId: "form:magic",
          tags: ["magic"],
        },
        {
          ...template,
          id: "companion-item",
          kind: "item" as const,
          ownerActorId: "ash",
          ownerFormId: undefined,
          tags: ["magic"],
        },
      ],
    };

    expect(filteredInventory(state).map((record) => record.id)).toEqual([
      "jumper-perk",
      "jumper-item",
    ]);
    expect(radarCounts(state).magic).toBe(2);
    expect(tagBreakdown(state, "magic")?.count).toBe(2);
    const withItems = {
      ...state,
      preferences: { ...state.preferences, includeItemTagsInRadar: true },
    };
    expect(radarCounts(withItems).magic).toBe(4);
    expect(tagBreakdown(withItems, "magic")?.count).toBe(4);
  });

  it("populates every fixed radar axis with uneven perk counts", () => {
    const fixture = createDenseTrackerFixture();
    const counts = radarCounts({
      ...fixture,
      records: fixture.records.map((record) => ({
        ...record,
        ownerActorId: "jumper",
      })),
    });
    expect(Object.keys(counts)).toEqual(tagCategories);
    expect(Object.values(counts).every((count) => count > 0)).toBe(true);
    expect(new Set(Object.values(counts)).size).toBeGreaterThan(2);
  });

  it("partitions hierarchical tag counts and aggregates excess slices", () => {
    const fixture = createDenseTrackerFixture();
    const state = {
      ...fixture,
      records: fixture.records.map((record) => ({
        ...record,
        ownerActorId: "jumper",
      })),
    };
    const magic = tagBreakdown(state, "magic");
    expect(magic).not.toBeNull();
    expect(
      magic?.children.reduce((total, child) => total + child.count, 0),
    ).toBe(magic?.count);
    expect(magic?.children.length).toBeGreaterThan(9);
    const slices = visibleTagBreakdownSlices(magic!, state.tags.magic.color);
    expect(slices).toHaveLength(10);
    expect(slices.at(-1)).toMatchObject({ key: "slice-more", isMore: true });
    expect(slices.at(-1)?.node.children.length).toBeGreaterThan(0);
    const pyrokinesis = magic?.children.find(
      (child) => child.id === "pyrokinesis",
    );
    expect(pyrokinesis?.aliases).toContain("Fire Control");
    expect(pyrokinesis?.children.length).toBeGreaterThan(1);
  });

  it("stores independent actor choice state", () => {
    const initial = createDenseTrackerFixture();
    const next = trackerReducer(initial, {
      type: "set-choice",
      entryId: "entry-0",
      actorId: "jumper",
      choiceHandle: "wanderer",
      value: false,
    });
    expect(next.jumpState["entry-0"].actors.jumper.choices.wanderer).toBe(
      false,
    );
    expect(initial.jumpState["entry-0"].actors.jumper.choices.wanderer).toBe(
      true,
    );
  });

  it("blocks only active choice selections that would create a negative primary balance", () => {
    const { state, entryId } = heroAcademyState({
      power_rank: 1,
      extra_lives: 1,
      element: "Fire",
      manual_arcane: true,
      night_vision: true,
    });

    const blocked = trackerReducer(state, {
      type: "set-choice",
      entryId,
      actorId: "jumper",
      choiceHandle: "manual_flight",
      value: true,
    });
    expect(
      blocked.jumpState[entryId].actors.jumper.choices.manual_flight,
    ).toBeUndefined();

    const permitted = trackerReducer(
      {
        ...state,
        preferences: {
          ...state.preferences,
          allowNegativePointBalances: true,
        },
      },
      {
        type: "set-choice",
        entryId,
        actorId: "jumper",
        choiceHandle: "manual_flight",
        value: true,
      },
    );
    expect(
      permitted.jumpState[entryId].actors.jumper.choices.manual_flight,
    ).toBe(true);
  });

  it("allows an inactive choice change even when recalculation creates a deficit", () => {
    const { state, entryId } = heroAcademyState({
      power_rank: 1,
      extra_lives: 1,
      element: "Fire",
      manual_arcane: true,
      manual_wanderer: true,
      danger_stipend: "Accept",
    });

    const clearedAward = trackerReducer(state, {
      type: "set-choice",
      entryId,
      actorId: "jumper",
      choiceHandle: "danger_stipend",
      value: null,
    });
    expect(
      clearedAward.jumpState[entryId].actors.jumper.choices.danger_stipend,
    ).toBeNull();

    const appliedGauntlet = trackerReducer(state, {
      type: "toggle-applied-gauntlet",
      entryId,
    });
    expect(appliedGauntlet.jumpState[entryId].appliedGauntlet).toHaveLength(1);

    const ranked = heroAcademyState({
      power_rank: 1,
      combat_training: 5,
    });
    const reducedRank = trackerReducer(ranked.state, {
      type: "set-choice",
      entryId: ranked.entryId,
      actorId: "jumper",
      choiceHandle: "combat_training",
      value: 4,
    });
    expect(
      reducedRank.jumpState[ranked.entryId].actors.jumper.choices
        .combat_training,
    ).toBe(4);
  });

  it("allows free rolled selections because they do not create a negative balance", () => {
    const { state, entryId } = heroAcademyState({
      power_rank: 1,
      extra_lives: 1,
      element: "Fire",
      manual_arcane: true,
    });

    const freeChoiceRoll = trackerReducer(state, {
      type: "record-choice-roll",
      entryId,
      actorId: "jumper",
      choiceHandle: "random_age",
      result: 24,
    });
    expect(
      freeChoiceRoll.jumpState[entryId].actors.jumper.choiceRolls.random_age,
    ).toEqual({ result: 24, sequence: 1 });

    const freeSourceRoll = trackerReducer(state, {
      type: "record-source-roll",
      entryId,
      actorId: "jumper",
      sourceKey: "multi_random:electives",
      result: "random_arcane",
    });
    expect(
      freeSourceRoll.jumpState[entryId].actors.jumper.sourceRolls[
        "multi_random:electives"
      ],
    ).toEqual({ result: "random_arcane", sequence: 1 });
  });

  it("recalculates First Step when Gauntlet or Quest Mode removes starting points", () => {
    const ordinary = firstStepWithoutSupplementPoints();
    expect(
      evaluateTracker(ordinary, ordinary.bodyMod).runtime["entry-0"].actors
        .jumper.balance,
    ).toBe(600);

    const gauntlet = trackerReducer(ordinary, {
      type: "toggle-applied-gauntlet",
      entryId: "entry-0",
    });
    expect(
      evaluateTracker(gauntlet, gauntlet.bodyMod).runtime["entry-0"].actors
        .jumper.balance,
    ).toBe(-400);

    const questMode = trackerReducer(ordinary, {
      type: "set-enabled-supplements",
      value: { ...ordinary.enabledSupplements, "quest-mode": true },
    });
    expect(
      evaluateTracker(questMode, questMode.bodyMod).runtime["entry-0"].actors
        .jumper.balance,
    ).toBe(-400);
  });

  it("attributes Personal Reality CP conversion to one Jump and refunds it when disabled", () => {
    const ordinary = firstStepWithoutSupplementPoints();
    const converted = trackerReducer(ordinary, {
      type: "supplement-action",
      action: { type: "realityProgress", update: { conversionCP: 100 } },
    });
    expect(
      evaluateTracker(converted, converted.bodyMod).runtime["entry-0"].actors
        .jumper.balance,
    ).toBe(500);
    expect(
      converted.entrySupplements["entry-0"].realityProgression?.conversionCP,
    ).toBe(100);
    expect(
      converted.entrySupplements["entry-1"].realityProgression,
    ).toBeUndefined();

    const disabled = trackerReducer(converted, {
      type: "set-enabled-supplements",
      value: { ...converted.enabledSupplements, "personal-reality": false },
    });
    expect(
      evaluateTracker(disabled, disabled.bodyMod).runtime["entry-0"].actors
        .jumper.balance,
    ).toBe(600);
  });
});
