import type { ActorEntryState } from "../domain";
import type { RendererMutation } from "../renderer";

export const createPreviewActorState = (): ActorEntryState => ({
  choices: {},
  inputs: {},
  sourceSelections: {},
  choiceRolls: {},
  sourceRolls: {},
});

export function reducePreviewActorState(
  state: ActorEntryState,
  action: RendererMutation,
): ActorEntryState {
  if (action.type === "set-choice")
    return {
      ...state,
      choices: {
        ...state.choices,
        [action.choiceHandle]: action.value,
      },
    };
  if (action.type === "set-input")
    return {
      ...state,
      inputs: {
        ...state.inputs,
        [action.choiceHandle]: {
          ...state.inputs[action.choiceHandle],
          [action.inputHandle]: action.value,
        },
      },
    };
  if (action.type === "set-source-selections") {
    const uniqueValue = [...new Set(action.value)];
    const value =
      action.mode === "single" ? uniqueValue.slice(-1) : uniqueValue;
    return {
      ...state,
      sourceSelections: {
        ...state.sourceSelections,
        [action.sourceKey]: value,
      },
    };
  }
  if (action.type === "record-choice-roll") {
    const sequence = state.choiceRolls[action.choiceHandle]?.sequence ?? 0;
    return {
      ...state,
      choices: {
        ...state.choices,
        [action.choiceHandle]: action.result,
      },
      choiceRolls: {
        ...state.choiceRolls,
        [action.choiceHandle]: {
          result: action.result,
          sequence: sequence + 1,
        },
      },
    };
  }
  if (action.type === "record-source-roll") {
    const previous = state.sourceRolls[action.sourceKey];
    const sourceSelections =
      action.mode === "single"
        ? [action.result]
        : [
            ...(state.sourceSelections[action.sourceKey] ?? []).filter(
              (handle) =>
                handle !== previous?.result && handle !== action.result,
            ),
            action.result,
          ];
    return {
      ...state,
      sourceSelections: {
        ...state.sourceSelections,
        [action.sourceKey]: sourceSelections,
      },
      sourceRolls: {
        ...state.sourceRolls,
        [action.sourceKey]: {
          result: action.result,
          sequence: (previous?.sequence ?? 0) + 1,
        },
      },
    };
  }
  return state;
}
