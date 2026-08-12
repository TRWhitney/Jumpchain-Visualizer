import { describe, expect, it } from "vitest";
import {
  addInheritancePool,
  assignCandidate,
  effectiveCandidatePool,
  inheritanceCandidates,
  inheritanceCompanionIsVisible,
  inheritanceFormIsVisible,
  inheritancePoolAssignmentEntryIds,
  inheritanceRecordIsVisible,
  initialLimitedInheritanceState,
  normalizeLimitedInheritanceState,
  removeInheritancePool,
  unassignCandidate,
  updateInheritancePool,
  type InheritanceCandidate,
} from "./limitedInheritance";

const candidate = (
  id: string,
  kind: InheritanceCandidate["kind"],
): InheritanceCandidate => ({
  id,
  kind,
  sourceEntryId: "entry-0",
  entityId: id,
  name: id,
  description: "Test candidate",
  tags: [],
  bundledRecordIds: [id],
});

const projection = {
  actors: {
    jumper: { name: "Morgan", summary: "Jumper" },
    lyra: { name: "Lyra", summary: "Companion" },
  },
  records: [
    {
      id: "jumper-perk",
      kind: "perk" as const,
      name: "Threshold",
      description: "A perk",
      sourceEntryId: "entry-0",
      ownerActorId: "jumper",
    },
    {
      id: "form-perk",
      kind: "perk" as const,
      name: "Scales",
      description: "Attached to a form",
      sourceEntryId: "entry-0",
      ownerFormId: "dragon",
    },
    {
      id: "lyra-perk",
      kind: "perk" as const,
      name: "Gatecraft",
      description: "A companion upgrade",
      sourceEntryId: "entry-1",
      ownerActorId: "lyra",
    },
    {
      id: "lyra-trait",
      kind: "trait" as const,
      name: "Narrative trait",
      description: "Traits do not create an update bundle.",
      sourceEntryId: "entry-2",
      ownerActorId: "lyra",
    },
  ],
  forms: [
    {
      id: "dragon",
      name: "Dragon Form",
      description: "A form",
      sourceEntryId: "entry-0",
    },
  ],
  companions: [
    {
      actorId: "lyra",
      sourceEntryId: "entry-0",
      importedEntryIds: ["entry-1", "entry-2"],
    },
  ],
};

describe("Limited Inheritance", () => {
  it("ships the three requested default pools", () => {
    expect(initialLimitedInheritanceState().pools).toEqual([
      { id: "pool-1", kinds: ["perk", "item"], limit: 2, unlimited: false },
      { id: "pool-2", kinds: ["companion"], limit: 1, unlimited: false },
      { id: "pool-3", kinds: ["form"], limit: 1, unlimited: false },
    ]);
  });

  it("builds owner bundles and only offers imports with new records", () => {
    expect(
      inheritanceCandidates(projection, "entry-0").map((item) => ({
        id: item.id,
        records: item.bundledRecordIds,
      })),
    ).toEqual([
      { id: "record:jumper-perk", records: ["jumper-perk"] },
      { id: "form:dragon", records: ["form-perk"] },
      { id: "companion:lyra", records: [] },
    ]);
    expect(
      inheritanceCandidates(projection, "entry-1").map((item) => item.id),
    ).toEqual(["companion-update:entry-1:lyra"]);
    expect(inheritanceCandidates(projection, "entry-2")).toEqual([]);
  });

  it("combines independent pools without assigning one candidate twice", () => {
    let state = initialLimitedInheritanceState();
    const perk = candidate("perk-a", "perk");
    state = assignCandidate(state, "entry-0", "pool-1", perk);
    expect(effectiveCandidatePool(state, "entry-0", perk)).toBe("pool-1");
    expect(assignCandidate(state, "entry-0", "pool-3", perk)).toBe(state);
    state = updateInheritancePool(state, "pool-3", {
      kinds: ["form", "item"],
      unlimited: true,
    });
    expect(
      effectiveCandidatePool(state, "entry-0", candidate("item-a", "item")),
    ).toBe("pool-3");
  });

  it("enforces finite capacity and gives overlapping candidates to the first unlimited pool", () => {
    let state = initialLimitedInheritanceState();
    state = assignCandidate(state, "entry-0", "pool-1", candidate("a", "perk"));
    state = assignCandidate(state, "entry-0", "pool-1", candidate("b", "item"));
    expect(
      assignCandidate(state, "entry-0", "pool-1", candidate("c", "perk")),
    ).toBe(state);
    state = updateInheritancePool(state, "pool-1", { unlimited: true });
    state = updateInheritancePool(state, "pool-3", {
      kinds: ["perk", "form"],
      unlimited: true,
    });
    expect(
      effectiveCandidatePool(state, "entry-0", candidate("new", "perk")),
    ).toBe("pool-1");
  });

  it("grandfathers old assignments after limits and categories change", () => {
    const perk = candidate("perk-a", "perk");
    let state = assignCandidate(
      initialLimitedInheritanceState(),
      "entry-0",
      "pool-1",
      perk,
    );
    state = updateInheritancePool(state, "pool-1", {
      kinds: ["item"],
      limit: 0,
    });
    expect(effectiveCandidatePool(state, "entry-0", perk)).toBe("pool-1");
    state = unassignCandidate(state, "entry-0", perk.id);
    expect(effectiveCandidatePool(state, "entry-0", perk)).toBeUndefined();
    expect(assignCandidate(state, "entry-0", "pool-1", perk)).toBe(state);
  });

  it("removes a pool and all of its assignments only after the action", () => {
    const perk = candidate("perk-a", "perk");
    let state = assignCandidate(
      initialLimitedInheritanceState(),
      "entry-0",
      "pool-1",
      perk,
    );
    state = removeInheritancePool(state, "pool-1");
    expect(state.pools.some((pool) => pool.id === "pool-1")).toBe(false);
    expect(state.assignments["entry-0"]).toEqual({});
    expect(addInheritancePool(state).pools.at(-1)?.id).toBe("pool-4");
  });

  it("reports only Jumps whose assignments would be removed with a pool", () => {
    let state = initialLimitedInheritanceState();
    state = assignCandidate(state, "entry-0", "pool-1", candidate("a", "perk"));
    state = assignCandidate(
      state,
      "entry-1",
      "pool-2",
      candidate("b", "companion"),
    );
    expect(inheritancePoolAssignmentEntryIds(state, "pool-1")).toEqual([
      "entry-0",
    ]);
    expect(inheritancePoolAssignmentEntryIds(state, "pool-3")).toEqual([]);
  });

  it("projects source acquisitions, carried bundles, and permanent imports separately", () => {
    const limited = initialLimitedInheritanceState();
    const base = {
      ...projection,
      order: ["entry-0", "entry-1", "entry-2"],
      enabledSupplements: { "limited-inheritance": true },
      supplements: { limitedInheritance: limited },
    };
    expect(
      inheritanceRecordIsVisible(
        { ...base, inspectionPointId: "entry-0" },
        projection.records[0],
      ),
    ).toBe(true);
    expect(
      inheritanceRecordIsVisible(
        { ...base, inspectionPointId: "entry-2" },
        projection.records[0],
      ),
    ).toBe(false);
    expect(
      inheritanceFormIsVisible(
        { ...base, inspectionPointId: "entry-2" },
        projection.forms[0],
      ),
    ).toBe(false);
    expect(
      inheritanceCompanionIsVisible(
        { ...base, inspectionPointId: "entry-2" },
        projection.companions[0],
      ),
    ).toBe(true);
    expect(
      inheritanceRecordIsVisible(
        { ...base, inspectionPointId: "entry-2" },
        projection.records[2],
      ),
    ).toBe(false);

    const withUpdate = {
      ...base,
      supplements: {
        limitedInheritance: assignCandidate(
          limited,
          "entry-1",
          "pool-2",
          inheritanceCandidates(projection, "entry-1")[0],
        ),
      },
    };
    expect(
      inheritanceRecordIsVisible(
        { ...withUpdate, inspectionPointId: "entry-2" },
        projection.records[2],
      ),
    ).toBe(true);
    expect(
      inheritanceCompanionIsVisible(
        { ...base, inspectionPointId: "entry-2" },
        projection.companions[0],
      ),
    ).toBe(true);

    const disabled = {
      ...base,
      inspectionPointId: "entry-2",
      enabledSupplements: { "limited-inheritance": false },
    };
    expect(inheritanceRecordIsVisible(disabled, projection.records[0])).toBe(
      true,
    );
    expect(inheritanceFormIsVisible(disabled, projection.forms[0])).toBe(true);
  });

  it("normalizes untrusted persisted pools and falls back when absent", () => {
    expect(normalizeLimitedInheritanceState(undefined).pools).toHaveLength(3);
    expect(
      normalizeLimitedInheritanceState({
        pools: [
          { id: "valid", kinds: ["perk", "invalid"], limit: 500 },
          { id: "unlimited", kinds: ["item"], limit: "unlimited" },
          { id: "unlimited", kinds: ["perk"], limit: 1 },
        ],
        assignments: { entry: { choice: "missing" } },
        nextPoolSerial: -2,
      }),
    ).toMatchObject({
      pools: [{ id: "unlimited", kinds: ["item"], limit: 1, unlimited: true }],
      assignments: { entry: {} },
      nextPoolSerial: 4,
    });
  });
});
