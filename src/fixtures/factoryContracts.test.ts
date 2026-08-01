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
});
