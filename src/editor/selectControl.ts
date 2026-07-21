import type { FieldDefault } from "./documentEditor";

export type SelectControlModel = {
  value: string;
  options: readonly string[];
  showNotSet: boolean;
  authoredValue: (selectedValue: string) => string;
};

export function createSelectControlModel(
  authoredValue: string,
  omissionDefault: FieldDefault | null,
  options: readonly string[],
): SelectControlModel {
  const defaultOption =
    omissionDefault?.kind === "value" &&
    typeof omissionDefault.value !== "boolean"
      ? String(omissionDefault.value)
      : undefined;
  return {
    value: authoredValue || defaultOption || "",
    options:
      defaultOption && !options.includes(defaultOption)
        ? [defaultOption, ...options]
        : options,
    showNotSet: !defaultOption,
    authoredValue: (selectedValue) =>
      selectedValue === defaultOption ? "" : selectedValue,
  };
}
