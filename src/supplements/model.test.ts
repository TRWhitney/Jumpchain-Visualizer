import { describe, expect, it } from "vitest";
import {
  essentialCategories,
  essentialPageCategories,
  personalRealityCategories,
  personalRealityPageCategories,
  universalDrawbacks,
  universalDrawbacksPage,
} from "./catalogs";
import {
  catalogCost,
  catalogDiagnostics,
  hasEnabledSupplements,
  initialEnabled,
  modules,
  setModuleEnabled,
  type CatalogEntry,
} from "./model";

describe("supplement module state", () => {
  it("reports whether any contextual supplement is enabled", () => {
    expect(hasEnabledSupplements(initialEnabled)).toBe(true);
    expect(
      hasEnabledSupplements(
        Object.fromEntries(
          modules.map((module) => [module.id, false]),
        ) as typeof initialEnabled,
      ),
    ).toBe(false);
  });

  it("enforces foundation and persistent-space exclusivity without changing other modules", () => {
    const essential = setModuleEnabled(
      initialEnabled,
      "essential-body-mod",
      true,
    );
    expect(essential["essential-body-mod"]).toBe(true);
    expect(essential["body-mod"]).toBe(false);
    expect(essential.story).toBe(true);

    const warehouse = setModuleEnabled(essential, "warehouse", true);
    expect(warehouse.warehouse).toBe(true);
    expect(warehouse["personal-reality"]).toBe(false);
    expect(warehouse["essential-body-mod"]).toBe(true);
  });

  it("calculates repeat tiers and relationship diagnostics deterministically", () => {
    const catalog: CatalogEntry[] = [
      { id: "base", name: "Base", category: "test", costs: [10], summary: "" },
      {
        id: "upgrade",
        name: "Upgrade",
        category: "test",
        costs: [20, 30],
        repeatLimit: 2,
        requires: ["base"],
        conflicts: ["other"],
        summary: "",
      },
      { id: "other", name: "Other", category: "test", costs: [5], summary: "" },
    ];
    expect(catalogCost(catalog[1], 4)).toBe(50);
    expect(catalogDiagnostics(catalog, new Set(["upgrade", "other"]))).toEqual([
      "Upgrade requires Base.",
      "Upgrade conflicts with Other.",
    ]);
  });
});

describe("pinned catalog fixtures", () => {
  it("contains every transcribed row from the pinned large catalogs", () => {
    expect(Object.values(essentialCategories).flat()).toHaveLength(122);
    expect(Object.values(personalRealityCategories).flat()).toHaveLength(210);
    expect(universalDrawbacks).toHaveLength(260);
  });

  it("has stable unique IDs and valid cost arrays", () => {
    const entries = [
      ...Object.values(essentialCategories).flat(),
      ...Object.values(personalRealityCategories).flat(),
      ...universalDrawbacks,
    ];
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.costs.length).toBeGreaterThan(0);
      expect(entry.costs.every(Number.isFinite)).toBe(true);
    }
  });

  it("contains no dangling catalog relationships", () => {
    const entries = [
      ...Object.values(essentialCategories).flat(),
      ...Object.values(personalRealityCategories).flat(),
      ...universalDrawbacks,
    ];
    const ids = new Set(entries.map((entry) => entry.id));
    for (const entry of entries)
      for (const related of [
        ...(entry.requires ?? []),
        ...(entry.conflicts ?? []),
      ])
        expect(ids.has(related), `${entry.id} references ${related}`).toBe(
          true,
        );
  });

  it("provides specific copy for every catalog row and complete mock fixtures", () => {
    const entries = [
      ...Object.values(essentialCategories).flat(),
      ...Object.values(personalRealityCategories).flat(),
      ...universalDrawbacks,
    ];
    for (const entry of entries) {
      expect(entry.summary.trim().length, entry.name).toBeGreaterThan(20);
      expect(entry.summary, entry.name).not.toMatch(
        /pinned v|source-defined|independently written interface summary/i,
      );
    }
    expect(Object.keys(essentialPageCategories)).toEqual([
      "basic",
      "physical",
      "mental",
      "spiritual",
      "skills",
      "supernatural",
      "items",
      "companions",
      "drawbacks",
    ]);
    expect(Object.keys(personalRealityPageCategories)).toEqual([
      "basics",
      "utilities",
      "cosmetic",
      "facilities",
      "extensions",
      "items",
      "companions",
      "misc",
      "limitations",
    ]);
    expect(universalDrawbacksPage).toHaveLength(24);
  });
});
