import { describe, expect, it } from "vitest";
import {
  bestialPresentation,
  bodyModRemaining,
  changeBodyModType,
  freeStats,
  initialBodyModState,
  statDescriptions,
  totalPerk,
  totalStat,
} from "./bodyMod";

describe("Classic Body Mod calculations", () => {
  it("derives source descriptions and Bestial grants deterministically", () => {
    const state = {
      ...initialBodyModState,
      type: "Bestial" as const,
      animal: "Fox",
      bestialTier: 1,
      bestialStat: "Speed" as const,
    };
    expect(freeStats(state)).toMatchObject({ Sense: 2, Speed: 1 });
    expect(bestialPresentation(state)).toBe("Fox Demi-Human");
    expect(statDescriptions.Strength[totalStat(state, "Strength")]).toBe(
      "Bench press roughly 180 pounds.",
    );
  });

  it("reports negative remaining CP without clamping it", () => {
    const state = {
      ...initialBodyModState,
      purchasedPerks: {
        ...initialBodyModState.purchasedPerks,
        Winged: 1,
        Genderswap: 1,
        Metavore: 1,
      },
    };
    expect(bodyModRemaining(state)).toBeLessThan(0);
  });

  it("replaces body-type grants without converting old grants into purchases", () => {
    const bodybuilder = changeBodyModType(initialBodyModState, "Bodybuilder");
    const charmer = changeBodyModType(bodybuilder, "Charmer");

    expect(charmer.purchasedStats).toEqual(initialBodyModState.purchasedStats);
    expect(charmer.purchasedPerks).toEqual(initialBodyModState.purchasedPerks);
    expect(totalStat(charmer, "Endurance")).toBe(0);
    expect(totalPerk(charmer, "Flexibility")).toBe(0);
    expect(totalStat(charmer, "Appeal")).toBe(2);
    expect(totalPerk(charmer, "Endowed")).toBe(3);
  });
});
