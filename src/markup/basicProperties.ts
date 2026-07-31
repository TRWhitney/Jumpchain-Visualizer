import type { SelectionKind } from "./model";

export type NamedBasicProperty = "origin" | "location";

export function namedBasicChoiceSelectionIsCompatible(
  selection: SelectionKind | string,
) {
  return ["toggle", "text", "select", "companions"].includes(selection);
}

export function namedBasicValueFromChoiceName(
  property: NamedBasicProperty,
  name: string,
) {
  const trimmedName = name.trim();
  const prefix = property === "origin" ? "Origin" : "Location";
  const parenthesized = new RegExp(
    `^${prefix}\\s*\\(\\s*([^()]+?)\\s*\\)`,
  ).exec(trimmedName);
  return parenthesized?.[1]?.trim() || trimmedName;
}

export function implicitNamedBasicChoiceValue(
  property: NamedBasicProperty,
  selection: SelectionKind | string,
  answer: unknown,
  name: string,
) {
  if (!namedBasicChoiceSelectionIsCompatible(selection)) return undefined;
  if (
    (selection === "text" || selection === "select") &&
    typeof answer === "string" &&
    answer.length > 0
  )
    return answer;
  return namedBasicValueFromChoiceName(property, name);
}
