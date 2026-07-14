import { describe, expect, it } from "vitest";
import {
  chainRegistryReducer,
  createChainRegistryFixture,
  filterSavedChains,
  orderedChains,
  primaryTagForChain,
} from "./chainRegistry";

describe("saved chain registry", () => {
  it("orders every fixture by most recently opened", () => {
    const state = createChainRegistryFixture();
    expect(orderedChains(state)).toHaveLength(8);
    expect(
      orderedChains(state)
        .slice(0, 2)
        .map((chain) => chain.name),
    ).toEqual(["Morgan", "The Ashen Road"]);
  });

  it("advances new-chain identity past hydrated durable chains", () => {
    const hydrated = chainRegistryReducer(createChainRegistryFixture(), {
      type: "hydrate",
      id: "ch-new-7",
      name: "Restored",
      description: "Stored independently.",
      lastOpenedSequence: 90,
      lastOpenedLabel: "Opened earlier",
    });
    expect(hydrated.nextSerial).toBe(8);
  });

  it("creates, opens, and renames chains while keeping opaque identity", () => {
    let state = createChainRegistryFixture();
    state = chainRegistryReducer(state, {
      type: "create",
      id: "ch-new-1",
      name: "  A   New Path  ",
    });
    expect(state.chains["ch-new-1"]).toMatchObject({
      name: "A New Path",
      jumpCount: 0,
    });
    expect(orderedChains(state)[0].id).toBe("ch-new-1");

    state = chainRegistryReducer(state, {
      type: "update-details",
      id: "ch-new-1",
      name: "Recharted Path",
      description: "A deliberately edited description.",
    });
    expect(state.chains["ch-new-1"]).toMatchObject({
      name: "Recharted Path",
      description: "A deliberately edited description.",
    });

    state = chainRegistryReducer(state, { type: "open", id: "ch-c208" });
    expect(orderedChains(state)[0].id).toBe("ch-c208");
  });

  it("rejects blank names and actions for unknown records", () => {
    const state = createChainRegistryFixture();
    expect(
      chainRegistryReducer(state, {
        type: "create",
        id: "ch-new-1",
        name: "   ",
      }),
    ).toBe(state);
    expect(
      chainRegistryReducer(state, {
        type: "update-details",
        id: "missing",
        name: "Nope",
        description: "Missing",
      }),
    ).toBe(state);
  });

  it("searches names and descriptions and derives the strongest perk category", () => {
    const chains = orderedChains(createChainRegistryFixture());
    expect(
      filterSavedChains(chains, "quiet crew").map((chain) => chain.name),
    ).toEqual(["Quiet Stars"]);
    expect(filterSavedChains(chains, "impossible words")).toHaveLength(0);
    expect(primaryTagForChain(chains[0])).toBe("magic");
  });
});
