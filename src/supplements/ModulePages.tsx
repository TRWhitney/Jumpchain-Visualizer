import { useState } from "react";
import { Stepper, Tabs } from "../ui/SupplementWidgets";
import type { ModuleId } from "./model";
import { useBodyMod } from "./useBodyMod";
import {
  EssentialParityPage,
  PersonalRealityParityPage,
  QuestParityPage,
  StoryParityPage,
  UdsParityPage,
  WarehouseParityPage,
} from "./ParityPages";
import {
  bestialPresentation,
  bodyModPerkCost,
  bodyModPerkLabel,
  bodyModPerks,
  bodyModRemaining,
  bodyModStatCost,
  bodyModStatLabel,
  bodyModStats,
  bodyModTypeLabel,
  bodyTypes,
  freePerks,
  freeStats,
  perkDescriptions,
  statDescriptions,
  totalPerk,
  totalStat,
  type BodyModStat,
  type BodyModType,
} from "./bodyMod";
import { translate } from "../localization";

export function BodyModPage() {
  const [tab, setTab] = useState("body");
  const {
    state,
    setBuild,
    setBody,
    setAnimal,
    setBestialTier,
    setBestialStat,
    setStat,
    setPerk,
  } = useBodyMod();
  const statCost = bodyModStatCost(state);
  const perkCost = bodyModPerkCost(state);
  const remaining = bodyModRemaining(state);
  const freeStatRanks = freeStats(state);
  const freePerkRanks = freePerks(state);
  const type = bodyTypes[state.type];
  const tabs = [
    { id: "intro", label: "Explanation" },
    { id: "body", label: "Build & body" },
    { id: "stats", label: "Stats" },
    { id: "perks", label: "Perks" },
    { id: "review", label: "Review" },
  ] as const;
  return (
    <div
      className="bodymod-full-mock"
      aria-label={translate(
        "ui.modulePages.ariaLabel.interactiveClassicBodyModFullSupplementPage",
      )}
    >
      <header className="bodymod-full-header">
        <div>
          <p>{translate("ui.modulePages.text.foundationSupplement")}</p>
          <h4>{translate("ui.modulePages.text.classicBodyMod")}</h4>
          <span>
            {translate("ui.modulePages.text.quicksilverEdition600CP")}
          </span>
        </div>
        <div className="bodymod-budget">
          <span>{translate("ui.modulePages.text.remaining")}</span>
          <output className={remaining < 0 ? "is-negative" : ""}>
            {remaining} {translate("ui.modulePages.text.cp")}
          </output>
        </div>
      </header>
      <Tabs
        labels={tabs}
        value={tab}
        onChange={setTab}
        className="bodymod-full-tabs"
        label={translate("ui.modulePages.label.bodyModPageSection")}
      />
      <div className="bodymod-full-layout">
        <aside className="bodymod-build-summary">
          <p>{translate("ui.modulePages.text.currentFoundation")}</p>
          <div className="bodymod-summary-avatar">
            {state.type === "Bestial"
              ? `${(state.animal || "A")[0].toUpperCase()}D`
              : type.initials}
          </div>
          <h5>{bodyModTypeLabel(state.type)}</h5>
          <span>
            {state.build} {translate("ui.modulePages.text.build")}
          </span>
          <dl>
            <div>
              <dt>{translate("ui.modulePages.text.bodyType")}</dt>
              <dd>
                {type.cost} {translate("ui.modulePages.text.cp")}
              </dd>
            </div>
            <div>
              <dt>{translate("ui.modulePages.text.stats")}</dt>
              <dd>
                {statCost} {translate("ui.modulePages.text.cp")}
              </dd>
            </div>
            <div>
              <dt>{translate("ui.modulePages.text.perks")}</dt>
              <dd>
                {perkCost} {translate("ui.modulePages.text.cp")}
              </dd>
            </div>
          </dl>
          <div className="bodymod-free-grants">
            <strong>
              {translate("ui.modulePages.text.includedWith")}{" "}
              {state.type === "None" ? "current body" : state.type}
            </strong>
            <p>
              {type.included}
              {state.type === "Bestial" && state.bestialTier > 0
                ? ` · ${state.bestialStat} ${state.bestialTier}`
                : ""}
            </p>
          </div>
        </aside>
        <div className="bodymod-panel-stack">
          {tab === "intro" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">
                {translate("ui.modulePages.text.whatThisChanges")}
              </p>
              <h5>
                {translate("ui.modulePages.text.yourPersistentDefaultBody")}
              </h5>
              <p>
                {translate(
                  "ui.modulePages.text.bodyModChangesTheJumperSDefaultAppearanceAnd",
                )}
              </p>
              <div className="bodymod-explanation-grid">
                <article>
                  <strong>{translate("ui.modulePages.text.600CP")}</strong>
                  <span>
                    {translate(
                      "ui.modulePages.text.oneIndependentSupplementBudget",
                    )}
                  </span>
                </article>
                <article>
                  <strong>
                    {translate("ui.modulePages.text.fitsCurrentAge")}
                  </strong>
                  <span>
                    {translate(
                      "ui.modulePages.text.thePhysiqueFollowsTheCurrentAge",
                    )}
                  </span>
                </article>
                <article>
                  <strong>
                    {translate("ui.modulePages.text.adaptsToOtherForms")}
                  </strong>
                  <span>
                    {translate(
                      "ui.modulePages.text.traitsAreInterpretedForTheActiveBody",
                    )}
                  </span>
                </article>
                <article>
                  <strong>{translate("ui.modulePages.text.persistent")}</strong>
                  <span>
                    {translate(
                      "ui.modulePages.text.theBaselineRemainsAvailable",
                    )}
                  </span>
                </article>
              </div>
            </section>
          )}
          {tab === "body" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">
                {translate("ui.modulePages.text.step1")}
              </p>
              <h5>{translate("ui.modulePages.text.chooseBuildAndBodyType")}</h5>
              <h6>
                {translate("ui.modulePages.text.buildPrefix")}
                <span>{translate("ui.modulePages.text.freeChooseOne")}</span>
              </h6>
              <div
                className="bodymod-choice-row"
                role="group"
                aria-label={translate("ui.modulePages.ariaLabel.build")}
              >
                {["Light", "Medium", "Heavy"].map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={state.build === name}
                    onClick={() => setBuild(name)}
                  >
                    <strong>{name}</strong>
                    <span>
                      {name === "Light"
                        ? "Narrow shoulders and lower mass."
                        : name === "Medium"
                          ? "Average shoulder width and mass."
                          : "Broad shoulders and greater mass."}
                    </span>
                  </button>
                ))}
              </div>
              <h6>
                {translate("ui.modulePages.text.bodyTypePrefix")}
                <span>
                  {translate("ui.modulePages.text.optionalChooseOne")}
                </span>
              </h6>
              <div
                className="bodymod-body-grid"
                role="group"
                aria-label={translate("ui.modulePages.ariaLabel.bodyType")}
              >
                {[
                  [
                    "None",
                    "Use current body",
                    "Free",
                    "No template or included ranks.",
                  ],
                  [
                    "Bodybuilder",
                    "Bodybuilder",
                    "100 CP",
                    "Strength 2 · Endurance 2 · Height 1",
                  ],
                  [
                    "Athlete",
                    "Athlete",
                    "100 CP",
                    "Speed 2 · Dexterity 2 · Flexibility 1",
                  ],
                  [
                    "Charmer",
                    "Charmer",
                    "100 CP",
                    "Appeal 2 · Shape 2 · Endowed 3",
                  ],
                  [
                    "Bestial",
                    "Bestial",
                    "150 CP",
                    "Sense 2 · Color 1 · animal traits",
                  ],
                ].map(([id, , cost, copy]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={state.type === id}
                    onClick={() => setBody(id as BodyModType)}
                  >
                    <span>
                      <strong>{bodyModTypeLabel(id as BodyModType)}</strong>
                      <small>{cost}</small>
                    </span>
                    <p>{copy}</p>
                  </button>
                ))}
              </div>
              {state.type === "Bestial" && (
                <div className="bodymod-bestial-options">
                  <label>
                    <span>{translate("ui.modulePages.text.animal")}</span>
                    <input
                      spellCheck
                      aria-label={translate(
                        "ui.modulePages.ariaLabel.bestialAnimal",
                      )}
                      value={state.animal}
                      onChange={(event) => setAnimal(event.target.value)}
                      placeholder={translate(
                        "ui.modulePages.placeholder.chooseARealAnimal",
                      )}
                    />
                  </label>
                  <label>
                    <span>{translate("ui.modulePages.text.traitTier")}</span>
                    <select
                      aria-label={translate(
                        "ui.modulePages.ariaLabel.bestialTraitTier",
                      )}
                      value={state.bestialTier}
                      onChange={(event) =>
                        setBestialTier(Number(event.target.value))
                      }
                    >
                      <option value="0">
                        {translate("ui.modulePages.text.minorTraits")}
                      </option>
                      <option value="1">
                        {translate("ui.modulePages.text.majorTraits")}
                      </option>
                      <option value="2">
                        {translate("ui.modulePages.text.fullAnthro")}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>
                      {translate("ui.modulePages.text.animalAssociatedStat")}
                    </span>
                    <select
                      aria-label={translate(
                        "ui.modulePages.ariaLabel.bestialAssociatedStat",
                      )}
                      value={state.bestialStat}
                      onChange={(event) =>
                        setBestialStat(event.target.value as BodyModStat)
                      }
                    >
                      {bodyModStats.map((name) => (
                        <option key={name} value={name}>
                          {bodyModStatLabel(name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {translate(
                      "ui.modulePages.text.theSelectedStatReceivesIncludedRanksEqualToThe",
                    )}
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "stats" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">
                {translate("ui.modulePages.text.step2")}
              </p>
              <h5>{translate("ui.modulePages.text.chooseStats")}</h5>
              <p>
                {translate(
                  "ui.modulePages.text.everyPurchasedRankCosts50CPRequiresThePrevious",
                )}
              </p>
              <div className="bodymod-rank-list">
                {bodyModStats.map((name) => {
                  const rank = totalStat(state, name);
                  return (
                    <article key={name}>
                      <div>
                        <strong>{bodyModStatLabel(name)}</strong>
                        <span>
                          {translate("ui.modulePages.text.persistentBaseline")}
                          {name.toLowerCase()}.
                        </span>
                      </div>
                      <Stepper
                        name={bodyModStatLabel(name)}
                        value={rank}
                        min={freeStatRanks[name] ?? 0}
                        onChange={(value) => setStat(name, value)}
                      />
                      <p>{statDescriptions[name][rank]}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {tab === "perks" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">
                {translate("ui.modulePages.text.step3")}
              </p>
              <h5>{translate("ui.modulePages.text.choosePerks")}</h5>
              <p>
                {translate(
                  "ui.modulePages.text.perksRetainTheSourceDocumentSRepeatLimitsAnd",
                )}
              </p>
              <div className="bodymod-perk-list">
                {bodyModPerks.map(([name, cost, max]) => {
                  const rank = totalPerk(state, name);
                  return (
                    <article key={name}>
                      <div>
                        <strong>{bodyModPerkLabel(name)}</strong>
                        <span>
                          {
                            perkDescriptions[name][
                              Math.min(rank, perkDescriptions[name].length - 1)
                            ]
                          }
                        </span>
                      </div>
                      <Stepper
                        name={bodyModPerkLabel(name)}
                        value={rank}
                        min={freePerkRanks[name] ?? 0}
                        max={max}
                        onChange={(value) => setPerk(name, value)}
                      />
                      <small>
                        {cost} {translate("ui.modulePages.text.cpEach")}
                      </small>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {tab === "review" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">
                {translate("ui.modulePages.text.review")}
              </p>
              <h5>{translate("ui.modulePages.text.yourBodyMod")}</h5>
              <div className="bodymod-review-cards">
                <article>
                  <span>{translate("ui.modulePages.text.buildHeading")}</span>
                  <strong>{state.build}</strong>
                </article>
                <article>
                  <span>{translate("ui.modulePages.text.bodyType")}</span>
                  <strong>
                    {state.type === "Bestial"
                      ? bestialPresentation(state)
                      : state.type === "None"
                        ? "Current body"
                        : state.type}
                  </strong>
                </article>
                <article>
                  <span>{translate("ui.modulePages.text.spent")}</span>
                  <strong>
                    {600 - remaining} {translate("ui.modulePages.text.cp")}
                  </strong>
                </article>
              </div>
              <div
                className={`bodymod-review-diagnostic${remaining < 0 ? " is-negative" : ""}`}
                role="status"
              >
                {remaining < 0
                  ? `Build is ${-remaining} CP over budget.`
                  : `Build is valid with ${remaining} CP remaining.`}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export function ModulePage({ id }: { id: ModuleId }) {
  return id === "body-mod" ? (
    <BodyModPage />
  ) : id === "essential-body-mod" ? (
    <EssentialParityPage />
  ) : id === "warehouse" ? (
    <WarehouseParityPage />
  ) : id === "personal-reality" ? (
    <PersonalRealityParityPage />
  ) : id === "universal-drawbacks" ? (
    <UdsParityPage />
  ) : id === "quest-mode" ? (
    <QuestParityPage />
  ) : (
    <StoryParityPage />
  );
}
