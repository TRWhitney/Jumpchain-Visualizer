import {
  createRendererActions,
  type RendererActions,
  type RendererMutation,
} from "../renderer";
import type { TrackerAction } from "./model";

export function trackerActionForRendererMutation(
  entryId: string,
  actorId: string,
  mutation: RendererMutation,
): TrackerAction {
  switch (mutation.type) {
    case "set-choice":
      return { ...mutation, entryId, actorId };
    case "set-input":
      return { ...mutation, entryId, actorId };
    case "set-source-selections":
      return { ...mutation, entryId, actorId };
    case "record-choice-roll":
      return { ...mutation, entryId, actorId };
    case "record-source-roll":
      return { ...mutation, entryId, actorId };
  }
}

export function createTrackerRendererActions(
  entryId: string,
  actorId: string,
  dispatch: (action: TrackerAction) => void,
): RendererActions {
  return createRendererActions((mutation) =>
    dispatch(trackerActionForRendererMutation(entryId, actorId, mutation)),
  );
}
