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
    expect(orderedChains(state)).toHaveLength(1);
    expect(orderedChains(state).map((chain) => chain.name)).toEqual(["Morgan"]);
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

    state = chainRegistryReducer(state, { type: "open", id: "ch-92b1" });
    expect(orderedChains(state)[0].id).toBe("ch-92b1");
  });

  it("sorts starred chains first and preserves recency within both groups", () => {
    let state = createChainRegistryFixture();
    state = chainRegistryReducer(state, {
      type: "create",
      id: "ch-new-1",
      name: "Alpha",
    });
    state = chainRegistryReducer(state, {
      type: "create",
      id: "ch-new-2",
      name: "Beta",
    });
    state = chainRegistryReducer(state, {
      type: "set-starred",
      id: "ch-92b1",
      starred: true,
    });
    state = chainRegistryReducer(state, {
      type: "set-starred",
      id: "ch-new-1",
      starred: true,
    });
    expect(orderedChains(state).map((chain) => chain.name)).toEqual([
      "Alpha",
      "Morgan",
      "Beta",
    ]);

    state = chainRegistryReducer(state, { type: "open", id: "ch-92b1" });
    expect(orderedChains(state).map((chain) => chain.name)).toEqual([
      "Morgan",
      "Alpha",
      "Beta",
    ]);

    state = chainRegistryReducer(state, {
      type: "set-starred",
      id: "ch-92b1",
      starred: false,
    });
    expect(orderedChains(state).map((chain) => chain.name)).toEqual([
      "Alpha",
      "Morgan",
      "Beta",
    ]);
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
    expect(
      chainRegistryReducer(state, {
        type: "set-starred",
        id: "missing",
        starred: true,
      }),
    ).toBe(state);
  });

  it("searches names and descriptions and derives the strongest perk category", () => {
    const chains = orderedChains(createChainRegistryFixture());
    expect(
      filterSavedChains(chains, "three format").map((chain) => chain.name),
    ).toEqual(["Morgan"]);
    expect(filterSavedChains(chains, "impossible words")).toHaveLength(0);
    expect(primaryTagForChain(chains[0])).toBe("combat");
  });
});
