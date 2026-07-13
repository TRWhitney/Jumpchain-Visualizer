import { describe, expect, it } from "vitest";
import {
  createDenseTrackerFixture,
  createReferenceTrackerFixture,
} from "./fixtures";
import {
  filteredInventory,
  moveDependencyImpacts,
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

describe("Chain Tracker aggregate", () => {
  it("ships complete deterministic dense and reference fixtures", () => {
    const dense = createDenseTrackerFixture();
    const reference = createReferenceTrackerFixture();
    expect(dense.order).toHaveLength(8);
    expect(Object.keys(dense.packages).length).toBeGreaterThanOrEqual(12);
    expect(
      Object.values(dense.packages).every(
        (packageItem) => packageItem.tags.length,
      ),
    ).toBe(true);
    expect(dense.records).toHaveLength(60);
    expect(
      dense.records.filter((record) => record.kind === "perk"),
    ).toHaveLength(40);
    expect(
      dense.records.filter((record) => record.kind === "item"),
    ).toHaveLength(20);
    expect(dense.forms).toHaveLength(8);
    expect(dense.companions).toHaveLength(7);
    expect(
      Object.values(dense.tags).filter((tag) => tag.parent).length,
    ).toBeGreaterThanOrEqual(37);
    expect(reference.order).toHaveLength(3);
  });

  it("keeps stable entry identity through reviewed reorder and undo", () => {
    const initial = createDenseTrackerFixture({ warnUpstreamChanges: true });
    const requested = trackerReducer(initial, {
      type: "request-move",
      entryId: "entry-1",
      toIndex: 6,
    });
    expect(requested.pending?.kind).toBe("move");
    const moved = trackerReducer(requested, { type: "commit-mutation" });
    expect(moved.order[6]).toBe("entry-1");
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
  });

  it("commits material changes immediately when upstream warnings are disabled", () => {
    const initial = createDenseTrackerFixture();
    const moved = trackerReducer(initial, {
      type: "request-move",
      entryId: "entry-1",
      toIndex: 6,
    });
    expect(moved.pending).toBeNull();
    expect(moved.order[6]).toBe("entry-1");
    expect(moved.undo?.label).toBe("Reorder");
  });

  it("warns only when reorder invalidates a valid companion import", () => {
    const state = createDenseTrackerFixture({ warnUpstreamChanges: true });
    const impacts = moveDependencyImpacts(state, "entry-1", 6);
    expect(impacts).toEqual([
      expect.objectContaining({
        kind: "companion-import",
        subjectId: "mira",
        providerEntryId: "entry-1",
        consumerEntryIds: [
          "entry-2",
          "entry-3",
          "entry-4",
          "entry-5",
          "entry-6",
        ],
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
      entryId: "entry-2",
    });
    expect(requested.pending?.impacts).toEqual([
      expect.objectContaining({ subjectId: "io", providerEntryId: "entry-2" }),
    ]);
    const removed = trackerReducer(requested, { type: "commit-mutation" });
    expect(removed.entries["entry-2"]).toBeUndefined();
    const restored = trackerReducer(removed, { type: "undo" });
    expect(restored.entries["entry-2"].packageId).toBe("cosmic-odyssey");
    const removedAgain = trackerReducer(
      trackerReducer(restored, {
        type: "request-remove",
        entryId: "entry-2",
      }),
      { type: "commit-mutation" },
    );
    const added = trackerReducer(removedAgain, {
      type: "add-package",
      packageId: "cosmic-odyssey",
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
  });

  it("derives historical rosters without changing the selected Jump", () => {
    let state = createDenseTrackerFixture();
    state = trackerReducer(state, {
      type: "set-inspection",
      entryId: "entry-2",
    });
    expect(state.selectedEntryId).toBe("entry-7");
    expect(visibleForms(state)).toHaveLength(3);
    expect(visibleCompanions(state)).toHaveLength(3);
    expect(
      filteredInventory(state).every((record) => {
        const position = state.order.indexOf(record.sourceEntryId);
        return position >= 0 && position <= 2;
      }),
    ).toBe(true);
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

  it("populates every fixed radar axis with uneven perk counts", () => {
    const counts = radarCounts(createDenseTrackerFixture());
    expect(Object.keys(counts)).toEqual(tagCategories);
    expect(Object.values(counts).every((count) => count > 0)).toBe(true);
    expect(new Set(Object.values(counts)).size).toBeGreaterThan(2);
  });

  it("partitions hierarchical tag counts and aggregates excess slices", () => {
    const state = createDenseTrackerFixture();
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

  it("resolves an existing actor deficit without changing other balances", () => {
    const initial = createDenseTrackerFixture();
    const next = trackerReducer(initial, {
      type: "resolve-deficit",
      actorId: "ren",
    });
    expect(next.entries["entry-7"].actorBalances.ren).toBe(0);
    expect(next.entries["entry-7"].actorBalances.jumper).toBe(250);
  });
});
