import { describe, expect, it } from "vitest";
import {
  essentialAdvancementAward,
  initialSupplementState,
  nextTierCost,
  realityModeAward,
  storyWordCount,
  supplementReducer,
  toggleValue,
  words,
} from "./supplementState";
import { essentialPageCategories } from "./catalogs";
import { warehouseCost } from "./parityData";

describe("shared supplement review state", () => {
  it("updates nested progression without discarding the starting build", () => {
    const next = supplementReducer(initialSupplementState, {
      type: "essentialProgress",
      update: { infusion: "greater", search: "resilience" },
    });
    expect(next.essential.progression.infusion).toBe("greater");
    expect(next.essential.progression.search).toBe("resilience");
    expect(next.essential.purchases["physical-perfection"]).toBe(2);
    expect(next.warehouse).toBe(initialSupplementState.warehouse);
  });

  it("preserves immutable toggle semantics", () => {
    const original = ["Portal", "Loft"];
    expect(toggleValue(original, "Portal")).toEqual(["Loft"]);
    expect(toggleValue(original, "Workshop")).toEqual([
      "Portal",
      "Loft",
      "Workshop",
    ]);
    expect(original).toEqual(["Portal", "Loft"]);
  });

  it("models switching-out quests as one optional Quest Mode rule", () => {
    expect(initialSupplementState.quest.rules).toEqual([
      "drawback",
      "switching",
    ]);
    expect(initialSupplementState.quest.switching).toEqual([]);
  });

  it("calculates Warehouse quantities and installed feature costs", () => {
    expect(warehouseCost(initialSupplementState.warehouse.selected, 0)).toBe(
      100,
    );
    expect(warehouseCost(initialSupplementState.warehouse.selected, 2)).toBe(
      140,
    );
  });

  it("calculates progression awards and next-tier prices", () => {
    const perfection = essentialPageCategories.physical[0];
    expect(nextTierCost(perfection, 1, 2)).toBe(50);
    expect(nextTierCost(perfection, 2, 3)).toBe(100);
    expect(essentialAdvancementAward("standard", true, [])).toBe(0);
    expect(essentialAdvancementAward("heroic", true, [])).toBe(50);
    expect(essentialAdvancementAward("meteoric", true, [])).toBe(100);
    expect(essentialAdvancementAward("questing", false, [50, 100])).toBe(150);
    expect(realityModeAward("incremental", true)).toBe(50);
    expect(realityModeAward("unlimited", true)).toBe(0);
  });

  it("counts rendered Story words without formatting markers", () => {
    expect(words("A **bold** and <u>underlined phrase</u>.")).toBe(5);
    expect(words("A ++clear++ {{#74d8a1|green phrase}}.")).toBe(4);
    expect(
      storyWordCount(initialSupplementState.story, "arcane"),
    ).toBeGreaterThan(30);
  });
});
