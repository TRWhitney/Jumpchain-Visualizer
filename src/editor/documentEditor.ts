import format1Schema from "../../schema/format-1.json";
import { parseFormatFile, type SourceField, type SourceNode } from "../markup";
import type { FormatSymbol } from "./languageService";

export type FieldDefinition = {
  type?: string;
  required?: boolean;
  repeatable?: boolean;
  values?: string[];
  min?: number;
  max?: number;
  minimum?: number;
  maximum?: number;
  const?: string | number | boolean;
  default?: string | number | boolean;
  defaultForIntegerVisibleGrant?: string;
  conditionalVariants?: boolean;
  appliesWhen?: Readonly<Record<string, readonly string[]>>;
  exclusiveWith?: readonly string[];
};

export type FieldDefault =
  | { kind: "value"; value: string | number | boolean }
  | {
      kind: "built-in-layout";
      layout: "section" | "choice" | "trait";
    };

type DeclarationDefinition = {
  contexts?: string[];
  fields?: Record<string, FieldDefinition>;
  fieldSet?: string;
  children?: Record<string, ChildDefinition>;
  forms?: {
    scalar?: { type?: string; values?: string[] };
    block?: {
      fields?: Record<string, FieldDefinition>;
      children?: Record<string, ChildDefinition>;
    };
  };
  formsByContext?: Record<
    string,
    {
      fields?: Record<string, FieldDefinition>;
      children?: Record<string, ChildDefinition>;
    }
  >;
};

type ChildDefinition = {
  appliesWhen?: Readonly<Record<string, readonly string[]>>;
};

type FormatSchema = {
  declarations: Record<string, DeclarationDefinition>;
  fieldSets: Record<string, Record<string, FieldDefinition>>;
  types: Record<
    string,
    {
      enum?: readonly (string | boolean)[];
      builtInTokens?: readonly string[];
      costTokens?: readonly string[];
      awardTokens?: readonly string[];
      grantTokens?: readonly string[];
    }
  >;
  layoutNodes: Record<
    string,
    {
      kind: string;
      fields?: string | Record<string, FieldDefinition>;
      blockFields?: string;
      additionalFields?: Record<string, FieldDefinition>;
      children?: string | false;
      allowedLayouts?: readonly string[];
      targetNamespace?: string;
      targetsByLayout?: Record<string, readonly string[]>;
    }
  >;
  roots: Record<string, { descendants?: readonly string[] }>;
};

const schema = format1Schema as unknown as FormatSchema;

export type DocumentEditResult = {
  changed: boolean;
  files: Record<string, string>;
  reason?: "stale-target" | "no-change";
  selection?: { file: string; from: number; to: number };
  target?: FormatSymbol;
  focusField?: string;
};

const walk = (nodes: readonly SourceNode[]): SourceNode[] =>
  nodes.flatMap((node) => [node, ...walk(node.children)]);

type LocatedNode = {
  node: SourceNode;
  parent?: SourceNode;
  ancestors: SourceNode[];
  depth: number;
};

const locateNodes = (
  nodes: readonly SourceNode[],
  ancestors: readonly SourceNode[] = [],
): LocatedNode[] =>
  nodes.flatMap((node) => [
    {
      node,
      parent: ancestors.at(-1),
      ancestors: [...ancestors],
      depth: ancestors.length,
    },
    ...locateNodes(node.children, [...ancestors, node]),
  ]);

const unquote = (value: string | undefined) =>
  value?.replace(/^"|"$/g, "") ?? "";

function locateSymbol(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
) {
  const parsed = parseFormatFile(symbol.file, files[symbol.file] ?? "");
  return locateNodes(parsed.tree).find(
    ({ node }) => node.kind === symbol.kind && node.range.from === symbol.from,
  );
}

function contextName(parent: SourceNode | undefined) {
  if (!parent) return "top-level";
  if (parent.kind !== "grant") return parent.kind;
  return `grant:${unquote(parent.fields.find((field) => field.name === "kind")?.value)}`;
}

function layoutKind(ancestors: readonly SourceNode[]) {
  return ancestors.find((node) => node.kind.endsWith("-layout"))?.kind;
}

function layoutFieldDefinitions(kind: string) {
  const definition = schema.layoutNodes[kind];
  if (!definition) return {};
  const fields =
    typeof definition.fields === "string"
      ? schema.fieldSets[definition.fields]
      : definition.fields;
  return Object.assign(
    {},
    fields,
    definition.blockFields ? schema.fieldSets[definition.blockFields] : {},
    definition.additionalFields,
  ) as Record<string, FieldDefinition>;
}

function applicableFieldNames(
  node: SourceNode,
  allFields: Readonly<Record<string, FieldDefinition>>,
) {
  const names = Object.keys(allFields);
  const value = (name: string, fallback = "") =>
    unquote(node.fields.find((field) => field.name === name)?.value) ||
    fallback;
  return names.filter((name) => {
    const applicability = allFields[name].appliesWhen;
    if (!applicability) return true;
    return Object.entries(applicability).every(([field, allowed]) =>
      allowed.includes(value(field)),
    );
  });
}

export type StructuredContext = {
  symbol: FormatSymbol;
  node: SourceNode;
  parent?: FormatSymbol;
  ancestors: FormatSymbol[];
  context: string;
  scalar: boolean;
  layout?: string;
  fields: Record<string, FieldDefinition>;
  visibleFields: string[];
  invalidAuthoredFields: string[];
  childKinds: string[];
  children: FormatSymbol[];
};

function symbolForNode(node: SourceNode, depth: number): FormatSymbol {
  const field = (name: string) =>
    unquote(node.fields.find((candidate) => candidate.name === name)?.value);
  return {
    kind: node.kind,
    handle: field("handle") || undefined,
    name: field("name") || undefined,
    file: node.range.file,
    from: node.range.from,
    to: node.range.to,
    depth,
  };
}

export function structuredContext(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
): StructuredContext | null {
  const located = locateSymbol(files, symbol);
  if (!located) return null;
  const { node, parent, ancestors, depth } = located;
  const declaration = schema.declarations[node.kind];
  const context = contextName(parent);
  const contextualForm = declaration?.formsByContext?.[context];
  const ownerLayout = layoutKind(ancestors);
  const layoutDefinition = ownerLayout
    ? schema.layoutNodes[node.kind]
    : undefined;
  const fields = layoutDefinition
    ? layoutFieldDefinitions(node.kind)
    : (Object.assign(
        {},
        declaration?.fieldSet ? schema.fieldSets[declaration.fieldSet] : {},
        declaration?.fields,
        node.scalar === undefined ? declaration?.forms?.block?.fields : {},
        contextualForm?.fields,
      ) as Record<string, FieldDefinition>);
  const visibleFields = applicableFieldNames(node, fields);
  const authoredNames = [...new Set(node.fields.map((field) => field.name))];
  const childRules =
    node.scalar !== undefined
      ? {}
      : (contextualForm?.children ??
        declaration?.forms?.block?.children ??
        declaration?.children ??
        {});
  const nodeValue = (name: string) =>
    unquote(node.fields.find((field) => field.name === name)?.value);
  let childKinds = Object.entries(childRules)
    .filter(([, rule]) =>
      Object.entries(rule.appliesWhen ?? {}).every(([field, allowed]) =>
        allowed.includes(nodeValue(field)),
      ),
    )
    .map(([kind]) => kind);
  if (layoutDefinition && layoutDefinition.children !== false) {
    const root = ownerLayout
      ? schema.roots[`${ownerLayout.replace("-layout", "")}LayoutRoot`]
      : undefined;
    childKinds = [
      ...(root?.descendants ?? Object.keys(schema.layoutNodes)),
    ].filter((kind) => {
      const allowed = schema.layoutNodes[kind]?.allowedLayouts;
      return !allowed || !ownerLayout || allowed.includes(ownerLayout);
    });
  }
  return {
    symbol: symbolForNode(node, depth),
    node,
    parent: parent ? symbolForNode(parent, Math.max(0, depth - 1)) : undefined,
    ancestors: ancestors.map(symbolForNode),
    context,
    scalar: node.scalar !== undefined,
    layout: ownerLayout,
    fields,
    visibleFields,
    invalidAuthoredFields: authoredNames.filter(
      (name) => !visibleFields.includes(name),
    ),
    childKinds,
    children: node.children.map((child) => symbolForNode(child, depth + 1)),
  };
}

function declarationFields(kind: string) {
  const definition = schema.declarations[kind];
  if (!definition) return {};
  return Object.assign(
    {},
    definition.fieldSet ? schema.fieldSets[definition.fieldSet] : {},
    definition.fields,
    definition.forms?.block?.fields,
    ...Object.values(definition.formsByContext ?? {}).map(
      (form) => form.fields ?? {},
    ),
  ) as Record<string, FieldDefinition>;
}

export function fieldDefinition(kind: string, field: string) {
  return declarationFields(kind)[field];
}

export function fieldValues(definition: FieldDefinition | undefined) {
  if (!definition) return [];
  if (definition.values?.length) return definition.values;
  const type = schema.types[definition.type ?? ""];
  return (
    type?.enum ?? [
      ...(type?.builtInTokens ?? []),
      ...(type?.costTokens ?? []),
      ...(type?.awardTokens ?? []),
      ...(type?.grantTokens ?? []),
    ]
  ).map(String);
}

export function fieldDefault(
  kind: string,
  field: string,
  context: Readonly<Record<string, string>> = {},
): FieldDefault | null {
  const definition = fieldDefinition(kind, field);
  if (
    field === "measure" &&
    context.integerVisibleGrant === "true" &&
    definition?.defaultForIntegerVisibleGrant !== undefined
  )
    return {
      kind: "value",
      value: definition.defaultForIntegerVisibleGrant,
    };
  if (kind === "input" && field === "min" && context.selection === "companions")
    return { kind: "value", value: 0 };
  if (
    kind === "jump" &&
    field === "starting-points" &&
    context.gauntlet === "true"
  )
    return { kind: "value", value: 0 };
  if (definition?.default !== undefined)
    return { kind: "value", value: definition.default };
  const layout = /^handleReference:(section|choice|trait)-layout$/.exec(
    definition?.type ?? "",
  )?.[1] as "section" | "choice" | "trait" | undefined;
  if (kind === "grant" && field === "layout" && context.grantKind !== "trait")
    return null;
  const inheritedLayout = layout ? context[`${layout}Layout`] : undefined;
  if (inheritedLayout) return { kind: "value", value: inheritedLayout };
  return layout ? { kind: "built-in-layout", layout } : null;
}

export function declarationFieldNames(kind: string) {
  return Object.keys(declarationFields(kind));
}

const childStarters: Readonly<Record<string, string>> = {
  "choice-source": "choice-source\n  handle: new_source\n  mode: multi",
  choice: "choice\n  handle: new_placement\n  target: choice_handle",
  text: 'text\n  handle: new_text\n  content: ""',
  image: 'image\n  handle: new_image\n  src: "assets/image.png"\n  alt: ""',
  input: "input\n  handle: new_input\n  selection: text",
  cost: "cost\n  resource: jump_points\n  amount: 0",
  grant: 'grant\n  kind: perk\n  name: "New grant"',
};

const preferredFocusFields: Readonly<Record<string, string>> = {
  "choice-source": "group",
  choice: "target",
  text: "content",
  image: "src",
  input: "selection",
  cost: "amount",
  grant: "kind",
};

function uniqueStarter(
  files: Readonly<Record<string, string>>,
  starter: string,
) {
  const handles = new Set(
    Object.entries(files)
      .flatMap(([file, source]) => walk(parseFormatFile(file, source).tree))
      .flatMap((node) =>
        node.fields
          .filter((field) => field.name === "handle")
          .map((field) => unquote(field.value)),
      ),
  );
  const match = /(^|\n)(\s*handle:\s*)([a-z0-9_]+)/.exec(starter);
  if (!match || !handles.has(match[3])) return starter;
  let suffix = 2;
  while (handles.has(`${match[3]}_${suffix}`)) suffix += 1;
  return (
    starter.slice(0, match.index + match[1].length + match[2].length) +
    `${match[3]}_${suffix}` +
    starter.slice(match.index + match[0].length)
  );
}

export function insertDocumentChild(
  files: Readonly<Record<string, string>>,
  owner: FormatSymbol,
  kind: string,
): DocumentEditResult {
  const located = locateSymbol(files, owner);
  const starter =
    kind === "grant" && owner.kind === "input"
      ? "grant\n  kind: resource\n  resource: jump_points\n  amount: 0"
      : childStarters[kind];
  if (!located || !starter)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const source = files[owner.file] ?? "";
  const ownerSource = source.slice(
    located.node.range.from,
    located.node.range.to,
  );
  const trimmedLength = ownerSource.trimEnd().length;
  const insertion = located.node.range.from + trimmedLength;
  const indentation = "  ".repeat(located.depth + 1);
  const indented = uniqueStarter(files, starter)
    .split("\n")
    .map((line) => `${indentation}${line}`)
    .join("\n");
  const inserted = `\n${indented}\n`;
  const nextFiles = {
    ...files,
    [owner.file]:
      source.slice(0, insertion) + inserted + source.slice(insertion),
  };
  const nextOwner = locateSymbol(nextFiles, owner);
  const createdNode = [...(nextOwner?.node.children ?? [])]
    .reverse()
    .find((child) => child.kind === kind);
  const target = createdNode
    ? symbolForNode(createdNode, located.depth + 1)
    : undefined;
  return {
    changed: true,
    files: nextFiles,
    target,
    focusField: preferredFocusFields[kind],
  };
}

export function removeDocumentDeclaration(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
): DocumentEditResult {
  const located = locateSymbol(files, symbol);
  if (!located)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const source = files[symbol.file] ?? "";
  let from = located.node.range.from;
  const to = located.node.range.to;
  if (from > 0 && source[from - 1] === "\n") from -= 1;
  return {
    changed: true,
    files: {
      ...files,
      [symbol.file]: source.slice(0, from) + source.slice(to),
    },
    target: located.parent
      ? symbolForNode(located.parent, Math.max(0, located.depth - 1))
      : undefined,
  };
}

export function moveDocumentChild(
  files: Readonly<Record<string, string>>,
  owner: FormatSymbol,
  child: FormatSymbol,
  direction: "up" | "down",
): DocumentEditResult {
  const located = locateSymbol(files, owner);
  if (!located)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const index = located.node.children.findIndex(
    (candidate) =>
      candidate.kind === child.kind && candidate.range.from === child.from,
  );
  const otherIndex = direction === "up" ? index - 1 : index + 1;
  const other = located.node.children[otherIndex];
  const current = located.node.children[index];
  if (!current || !other)
    return { changed: false, files: { ...files }, reason: "no-change" };
  const left = direction === "up" ? other : current;
  const right = direction === "up" ? current : other;
  const source = files[owner.file] ?? "";
  const leftText = source.slice(left.range.from, left.range.to);
  const between = source.slice(left.range.to, right.range.from);
  const rightText = source.slice(right.range.from, right.range.to);
  const nextFiles = {
    ...files,
    [owner.file]:
      source.slice(0, left.range.from) +
      rightText +
      between +
      leftText +
      source.slice(right.range.to),
  };
  const nextOwner = locateSymbol(nextFiles, owner);
  const target = nextOwner?.node.children.find((candidate) => {
    if (candidate.kind !== child.kind) return false;
    const candidateHandle = unquote(
      candidate.fields.find((field) => field.name === "handle")?.value,
    );
    return child.handle
      ? candidateHandle === child.handle
      : candidate.range.from !== other.range.from;
  });
  return {
    changed: true,
    files: nextFiles,
    target: target ? symbolForNode(target, located.depth + 1) : undefined,
  };
}

export function createAndAssignDocumentResource(
  files: Readonly<Record<string, string>>,
  owner: FormatSymbol,
  values: {
    handle: string;
    name: string;
    abbreviation?: string;
    initial?: string;
  },
): DocumentEditResult {
  const initial = values.initial?.trim() || "0";
  if (
    !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(values.handle) ||
    !values.name.trim() ||
    /[\r\n]/.test(values.name) ||
    /[\r\n]/.test(values.abbreviation ?? "") ||
    !/^-?(?:0|[1-9][0-9]*)$/.test(initial)
  )
    return { changed: false, files: { ...files }, reason: "no-change" };
  const knownHandles = new Set(
    Object.entries(files)
      .flatMap(([file, source]) => walk(parseFormatFile(file, source).tree))
      .filter((node) => node.kind === "resource")
      .flatMap((node) =>
        node.fields
          .filter((field) => field.name === "handle")
          .map((field) => unquote(field.value)),
      ),
  );
  if (values.handle === "jump_points" || knownHandles.has(values.handle))
    return { changed: false, files: { ...files }, reason: "no-change" };
  const assigned = setDocumentField(files, owner, "resource", values.handle);
  if (!assigned.changed)
    return { changed: false, files: { ...files }, reason: assigned.reason };
  const quote = (value: string) =>
    `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const resource = [
    "resource",
    `  handle: ${values.handle}`,
    `  name: ${quote(values.name)}`,
    ...(values.abbreviation
      ? [`  abbreviation: ${quote(values.abbreviation)}`]
      : []),
    `  initial: ${initial}`,
  ].join("\n");
  const file = "jump.jdef";
  const source = assigned.files[file] ?? "";
  const nextFiles = {
    ...assigned.files,
    [file]: `${source.trimEnd()}\n\n${resource}\n`,
  };
  const targetNode = walk(parseFormatFile(file, nextFiles[file]).tree).find(
    (node) =>
      node.kind === "resource" &&
      node.fields.some(
        (field) =>
          field.name === "handle" && unquote(field.value) === values.handle,
      ),
  );
  return {
    changed: true,
    files: nextFiles,
    target: targetNode ? symbolForNode(targetNode, 0) : undefined,
    focusField: "name",
  };
}

export type QuickAddFieldMode = "add" | "complete";

function findNode(source: string, symbol: FormatSymbol) {
  const parsed = parseFormatFile(symbol.file, source);
  const nodes = walk(parsed.tree).filter((node) => node.kind === symbol.kind);
  return (
    nodes.find((node) => node.range.from === symbol.from) ??
    nodes.find((node) => {
      const handle = node.fields.find(
        (field) => field.name === "handle",
      )?.value;
      return symbol.handle !== undefined && handle === symbol.handle;
    })
  );
}

export function sourceField(
  source: string,
  symbol: FormatSymbol,
  name: string,
  occurrence = 0,
) {
  const node = findNode(source, symbol);
  if (!node) return undefined;
  return node.fields.filter(
    (field) => field.name === name && field.condition === undefined,
  )[occurrence];
}

export function readSourceField(
  source: string,
  symbol: FormatSymbol,
  name: string,
  occurrence = 0,
) {
  const field = sourceField(source, symbol, name, occurrence);
  return field ? unquoteValue(field.value) : "";
}

const unquoteValue = (value: string) =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;

export function quickAddFieldMode(
  source: string,
  symbol: FormatSymbol,
  name: string,
  definitionOverride?: FieldDefinition,
): QuickAddFieldMode | null {
  const definition = definitionOverride ?? fieldDefinition(symbol.kind, name);
  const existing = sourceField(source, symbol, name);
  if (!existing) return "add";
  const value = unquoteValue(existing.value).trim();
  const required = Boolean(definition?.required || (definition?.min ?? 0) > 0);
  if (required && !value) return "complete";
  if (definition?.const !== undefined && value !== String(definition.const))
    return "complete";
  return null;
}

export function readSourceFields(
  source: string,
  symbol: FormatSymbol,
  name: string,
) {
  const node = findNode(source, symbol);
  if (!node) return [];
  return node.fields
    .filter((field) => field.name === name && field.condition === undefined)
    .map((field) => unquoteValue(field.value));
}

export function readConditionalSourceFields(
  source: string,
  symbol: FormatSymbol,
  name: string,
) {
  const node = findNode(source, symbol);
  if (!node) return [];
  return node.fields
    .filter((field) => field.name === name && field.condition !== undefined)
    .map((field) => ({
      condition: field.condition ?? "",
      value: unquoteValue(field.value),
    }));
}

export function readConditionalSourceFieldGroups(
  source: string,
  symbol: FormatSymbol,
  name: string,
) {
  const node = findNode(source, symbol);
  if (!node) return [];
  let baseOccurrence = -1;
  let occurrence = 0;
  return node.fields.flatMap((field) => {
    if (field.name !== name) return [];
    if (field.condition === undefined) {
      baseOccurrence += 1;
      return [];
    }
    return [
      {
        baseOccurrence: Math.max(0, baseOccurrence),
        occurrence: occurrence++,
        condition: field.condition,
        value: unquoteValue(field.value),
      },
    ];
  });
}

const lineExtent = (source: string, field: SourceField) => {
  const from = source.lastIndexOf("\n", Math.max(0, field.range.from - 1)) + 1;
  const newline = source.indexOf("\n", field.range.to);
  return { from, to: newline < 0 ? source.length : newline + 1 };
};

export function removeDocumentFields(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  name: string,
): DocumentEditResult {
  const source = files[symbol.file];
  if (source === undefined)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const node = findNode(source, symbol);
  if (!node)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const extents = node.fields
    .filter((field) => field.name === name)
    .map((field) => lineExtent(source, field))
    .sort((left, right) => right.from - left.from);
  if (!extents.length)
    return { changed: false, files: { ...files }, reason: "no-change" };
  let nextSource = source;
  for (const extent of extents)
    nextSource = nextSource.slice(0, extent.from) + nextSource.slice(extent.to);
  return {
    changed: true,
    files: { ...files, [symbol.file]: nextSource },
  };
}

function renderValue(
  kind: string,
  field: string,
  value: string,
  fieldIndentation = "  ",
  definitionOverride?: FieldDefinition,
) {
  const type =
    definitionOverride?.type ??
    fieldDefinition(kind, field)?.type ??
    "quotedString";
  if (type === "richText" && value.includes("\n")) {
    const contentIndentation = `${fieldIndentation}  `;
    return `\n${contentIndentation}"""\n${value
      .split("\n")
      .map((line) => `${contentIndentation}${line}`)
      .join("\n")}\n${contentIndentation}"""`;
  }
  if (
    type === "quotedString" ||
    type.startsWith("quotedString:") ||
    type === "renderableScalar" ||
    type === "richText"
  )
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  return value;
}

function insertOffset(source: string, node: SourceNode) {
  if (node.fields.length) {
    const last = node.fields.at(-1)!;
    const newline = source.indexOf("\n", last.range.to);
    return newline < 0 ? source.length : newline + 1;
  }
  const newline = source.indexOf("\n", node.range.from);
  return newline < 0 ? source.length : newline + 1;
}

export function setDocumentField(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  name: string,
  value: string,
  occurrence = 0,
): DocumentEditResult {
  const source = files[symbol.file];
  if (source === undefined)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const node = findNode(source, symbol);
  if (!node)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const fields = node.fields.filter(
    (field) => field.name === name && field.condition === undefined,
  );
  const existing = fields[occurrence];
  const definition =
    structuredContext(files, symbol)?.fields[name] ??
    fieldDefinition(symbol.kind, name);
  let nextSource: string;

  if (!value && !definition?.required) {
    if (!existing)
      return { changed: false, files: { ...files }, reason: "no-change" };
    const extent = lineExtent(source, existing);
    nextSource = source.slice(0, extent.from) + source.slice(extent.to);
  } else {
    const fieldIndentation = " ".repeat(
      existing?.range.column
        ? Math.max(0, existing.range.column - 1)
        : Math.max(0, node.range.column - 1) + 2,
    );
    const rendered = renderValue(
      symbol.kind,
      name,
      value,
      fieldIndentation,
      definition,
    );
    if (existing) {
      if (
        source.slice(existing.valueRange.from, existing.valueRange.to) ===
        rendered
      )
        return { changed: false, files: { ...files }, reason: "no-change" };
      nextSource =
        source.slice(0, existing.valueRange.from) +
        rendered +
        source.slice(existing.valueRange.to);
    } else {
      const offset = insertOffset(source, node);
      const indentation = " ".repeat(Math.max(0, node.range.column - 1) + 2);
      nextSource =
        source.slice(0, offset) +
        `${indentation}${name}: ${rendered}\n` +
        source.slice(offset);
    }
  }

  return {
    changed: nextSource !== source,
    files: { ...files, [symbol.file]: nextSource },
  };
}

function starterValue(definition: FieldDefinition | undefined) {
  if (definition?.const !== undefined) return String(definition.const);
  if (definition?.values?.length) return definition.values[0];
  if (definition?.type === "boolean") return "false";
  if (definition?.type === "integer" || definition?.type === "number")
    return "0";
  if (definition?.type?.includes("handle")) return "new_handle";
  return "";
}

export function addDocumentField(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  name: string,
): DocumentEditResult {
  const source = files[symbol.file];
  if (source === undefined)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const node = findNode(source, symbol);
  if (!node)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const definition =
    structuredContext(files, symbol)?.fields[name] ??
    fieldDefinition(symbol.kind, name);
  const existing = sourceField(source, symbol, name);
  if (existing && quickAddFieldMode(source, symbol, name) === "complete") {
    const quoted =
      existing.value.startsWith('"') && existing.value.endsWith('"');
    return {
      changed: false,
      files: { ...files },
      reason: "no-change",
      selection: {
        file: symbol.file,
        from: existing.valueRange.from + (quoted ? 1 : 0),
        to: existing.valueRange.to - (quoted ? 1 : 0),
      },
    };
  }
  if (existing && !definition?.repeatable)
    return { changed: false, files: { ...files }, reason: "no-change" };
  const offset = insertOffset(source, node);
  const indentation = " ".repeat(Math.max(0, node.range.column - 1) + 2);
  const rendered = renderValue(
    symbol.kind,
    name,
    starterValue(definition),
    indentation,
    definition,
  );
  const prefix = `${indentation}${name}: `;
  const valueFrom = offset + prefix.length;
  const quoted = rendered.startsWith('"') && rendered.endsWith('"');
  const selection = quoted
    ? { from: valueFrom + 1, to: valueFrom + Math.max(1, rendered.length - 1) }
    : rendered
      ? { from: valueFrom, to: valueFrom + rendered.length }
      : { from: valueFrom, to: valueFrom };
  const nextSource =
    source.slice(0, offset) + `${prefix}${rendered}\n` + source.slice(offset);
  return {
    changed: true,
    files: { ...files, [symbol.file]: nextSource },
    selection: { file: symbol.file, ...selection },
  };
}

export function setConditionalDocumentField(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  name: string,
  occurrence: number,
  condition: string,
  value: string,
  baseOccurrence?: number,
): DocumentEditResult {
  const source = files[symbol.file];
  if (source === undefined)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const node = findNode(source, symbol);
  if (!node)
    return { changed: false, files: { ...files }, reason: "stale-target" };
  const variants = node.fields.filter(
    (field) => field.name === name && field.condition !== undefined,
  );
  const existing = variants[occurrence];
  if (!condition && !value && existing) {
    const extent = lineExtent(source, existing);
    const nextSource = source.slice(0, extent.from) + source.slice(extent.to);
    return {
      changed: true,
      files: { ...files, [symbol.file]: nextSource },
    };
  }
  const indentation = " ".repeat(Math.max(0, node.range.column - 1) + 2);
  const definition =
    structuredContext(files, symbol)?.fields[name] ??
    fieldDefinition(symbol.kind, name);
  const rendered = renderValue(
    symbol.kind,
    name,
    value,
    indentation,
    definition,
  );
  if (existing?.conditionRange) {
    const replacements = [
      { range: existing.conditionRange, value: condition || "true" },
      { range: existing.valueRange, value: rendered },
    ].sort((left, right) => right.range.from - left.range.from);
    let nextSource = source;
    for (const replacement of replacements)
      nextSource =
        nextSource.slice(0, replacement.range.from) +
        replacement.value +
        nextSource.slice(replacement.range.to);
    return {
      changed: nextSource !== source,
      files: { ...files, [symbol.file]: nextSource },
      reason: nextSource === source ? "no-change" : undefined,
    };
  }
  let offset = insertOffset(source, node);
  if (baseOccurrence !== undefined) {
    let currentBase = -1;
    let associated: SourceField | undefined;
    for (const field of node.fields) {
      if (field.name !== name) continue;
      if (field.condition === undefined) currentBase += 1;
      if (currentBase === baseOccurrence) associated = field;
      else if (currentBase > baseOccurrence) break;
    }
    if (associated) offset = lineExtent(source, associated).to;
  }
  const nextSource =
    source.slice(0, offset) +
    `${indentation}${name} when ${condition || "true"}: ${rendered}\n` +
    source.slice(offset);
  return {
    changed: true,
    files: { ...files, [symbol.file]: nextSource },
  };
}
