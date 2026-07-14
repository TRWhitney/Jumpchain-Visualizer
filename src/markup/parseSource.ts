import { parser as lezerParser } from "./format1Parser.generated";
import type {
  PackageDiagnostic,
  ParsedFormatFile,
  SourceField,
  SourceNode,
  SourceRange,
} from "./model";

const limits = {
  sourceLength: 2_000_000,
  lines: 40_000,
  depth: 32,
  nodes: 20_000,
  lineLength: 20_000,
} as const;

const range = (
  file: string,
  line: number,
  column: number,
  from: number,
  to: number,
): SourceRange => ({ file, line, column, from, to });

function stripComment(value: string) {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) escaped = false;
    else if (character === "\\" && quoted) escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === "#" && !quoted) return value.slice(0, index);
  }
  return value;
}

export function parseFormatFile(
  file: string,
  source: string,
): ParsedFormatFile {
  const diagnostics: PackageDiagnostic[] = [];
  if (source.length > limits.sourceLength)
    return {
      file,
      source,
      tree: [],
      diagnostics: [
        {
          code: "source.too_large",
          severity: "error",
          message: `Source exceeds ${limits.sourceLength} characters.`,
        },
      ],
    };

  // Parsing through Lezer is mandatory even though indentation ownership is
  // interpreted by the typed Format 1 transformer below.
  const concrete = lezerParser.parse(source);
  if (concrete.type.isError)
    diagnostics.push({
      code: "syntax.document",
      severity: "error",
      message: "The source could not be tokenized.",
    });

  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length > limits.lines)
    diagnostics.push({
      code: "source.too_many_lines",
      severity: "error",
      message: `Source exceeds ${limits.lines} lines.`,
    });
  const roots: SourceNode[] = [];
  const stack: { indent: number; node: SourceNode }[] = [];
  let offset = 0;
  let fenced:
    | {
        owner: SourceNode;
        field: SourceField;
        indent: number;
        content: string[];
      }
    | undefined;
  let nodeCount = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex];
    const lineNumber = lineIndex + 1;
    if (raw.length > limits.lineLength)
      diagnostics.push({
        code: "source.line_too_long",
        severity: "error",
        message: `Line exceeds ${limits.lineLength} characters.`,
        range: range(file, lineNumber, 1, offset, offset + raw.length),
      });

    if (fenced) {
      const indentation = raw.match(/^ */)?.[0].length ?? 0;
      if (indentation === fenced.indent && raw.trim() === '"""') {
        fenced.field.value = fenced.content.join("\n");
        fenced = undefined;
      } else if (raw.trim() && indentation < fenced.indent) {
        diagnostics.push({
          code: "syntax.fence_indent",
          severity: "error",
          message: "Fenced content is indented less than its fence.",
          range: range(file, lineNumber, 1, offset, offset + raw.length),
        });
        fenced.content.push(raw);
      } else {
        fenced.content.push(raw.slice(Math.min(fenced.indent, raw.length)));
      }
      offset += raw.length + 1;
      continue;
    }

    if (/^\s*#/.test(raw) || !raw.trim()) {
      offset += raw.length + 1;
      continue;
    }
    if (/^\s*\t/.test(raw) || raw.includes("\t"))
      diagnostics.push({
        code: "syntax.tab",
        severity: "error",
        message: "Tabs are not valid indentation in Format 1.",
        range: range(file, lineNumber, 1, offset, offset + raw.length),
      });
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    if (indent % 2 !== 0)
      diagnostics.push({
        code: "syntax.indent",
        severity: "error",
        message: "Indentation must use multiples of two spaces.",
        range: range(file, lineNumber, 1, offset, offset + indent),
      });
    if (indent / 2 > limits.depth)
      diagnostics.push({
        code: "source.too_deep",
        severity: "error",
        message: `Nesting exceeds ${limits.depth} levels.`,
        range: range(file, lineNumber, 1, offset, offset + indent),
      });

    const text = stripComment(raw.slice(indent)).trimEnd();
    if (!text) {
      offset += raw.length + 1;
      continue;
    }
    while (stack.length && stack.at(-1)!.indent >= indent) stack.pop();
    const owner = stack.at(-1)?.node;
    const fieldMatch = text.match(
      /^([a-z][a-z0-9-]*)(?:\s+when\s+(.+?))?:\s*(.*)$/,
    );
    if (fieldMatch) {
      if (!owner || indent !== stack.at(-1)!.indent + 2) {
        diagnostics.push({
          code: "syntax.orphan_field",
          severity: "error",
          message: `Field ${fieldMatch[1]} has no declaration owner.`,
          range: range(
            file,
            lineNumber,
            indent + 1,
            offset + indent,
            offset + raw.length,
          ),
        });
      } else {
        const field: SourceField = {
          name: fieldMatch[1],
          condition: fieldMatch[2],
          value: fieldMatch[3],
          range: range(
            file,
            lineNumber,
            indent + 1,
            offset + indent,
            offset + raw.length,
          ),
        };
        owner.fields.push(field);
        if (!field.value && lines[lineIndex + 1]?.trim() === '"""') {
          lineIndex += 1;
          const fenceRaw = lines[lineIndex];
          const fenceIndent = fenceRaw.match(/^ */)?.[0].length ?? 0;
          offset += raw.length + 1 + fenceRaw.length + 1;
          fenced = { owner, field, indent: fenceIndent, content: [] };
          continue;
        }
      }
      offset += raw.length + 1;
      continue;
    }

    const nodeMatch = text.match(/^([a-z][a-z0-9-]*)(?:\s*:\s*(.+))?$/);
    if (!nodeMatch) {
      diagnostics.push({
        code: "syntax.line",
        severity: "error",
        message: "Expected a declaration, layout node, or field.",
        range: range(
          file,
          lineNumber,
          indent + 1,
          offset + indent,
          offset + raw.length,
        ),
      });
      offset += raw.length + 1;
      continue;
    }
    const node: SourceNode = {
      kind: nodeMatch[1],
      scalar: nodeMatch[2],
      fields: [],
      children: [],
      range: range(
        file,
        lineNumber,
        indent + 1,
        offset + indent,
        offset + raw.length,
      ),
    };
    nodeCount += 1;
    if (nodeCount > limits.nodes)
      diagnostics.push({
        code: "source.too_many_nodes",
        severity: "error",
        message: `Source exceeds ${limits.nodes} declarations.`,
        range: node.range,
      });
    if (owner) owner.children.push(node);
    else roots.push(node);
    stack.push({ indent, node });
    offset += raw.length + 1;
  }

  if (fenced)
    diagnostics.push({
      code: "syntax.unclosed_fence",
      severity: "error",
      message: "Rich-text fence is not closed.",
      range: fenced.field.range,
    });
  return { file, source, tree: roots, diagnostics };
}
