import type { RendererActions, RendererMutation } from "./contracts";

export function createRendererActions(
  dispatch: (mutation: RendererMutation) => void,
): RendererActions {
  return {
    setChoice: (choiceHandle, value) =>
      dispatch({ type: "set-choice", choiceHandle, value }),
    setInput: (choiceHandle, inputHandle, value) =>
      dispatch({ type: "set-input", choiceHandle, inputHandle, value }),
    setSourceSelections: (sourceKey, mode, value) =>
      dispatch({
        type: "set-source-selections",
        sourceKey,
        mode,
        value,
      }),
    recordChoiceRoll: (choiceHandle, result) =>
      dispatch({ type: "record-choice-roll", choiceHandle, result }),
    recordSourceRoll: (sourceKey, mode, result) =>
      dispatch({
        type: "record-source-roll",
        sourceKey,
        mode,
        result,
      }),
  };
}
