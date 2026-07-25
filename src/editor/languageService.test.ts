import { describe, expect, it } from "vitest";
import { Format1LanguageService } from "./languageService";
import { createStarterWorkspace } from "./model";

describe("Format1LanguageService", () => {
  const service = new Format1LanguageService();

  it("uses complete declaration extents and schema-driven completions", () => {
    const workspace = createStarterWorkspace("language-test");
    const analysis = service.analyze(workspace.files);
    const section = analysis.symbols.find(
      (symbol) => symbol.kind === "section",
    );
    expect(section).toBeDefined();
    const declaration = workspace.files[section!.file].slice(
      section!.from,
      section!.to,
    );
    expect(declaration).toContain("handle: introduction");
    expect(declaration).toContain("Begin your Jump here");
    expect(service.completions("jump").fields).toContain("description");
    expect(service.completions("choice").fields).toContain("selection");
    expect(service.completions("jump-appearance").fields).toEqual(
      expect.arrayContaining([
        "background",
        "text-color",
        "section-background",
        "control-accent",
        "corners",
      ]),
    );
  });

  it("renames definitions and references atomically across package files", () => {
    const files = {
      "jump.jdef": `jump\n  format: 1\n  name: "Test"\n  author: "A"\n  version: "1"\n\nsection\n  handle: intro\n  name: "Intro"\n  choice: first_choice\n`,
      "choices.jdef": `choice\n  handle: first_choice\n  name: "First"\n`,
    };
    const renamed = service.rename(files, "first_choice", "renamed_choice");
    expect(renamed["jump.jdef"]).toContain("choice: renamed_choice");
    expect(renamed["choices.jdef"]).toContain("handle: renamed_choice");
    expect(files["choices.jdef"]).toContain("first_choice");
    expect(() => service.rename(files, "first_choice", "Not Valid")).toThrow();
  });

  it("recovers preview source without mutating authored source", () => {
    const files = { "jump.jdef": "jump\n  mode manual\n" };
    const recovered = service.recover(files);
    expect(recovered["jump.jdef"]).toContain("mode: manual");
    expect(files["jump.jdef"]).toContain("mode manual");
    expect(service.format("jump  \n\n\n\tformat: 1")).toBe(
      "jump\n\n  format: 1\n",
    );
  });

  it("limits declaration diagnostics to the declaration keyword", () => {
    const files = {
      "jump.jdef": 'jump\n  description: "Incomplete metadata"\n',
    };
    const analysis = service.analyze(files);
    const diagnostic = analysis.diagnostics.find(
      (item) =>
        item.code === "schema.field.required" &&
        item.parameters?.field === "author",
    );
    expect(diagnostic).toBeDefined();
    expect(service.diagnosticExtent(diagnostic!, analysis.parsed)).toEqual({
      from: 0,
      to: 4,
    });
    expect(files["jump.jdef"].slice(0, 4)).toBe("jump");
  });

  it("underlines the exact invalid condition token", () => {
    const source = `jump
  format: 1
  name: "Conditions"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  text
    handle: body
    content when rank + 2: "Broken"
`;
    const analysis = service.analyze({ "jump.jdef": source });
    const diagnostic = analysis.diagnostics.find(
      (item) => item.code === "condition.syntax",
    );
    expect(diagnostic).toBeDefined();
    expect(source.slice(diagnostic!.range!.from, diagnostic!.range!.to)).toBe(
      "+",
    );
    expect(diagnostic?.target).toMatchObject({
      field: "content",
      variantOccurrence: 0,
      part: "condition",
    });
  });
});
