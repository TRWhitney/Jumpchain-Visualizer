import { describe, expect, it } from "vitest";
import { createSelectControlModel } from "./selectControl";

describe("createSelectControlModel", () => {
  it.each([
    {
      name: "uses an existing enum option as the effective default",
      authored: "",
      defaultValue: { kind: "value" as const, value: "none" },
      options: ["none", "sm", "md"],
      value: "none",
      renderedOptions: ["none", "sm", "md"],
      showNotSet: false,
    },
    {
      name: "adds an omission-only default exactly once",
      authored: "",
      defaultValue: { kind: "value" as const, value: "manual" },
      options: ["random", "either"],
      value: "manual",
      renderedOptions: ["manual", "random", "either"],
      showNotSet: false,
    },
    {
      name: "keeps Not set for an optional enum without a default",
      authored: "",
      defaultValue: null,
      options: ["single", "multi"],
      value: "",
      renderedOptions: ["single", "multi"],
      showNotSet: true,
    },
    {
      name: "shows an authored value instead of its omission default",
      authored: "sm",
      defaultValue: { kind: "value" as const, value: "none" },
      options: ["none", "sm", "md"],
      value: "sm",
      renderedOptions: ["none", "sm", "md"],
      showNotSet: false,
    },
  ])("$name", (fixture) => {
    const model = createSelectControlModel(
      fixture.authored,
      fixture.defaultValue,
      fixture.options,
    );
    expect(model.value).toBe(fixture.value);
    expect(model.options).toEqual(fixture.renderedOptions);
    expect(model.showNotSet).toBe(fixture.showNotSet);
  });

  it("maps the effective default back to source omission", () => {
    const model = createSelectControlModel(
      "random",
      { kind: "value", value: "manual" },
      ["random", "either"],
    );
    expect(model.authoredValue("manual")).toBe("");
    expect(model.authoredValue("either")).toBe("either");
  });
});
