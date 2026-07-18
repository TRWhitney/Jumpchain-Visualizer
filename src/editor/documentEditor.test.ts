import { describe, expect, it } from "vitest";
import { Format1LanguageService } from "./languageService";
import {
  addDocumentField,
  declarationFieldNames,
  fieldDefinition,
  quickAddFieldMode,
  readConditionalSourceFields,
  readSourceField,
  setConditionalDocumentField,
  setDocumentField,
} from "./documentEditor";

const source = `jump
  format: 1
  name: "Test"
  author: "Author"
  version: "1"

section
  handle: introduction
  name: "Introduction"
`;

describe("Format 1 structured document edits", () => {
  const service = new Format1LanguageService();

  it("clears an optional field without consuming the adjacent handle", () => {
    const files = { "jump.jdef": source };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const withLayout = setDocumentField(
      files,
      section,
      "layout",
      "temporary_layout",
    );
    const current = service
      .analyze(withLayout.files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const cleared = setDocumentField(withLayout.files, current, "layout", "");

    expect(cleared.files["jump.jdef"]).not.toContain("layout:");
    expect(cleared.files["jump.jdef"]).toContain("  handle: introduction");
    expect(readSourceField(cleared.files["jump.jdef"], current, "layout")).toBe(
      "",
    );
  });

  it("changes only the selected value range", () => {
    const files = { "jump.jdef": source };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const changed = setDocumentField(files, section, "name", "Rewritten");

    expect(changed.files["jump.jdef"]).toBe(
      source.replace('name: "Introduction"', 'name: "Rewritten"'),
    );
  });

  it("keeps required empty strings syntactically isolated", () => {
    const files = { "jump.jdef": source };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;
    const changed = setDocumentField(files, section, "name", "");

    expect(changed.files["jump.jdef"]).toContain('  name: ""');
    expect(changed.files["jump.jdef"]).toContain("  handle: introduction");
  });

  it("does not hide an unmatched quote from invalid authored source", () => {
    const invalid = source.replace('name: "Introduction"', 'name: "Incomplete');
    const files = { "jump.jdef": invalid };
    const section = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "section")!;

    expect(readSourceField(invalid, section, "name")).toBe('"Incomplete');
  });

  it("adds repeated authors without rewriting the existing occurrence", () => {
    const files = { "jump.jdef": source };
    const jump = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    const changed = addDocumentField(files, jump, "author");

    expect(changed.files["jump.jdef"]).toContain('  author: "Author"');
    expect(changed.files["jump.jdef"].match(/author:/g)).toHaveLength(2);
  });

  it("returns an editing selection inside quotes or over a scalar starter", () => {
    const files = { "jump.jdef": 'jump\n  name: "Test"\n' };
    const jump = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    const author = addDocumentField(files, jump, "author");
    expect(author.selection).toBeDefined();
    expect(
      author.files["jump.jdef"].slice(
        author.selection!.from,
        author.selection!.to,
      ),
    ).toBe("");
    expect(
      author.files["jump.jdef"].slice(
        author.selection!.from - 1,
        author.selection!.to + 1,
      ),
    ).toBe('""');

    const format = addDocumentField(files, jump, "format");
    expect(format.selection).toBeDefined();
    expect(
      format.files["jump.jdef"].slice(
        format.selection!.from,
        format.selection!.to,
      ),
    ).toBe("1");
  });

  it("targets an existing empty required field without inserting a duplicate", () => {
    const files = {
      "jump.jdef": source.replace('version: "1"', 'version: ""'),
    };
    const jump = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    const version = addDocumentField(files, jump, "version");

    expect(quickAddFieldMode(files["jump.jdef"], jump, "version")).toBe(
      "complete",
    );
    expect(version.changed).toBe(false);
    expect(version.selection).toBeDefined();
    expect(version.files["jump.jdef"].match(/version:/g)).toHaveLength(1);
    expect(
      version.files["jump.jdef"].slice(
        version.selection!.from,
        version.selection!.to,
      ),
    ).toBe("");

    const completedFiles = {
      "jump.jdef": files["jump.jdef"].replace('version: ""', 'version: "1"'),
    };
    const completedJump = service
      .analyze(completedFiles)
      .symbols.find((symbol) => symbol.kind === "jump")!;
    expect(
      quickAddFieldMode(completedFiles["jump.jdef"], completedJump, "version"),
    ).toBeNull();
  });

  it("updates one conditional value and condition by their exact ranges", () => {
    const conditional = `${source}\ntext\n  handle: premise\n  content: "Base"\n  content when actor.level > 2: "Advanced"\n`;
    const files = { "jump.jdef": conditional };
    const text = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "text")!;
    const changed = setConditionalDocumentField(
      files,
      text,
      "content",
      0,
      "actor.level > 3",
      "Expert",
    );

    expect(changed.files["jump.jdef"]).toBe(
      conditional.replace(
        'content when actor.level > 2: "Advanced"',
        'content when actor.level > 3: "Expert"',
      ),
    );
    expect(
      readConditionalSourceFields(changed.files["jump.jdef"], text, "content"),
    ).toEqual([{ condition: "actor.level > 3", value: "Expert" }]);
  });

  it("replaces a fenced rich-text extent without leaving its old fence", () => {
    const fenced = `${source}\ntext\n  handle: premise\n  content:\n    """\n    First line\n    Second line\n    """\n`;
    const files = { "jump.jdef": fenced };
    const text = service
      .analyze(files)
      .symbols.find((symbol) => symbol.kind === "text")!;
    const changed = setDocumentField(
      files,
      text,
      "content",
      "Replaced first\nReplaced second",
    );

    expect(changed.files["jump.jdef"].match(/"""/g)).toHaveLength(2);
    expect(changed.files["jump.jdef"]).not.toContain("First line");
    expect(changed.files["jump.jdef"]).toContain("    Replaced first");
    expect(changed.files["jump.jdef"]).toContain("    Replaced second");
  });

  it("keeps sentinels byte-identical across every exposed declaration field", () => {
    const declarations = [
      "jump",
      "resource",
      "section",
      "choice-source",
      "choice",
      "text",
      "image",
      "input",
      "cost",
      "grant",
      "theme",
      "section-layout",
      "choice-layout",
      "trait-layout",
    ];
    for (const kind of declarations) {
      const authored = `# before sentinel\n${kind}\n  handle: audit_handle\n  name: "Audit name"\n# after sentinel\n`;
      const files = { "jump.jdef": authored };
      const symbol = service
        .analyze(files)
        .symbols.find((candidate) => candidate.kind === kind)!;
      for (const field of declarationFieldNames(kind)) {
        const definition = fieldDefinition(kind, field);
        const value =
          definition?.values?.[0] ??
          (definition?.type === "boolean"
            ? "true"
            : definition?.type === "integer" || definition?.type === "number"
              ? "7"
              : definition?.type?.includes("handle")
                ? "audit_reference"
                : "Audit value");
        const changed = setDocumentField(files, symbol, field, value);
        expect(changed.reason, `${kind}.${field}`).not.toBe("stale-target");
        expect(changed.files["jump.jdef"], `${kind}.${field}`).toContain(
          "# before sentinel\n",
        );
        expect(changed.files["jump.jdef"], `${kind}.${field}`).toContain(
          "\n# after sentinel\n",
        );
      }
    }
  });
});
