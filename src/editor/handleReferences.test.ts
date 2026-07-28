import { describe, expect, it } from "vitest";
import { Format1LanguageService } from "./languageService";
import {
  handleCanPropagate,
  renameDocumentHandleReferences,
} from "./handleReferences";

describe("Structured handle reference updates", () => {
  const service = new Format1LanguageService();

  it("renames only references in the declaration's schema namespace", () => {
    const files = {
      "jump.jdef": `jump
  format: 1
  name: "old_layout"
  author: "Tester"
  version: "1"
  section-layout: old_layout
  choice-layout: old_layout

section
  handle: old_layout
  name: "Same token, different namespace"
`,
      "layout.jdef": `section-layout
  handle: renamed_layout

  stack
    gap: md
`,
    };
    const analysis = service.analyze(files);
    const layout = analysis.symbols.find(
      (symbol) => symbol.kind === "section-layout",
    )!;

    const renamed = renameDocumentHandleReferences(
      files,
      layout,
      "old_layout",
      "renamed_layout",
    );

    expect(renamed["jump.jdef"]).toContain("section-layout: renamed_layout");
    expect(renamed["jump.jdef"]).toContain("choice-layout: old_layout");
    expect(renamed["jump.jdef"]).toContain('name: "old_layout"');
    expect(renamed["jump.jdef"]).toContain("handle: old_layout");
  });

  it("renames compact and expanded owner-content references without touching another content kind", () => {
    const files = {
      "jump.jdef": `jump
  format: 1
  name: "Test"
  author: "Tester"
  version: "1"

section
  handle: intro
  name: "Intro"
  layout: card
  text
    handle: renamed_body
    content: "Body"
  image
    handle: body
    src: "body.png"
`,
      "layout.jdef": `section-layout
  handle: card

  stack
    text: body
    image
      target: body
`,
    };
    const analysis = service.analyze(files);
    const text = analysis.symbols.find(
      (symbol) => symbol.kind === "text" && symbol.handle === "renamed_body",
    )!;

    const renamed = renameDocumentHandleReferences(
      files,
      text,
      "body",
      "renamed_body",
    );

    expect(renamed["layout.jdef"]).toContain("text: renamed_body");
    expect(renamed["layout.jdef"]).toContain("target: body");
  });

  it("rejects invalid and duplicate final handles before propagation", () => {
    const files = {
      "jump.jdef": `jump
  format: 1
  name: "Test"
  author: "Tester"
  version: "1"

section
  handle: duplicate
  name: "First"
`,
      "sections.jdef": `section
  handle: duplicate
  name: "Second"
`,
    };
    const analysis = service.analyze(files);
    const duplicate = analysis.symbols.find(
      (symbol) => symbol.file === "jump.jdef" && symbol.kind === "section",
    )!;

    expect(
      handleCanPropagate(
        files,
        duplicate,
        analysis.symbols,
        analysis.diagnostics,
      ),
    ).toBe(false);
    expect(
      handleCanPropagate(
        files,
        { ...duplicate, handle: "Not Valid" },
        [{ ...duplicate, handle: "Not Valid" }],
        [],
      ),
    ).toBe(false);
  });
});
