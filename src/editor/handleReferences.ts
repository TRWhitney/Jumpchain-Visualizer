import {
  parseFormatFile,
  type PackageDiagnostic,
  type SourceField,
  type SourceNode,
} from "../markup";
import {
  readSourceField,
  structuredContext,
  type StructuredContext,
} from "./documentEditor";
import type { FormatSymbol } from "./languageService";

const handlePattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

type LocatedNode = {
  node: SourceNode;
  parent?: SourceNode;
  depth: number;
};

const unquote = (value: string) =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;

const locateNodes = (
  nodes: readonly SourceNode[],
  parent?: SourceNode,
  depth = 0,
): LocatedNode[] =>
  nodes.flatMap((node) => [
    { node, parent, depth },
    ...locateNodes(node.children, node, depth + 1),
  ]);

const symbolFor = (node: SourceNode, depth: number): FormatSymbol => ({
  kind: node.kind,
  handle: node.fields
    .find((field) => field.name === "handle")
    ?.value.replace(/^"|"$/g, ""),
  file: node.range.file,
  from: node.range.from,
  to: node.range.to,
  depth,
});

function referenceNamespaces(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
) {
  if (symbol.depth === 0) {
    const namespaces = new Set([symbol.kind]);
    if (
      symbol.kind === "choice" &&
      readSourceField(files[symbol.file] ?? "", symbol, "selection") ===
        "companions"
    )
      namespaces.add("companionTarget");
    return namespaces;
  }
  if (symbol.kind === "choice") return new Set(["choice-placement"]);
  if (symbol.kind === "choice-source") return new Set(["choice-source"]);
  if (["text", "image", "input"].includes(symbol.kind))
    return new Set([
      "owner-local-content",
      ...(symbol.kind === "image" ? ["owner-local-image"] : []),
    ]);
  if (symbol.kind !== "grant") return new Set<string>();
  const kind = readSourceField(files[symbol.file] ?? "", symbol, "kind");
  if (kind === "form") return new Set(["form"]);
  if (kind === "companion") return new Set(["companionTarget"]);
  return new Set<string>();
}

function renderedReference(value: string, nextHandle: string) {
  return value.startsWith('"') && value.endsWith('"')
    ? JSON.stringify(nextHandle)
    : nextHandle;
}

function scalarValueRange(source: string, node: SourceNode) {
  if (node.scalar === undefined) return null;
  const lineEnd = source.indexOf("\n", node.range.from);
  const to = lineEnd < 0 ? source.length : lineEnd;
  const line = source.slice(node.range.from, to);
  const separator = line.indexOf(":");
  if (separator < 0) return null;
  const remainder = line.slice(separator + 1);
  const leading = remainder.length - remainder.trimStart().length;
  const from = node.range.from + separator + 1 + leading;
  return { from, to: from + remainder.trim().length };
}

function fieldIsReference(
  context: StructuredContext,
  field: SourceField,
  namespaces: ReadonlySet<string>,
  definitionKind: string,
) {
  const type = context.fields[field.name]?.type;
  if (definitionKind === "theme" && type === "color") return true;
  if (!type?.startsWith("handleReference:")) return false;
  const namespace = type.slice("handleReference:".length);
  if (!namespaces.has(namespace)) return false;
  return (
    namespace !== "owner-local-content" ||
    context.symbol.kind === definitionKind
  );
}

/**
 * Rewrites authored reference fields only. Unlike the language service's broad
 * text search, this deliberately leaves names, prose, and other handle
 * namespaces untouched.
 */
export function renameDocumentHandleReferences(
  files: Readonly<Record<string, string>>,
  definition: FormatSymbol,
  fromHandle: string,
  toHandle: string,
) {
  if (!fromHandle || fromHandle === toHandle) return { ...files };
  const namespaces = referenceNamespaces(files, definition);
  const nextFiles = { ...files };

  for (const [file, source] of Object.entries(files)) {
    const replacements: { from: number; to: number; value: string }[] = [];
    for (const { node, depth } of locateNodes(
      parseFormatFile(file, source).tree,
    )) {
      const symbol = symbolFor(node, depth);
      const context = structuredContext(files, symbol);
      if (!context) continue;
      for (const field of node.fields) {
        const compactReference =
          (namespaces.has("owner-local-content") &&
            field.name === definition.kind) ||
          (namespaces.has("choice-placement") && field.name === "choice");
        if (
          unquote(field.value) === fromHandle &&
          (compactReference ||
            fieldIsReference(context, field, namespaces, definition.kind))
        )
          replacements.push({
            from: field.valueRange.from,
            to: field.valueRange.to,
            value: renderedReference(field.value, toHandle),
          });
      }
      const scalarNamespace =
        definition.kind === "choice" && definition.depth > 0
          ? "choice-placement"
          : ["text", "image", "input"].includes(definition.kind) &&
              node.kind === definition.kind
            ? "owner-local-content"
            : null;
      if (
        scalarNamespace &&
        namespaces.has(scalarNamespace) &&
        unquote(node.scalar ?? "") === fromHandle
      ) {
        const range = scalarValueRange(source, node);
        if (range)
          replacements.push({
            ...range,
            value: renderedReference(node.scalar ?? "", toHandle),
          });
      }
    }
    let nextSource = source;
    for (const replacement of replacements.sort(
      (left, right) => right.from - left.from,
    ))
      nextSource =
        nextSource.slice(0, replacement.from) +
        replacement.value +
        nextSource.slice(replacement.to);
    if (nextSource !== source) nextFiles[file] = nextSource;
  }
  return nextFiles;
}

function sameLocalNamespace(
  files: Readonly<Record<string, string>>,
  left: FormatSymbol,
  right: FormatSymbol,
) {
  const localNamespaces = new Set([
    "choice-placement",
    "choice-source",
    "owner-local-content",
    "owner-local-image",
  ]);
  const sharedNamespaces = [...referenceNamespaces(files, left)].filter(
    (namespace) => referenceNamespaces(files, right).has(namespace),
  );
  if (!sharedNamespaces.length) return false;
  if (sharedNamespaces.some((namespace) => !localNamespaces.has(namespace)))
    return true;
  const leftParent = structuredContext(files, left)?.parent;
  const rightParent = structuredContext(files, right)?.parent;
  if (!leftParent || !rightParent) return false;
  return (
    left.kind === right.kind &&
    leftParent.file === rightParent.file &&
    leftParent.from === rightParent.from &&
    leftParent.kind === rightParent.kind
  );
}

export function handleCanPropagate(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  symbols: readonly FormatSymbol[],
  diagnostics: readonly PackageDiagnostic[],
) {
  const handle = symbol.handle ?? "";
  if (!handlePattern.test(handle)) return false;
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "error" &&
        diagnostic.target?.file === symbol.file &&
        diagnostic.target.declarationFrom === symbol.from &&
        diagnostic.target.field === "handle",
    )
  )
    return false;
  return !symbols.some(
    (candidate) =>
      candidate.handle === handle &&
      (candidate.file !== symbol.file || candidate.from !== symbol.from) &&
      sameLocalNamespace(files, symbol, candidate),
  );
}
