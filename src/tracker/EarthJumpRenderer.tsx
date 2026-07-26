import type { Dispatch } from "react";
import type { EvaluatedActorJump } from "../domain";
import { EARTH_ENTRY_ID, type TrackerAction, type TrackerState } from "./model";
import { NumberStepper } from "./NumberStepper";
import { translate } from "../localization";

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
      <article className="shared-jump-renderer format-one-jump-renderer earth-jump-renderer">
        <header>
          <div>
            <p>{translate("ui.earthJumpRenderer.text.chainBeginning")}</p>
            <h4>{translate("ui.earthJumpRenderer.text.earth")}</h4>
            <span>
              {translate(
                "ui.earthJumpRenderer.text.setTheIdentityThatBeginsThisChain",
              )}
            </span>
          </div>
          <div className="tracker-budget">
            <span>{translate("ui.earthJumpRenderer.text.available")}</span>
            <output>{translate("ui.earthJumpRenderer.text.0CP")}</output>
          </div>
        </header>
        <section className="rendered-jump-section">
          <header>
            <p>{translate("ui.earthJumpRenderer.text.beforeTheChain")}</p>
            <h5>
              {translate("ui.earthJumpRenderer.text.welcomeToYourJumpchain")}
            </h5>
          </header>
          <p className="earth-explanation">{EARTH_EXPLANATION}</p>
        </section>
        <section className="rendered-jump-section">
          <header>
            <p>{translate("ui.earthJumpRenderer.text.startingIdentity")}</p>
            <h5>
              {translate("ui.earthJumpRenderer.text.chooseWhoBeginsTheChain")}
            </h5>
          </header>
          <div className="control-library-grid earth-identity-controls">
            <article className="control-specimen">
              <header>
                <span>
                  {translate("ui.earthJumpRenderer.text.selectManual")}
                </span>
                <code>gender</code>
              </header>
              <div className="default-choice-card">
                <div className="default-choice-heading">
                  <strong>
                    {translate("ui.earthJumpRenderer.text.gender")}
                  </strong>
                  <div className="cost-badge-row">
                    <b className="cost-badge is-benefit">
                      {translate("ui.earthJumpRenderer.text.free")}
                    </b>
                  </div>
                </div>
                <div className="default-choice-actions">
                  <label>
                    <span className="sr-only">
                      {translate("ui.earthJumpRenderer.text.startingGender")}
                    </span>
                    <select
                      aria-label={translate(
                        "ui.earthJumpRenderer.ariaLabel.earthGender",
                      )}
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
                      <option value="">
                        {translate("ui.earthJumpRenderer.text.unset")}
                      </option>
                      <option>
                        {translate("ui.earthJumpRenderer.text.male")}
                      </option>
                      <option>
                        {translate("ui.earthJumpRenderer.text.female")}
                      </option>
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
                    {translate("ui.earthJumpRenderer.text.clear")}
                  </button>
                </div>
              </div>
            </article>
            <article className="control-specimen">
              <header>
                <span>
                  {translate("ui.earthJumpRenderer.text.integerManual")}
                </span>
                <code>age</code>
              </header>
              <div className="default-choice-card">
                <div className="default-choice-heading">
                  <strong>{translate("ui.earthJumpRenderer.text.age")}</strong>
                  <div className="cost-badge-row">
                    <b className="cost-badge is-benefit">
                      {translate("ui.earthJumpRenderer.text.free")}
                    </b>
                  </div>
                </div>
                <div className="default-choice-actions">
                  <NumberStepper
                    label={translate("ui.earthJumpRenderer.label.earthAge")}
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
                    {translate("ui.earthJumpRenderer.text.clear")}
                  </button>
                </div>
              </div>
            </article>
          </div>
          <div className="temporary-jump-property-grid">
            <article>
              <span>{translate("ui.earthJumpRenderer.text.origin")}</span>
              <strong>
                {evaluation.properties.origin?.value ?? "Unknown"}
              </strong>
            </article>
            <article>
              <span>{translate("ui.earthJumpRenderer.text.species")}</span>
              <strong>{evaluation.properties.species?.value ?? "Human"}</strong>
            </article>
            <article>
              <span>{translate("ui.earthJumpRenderer.text.location")}</span>
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
