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
  const?: string | number | boolean;
  conditionalVariants?: boolean;
};

type DeclarationDefinition = {
  fields?: Record<string, FieldDefinition>;
  fieldSet?: string;
  forms?: { block?: { fields?: Record<string, FieldDefinition> } };
  formsByContext?: Record<string, { fields?: Record<string, FieldDefinition> }>;
};

type FormatSchema = {
  declarations: Record<string, DeclarationDefinition>;
  fieldSets: Record<string, Record<string, FieldDefinition>>;
};

const schema = format1Schema as unknown as FormatSchema;

export type DocumentEditResult = {
  changed: boolean;
  files: Record<string, string>;
  reason?: "stale-target" | "no-change";
  selection?: { file: string; from: number; to: number };
};

const walk = (nodes: readonly SourceNode[]): SourceNode[] =>
  nodes.flatMap((node) => [node, ...walk(node.children)]);

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

export function declarationFieldNames(kind: string) {
  return Object.keys(declarationFields(kind));
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
): QuickAddFieldMode | null {
  const definition = fieldDefinition(symbol.kind, name);
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

const lineExtent = (source: string, field: SourceField) => {
  const from = source.lastIndexOf("\n", Math.max(0, field.range.from - 1)) + 1;
  const newline = source.indexOf("\n", field.range.to);
  return { from, to: newline < 0 ? source.length : newline + 1 };
};

function renderValue(
  kind: string,
  field: string,
  value: string,
  fieldIndentation = "  ",
) {
  const type = fieldDefinition(kind, field)?.type ?? "quotedString";
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
  const definition = fieldDefinition(symbol.kind, name);
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
    const rendered = renderValue(symbol.kind, name, value, fieldIndentation);
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
  const definition = fieldDefinition(symbol.kind, name);
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
  const rendered = renderValue(symbol.kind, name, value, indentation);
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
  const offset = insertOffset(source, node);
  const nextSource =
    source.slice(0, offset) +
    `${indentation}${name} when ${condition || "true"}: ${rendered}\n` +
    source.slice(offset);
  return {
    changed: true,
    files: { ...files, [symbol.file]: nextSource },
  };
}
