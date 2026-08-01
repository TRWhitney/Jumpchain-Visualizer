import {
  evaluateConditionExpression,
  parseRichText,
  type Renderable,
  type RichBlock,
  type RichInline,
} from "../markup";

export type RenderContext = Readonly<
  Record<string, string | number | boolean | undefined>
>;

export function evaluateCondition(
  expression: string,
  context: RenderContext,
): boolean {
  return evaluateConditionExpression(expression, context);
}

export function renderRenderable(value: Renderable, context: RenderContext) {
  const selected = value.variants.find((variant) =>
    evaluateCondition(variant.condition, context),
  );
  return interpolate(selected?.value ?? value.base ?? "", context);
}

export function renderRichTextRenderable(
  value: Renderable,
  context: RenderContext,
): readonly RichBlock[] {
  const selected = value.variants.find((variant) =>
    evaluateCondition(variant.condition, context),
  );
  const substitutions: string[] = [];
  const masked = (selected?.value ?? value.base ?? "").replace(
    /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/g,
    (_, handle: string) => {
      const index = substitutions.push(String(context[handle] ?? "")) - 1;
      return `\uE000${index}\uE001`;
    },
  );
  return parseRichText(masked).map((block) => {
    const replace = (inline: RichInline) => ({
      ...inline,
      text: inline.text.replace(
        /\uE000([0-9]+)\uE001/g,
        (_, index: string) => substitutions[Number(index)] ?? "",
      ),
    });
    if (block.kind === "paragraph")
      return { ...block, content: block.content.map(replace) };
    if (block.kind === "list")
      return {
        ...block,
        items: block.items.map((item) => item.map(replace)),
      };
    return {
      ...block,
      rows: block.rows.map((row) => row.map((cell) => cell.map(replace))),
    };
  });
}

function interpolate(value: string, context: RenderContext) {
  return value.replace(
    /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/g,
    (_, handle: string) => String(context[handle] ?? ""),
  );
}
