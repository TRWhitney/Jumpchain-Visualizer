import { useReducer } from "react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "./ChainTracker";
import {
  createDenseTrackerFixture,
  createReferenceTrackerFixture,
} from "./fixtures";
import { trackerReducer } from "./model";
import "../../documentation/styles.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/tags-design.css";
import "../../documentation/supplements-design.css";
import "../../documentation/supplements-essential.css";
import "../../documentation/supplements-personal-reality.css";
import "../../documentation/supplements-universal-drawbacks.css";
import "../supplements/review.css";
import "./review.css";

export function ReviewChainTracker() {
  const parameters = new URLSearchParams(window.location.search);
  const fixture = parameters.get("fixture");
  const warnUpstreamChanges = parameters.get("upstreamWarnings") === "on";
  const [state, dispatch] = useReducer(trackerReducer, undefined, () => {
    if (fixture !== "reference")
      return createDenseTrackerFixture({
        warnUpstreamChanges,
        allowMultiplePackageVersions: true,
      });
    const initial = createReferenceTrackerFixture();
    return {
      ...initial,
      preferences: { ...initial.preferences, warnUpstreamChanges },
    };
  });
  return (
    <SupplementProviders>
      <main className="tracker-review">
        <h1>Chain Tracker</h1>
        <p>
          Dense deterministic review fixture · Jump renderer intentionally
          deferred
        </p>
        <ChainTracker state={state} dispatch={dispatch} />
      </main>
    </SupplementProviders>
  );
}
