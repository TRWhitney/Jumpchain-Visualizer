export type EditorFieldControlKind =
  | "boolean"
  | "image-effect-range"
  | "color"
  | "asset"
  | "image-dimension"
  | "described-enum"
  | "enum"
  | "rich-text"
  | "number"
  | "reference"
  | "choice-source-group"
  | "spelling-text"
  | "text";

const enumControlTypes = new Set([
  "enum",
  "imageFit",
  "spacing",
  "size",
  "align",
  "justify",
  "textAlign",
]);

export function editorFieldControlKind({
  declarationKind,
  fieldName,
  fieldType,
  hasEnumValues,
  enumHasDescriptions,
  hasReference,
}: {
  declarationKind: string;
  fieldName: string;
  fieldType: string | undefined;
  hasEnumValues: boolean;
  enumHasDescriptions: boolean;
  hasReference: boolean;
}): EditorFieldControlKind {
  if (fieldType === "boolean") return "boolean";
  if (
    declarationKind === "image" &&
    ["rounded-intensity", "fade-intensity"].includes(fieldName)
  )
    return "image-effect-range";
  if (["color", "hexColor"].includes(fieldType ?? "")) return "color";
  if (fieldType === "quotedString:assetRelativePath") return "asset";
  if (fieldType === "imageDimension") return "image-dimension";
  if (hasEnumValues && enumControlTypes.has(fieldType ?? ""))
    return enumHasDescriptions ? "described-enum" : "enum";
  if (
    ["description", "content"].includes(fieldName) ||
    fieldType === "richText"
  )
    return "rich-text";
  if (fieldType === "integer" || fieldType === "number") return "number";
  if (hasReference) return "reference";
  if (declarationKind === "choice-source" && fieldName === "group")
    return "choice-source-group";
  if (["author", "name", "title"].includes(fieldName)) return "spelling-text";
  return "text";
}
