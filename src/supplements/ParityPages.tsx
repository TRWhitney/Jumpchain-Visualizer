import { useRef } from "react";
import { useSupplementState } from "./useSupplementState";
import {
  essentialPageCategories as essentialCategories,
  essentialEssences,
  personalRealityPageCategories as personalRealityCategories,
  udsCategories,
  universalDrawbacksPage as universalDrawbacks,
} from "./catalogs";
import { purchaseTotal, storyWordCount, toggleValue } from "./supplementState";
import type { CatalogEntry } from "./model";
import {
  questRows,
  warehouseCost,
  warehouseGroups,
  warehouseLabel,
} from "./parityData";
import { translate } from "../localization";

const title = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const roman = (value: number) =>
  ["", "I", "II", "III", "IV", "V"][value] ?? String(value);

function PurchaseRows({
  entries,
  search,
  purchases,
  onChange,
  prefix,
  detail,
  onDetail,
  costFor,
  badgesFor,
  tierFor,
  lockedTierFor,
}: {
  entries: readonly CatalogEntry[];
  search: string;
  purchases: Record<string, number>;
  onChange: (id: string, tier: number) => void;
  prefix: "essential" | "reality";
  detail: string | null;
  onDetail: (id: string) => void;
  costFor?: (entry: CatalogEntry, tier: number) => number;
  badgesFor?: (entry: CatalogEntry, tier: number) => readonly string[];
  tierFor?: (entry: CatalogEntry, selectedTier: number) => number;
  lockedTierFor?: (entry: CatalogEntry) => number;
}) {
  const shown = entries.filter((entry) =>
    `${entry.name} ${entry.summary}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div
      className={`${prefix}-${prefix === "essential" ? "perk" : "purchase"}-list`}
    >
      {shown.map((entry) => {
        const selectedTier = purchases[entry.id] ?? 0;
        const tier = tierFor?.(entry, selectedTier) ?? selectedTier;
        return (
          <article
            className={`${prefix}-${prefix === "essential" ? "perk" : "purchase"}-row ${tier || entry.included ? "is-owned" : ""}`}
            key={entry.id}
          >
            <div
              className={`${prefix}-${prefix === "essential" ? "perk" : "purchase"}-copy`}
              tabIndex={0}
              role="button"
              aria-expanded={detail === entry.id}
              onClick={() => onDetail(entry.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onDetail(entry.id);
                }
              }}
            >
              <strong>{entry.name}</strong>
              {badgesFor?.(entry, tier).map((badge) => (
                <em key={badge}>{badge}</em>
              ))}
              {!!entry.requires?.length && (
                <em>
                  {translate("ui.parityPages.text.requires")}
                  {entry.requires.join(", ")}
                </em>
              )}
              <span>{entry.summary}</span>
            </div>
            <select
              aria-label={`${entry.name} ${prefix === "essential" ? "tier" : "level"}`}
              value={entry.included ? 1 : tier}
              disabled={prefix === "reality" && entry.included}
              onChange={(event) =>
                onChange(entry.id, Number(event.target.value))
              }
            >
              <option value="0">
                {translate("ui.parityPages.text.notSelected")}
              </option>
              {entry.costs.map((_, index) => (
                <option
                  key={index}
                  value={index + 1}
                  disabled={
                    prefix === "essential" &&
                    index + 1 <=
                      Math.max(
                        entry.included ? 1 : 0,
                        lockedTierFor?.(entry) ?? 0,
                      )
                  }
                >
                  {entry.included
                    ? "Included"
                    : entry.costs.length === 1
                      ? "Selected"
                      : prefix === "essential"
                        ? `Tier ${roman(index + 1)}`
                        : `Purchase ${index + 1}`}
                </option>
              ))}
            </select>
            <span
              className={`${prefix}-${prefix === "essential" ? "perk" : "purchase"}-cost`}
            >
              {tier || entry.included
                ? (costFor?.(entry, tier) ??
                    entry.costs[Math.max(0, tier - 1)] ??
                    0) < 0
                  ? `+${Math.abs(costFor?.(entry, tier) ?? entry.costs[Math.max(0, tier - 1)] ?? 0)} ${entry.destination}`
                  : (costFor?.(entry, tier) ??
                        entry.costs[Math.max(0, tier - 1)] ??
                        0) === 0
                    ? "Free"
                    : `${costFor?.(entry, tier) ?? entry.costs[Math.max(0, tier - 1)]} ${entry.destination}`
                : "—"}
            </span>
            {detail === entry.id && (
              <div
                className={`${prefix}-${prefix === "essential" ? "perk" : "purchase"}-detail`}
              >
                {entry.summary}
                {!!entry.requires?.length &&
                  ` Requires ${entry.requires.join(", ")}.`}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

const essentialSetup = [
  [
    "Starting Mode",
    "startingMode",
    [
      ["heroic", "Heroic · 500 EP"],
      ["standard", "Standard · 100 EP"],
      ["hardcore", "Hardcore · 0 EP"],
    ],
    "Sets the initial EP pool.",
  ],
  [
    "Essence Mode",
    "essenceMode",
    [
      ["single", "Single Essence"],
      ["dual", "Dual Essence"],
      ["multi", "Multi-Essence"],
      ["none", "No Essence"],
    ],
    "Controls how many Essences may be selected.",
  ],
  [
    "Advancement Mode",
    "advancementMode",
    [
      ["standard", "Standard"],
      ["heroic", "Heroic · 50 EP per Jump"],
      ["meteoric", "Meteoric · 100 EP per Jump"],
      ["questing", "Questing"],
    ],
    "Controls EP gained as the chain advances.",
  ],
  [
    "EP Access Mode",
    "accessMode",
    [
      ["standard", "Standard Access"],
      ["lesser", "Lesser Access"],
      ["none", "No Access"],
    ],
    "Controls access to EP-granting Jump purchases.",
  ],
  [
    "Limiter",
    "limiter",
    [
      ["none", "None"],
      ["everyday", "Everyday Hero"],
      ["street", "Street Level"],
      ["mid", "Mid Level"],
      ["bodymod", "Body Mod"],
      ["scaling-1", "Scaling I"],
      ["scaling-2", "Scaling II"],
      ["vanishing", "Vanishing"],
    ],
    "Restricts the cost or category of available purchases.",
  ],
] as const;

const essentialCategoryInfo: Record<
  string,
  { kicker: string; heading: string; copy: string }
> = {
  basic: {
    kicker: "Available to everyone",
    heading: "Basic perks",
    copy: "Free refinements and interface options that cannot be discounted.",
  },
  physical: {
    kicker: "Base-form catalog",
    heading: "Physical perks",
    copy: "Physical capabilities remain available in Gauntlets.",
  },
  mental: {
    kicker: "Base-form catalog",
    heading: "Mental perks",
    copy: "Senses, reactions, cognition, resistance, empathy, and presence.",
  },
  spiritual: {
    kicker: "Base-form catalog",
    heading: "Spiritual perks",
    copy: "Soul, corruption, resolve, and supernatural-resource resilience.",
  },
  skills: {
    kicker: "Base-form catalog",
    heading: "Skill perks",
    copy: "Broad mastery categories with four learning tiers.",
  },
  supernatural: {
    kicker: "Outside the Gauntlet baseline",
    heading: "Supernatural abilities",
    copy: "These purchases do not function in Gauntlets under the source rules.",
  },
  items: {
    kicker: "Persistent equipment",
    heading: "Item perks",
    copy: "Fiat protection, integration, annexation, and import behavior.",
  },
  companions: {
    kicker: "Companion integration",
    heading: "Companion perks",
    copy: "Transfer EP and extend Essential Body Modification benefits to companions.",
  },
  drawbacks: {
    kicker: "Chain-long complications",
    heading: "Drawbacks",
    copy: "Selected drawbacks provide EP and persist wherever they reasonably apply.",
  },
};

export function EssentialParityPage() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const {
    state: { essential: state },
    dispatch,
  } = useSupplementState();
  const essentialEntries = Object.values(essentialCategories).flat();
  const warlordDiscounts = new Set([
    "physical-perfection",
    "physical-resilience",
    "regeneration",
    "heightened-senses",
    "heightened-reactions",
    "mental-prowess",
    "mental-resistance",
    "strategic-mastery",
    "leadership-mastery",
    "martial-mastery",
  ]);
  const warlordGrants = new Set([
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
  const hasWarlord = state.essences.includes("Warlord");
  const spent = essentialEntries.reduce((sum, entry) => {
    const tier = state.purchases[entry.id] ?? 0;
    if (
      !tier ||
      entry.included ||
      (hasWarlord && tier <= 1 && warlordGrants.has(entry.id))
    )
      return sum;
    const cost = entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ?? 0;
    return (
      sum +
      (hasWarlord && warlordDiscounts.has(entry.id) && cost > 0
        ? cost === 50
          ? 0
          : cost / 2
        : cost)
    );
  }, 0);
  const noEssenceBonus =
    state.essenceMode === "none"
      ? ({ heroic: 500, standard: 400, hardcore: 250 }[state.startingMode] ?? 0)
      : 0;
  const balance =
    ({ heroic: 500, standard: 100, hardcore: 0 }[state.startingMode] ?? 100) +
    noEssenceBonus -
    spent;
  const set = (
    update: Parameters<typeof dispatch>[0] extends never
      ? never
      : Partial<typeof state>,
  ) => dispatch({ type: "essential", update });
  const counts: Record<string, string> = {
    setup: "4 modes",
    essences: `${state.essences.length} selected`,
    basic: "Free refinements",
    physical: "2 owned",
    mental: "2 owned",
    spiritual: "1 owned",
    skills: "3 owned",
    supernatural: "0 owned",
    items: "0 owned",
    companions: "0 owned",
    drawbacks: "0 EP",
  };
  const categories = [
    "setup",
    "essences",
    "basic",
    "physical",
    "mental",
    "spiritual",
    "skills",
    "supernatural",
    "items",
    "companions",
    "drawbacks",
  ];
  const categoryInfo = essentialCategoryInfo[state.category];
  return (
    <div
      className="essential-full-mock"
      aria-label={translate(
        "ui.parityPages.ariaLabel.interactiveEssentialBodyModificationFullSupplementPage",
      )}
    >
      <header>
        <div>
          <p>{translate("ui.parityPages.text.foundationSupplement")}</p>
          <h4>{translate("ui.parityPages.text.essentialBodyModification")}</h4>
          <span>{translate("ui.parityPages.text.sourceEdition100Morgan")}</span>
        </div>
        <div className="essential-balance">
          <span>{translate("ui.parityPages.text.initialEPRemaining")}</span>
          <output className={balance < 0 ? "is-negative" : ""}>
            {balance} {translate("ui.parityPages.text.ep")}
          </output>
        </div>
      </header>
      <div className="essential-full-body">
        <aside>
          <p>{translate("ui.parityPages.text.build")}</p>
          <nav
            id="essential-category-nav"
            aria-label={translate(
              "ui.parityPages.ariaLabel.essentialBodyModificationCategories",
            )}
          >
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                aria-pressed={state.category === category}
                onClick={() => {
                  set({ category, search: "", detail: null });
                  workspaceRef.current?.scrollTo({ top: 0 });
                }}
              >
                <strong>{title(category)}</strong>
                <small>{counts[category] ?? "0 owned"}</small>
              </button>
            ))}
          </nav>
        </aside>
        <section className="essential-workspace">
          <header>
            <div>
              <p>
                {state.category === "setup"
                  ? "Build rules"
                  : state.category === "essences"
                    ? "Build identity"
                    : categoryInfo?.kicker}
              </p>
              <h5>{categoryInfo?.heading ?? title(state.category)}</h5>
              <span>
                {state.category === "setup"
                  ? "Choose the four permanent Modes, optional variants, and a limiter."
                  : state.category === "essences"
                    ? "Choose the Essence or Essences that shape discounts and free purchases."
                    : categoryInfo?.copy}
              </span>
            </div>
            {!["setup", "essences"].includes(state.category) && (
              <label>
                <span>{translate("ui.parityPages.text.findInCategory")}</span>
                <input
                  type="search"
                  spellCheck={false}
                  placeholder={translate(
                    "ui.parityPages.placeholder.findAPerkOrAbility",
                  )}
                  value={state.search}
                  onChange={(event) => set({ search: event.target.value })}
                />
              </label>
            )}
          </header>
          <div className="essential-workspace-content" ref={workspaceRef}>
            {state.category === "setup" ? (
              <>
                <div className="essential-setup-grid">
                  {essentialSetup.map(([label, key, options, copy]) => (
                    <label className="essential-mode-field" key={key}>
                      <span>{label}</span>
                      <select
                        value={state[key]}
                        onChange={(event) => {
                          const value = event.target.value;
                          const update: Partial<typeof state> = {
                            [key]: value,
                          };
                          if (key === "essenceMode") {
                            const limit =
                              value === "none"
                                ? 0
                                : value === "single"
                                  ? 1
                                  : value === "dual"
                                    ? 2
                                    : 3;
                            update.essences = state.essences.slice(0, limit);
                          }
                          set(update);
                          if (
                            key === "advancementMode" &&
                            !["heroic", "meteoric"].includes(value)
                          )
                            dispatch({
                              type: "essentialProgress",
                              update: { advancement: false },
                            });
                          if (
                            key === "accessMode" &&
                            (value === "none" ||
                              (value === "lesser" &&
                                state.progression.infusion === "greater"))
                          )
                            dispatch({
                              type: "essentialProgress",
                              update: { infusion: "none" },
                            });
                        }}
                      >
                        {options.map(([value, text]) => (
                          <option key={value} value={value}>
                            {text}
                          </option>
                        ))}
                      </select>
                      <p>{copy}</p>
                    </label>
                  ))}
                </div>
                <section className="essential-setup-group">
                  <h6>
                    {translate(
                      "ui.parityPages.text.variantsAndAccessModifiers",
                    )}
                  </h6>
                  <div className="essential-toggle-list">
                    {[
                      [
                        "cumulative",
                        "Cumulative access",
                        "Bank unused EP-purchase opportunities.",
                      ],
                      [
                        "retroactive",
                        "Retroactive cumulative",
                        "Count qualifying Jumps completed before enabling this supplement.",
                      ],
                      [
                        "training",
                        "Training allowance",
                        "Train base-form ranks when Standard Advancement and No Access are selected.",
                      ],
                      [
                        "tempered",
                        "Tempered by Suffering",
                        "Receive EP for qualifying Gauntlets completed before adoption.",
                      ],
                    ].map(([id, name, copy]) => (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={state.variants.includes(id)}
                          onChange={() =>
                            set({ variants: toggleValue(state.variants, id) })
                          }
                        />
                        <span>
                          <strong>{name}</strong>
                          <small>{copy}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              </>
            ) : state.category === "essences" ? (
              <>
                <div className="essential-essence-grid">
                  {essentialEssences.map(([essence, description]) => (
                    <button
                      type="button"
                      key={essence}
                      aria-pressed={state.essences.includes(essence)}
                      onClick={() => {
                        const limit =
                          state.essenceMode === "none"
                            ? 0
                            : state.essenceMode === "single"
                              ? 1
                              : state.essenceMode === "dual"
                                ? 2
                                : 3;
                        const toggled = toggleValue(state.essences, essence);
                        set({
                          essences:
                            limit === 0
                              ? []
                              : state.essences.includes(essence)
                                ? toggled
                                : limit === 1
                                  ? [essence]
                                  : state.essences.length < limit
                                    ? toggled
                                    : state.essences,
                          essenceDetail: essence,
                        });
                      }}
                    >
                      <strong>{essence}</strong>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
                <section className="essential-essence-detail">
                  <strong>
                    {translate("ui.parityPages.text.essenceOfThe")}
                    {state.essenceDetail}
                  </strong>
                  <p>
                    {essentialEssences.find(
                      ([name]) => name === state.essenceDetail,
                    )?.[1] ?? "Select an Essence to inspect it."}{" "}
                    {translate(
                      "ui.parityPages.text.itDiscountsEverySourcePerkMarkedForThisEssence",
                    )}
                  </p>
                </section>
              </>
            ) : (
              <PurchaseRows
                prefix="essential"
                entries={essentialCategories[state.category] ?? []}
                search={state.search}
                purchases={state.purchases}
                detail={state.detail}
                onDetail={(id) =>
                  set({ detail: state.detail === id ? null : id })
                }
                costFor={(entry, tier) => {
                  if (
                    !tier ||
                    entry.included ||
                    (hasWarlord && tier <= 1 && warlordGrants.has(entry.id))
                  )
                    return 0;
                  const cost =
                    entry.costs[Math.min(tier - 1, entry.costs.length - 1)] ??
                    0;
                  return hasWarlord &&
                    warlordDiscounts.has(entry.id) &&
                    cost > 0
                    ? cost === 50
                      ? 0
                      : cost / 2
                    : cost;
                }}
                badgesFor={(entry) => [
                  ...(hasWarlord && warlordDiscounts.has(entry.id)
                    ? ["Essence discount"]
                    : []),
                ]}
                lockedTierFor={(entry) =>
                  hasWarlord && warlordGrants.has(entry.id) ? 1 : 0
                }
                tierFor={(entry, selectedTier) =>
                  Math.max(
                    selectedTier,
                    hasWarlord && warlordGrants.has(entry.id) ? 1 : 0,
                  )
                }
                onChange={(id, tier) =>
                  set({ purchases: { ...state.purchases, [id]: tier } })
                }
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function WarehouseParityPage() {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    state: { warehouse: state },
    dispatch,
  } = useSupplementState();
  const set = (update: Partial<typeof state>) =>
    dispatch({ type: "warehouse", update });
  const remaining = 150 - warehouseCost(state.selected, state.stasisPods);
  const toggle = (name: string, requires?: string) => {
    if (requires && !state.selected.includes(requires)) return;
    let selected = toggleValue(state.selected, name);
    if (name === "Portal" && !selected.includes("Portal"))
      selected = selected.filter((item) => item !== "Link");
    set({ selected });
  };
  const tabs = [
    ["intro", "Explanation"],
    ["utilities", "Utilities"],
    ["structures", "Structures"],
    ["misc", "Miscellaneous"],
    ["review", "Review"],
  ] as const;
  const count = (group: string) =>
    warehouseGroups[group].filter(([name]) => state.selected.includes(name))
      .length + (group === "misc" && state.stasisPods ? 1 : 0);
  return (
    <div className="warehouse-full-mock">
      <header className="warehouse-full-header">
        <div>
          <p>{translate("ui.parityPages.text.persistentSpaceSupplement")}</p>
          <h4>{translate("ui.parityPages.text.cosmicWarehouse")}</h4>
          <span>
            {translate("ui.parityPages.text.updatedQuicksilverEdition40000Ft²")}
          </span>
        </div>
        <div
          className={`warehouse-budget ${remaining < 0 ? "is-negative" : ""}`}
        >
          <span>{translate("ui.parityPages.text.remaining")}</span>
          <output>
            {remaining} {translate("ui.parityPages.text.wp")}
          </output>
        </div>
      </header>
      <nav
        className="warehouse-full-tabs"
        role="tablist"
        aria-label={translate(
          "ui.parityPages.ariaLabel.cosmicWarehousePageSection",
        )}
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={state.tab === id}
            tabIndex={state.tab === id ? 0 : -1}
            onClick={() => {
              set({ tab: id });
              panelRef.current?.scrollTo({ top: 0 });
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="warehouse-full-layout">
        <aside className="warehouse-summary">
          <p>{translate("ui.parityPages.text.currentSpace")}</p>
          <div className="warehouse-summary-icon">
            {translate("ui.parityPages.text.cw")}
          </div>
          <h5>
            {state.selected.includes("Free Space") ? "80,000" : "40,000"}{" "}
            {translate("ui.parityPages.text.ft²")}
          </h5>
          <span>
            {state.selected.includes("Portal") ? "Portal access" : "Key access"}
          </span>
          <dl>
            <div>
              <dt>{translate("ui.parityPages.text.utilities")}</dt>
              <dd>{count("utilities")}</dd>
            </div>
            <div>
              <dt>{translate("ui.parityPages.text.structures")}</dt>
              <dd>{count("structures")}</dd>
            </div>
            <div>
              <dt>{translate("ui.parityPages.text.otherUpgrades")}</dt>
              <dd>{count("misc")}</dd>
            </div>
          </dl>
          <div className="warehouse-key-summary">
            <strong>{translate("ui.parityPages.text.entryMethod")}</strong>
            <p>
              {state.selected.includes("Portal")
                ? "Portal on a suitable surface"
                : "Special key and door"}
            </p>
          </div>
        </aside>
        <div className="warehouse-panel-stack" ref={panelRef}>
          {state.tab === "intro" ? (
            <section className="warehouse-panel">
              <p className="warehouse-kicker">
                {translate("ui.parityPages.text.whatThisProvides")}
              </p>
              <h5>
                {translate("ui.parityPages.text.aPersistentStorageDimension")}
              </h5>
              <p>
                {translate(
                  "ui.parityPages.text.theWarehouseIsAChainWideSpaceReachedThrough",
                )}
              </p>
              <div className="warehouse-facts">
                <article>
                  <strong>{translate("ui.parityPages.text.40000Ft²")}</strong>
                  <span>
                    {translate("ui.parityPages.text.updatedStartingFloorArea")}
                  </span>
                </article>
                <article>
                  <strong>{translate("ui.parityPages.text.150WP")}</strong>
                  <span>
                    {translate(
                      "ui.parityPages.text.independentWarehouseBudget",
                    )}
                  </span>
                </article>
                <article>
                  <strong>{translate("ui.parityPages.text.oneGateway")}</strong>
                  <span>
                    {translate("ui.parityPages.text.onlyOneEntranceMayBeOpen")}
                  </span>
                </article>
                <article>
                  <strong>{translate("ui.parityPages.text.timeStops")}</strong>
                  <span>
                    {translate("ui.parityPages.text.whenItsGatewayCloses")}
                  </span>
                </article>
              </div>
              <h6>{translate("ui.parityPages.text.operatingRules")}</h6>
              <ol className="warehouse-rules">
                <li>
                  {translate(
                    "ui.parityPages.text.theGatewayRemainsOpenWhileTheOwnerIsInside",
                  )}
                </li>
                <li>
                  {translate(
                    "ui.parityPages.text.livingPeopleCannotBeStoredInTheClosedWarehouse",
                  )}
                </li>
                <li>
                  {translate(
                    "ui.parityPages.text.visitorsMayEnterWithTheOwnerAndLeaveWhen",
                  )}
                </li>
                <li>
                  {translate(
                    "ui.parityPages.text.timeStopsInsideWheneverTheEntranceCloses",
                  )}
                </li>
                <li>
                  {translate(
                    "ui.parityPages.text.onlyOneWarehouseGatewayMayBeOpenAtOnce",
                  )}
                </li>
              </ol>
            </section>
          ) : state.tab === "review" ? (
            <section className="warehouse-panel">
              <p className="warehouse-kicker">
                {translate("ui.parityPages.text.review")}
              </p>
              <h5>{translate("ui.parityPages.text.yourCosmicWarehouse")}</h5>
              <div className="warehouse-review-cards">
                <article>
                  <span>{translate("ui.parityPages.text.floorArea")}</span>
                  <strong>
                    {state.selected.includes("Free Space")
                      ? "80,000"
                      : "40,000"}{" "}
                    {translate("ui.parityPages.text.ft²")}
                  </strong>
                </article>
                <article>
                  <span>{translate("ui.parityPages.text.access")}</span>
                  <strong>
                    {state.selected.includes("Portal") ? "Portal" : "Key"}
                  </strong>
                </article>
                <article>
                  <span>{translate("ui.parityPages.text.spent")}</span>
                  <strong>
                    {150 - remaining} {translate("ui.parityPages.text.wp")}
                  </strong>
                </article>
              </div>
              <h6>{translate("ui.parityPages.text.installedFeatures")}</h6>
              <div className="warehouse-chip-list">
                {state.selected.map((name) => (
                  <span key={name}>{warehouseLabel(name)}</span>
                ))}
                {state.stasisPods > 0 && (
                  <span>
                    {translate("ui.parityPages.text.stasisPod")}
                    {state.stasisPods}
                  </span>
                )}
              </div>
              <div
                className={`warehouse-review-diagnostic ${remaining < 0 ? "is-negative" : ""}`}
                role="status"
              >
                {remaining < 0
                  ? `Configuration is ${Math.abs(remaining)} WP over budget.`
                  : `Configuration is valid with ${remaining} WP remaining.`}
              </div>
            </section>
          ) : (
            <section className="warehouse-panel">
              <p className="warehouse-kicker">
                {state.tab === "structures"
                  ? "Interior spaces"
                  : state.tab === "misc"
                    ? "Capabilities"
                    : "Facilities"}
              </p>
              <h5>
                {state.tab === "misc" ? "Miscellaneous" : title(state.tab)}
              </h5>
              <p>
                {state.tab === "utilities"
                  ? "Utilities function only inside the Warehouse and cannot be routed into the current world."
                  : state.tab === "structures"
                    ? "Each structure receives at least 2,000 square feet."
                    : "Add access, supplies, space, and storage capabilities."}
              </p>
              <div className="warehouse-option-grid">
                {warehouseGroups[state.tab].map(
                  ([name, cost, copy, requires]) =>
                    name === "Stasis Pod" ? (
                      <article className="warehouse-quantity-option" key={name}>
                        <span>
                          <strong>{warehouseLabel(name)}</strong>
                          <small>
                            {cost} {translate("ui.parityPages.text.wpEach")}
                          </small>
                        </span>
                        <p>{copy}</p>
                        <div>
                          <button
                            type="button"
                            aria-label={translate(
                              "ui.parityPages.ariaLabel.removeStasisPod",
                            )}
                            disabled={!state.stasisPods}
                            onClick={() =>
                              set({
                                stasisPods: Math.max(0, state.stasisPods - 1),
                              })
                            }
                          >
                            −
                          </button>
                          <output>{state.stasisPods}</output>
                          <button
                            type="button"
                            aria-label={translate(
                              "ui.parityPages.ariaLabel.addStasisPod",
                            )}
                            disabled={state.stasisPods >= 4}
                            onClick={() =>
                              set({
                                stasisPods: Math.min(4, state.stasisPods + 1),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </article>
                    ) : (
                      <button
                        type="button"
                        key={name}
                        aria-pressed={state.selected.includes(name)}
                        disabled={Boolean(
                          requires && !state.selected.includes(requires),
                        )}
                        title={
                          requires && !state.selected.includes(requires)
                            ? `Requires ${requires}`
                            : ""
                        }
                        onClick={() => toggle(name, requires)}
                      >
                        <span>
                          <strong>{warehouseLabel(name)}</strong>
                          <small>{cost ? `${cost} WP` : "Free"}</small>
                        </span>
                        <p>{copy}</p>
                      </button>
                    ),
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const modeInfo = {
  upfront: [
    "Upfront",
    "1500 WP initially, three half-price purchase lines, and no later WP awards.",
  ],
  incremental: [
    "Incremental",
    "500 WP initially and a reversible 50 WP record for each Jump or Gauntlet.",
  ],
  unlimited: [
    "Unlimited",
    "0 WP initially and one conversion of up to 100 Jump CP into the same amount of WP.",
  ],
  reasonable: [
    "Reasonable",
    "3000 WP initially, 100 WP every fifth recorded Jump, and a 100 WP purchase cap.",
  ],
  therehouse: [
    "Therehouse",
    "5000 WP initially; the Reality becomes a physical location and grants 200 CP each Jump.",
  ],
} as const;
const realityStart = {
  upfront: 1500,
  incremental: 500,
  unlimited: 0,
  reasonable: 3000,
  therehouse: 5000,
};
export function PersonalRealityParityPage() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const {
    state: { reality: state },
    dispatch,
  } = useSupplementState();
  const set = (update: Partial<typeof state>) =>
    dispatch({ type: "reality", update });
  const categories = [
    "setup",
    "basics",
    "utilities",
    "cosmetic",
    "facilities",
    "extensions",
    "items",
    "companions",
    "misc",
    "limitations",
  ];
  const all = Object.values(personalRealityCategories).flat();
  const balance =
    realityStart[state.coreMode] - purchaseTotal(all, state.purchases);
  const labels: Record<string, string> = {
    setup: "Core and Extra-Modes",
    basics: "14 freebies",
    utilities: "3 selected",
    items: "Free supplies",
    companions: "Rules and upgrades",
    limitations: "0 WP",
  };
  const categoryInfo: Record<string, readonly [string, string, string]> = {
    basics: [
      "Included foundation",
      "Basics",
      "Free features included with every Personal Reality, plus optional additional Realities.",
    ],
    utilities: [
      "Space-wide systems",
      "Utilities and structures",
      "Access, space, utilities, security, and time systems applied across the Reality.",
    ],
    cosmetic: [
      "Appearance and environment",
      "Cosmetic upgrades",
      "Change the presentation, ground, sky, lighting, and environmental theme.",
    ],
    facilities: [
      "Rooms and shared spaces",
      "Personal Reality facilities",
      "Medical, residential, educational, recreational, and operational facilities.",
    ],
    extensions: [
      "Attached domains",
      "Personal Reality extensions",
      "Large additions that may sit inside or outside the primary Reality.",
    ],
    items: [
      "Persistent supplies",
      "Items and equipment",
      "Supplies and collections maintained by the Personal Reality.",
    ],
    companions: [
      "Retinue integration",
      "Companions and the Personal Reality",
      "Housing, grouping, calibration, and companion-focused Reality features.",
    ],
    misc: [
      "Special rules and capabilities",
      "Miscellaneous",
      "Return visits, observation, imports, mini-realities, and unusual functionality.",
    ],
    limitations: [
      "Permanent complications",
      "Limitations",
      "Permanent restrictions that provide WP and override conflicting purchases.",
    ],
  };
  const currentInfo = categoryInfo[state.category];
  return (
    <div className="reality-full-mock">
      <header>
        <div>
          <p>{translate("ui.parityPages.text.persistentSpaceSupplement")}</p>
          <h4>{translate("ui.parityPages.text.personalReality")}</h4>
          <span>{translate("ui.parityPages.text.sourceEdition17Morgan")}</span>
        </div>
        <div className="reality-balance">
          <span>{translate("ui.parityPages.text.initialWPRemaining")}</span>
          <output className={balance < 0 ? "is-negative" : ""}>
            {balance} {translate("ui.parityPages.text.wp")}
          </output>
        </div>
      </header>
      <div className="reality-full-body">
        <aside>
          <p>{translate("ui.parityPages.text.startingReality")}</p>
          <nav
            id="reality-category-nav"
            aria-label={translate(
              "ui.parityPages.ariaLabel.personalRealityCategories",
            )}
          >
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                aria-pressed={state.category === category}
                onClick={() => {
                  set({ category, search: "", detail: null });
                  workspaceRef.current?.scrollTo({ top: 0 });
                }}
              >
                <strong>
                  {category === "items" ? "Items & equipment" : title(category)}
                </strong>
                <small>
                  {labels[category] ??
                    `${(personalRealityCategories[category] ?? []).filter((entry) => (state.purchases[entry.id] ?? 0) > 0).length} selected`}
                </small>
              </button>
            ))}
          </nav>
        </aside>
        <section className="reality-workspace">
          <header>
            <div>
              <p>
                {state.category === "setup"
                  ? "Starting rules"
                  : currentInfo?.[0]}
              </p>
              <h5>{currentInfo?.[1] ?? title(state.category)}</h5>
              <span>
                {state.category === "setup"
                  ? "Choose one Core Mode and any compatible Extra-Modes."
                  : currentInfo?.[2]}
              </span>
            </div>
            {state.category !== "setup" && (
              <label>
                <span>{translate("ui.parityPages.text.findInCategory")}</span>
                <input
                  type="search"
                  spellCheck={false}
                  placeholder={translate(
                    "ui.parityPages.placeholder.findAnUpgrade",
                  )}
                  value={state.search}
                  onChange={(event) => set({ search: event.target.value })}
                />
              </label>
            )}
          </header>
          <div className="reality-workspace-content" ref={workspaceRef}>
            {state.category === "setup" ? (
              <>
                <div className="reality-mode-grid">
                  {Object.entries(modeInfo).map(([id, [name, copy]]) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={state.coreMode === id}
                      onClick={() => {
                        set({ coreMode: id as typeof state.coreMode });
                        dispatch({
                          type: "realityProgress",
                          update: { award: false, conversionCP: 0 },
                        });
                      }}
                    >
                      <strong>
                        {name} {translate("ui.parityPages.text.coreMode")}
                      </strong>
                      <span>{copy}</span>
                    </button>
                  ))}
                </div>
                <section className="reality-extra-group">
                  <h6>{translate("ui.parityPages.text.extraModes")}</h6>
                  <div className="reality-extra-list">
                    {[
                      [
                        "patient",
                        "The Patient Jumper",
                        "Gain 100 WP for each eligible Jump after the first that adoption was delayed.",
                      ],
                      [
                        "swap",
                        "Swap-Out",
                        "Replace an established Warehouse-family build under the source’s chain-length rules.",
                      ],
                      [
                        "crossroads",
                        "Cross-Roads",
                        "Take one unpaid 100 CP drawback in a Jump to add 5 collective WP to the Crossroads Tavern.",
                      ],
                    ].map(([id, name, copy]) => (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={state.extraModes.includes(id)}
                          onChange={() =>
                            set({
                              extraModes: toggleValue(state.extraModes, id),
                            })
                          }
                        />
                        <span>
                          <strong>{name}</strong>
                          <small>{copy}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <PurchaseRows
                prefix="reality"
                entries={personalRealityCategories[state.category] ?? []}
                search={state.search}
                purchases={state.purchases}
                detail={state.detail}
                onDetail={(id) =>
                  set({ detail: state.detail === id ? null : id })
                }
                onChange={(id, tier) =>
                  set({ purchases: { ...state.purchases, [id]: tier } })
                }
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const udsMeta: Record<
  string,
  {
    summary: string;
    chain: number;
    jump?: number;
    category?: string;
    conflicts?: string[];
    requires?: string;
    tags?: string[];
    noHiatus?: boolean;
    noRevoke?: boolean;
  }
> = {
  "without-why": {
    summary:
      "The Jumper does not know they are in a Jumpchain or receive the usual explanatory context.",
    chain: 200,
    category: "chain",
    tags: ["Chain only", "Knowledge restriction"],
  },
  "random-chan": {
    summary:
      "Jump order is generated from a large random pool instead of being freely selected.",
    chain: 200,
    category: "chain",
    conflicts: ["pseudo-random"],
    noRevoke: true,
    tags: ["Chain only", "Cannot revoke"],
  },
  "pseudo-random": {
    summary:
      "The author chooses the route, but the Jumper has no control over the destination or timing.",
    chain: 50,
    conflicts: ["random-chan"],
    tags: ["Chain only", "Alternative"],
  },
  "all-by-yourself": {
    summary:
      "Companions are unavailable for the affected scope and no new long-term companions may join during it.",
    chain: 200,
    category: "companion",
    tags: ["Chain or Single Jump", "Companion restriction"],
  },
  "limited-access": {
    summary:
      "Warehouse access is limited to a periodic interval or qualifying owned property; chaining it also supplies its one-time Warehouse benefit.",
    chain: 100,
    jump: 100,
    category: "warehouse",
    tags: ["Chain or Single Jump", "+10 WP when chained"],
  },
  "economic-impact": {
    summary:
      "Imported wealth affects local economies normally; protections against inflation or disruption no longer erase those consequences.",
    chain: 50,
    jump: 50,
    tags: ["Chain or Single Jump", "General CP"],
  },
  "earlier-beginning": {
    summary: "This Jump begins ten years earlier.",
    chain: 100,
    jump: 100,
  },
  "slot-o-matic": {
    summary: "Only three active power slots remain available.",
    chain: 150,
    jump: 150,
  },
  "two-player": {
    summary:
      "Creates two linked Jumpers with divided budgets and shared chain-failure conditions.",
    chain: 0,
    category: "companion",
    conflicts: ["all-by-yourself"],
    noHiatus: true,
    tags: ["Chain only", "Special value", "No hiatus"],
  },
  "ready-access": {
    summary:
      "Warehouse entrances remain vulnerable to outside intrusion and the protective Force Wall is unavailable.",
    chain: 100,
    jump: 100,
    category: "warehouse",
    conflicts: ["no-access"],
    tags: ["Chain or Single Jump", "Access risk"],
  },
  "no-insurance": {
    summary:
      "Stolen Warehouse contents no longer return automatically; chaining it directs an additional stipend to items.",
    chain: 200,
    jump: 200,
    category: "warehouse",
    requires: "ready-access",
    tags: ["Requires Ready Access", "Restricted item CP"],
  },
  "no-access": {
    summary:
      "The Warehouse cannot be accessed for the affected Jump and incompatible Warehouse drawbacks are unavailable.",
    chain: 300,
    jump: 300,
    category: "warehouse",
    conflicts: ["limited-access", "ready-access", "no-insurance"],
    noHiatus: true,
    tags: ["No hiatus", "Exclusive Warehouse rule"],
  },
  "why-glowing": {
    summary:
      "Out-of-setting CP-backed equipment becomes visibly anomalous; its higher chained option directs the award to items.",
    chain: 100,
    jump: 50,
    category: "warehouse",
    tags: ["Variable award", "Restricted option"],
  },
  "hot-water": {
    summary:
      "The Jump begins at the least desirable non-deadly listed location under an unpleasant insertion.",
    chain: 50,
    jump: 50,
    category: "starting",
    tags: ["Chain or Single Jump", "Starting location"],
  },
  "hotter-water": {
    summary:
      "The bad starting location becomes actively dangerous and harder to escape.",
    chain: 50,
    jump: 50,
    category: "starting",
    requires: "hot-water",
    tags: ["Requires Hot Water", "Upgrade"],
  },
  "super-hot": {
    summary:
      "Each Jump begins in its worst survivable location with a prolonged opening crisis.",
    chain: 100,
    jump: 100,
    category: "starting",
    requires: "hotter-water",
    tags: ["Requires Hotter Water", "Upgrade"],
  },
  "not-so-ooc": {
    summary:
      "Abilities brought from earlier settings acquire local counterparts, awareness, and counters in later settings.",
    chain: 200,
    jump: 100,
    category: "powers",
    noHiatus: true,
    tags: ["200 Chain / 100 Jump", "Cannot hiatus when chained"],
  },
  luckless: {
    summary:
      "Luck perks and equivalent effects cannot benefit the affected actor.",
    chain: 100,
    jump: 100,
    category: "powers",
    tags: ["Companion eligible", "Requires relevant perks for Single Jump"],
  },
  "slow-learner": {
    summary: "Accelerated-learning effects cannot benefit the affected actor.",
    chain: 100,
    jump: 50,
    category: "powers",
    tags: ["100 Chain / 50 Jump", "Companion eligible"],
  },
  "setting-amnesia": {
    summary:
      "Foreknowledge of the current setting and its plot is unavailable while the drawback applies.",
    chain: 200,
    jump: 200,
    category: "setting",
    conflicts: ["total-amnesia"],
    tags: ["Memory restriction", "Alternative line"],
  },
  "total-amnesia": {
    summary:
      "Prior memories, rather than only setting knowledge, become unavailable for the affected Jump.",
    chain: 400,
    jump: 400,
    category: "setting",
    conflicts: ["setting-amnesia"],
    tags: ["Alternative", "Not recommended as Chain"],
  },
  "language-block": {
    summary:
      "Insertion supplies only a small kernel of the common language rather than automatic fluency.",
    chain: 50,
    jump: 50,
    category: "setting",
    tags: ["Chain or Single Jump", "Language"],
  },
  "oath-truth": {
    summary:
      "The actor must not communicate deliberate falsehoods; higher variants also cover misleading omission.",
    chain: 200,
    jump: 100,
    category: "ethos",
    noHiatus: true,
    tags: ["Ethos", "+100 when chained", "Never hiatus"],
  },
  "oath-humility": {
    summary:
      "The actor must not claim credit or accept rewards outside the selected variant’s narrow allowances.",
    chain: 200,
    jump: 100,
    category: "ethos",
    noHiatus: true,
    tags: ["Ethos", "+100 when chained", "Never hiatus"],
  },
  "npc-blues": {
    summary:
      "A punishment-oriented challenge constrains the Jumper to an ordinary working life for a limited run of Jumps.",
    chain: 0,
    category: "challenge",
    noHiatus: true,
    tags: ["Author-selected", "Limited duration", "Special value"],
  },
  jumpseed: {
    summary:
      "Other Jumpers exist in the originating world and return on their own schedules, restructuring the chain’s larger stakes.",
    chain: 200,
    category: "challenge",
    tags: ["Challenge mode", "Chain only"],
  },
};
const udsEntry = (entry: CatalogEntry) => ({
  ...entry,
  ...(udsMeta[entry.id] ?? {
    summary: entry.summary,
    chain: entry.costs[0],
    jump: entry.costs[0],
  }),
});
const udsCategoryInfo: Record<string, readonly [string, string, string]> = {
  chain: [
    "Global setup",
    "Chain Drawbacks",
    "Add or remove effects that apply throughout the chain.",
  ],
  companion: [
    "Companion rules",
    "Companion Drawbacks",
    "Effects on Companions, Followers, or imports apply only where the source explicitly says so.",
  ],
  warehouse: [
    "Persistent possessions",
    "Warehouse & item Drawbacks",
    "Access, storage, equipment, and restricted item-CP effects.",
  ],
  starting: [
    "Insertion rules",
    "Starting-condition Drawbacks",
    "Changes to where, when, or under what pressure a Jump begins.",
  ],
  powers: [
    "Capability restrictions",
    "Power & perk Drawbacks",
    "Restrictions that suppress or complicate accumulated abilities.",
  ],
  setting: [
    "Context and identity",
    "Setting & memory Drawbacks",
    "Changes to setting knowledge, imported context, language, and identity.",
  ],
  ethos: [
    "Behavioral commitments",
    "Ethos Drawbacks",
    "Ethical restrictions with source-specific violation and atonement rules.",
  ],
  challenge: [
    "Fundamental variants",
    "Challenge modes",
    "Author-selected rules that substantially restructure the entire chain.",
  ],
};
export function UdsParityPage() {
  const catalogRef = useRef<HTMLDivElement>(null);
  const {
    state: { uds: state },
    dispatch,
  } = useSupplementState();
  const set = (update: Partial<typeof state>) =>
    dispatch({ type: "uds", update });
  const active = new Set(state.chain);
  const total = state.chain.reduce(
    (sum, id) =>
      sum +
      (udsMeta[id]?.chain ??
        universalDrawbacks.find((e) => e.id === id)?.costs[0] ??
        0),
    0,
  );
  const isBlocked = (id: string) =>
    (udsMeta[id]?.conflicts ?? []).some((conflict) => active.has(conflict));
  const toggleChain = (id: string) => {
    if (active.has(id)) {
      const removed = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const selected of state.chain)
          if (
            !removed.has(selected) &&
            udsMeta[selected]?.requires &&
            removed.has(udsMeta[selected].requires as string)
          ) {
            removed.add(selected);
            changed = true;
          }
      }
      set({
        chain: state.chain.filter((selected) => !removed.has(selected)),
        hiatus: state.hiatus.filter((selected) => !removed.has(selected)),
      });
      return;
    }
    const next = new Set(state.chain);
    let requirement = udsMeta[id]?.requires;
    while (requirement) {
      next.add(requirement);
      requirement = udsMeta[requirement]?.requires;
    }
    next.add(id);
    set({
      chain: [...next],
      jump: state.jump.filter((selected) => selected !== id),
    });
  };
  let entries = universalDrawbacks.filter(
    (entry) =>
      (udsMeta[entry.id]?.category ?? entry.category) === state.category &&
      `${entry.name} ${udsMeta[entry.id]?.summary ?? entry.summary}`
        .toLowerCase()
        .includes(state.search.toLowerCase()),
  );
  if (state.filter === "selected")
    entries = entries.filter((entry) => active.has(entry.id));
  if (state.filter === "available")
    entries = entries.filter(
      (entry) => !active.has(entry.id) && !isBlocked(entry.id),
    );
  entries = [...entries].sort(
    (left, right) => Number(active.has(right.id)) - Number(active.has(left.id)),
  );
  const [categoryKicker, categoryTitle, categoryCopy] =
    udsCategoryInfo[state.category];
  return (
    <div className="uds-full-mock">
      <header>
        <div>
          <p>{translate("ui.parityPages.text.rulesSupplementSJChan")}</p>
          <h4>{translate("ui.parityPages.text.universalDrawbacks")}</h4>
          <span>
            {translate("ui.parityPages.text.sourceEdition112MorganSChain")}
          </span>
        </div>
        <div className="uds-impact">
          <span>{translate("ui.parityPages.text.chainWideAdjustment")}</span>
          <output>
            +{total} {translate("ui.parityPages.text.cp")}
          </output>
        </div>
      </header>
      <div className="uds-full-body">
        <aside>
          <p>{translate("ui.parityPages.text.drawbackFamilies")}</p>
          <nav
            id="uds-category-nav"
            aria-label={translate(
              "ui.parityPages.ariaLabel.universalDrawbackCategories",
            )}
          >
            {udsCategories.map((category) => (
              <button
                type="button"
                key={category}
                aria-pressed={state.category === category}
                onClick={() => {
                  set({ category, detail: null });
                  catalogRef.current?.scrollTo({ top: 0 });
                }}
              >
                <strong>
                  {category === "warehouse"
                    ? "Warehouse & items"
                    : category === "starting"
                      ? "Starting conditions"
                      : category === "powers"
                        ? "Powers & perks"
                        : category === "setting"
                          ? "Setting & memory"
                          : category === "challenge"
                            ? "Challenge modes"
                            : title(category)}
                </strong>
                <small>
                  {
                    universalDrawbacks.filter(
                      (entry) =>
                        (udsMeta[entry.id]?.category ?? entry.category) ===
                          category && active.has(entry.id),
                    ).length
                  }{" "}
                  {translate("ui.parityPages.text.selected")}
                </small>
              </button>
            ))}
          </nav>
        </aside>
        <section className="uds-workspace">
          <header>
            <div>
              <p>{categoryKicker}</p>
              <h5>{categoryTitle}</h5>
              <span>{categoryCopy}</span>
            </div>
            <label>
              <span>{translate("ui.parityPages.text.findDrawbacks")}</span>
              <input
                type="search"
                spellCheck={false}
                placeholder={translate(
                  "ui.parityPages.placeholder.nameEffectOrRestriction",
                )}
                value={state.search}
                onChange={(event) => set({ search: event.target.value })}
              />
            </label>
          </header>
          <div
            className="uds-filter-bar"
            role="group"
            aria-label={translate("ui.parityPages.ariaLabel.catalogFilter")}
          >
            {(["all", "selected", "available"] as const).map((filter) => (
              <button
                type="button"
                key={filter}
                aria-pressed={state.filter === filter}
                onClick={() => set({ filter })}
              >
                {title(filter)}
              </button>
            ))}
          </div>
          <div className="uds-catalog" ref={catalogRef}>
            <div className="uds-catalog-list">
              {entries.map((raw) => {
                const entry = udsEntry(raw);
                const selected = active.has(entry.id);
                const blocked = !selected && isBlocked(entry.id);
                return (
                  <article
                    className={`uds-card ${selected ? "is-selected" : ""}`}
                    key={entry.id}
                  >
                    <div
                      className="uds-card-copy"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        set({
                          detail: state.detail === entry.id ? null : entry.id,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter")
                          set({
                            detail: state.detail === entry.id ? null : entry.id,
                          });
                      }}
                    >
                      <div>
                        <strong>{entry.name}</strong>
                        <b>
                          {entry.chain
                            ? `+${entry.chain} CP chain-wide`
                            : "Special"}
                        </b>
                      </div>
                      <span>{entry.summary}</span>
                      <div className="uds-card-tags">
                        {(entry.tags ?? ["Chain only"]).map((tag) => (
                          <em key={tag}>{tag}</em>
                        ))}
                      </div>
                    </div>
                    <div className="uds-card-actions">
                      <button
                        type="button"
                        aria-pressed={selected}
                        disabled={blocked}
                        title={
                          blocked
                            ? "Unavailable because an incompatible Chain Drawback is active."
                            : ""
                        }
                        onClick={() => toggleChain(entry.id)}
                      >
                        {selected ? "Remove from chain" : "Add to chain"}
                      </button>
                    </div>
                    {state.detail === entry.id && (
                      <div className="uds-card-detail">
                        <strong>
                          {translate("ui.parityPages.text.currentRule")}
                        </strong>{" "}
                        {entry.summary}
                        {entry.requires
                          ? ` Requires ${universalDrawbacks.find((candidate) => candidate.id === entry.requires)?.name ?? entry.requires}.`
                          : ""}
                        {entry.noHiatus
                          ? " This entry cannot be put on hiatus."
                          : ""}
                        {entry.noRevoke ? " This entry cannot be revoked." : ""}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function QuestParityPage() {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    state: { quest: state },
    dispatch,
  } = useSupplementState();
  const set = (update: Partial<typeof state>) =>
    dispatch({ type: "quest", update });
  return (
    <div className="quest-full-mock">
      <header className="quest-full-header">
        <div>
          <p>{translate("ui.parityPages.text.rulesSupplement")}</p>
          <h4>{translate("ui.parityPages.text.questMode")}</h4>
          <span>
            {translate("ui.parityPages.text.chainWideRulesPerJumpProgress")}
          </span>
        </div>
        <div className="quest-mode-status">
          <span>{translate("ui.parityPages.text.startingBalance")}</span>
          <strong>{translate("ui.parityPages.text.0CP")}</strong>
        </div>
      </header>
      <nav
        className="quest-full-tabs"
        role="tablist"
        aria-label={translate("ui.parityPages.ariaLabel.questModePageSection")}
      >
        {[
          ["intro", "Explanation"],
          ["tiers", "Quest tiers"],
          ["rules", "Optional rules"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={state.tab === id}
            onClick={() => {
              set({ tab: id as typeof state.tab });
              panelRef.current?.scrollTo({ top: 0 });
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="quest-full-layout">
        <aside className="quest-summary">
          <p>{translate("ui.parityPages.text.currentRules")}</p>
          <div className="quest-summary-mark">Q</div>
          <h5>{translate("ui.parityPages.text.questModeActive")}</h5>
          <span>
            {state.rules.length}{" "}
            {translate("ui.parityPages.text.optionalRules")}
          </span>
          <dl>
            <div>
              <dt>{translate("ui.parityPages.text.jumpStart")}</dt>
              <dd>{translate("ui.parityPages.text.0CP")}</dd>
            </div>
            <div>
              <dt>{translate("ui.parityPages.text.awardTiers")}</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>{translate("ui.parityPages.text.standardQuests")}</dt>
              <dd>12</dd>
            </div>
          </dl>
        </aside>
        <div className="quest-panel-stack" ref={panelRef}>
          <section className="quest-panel">
            {state.tab === "intro" ? (
              <>
                <p className="quest-kicker">
                  {translate("ui.parityPages.text.howItChangesAJump")}
                </p>
                <h5>
                  {translate("ui.parityPages.text.earnTheBudgetThroughQuests")}
                </h5>
                <p>
                  {translate(
                    "ui.parityPages.text.everyJumpBeginsWithNoOrdinaryStartingCPCompleting",
                  )}
                </p>
                <div className="quest-facts">
                  <article>
                    <strong>{translate("ui.parityPages.text.0CP")}</strong>
                    <span>
                      {translate("ui.parityPages.text.defaultStartingBalance")}
                    </span>
                  </article>
                  <article>
                    <strong>{translate("ui.parityPages.text.100600CP")}</strong>
                    <span>
                      {translate(
                        "ui.parityPages.text.awardedPerCompletedQuest",
                      )}
                    </span>
                  </article>
                  <article>
                    <strong>{translate("ui.parityPages.text.perJump")}</strong>
                    <span>
                      {translate(
                        "ui.parityPages.text.eachEntryTracksItsOwnProgress",
                      )}
                    </span>
                  </article>
                </div>
                <div className="quest-effort-note">
                  <strong>
                    {translate("ui.parityPages.text.effortIsTheRequirement")}
                  </strong>
                  <p>
                    {translate(
                      "ui.parityPages.text.aPerkPowerOriginOrOtherPurchaseCannotComplete",
                    )}
                  </p>
                </div>
              </>
            ) : state.tab === "tiers" ? (
              <>
                <p className="quest-kicker">
                  {translate("ui.parityPages.text.awardStructure")}
                </p>
                <h5>{translate("ui.parityPages.text.standardQuestTiers")}</h5>
                <div className="quest-tier-grid">
                  {[100, 200, 400, 600].map((tier) => (
                    <article key={tier}>
                      <strong>
                        {tier} {translate("ui.parityPages.text.cp")}
                      </strong>
                      <span>
                        {questRows
                          .filter((row) => row[2] === tier)
                          .map((row) => row[1])
                          .join(" · ")}
                      </span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="quest-kicker">
                  {translate("ui.parityPages.text.sourceDefinedVariants")}
                </p>
                <h5>{translate("ui.parityPages.text.optionalRulesHeading")}</h5>
                <div className="quest-rule-list">
                  {[
                    [
                      "drawback",
                      "Drawback Quests",
                      "Treat the special drawback objectives as initial CP sources.",
                    ],
                    [
                      "switching",
                      "Switching Out Quests",
                      "Permit Jump-specific switching-out objectives in the checklist.",
                    ],
                  ].map(([id, name, copy]) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={state.rules.includes(id)}
                      onClick={() =>
                        set({ rules: toggleValue(state.rules, id) })
                      }
                    >
                      <span>
                        <strong>{name}</strong>
                        <small>
                          {state.rules.includes(id) ? "Enabled" : "Disabled"}
                        </small>
                      </span>
                      <p>{copy}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Markup({ source }: { source: string }) {
  const parts = source.split(
    /(\*\*.*?\*\*|~~.*?~~|\+\+.*?\+\+|\*.*?\*|\{\{#[0-9a-fA-F]{6}\|.*?\}\})/g,
  );
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : part.startsWith("~~") ? (
          <s key={index}>{part.slice(2, -2)}</s>
        ) : part.startsWith("*") ? (
          <em key={index}>{part.slice(1, -1)}</em>
        ) : part.startsWith("++") ? (
          <u key={index}>{part.slice(2, -2)}</u>
        ) : part.startsWith("{{") ? (
          <span key={index} style={{ color: part.slice(2, 9) }}>
            {part.slice(10, -2)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
export function StoryMarkup({ source }: { source: string }) {
  return <Markup source={source} />;
}
export function StoryParityPage() {
  const readerRef = useRef<HTMLElement>(null);
  const {
    state: { story: state },
    dispatch,
  } = useSupplementState();
  const set = (update: Partial<typeof state>) =>
    dispatch({ type: "story", update });
  const scrollToStory = (selector: string) =>
    window.requestAnimationFrame(() =>
      readerRef.current
        ?.querySelector<HTMLElement>(selector)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  return (
    <div className="story-full-mock">
      <header>
        <div>
          <p>{translate("ui.parityPages.text.narrativeSupplement")}</p>
          <h4>{translate("ui.parityPages.text.morganSStory")}</h4>
          <span>
            {translate("ui.parityPages.text.3Jumps")}{" "}
            {state.jumps.reduce(
              (sum, jump) =>
                sum +
                jump.chapters.filter((chapter) => chapter.source.trim()).length,
              0,
            )}{" "}
            {translate("ui.parityPages.text.chaptersWritten")}
          </span>
        </div>
      </header>
      <div className="story-full-layout">
        <aside>
          <p>{translate("ui.parityPages.text.oldestToNewest")}</p>
          <nav
            id="story-full-index"
            aria-label={translate(
              "ui.parityPages.ariaLabel.storyJumpAndChapterIndex",
            )}
          >
            {state.jumps.map((jump, index) => (
              <div className="story-index-group" key={jump.id}>
                <button
                  type="button"
                  aria-pressed={state.selectedJump === jump.id}
                  onClick={() => {
                    set({ selectedJump: jump.id, selectedChapter: null });
                    scrollToStory(`[data-story-jump="${jump.id}"]`);
                  }}
                >
                  <span>
                    {translate("ui.parityPages.text.jump")}
                    {index + 1}
                  </span>
                  <strong>{jump.name}</strong>
                  <small>
                    {jump.chapters.length
                      ? `${jump.chapters.length} ${jump.chapters.length === 1 ? "chapter" : "chapters"}`
                      : "No chapters yet"}
                  </small>
                </button>
                <div className="story-chapter-index">
                  {jump.chapters.map((chapter, chapterIndex) => (
                    <button
                      type="button"
                      key={chapter.id}
                      aria-pressed={
                        state.selectedChapter === `${jump.id}:${chapterIndex}`
                      }
                      onClick={() => {
                        set({
                          selectedJump: jump.id,
                          selectedChapter: `${jump.id}:${chapterIndex}`,
                        });
                        scrollToStory(
                          `[data-story-chapter="${jump.id}:${chapterIndex}"]`,
                        );
                      }}
                    >
                      {chapter.title.trim() || "Untitled chapter"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <section className="story-full-reader" ref={readerRef}>
          <div className="story-reader-intro">
            <strong>
              {translate("ui.parityPages.text.oneOrderedStoryForEveryJump")}
            </strong>
            <p>
              {translate(
                "ui.parityPages.text.readEveryChapterHereOrUseSuppStoryTo",
              )}
            </p>
          </div>
          <div id="story-full-chapters">
            {state.jumps.map((jump, index) => (
              <article
                className={`story-full-chapter ${state.selectedJump === jump.id ? "is-targeted" : ""}`}
                data-story-jump={jump.id}
                key={jump.id}
              >
                <header>
                  <span>
                    {translate("ui.parityPages.text.jump")}
                    {index + 1}
                  </span>
                  <h5>{jump.name}</h5>
                  <small>
                    {jump.chapters.length
                      ? `${jump.chapters.length} ${jump.chapters.length === 1 ? "chapter" : "chapters"} · ${storyWordCount(state, jump.id)} words`
                      : "No chapters yet"}
                  </small>
                </header>
                <div className="story-full-copy">
                  {jump.chapters.length ? (
                    jump.chapters.map((chapter, chapterIndex) => (
                      <section
                        className={`story-full-section ${state.selectedChapter === `${jump.id}:${chapterIndex}` ? "is-targeted-chapter" : ""}`}
                        data-story-chapter={`${jump.id}:${chapterIndex}`}
                        key={chapter.id}
                      >
                        <span>
                          {translate("ui.parityPages.text.chapter")}
                          {chapterIndex + 1}
                        </span>
                        <h6>{chapter.title.trim() || "Untitled chapter"}</h6>
                        <p>
                          <Markup source={chapter.source} />
                        </p>
                      </section>
                    ))
                  ) : (
                    <p className="is-empty">
                      {translate(
                        "ui.parityPages.text.openThisJumpAndChooseSuppStoryToAdd",
                      )}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
