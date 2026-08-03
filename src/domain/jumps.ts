import type {
  CanonicalJumpPackage,
  JumpChoice,
  JumpGrant,
  TextBlock,
  Renderable,
} from "../markup";
import {
  implicitNamedBasicChoiceValue,
  namedBasicValueFromChoiceName,
  resolveCostAmount,
} from "../markup";
import { renderRenderable } from "./rendering";
import type {
  ActorEntryState,
  ChainEvaluation,
  EvaluateChainInput,
  EvaluatedActor,
  EvaluatedActorJump,
  EvaluatedChoice,
  EvaluatedCompanion,
  EvaluatedGauntletStatus,
  EvaluatedForm,
  EvaluatedGrantMeasure,
  EvaluatedGrantRecord,
  EvaluatedJumpRuntime,
  EvaluatedProperty,
  EvaluatedResource,
  JumpEntryState,
} from "./evaluationTypes";
import {
  choicePlacement,
  choicePlacementSections,
  choiceStateIsActive,
  choiceWasRolledBySource,
  evaluatedChoiceCosts,
} from "./choiceEvaluation";

export type * from "./evaluationTypes";
export {
  choicesForSource,
  choiceStateIsActive,
  choiceValueIsActive,
} from "./choiceEvaluation";

export {
  evaluateCondition,
  renderRenderable,
  renderRichTextRenderable,
} from "./rendering";

export const emptyActorEntryState = (): ActorEntryState => ({
  choices: {},
  inputs: {},
  sourceSelections: {},
  choiceRolls: {},
  sourceRolls: {},
});

export const emptyJumpEntryState = (): JumpEntryState => ({
  actors: { jumper: emptyActorEntryState() },
  appliedGauntlet: [],
});

function display(value: Renderable | undefined, fallback = "") {
  return value?.base ?? value?.variants[0]?.value ?? fallback;
}

function normalizeTag(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[\s_\p{Dash_Punctuation}]+/gu, "-");
}

type RenderContext = Readonly<
  Record<string, string | number | boolean | undefined>
>;

export function choiceControlRenderContext(
  choice: JumpChoice,
  actorState: Pick<ActorEntryState, "inputs">,
  choiceValue: string | number | boolean | readonly string[] | null | undefined,
): Readonly<Record<string, string | number | boolean>> {
  const entries: [string, string | number | boolean][] = [];
  if (
    typeof choiceValue === "string" ||
    typeof choiceValue === "number" ||
    typeof choiceValue === "boolean"
  )
    entries.push([choice.handle, choiceValue]);
  for (const input of choice.inputs) {
    const value = actorState.inputs[choice.handle]?.[input.handle];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      entries.push([input.handle, value]);
  }
  return Object.fromEntries(entries);
}

function inheritedGrantName(
  choice: JumpChoice,
  item: JumpGrant,
  context?: RenderContext,
) {
  const choiceName = context
    ? renderRenderable(choice.name, context)
    : display(choice.name, choice.handle);
  return item.name
    ? context
      ? renderRenderable(item.name, context)
      : display(item.name, choiceName)
    : choiceName;
}

function inheritedDescription(
  choice: JumpChoice,
  item: JumpGrant,
  context?: RenderContext,
) {
  const resolve = (text: TextBlock | undefined) =>
    text
      ? context
        ? renderRenderable(text.content, context)
        : display(text.content)
      : "";
  return (
    resolve(item.text.find((text) => text.handle === "description")) ||
    resolve(choice.text.find((text) => text.handle === "description")) ||
    `${inheritedGrantName(choice, item, context)} acquired from this Jump.`
  );
}

function jumpGrantName(
  packageItem: CanonicalJumpPackage,
  item: JumpGrant,
  context?: RenderContext,
) {
  const fallback = display(packageItem.name, "Jump grant");
  return item.name
    ? context
      ? renderRenderable(item.name, context)
      : display(item.name, fallback)
    : fallback;
}

function jumpGrantDescription(
  packageItem: CanonicalJumpPackage,
  item: JumpGrant,
  context?: RenderContext,
) {
  const description = item.text.find((text) => text.handle === "description");
  if (description)
    return context
      ? renderRenderable(description.content, context)
      : display(description.content);
  return `${jumpGrantName(packageItem, item, context)} acquired from this Jump.`;
}

function actorRenderContext(
  evaluation: Pick<EvaluatedActorJump, "properties">,
  gauntlet: boolean,
): RenderContext {
  return {
    ...Object.fromEntries(
      Object.entries(evaluation.properties).map(([handle, property]) => [
        handle,
        property?.value,
      ]),
    ),
    gauntlet,
  };
}

function grantMeasure(
  grant: JumpGrant,
  value: string | number | boolean | readonly string[] | null | undefined,
) {
  if (typeof value !== "number") return undefined;
  return {
    kind: grant.measure ?? ("rank" as const),
    value,
  } satisfies EvaluatedGrantMeasure;
}

function grantRenderContext(
  context: RenderContext,
  grant: JumpGrant,
  value: string | number | boolean | readonly string[] | null | undefined,
) {
  const measure = grantMeasure(grant, value);
  if (!measure) return context;
  return {
    ...context,
    [measure.kind === "rank" ? "rank" : "count"]: measure.value,
  };
}

function visibleGrantIsAcquired(
  value: string | number | boolean | readonly string[] | null | undefined,
) {
  return typeof value !== "number" || value > 0;
}

function effectiveGrantHandle(
  choice: JumpChoice,
  grant: JumpGrant,
  grantIndex: number,
  inputHandle?: string,
) {
  if (grant.shorthand) return choice.handle;
  return inputHandle
    ? `${choice.handle}:${inputHandle}:${grantIndex}`
    : `${choice.handle}:${grantIndex}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase();
}

function collectProperties(
  packageItem: CanonicalJumpPackage,
  actorState: ActorEntryState,
  choices: Readonly<Record<string, EvaluatedChoice>>,
) {
  const writers = new Map<
    string,
    { value: string | number | boolean; label: string }[]
  >();
  const write = (
    handle: string,
    value: string | number | boolean,
    label: string,
  ) => {
    const current = writers.get(handle) ?? [];
    current.push({ value, label });
    writers.set(handle, current);
  };
  const originGroups = new Set(["origin", "origins"]);
  const belongsToOriginSource = (choice: JumpChoice) =>
    choice.groups.some((group) => originGroups.has(group)) ||
    packageItem.sections.some((section) =>
      section.sources.some(
        (source) =>
          source.handle === "origin" &&
          source.group !== undefined &&
          choice.groups.includes(source.group),
      ),
    );
  const isReachable = (choice: JumpChoice) =>
    packageItem.sections.some(
      (section) =>
        section.directChoices.some(
          (placement) => placement.target === choice.handle,
        ) ||
        section.sources.some(
          (source) =>
            source.group !== undefined && choice.groups.includes(source.group),
        ),
    );
  for (const choice of packageItem.choices) {
    const evaluation = choices[choice.handle];
    if (!evaluation?.active) continue;
    const implicitReachable = isReachable(choice);
    const originGroupChoice =
      implicitReachable && belongsToOriginSource(choice);
    const explicitPropertyHandles = new Set(
      choice.grants.flatMap((grant) =>
        grant.kind === "property" && grant.handle ? [grant.handle] : [],
      ),
    );
    const choiceName = display(choice.name, choice.handle);
    const implicitValue =
      implicitReachable &&
      choice.handle === "gender" &&
      choice.selection === "select"
        ? evaluation.value
        : implicitReachable &&
            choice.handle === "age" &&
            choice.selection === "integer"
          ? evaluation.value
          : implicitReachable &&
              (choice.handle === "origin" || choice.handle === "location")
            ? implicitNamedBasicChoiceValue(
                choice.handle,
                choice.selection,
                evaluation.value,
                choiceName,
              )
            : originGroupChoice
              ? namedBasicValueFromChoiceName("origin", choiceName)
              : undefined;
    const implicitHandle =
      originGroupChoice || choice.handle === "origin"
        ? "origin"
        : ["gender", "age", "location"].includes(choice.handle)
          ? choice.handle
          : undefined;
    if (
      implicitHandle &&
      !explicitPropertyHandles.has(implicitHandle) &&
      (typeof implicitValue === "string" ||
        typeof implicitValue === "number" ||
        typeof implicitValue === "boolean")
    )
      write(implicitHandle, implicitValue, choiceName);
    for (const item of choice.grants) {
      if (item.kind !== "property" || !item.handle) continue;
      const propertyValue = item.value ?? evaluation.value;
      if (
        typeof propertyValue === "string" ||
        typeof propertyValue === "number" ||
        typeof propertyValue === "boolean"
      )
        write(item.handle, propertyValue, display(choice.name, choice.handle));
    }
    for (const input of choice.inputs) {
      const inputValue = actorState.inputs[choice.handle]?.[input.handle];
      if (typeof inputValue !== "string" && typeof inputValue !== "number")
        continue;
      for (const item of input.grants)
        if (item.kind === "property" && item.handle)
          write(
            item.handle,
            item.value ?? inputValue,
            display(choice.name, choice.handle),
          );
    }
  }
  return writers;
}

function evaluatedSections(
  packageItem: CanonicalJumpPackage,
  choices: Readonly<Record<string, EvaluatedChoice>>,
) {
  const scores = new Map(
    packageItem.sections.map((section) => [
      section.handle,
      section.locked ? 1 : 0,
    ]),
  );
  for (const choice of packageItem.choices) {
    if (!choices[choice.handle]?.active) continue;
    for (const handle of choice.locks ?? [])
      scores.set(handle, (scores.get(handle) ?? 0) + 1);
    for (const handle of choice.unlocks ?? [])
      scores.set(handle, (scores.get(handle) ?? 0) - 1);
  }
  return Object.fromEntries(
    packageItem.sections.map((section) => {
      const lockScore = scores.get(section.handle) ?? 0;
      return [
        section.handle,
        { handle: section.handle, lockScore, locked: lockScore > 0 },
      ];
    }),
  );
}

function roundDiscounted(value: number) {
  return value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);
}

function discountedCost(
  packageItem: CanonicalJumpPackage,
  target: JumpChoice,
  resource: string,
  amount: number,
  choices: Readonly<Record<string, EvaluatedChoice>>,
) {
  const matching = packageItem.choices.flatMap((source) =>
    choices[source.handle]?.active
      ? (source.discounts ?? []).flatMap((discount) =>
          target.groups.includes(discount.group) &&
          (!discount.resources.length || discount.resources.includes(resource))
            ? [{ sourceChoiceHandle: source.handle, ...discount }]
            : [],
        )
      : [],
  );
  if (!matching.length) return { amount, discounts: [] };
  const floor = (value: number) =>
    packageItem.discountFloor === "negative" || amount < 0
      ? value
      : Math.max(0, value);
  const applyPercent = (value: number, percent: number) =>
    value < 0 ? value * (1 + percent / 100) : value * (1 - percent / 100);
  if (packageItem.discountStacking !== "stack") {
    const candidates = matching.map((discount) => {
      const value =
        discount.mode === "flat"
          ? amount - discount.amount
          : applyPercent(amount, discount.amount);
      return { discount, value: floor(value) };
    });
    const winner = candidates.reduce((best, candidate) =>
      candidate.value < best.value ? candidate : best,
    );
    return {
      amount: roundDiscounted(winner.value),
      discounts: [
        {
          sourceChoiceHandle: winner.discount.sourceChoiceHandle,
          mode: winner.discount.mode,
          amount: winner.discount.amount,
        },
      ],
    };
  }
  const flat = matching
    .filter((discount) => discount.mode === "flat")
    .reduce((sum, discount) => sum + discount.amount, 0);
  const percent = matching
    .filter((discount) => discount.mode === "percent")
    .reduce((sum, discount) => sum + discount.amount, 0);
  const afterFlat = floor(amount - flat);
  const resolved = floor(applyPercent(afterFlat, percent));
  return {
    amount: roundDiscounted(resolved),
    discounts: matching.map((discount) => ({
      sourceChoiceHandle: discount.sourceChoiceHandle,
      mode: discount.mode,
      amount: discount.amount,
    })),
  };
}

function evaluateActor(
  entryId: string,
  packageItem: CanonicalJumpPackage,
  actorId: string,
  actorState: ActorEntryState,
  previous: Partial<Record<string, EvaluatedProperty>>,
  original: Partial<Record<string, EvaluatedProperty>>,
  bodyModSpecies: string | undefined,
  supplementGrant: number,
  startingPointContribution: number,
  targetedResourceGrants: Readonly<Record<string, number>>,
  gauntletActive: boolean,
  availableCompanionIds: ReadonlySet<string> = new Set(),
) {
  const choiceViews: Record<string, EvaluatedChoice> = {};
  for (const choice of packageItem.choices) {
    let selected = actorState.choices[choice.handle] ?? null;
    if (choice.selection === "companions" && Array.isArray(selected))
      selected = [
        ...new Set(
          selected.filter((actorId) => availableCompanionIds.has(actorId)),
        ),
      ];
    const placement = choicePlacement(packageItem, actorState, choice);
    if (choice.selection === "toggle" && placement.selectedBySource)
      selected = true;
    const identityProperty = choice.grants.find(
      (grant) =>
        grant.kind === "property" &&
        (grant.handle === "gender" || grant.handle === "age"),
    )?.handle as "gender" | "age" | undefined;
    const continuityBaseline =
      choice.continuity && identityProperty
        ? (choice.continuity === "original" ? original : previous)[
            identityProperty
          ]?.value
        : undefined;
    const derivedContinuity =
      choice.continuity !== undefined && selected === null;
    if (choice.continuity && selected === null) {
      const available =
        choice.selection === "select"
          ? choice.options.some(
              (option) => display(option) === continuityBaseline,
            )
          : typeof continuityBaseline === "number";
      if (
        available &&
        (typeof continuityBaseline === "string" ||
          typeof continuityBaseline === "number")
      )
        selected = continuityBaseline;
    }
    const active = choiceStateIsActive(
      packageItem,
      actorState,
      choice,
      selected,
    );
    const sourceRolled = choiceWasRolledBySource(
      packageItem,
      actorState,
      choice.handle,
    );
    const choiceRoll = actorState.choiceRolls[choice.handle];
    const continuityFreeValues: (string | number)[] = choice.continuity
      ? choice.selection === "select" &&
        typeof continuityBaseline === "string" &&
        choice.options.some((option) => display(option) === continuityBaseline)
        ? [continuityBaseline]
        : choice.selection === "integer" &&
            typeof continuityBaseline === "number"
          ? [continuityBaseline]
          : choice.options.map((option) => display(option))
      : [];
    const freeByContinuity =
      (typeof selected === "string" || typeof selected === "number") &&
      continuityFreeValues.includes(selected);
    const costs = evaluatedChoiceCosts(
      choice,
      selected,
      choiceRoll,
      sourceRolled,
    ).map((cost) => (freeByContinuity ? { ...cost, resolvedAmount: 0 } : cost));
    choiceViews[choice.handle] = {
      handle: choice.handle,
      value: selected,
      active,
      costs,
      rolledResult: choiceRoll?.result,
      rolledBySource: sourceRolled,
      freeByRoll:
        sourceRolled ||
        choiceRoll?.result === selected ||
        (typeof selected === "number" &&
          typeof choiceRoll?.result === "number" &&
          selected <= choiceRoll.result),
      continuityBaseline:
        typeof continuityBaseline === "string" ||
        typeof continuityBaseline === "number"
          ? continuityBaseline
          : undefined,
      continuityFreeValues,
      derivedContinuity,
    };
  }
  const sections = evaluatedSections(packageItem, choiceViews);
  for (const choice of packageItem.choices) {
    const view = choiceViews[choice.handle];
    const placements = choicePlacementSections(packageItem, actorState, choice);
    const available =
      !placements.length ||
      placements.some((sectionHandle) => !sections[sectionHandle]?.locked);
    view.active = view.active && available;
  }
  for (const choice of packageItem.choices) {
    const view = choiceViews[choice.handle];
    view.costs = view.costs.map((cost) => {
      const discounted = discountedCost(
        packageItem,
        choice,
        cost.resource,
        cost.resolvedAmount,
        choiceViews,
      );
      return {
        ...cost,
        discountBaseAmount: cost.resolvedAmount,
        resolvedAmount: discounted.amount,
        discounts: discounted.discounts,
      };
    });
  }
  const resources: Record<string, EvaluatedResource> = {
    jump_points: {
      handle: "jump_points",
      name: display(packageItem.pointsName, "Choice Points"),
      abbreviation: display(packageItem.pointsAbbreviation, "CP"),
      starting: startingPointContribution,
      spent: 0,
      granted: supplementGrant + (targetedResourceGrants.jump_points ?? 0),
      balance:
        startingPointContribution +
        supplementGrant +
        (targetedResourceGrants.jump_points ?? 0),
    },
  };
  for (const resource of packageItem.resources)
    resources[resource.handle] = {
      handle: resource.handle,
      name: display(resource.name, resource.handle),
      abbreviation: display(
        resource.abbreviation,
        display(resource.name, resource.handle),
      ),
      starting: actorId === "jumper" ? resource.initial : 0,
      spent: 0,
      granted: targetedResourceGrants[resource.handle] ?? 0,
      balance:
        (actorId === "jumper" ? resource.initial : 0) +
        (targetedResourceGrants[resource.handle] ?? 0),
    };
  if (actorId === "jumper")
    for (const item of packageItem.grants ?? []) {
      if (
        item.kind !== "resource" ||
        item.companion ||
        !item.resource ||
        item.amount === undefined
      )
        continue;
      const resource = resources[item.resource];
      if (!resource) continue;
      const granted = resolveCostAmount(item.amount);
      resource.granted += granted;
      resource.balance += granted;
    }
  for (const choice of packageItem.choices) {
    const evaluated = choiceViews[choice.handle];
    if (!evaluated.active) continue;
    for (const cost of evaluated.costs) {
      const resource = resources[cost.resource];
      if (!resource) continue;
      if (cost.resolvedAmount >= 0) resource.spent += cost.resolvedAmount;
      else resource.granted += -cost.resolvedAmount;
      resource.balance -= cost.resolvedAmount;
    }
    for (const item of choice.grants) {
      if (
        item.kind !== "resource" ||
        item.companion ||
        !item.resource ||
        item.amount === undefined
      )
        continue;
      const resource = resources[item.resource];
      if (!resource) continue;
      const granted = resolveCostAmount(item.amount);
      resource.granted += granted;
      resource.balance += granted;
    }
    for (const inputItem of choice.inputs) {
      const value = actorState.inputs[choice.handle]?.[inputItem.handle];
      const activeInput = Array.isArray(value)
        ? value.length > 0
        : value !== null && value !== undefined && value !== "";
      if (!activeInput) continue;
      for (const item of inputItem.grants) {
        if (
          item.kind !== "resource" ||
          item.companion ||
          !item.resource ||
          item.amount === undefined
        )
          continue;
        const resource = resources[item.resource];
        if (!resource) continue;
        const granted = resolveCostAmount(item.amount);
        resource.granted += granted;
        resource.balance += granted;
      }
    }
  }
  const diagnostics: string[] = [];
  for (const section of packageItem.sections)
    for (const source of section.sources) {
      const selected =
        actorState.sourceSelections[`${section.handle}:${source.handle}`] ?? [];
      if (source.max !== undefined && selected.length > source.max)
        diagnostics.push(
          `${section.handle}.${source.handle} has ${selected.length} selections; maximum ${source.max}.`,
        );
    }
  const writers = collectProperties(packageItem, actorState, choiceViews);
  if (actorId === "jumper")
    for (const item of packageItem.grants ?? [])
      if (item.kind === "property" && item.handle && item.value !== undefined) {
        const values = writers.get(item.handle) ?? [];
        values.push({
          value: item.value,
          label: jumpGrantName(packageItem, item),
        });
        writers.set(item.handle, values);
      }
  const properties: Record<string, EvaluatedProperty> = {};
  for (const [handle, values] of writers) {
    const unique = new Set(
      values.map((item) => `${typeof item.value}:${String(item.value)}`),
    );
    if (unique.size > 1)
      diagnostics.push(`Conflicting values write ${handle}.`);
    else
      properties[handle] = {
        value: values[0].value,
        sourceLabel: values.map((item) => item.label).join(", "),
      };
  }
  for (const identity of ["gender", "age"] as const)
    if (!properties[identity] && previous[identity])
      properties[identity] = {
        ...previous[identity]!,
        sourceLabel: "Previous identity",
      };
  if (!properties.species)
    properties.species = {
      value: actorId === "jumper" ? (bodyModSpecies ?? "Human") : "Human",
      sourceLabel:
        actorId === "jumper" && bodyModSpecies
          ? "Classic Body Mod"
          : "Default species",
    };
  const context = actorRenderContext({ properties }, gauntletActive);
  const jumpTraits: EvaluatedGrantRecord[] =
    actorId === "jumper"
      ? (packageItem.grants ?? []).flatMap(
          (item, grantIndex): EvaluatedGrantRecord[] =>
            item.kind === "trait"
              ? [
                  {
                    id: `grant:${entryId}:${actorId}:jump:${grantIndex}`,
                    kind: "trait",
                    name: jumpGrantName(packageItem, item, context),
                    sourceEntryId: entryId,
                    ownerActorId: actorId,
                    grantHandle: item.handle ?? `jump:${grantIndex}`,
                    sourcePackageId: packageItem.logicalId,
                    sourcePackageExactHash: packageItem.exactHash,
                    tags: item.tags.map(normalizeTag),
                    description: jumpGrantDescription(
                      packageItem,
                      item,
                      context,
                    ),
                    layout: item.layout,
                    text: item.text,
                    images: item.images,
                  },
                ]
              : [],
        )
      : [];
  const traits = [
    ...jumpTraits,
    ...packageItem.choices.flatMap((choice) => {
      if (!choiceViews[choice.handle]?.active) return [];
      const value = choiceViews[choice.handle]?.value;
      return choice.grants.flatMap(
        (item, grantIndex): EvaluatedGrantRecord[] => {
          const grantContext = grantRenderContext(
            {
              ...context,
              ...choiceControlRenderContext(choice, actorState, value),
            },
            item,
            value,
          );
          return item.kind === "trait" && visibleGrantIsAcquired(value)
            ? [
                {
                  id: `grant:${entryId}:${actorId}:${choice.handle}:${grantIndex}`,
                  kind: "trait",
                  name: inheritedGrantName(choice, item, grantContext),
                  sourceEntryId: entryId,
                  ownerActorId: actorId,
                  grantHandle: effectiveGrantHandle(choice, item, grantIndex),
                  sourcePackageId: packageItem.logicalId,
                  sourcePackageExactHash: packageItem.exactHash,
                  tags: [
                    ...new Set(
                      [...choice.tags, ...item.tags].map(normalizeTag),
                    ),
                  ],
                  description: inheritedDescription(choice, item, grantContext),
                  measure: grantMeasure(item, value),
                  layout: item.layout,
                  text: item.text,
                  images: item.images,
                },
              ]
            : [];
        },
      );
    }),
  ];
  return {
    balance: resources.jump_points.balance,
    resources,
    properties,
    choices: choiceViews,
    sections,
    traits,
    diagnostics,
  } satisfies EvaluatedActorJump;
}

export function evaluateChain(input: EvaluateChainInput): ChainEvaluation {
  const runtime: EvaluatedJumpRuntime = {};
  const actors: Record<string, EvaluatedActor> = {
    jumper: {
      id: "jumper",
      name: input.jumperName,
      role: "Jumper",
      initials: initials(input.jumperName),
      summary: "The Jumper whose choices define this chain.",
    },
  };
  const records: EvaluatedGrantRecord[] = [];
  const forms: EvaluatedForm[] = [];
  const companions = new Map<string, EvaluatedCompanion>();
  const previous: Record<string, Partial<Record<string, EvaluatedProperty>>> = {
    jumper: input.initialIdentity ?? {},
  };
  const original: Record<string, Partial<Record<string, EvaluatedProperty>>> = {
    jumper: input.initialIdentity ?? {},
  };

  for (const entryId of input.order) {
    const packageItem = input.packages[input.packageIdByEntry[entryId]];
    const entryState = input.jumpState[entryId];
    if (!packageItem || !entryState) continue;
    const sources = [
      ...(packageItem.nativeGauntlet
        ? [
            {
              id: "package",
              kind: "package" as const,
              label: "Native Gauntlet",
            },
          ]
        : []),
      ...entryState.appliedGauntlet,
    ];
    const gauntlet: EvaluatedGauntletStatus = {
      active: sources.length > 0,
      native: packageItem.nativeGauntlet,
      sources,
      startingPointContribution: sources.length
        ? 0
        : (input.startingPointOverrides?.[entryId] ??
          packageItem.startingPoints),
    };
    runtime[entryId] = { gauntlet, actors: {} };

    const availableCompanionIds = new Set(companions.keys());
    const jumperState = entryState.actors.jumper ?? emptyActorEntryState();
    const jumperEvaluation = evaluateActor(
      entryId,
      packageItem,
      "jumper",
      jumperState,
      previous.jumper ?? {},
      original.jumper ?? {},
      input.bodyModSpecies,
      input.supplementPointGrants?.[entryId] ?? 0,
      gauntlet.startingPointContribution,
      {},
      gauntlet.active,
      availableCompanionIds,
    );
    const jumperContext = actorRenderContext(jumperEvaluation, gauntlet.active);
    const imported = new Set<string>();
    const companionTargets = new Map<string, readonly string[]>();
    const entryForms = new Map<string, EvaluatedForm>();

    for (const [grantIndex, grant] of (packageItem.grants ?? []).entries()) {
      if (grant.kind === "form" && grant.handle) {
        const name = jumpGrantName(packageItem, grant, jumperContext);
        const form: EvaluatedForm = {
          id: `form:${entryId}:${grant.handle}`,
          handle: grant.handle,
          name,
          sourceEntryId: entryId,
          ownerActorId: "jumper",
          description: jumpGrantDescription(packageItem, grant, jumperContext),
          initials: initials(name),
          tags: grant.tags.map(normalizeTag),
          perkRecordIds: [],
        };
        entryForms.set(grant.handle, form);
        forms.push(form);
      }
      if (grant.kind === "companion" && grant.handle) {
        const name = jumpGrantName(packageItem, grant, jumperContext);
        const companionId = `companion:${entryId}:jumper:jump:${grantIndex}`;
        actors[companionId] = {
          id: companionId,
          name,
          role: "Companion",
          joinedEntryId: entryId,
          initials: initials(name),
          summary: jumpGrantDescription(packageItem, grant, jumperContext),
        };
        companions.set(companionId, {
          actorId: companionId,
          sourceEntryId: entryId,
          tags: grant.tags.map(normalizeTag),
          perkRecordIds: [],
          itemRecordIds: [],
          importedEntryIds: [],
        });
        companionTargets.set(grant.handle, [companionId]);
      }
    }

    for (const choice of packageItem.choices) {
      const evaluatedChoice = jumperEvaluation.choices[choice.handle];
      if (!evaluatedChoice?.active) continue;
      const choiceContext = {
        ...jumperContext,
        ...choiceControlRenderContext(
          choice,
          jumperState,
          evaluatedChoice.value,
        ),
      };
      for (const [grantIndex, grant] of choice.grants.entries()) {
        if (grant.kind === "form" && grant.handle) {
          const form: EvaluatedForm = {
            id: `form:${entryId}:${grant.handle}`,
            handle: grant.handle,
            name: inheritedGrantName(choice, grant, choiceContext),
            sourceEntryId: entryId,
            ownerActorId: "jumper",
            description: inheritedDescription(choice, grant, choiceContext),
            initials: initials(
              inheritedGrantName(choice, grant, choiceContext),
            ),
            tags: [
              ...new Set([...choice.tags, ...grant.tags].map(normalizeTag)),
            ],
            perkRecordIds: [],
          };
          entryForms.set(grant.handle, form);
          forms.push(form);
        }
        if (grant.kind === "companion" && grant.handle) {
          const name = inheritedGrantName(choice, grant, choiceContext);
          const companionId = `companion:${entryId}:jumper:${choice.handle}:${grantIndex}`;
          actors[companionId] = {
            id: companionId,
            name,
            role: "Companion",
            joinedEntryId: entryId,
            initials: initials(name),
            summary: inheritedDescription(choice, grant, choiceContext),
          };
          companions.set(companionId, {
            actorId: companionId,
            sourceEntryId: entryId,
            tags: [
              ...new Set([...choice.tags, ...grant.tags].map(normalizeTag)),
            ],
            perkRecordIds: [],
            itemRecordIds: [],
            importedEntryIds: [],
          });
          companionTargets.set(grant.handle, [companionId]);
        }
      }
      const choiceValue = evaluatedChoice.value;
      if (choice.selection === "companions" && Array.isArray(choiceValue)) {
        const selectedActors = [
          ...new Set(
            choiceValue.filter((actorId) => availableCompanionIds.has(actorId)),
          ),
        ];
        companionTargets.set(choice.handle, selectedActors);
        selectedActors.forEach((actorId) => imported.add(actorId));
      }
    }

    const targetedResources = new Map<string, Map<string, number>>();
    const applyTargetedResource = (grant: JumpGrant) => {
      if (
        grant.kind !== "resource" ||
        !grant.companion ||
        !grant.resource ||
        grant.amount === undefined
      )
        return;
      if (
        grant.resource !== "jump_points" &&
        !packageItem.resources.some(
          (resource) => resource.handle === grant.resource,
        )
      )
        return;
      for (const actorId of companionTargets.get(grant.companion) ?? []) {
        const grants = targetedResources.get(actorId) ?? new Map();
        grants.set(
          grant.resource,
          (grants.get(grant.resource) ?? 0) + resolveCostAmount(grant.amount),
        );
        targetedResources.set(actorId, grants);
      }
    };
    (packageItem.grants ?? []).forEach(applyTargetedResource);
    for (const choice of packageItem.choices) {
      if (!jumperEvaluation.choices[choice.handle]?.active) continue;
      choice.grants.forEach(applyTargetedResource);
      for (const inputItem of choice.inputs) {
        const value = jumperState.inputs[choice.handle]?.[inputItem.handle];
        const activeInput = Array.isArray(value)
          ? value.length > 0
          : value !== null && value !== undefined && value !== "";
        if (activeInput) inputItem.grants.forEach(applyTargetedResource);
      }
    }
    const fundedCompanions = new Set(
      [...targetedResources].flatMap(([actorId, grants]) =>
        [...grants.values()].some((amount) => amount > 0) ? [actorId] : [],
      ),
    );
    const participating = ["jumper", ...fundedCompanions];
    const ownersForGrant = (
      grant: JumpGrant,
      actorId: string,
    ): { ownerActorId?: string; ownerFormId?: string }[] => {
      if (grant.form) {
        if (actorId !== "jumper") return [];
        const form = entryForms.get(grant.form);
        return form ? [{ ownerFormId: form.id }] : [];
      }
      if (grant.companion) {
        if (actorId !== "jumper") return [];
        return (companionTargets.get(grant.companion) ?? []).map(
          (ownerActorId) => ({ ownerActorId }),
        );
      }
      return [{ ownerActorId: actorId }];
    };

    for (const actorId of participating) {
      const state = entryState.actors[actorId] ?? emptyActorEntryState();
      const evaluation =
        actorId === "jumper"
          ? jumperEvaluation
          : evaluateActor(
              entryId,
              packageItem,
              actorId,
              state,
              previous[actorId] ?? {},
              original[actorId] ?? {},
              input.bodyModSpecies,
              0,
              0,
              Object.fromEntries(targetedResources.get(actorId) ?? []),
              gauntlet.active,
              availableCompanionIds,
            );
      runtime[entryId].actors[actorId] = evaluation;
      previous[actorId] = evaluation.properties;
      if (!original[actorId]) original[actorId] = evaluation.properties;

      const context = actorRenderContext(evaluation, gauntlet.active);
      if (actorId === "jumper")
        for (const [grantIndex, item] of (packageItem.grants ?? []).entries())
          if (item.kind === "perk" || item.kind === "item")
            for (const owner of ownersForGrant(item, actorId)) {
              const ownerKey = owner.ownerActorId ?? actorId;
              records.push({
                id: `grant:${entryId}:${ownerKey}:jump:${grantIndex}`,
                kind: item.kind,
                name: jumpGrantName(packageItem, item, context),
                sourceEntryId: entryId,
                ownerActorId: owner.ownerActorId,
                ownerFormId: owner.ownerFormId,
                grantHandle: item.handle ?? `jump:${grantIndex}`,
                sourcePackageId: packageItem.logicalId,
                sourcePackageExactHash: packageItem.exactHash,
                tags: item.tags.map(normalizeTag),
                description: jumpGrantDescription(packageItem, item, context),
              });
            }
      for (const choice of packageItem.choices) {
        const evaluatedChoice = evaluation.choices[choice.handle];
        if (!evaluatedChoice?.active) continue;
        const choiceContext = {
          ...context,
          ...choiceControlRenderContext(choice, state, evaluatedChoice.value),
        };
        for (const [grantIndex, item] of choice.grants.entries()) {
          if (
            (item.kind === "perk" || item.kind === "item") &&
            visibleGrantIsAcquired(evaluatedChoice.value)
          )
            for (const owner of ownersForGrant(item, actorId)) {
              const grantContext = grantRenderContext(
                choiceContext,
                item,
                evaluatedChoice.value,
              );
              const ownerKey = owner.ownerActorId ?? actorId;
              const id = `grant:${entryId}:${ownerKey}:${choice.handle}:${grantIndex}`;
              records.push({
                id,
                kind: item.kind,
                name: inheritedGrantName(choice, item, grantContext),
                sourceEntryId: entryId,
                ownerActorId: owner.ownerActorId,
                ownerFormId: owner.ownerFormId,
                grantHandle: effectiveGrantHandle(choice, item, grantIndex),
                sourcePackageId: packageItem.logicalId,
                sourcePackageExactHash: packageItem.exactHash,
                tags: [
                  ...new Set([...choice.tags, ...item.tags].map(normalizeTag)),
                ],
                description: inheritedDescription(choice, item, grantContext),
                measure: grantMeasure(item, evaluatedChoice.value),
              });
            }
        }
        for (const inputItem of choice.inputs) {
          const value = state.inputs[choice.handle]?.[inputItem.handle];
          const activeInput = Array.isArray(value)
            ? value.length > 0
            : value !== null && value !== undefined && value !== "";
          if (!activeInput) continue;
          for (const [grantIndex, item] of inputItem.grants.entries()) {
            if (
              (item.kind === "perk" || item.kind === "item") &&
              visibleGrantIsAcquired(value)
            )
              for (const owner of ownersForGrant(item, actorId)) {
                const grantContext = grantRenderContext(
                  choiceContext,
                  item,
                  value,
                );
                const ownerKey = owner.ownerActorId ?? actorId;
                const id = `grant:${entryId}:${ownerKey}:${choice.handle}:input:${inputItem.handle}:${grantIndex}`;
                records.push({
                  id,
                  kind: item.kind,
                  name: inheritedGrantName(choice, item, grantContext),
                  sourceEntryId: entryId,
                  ownerActorId: owner.ownerActorId,
                  ownerFormId: owner.ownerFormId,
                  grantHandle: effectiveGrantHandle(
                    choice,
                    item,
                    grantIndex,
                    inputItem.handle,
                  ),
                  sourcePackageId: packageItem.logicalId,
                  sourcePackageExactHash: packageItem.exactHash,
                  tags: [
                    ...new Set(
                      [...choice.tags, ...item.tags].map(normalizeTag),
                    ),
                  ],
                  description: inheritedDescription(choice, item, grantContext),
                  measure: grantMeasure(item, value),
                });
              }
          }
        }
      }
    }
    for (const actorId of imported) {
      if (!fundedCompanions.has(actorId)) continue;
      const companion = companions.get(actorId);
      if (companion)
        companions.set(actorId, {
          ...companion,
          importedEntryIds: [...companion.importedEntryIds, entryId],
        });
    }
  }

  for (const companion of companions.values()) {
    const owned = records.filter(
      (record) => record.ownerActorId === companion.actorId,
    );
    companions.set(companion.actorId, {
      ...companion,
      perkRecordIds: owned
        .filter((record) => record.kind === "perk")
        .map((record) => record.id),
      itemRecordIds: owned
        .filter((record) => record.kind === "item")
        .map((record) => record.id),
    });
  }
  for (const form of forms) {
    form.perkRecordIds = records
      .filter(
        (record) => record.ownerFormId === form.id && record.kind === "perk",
      )
      .map((record) => record.id);
  }
  return {
    runtime,
    actors,
    records,
    forms,
    companions: [...companions.values()],
  };
}
