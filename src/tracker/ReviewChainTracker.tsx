import { useCallback, useReducer } from "react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "./ChainTracker";
import {
  createCompanionProfileTrackerFixture,
  createDenseTrackerFixture,
  createReferenceTrackerFixture,
} from "./fixtures";
import { choiceMutationWasBlocked, trackerReducer } from "./model";
import { useSettings } from "../settings/SettingsContext";
import { deterministicRandomIndex } from "../domain";
import "../../documentation/styles.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/choice-rendering-design.css";
import "./jumpRenderer.css";
import "../../documentation/tags-design.css";
import "../../documentation/supplements-design.css";
import "../../documentation/supplements-essential.css";
import "../../documentation/supplements-personal-reality.css";
import "../../documentation/supplements-universal-drawbacks.css";
import "../supplements/review.css";
import "./review.css";

export function ReviewChainTracker() {
  const { logger } = useSettings();
  const parameters = new URLSearchParams(window.location.search);
  const fixture = parameters.get("fixture");
  const warnUpstreamChanges = parameters.get("upstreamWarnings") === "on";
  const allowRerolls = parameters.get("rerolls") === "on";
  const allowNegativePointBalances =
    parameters.get("negativeBalances") === "on";
  const allowDuplicateJumps = parameters.get("duplicateJumps") === "on";
  const initialEntryId = parameters.get("initialEntry");
  const [state, rawDispatch] = useReducer(trackerReducer, undefined, () => {
    const preferences = {
      warnUpstreamChanges,
      allowMultiplePackageVersions: true,
      allowDuplicateJumps,
      allowNegativePointBalances,
      allowRerolls,
      includeItemTagsInRadar: false,
    };
    if (fixture === "companion-profiles")
      return createCompanionProfileTrackerFixture(preferences);
    if (fixture !== "reference") {
      const initial = createDenseTrackerFixture(preferences);
      return initialEntryId && initial.entries[initialEntryId]
        ? {
            ...initial,
            selectedEntryId: initialEntryId,
            inspectionPointId: initialEntryId,
          }
        : initial;
    }
    const initial = createReferenceTrackerFixture();
    return {
      ...initial,
      preferences: {
        ...initial.preferences,
        warnUpstreamChanges,
        allowNegativePointBalances,
        allowRerolls,
      },
    };
  });
  const dispatch = useCallback(
    (action: Parameters<typeof trackerReducer>[1]) => {
      const next = trackerReducer(state, action);
      if (
        choiceMutationWasBlocked(state, next, action) &&
        "entryId" in action &&
        "actorId" in action
      )
        logger.emit("chain.choice.overspend_blocked", {
          attributes: { entryId: action.entryId, actorId: action.actorId },
        });
      if (
        action.type !== "undo" &&
        action.type !== "dismiss-undo" &&
        next.order.join("\0") !== state.order.join("\0")
      ) {
        const removed = next.order.length < state.order.length;
        logger.emit(removed ? "chain.removed" : "chain.reordered", {
          attributes: { dependencyReview: Boolean(state.pending) },
          toast: next.undo
            ? {
                action: {
                  label: "Undo",
                  invoke: () => rawDispatch({ type: "undo" }),
                },
                onDismiss: () => rawDispatch({ type: "dismiss-undo" }),
              }
            : undefined,
        });
      }
      rawDispatch(action);
    },
    [logger, state],
  );
  return (
    <SupplementProviders
      bodyMod={state.bodyMod}
      onBodyModChange={(value) => dispatch({ type: "set-body-mod", value })}
      supplementState={state.supplements}
      supplementDispatch={(action) =>
        dispatch({ type: "supplement-action", action })
      }
    >
      <main className="tracker-review">
        <h1>Chain Tracker</h1>
        <p>Dense deterministic review fixture</p>
        <ChainTracker
          state={state}
          dispatch={dispatch}
          randomIndex={deterministicRandomIndex}
        />
      </main>
    </SupplementProviders>
  );
}
