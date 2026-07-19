import format1Schema from "../../schema/format-1.json";
import {
  canonicalizePackage,
  parseFormatFile,
  sha256,
  type PackageDiagnostic,
  type PackageValidationOptions,
  type SourceNode,
} from "../markup";
import { structuredContext } from "./documentEditor";

export type FormatSymbol = {
  kind: string;
  handle?: string;
  name?: string;
  file: string;
  from: number;
  to: number;
  depth: number;
};

type SchemaDeclaration = {
  fields?: Record<string, unknown>;
  children?: Record<string, unknown>;
  formsByContext?: Record<
    string,
    {
      fields?: Record<string, unknown>;
      children?: Record<string, unknown>;
    }
  >;
};

const schemaDeclarations = (
  format1Schema as unknown as {
    declarations: Record<string, SchemaDeclaration>;
  }
).declarations;

const unquote = (value: string | undefined) => value?.replace(/^"|"$/g, "");

function symbolsForNode(node: SourceNode, depth: number): FormatSymbol[] {
  const field = (name: string) =>
    node.fields.find((candidate) => candidate.name === name)?.value;
  return [
    {
      kind: node.kind,
      handle: unquote(field("handle")),
      name: unquote(field("name")),
      file: node.range.file,
      from: node.range.from,
      to: node.range.to,
      depth,
    },
    ...node.children.flatMap((child) => symbolsForNode(child, depth + 1)),
  ];
}

function flattenNodes(nodes: readonly SourceNode[]): SourceNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

export class Format1LanguageService {
  analyze(
    files: Readonly<Record<string, string>>,
    options: Omit<PackageValidationOptions, "profile"> = {},
  ) {
    const parsed = Object.entries(files).map(([file, source]) =>
      parseFormatFile(file, source),
    );
    const packageItem = canonicalizePackage(
      {
        id: "editor-preview",
        exactHash: sha256(
          Object.entries(files)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([file, source]) => `${file}\0${source}`)
            .join("\0"),
        ),
        files,
      },
      { ...options, profile: "editor" },
    );
    return {
      parsed,
      packageItem,
      diagnostics: packageItem.diagnostics,
      symbols: parsed.flatMap((file) =>
        file.tree.flatMap((node) => symbolsForNode(node, 0)),
      ),
    };
  }

  completions(kind: string, fieldsAlreadyPresent: readonly string[] = []) {
    const declaration = schemaDeclarations[kind];
    const used = new Set(fieldsAlreadyPresent);
    const contextualForms = Object.values(declaration?.formsByContext ?? {});
    const fields = Object.assign(
      {},
      declaration?.fields,
      ...contextualForms.map((form) => form.fields ?? {}),
    );
    const children = Object.assign(
      {},
      declaration?.children,
      ...contextualForms.map((form) => form.children ?? {}),
    );
    return {
      fields: Object.keys(fields).filter((field) => !used.has(field)),
      children: Object.keys(children),
    };
  }

  contextualCompletions(
    files: Readonly<Record<string, string>>,
    symbol: FormatSymbol,
    fieldsAlreadyPresent: readonly string[] = [],
  ) {
    const resolved = structuredContext(files, symbol);
    if (!resolved) return this.completions(symbol.kind, fieldsAlreadyPresent);
    const used = new Set(fieldsAlreadyPresent);
    return {
      fields: resolved.visibleFields.filter((field) => !used.has(field)),
      children: resolved.childKinds,
    };
  }

  diagnosticExtent(
    diagnostic: PackageDiagnostic,
    parsed: readonly ReturnType<typeof parseFormatFile>[],
  ) {
    const range = diagnostic.range;
    if (!range) return null;
    const declaration = parsed
      .filter((item) => item.file === range.file)
      .flatMap((item) => flattenNodes(item.tree))
      .find(
        (node) => node.range.from === range.from && node.range.to === range.to,
      );
    return declaration
      ? {
          from: declaration.range.from,
          to: declaration.range.from + declaration.kind.length,
        }
      : { from: range.from, to: Math.max(range.from, range.to) };
  }

  definition(
    files: Readonly<Record<string, string>>,
    handle: string,
  ): FormatSymbol | undefined {
    return this.analyze(files).symbols.find(
      (symbol) => symbol.handle === handle,
    );
  }

  references(files: Readonly<Record<string, string>>, handle: string) {
    const pattern = new RegExp(
      `(^|[^a-z0-9_])${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`,
      "gi",
    );
    return Object.entries(files).flatMap(([file, source]) => {
      const matches: { file: string; from: number; to: number }[] = [];
      for (const match of source.matchAll(pattern)) {
        const leading = match[1]?.length ?? 0;
        const from = (match.index ?? 0) + leading;
        matches.push({ file, from, to: from + handle.length });
      }
      return matches;
    });
  }

  rename(files: Readonly<Record<string, string>>, from: string, to: string) {
    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(to))
      throw new Error(
        "Handles use lower-case letters, numbers, and underscores.",
      );
    if (this.definition(files, to))
      throw new Error(`Handle “${to}” already exists.`);
    const references = this.references(files, from);
    const next = { ...files };
    for (const file of new Set(references.map((reference) => reference.file))) {
      let source = files[file];
      for (const reference of references
        .filter((item) => item.file === file)
        .sort((left, right) => right.from - left.from))
        source =
          source.slice(0, reference.from) + to + source.slice(reference.to);
      next[file] = source;
    }
    return next;
  }

  quickFix(source: string) {
    return source.replace(
      /^(\s*(?:mode|resolution|selection|layout|group|target|handle|name|version|author))\s+(?!:)(.+)$/m,
      "$1: $2",
    );
  }

  recover(files: Readonly<Record<string, string>>) {
    return Object.fromEntries(
      Object.entries(files).map(([file, source]) => [
        file,
        this.quickFix(source),
      ]),
    );
  }

  format(source: string) {
    return source
      .replace(/\t/g, "  ")
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s*$/, "\n");
  }

  highestPriorityDiagnostic(diagnostics: readonly PackageDiagnostic[]) {
    const priority = { error: 0, warning: 1, info: 2 } as const;
    return [...diagnostics].sort(
      (left, right) => priority[left.severity] - priority[right.severity],
    )[0];
  }
}
