import type {
  DiagnosticSeverity,
  PackageDiagnostic,
  SourceField,
  SourceNode,
} from "./model";

export const unquote = (value: string) =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;

export function diagnosticFieldTarget(
  node: SourceNode,
  field?: SourceField,
  occurrence = 0,
) {
  return {
    file: node.range.file,
    declarationFrom: node.range.from,
    field: field?.name,
    occurrence,
    part: field ? ("value" as const) : ("declaration" as const),
  };
}

export function diagnosticScalarRange(node: SourceNode) {
  const scalar = node.scalar ?? "";
  const to = node.range.to;
  return {
    ...node.range,
    column: Math.max(
      node.range.column,
      node.range.column + node.kind.length + 2,
    ),
    from: Math.max(node.range.from, to - scalar.length),
    to,
  };
}

export function appendDiagnostic(
  diagnostics: PackageDiagnostic[],
  code: string,
  parameters: Record<string, string | number>,
  node: SourceNode,
  field?: SourceField,
  occurrence = 0,
  severity: DiagnosticSeverity = "error",
  targetField?: string,
) {
  diagnostics.push({
    code,
    severity,
    messageKey: `diagnostics.${code}`,
    parameters,
    range: field?.valueRange ?? node.range,
    target: {
      ...diagnosticFieldTarget(node, field, occurrence),
      field: targetField ?? field?.name,
    },
  });
}
