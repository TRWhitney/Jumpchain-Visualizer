import type { ActorEntryState } from "../domain";
import type { TrackerAction } from "../tracker/model";

export const createPreviewActorState = (): ActorEntryState => ({
  choices: {},
  inputs: {},
  choiceRolls: {},
  sourceRolls: {},
});

export function reducePreviewActorState(
  state: ActorEntryState,
  action: TrackerAction,
): ActorEntryState {
  if (
    !("entryId" in action) ||
    action.entryId !== "preview-entry" ||
    !("actorId" in action) ||
    action.actorId !== "jumper"
  )
    return state;
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
    const choices = { ...state.choices };
    if (previous) choices[previous.result] = false;
    choices[action.result] = true;
    return {
      ...state,
      choices,
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
