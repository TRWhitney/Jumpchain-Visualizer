import type { ParsedFormatFile, SourceNode } from "./model";

export type ConditionPropertyType =
  "boolean" | "integer" | "string" | "unknown";

export type ConditionPropertyOrigin = {
  kind: "engine" | "context" | "control" | "grant";
  ownerKind?: string;
  ownerHandle?: string;
  file?: string;
  line?: number;
};

export type ConditionPropertyDescriptor = {
  handle: string;
  type: ConditionPropertyType;
  category: "context" | "engine" | "package";
  origins: readonly ConditionPropertyOrigin[];
  values: readonly (string | number | boolean)[];
  minimum?: number;
  maximum?: number;
  mayBeUnset: boolean;
};

type NodeEntry = {
  node: SourceNode;
  parent?: SourceNode;
  ancestors?: readonly SourceNode[];
};

const unquote = (value: string | undefined) => {
  if (!value) return "";
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    : value;
};

const field = (node: SourceNode | undefined, name: string) =>
  node?.fields.find((candidate) => candidate.name === name)?.value;

const integerField = (node: SourceNode | undefined, name: string) => {
  const parsed = Number(unquote(field(node, name)));
  return Number.isInteger(parsed) ? parsed : undefined;
};

function entriesForNode(
  node: SourceNode,
  ancestors: readonly SourceNode[] = [],
): NodeEntry[] {
  return [
    { node, parent: ancestors.at(-1), ancestors },
    ...node.children.flatMap((child) =>
      entriesForNode(child, [...ancestors, node]),
    ),
  ];
}

export function conditionNodeEntries(parsed: readonly ParsedFormatFile[]) {
  return parsed.flatMap((file) =>
    file.tree.flatMap((node) => entriesForNode(node)),
  );
}

export function conditionContextHandles(
  node: SourceNode,
  parent?: SourceNode,
  ancestors: readonly SourceNode[] = [],
) {
  const owner = ["choice", "input"].includes(node.kind)
    ? node
    : parent && ["choice", "input"].includes(parent.kind)
      ? parent
      : [...ancestors]
          .reverse()
          .find((ancestor) => ["choice", "input"].includes(ancestor.kind));
  if (!owner || unquote(field(owner, "selection")) !== "integer") return [];
  const measures: string[] = [];
  const directVisibleGrants = owner.fields
    .filter((candidate) => candidate.name === "grant")
    .map((candidate) => unquote(candidate.value))
    .filter((kind) => ["perk", "item"].includes(kind));
  if (directVisibleGrants.length === 1)
    measures.push(unquote(field(owner, "measure")) || "rank");
  for (const grant of owner.children.filter(
    (child) =>
      child.kind === "grant" &&
      ["perk", "item", "trait"].includes(unquote(field(child, "kind"))),
  ))
    measures.push(unquote(field(grant, "measure")) || "rank");
  return [
    ...new Set(
      measures.map((measure) => (measure === "quantity" ? "count" : "rank")),
    ),
  ];
}

function literalValue(raw: string | undefined) {
  if (raw === undefined) return undefined;
  if (raw.startsWith('"') && raw.endsWith('"')) return unquote(raw);
  if (raw === "true" || raw === "false") return raw === "true";
  if (/^-?(?:0|[1-9][0-9]*)$/.test(raw)) return Number(raw);
  return undefined;
}

function selectionType(selection: string): ConditionPropertyType {
  if (selection === "toggle") return "boolean";
  if (selection === "integer") return "integer";
  if (selection === "text" || selection === "select") return "string";
  return "unknown";
}

function controlProperty(
  node: SourceNode,
): ConditionPropertyDescriptor | undefined {
  const handle = unquote(field(node, "handle"));
  const selection =
    unquote(field(node, "selection")) ||
    (node.kind === "choice" ? "toggle" : "");
  const type = selectionType(selection);
  if (!handle || type === "unknown") return undefined;
  return {
    handle,
    type,
    category: "context",
    origins: [
      {
        kind: "control",
        ownerKind: node.kind,
        ownerHandle: handle,
        file: node.range.file,
        line: node.range.line,
      },
    ],
    values:
      selection === "toggle"
        ? [true, false]
        : selection === "select"
          ? node.fields
              .filter((candidate) => candidate.name === "option")
              .map((candidate) => unquote(candidate.value))
              .filter(Boolean)
          : [],
    minimum: selection === "integer" ? integerField(node, "min") : undefined,
    maximum: selection === "integer" ? integerField(node, "max") : undefined,
    mayBeUnset: true,
  };
}

/**
 * Returns scalar answers that exist only while rendering content owned by a
 * Choice. These handles are deliberately contextual: Input handles are
 * owner-local, so exposing them package-wide would make otherwise valid
 * packages ambiguous.
 */
export function conditionControlProperties(
  node: SourceNode,
  parent?: SourceNode,
  ancestors: readonly SourceNode[] = [],
) {
  if (node.kind !== "text") return [];
  const lineage = [...ancestors, ...(parent ? [parent] : [])];
  const choice = [...lineage]
    .reverse()
    .find((ancestor) => ancestor.kind === "choice");
  if (!choice) return [];
  const properties = [
    choice,
    ...choice.children.filter((child) => child.kind === "input"),
  ]
    .map(controlProperty)
    .filter((property): property is ConditionPropertyDescriptor =>
      Boolean(property),
    );
  return [
    ...new Map(
      properties.map((property) => [property.handle, property]),
    ).values(),
  ];
}

function valueType(
  value: string | number | boolean | undefined,
): ConditionPropertyType {
  return typeof value === "boolean"
    ? "boolean"
    : typeof value === "number"
      ? "integer"
      : typeof value === "string"
        ? "string"
        : "unknown";
}

function uniqueValues(values: readonly (string | number | boolean)[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${typeof value}:${String(value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectConditionProperties(entries: readonly NodeEntry[]) {
  const collected = new Map<string, ConditionPropertyDescriptor>();
  const add = (descriptor: ConditionPropertyDescriptor) => {
    const current = collected.get(descriptor.handle);
    if (!current) {
      collected.set(descriptor.handle, descriptor);
      return;
    }
    collected.set(descriptor.handle, {
      ...current,
      type:
        current.type === descriptor.type
          ? current.type
          : current.type === "unknown"
            ? descriptor.type
            : descriptor.type === "unknown"
              ? current.type
              : "unknown",
      category:
        current.category === "package" || descriptor.category === "package"
          ? "package"
          : current.category,
      origins: [...current.origins, ...descriptor.origins],
      values: uniqueValues([...current.values, ...descriptor.values]),
      minimum:
        current.minimum === undefined
          ? descriptor.minimum
          : descriptor.minimum === undefined
            ? current.minimum
            : Math.min(current.minimum, descriptor.minimum),
      maximum:
        current.maximum === undefined
          ? descriptor.maximum
          : descriptor.maximum === undefined
            ? current.maximum
            : Math.max(current.maximum, descriptor.maximum),
      mayBeUnset: current.mayBeUnset || descriptor.mayBeUnset,
    });
  };
  for (const [handle, type, category] of [
    ["rank", "integer", "context"],
    ["count", "integer", "context"],
    ["gauntlet", "boolean", "engine"],
    ["gender", "string", "engine"],
    ["age", "integer", "engine"],
  ] as const)
    add({
      handle,
      type,
      category,
      origins: [{ kind: category }],
      values: type === "boolean" ? [true, false] : [],
      mayBeUnset: !["gauntlet", "rank", "count"].includes(handle),
    });

  for (const { node, parent } of entries) {
    if (node.kind !== "grant" || unquote(field(node, "kind")) !== "property")
      continue;
    const handle = unquote(field(node, "handle"));
    if (!handle) continue;
    const authoredValue = literalValue(field(node, "value"));
    const selection = unquote(field(parent, "selection"));
    const type =
      authoredValue === undefined
        ? selectionType(selection)
        : valueType(authoredValue);
    const optionValues =
      authoredValue === undefined && selection === "select"
        ? (parent?.fields ?? [])
            .filter((candidate) => candidate.name === "option")
            .map((candidate) => unquote(candidate.value))
            .filter(Boolean)
        : [];
    const values =
      authoredValue !== undefined
        ? [authoredValue]
        : selection === "toggle"
          ? [true, false]
          : optionValues;
    add({
      handle,
      type,
      category: "package",
      origins: [
        {
          kind: "grant",
          ownerKind: parent?.kind,
          ownerHandle: unquote(field(parent, "handle")),
          file: node.range.file,
          line: node.range.line,
        },
      ],
      values,
      minimum:
        authoredValue === undefined && selection === "integer"
          ? integerField(parent, "min")
          : undefined,
      maximum:
        authoredValue === undefined && selection === "integer"
          ? integerField(parent, "max")
          : undefined,
      mayBeUnset: true,
    });
  }
  return [...collected.values()].sort((left, right) => {
    const categoryOrder = { context: 0, engine: 1, package: 2 } as const;
    return (
      categoryOrder[left.category] - categoryOrder[right.category] ||
      left.handle.localeCompare(right.handle)
    );
  });
}

export function conditionPropertyCatalog(parsed: readonly ParsedFormatFile[]) {
  return collectConditionProperties(conditionNodeEntries(parsed));
}
