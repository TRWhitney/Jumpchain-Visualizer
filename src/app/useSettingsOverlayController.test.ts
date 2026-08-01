import { describe, expect, it } from "vitest";
import { settingsCloseAction } from "./useSettingsOverlayController";

describe("settingsCloseAction", () => {
  it("returns through history only for a real overlay entry", () => {
    expect(settingsCloseAction("/editor/project", 2)).toBe("back");
    expect(settingsCloseAction("/", 0)).toBe("home");
    expect(settingsCloseAction(null, 3)).toBe("home");
  });
});
