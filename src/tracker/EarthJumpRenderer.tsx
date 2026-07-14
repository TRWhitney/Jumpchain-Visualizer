import type { Dispatch } from "react";
import type { EvaluatedActorJump } from "../domain";
import { EARTH_ENTRY_ID, type TrackerAction, type TrackerState } from "./model";
import { NumberStepper } from "./NumberStepper";

export const EARTH_EXPLANATION =
  "A Jumpchain is a sequence of worlds. In each Jump, you make choices under that Jump’s rules, carry acquired perks, items, forms, and companions forward, and then continue to the next world. Earth records the identity you begin with before Jump 1.";

export function EarthJumpRenderer({
  state,
  dispatch,
  evaluation,
}: {
  state: TrackerState;
  dispatch: Dispatch<TrackerAction>;
  evaluation: EvaluatedActorJump;
}) {
  const choices = state.jumpState[EARTH_ENTRY_ID]?.actors.jumper?.choices ?? {};
  return (
    <div className="chain-view-panel tracker-renderer-placeholder">
      <article className="shared-jump-renderer format-one-jump-renderer">
        <header>
          <div>
            <p>Chain beginning</p>
            <h4>Earth</h4>
            <span>Set the identity that begins this chain.</span>
          </div>
          <div className="tracker-budget">
            <span>Available</span>
            <output>0 CP</output>
          </div>
        </header>
        <section className="rendered-jump-section">
          <header>
            <p>Before the chain</p>
            <h5>Welcome to your Jumpchain</h5>
          </header>
          <p className="earth-explanation">{EARTH_EXPLANATION}</p>
        </section>
        <section className="rendered-jump-section">
          <header>
            <p>Starting identity</p>
            <h5>Choose who begins the chain</h5>
          </header>
          <div className="control-library-grid earth-identity-controls">
            <article className="control-specimen">
              <header>
                <span>Select · Manual</span>
                <code>gender</code>
              </header>
              <div className="default-choice-card">
                <div className="default-choice-heading">
                  <strong>Gender</strong>
                  <div className="cost-badge-row">
                    <b className="cost-badge is-benefit">Free</b>
                  </div>
                </div>
                <div className="default-choice-actions">
                  <label>
                    <span className="sr-only">Starting gender</span>
                    <select
                      aria-label="Earth gender"
                      value={
                        typeof choices.earth_gender === "string"
                          ? choices.earth_gender
                          : ""
                      }
                      onChange={(event) =>
                        dispatch({
                          type: "set-choice",
                          entryId: EARTH_ENTRY_ID,
                          actorId: "jumper",
                          choiceHandle: "earth_gender",
                          value: event.target.value || null,
                        })
                      }
                    >
                      <option value="">Unset</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary-control"
                    disabled={!choices.earth_gender}
                    onClick={() =>
                      dispatch({
                        type: "set-choice",
                        entryId: EARTH_ENTRY_ID,
                        actorId: "jumper",
                        choiceHandle: "earth_gender",
                        value: null,
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </div>
            </article>
            <article className="control-specimen">
              <header>
                <span>Integer · Manual</span>
                <code>age</code>
              </header>
              <div className="default-choice-card">
                <div className="default-choice-heading">
                  <strong>Age</strong>
                  <div className="cost-badge-row">
                    <b className="cost-badge is-benefit">Free</b>
                  </div>
                </div>
                <div className="default-choice-actions">
                  <NumberStepper
                    label="Earth age"
                    min={1}
                    value={
                      typeof choices.earth_age === "number"
                        ? choices.earth_age
                        : null
                    }
                    onChange={(value) =>
                      dispatch({
                        type: "set-choice",
                        entryId: EARTH_ENTRY_ID,
                        actorId: "jumper",
                        choiceHandle: "earth_age",
                        value,
                      })
                    }
                  />
                  <span className="control-range">1–∞</span>
                  <button
                    type="button"
                    className="secondary-control"
                    disabled={!choices.earth_age}
                    onClick={() =>
                      dispatch({
                        type: "set-choice",
                        entryId: EARTH_ENTRY_ID,
                        actorId: "jumper",
                        choiceHandle: "earth_age",
                        value: null,
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </div>
            </article>
          </div>
          <div className="temporary-jump-property-grid">
            <article>
              <span>Origin</span>
              <strong>
                {evaluation.properties.origin?.value ?? "Unknown"}
              </strong>
            </article>
            <article>
              <span>Species</span>
              <strong>{evaluation.properties.species?.value ?? "Human"}</strong>
            </article>
            <article>
              <span>Location</span>
              <strong>
                {evaluation.properties.location?.value ?? "Unknown"}
              </strong>
            </article>
          </div>
        </section>
      </article>
    </div>
  );
}
