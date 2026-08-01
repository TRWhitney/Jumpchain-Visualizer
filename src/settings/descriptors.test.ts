import { describe, expect, it } from "vitest";
import { createDefaultTagProfile } from "./tagProfile";
import { defaultSettings } from "./model";
import { searchEntries, settingsDescriptorRegistry } from "./descriptors";

describe("Settings descriptors", () => {
  it("preserves the complete ordered search mapping", () => {
    expect(
      settingsDescriptorRegistry.map((descriptor) => [
        descriptor.labelKey,
        descriptor.path,
        descriptor.category,
        descriptor.anchor,
        descriptor.aliasesKey,
      ]),
    ).toEqual(searchEntries);
  });

  it("owns sections, controls, and default projections", () => {
    const defaults = defaultSettings(createDefaultTagProfile());
    const saveMode = settingsDescriptorRegistry.find(
      (descriptor) => descriptor.path === "editor.saveMode",
    );
    expect(saveMode).toMatchObject({
      anchor: "save-mode",
      category: "editor",
      controlOwner: "editor",
      section: "editor-workflow",
    });
    expect(saveMode?.defaultValue(defaults)).toBe(defaults.editor.saveMode);
    expect(
      new Set(settingsDescriptorRegistry.map((descriptor) => descriptor.path))
        .size,
    ).toBe(settingsDescriptorRegistry.length);
  });
});
