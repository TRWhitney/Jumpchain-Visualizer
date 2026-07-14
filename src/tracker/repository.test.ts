import { describe, expect, it } from "vitest";
import { createDenseTrackerFixture } from "./fixtures";
import { EARTH_ENTRY_ID, EARTH_ENTRY_STATUS } from "./model";
import {
  aggregateFromTracker,
  applyAggregate,
  isChainAggregate,
  MemoryChainRepository,
} from "./repository";

describe("chain repository", () => {
  it("round-trips independent versioned aggregates", async () => {
    const first = aggregateFromTracker("one", createDenseTrackerFixture());
    const second = {
      ...aggregateFromTracker("two", createDenseTrackerFixture()),
      name: "Second",
    };
    const repository = new MemoryChainRepository([first]);
    await repository.save(second);
    expect((await repository.list()).map((item) => item.id).sort()).toEqual([
      "one",
      "two",
    ]);
    const loaded = await repository.load("two");
    expect(loaded?.name).toBe("Second");
    expect(applyAggregate(createDenseTrackerFixture(), loaded!).chainName).toBe(
      "Second",
    );
  });

  it("rejects unsupported and malformed values", () => {
    expect(isChainAggregate({ schemaVersion: 2 })).toBe(false);
    expect(isChainAggregate({ schemaVersion: 1, id: "" })).toBe(false);
  });

  it("normalizes persisted Earth presentation to the system label", () => {
    const base = createDenseTrackerFixture();
    const stale = aggregateFromTracker("stale", base);
    stale.entries[EARTH_ENTRY_ID] = {
      ...stale.entries[EARTH_ENTRY_ID],
      status: "Identity setup",
    };

    const hydrated = applyAggregate(base, stale);
    expect(hydrated.entries[EARTH_ENTRY_ID].status).toBe(EARTH_ENTRY_STATUS);
    expect(
      aggregateFromTracker("normalized", hydrated).entries[EARTH_ENTRY_ID]
        .status,
    ).toBe(EARTH_ENTRY_STATUS);
  });
});
