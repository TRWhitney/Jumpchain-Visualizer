import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Modal } from "../ui/SupplementWidgets";
import {
  dropEdgeAtPointer,
  dropIndexForTarget,
  type DropEdge,
} from "../ui/dragReorder";
import {
  essentialPageCategories as essentialCategories,
  essentialEssences,
  personalRealityPageCategories as personalRealityCategories,
  universalDrawbacksPage as universalDrawbacks,
} from "./catalogs";
import { useSupplementState } from "./useSupplementState";
import {
  questRows,
  warehouseCost,
  warehouseDescriptions,
  warehouseGroups,
} from "./parityData";
import {
  essentialAdvancementAward,
  realityModeAward,
  storyWordCount,
  toggleValue,
  type StoryChapter,
} from "./supplementState";
import type { ModuleId, ToolId } from "./model";

type Props = {
  tool: Exclude<ToolId, "body">;
  close: () => void;
  openPage: (id: ModuleId) => void;
  embedded: boolean;
  jumpName?: string;
  jumpEntryId?: string;
  jumpNumber?: number;
  gauntlet?: boolean;
};
const CurrentJumpNameContext = createContext("Arcane Realms");
const CurrentJumpEntryContext = createContext({ id: "entry-1", number: 2 });
const CurrentGauntletContext = createContext(false);
function CurrentJumpName() {
  return useContext(CurrentJumpNameContext);
}
const roman = (value: number) =>
  ["", "I", "II", "III", "IV", "V"][value] ?? String(value);

const abilityGroups = {
  base: [
    [
      "Physical Resilience I",
      "Provides escalating immunity to disease, toxins, radiation, and injury.",
    ],
    [
      "Heightened Senses I",
      "Improves the range and precision of ordinary senses.",
    ],
    [
      "Heightened Reactions I",
      "Accelerates reaction time and develops danger awareness.",
    ],
    [
      "Mental Prowess I",
      "Improves memory, processing, concentration, and mental endurance.",
    ],
    ["Mental Resistance I", "Resists mental influence and hostile alteration."],
    [
      "Physical Perfection II",
      "Improves all physical performance from peak human through five times peak.",
    ],
  ],
  skills: [
    [
      "Strategic Mastery I",
      "Learn strategy and tactics from familiarity through mastery.",
    ],
    [
      "Leadership Mastery I",
      "Learn command, administration, and organizational leadership.",
    ],
    ["Martial Mastery I", "Learn armed and unarmed combat disciplines."],
  ],
  supernatural: [
    [
      "No supernatural capabilities",
      "The current build has no supernatural purchases.",
    ],
  ],
} as const;

function EssentialSummary({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { essential: state },
    dispatch,
  } = useSupplementState();
  const [detail, setDetail] = useState<string | null>(null);
  const gauntlet = useContext(CurrentGauntletContext);
  const jumpName = CurrentJumpName();
  const currentJump = useContext(CurrentJumpEntryContext);
  const jumpAttribution = `${jumpName} · Jump ${currentJump.number}`;
  const hasWarlord = state.essences.includes("Warlord");
  type Ability = [string, string, string?];
  const selectedEssence = state.essences[0];
  const groups: Record<"base" | "skills" | "supernatural", Ability[]> =
    hasWarlord
      ? {
          base: abilityGroups.base.map(([name, copy]) => [name, copy]),
          skills: abilityGroups.skills.map(([name, copy]) => [name, copy]),
          supernatural: [],
        }
      : selectedEssence === "Scholar"
        ? {
            base: [
              [
                "Mental Prowess I",
                "Peak-human memory, concentration, and mental endurance.",
              ],
              [
                "Mental Resistance I",
                "A baseline defense against hostile mental influence.",
              ],
              [
                "Empathetic I",
                "Improved awareness of others’ emotional states.",
              ],
            ],
            skills: [
              ["Strategic Mastery I", "Immediate familiarity with strategy."],
              [
                "Scientific Mastery I",
                "Immediate familiarity with encountered sciences.",
              ],
              [
                "Engineering Mastery I",
                "Immediate familiarity with engineering disciplines.",
              ],
              [
                "Biomedical Mastery I",
                "Immediate familiarity with medicine and biology.",
              ],
              [
                "Occult Mastery I",
                "Immediate familiarity with occult practices.",
              ],
              [
                "Polyglot",
                "Rapidly understand and learn encountered languages.",
              ],
            ],
            supernatural: [
              [
                "Trivial Applications",
                "Use supernatural abilities for harmless convenience and cosmetic effects.",
              ],
            ],
          }
        : {
            base: selectedEssence
              ? [
                  [
                    `Essence of the ${selectedEssence}`,
                    essentialEssences.find(
                      ([name]) => name === selectedEssence,
                    )?.[1] ?? "",
                  ],
                ]
              : [],
            skills: [],
            supernatural: [],
          };
  const allEntries = Object.values(essentialCategories).flat();
  const grants = new Set([
    "physical-perfection",
    "physical-resilience",
    "heightened-senses",
    "heightened-reactions",
    "mental-prowess",
    "mental-resistance",
    "strategic-mastery",
    "leadership-mastery",
    "martial-mastery",
  ]);
  const discounts = new Set([...grants, "regeneration"]);
  const initialTier = (id: string) =>
    Math.max(state.purchases[id] ?? 0, hasWarlord && grants.has(id) ? 1 : 0);
  const costAt = (entry: (typeof allEntries)[number], tier: number) => {
    if (
      !tier ||
      entry.included ||
      (hasWarlord && tier <= 1 && grants.has(entry.id))
    )
      return 0;
    const raw = entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ?? 0;
    return hasWarlord && discounts.has(entry.id) && raw > 0
      ? raw === 50
        ? 0
        : raw / 2
      : raw;
  };
  const initialSpent = allEntries.reduce(
    (sum, entry) => sum + costAt(entry, initialTier(entry.id)),
    0,
  );
  const progressSpent = allEntries.reduce((sum, entry) => {
    const target = state.progression.purchases[entry.id] ?? 0;
    return target
      ? sum +
          Math.max(
            0,
            costAt(entry, target) - costAt(entry, initialTier(entry.id)),
          )
      : sum;
  }, 0);
  const advancement = essentialAdvancementAward(
    state.advancementMode,
    state.progression.advancement,
    state.progression.quests,
  );
  const infusion =
    state.progression.infusion === "lesser"
      ? 50
      : state.progression.infusion === "greater"
        ? 100
        : 0;
  const noEssenceBonus =
    state.essenceMode === "none"
      ? ({ heroic: 500, standard: 400, hardcore: 250 }[state.startingMode] ?? 0)
      : 0;
  const balance =
    ({ heroic: 500, standard: 100, hardcore: 0 }[state.startingMode] ?? 100) +
    noEssenceBonus -
    initialSpent +
    advancement +
    infusion -
    progressSpent;
  const owned = [
    ...Object.entries(state.purchases).map(
      ([id, tier]) => [id, tier, "Initial build"] as const,
    ),
    ...Object.entries(state.progression.purchases).map(
      ([id, tier]) => [id, tier, jumpAttribution] as const,
    ),
  ];
  for (const [id, tier, provenance] of owned) {
    if (!tier) continue;
    const entry = allEntries.find((candidate) => candidate.id === id);
    if (!entry) continue;
    const destination =
      entry.category === "skills"
        ? "skills"
        : entry.category === "supernatural"
          ? "supernatural"
          : "base";
    groups[destination] = groups[destination].filter(
      ([name]) => !name.startsWith(entry.name),
    );
    groups[destination].push([
      `${entry.name} ${roman(tier)}`,
      entry.summary,
      provenance,
    ]);
  }
  const abilities =
    gauntlet && state.dialogFilter === "supernatural"
      ? []
      : groups[state.dialogFilter];
  const essenceDescription = essentialEssences.find(
    ([name]) => name === state.essences[0],
  )?.[1];
  return (
    <div className="essential-dialog-body">
      <aside>
        <div className="essential-dialog-essence">
          <button
            className="essential-dialog-mark"
            type="button"
            aria-describedby="essential-essence-tooltip"
          >
            {state.essences[0]?.[0] ?? "—"}
          </button>
          <span id="essential-essence-tooltip" role="tooltip">
            {state.essences[0]
              ? `${state.essences[0]} Essence: ${essenceDescription}`
              : "No Essence selected."}
          </span>
        </div>
        <h5>
          {state.essences[0] ? `${state.essences[0]} Essence` : "No Essence"}
        </h5>
        <span>
          {state.advancementMode === "standard"
            ? "Standard progression"
            : `${state.advancementMode} progression`}
        </span>
        <dl>
          <div>
            <dt>Starting Mode</dt>
            <dd>{state.startingMode}</dd>
          </div>
          <div>
            <dt>Advancement</dt>
            <dd>{state.advancementMode}</dd>
          </div>
          <div>
            <dt>EP Access</dt>
            <dd>{state.accessMode}</dd>
          </div>
          <div>
            <dt>EP remaining</dt>
            <dd>{balance}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("essential-body-mod")}>
          Open full Essential Body Mod
        </button>
      </aside>
      <section>
        <div className="essential-dialog-heading">
          <div>
            <p>Persistent capabilities</p>
            <h5>Morgan’s build</h5>
          </div>
          <span>Regular Jump</span>
        </div>
        <div
          className="essential-dialog-filters"
          role="group"
          aria-label="Filter Essential Body Modification abilities"
        >
          {(["base", "skills", "supernatural"] as const).map((filter) => (
            <button
              type="button"
              key={filter}
              aria-pressed={state.dialogFilter === filter}
              onClick={() =>
                dispatch({
                  type: "essential",
                  update: { dialogFilter: filter },
                })
              }
            >
              {filter === "base"
                ? "Base form"
                : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        <div className="essential-dialog-abilities">
          {abilities.map(([name, copy, provenance]) => (
            <button
              type="button"
              key={name}
              title={provenance ? `${copy} Acquired: ${provenance}.` : copy}
              aria-expanded={detail === name}
              onClick={() => setDetail(detail === name ? null : name)}
            >
              {name}
            </button>
          ))}
          {!abilities.length && (
            <p className="essential-empty">
              {state.dialogFilter === "supernatural"
                ? "No Supernatural abilities purchased."
                : "No abilities in this category."}
            </p>
          )}
        </div>
        {detail && (
          <div className="essential-dialog-detail" role="region">
            <strong>{detail}</strong>
            <p>
              {abilities.find(([name]) => name === detail)?.[1]}
              {abilities.find(([name]) => name === detail)?.[2]
                ? ` Acquired: ${abilities.find(([name]) => name === detail)?.[2]}.`
                : ""}
            </p>
          </div>
        )}
        <p className="essential-gauntlet-note">
          <strong>Gauntlet projection:</strong> base-form and Skill capabilities
          remain available. Supernatural purchases do not.
        </p>
      </section>
    </div>
  );
}

function EssentialProgress({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { essential: state },
    dispatch,
  } = useSupplementState();
  const jumpName = CurrentJumpName();
  const currentJump = useContext(CurrentJumpEntryContext);
  const jumpAttribution = `${jumpName} · Jump ${currentJump.number}`;
  const p = state.progression;
  const allEntries = Object.values(essentialCategories).flat();
  const grants = new Set([
    "physical-perfection",
    "physical-resilience",
    "heightened-senses",
    "heightened-reactions",
    "mental-prowess",
    "mental-resistance",
    "strategic-mastery",
    "leadership-mastery",
    "martial-mastery",
  ]);
  const discounts = new Set([...grants, "regeneration"]);
  const hasWarlord = state.essences.includes("Warlord");
  const initialTier = (id: string) =>
    Math.max(state.purchases[id] ?? 0, hasWarlord && grants.has(id) ? 1 : 0);
  const costAt = (entry: (typeof allEntries)[number], tier: number) => {
    if (
      !tier ||
      entry.included ||
      (hasWarlord && tier <= 1 && grants.has(entry.id))
    )
      return 0;
    const raw = entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ?? 0;
    return hasWarlord && discounts.has(entry.id) && raw > 0
      ? raw === 50
        ? 0
        : raw / 2
      : raw;
  };
  const initialSpent = allEntries.reduce(
    (sum, entry) => sum + costAt(entry, initialTier(entry.id)),
    0,
  );
  const noEssenceBonus =
    state.essenceMode === "none"
      ? ({ heroic: 500, standard: 400, hardcore: 250 }[state.startingMode] ?? 0)
      : 0;
  const starting =
    ({ heroic: 500, standard: 100, hardcore: 0 }[state.startingMode] ?? 100) +
    noEssenceBonus -
    initialSpent;
  const infusion =
    p.infusion === "lesser" ? 50 : p.infusion === "greater" ? 100 : 0;
  const cp = infusion;
  const progressEntries = essentialCategories[p.category] ?? [];
  const spent = allEntries.reduce((sum, entry) => {
    const target = p.purchases[entry.id];
    return target
      ? sum +
          Math.max(
            0,
            costAt(entry, target) - costAt(entry, initialTier(entry.id)),
          )
      : sum;
  }, 0);
  const advancement = essentialAdvancementAward(
    state.advancementMode,
    p.advancement,
    p.quests,
  );
  const balance = starting + advancement + infusion - spent;
  return (
    <div className="essential-progression-body">
      <aside>
        <p>Net EP change</p>
        <strong>{advancement + infusion - spent} EP</strong>
        <dl>
          <div>
            <dt>Advancement</dt>
            <dd>{advancement} EP</dd>
          </div>
          <div>
            <dt>EP Infusion</dt>
            <dd>{infusion} EP</dd>
          </div>
          <div>
            <dt>EP spent here</dt>
            <dd>{spent} EP</dd>
          </div>
          <div>
            <dt>Jump CP spent</dt>
            <dd>{cp} CP</dd>
          </div>
          <div>
            <dt>New EP balance</dt>
            <dd>{balance} EP</dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("essential-body-mod")}>
          Open starting build
        </button>
      </aside>
      <section>
        <div className="essential-progress-heading">
          <div>
            <p>Selected Jump record</p>
            <h5>Progression sources and purchases</h5>
          </div>
          <span>
            {state.advancementMode === "standard"
              ? "Standard Advancement"
              : `${state.advancementMode[0].toUpperCase()}${state.advancementMode.slice(1)} Advancement`}
          </span>
        </div>
        <article className="essential-progress-panel">
          <div>
            <strong>Advancement Mode</strong>
            <small>
              {state.advancementMode === "standard"
                ? "Standard Advancement provides no per-Jump EP award."
                : state.advancementMode === "questing"
                  ? "Questing awards come from the challenge records below."
                  : "Record the award made available by this advancement mode."}
            </small>
          </div>
          <button
            type="button"
            disabled={
              state.advancementMode === "standard" ||
              state.advancementMode === "questing"
            }
            aria-pressed={p.advancement}
            onClick={() =>
              dispatch({
                type: "essentialProgress",
                update: { advancement: !p.advancement },
              })
            }
          >
            {state.advancementMode === "standard"
              ? "No award"
              : state.advancementMode === "questing"
                ? "Use challenges"
                : p.advancement
                  ? `${state.advancementMode === "meteoric" ? 100 : 50} EP recorded`
                  : `Record ${state.advancementMode === "meteoric" ? 100 : 50} EP`}
          </button>
        </article>
        {state.advancementMode === "questing" && (
          <article className="essential-progress-panel essential-questing-panel">
            <div>
              <strong>Questing challenges</strong>
              <small>
                Record challenges completed during <CurrentJumpName />.
              </small>
            </div>
            {[
              [50, "Resolve the Highcourt succession"],
              [100, "End the Violet Gate incursion"],
            ].map(([award, label]) => (
              <label key={award}>
                <input
                  type="checkbox"
                  checked={p.quests.includes(Number(award))}
                  onChange={() =>
                    dispatch({
                      type: "essentialProgress",
                      update: {
                        quests: toggleValue(
                          p.quests.map(String),
                          String(award),
                        ).map(Number),
                      },
                    })
                  }
                />
                {label} <b>{award} EP</b>
              </label>
            ))}
          </article>
        )}
        <div className="essential-progress-section">
          <h6>
            EP Infusion purchased in <CurrentJumpName />
          </h6>
          <p>
            {state.accessMode === "standard"
              ? `Standard Access permits one Lesser or Greater Essence Infusion${state.variants.some((variant) => ["cumulative", "retroactive"].includes(variant)) ? " from the available cumulative opportunities" : " in this Jump"}.`
              : state.accessMode === "lesser"
                ? `Lesser Access permits only Lesser Essence Infusion${state.variants.some((variant) => ["cumulative", "retroactive"].includes(variant)) ? " from the available cumulative opportunities" : " in this Jump"}.`
                : "No Access prevents EP Infusion purchases."}
          </p>
          <div
            className="essential-infusion-options"
            role="group"
            aria-label="EP Infusion purchase"
          >
            {[
              ["none", "None", "No CP or EP"],
              ["lesser", "Lesser", "−50 CP · +50 EP"],
              ["greater", "Greater", "−100 CP · +100 EP"],
            ].map(([id, name, copy]) => (
              <button
                type="button"
                key={id}
                aria-pressed={p.infusion === id}
                disabled={
                  (id === "greater" && state.accessMode !== "standard") ||
                  (id === "lesser" && state.accessMode === "none")
                }
                onClick={() =>
                  dispatch({
                    type: "essentialProgress",
                    update: { infusion: id as typeof p.infusion },
                  })
                }
              >
                <strong>{name}</strong>
                <span>{copy}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="essential-progress-section essential-spend-section">
          <div>
            <h6>
              Spend EP in <CurrentJumpName />
            </h6>
            <span>{balance} EP available</span>
          </div>
          <p>
            Purchases made here remain attributed to <CurrentJumpName />.
          </p>
          <div className="essential-spend-tools">
            <label>
              <span>Category</span>
              <select
                value={p.category}
                onChange={(event) =>
                  dispatch({
                    type: "essentialProgress",
                    update: { category: event.target.value, search: "" },
                  })
                }
              >
                {[
                  "physical",
                  "mental",
                  "spiritual",
                  "skills",
                  "supernatural",
                  "items",
                  "companions",
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Find</span>
              <input
                type="search"
                placeholder="Find an upgrade"
                value={p.search}
                onChange={(event) =>
                  dispatch({
                    type: "essentialProgress",
                    update: { search: event.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="essential-progress-purchases">
            {progressEntries
              .filter((entry) =>
                `${entry.name} ${entry.summary}`
                  .toLowerCase()
                  .includes(p.search.toLowerCase()),
              )
              .map((entry) => {
                const acquiredTier = p.purchases[entry.id] ?? 0;
                const currentTier = initialTier(entry.id);
                const targetTier = acquiredTier || currentTier + 1;
                const atMaximum =
                  !acquiredTier && targetTier > entry.costs.length;
                const cost = acquiredTier
                  ? Math.max(
                      0,
                      costAt(entry, acquiredTier) - costAt(entry, currentTier),
                    )
                  : atMaximum
                    ? 0
                    : Math.max(
                        0,
                        costAt(entry, targetTier) - costAt(entry, currentTier),
                      );
                return (
                  <article
                    className={`essential-progress-purchase ${acquiredTier ? "is-acquired" : ""}`}
                    key={entry.id}
                  >
                    <div>
                      <strong>
                        {entry.name}{" "}
                        {roman(Math.min(targetTier, entry.costs.length))}
                      </strong>
                      <span>{entry.summary}</span>
                      <em>
                        {acquiredTier
                          ? `Acquired in ${jumpAttribution}`
                          : atMaximum
                            ? "Maximum tier owned · starting build"
                            : `${cost} EP · next tier`}
                      </em>
                    </div>
                    <button
                      type="button"
                      disabled={!acquiredTier && (atMaximum || cost > balance)}
                      onClick={() =>
                        dispatch({
                          type: "essentialProgress",
                          update: {
                            purchases: {
                              ...p.purchases,
                              [entry.id]: acquiredTier ? 0 : targetTier,
                            },
                          },
                        })
                      }
                    >
                      {acquiredTier
                        ? "Remove"
                        : atMaximum
                          ? "Maximum"
                          : `Buy · ${cost} EP`}
                    </button>
                  </article>
                );
              })}
          </div>
        </div>
        <p className="essential-progress-note">
          Changing this record recalculates the current Essential EP balance and
          selected Jump’s CP balance.
        </p>
      </section>
    </div>
  );
}

function WarehouseSummary({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { warehouse: state },
  } = useSupplementState();
  const [detail, setDetail] = useState<string | null>(null);
  const remaining = 150 - warehouseCost(state.selected, state.stasisPods);
  const structures = warehouseGroups.structures.filter(([name]) =>
    state.selected.includes(name),
  );
  return (
    <div className="warehouse-dialog-body">
      <aside>
        <div className="warehouse-space-number">
          <strong>
            {state.selected.includes("Free Space") ? "80,000" : "40,000"}
          </strong>
          <span>square feet</span>
        </div>
        <dl>
          <div>
            <dt>Access</dt>
            <dd>{state.selected.includes("Portal") ? "Portal" : "Key"}</dd>
          </div>
          <div>
            <dt>WP remaining</dt>
            <dd>{remaining}</dd>
          </div>
          <div>
            <dt>Entrance</dt>
            <dd>One at a time</dd>
          </div>
          <div>
            <dt>Closed state</dt>
            <dd>Time stopped</dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("warehouse")}>
          Open full Warehouse
        </button>
      </aside>
      <section>
        <div className="warehouse-dialog-heading">
          <div>
            <p>Configured interior</p>
            <h5>Floor plan summary</h5>
          </div>
          <span>
            {state.selected.length + (state.stasisPods ? 1 : 0)} features
          </span>
        </div>
        <div className="warehouse-floorplan">
          <div
            className="is-main"
            tabIndex={0}
            aria-describedby="warehouse-main-tooltip"
          >
            <strong>Main storage</strong>
            <span>
              {state.selected.includes("Free Space") ? "80,000" : "40,000"} ft²
              total
            </span>
            <span
              id="warehouse-main-tooltip"
              className="warehouse-floor-tooltip"
              role="tooltip"
            >
              The Warehouse’s general-purpose storage floor.
            </span>
          </div>
          {structures.map(([name, , copy]) => (
            <div key={name} tabIndex={0}>
              <strong>{name}</strong>
              <span>
                {name === "Shelving"
                  ? "Storage"
                  : name === "Terminal"
                    ? "Catalog"
                    : "Facilities"}
              </span>
              <span className="warehouse-floor-tooltip" role="tooltip">
                {copy}
              </span>
            </div>
          ))}
        </div>
        <h6>
          Installed features <span>Choose a badge for details</span>
        </h6>
        <div className="warehouse-chip-list warehouse-dialog-option-badges">
          {state.selected.map((name) => (
            <button
              type="button"
              key={name}
              aria-expanded={detail === name}
              onClick={() => setDetail(detail === name ? null : name)}
            >
              {name}
            </button>
          ))}
          {state.stasisPods > 0 && (
            <button type="button" onClick={() => setDetail("Stasis Pod")}>
              Stasis Pod ×{state.stasisPods}
            </button>
          )}
        </div>
        {detail && (
          <div className="warehouse-dialog-option-detail">
            <h6>{detail}</h6>
            <p>{warehouseDescriptions[detail]}</p>
          </div>
        )}
        <p className="warehouse-dialog-note">
          The gateway uses{" "}
          {state.selected.includes("Portal")
            ? "Portal instead of the default key-and-door method"
            : "the default key-and-door method"}
          . Utilities and facilities exist only inside the Warehouse unless
          stated otherwise.
        </p>
      </section>
    </div>
  );
}

const realityModes = {
  upfront: "Upfront",
  incremental: "Incremental",
  unlimited: "Unlimited",
  reasonable: "Reasonable",
  therehouse: "Therehouse",
} as const;
function RealitySummary({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { reality: state },
    dispatch,
  } = useSupplementState();
  const jumpName = CurrentJumpName();
  const currentJump = useContext(CurrentJumpEntryContext);
  const jumpAttribution = `${jumpName} · Jump ${currentJump.number}`;
  const [detail, setDetail] = useState<string | null>(null);
  const all = Object.values(personalRealityCategories).flat();
  const initial = {
    upfront: 1500,
    incremental: 500,
    unlimited: 0,
    reasonable: 3000,
    therehouse: 5000,
  }[state.coreMode];
  const priceAt = (entry: (typeof all)[number], tier: number) =>
    !tier || entry.included
      ? 0
      : (entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ?? 0);
  const initialSpent = all.reduce(
    (sum, entry) => sum + priceAt(entry, state.purchases[entry.id] ?? 0),
    0,
  );
  const progressSpent = all.reduce((sum, entry) => {
    const initialTier = state.purchases[entry.id] ?? 0;
    const targetTier = state.progression.purchases[entry.id] ?? 0;
    return targetTier
      ? sum +
          Math.max(0, priceAt(entry, targetTier) - priceAt(entry, initialTier))
      : sum;
  }, 0);
  const remaining = initial - initialSpent - progressSpent;
  const byId = new Map(all.map((entry) => [entry.id, entry]));
  const owned = (id: string) =>
    Boolean(state.purchases[id] || state.progression.purchases[id]);
  const capabilities: Record<
    "space" | "facilities" | "services",
    [string, string, string][]
  > = { space: [], facilities: [], services: [] };
  const addCapability = (
    group: keyof typeof capabilities,
    id: string,
    fallbackName?: string,
    fallbackCopy?: string,
  ) => {
    if (!owned(id) && !fallbackName) return;
    const entry = byId.get(id);
    capabilities[group].push([
      entry?.name ?? fallbackName ?? id,
      entry?.summary ?? fallbackCopy ?? "Included with every Personal Reality.",
      state.progression.purchases[id] ? jumpAttribution : "Starting Reality",
    ]);
  };
  addCapability(
    "space",
    "starting-space",
    "Starting Space",
    "The free starting storage volume.",
  );
  addCapability(
    "space",
    "access-key",
    "Access Key",
    "A persistent key opens the Reality.",
  );
  addCapability("space", "playing-portals");
  addCapability("space", "additional-space");
  addCapability("space", "lofty-loft");
  addCapability("services", "power");
  addCapability("services", "pipes");
  addCapability("services", "central-control");
  addCapability("facilities", "medical-bay");
  addCapability("facilities", "housing-complex");
  addCapability("facilities", "library");
  addCapability("facilities", "garage");
  const shownCapabilities = capabilities[state.dialogFilter];
  const detailCopy = new Map<string, string>([
    ["Main Warehouse", "The free starting storage volume."],
    ["Entrance Hall", "The free controlled arrival area."],
    [
      "Lofty Loft",
      byId.get("lofty-loft")?.summary ??
        "A housing area inside the Personal Reality.",
    ],
    ...shownCapabilities.map(
      ([name, copy, provenance]) =>
        [name, `${copy} Acquired: ${provenance}.`] as [string, string],
    ),
  ]);
  return (
    <div className="reality-dialog-body">
      <aside>
        <div className="reality-mode-badge">
          <button type="button" aria-describedby="reality-mode-tooltip">
            {realityModes[state.coreMode].slice(0, 2).toUpperCase()}
          </button>
          <span id="reality-mode-tooltip" role="tooltip">
            {realityModes[state.coreMode]} Core Mode controls starting and
            progression WP.
          </span>
        </div>
        <h5>{realityModes[state.coreMode]} Mode</h5>
        <span>Accumulated Reality</span>
        <dl>
          <div>
            <dt>Current WP</dt>
            <dd>{remaining}</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>64,000 m³</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>
              {owned("playing-portals") ? "Portals and key" : "Access Key"}
            </dd>
          </div>
          <div>
            <dt>Upgrades</dt>
            <dd>
              {new Set([
                ...Object.entries(state.purchases)
                  .filter(([, tier]) => tier > 0)
                  .map(([id]) => id),
                ...Object.entries(state.progression.purchases)
                  .filter(([, tier]) => tier > 0)
                  .map(([id]) => id),
              ]).size + 14}
            </dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("personal-reality")}>
          Open starting Reality
        </button>
      </aside>
      <section>
        <div className="reality-dialog-heading">
          <div>
            <p>Accumulated configuration</p>
            <h5>Morgan’s Personal Reality</h5>
          </div>
          <span>Regular Jump</span>
        </div>
        <div className="reality-floorplan">
          <button type="button" onClick={() => setDetail("Main Warehouse")}>
            <strong>Main Warehouse</strong>
            <span>64,000 m³</span>
          </button>
          {owned("lofty-loft") && (
            <button type="button" onClick={() => setDetail("Lofty Loft")}>
              <strong>Lofty Loft</strong>
              <span>Housing area</span>
            </button>
          )}
          <button type="button" onClick={() => setDetail("Entrance Hall")}>
            <strong>Entrance Hall</strong>
            <span>Primary access</span>
          </button>
        </div>
        <div
          className="reality-dialog-filters"
          role="group"
          aria-label="Filter Personal Reality capabilities"
        >
          {(["space", "facilities", "services"] as const).map((filter) => (
            <button
              type="button"
              key={filter}
              aria-pressed={state.dialogFilter === filter}
              onClick={() => {
                setDetail(null);
                dispatch({ type: "reality", update: { dialogFilter: filter } });
              }}
            >
              {filter === "space"
                ? "Space & access"
                : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        <div className="reality-dialog-capabilities">
          {shownCapabilities.map(([name, copy, provenance]) => (
            <button
              type="button"
              key={name}
              aria-expanded={detail === name}
              title={`${copy} Acquired: ${provenance}.`}
              onClick={() => setDetail(detail === name ? null : name)}
            >
              {name}
            </button>
          ))}
          {!shownCapabilities.length && (
            <p className="reality-empty">
              No accumulated capabilities in this category.
            </p>
          )}
        </div>
        {detail && (
          <div className="reality-dialog-detail">
            <strong>{detail}</strong>
            <p>{detailCopy.get(detail)}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function RealityProgress({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { reality: state },
    dispatch,
  } = useSupplementState();
  const jumpName = CurrentJumpName();
  const currentJump = useContext(CurrentJumpEntryContext);
  const jumpAttribution = `${jumpName} · Jump ${currentJump.number}`;
  const p = state.progression;
  const entries = personalRealityCategories[p.category] ?? [];
  const all = Object.values(personalRealityCategories).flat();
  const initial = {
    upfront: 1500,
    incremental: 500,
    unlimited: 0,
    reasonable: 3000,
    therehouse: 5000,
  }[state.coreMode];
  const award = realityModeAward(state.coreMode, p.award);
  const conversion =
    state.coreMode === "unlimited" ? p.conversionCP : p.conversionCP / 25;
  const costAt = (entry: (typeof all)[number], tier: number) =>
    !tier || entry.included
      ? 0
      : (entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ?? 0);
  const initialSpent = all.reduce(
    (sum, entry) => sum + costAt(entry, state.purchases[entry.id] ?? 0),
    0,
  );
  const spent = all.reduce((sum, entry) => {
    const target = p.purchases[entry.id] ?? 0;
    const current = state.purchases[entry.id] ?? 0;
    return target
      ? sum + Math.max(0, costAt(entry, target) - costAt(entry, current))
      : sum;
  }, 0);
  const balance = initial - initialSpent + award + conversion - spent;
  return (
    <div className="reality-progression-body">
      <aside>
        <p>Net WP change</p>
        <strong>{award + conversion - spent} WP</strong>
        <dl>
          <div>
            <dt>Mode award</dt>
            <dd>{award} WP</dd>
          </div>
          <div>
            <dt>CP conversion</dt>
            <dd>{conversion} WP</dd>
          </div>
          <div>
            <dt>WP spent here</dt>
            <dd>{spent} WP</dd>
          </div>
          <div>
            <dt>Jump CP spent</dt>
            <dd>{p.conversionCP} CP</dd>
          </div>
          <div>
            <dt>Current WP</dt>
            <dd>{balance} WP</dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("personal-reality")}>
          Open starting Reality
        </button>
      </aside>
      <section>
        <div className="reality-progress-heading">
          <div>
            <p>Selected Jump record</p>
            <h5>WP sources and purchases</h5>
          </div>
          <span>{realityModes[state.coreMode]} Core Mode</span>
        </div>
        <article className="reality-progress-panel">
          <div>
            <strong>Core Mode award</strong>
            <small>
              {state.coreMode === "incremental"
                ? "Incremental Mode makes 50 WP available for this Jump record."
                : "The selected mode provides no per-Jump WP award here."}
            </small>
          </div>
          <button
            type="button"
            disabled={state.coreMode !== "incremental"}
            aria-pressed={p.award}
            onClick={() =>
              dispatch({ type: "realityProgress", update: { award: !p.award } })
            }
          >
            {p.award
              ? "50 WP recorded"
              : state.coreMode === "incremental"
                ? "Record 50 WP"
                : "No award"}
          </button>
        </article>
        <div className="reality-progress-section">
          <h6>
            Convert <CurrentJumpName /> CP to WP
          </h6>
          <p>Outside Unlimited Mode, every 50 CP converts to 2 WP.</p>
          <div
            className="reality-conversion-options"
            role="group"
            aria-label="CP to WP conversion"
          >
            {([0, 50, 100] as const).map((cp) => (
              <button
                type="button"
                key={cp}
                aria-pressed={p.conversionCP === cp}
                onClick={() =>
                  dispatch({
                    type: "realityProgress",
                    update: { conversionCP: cp },
                  })
                }
              >
                <strong>{cp ? `${cp} CP` : "None"}</strong>
                <span>
                  {cp} CP · +{state.coreMode === "unlimited" ? cp : cp / 25} WP
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="reality-progress-section reality-spend-section">
          <div>
            <h6>
              Spend WP in <CurrentJumpName />
            </h6>
            <span>{balance} WP available</span>
          </div>
          <p>
            Completed purchases remain attributed to <CurrentJumpName />.
          </p>
          <div className="reality-spend-tools">
            <label>
              <span>Category</span>
              <select
                value={p.category}
                onChange={(event) =>
                  dispatch({
                    type: "realityProgress",
                    update: { category: event.target.value, search: "" },
                  })
                }
              >
                {Object.keys(personalRealityCategories).map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Find</span>
              <input
                type="search"
                placeholder="Find an upgrade"
                value={p.search}
                onChange={(event) =>
                  dispatch({
                    type: "realityProgress",
                    update: { search: event.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="reality-progress-purchases">
            {entries
              .filter(
                (entry) =>
                  !entry.included &&
                  `${entry.name} ${entry.summary}`
                    .toLowerCase()
                    .includes(p.search.toLowerCase()),
              )
              .map((entry) => {
                const acquiredTier = p.purchases[entry.id] ?? 0;
                const currentTier = state.purchases[entry.id] ?? 0;
                const targetTier = acquiredTier || currentTier + 1;
                const maximum =
                  !acquiredTier && targetTier > entry.costs.length;
                const cost = acquiredTier
                  ? Math.max(
                      0,
                      costAt(entry, acquiredTier) - costAt(entry, currentTier),
                    )
                  : maximum
                    ? 0
                    : Math.max(
                        0,
                        costAt(entry, targetTier) - costAt(entry, currentTier),
                      );
                const capped = state.coreMode === "reasonable" && cost > 100;
                return (
                  <article
                    className={`reality-progress-purchase ${acquiredTier ? "is-acquired" : ""}`}
                    key={entry.id}
                  >
                    <div>
                      <strong>
                        {entry.name}{" "}
                        {roman(Math.min(targetTier, entry.costs.length))}
                      </strong>
                      <span>{entry.summary}</span>
                      <em>
                        {acquiredTier
                          ? `Acquired in ${jumpAttribution}`
                          : maximum
                            ? "Maximum purchase reached"
                            : capped
                              ? "Blocked by Reasonable Mode’s 100 WP cap"
                              : `${cost} WP · next purchase`}
                      </em>
                    </div>
                    <button
                      type="button"
                      disabled={
                        !acquiredTier && (maximum || capped || cost > balance)
                      }
                      onClick={() =>
                        dispatch({
                          type: "realityProgress",
                          update: {
                            purchases: {
                              ...p.purchases,
                              [entry.id]: acquiredTier ? 0 : targetTier,
                            },
                          },
                        })
                      }
                    >
                      {acquiredTier
                        ? "Remove"
                        : maximum
                          ? "Maximum"
                          : `Buy · ${cost} WP`}
                    </button>
                  </article>
                );
              })}
          </div>
        </div>
      </section>
    </div>
  );
}

const udsDialogRequirements: Record<string, string> = {
  "no-insurance": "ready-access",
  "hotter-water": "hot-water",
  "super-hot": "hotter-water",
};
const udsDialogConflicts: Record<string, readonly string[]> = {
  "random-chan": ["pseudo-random"],
  "pseudo-random": ["random-chan"],
  "two-player": ["all-by-yourself"],
  "ready-access": ["no-access"],
  "no-access": ["limited-access", "ready-access", "no-insurance"],
  "setting-amnesia": ["total-amnesia"],
  "total-amnesia": ["setting-amnesia"],
};
const udsNoHiatus = new Set([
  "two-player",
  "no-access",
  "not-so-ooc",
  "oath-truth",
  "oath-humility",
  "npc-blues",
]);
function UdsSummary({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { uds: state },
    dispatch,
  } = useSupplementState();
  const jumpName = CurrentJumpName();
  const currentJump = useContext(CurrentJumpEntryContext);
  const gauntlet = useContext(CurrentGauntletContext);
  const base = gauntlet ? 0 : 1000;
  const value = (id: string) =>
    universalDrawbacks.find((entry) => entry.id === id)?.costs[0] ?? 0;
  const chain = state.chain.reduce(
    (sum, id) => sum + (state.hiatus.includes(id) ? -2 * value(id) : value(id)),
    0,
  );
  const jump = state.jump.reduce((sum, id) => sum + value(id), 0);
  const active = [
    ...state.chain.map((id) => ({ id, scope: "chain" as const })),
    ...state.jump.map((id) => ({ id, scope: "jump" as const })),
  ];
  const shown = active.filter(
    ({ scope }) => state.dialogFilter === "all" || state.dialogFilter === scope,
  );
  const toggleHiatus = (id: string) => {
    if (udsNoHiatus.has(id)) return;
    dispatch({
      type: "uds",
      update: { hiatus: toggleValue(state.hiatus, id) },
    });
  };
  const toggleJump = (id: string) => {
    if (state.jump.includes(id)) {
      const removed = new Set([id]);
      for (const selected of state.jump)
        if (removed.has(udsDialogRequirements[selected])) removed.add(selected);
      dispatch({
        type: "uds",
        update: {
          jump: state.jump.filter((selected) => !removed.has(selected)),
        },
      });
      return;
    }
    const next = new Set(state.jump);
    let requirement = udsDialogRequirements[id];
    while (requirement) {
      next.add(requirement);
      requirement = udsDialogRequirements[requirement];
    }
    next.add(id);
    dispatch({ type: "uds", update: { jump: [...next] } });
  };
  return (
    <div className="uds-dialog-body">
      <aside>
        <p>Budget adjustment</p>
        <strong>
          {chain + jump >= 0 ? "+" : ""}
          {chain + jump} CP
        </strong>
        <dl>
          <div>
            <dt>Chain CP</dt>
            <dd>+{chain}</dd>
          </div>
          <div>
            <dt>Single-Jump CP</dt>
            <dd>+{jump}</dd>
          </div>
          <div>
            <dt>Restricted CP</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>Active effects</dt>
            <dd>{active.length - state.hiatus.length}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("universal-drawbacks")}>
          Open chain setup
        </button>
      </aside>
      <section>
        <div className="uds-dialog-heading">
          <div>
            <p>Calculated for Jump {currentJump.number}</p>
            <h5>Active rules and budget</h5>
          </div>
          <span>No conflicts</span>
        </div>
        <div className="uds-budget-equation">
          Base <strong>{base}</strong> + Chain <strong>{chain}</strong> + Single{" "}
          <strong>{jump}</strong> = <b>{base + chain + jump} CP</b>
        </div>
        <div className="uds-dialog-filters">
          {[
            ["all", "All effects"],
            ["chain", "Chain"],
            ["jump", "This Jump"],
            ["choose", "Choose for this Jump"],
            ["conflict", "Conflicts"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={state.dialogFilter === id}
              onClick={() =>
                dispatch({
                  type: "uds",
                  update: { dialogFilter: id as typeof state.dialogFilter },
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {state.dialogFilter === "choose" ? (
          <div className="uds-jump-chooser">
            <label className="uds-jump-search">
              <span>Find a Single-Jump Drawback</span>
              <input
                type="search"
                placeholder="Name, effect, or restriction"
                value={state.jumpSearch}
                onChange={(event) =>
                  dispatch({
                    type: "uds",
                    update: { jumpSearch: event.target.value },
                  })
                }
              />
            </label>
            <div className="uds-jump-choice-list">
              {universalDrawbacks
                .filter(
                  (entry) =>
                    !state.chain.includes(entry.id) &&
                    entry.costs[0] > 0 &&
                    `${entry.name} ${entry.summary}`
                      .toLowerCase()
                      .includes(state.jumpSearch.toLowerCase()),
                )
                .map((entry) => (
                  <article
                    className={`uds-jump-choice ${state.jump.includes(entry.id) ? "is-selected" : ""}`}
                    key={entry.id}
                  >
                    <div>
                      <strong>{entry.name}</strong>
                      <span>{entry.summary}</span>
                      <small>+{entry.costs[0]} CP</small>
                    </div>
                    <button
                      type="button"
                      className={
                        state.jump.includes(entry.id) ? "is-active" : ""
                      }
                      aria-pressed={state.jump.includes(entry.id)}
                      disabled={
                        !state.jump.includes(entry.id) &&
                        (udsDialogConflicts[entry.id] ?? []).some((id) =>
                          [...state.chain, ...state.jump].includes(id),
                        )
                      }
                      onClick={() => toggleJump(entry.id)}
                    >
                      {state.jump.includes(entry.id)
                        ? "Remove from this Jump"
                        : "Add to this Jump"}
                    </button>
                  </article>
                ))}
            </div>
          </div>
        ) : state.dialogFilter === "conflict" ? (
          <p className="uds-empty">
            No native or Universal Drawback conflicts were detected for Arcane
            Realms.
          </p>
        ) : (
          <div className="uds-effect-list">
            {shown.map(({ id, scope }) => {
              const entry = universalDrawbacks.find((item) => item.id === id);
              if (!entry) return null;
              const hiatus = state.hiatus.includes(id);
              return (
                <article className="uds-effect" key={`${scope}-${id}`}>
                  <button type="button" className="uds-effect-open">
                    <span>
                      <strong>{entry.name}</strong>
                      <small>
                        {hiatus
                          ? `On hiatus for ${jumpName}; effect resumes next Jump.`
                          : entry.summary}
                      </small>
                    </span>
                    <em>
                      {scope === "chain"
                        ? hiatus
                          ? "Chain · hiatus"
                          : "Chain"
                        : "This Jump"}
                    </em>
                    <b>
                      {hiatus ? `${-2 * entry.costs[0]}` : `+${entry.costs[0]}`}{" "}
                      CP
                    </b>
                  </button>
                  {scope === "chain" && (
                    <div className="uds-hiatus">
                      <span>
                        {hiatus
                          ? `Hiatus recorded for ${jumpName} only.`
                          : `Hiatus changes this Jump’s balance by -${entry.costs[0] * 3} CP.`}
                      </span>
                      <button
                        type="button"
                        disabled={udsNoHiatus.has(id)}
                        aria-pressed={hiatus}
                        onClick={() => toggleHiatus(id)}
                      >
                        {hiatus
                          ? "Resume here"
                          : udsNoHiatus.has(id)
                            ? "No hiatus"
                            : "Use hiatus"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function QuestSummary({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { quest: state },
    dispatch,
  } = useSupplementState();
  const [name, setName] = useState("");
  const [award, setAward] = useState<100 | 200 | 400 | 600>(100);
  const drawbackRows = [
    [
      "drawback-oathbound",
      "Work off: Oathbound",
      200,
      "Resolve the binding oath through significant in-setting effort.",
    ],
    [
      "drawback-mana-static",
      "Work off: Mana Static",
      100,
      "Overcome the interference affecting Morgan’s magic.",
    ],
  ] as const;
  const all = [
    ...questRows,
    ...(state.rules.includes("switching")
      ? state.switching.map(
          (quest) =>
            [
              quest.id,
              quest.name,
              quest.award,
              "Switching-out objective declared for this Jump.",
            ] as const,
        )
      : []),
    ...(state.rules.includes("drawback") ? drawbackRows : []),
  ];
  const checked = new Set(state.checked);
  const questEarned = all
    .filter(([id]) => checked.has(id) && !id.startsWith("drawback-"))
    .reduce((sum, [, , value]) => sum + value, 0);
  const drawbackEarned = state.rules.includes("drawback")
    ? drawbackRows
        .filter(([id]) => checked.has(id))
        .reduce((sum, [, , value]) => sum + value, 0)
    : 0;
  const earned = questEarned + drawbackEarned;
  const completed = all.filter(([id]) => checked.has(id)).length;
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    dispatch({
      type: "quest",
      update: {
        switching: [
          ...state.switching,
          { id: `switching-${Date.now()}`, name: name.trim(), award },
        ],
      },
    });
    setName("");
  };
  return (
    <div className="quest-dialog-body">
      <aside>
        <p>Available this Jump</p>
        <strong>{earned} CP</strong>
        <dl>
          <div>
            <dt>Starting CP</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>Drawback CP</dt>
            <dd>{drawbackEarned}</dd>
          </div>
          <div>
            <dt>Quest CP</dt>
            <dd>{questEarned}</dd>
          </div>
        </dl>
        <div
          className="quest-dialog-rule-status"
          aria-label="Optional rule status"
        >
          <span
            className={state.rules.includes("drawback") ? "" : "is-disabled"}
          >
            <i aria-hidden="true" />
            Drawback Quests{" "}
            <b>{state.rules.includes("drawback") ? "On" : "Off"}</b>
          </span>
          <span
            className={state.rules.includes("switching") ? "" : "is-disabled"}
          >
            <i aria-hidden="true" />
            Switching Out Quests{" "}
            <b>{state.rules.includes("switching") ? "On" : "Off"}</b>
          </span>
        </div>
        <div className="quest-completion-count">
          <span>{completed}</span>
          <small>quests complete</small>
        </div>
        <button type="button" onClick={() => openPage("quest-mode")}>
          Open full Quest Mode
        </button>
      </aside>
      <section>
        <div className="quest-dialog-heading">
          <div>
            <p>Current-Jump checklist</p>
            <h5>Choose completed quests</h5>
          </div>
          <span>Awards update immediately</span>
        </div>
        <div className="quest-tier-filters">
          {([0, 100, 200, 400, 600] as const).map((filter) => (
            <button
              type="button"
              key={filter}
              aria-pressed={state.filter === filter}
              onClick={() => dispatch({ type: "quest", update: { filter } })}
            >
              {filter ? `${filter} CP` : "All"}
            </button>
          ))}
        </div>
        <div className="quest-checklist">
          {questRows
            .filter(([, , value]) => !state.filter || value === state.filter)
            .map(([id, label, value, copy]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={checked.has(id)}
                  onChange={() =>
                    dispatch({
                      type: "quest",
                      update: { checked: toggleValue(state.checked, id) },
                    })
                  }
                />
                <span>
                  <strong>{label}</strong>
                  <small>{copy}</small>
                </span>
                <b>{value} CP</b>
              </label>
            ))}
          {state.rules.includes("drawback") && (
            <div className="quest-special-section">
              <div>
                <strong>Selected drawbacks</strong>
                <small>Work them off to receive their withheld CP.</small>
              </div>
              {drawbackRows
                .filter(
                  ([, , value]) => !state.filter || value === state.filter,
                )
                .map(([id, label, value, copy]) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={checked.has(id)}
                      onChange={() =>
                        dispatch({
                          type: "quest",
                          update: { checked: toggleValue(state.checked, id) },
                        })
                      }
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{copy}</small>
                    </span>
                    <b>{value} CP</b>
                  </label>
                ))}
            </div>
          )}
          {state.rules.includes("switching") && (
            <div className="quest-special-section">
              <div>
                <strong>
                  <CurrentJumpName /> switching-out quests
                </strong>
                <small>Added only to this Jump’s quest list.</small>
              </div>
              <form id="quest-custom-form" onSubmit={add}>
                <label>
                  <span>Quest</span>
                  <input
                    aria-label="Switching-out quest name"
                    placeholder="Describe the objective"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  <span>Award</span>
                  <select
                    aria-label="Switching-out quest award"
                    value={award}
                    onChange={(event) =>
                      setAward(Number(event.target.value) as typeof award)
                    }
                  >
                    {[100, 200, 400, 600].map((value) => (
                      <option key={value} value={value}>
                        {value} CP
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Add quest</button>
              </form>
              <div id="quest-custom-list">
                {state.switching
                  .filter(
                    (quest) => !state.filter || quest.award === state.filter,
                  )
                  .map((quest) => (
                    <label key={quest.id}>
                      <input
                        type="checkbox"
                        checked={checked.has(quest.id)}
                        onChange={() =>
                          dispatch({
                            type: "quest",
                            update: {
                              checked: toggleValue(state.checked, quest.id),
                            },
                          })
                        }
                      />
                      <span>
                        <strong>{quest.name}</strong>
                        <small>
                          Switching-out objective declared for this Jump.
                        </small>
                      </span>
                      <b>{quest.award} CP</b>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
        <p className="quest-dialog-note">
          Checking a quest records the user’s declaration of completion.
          Purchases may help, but never check it automatically.
        </p>
      </section>
    </div>
  );
}

type StoryTokenType = "bold" | "italic" | "underline" | "strike" | "color";
const storyTokenPattern =
  /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|\+\+[^+\n]+?\+\+|\*[^*\n]+?\*|\{\{#[0-9a-fA-F]{6}\|[^}\n]+?\}\})/g;

function storySegments(source: string) {
  const segments: { type: StoryTokenType | "plain"; raw: string }[] = [];
  let cursor = 0;
  for (const match of source.matchAll(storyTokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      segments.push({ type: "plain", raw: source.slice(cursor, index) });
    const raw = match[0];
    const type: StoryTokenType = raw.startsWith("**")
      ? "bold"
      : raw.startsWith("~~")
        ? "strike"
        : raw.startsWith("++")
          ? "underline"
          : raw.startsWith("{{")
            ? "color"
            : "italic";
    segments.push({ type, raw });
    cursor = index + raw.length;
  }
  if (cursor < source.length || !segments.length)
    segments.push({ type: "plain", raw: source.slice(cursor) });
  return segments;
}

function storyTokenParts(type: StoryTokenType, raw: string) {
  if (type === "color") {
    const divider = raw.indexOf("|");
    return {
      open: raw.slice(0, divider + 1),
      content: raw.slice(divider + 1, -2),
      close: "}}",
      color: raw.slice(2, divider),
    };
  }
  const length = type === "italic" ? 1 : 2;
  return {
    open: raw.slice(0, length),
    content: raw.slice(length, -length),
    close: raw.slice(-length),
    color: "",
  };
}

function createStoryToken(
  type: StoryTokenType,
  content: string,
  open: string,
  close: string,
  color = "",
) {
  const tag =
    type === "bold"
      ? "strong"
      : type === "italic"
        ? "em"
        : type === "underline"
          ? "u"
          : type === "strike"
            ? "s"
            : "span";
  const token = document.createElement(tag);
  token.className = "story-rich-token";
  token.dataset.storyTokenType = type;
  token.dataset.storyTokenOpen = open;
  token.dataset.storyTokenClose = close;
  token.textContent = content;
  if (type === "color" && /^#[0-9a-fA-F]{6}$/.test(color))
    token.style.color = color;
  return token;
}

function renderStoryEditorMarkup(target: HTMLElement, source: string) {
  target.replaceChildren(
    ...storySegments(source).map((segment) => {
      if (segment.type === "plain") return document.createTextNode(segment.raw);
      const parts = storyTokenParts(segment.type, segment.raw);
      return createStoryToken(
        segment.type,
        parts.content,
        parts.open,
        parts.close,
        parts.color,
      );
    }),
  );
}

function serializeStoryNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.classList.contains("story-rich-token"))
    return `${node.dataset.storyTokenOpen ?? ""}${node.textContent ?? ""}${node.dataset.storyTokenClose ?? ""}`;
  if (node.tagName === "BR") return "\n";
  const content = [...node.childNodes].map(serializeStoryNode).join("");
  return ["DIV", "P"].includes(node.tagName) ? `${content}\n` : content;
}

function serializeStoryEditor(editor: HTMLElement) {
  return [...editor.childNodes]
    .map(serializeStoryNode)
    .join("")
    .replace(/\n$/, "");
}

function StoryRichEditor({
  source,
  label,
  index,
  onChange,
  onTrackSelection,
  onKeyboardFormat,
}: {
  source: string;
  label: string;
  index: number;
  onChange: (source: string) => void;
  onTrackSelection: (editor: HTMLElement) => void;
  onKeyboardFormat: (type: StoryTokenType) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const renderedSource = useRef("");

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || renderedSource.current === source) return;
    renderStoryEditorMarkup(editor, source);
    renderedSource.current = source;
  }, [source]);

  return (
    <div
      ref={editorRef}
      className="story-rich-editor"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-story-chapter-editor={index}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      onFocus={(event) => onTrackSelection(event.currentTarget)}
      onClick={(event) => onTrackSelection(event.currentTarget)}
      onKeyUp={(event) => onTrackSelection(event.currentTarget)}
      onInput={(event) => {
        const next = serializeStoryEditor(event.currentTarget);
        renderedSource.current = next;
        onChange(next);
        onTrackSelection(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const formats: Partial<Record<string, StoryTokenType>> = {
          b: "bold",
          i: "italic",
          u: "underline",
          x: "strike",
        };
        const format = formats[event.key.toLowerCase()];
        if (!format) return;
        event.preventDefault();
        onTrackSelection(event.currentTarget);
        onKeyboardFormat(format);
      }}
    />
  );
}

function StoryEditor({ openPage }: Pick<Props, "openPage">) {
  const {
    state: { story: state },
    dispatch,
  } = useSupplementState();
  const currentJump = useContext(CurrentJumpEntryContext);
  const jump = state.jumps.find((item) => item.id === currentJump.id) ?? {
    id: currentJump.id,
    name: "Current Jump",
    chapters: [],
  };
  const writerRef = useRef<HTMLElement>(null);
  const activeEditor = useRef<HTMLElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const pendingSaveChapter = useRef<number | null>(null);
  const [draggedChapter, setDraggedChapter] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    chapterId: string;
    edge: DropEdge;
  } | null>(null);
  const [deleteChapter, setDeleteChapter] = useState<StoryChapter | null>(null);

  const update = (index: number, patch: Partial<StoryChapter>) =>
    dispatch({
      type: "story",
      update: {
        jumps: state.jumps.map((item) =>
          item.id !== jump.id
            ? item
            : {
                ...item,
                chapters: item.chapters.map((chapter, i) =>
                  i === index ? { ...chapter, ...patch } : chapter,
                ),
              },
        ),
      },
    });

  const trackSelection = useCallback((editor: HTMLElement) => {
    activeEditor.current = editor;
    writerRef.current
      ?.querySelectorAll(".story-rich-token.is-source")
      .forEach((token) => token.classList.remove("is-source"));
    const selection = document.getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode))
      return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
    const anchor =
      selection.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (selection.anchorNode as Element)
        : selection.anchorNode?.parentElement;
    const token = anchor?.closest?.(".story-rich-token");
    if (token && editor.contains(token)) token.classList.add("is-source");
  }, []);

  useEffect(() => {
    const updateActiveToken = () => {
      if (activeEditor.current) trackSelection(activeEditor.current);
    };
    document.addEventListener("selectionchange", updateActiveToken);
    return () =>
      document.removeEventListener("selectionchange", updateActiveToken);
  }, [trackSelection]);

  useEffect(() => {
    if (!state.saved) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "story", update: { saved: "" } }),
      2500,
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, state.saved]);

  const formatSelection = useCallback((type: StoryTokenType, color = "") => {
    const editor = activeEditor.current;
    const range = savedRange.current?.cloneRange();
    if (!editor || !range || !editor.contains(range.commonAncestorContainer))
      return;
    const definition =
      type === "color"
        ? { open: `{{${color}|`, close: "}}" }
        : type === "bold"
          ? { open: "**", close: "**" }
          : type === "italic"
            ? { open: "*", close: "*" }
            : type === "underline"
              ? { open: "++", close: "++" }
              : { open: "~~", close: "~~" };
    const selected = range.extractContents().textContent || "text";
    const token = createStoryToken(
      type,
      selected,
      definition.open,
      definition.close,
      color,
    );
    token.classList.add("is-source");
    range.insertNode(token);
    const selection = document.getSelection();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(token);
    nextRange.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    editor.focus();
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, []);

  const add = () => {
    const index = jump.chapters.length;
    let serial = 1;
    while (
      jump.chapters.some(
        (chapter) => chapter.id === `${jump.id}:chapter-${serial}`,
      )
    )
      serial += 1;
    dispatch({
      type: "story",
      update: {
        jumps: state.jumps.map((item) =>
          item.id !== jump.id
            ? item
            : {
                ...item,
                chapters: [
                  ...item.chapters,
                  {
                    id: `${jump.id}:chapter-${serial}`,
                    title: "",
                    source: "",
                  },
                ],
              },
        ),
        editingChapter: `${jump.id}:${index}`,
        saved: "Saved",
      },
    });
    window.setTimeout(
      () =>
        writerRef.current
          ?.querySelector<HTMLElement>(`[data-story-chapter-editor="${index}"]`)
          ?.focus(),
      0,
    );
  };

  const reorder = (chapterId: string, targetIndex: number) => {
    const from = jump.chapters.findIndex((chapter) => chapter.id === chapterId);
    if (from < 0 || from === targetIndex) return;
    const chapters = [...jump.chapters];
    const [chapter] = chapters.splice(from, 1);
    chapters.splice(
      Math.max(0, Math.min(targetIndex, chapters.length)),
      0,
      chapter,
    );
    dispatch({
      type: "story",
      update: {
        jumps: state.jumps.map((item) =>
          item.id === jump.id ? { ...item, chapters } : item,
        ),
        editingChapter: null,
        saved: "Saved",
      },
    });
  };

  const removeConfirmedChapter = () => {
    if (!deleteChapter) return;
    dispatch({
      type: "story",
      update: {
        jumps: state.jumps.map((item) =>
          item.id === jump.id
            ? {
                ...item,
                chapters: item.chapters.filter(
                  (chapter) => chapter.id !== deleteChapter.id,
                ),
              }
            : item,
        ),
        editingChapter: null,
        saved: "Saved",
      },
    });
    setDeleteChapter(null);
  };

  return (
    <div className="story-dialog-body">
      <aside>
        <p>Current story</p>
        <strong>Jump {currentJump.number}</strong>
        <span>
          <CurrentJumpName />
        </span>
        <dl>
          <div>
            <dt>Words</dt>
            <dd>{storyWordCount(state, jump.id)}</dd>
          </div>
          <div>
            <dt>Chapters</dt>
            <dd>{jump.chapters.length}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => openPage("story")}>
          Open full Story
        </button>
      </aside>
      <section className="story-writer" ref={writerRef}>
        <div
          className="story-toolbar"
          role="toolbar"
          aria-label="Story formatting"
          onBlur={() =>
            window.setTimeout(() => {
              if (
                pendingSaveChapter.current === null ||
                writerRef.current
                  ?.querySelector(".story-toolbar")
                  ?.contains(document.activeElement)
              )
                return;
              dispatch({
                type: "story",
                update: { saved: "Saved", editingChapter: null },
              });
              pendingSaveChapter.current = null;
            }, 0)
          }
        >
          {(
            [
              ["bold", "Bold", <strong key="bold">B</strong>],
              ["italic", "Italic", <em key="italic">I</em>],
              ["underline", "Underline", <u key="underline">U</u>],
              ["strike", "Strikethrough", <s key="strike">S</s>],
            ] as const
          ).map(([format, label, content]) => (
            <button
              key={format}
              type="button"
              aria-label={label}
              data-story-format={format}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => formatSelection(format)}
            >
              {content}
            </button>
          ))}
          <label>
            <span>Color</span>
            <input
              type="color"
              aria-label="Text color"
              defaultValue="#74d8a1"
              onChange={(event) =>
                formatSelection("color", event.currentTarget.value)
              }
            />
          </label>
        </div>
        <div
          className="story-editor-chapters"
          aria-label="Jump story chapters"
          onDragLeave={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              setDropIndicator(null);
          }}
        >
          {jump.chapters.map((chapter, index) => (
            <article
              className={`story-chapter-editor${draggedChapter === chapter.id ? " is-dragging" : ""}${dropIndicator?.chapterId === chapter.id ? ` is-drop-${dropIndicator.edge}` : ""}`}
              key={chapter.id}
              draggable
              onDragStart={(event) => {
                setDraggedChapter(chapter.id);
                setDropIndicator(null);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", chapter.id);
              }}
              onDragOver={(event) => {
                if (!draggedChapter || draggedChapter === chapter.id) {
                  if (draggedChapter) setDropIndicator(null);
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const edge = dropEdgeAtPointer(
                  event.clientY,
                  event.currentTarget.getBoundingClientRect(),
                );
                setDropIndicator((current) =>
                  current?.chapterId === chapter.id && current.edge === edge
                    ? current
                    : { chapterId: chapter.id, edge },
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedChapter && draggedChapter !== chapter.id) {
                  const fromIndex = jump.chapters.findIndex(
                    (item) => item.id === draggedChapter,
                  );
                  const edge = dropEdgeAtPointer(
                    event.clientY,
                    event.currentTarget.getBoundingClientRect(),
                  );
                  reorder(
                    draggedChapter,
                    dropIndexForTarget(fromIndex, index, edge, "forward"),
                  );
                }
                setDraggedChapter(null);
                setDropIndicator(null);
              }}
              onDragEnd={() => {
                setDraggedChapter(null);
                setDropIndicator(null);
              }}
              onBlur={(event) => {
                const card = event.currentTarget;
                window.setTimeout(() => {
                  if (card.contains(document.activeElement)) return;
                  if (
                    writerRef.current
                      ?.querySelector(".story-toolbar")
                      ?.contains(document.activeElement)
                  ) {
                    pendingSaveChapter.current = index;
                    return;
                  }
                  const editor =
                    card.querySelector<HTMLElement>(".story-rich-editor");
                  if (editor)
                    renderStoryEditorMarkup(
                      editor,
                      serializeStoryEditor(editor),
                    );
                  dispatch({
                    type: "story",
                    update: { saved: "Saved", editingChapter: null },
                  });
                }, 0);
              }}
            >
              <div className="story-chapter-edge">
                <span
                  className="story-chapter-handle"
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <button
                  type="button"
                  className="story-chapter-remove"
                  aria-label={`Remove chapter ${index + 1}`}
                  onClick={() => setDeleteChapter(chapter)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <header>
                <input
                  aria-label={`Chapter ${index + 1} title`}
                  placeholder="Untitled chapter"
                  value={chapter.title}
                  onChange={(event) =>
                    update(index, { title: event.target.value })
                  }
                />
              </header>
              <StoryRichEditor
                source={chapter.source}
                label={`Chapter ${index + 1} text`}
                index={index}
                onChange={(source) => update(index, { source })}
                onTrackSelection={(editor) => {
                  dispatch({
                    type: "story",
                    update: { editingChapter: `arcane:${index}` },
                  });
                  trackSelection(editor);
                }}
                onKeyboardFormat={formatSelection}
              />
            </article>
          ))}
        </div>
        <footer>
          <span role="status" aria-live="polite">
            {state.saved}
          </span>
          <button type="button" onClick={add}>
            + Add chapter
          </button>
        </footer>
        {deleteChapter && (
          <div className="story-chapter-confirm-layer">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="story-delete-chapter-heading"
            >
              <h5 id="story-delete-chapter-heading">Remove chapter?</h5>
              <p>
                Are you sure you want to remove “
                {deleteChapter.title || "Untitled chapter"}”?
              </p>
              <div>
                <button type="button" onClick={() => setDeleteChapter(null)}>
                  Cancel
                </button>
                <button type="button" onClick={removeConfirmedChapter}>
                  Remove chapter
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function ParityDialogContent({ tool, close, openPage, embedded }: Props) {
  const jumpName = useContext(CurrentJumpNameContext);
  if (tool === "essential")
    return (
      <Modal
        title="Essential Body Mod at a glance"
        kicker={`${jumpName} · Current-Jump projection`}
        className="essential-dialog-mock"
        onClose={close}
        embedded={embedded}
      >
        <EssentialSummary openPage={openPage} />
      </Modal>
    );
  if (tool === "essential-progress")
    return (
      <Modal
        title="Essential Body Mod progression"
        kicker={`${jumpName} · Morgan`}
        className="essential-progression-mock"
        onClose={close}
        embedded={embedded}
      >
        <EssentialProgress openPage={openPage} />
      </Modal>
    );
  if (tool === "warehouse")
    return (
      <Modal
        title="Warehouse at a glance"
        kicker={`${jumpName} · Persistent space`}
        className="warehouse-dialog-mock"
        onClose={close}
        embedded={embedded}
      >
        <WarehouseSummary openPage={openPage} />
      </Modal>
    );
  if (tool === "reality")
    return (
      <Modal
        title="Personal Reality at a glance"
        kicker={`${jumpName} · Persistent space`}
        className="reality-dialog-mock"
        onClose={close}
        embedded={embedded}
      >
        <RealitySummary openPage={openPage} />
      </Modal>
    );
  if (tool === "reality-progress")
    return (
      <Modal
        title="Personal Reality progression"
        kicker={`${jumpName} · Morgan`}
        className="reality-progression-mock"
        onClose={close}
        embedded={embedded}
      >
        <RealityProgress openPage={openPage} />
      </Modal>
    );
  if (tool === "drawbacks")
    return (
      <Modal
        title="Universal Drawbacks this Jump"
        kicker={`${jumpName} · Morgan`}
        className="uds-dialog-mock"
        onClose={close}
        embedded={embedded}
      >
        <UdsSummary openPage={openPage} />
      </Modal>
    );
  if (tool === "quests")
    return (
      <Modal
        title="Quest progress"
        kicker={`${jumpName} · Morgan`}
        className="quest-dialog-mock"
        onClose={close}
        embedded={embedded}
      >
        <QuestSummary openPage={openPage} />
      </Modal>
    );
  return (
    <Modal
      title={`Story · ${jumpName}`}
      kicker="Current-Jump chapter editor"
      className="story-dialog-mock"
      onClose={close}
      embedded={embedded}
    >
      <StoryEditor openPage={openPage} />
    </Modal>
  );
}

export function ParityDialog(props: Props) {
  return (
    <CurrentJumpNameContext.Provider value={props.jumpName ?? "Arcane Realms"}>
      <CurrentJumpEntryContext.Provider
        value={{
          id: props.jumpEntryId ?? "entry-1",
          number: props.jumpNumber ?? 2,
        }}
      >
        <CurrentGauntletContext.Provider value={Boolean(props.gauntlet)}>
          <ParityDialogContent {...props} />
        </CurrentGauntletContext.Provider>
      </CurrentJumpEntryContext.Provider>
    </CurrentJumpNameContext.Provider>
  );
}
