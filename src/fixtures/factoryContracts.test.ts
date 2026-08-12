import { describe, expect, it } from "vitest";
import { createStarterWorkspace } from "../editor/model";
import {
  createWelcomeTourEditorWorkspace,
  createWelcomeTourTrackerState,
} from "../tour/fixtures";
import {
  createBlankTrackerFixture,
  createDenseTrackerFixture,
} from "../tracker/fixtures";

const fixedTime = "2026-01-01T00:00:00.000Z";

describe("fixture factory contracts", () => {
  it.each([
    ["starter workspace", () => createStarterWorkspace("fixture", fixedTime)],
    ["dense tracker", () => createDenseTrackerFixture()],
    ["blank tracker", () => createBlankTrackerFixture("Fixture")],
    ["tour editor", () => createWelcomeTourEditorWorkspace(fixedTime)],
    ["tour tracker", () => createWelcomeTourTrackerState()],
  ])("creates deterministic isolated %s values", (_label, create) => {
    const first = create();
    const second = create();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("creates new chains with untouched supplement state", () => {
    const state = createBlankTrackerFixture("Untouched");
    expect(Object.values(state.enabledSupplements)).toEqual(
      Object.values(state.enabledSupplements).map(() => false),
    );
    expect(state.bodyMod.type).toBe("None");
    expect(
      Object.values(state.bodyMod.purchasedStats).every((rank) => rank === 0),
    ).toBe(true);
    expect(
      Object.values(state.bodyMod.purchasedPerks).every((rank) => rank === 0),
    ).toBe(true);
    expect(state.supplements.essential.essences).toEqual([]);
    expect(state.supplements.essential.purchases).toEqual({});
    expect(state.supplements.warehouse.selected).toEqual([]);
    expect(state.supplements.reality.purchases).toEqual({});
    expect(state.supplements.uds.chain).toEqual([]);
    expect(state.supplements.uds.jump).toEqual([]);
    expect(state.supplements.quest.rules).toEqual([]);
    expect(state.supplements.quest.checked).toEqual([]);
    expect(state.supplements.story.jumps).toEqual([]);
    expect(state.supplements.limitedInheritance.pools).toHaveLength(3);
    expect(state.supplements.limitedInheritance.assignments).toEqual({});
  });
});
