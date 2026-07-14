export type RichInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
};

export type RichBlock =
  | { kind: "paragraph"; content: readonly RichInline[] }
  | { kind: "list"; items: readonly (readonly RichInline[])[] }
  | { kind: "table"; rows: readonly (readonly (readonly RichInline[])[])[] };

const MAX_RICH_TEXT = 100_000;
const MAX_BLOCKS = 1_000;

function inline(source: string): RichInline[] {
  const result: RichInline[] = [];
  const pattern = /(\+\+[^\n]+?\+\+|\*\*[^\n]+?\*\*|~~[^\n]+?~~|\*[^\n]+?\*)/g;
  let index = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index! > index)
      result.push({ text: source.slice(index, match.index) });
    const token = match[0];
    const mark = token.startsWith("++")
      ? { underline: true }
      : token.startsWith("**")
        ? { bold: true }
        : token.startsWith("~~")
          ? { strike: true }
          : { italic: true };
    result.push({
      text: token.slice(
        token.startsWith("*") && !token.startsWith("**") ? 1 : 2,
        token.startsWith("*") && !token.startsWith("**") ? -1 : -2,
      ),
      ...mark,
    });
    index = match.index! + token.length;
  }
  if (index < source.length) result.push({ text: source.slice(index) });
  return result.length ? result : [{ text: source }];
}

export function parseRichText(source: string): readonly RichBlock[] {
  const safe = source.slice(0, MAX_RICH_TEXT).replace(/<[^>]*>/g, "");
  const lines = safe.split(/\r?\n/);
  const blocks: RichBlock[] = [];
  for (let index = 0; index < lines.length && blocks.length < MAX_BLOCKS;) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(lines[index])) {
      const items: RichInline[][] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index]))
        items.push(inline(lines[index++].replace(/^\s*[-*]\s+/, "")));
      blocks.push({ kind: "list", items });
      continue;
    }
    if (
      lines[index].includes("|") &&
      lines[index + 1]?.match(/^\s*\|?\s*:?-+/)
    ) {
      const rows: RichInline[][][] = [
        lines[index].split("|").filter(Boolean).map(inline),
      ];
      index += 2;
      while (index < lines.length && lines[index].includes("|"))
        rows.push(lines[index++].split("|").filter(Boolean).map(inline));
      blocks.push({ kind: "table", rows });
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*[-*]\s+/.test(lines[index])
    )
      paragraph.push(lines[index++].trim());
    blocks.push({ kind: "paragraph", content: inline(paragraph.join(" ")) });
  }
  return blocks;
}
