import { describe, expect, it } from "vitest";
import {
  historyIndexFromState,
  settingsBackgroundFromLocation,
} from "./useShellHistory";

describe("shell history projections", () => {
  it("uses only numeric application history indexes", () => {
    expect(historyIndexFromState({ jvIndex: 7 })).toBe(7);
    expect(historyIndexFromState({ jvIndex: "7" })).toBe(0);
    expect(historyIndexFromState(null)).toBe(0);
  });

  it("exposes a settings background only on the settings route", () => {
    const state = { settingsBackgroundPath: "/chain/demo" };
    expect(settingsBackgroundFromLocation("/settings", state)).toBe(
      "/chain/demo",
    );
    expect(settingsBackgroundFromLocation("/", state)).toBeNull();
    expect(settingsBackgroundFromLocation("/settings", {})).toBeNull();
  });
});
