import { describe, expect, it } from "vitest";
import {
  createDenseTrackerFixture,
  DEMONSTRATION_CHAIN_ID,
  reconcileDemonstrationPackageBindings,
} from "./fixtures";
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
    first.starred = true;
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
    expect(loaded?.schemaVersion).toBe(3);
    expect(loaded?.name).toBe("Second");
    expect(
      loaded?.jumpState["entry-2"].actors.jumper.sourceSelections[
        "companions:companions"
      ],
    ).toContain("trial_company");
    expect((await repository.load("one"))?.starred).toBe(true);
    expect(applyAggregate(createDenseTrackerFixture(), loaded!).chainName).toBe(
      "Second",
    );
    expect(await repository.isInitialized()).toBe(true);
    await repository.remove("one");
    expect(await repository.load("one")).toBeNull();
    expect((await repository.list()).map((item) => item.id)).toEqual(["two"]);
  });

  it("distinguishes an uninitialized registry from an initialized empty one", async () => {
    const repository = new MemoryChainRepository();
    expect(await repository.isInitialized()).toBe(false);
    await repository.remove("missing");
    expect(await repository.isInitialized()).toBe(true);
    expect(await repository.list()).toEqual([]);
  });

  it("rejects unsupported and malformed values", () => {
    expect(isChainAggregate({ schemaVersion: 2 })).toBe(false);
    expect(isChainAggregate({ schemaVersion: 1, id: "" })).toBe(false);

    const missingMembership = aggregateFromTracker(
      "missing-membership",
      createDenseTrackerFixture(),
    );
    delete (
      missingMembership.jumpState["entry-2"].actors.jumper as {
        sourceSelections?: unknown;
      }
    ).sourceSelections;
    expect(isChainAggregate(missingMembership)).toBe(false);

    const invalidCompanions = aggregateFromTracker(
      "invalid-companions",
      createDenseTrackerFixture(),
    );
    invalidCompanions.jumpState["entry-2"].actors.jumper.choices.trial_company =
      ["duplicate", "duplicate"];
    expect(isChainAggregate(invalidCompanions)).toBe(false);
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

  it("hydrates Limited Inheritance fields missing from older aggregates", () => {
    const base = createDenseTrackerFixture();
    const stale = structuredClone(
      aggregateFromTracker("before-limited-inheritance", base),
    );
    delete (
      stale.enabledSupplements as Partial<typeof stale.enabledSupplements>
    )["limited-inheritance"];
    delete (stale.supplements as Partial<typeof stale.supplements>)
      .limitedInheritance;

    const hydrated = applyAggregate(base, stale);

    expect(hydrated.enabledSupplements["limited-inheritance"]).toBe(false);
    expect(hydrated.supplements.limitedInheritance.pools).toHaveLength(3);
    expect(hydrated.supplements.limitedInheritance.assignments).toEqual({});
  });

  it("rebinds only the canonical demonstration packages while preserving state", () => {
    const base = createDenseTrackerFixture();
    const stale = aggregateFromTracker(DEMONSTRATION_CHAIN_ID, base);
    stale.entries["entry-2"] = {
      ...stale.entries["entry-2"],
      packageExactHash: "sha256:older-canonical-demo-package",
    };
    stale.jumpState["entry-2"].actors.jumper.choices.trial_name =
      "Persistence Marker";

    const hydrated = reconcileDemonstrationPackageBindings(
      applyAggregate(base, stale),
      stale.id,
    );

    expect(hydrated.entries["entry-2"].packageExactHash).toBe(
      base.entries["entry-2"].packageExactHash,
    );
    expect(hydrated.jumpState["entry-2"].actors.jumper.choices.trial_name).toBe(
      "Persistence Marker",
    );

    const ordinary = { ...stale, id: "user-chain" };
    expect(
      reconcileDemonstrationPackageBindings(
        applyAggregate(base, ordinary),
        ordinary.id,
      ).entries["entry-2"].packageExactHash,
    ).toBe("sha256:older-canonical-demo-package");
  });
});
