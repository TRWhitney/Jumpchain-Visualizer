import { describe, expect, it } from "vitest";
import { mockInstalledPackages } from "../fixtures/mockData";
import { createDenseTrackerFixture } from "./fixtures";

describe("mock tracker fixtures", () => {
  it("keeps every demonstration package separate from built-in and imported sources", () => {
    expect(mockInstalledPackages).toHaveLength(3);
    expect(new Set(mockInstalledPackages.map((item) => item.source))).toEqual(
      new Set(["mock"]),
    );
  });

  it("creates a fresh canonical Morgan state for every reset", () => {
    const changed = createDenseTrackerFixture();
    changed.jumpState["entry-2"].actors.jumper.choices.trial_name = "Changed";
    changed.supplements.story.jumps[0].chapters[0].title = "Changed chapter";

    const restored = createDenseTrackerFixture();
    expect(restored.jumpState["entry-2"].actors.jumper.choices.trial_name).toBe(
      "Wayfinder's End",
    );
    expect(restored.supplements.story.jumps[0].chapters[0].title).not.toBe(
      "Changed chapter",
    );
  });
});
