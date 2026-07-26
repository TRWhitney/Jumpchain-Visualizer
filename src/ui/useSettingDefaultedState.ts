import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Keeps manual UI state local while treating a changed persistent setting as
 * a new default for the currently mounted surface.
 */
export function useSettingDefaultedState<Value>(
  settingValue: boolean,
  defaultValue: Value,
): readonly [Value, Dispatch<SetStateAction<Value>>, boolean] {
  const [state, setState] = useState(() => ({
    settingValue,
    value: defaultValue,
  }));
  const settingChanged = state.settingValue !== settingValue;
  const value = settingChanged ? defaultValue : state.value;

  if (settingChanged) setState({ settingValue, value: defaultValue });

  const setValue: Dispatch<SetStateAction<Value>> = (nextValue) => {
    setState((current) => {
      const currentValue =
        current.settingValue === settingValue ? current.value : defaultValue;
      return {
        settingValue,
        value:
          typeof nextValue === "function"
            ? (nextValue as (value: Value) => Value)(currentValue)
            : nextValue,
      };
    });
  };

  return [value, setValue, settingChanged] as const;
}
