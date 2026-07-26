import { translate } from "../localization";
import {
  FreeTextSuggestionCombobox,
  type FreeTextSuggestion,
} from "./FreeTextSuggestionCombobox";

export function HandleFieldControl({
  label,
  value,
  options,
  placeholder,
  autoFocus,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
  createLabel,
  commitOnBlur = false,
  showDescriptions = true,
  onChange,
  onCreate,
  onBlur,
}: {
  label: string;
  value: string;
  options: readonly (string | FreeTextSuggestion)[];
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  createLabel?: string;
  commitOnBlur?: boolean;
  showDescriptions?: boolean;
  onChange: (value: string) => void;
  onCreate?: () => void;
  onBlur?: () => void;
}) {
  return (
    <FreeTextSuggestionCombobox
      label={label}
      value={value}
      suggestions={options.map((option) =>
        typeof option === "string"
          ? ({
              value: option,
              label: option,
            } satisfies FreeTextSuggestion)
          : option,
      )}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      ariaInvalid={ariaInvalid}
      ariaDescribedBy={ariaDescribedBy}
      showSuggestionsLabel={translate(
        "ui.editorWorkspace.handle.showChoicesForField",
        { field: label },
      )}
      suggestionsLabel={translate(
        "ui.editorWorkspace.handle.availableHandlesForField",
        { field: label },
      )}
      createLabel={createLabel}
      commitOnBlur={commitOnBlur}
      showDescriptions={showDescriptions}
      onChange={onChange}
      onCreate={onCreate}
      onBlur={onBlur}
    />
  );
}
