import format1Schema from "../../schema/format-1.json";

type Format1SyntaxSchema = {
  declarations: Record<string, unknown>;
  layoutNodes: Record<string, unknown>;
};

const schema = format1Schema as unknown as Format1SyntaxSchema;

export const format1DeclarationWords = new Set([
  ...Object.keys(schema.declarations),
  ...Object.keys(schema.layoutNodes),
]);
