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
  bodyModPerks,
  bodyModRemaining,
  bodyModStatCost,
  bodyModStats,
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
      aria-label="Interactive Classic Body Mod full supplement page"
    >
      <header className="bodymod-full-header">
        <div>
          <p>Foundation supplement</p>
          <h4>Classic Body Mod</h4>
          <span>Quicksilver edition · 600 CP</span>
        </div>
        <div className="bodymod-budget">
          <span>Remaining</span>
          <output className={remaining < 0 ? "is-negative" : ""}>
            {remaining} CP
          </output>
        </div>
      </header>
      <Tabs
        labels={tabs}
        value={tab}
        onChange={setTab}
        className="bodymod-full-tabs"
        label="Body Mod page section"
      />
      <div className="bodymod-full-layout">
        <aside className="bodymod-build-summary">
          <p>Current foundation</p>
          <div className="bodymod-summary-avatar">
            {state.type === "Bestial"
              ? `${(state.animal || "A")[0].toUpperCase()}D`
              : type.initials}
          </div>
          <h5>{state.type === "None" ? "Current body" : state.type}</h5>
          <span>{state.build} build</span>
          <dl>
            <div>
              <dt>Body type</dt>
              <dd>{type.cost} CP</dd>
            </div>
            <div>
              <dt>Stats</dt>
              <dd>{statCost} CP</dd>
            </div>
            <div>
              <dt>Perks</dt>
              <dd>{perkCost} CP</dd>
            </div>
          </dl>
          <div className="bodymod-free-grants">
            <strong>
              Included with{" "}
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
              <p className="bodymod-kicker">What this changes</p>
              <h5>Your persistent default body</h5>
              <p>
                Body Mod changes the Jumper’s default appearance and baseline
                abilities across the chain. The chosen physique is presented
                appropriately for the Jumper’s current age.
              </p>
              <div className="bodymod-explanation-grid">
                <article>
                  <strong>600 CP</strong>
                  <span>One independent supplement budget.</span>
                </article>
                <article>
                  <strong>Fits current age</strong>
                  <span>The physique follows the current age.</span>
                </article>
                <article>
                  <strong>Adapts to other forms</strong>
                  <span>Traits are interpreted for the active body.</span>
                </article>
                <article>
                  <strong>Persistent</strong>
                  <span>The baseline remains available.</span>
                </article>
              </div>
            </section>
          )}
          {tab === "body" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">Step 1</p>
              <h5>Choose build and body type</h5>
              <h6>
                Build <span>Free · choose one</span>
              </h6>
              <div
                className="bodymod-choice-row"
                role="group"
                aria-label="Build"
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
                Body type <span>Optional · choose one</span>
              </h6>
              <div
                className="bodymod-body-grid"
                role="group"
                aria-label="Body type"
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
                ].map(([id, name, cost, copy]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={state.type === id}
                    onClick={() => setBody(id as BodyModType)}
                  >
                    <span>
                      <strong>{name}</strong>
                      <small>{cost}</small>
                    </span>
                    <p>{copy}</p>
                  </button>
                ))}
              </div>
              {state.type === "Bestial" && (
                <div className="bodymod-bestial-options">
                  <label>
                    <span>Animal</span>
                    <input
                      aria-label="Bestial animal"
                      value={state.animal}
                      onChange={(event) => setAnimal(event.target.value)}
                      placeholder="Choose a real animal"
                    />
                  </label>
                  <label>
                    <span>Trait tier</span>
                    <select
                      aria-label="Bestial trait tier"
                      value={state.bestialTier}
                      onChange={(event) =>
                        setBestialTier(Number(event.target.value))
                      }
                    >
                      <option value="0">Minor traits</option>
                      <option value="1">Major traits</option>
                      <option value="2">Full anthro</option>
                    </select>
                  </label>
                  <label>
                    <span>Animal-associated stat</span>
                    <select
                      aria-label="Bestial associated stat"
                      value={state.bestialStat}
                      onChange={(event) =>
                        setBestialStat(event.target.value as BodyModStat)
                      }
                    >
                      {bodyModStats.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <p>
                    The selected stat receives included ranks equal to the trait
                    tier.
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "stats" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">Step 2</p>
              <h5>Choose stats</h5>
              <p>
                Every purchased rank costs 50 CP, requires the previous rank,
                and caps at rank 4.
              </p>
              <div className="bodymod-rank-list">
                {bodyModStats.map((name) => {
                  const rank = totalStat(state, name);
                  return (
                    <article key={name}>
                      <div>
                        <strong>{name}</strong>
                        <span>Persistent baseline {name.toLowerCase()}.</span>
                      </div>
                      <Stepper
                        name={name}
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
              <p className="bodymod-kicker">Step 3</p>
              <h5>Choose perks</h5>
              <p>
                Perks retain the source document’s repeat limits and price per
                tier.
              </p>
              <div className="bodymod-perk-list">
                {bodyModPerks.map(([name, cost, max]) => {
                  const rank = totalPerk(state, name);
                  return (
                    <article key={name}>
                      <div>
                        <strong>{name}</strong>
                        <span>
                          {
                            perkDescriptions[name][
                              Math.min(rank, perkDescriptions[name].length - 1)
                            ]
                          }
                        </span>
                      </div>
                      <Stepper
                        name={name}
                        value={rank}
                        min={freePerkRanks[name] ?? 0}
                        max={max}
                        onChange={(value) => setPerk(name, value)}
                      />
                      <small>{cost} CP each</small>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {tab === "review" && (
            <section className="bodymod-panel">
              <p className="bodymod-kicker">Review</p>
              <h5>Your Body Mod</h5>
              <div className="bodymod-review-cards">
                <article>
                  <span>Build</span>
                  <strong>{state.build}</strong>
                </article>
                <article>
                  <span>Body type</span>
                  <strong>
                    {state.type === "Bestial"
                      ? bestialPresentation(state)
                      : state.type === "None"
                        ? "Current body"
                        : state.type}
                  </strong>
                </article>
                <article>
                  <span>Spent</span>
                  <strong>{600 - remaining} CP</strong>
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
