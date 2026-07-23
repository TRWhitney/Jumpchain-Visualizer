import format1Schema from "../../schema/format-1.json";
import { parseFormatFile, type SourceField, type SourceNode } from "../markup";
import type { FormatSymbol } from "./languageService";

type LayoutKind = "section-layout" | "choice-layout" | "trait-layout";

type LayoutNodeDefinition = {
  kind: "container" | "leaf" | "special";
  compact?: string;
  compactOnly?: boolean;
  fields?: string | Record<string, unknown>;
  blockFields?: string;
  additionalFields?: Record<string, unknown>;
  children?: string | false;
  allowedLayouts?: readonly LayoutKind[];
  targetsByLayout?: Readonly<Record<string, readonly string[]>>;
};

type LayoutSchema = {
  layoutNodes: Readonly<Record<string, LayoutNodeDefinition>>;
  roots: Readonly<
    Record<
      string,
      {
        exactlyOne?: boolean;
        allowed?: readonly string[];
        descendants?: readonly string[];
      }
    >
  >;
};

const schema = format1Schema as unknown as LayoutSchema;
const layoutKinds = new Set(Object.keys(schema.layoutNodes));
const compactKinds = new Set(
  Object.entries(schema.layoutNodes)
    .filter(([, definition]) => definition.compact)
    .map(([kind]) => kind),
);
const containerKinds = new Set(
  Object.entries(schema.layoutNodes)
    .filter(([, definition]) => definition.kind === "container")
    .map(([kind]) => kind),
);
const handlePattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export type LayoutNodeRef = {
  file: string;
  from: number;
  kind: string;
  compact: boolean;
};

export type LayoutEditorNode = LayoutNodeRef & {
  id: string;
  to: number;
  depth: number;
  parentId: string | null;
  childIds: readonly string[];
  path: string;
  container: boolean;
  target?: string;
  source?: string;
  using?: string;
  fieldNames: readonly string[];
  sourceNode?: SourceNode;
  sourceField?: SourceField;
};

export type LayoutEditorTree = {
  layout: FormatSymbol;
  layoutKind: LayoutKind;
  rootId: string | null;
  nodes: Readonly<Record<string, LayoutEditorNode>>;
  containerIds: readonly string[];
  structurallySafe: boolean;
};

export type LayoutEditResult = {
  changed: boolean;
  files: Record<string, string>;
  reason?: "stale-target" | "no-change" | "invalid-target";
  target?: LayoutNodeRef;
};

export type LayoutNodeSourceSelection = {
  file: string;
  from: number;
  to: number;
};

export function layoutSelectionKey(
  layout: Pick<FormatSymbol, "file" | "from" | "handle" | "kind">,
) {
  return `${layout.file}\u0000${layout.kind}\u0000${layout.handle ?? `@${layout.from}`}`;
}

const unquote = (value: string | undefined) =>
  value?.replace(/^"|"$/g, "") ?? "";

const symbolForNode = (node: SourceNode, depth: number): FormatSymbol => ({
  kind: node.kind,
  file: node.range.file,
  from: node.range.from,
  to: node.range.to,
  depth,
});

function findSourceNode(
  nodes: readonly SourceNode[],
  symbol: FormatSymbol,
): SourceNode | undefined {
  for (const node of nodes) {
    if (
      node.kind === symbol.kind &&
      node.range.file === symbol.file &&
      node.range.from === symbol.from
    )
      return node;
    const nested = findSourceNode(node.children, symbol);
    if (nested) return nested;
  }
  return undefined;
}

function rootRule(layoutKind: LayoutKind) {
  return schema.roots[`${layoutKind.replace("-layout", "")}LayoutRoot`];
}

function compactChildren(node: SourceNode) {
  return node.fields.filter((field) => compactKinds.has(field.name));
}

function blockChildren(node: SourceNode) {
  return node.children.filter((child) => layoutKinds.has(child.kind));
}

export function layoutAllowedNodeKinds(layoutKind: LayoutKind) {
  return [...(rootRule(layoutKind)?.descendants ?? [])];
}

export function layoutRootKinds(layoutKind: LayoutKind) {
  return [...(rootRule(layoutKind)?.allowed ?? [])];
}

export function layoutSlotTargets(layoutKind: LayoutKind) {
  return [
    ...(schema.layoutNodes.slot.targetsByLayout?.[
      layoutKind.replace("-layout", "")
    ] ?? []),
  ];
}

export function layoutNodeIsContainer(kind: string) {
  return containerKinds.has(kind);
}

export function layoutNodeSupportsCompact(kind: string) {
  return compactKinds.has(kind);
}

export function createLayoutEditorTree(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
): LayoutEditorTree | null {
  if (
    !["section-layout", "choice-layout", "trait-layout"].includes(layout.kind)
  )
    return null;
  const source = files[layout.file];
  if (source === undefined) return null;
  const parsed = parseFormatFile(layout.file, source);
  const declaration = findSourceNode(parsed.tree, layout);
  if (!declaration) return null;
  const layoutKind = layout.kind as LayoutKind;
  const roots = declaration.children.filter((node) =>
    layoutRootKinds(layoutKind).includes(node.kind),
  );
  const root = roots[0];
  const mutableNodes: Record<string, LayoutEditorNode> = {};
  const containerIds: string[] = [];

  const build = (
    item: SourceNode | SourceField,
    compact: boolean,
    parentId: string | null,
    depth: number,
    path: string,
  ): string => {
    const kind = compact
      ? (item as SourceField).name
      : (item as SourceNode).kind;
    const range = item.range;
    const id = `${compact ? "field" : "node"}:${range.file}:${range.from}`;
    const sourceNode = compact ? undefined : (item as SourceNode);
    const sourceField = compact ? (item as SourceField) : undefined;
    const field = (name: string) =>
      unquote(
        sourceNode?.fields.find((candidate) => candidate.name === name)?.value,
      );
    const target = compact
      ? unquote(sourceField?.value)
      : ["slot", "text", "image", "input"].includes(kind)
        ? field("target")
        : kind === "choice"
          ? field("target")
          : undefined;
    const node: LayoutEditorNode = {
      id,
      kind,
      file: range.file,
      from: range.from,
      to: range.to,
      compact,
      depth,
      parentId,
      childIds: [],
      path,
      container: containerKinds.has(kind),
      target,
      source: compact ? undefined : field("source") || undefined,
      using: compact ? undefined : field("using") || undefined,
      fieldNames: compact
        ? []
        : (sourceNode?.fields
            .filter((candidate) => !compactKinds.has(candidate.name))
            .map((candidate) => candidate.name) ?? []),
      sourceNode,
      sourceField,
    };
    mutableNodes[id] = node;
    if (node.container) containerIds.push(id);
    if (sourceNode && node.container) {
      const children = [
        ...compactChildren(sourceNode).map((child) => ({
          child,
          compact: true,
        })),
        ...blockChildren(sourceNode).map((child) => ({
          child,
          compact: false,
        })),
      ].sort((left, right) => left.child.range.from - right.child.range.from);
      node.childIds = children.map(({ child, compact: childCompact }, index) =>
        build(
          child,
          childCompact,
          id,
          depth + 1,
          `${path}/${childCompact ? (child as SourceField).name : (child as SourceNode).kind}[${index + 1}]`,
        ),
      );
    }
    return id;
  };

  const rootId = root ? build(root, false, null, 0, `${root.kind}[1]`) : null;
  const declarationLayoutFields = declaration.fields.filter((field) =>
    compactKinds.has(field.name),
  );
  const otherLayoutRoots = declaration.children.filter(
    (node) => layoutKinds.has(node.kind) && node !== root,
  );
  return {
    layout: symbolForNode(declaration, layout.depth),
    layoutKind,
    rootId,
    nodes: mutableNodes,
    containerIds,
    structurallySafe:
      roots.length === 1 &&
      declarationLayoutFields.length === 0 &&
      otherLayoutRoots.length === 0,
  };
}

export function layoutNodeForPath(
  tree: LayoutEditorTree,
  path: string,
): LayoutEditorNode | undefined {
  return Object.values(tree.nodes).find((node) => node.path === path);
}

export function layoutNodeSourceSelection(
  tree: LayoutEditorTree,
  path: string,
): LayoutNodeSourceSelection | null {
  const node = layoutNodeForPath(tree, path);
  if (!node) return null;
  const nameRange = node.sourceField?.nameRange;
  return {
    file: node.file,
    from: nameRange?.from ?? node.from,
    to: nameRange?.to ?? node.from + node.kind.length,
  };
}

function findEditorNode(tree: LayoutEditorTree | null, ref: LayoutNodeRef) {
  return tree
    ? Object.values(tree.nodes).find(
        (node) =>
          node.file === ref.file &&
          node.from === ref.from &&
          node.kind === ref.kind &&
          node.compact === ref.compact,
      )
    : undefined;
}

function asRef(node: LayoutEditorNode | undefined): LayoutNodeRef | undefined {
  return node
    ? {
        file: node.file,
        from: node.from,
        kind: node.kind,
        compact: node.compact,
      }
    : undefined;
}

function lineStart(source: string, from: number) {
  return source.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
}

function lineEnd(source: string, to: number) {
  if (to > 0 && source[to - 1] === "\n") return to;
  const newline = source.indexOf("\n", to);
  return newline < 0 ? source.length : newline + 1;
}

function nodeExtent(source: string, node: LayoutEditorNode) {
  return {
    from: lineStart(source, node.from),
    to: node.compact ? lineEnd(source, node.to) : node.to,
  };
}

function indentationAt(source: string, from: number) {
  return Math.max(0, from - lineStart(source, from));
}

function reindent(text: string, from: number, to: number) {
  const difference = to - from;
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      if (difference > 0) return `${" ".repeat(difference)}${line}`;
      return line.slice(
        Math.min(-difference, line.match(/^ */)?.[0].length ?? 0),
      );
    })
    .join("\n");
}

function insertionOffset(source: string, node: LayoutEditorNode) {
  const text = source.slice(node.from, node.to);
  return node.from + text.trimEnd().length;
}

function changedFiles(
  files: Readonly<Record<string, string>>,
  file: string,
  source: string,
): Record<string, string> {
  return { ...files, [file]: source };
}

function failed(
  files: Readonly<Record<string, string>>,
  reason: LayoutEditResult["reason"],
): LayoutEditResult {
  return { changed: false, files: { ...files }, reason };
}

function validInitialValue(
  layoutKind: LayoutKind,
  kind: string,
  value: string | undefined,
) {
  if (kind === "slot")
    return layoutSlotTargets(layoutKind).includes(value ?? "");
  if (["text", "image", "input", "choice"].includes(kind))
    return handlePattern.test(value ?? "");
  return true;
}

function starter(
  layoutKind: LayoutKind,
  kind: string,
  initial: { target?: string; source?: string; using?: string } = {},
) {
  const target = initial.target;
  if (!validInitialValue(layoutKind, kind, target)) return null;
  if (kind === "grid") return "grid\n  columns: 2";
  if (["stack", "inline", "wrap"].includes(kind)) return `${kind}\n  gap: md`;
  if (["slot", "text", "image", "input", "choice"].includes(kind))
    return `${kind}: ${target}`;
  if (kind === "rule") return "rule";
  if (kind === "expand")
    return [
      "expand",
      ...(initial.source ? [`  source: ${initial.source}`] : []),
      ...(initial.using ? [`  using: ${initial.using}`] : []),
    ].join("\n");
  return null;
}

export function insertLayoutRoot(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  kind: string,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  if (!tree) return failed(files, "stale-target");
  if (tree.rootId || !layoutRootKinds(tree.layoutKind).includes(kind))
    return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  const parsed = parseFormatFile(layout.file, source);
  const declaration = findSourceNode(parsed.tree, layout);
  if (!declaration) return failed(files, "stale-target");
  const offset =
    declaration.range.from +
    source.slice(declaration.range.from, declaration.range.to).trimEnd().length;
  const body = starter(tree.layoutKind, kind);
  if (!body) return failed(files, "invalid-target");
  const rendered = body
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  const nextSource = `${source.slice(0, offset)}\n\n${rendered}\n${source.slice(offset)}`;
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  return {
    changed: true,
    files: nextFiles,
    target: nextTree?.rootId
      ? asRef(nextTree.nodes[nextTree.rootId])
      : undefined,
  };
}

export function insertLayoutChild(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  parentRef: LayoutNodeRef,
  kind: string,
  initial: { target?: string; source?: string; using?: string } = {},
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const parent = findEditorNode(tree, parentRef);
  if (
    !tree ||
    !tree.structurallySafe ||
    !parent?.container ||
    !parent.sourceNode ||
    !layoutAllowedNodeKinds(tree.layoutKind).includes(kind)
  )
    return failed(files, "invalid-target");
  const body = starter(tree.layoutKind, kind, initial);
  if (!body) return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  const offset = insertionOffset(source, parent);
  const indentation = indentationAt(source, parent.from) + 2;
  const rendered = body
    .split("\n")
    .map((line) => `${" ".repeat(indentation)}${line}`)
    .join("\n");
  const prefix = offset > 0 && source[offset - 1] === "\n" ? "" : "\n";
  const nextSource =
    source.slice(0, offset) + `${prefix}${rendered}\n` + source.slice(offset);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const nextParent = nextTree
    ? Object.values(nextTree.nodes).find(
        (node) =>
          node.kind === parent.kind &&
          node.from === parent.from &&
          node.container,
      )
    : undefined;
  const created = nextParent?.childIds.map((id) => nextTree!.nodes[id]).at(-1);
  return { changed: true, files: nextFiles, target: asRef(created) };
}

export function reorderLayoutNode(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
  direction: "up" | "down",
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  const parent = node?.parentId ? tree?.nodes[node.parentId] : undefined;
  if (!tree || !tree.structurallySafe || !node || !parent)
    return failed(files, "invalid-target");
  const index = parent.childIds.indexOf(node.id);
  const otherIndex = direction === "up" ? index - 1 : index + 1;
  if (otherIndex < 0 || otherIndex >= parent.childIds.length)
    return failed(files, "no-change");
  const firstIndex = Math.min(index, otherIndex);
  const first = tree.nodes[parent.childIds[firstIndex]];
  const second = tree.nodes[parent.childIds[firstIndex + 1]];
  const following = parent.childIds[firstIndex + 2]
    ? tree.nodes[parent.childIds[firstIndex + 2]]
    : undefined;
  const source = files[layout.file] ?? "";
  const firstFrom = nodeExtent(source, first).from;
  const secondFrom = nodeExtent(source, second).from;
  const secondTo = following
    ? nodeExtent(source, following).from
    : (parent.sourceNode?.range.to ?? nodeExtent(source, second).to);
  const nextSource =
    source.slice(0, firstFrom) +
    source.slice(secondFrom, secondTo) +
    source.slice(firstFrom, secondFrom) +
    source.slice(secondTo);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const nextParent = nextTree
    ? Object.values(nextTree.nodes).find(
        (candidate) =>
          candidate.kind === parent.kind && candidate.from === parent.from,
      )
    : undefined;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const target = nextParent?.childIds[targetIndex]
    ? nextTree!.nodes[nextParent.childIds[targetIndex]]
    : undefined;
  return { changed: true, files: nextFiles, target: asRef(target) };
}

function isDescendant(
  tree: LayoutEditorTree,
  candidate: LayoutEditorNode,
  ancestor: LayoutEditorNode,
) {
  let current: LayoutEditorNode | undefined = candidate;
  while (current?.parentId) {
    if (current.parentId === ancestor.id) return true;
    current = tree.nodes[current.parentId];
  }
  return false;
}

export function moveLayoutNode(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
  destinationRef: LayoutNodeRef,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  const destination = findEditorNode(tree, destinationRef);
  if (
    !tree ||
    !tree.structurallySafe ||
    !node ||
    !node.parentId ||
    !destination?.container ||
    destination.id === node.id ||
    isDescendant(tree, destination, node)
  )
    return failed(files, "invalid-target");
  if (node.parentId === destination.id) return failed(files, "no-change");
  const source = files[layout.file] ?? "";
  const extent = nodeExtent(source, node);
  const text = source.slice(extent.from, extent.to);
  const removed = source.slice(0, extent.from) + source.slice(extent.to);
  const removedLength = extent.to - extent.from;
  const adjustedDestination: LayoutNodeRef = {
    ...destination,
    from:
      destination.from > extent.from
        ? destination.from - removedLength
        : destination.from,
  };
  const removedFiles = changedFiles(files, layout.file, removed);
  const removedTree = createLayoutEditorTree(removedFiles, layout);
  const nextDestination = findEditorNode(removedTree, adjustedDestination);
  if (!removedTree || !nextDestination?.sourceNode)
    return failed(files, "stale-target");
  const offset = insertionOffset(removed, nextDestination);
  const oldIndentation = indentationAt(source, node.from);
  const newIndentation = indentationAt(removed, nextDestination.from) + 2;
  const rendered = reindent(text, oldIndentation, newIndentation);
  const prefix = offset > 0 && removed[offset - 1] === "\n" ? "" : "\n";
  const nextSource =
    removed.slice(0, offset) +
    `${prefix}${rendered}${rendered.endsWith("\n") ? "" : "\n"}` +
    removed.slice(offset);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const finalDestination = nextTree
    ? Object.values(nextTree.nodes).find(
        (candidate) =>
          candidate.kind === nextDestination.kind &&
          candidate.from === nextDestination.from,
      )
    : undefined;
  const target = finalDestination?.childIds
    .map((id) => nextTree!.nodes[id])
    .at(-1);
  return { changed: true, files: nextFiles, target: asRef(target) };
}

function removeRanges(
  text: string,
  origin: number,
  ranges: readonly { from: number; to: number }[],
) {
  let result = text;
  for (const range of [...ranges].sort((left, right) => right.from - left.from))
    result =
      result.slice(0, range.from - origin) + result.slice(range.to - origin);
  return result;
}

export function removeLayoutNode(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  const parent = node?.parentId ? tree?.nodes[node.parentId] : undefined;
  if (!tree || !tree.structurallySafe || !node || !parent)
    return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  const extent = nodeExtent(source, node);
  let replacement = "";
  if (node.container && node.sourceNode) {
    const headerTo = lineEnd(source, node.from + node.kind.length);
    const presentationFields = node.sourceNode.fields.filter(
      (field) => !compactKinds.has(field.name),
    );
    replacement = removeRanges(
      source.slice(extent.from, extent.to),
      extent.from,
      [
        { from: extent.from, to: headerTo },
        ...presentationFields.map((field) => ({
          from: lineStart(source, field.range.from),
          to: lineEnd(source, field.range.to),
        })),
      ],
    );
    replacement = reindent(
      replacement.replace(/^\n+/, ""),
      indentationAt(source, node.from) + 2,
      indentationAt(source, node.from),
    );
  }
  const nextSource =
    source.slice(0, extent.from) + replacement + source.slice(extent.to);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const adjustedParentFrom =
    parent.from > extent.from
      ? parent.from - (extent.to - extent.from) + replacement.length
      : parent.from;
  const nextParent = nextTree
    ? Object.values(nextTree.nodes).find(
        (candidate) =>
          candidate.kind === parent.kind &&
          candidate.from === adjustedParentFrom,
      )
    : undefined;
  return { changed: true, files: nextFiles, target: asRef(nextParent) };
}

function renderedField(field: SourceField, indentation: number) {
  return `${" ".repeat(indentation)}${field.name}: ${field.value}`;
}

export function convertLayoutNode(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
  kind: string,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  if (
    !tree ||
    !tree.structurallySafe ||
    !node ||
    !layoutAllowedNodeKinds(tree.layoutKind).includes(kind) ||
    node.kind === kind
  )
    return failed(files, node?.kind === kind ? "no-change" : "invalid-target");
  if (node.container !== containerKinds.has(kind))
    return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  if (node.container && node.sourceNode) {
    let nextSource =
      source.slice(0, node.from) +
      kind +
      source.slice(node.from + node.kind.length);
    let nextFiles = changedFiles(files, layout.file, nextSource);
    let nextTree = createLayoutEditorTree(nextFiles, layout);
    let nextNode = nextTree
      ? Object.values(nextTree.nodes).find(
          (candidate) =>
            candidate.from === node.from && candidate.kind === kind,
        )
      : undefined;
    if (node.kind === "grid" && kind !== "grid" && nextNode?.sourceNode) {
      const columns = nextNode.sourceNode.fields.find(
        (field) => field.name === "columns",
      );
      if (columns) {
        const from = lineStart(nextSource, columns.range.from);
        const to = lineEnd(nextSource, columns.range.to);
        nextSource = nextSource.slice(0, from) + nextSource.slice(to);
        nextFiles = changedFiles(files, layout.file, nextSource);
      }
    } else if (node.kind !== "grid" && kind === "grid" && nextNode) {
      const headerEnd = lineEnd(nextSource, nextNode.from + kind.length);
      const indentation = indentationAt(nextSource, nextNode.from) + 2;
      nextSource =
        nextSource.slice(0, headerEnd) +
        `${" ".repeat(indentation)}columns: 2\n` +
        nextSource.slice(headerEnd);
      nextFiles = changedFiles(files, layout.file, nextSource);
    }
    nextTree = createLayoutEditorTree(nextFiles, layout);
    nextNode = nextTree
      ? Object.values(nextTree.nodes).find(
          (candidate) =>
            candidate.from === node.from && candidate.kind === kind,
        )
      : undefined;
    return { changed: true, files: nextFiles, target: asRef(nextNode) };
  }

  const extent = nodeExtent(source, node);
  const indentation = indentationAt(source, node.from);
  const authoredTarget =
    node.target ||
    node.source ||
    (kind === "slot" ? layoutSlotTargets(tree.layoutKind)[0] : `new_${kind}`);
  const target = validInitialValue(tree.layoutKind, kind, authoredTarget)
    ? authoredTarget
    : kind === "slot"
      ? layoutSlotTargets(tree.layoutKind)[0]
      : `new_${kind}`;
  let body: string;
  if (["slot", "text", "image", "input"].includes(kind)) {
    const fields = node.sourceNode?.fields ?? [];
    const shared = fields.filter((field) =>
      [
        "padding",
        "background",
        "align",
        "text-align",
        "text-size",
        "text-color",
      ].includes(field.name),
    );
    body =
      shared.length || !node.compact
        ? [
            kind,
            `${" ".repeat(2)}target: ${target}`,
            ...shared.map((field) => renderedField(field, 2)),
          ].join("\n")
        : `${kind}: ${target}`;
  } else if (kind === "choice") body = `choice: ${target}`;
  else if (kind === "rule") body = "rule";
  else body = ["expand", ...(target ? [`  source: ${target}`] : [])].join("\n");
  const rendered = body
    .split("\n")
    .map((line) => `${" ".repeat(indentation)}${line}`)
    .join("\n");
  const nextSource =
    source.slice(0, extent.from) +
    `${rendered}${rendered.endsWith("\n") ? "" : "\n"}` +
    source.slice(extent.to);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const nextNode = nextTree
    ? Object.values(nextTree.nodes).find(
        (candidate) =>
          candidate.from === extent.from + indentation &&
          candidate.kind === kind,
      )
    : undefined;
  return { changed: true, files: nextFiles, target: asRef(nextNode) };
}

export function setLayoutNodeTarget(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
  value: string,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  if (
    !tree ||
    !tree.structurallySafe ||
    !node ||
    value.includes("\n") ||
    value.includes("\r")
  )
    return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  const range = node.compact
    ? node.sourceField?.valueRange
    : node.sourceNode?.fields.find((field) => field.name === "target")
        ?.valueRange;
  if (!range) return failed(files, "invalid-target");
  if (source.slice(range.from, range.to) === value)
    return failed(files, "no-change");
  const nextSource =
    source.slice(0, range.from) + value + source.slice(range.to);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  return {
    changed: true,
    files: nextFiles,
    target: { ...nodeRef },
  };
}

export function expandLayoutLeaf(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  if (
    !tree ||
    !tree.structurallySafe ||
    !node?.compact ||
    !["slot", "text", "image", "input"].includes(node.kind)
  )
    return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  const extent = nodeExtent(source, node);
  const indentation = indentationAt(source, node.from);
  const replacement = `${" ".repeat(indentation)}${node.kind}\n${" ".repeat(
    indentation + 2,
  )}target: ${node.target}\n`;
  const nextSource =
    source.slice(0, extent.from) + replacement + source.slice(extent.to);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const target = nextTree
    ? Object.values(nextTree.nodes).find(
        (candidate) =>
          candidate.from === extent.from + indentation &&
          candidate.kind === node.kind &&
          !candidate.compact,
      )
    : undefined;
  return { changed: true, files: nextFiles, target: asRef(target) };
}

export function collapseLayoutLeaf(
  files: Readonly<Record<string, string>>,
  layout: FormatSymbol,
  nodeRef: LayoutNodeRef,
): LayoutEditResult {
  const tree = createLayoutEditorTree(files, layout);
  const node = findEditorNode(tree, nodeRef);
  if (
    !tree ||
    !tree.structurallySafe ||
    !node?.sourceNode ||
    node.compact ||
    !["slot", "text", "image", "input"].includes(node.kind) ||
    node.fieldNames.some((field) => field !== "target")
  )
    return failed(files, "invalid-target");
  const source = files[layout.file] ?? "";
  const extent = nodeExtent(source, node);
  const indentation = indentationAt(source, node.from);
  const replacement = `${" ".repeat(indentation)}${node.kind}: ${node.target}\n`;
  const nextSource =
    source.slice(0, extent.from) + replacement + source.slice(extent.to);
  const nextFiles = changedFiles(files, layout.file, nextSource);
  const nextTree = createLayoutEditorTree(nextFiles, layout);
  const target = nextTree
    ? Object.values(nextTree.nodes).find(
        (candidate) =>
          candidate.from === extent.from + indentation &&
          candidate.kind === node.kind &&
          candidate.compact,
      )
    : undefined;
  return { changed: true, files: nextFiles, target: asRef(target) };
}
