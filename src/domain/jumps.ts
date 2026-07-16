import type {
  CanonicalJumpPackage,
  JumpChoice,
  JumpGrant,
  TextBlock,
  ImageBlock,
  Renderable,
} from "../markup";
import { resolveCostAmount } from "../markup";

export type ChoiceValue = boolean | string | number | null;
export type InputValue = string | number | readonly string[] | null;

export type RollRecord = {
  result: string | number;
  sequence: number;
};

export type ActorEntryState = {
  choices: Record<string, ChoiceValue>;
  inputs: Record<string, Record<string, InputValue>>;
  choiceRolls: Record<string, RollRecord>;
  sourceRolls: Record<string, RollRecord>;
};

export type AppliedGauntletSource = {
  id: string;
  kind: "user" | "supplement";
  label: string;
};

export type JumpEntryState = {
  actors: Record<string, ActorEntryState>;
  appliedGauntlet: readonly AppliedGauntletSource[];
};

export type JumpRuntimeState = Record<string, JumpEntryState>;

export type EvaluatedProperty = {
  value: string | number | boolean;
  sourceLabel: string;
  description?: string;
};

export type EvaluatedGauntletStatus = {
  active: boolean;
  native: boolean;
  sources: readonly {
    id: string;
    kind: "package" | "user" | "supplement";
    label: string;
  }[];
  startingPointContribution: number;
};

export type EvaluatedResource = {
  handle: string;
  name: string;
  abbreviation: string;
  starting: number;
  spent: number;
  granted: number;
  balance: number;
};

export type EvaluatedCost = {
  resource: string;
  originalAmount: number;
  resolvedAmount: number;
  mode: "flat" | "each";
  rankCount?: number;
  rolledAllowance?: number;
};

export type EvaluatedChoice = {
  handle: string;
  value: ChoiceValue;
  active: boolean;
  costs: readonly EvaluatedCost[];
  rolledResult?: string | number;
  rolledBySource: boolean;
  freeByRoll: boolean;
  continuityBaseline?: string | number;
  continuityFreeValues: readonly (string | number)[];
  derivedContinuity: boolean;
};

export type EvaluatedActorJump = {
  balance: number;
  resources: Readonly<Record<string, EvaluatedResource>>;
  properties: Partial<
    Record<
      "origin" | "species" | "location" | "gender" | "age" | string,
      EvaluatedProperty
    >
  >;
  choices: Readonly<Record<string, EvaluatedChoice>>;
  traits: readonly EvaluatedGrantRecord[];
  diagnostics: readonly string[];
};

export type EvaluatedJumpEntry = {
  gauntlet: EvaluatedGauntletStatus;
  actors: Record<string, EvaluatedActorJump>;
};

export type EvaluatedJumpRuntime = Record<string, EvaluatedJumpEntry>;

export type EvaluatedActor = {
  id: string;
  name: string;
  role: "Jumper" | "Companion";
  acquisitionGender?: string;
  acquisitionAge?: number;
  joinedEntryId?: string;
  initials: string;
  summary: string;
};

export type EvaluatedGrantMeasure = {
  kind: "rank" | "quantity";
  value: number;
};

export type EvaluatedGrantRecord = {
  id: string;
  kind: "perk" | "item" | "trait";
  name: string;
  sourceEntryId: string;
  ownerActorId?: string;
  ownerFormId?: string;
  grantHandle: string;
  sourcePackageId: string;
  sourcePackageExactHash: string;
  tags: readonly string[];
  description: string;
  measure?: EvaluatedGrantMeasure;
  layout?: string;
  text?: readonly TextBlock[];
  images?: readonly ImageBlock[];
};

export type EvaluatedForm = {
  id: string;
  handle: string;
  name: string;
  sourceEntryId: string;
  ownerActorId: "jumper";
  description: string;
  initials: string;
  tags: readonly string[];
  perkRecordIds: readonly string[];
};

export type EvaluatedCompanion = {
  actorId: string;
  sourceEntryId: string;
  tags: readonly string[];
  perkRecordIds: readonly string[];
  itemRecordIds: readonly string[];
  importedEntryIds: readonly string[];
};

export type ChainEvaluation = {
  runtime: EvaluatedJumpRuntime;
  actors: Record<string, EvaluatedActor>;
  records: readonly EvaluatedGrantRecord[];
  forms: readonly EvaluatedForm[];
  companions: readonly EvaluatedCompanion[];
};

export type EvaluateChainInput = {
  order: readonly string[];
  packageIdByEntry: Readonly<Record<string, string>>;
  packages: Readonly<Record<string, CanonicalJumpPackage>>;
  jumpState: JumpRuntimeState;
  jumperName: string;
  bodyModSpecies?: string;
  supplementPointGrants?: Readonly<Record<string, number>>;
  startingPointOverrides?: Readonly<Record<string, number>>;
  initialIdentity?: Partial<Record<string, EvaluatedProperty>>;
};

export const emptyActorEntryState = (): ActorEntryState => ({
  choices: {},
  inputs: {},
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

export function choiceValueIsActive(choice: JumpChoice, value: ChoiceValue) {
  if (choice.selection === "toggle") return value === true;
  if (choice.selection === "text")
    return typeof value === "string" && value.trim().length > 0;
  return value !== null && value !== undefined && value !== "";
}

function sourceKey(sectionHandle: string, sourceHandle: string) {
  return `${sectionHandle}:${sourceHandle}`;
}

export function choicesForSource(
  packageItem: CanonicalJumpPackage,
  sectionHandle: string,
  sourceHandle: string,
) {
  const section = packageItem.sections.find(
    (item) => item.handle === sectionHandle,
  );
  const source = section?.sources.find((item) => item.handle === sourceHandle);
  return source?.group
    ? packageItem.choices.filter((choice) =>
        choice.groups.includes(source.group!),
      )
    : [];
}

function rolledBySource(
  packageItem: CanonicalJumpPackage,
  state: ActorEntryState,
  choiceHandle: string,
) {
  return packageItem.sections.some((section) =>
    section.sources.some(
      (source) =>
        state.sourceRolls[sourceKey(section.handle, source.handle)]?.result ===
        choiceHandle,
    ),
  );
}

function evaluatedCosts(
  choice: JumpChoice,
  value: ChoiceValue,
  choiceRoll: RollRecord | undefined,
  sourceRolled: boolean,
) {
  const integerValue =
    typeof value === "number" ? Math.max(0, value) : undefined;
  const allowance =
    choiceRoll && typeof choiceRoll.result === "number"
      ? choiceRoll.result
      : undefined;
  const exactRoll = choiceRoll?.result === value;
  return choice.costs.map((cost): EvaluatedCost => {
    const amount = resolveCostAmount(cost.amount);
    let resolved = amount;
    if (sourceRolled || exactRoll) resolved = 0;
    else if (cost.mode === "each") {
      const paidRanks = Math.max(0, (integerValue ?? 0) - (allowance ?? 0));
      resolved = amount * paidRanks;
    }
    return {
      resource: cost.resource,
      originalAmount:
        cost.mode === "each" ? amount * (integerValue ?? 0) : amount,
      resolvedAmount: resolved,
      mode: cost.mode,
      rankCount: cost.mode === "each" ? integerValue : undefined,
      rolledAllowance: cost.mode === "each" ? allowance : undefined,
    };
  });
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

function actorRenderContext(
  evaluation: Pick<EvaluatedActorJump, "properties" | "choices">,
  gauntlet: boolean,
): RenderContext {
  return {
    ...Object.fromEntries(
      Object.entries(evaluation.properties).map(([handle, property]) => [
        handle,
        property?.value,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(evaluation.choices).map(([handle, choice]) => [
        handle,
        typeof choice.value === "boolean" ||
        typeof choice.value === "string" ||
        typeof choice.value === "number"
          ? choice.value
          : undefined,
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
  for (const choice of packageItem.choices) {
    const evaluation = choices[choice.handle];
    if (!evaluation?.active) continue;
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
) {
  const choiceViews: Record<string, EvaluatedChoice> = {};
  for (const choice of packageItem.choices) {
    let selected = actorState.choices[choice.handle] ?? null;
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
    const active = choiceValueIsActive(choice, selected);
    const sourceRolled = rolledBySource(packageItem, actorState, choice.handle);
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
    const costs = (
      active
        ? evaluatedCosts(choice, selected, choiceRoll, sourceRolled)
        : evaluatedCosts(choice, selected, choiceRoll, sourceRolled).map(
            (cost) => ({
              ...cost,
              resolvedAmount: 0,
            }),
          )
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
  const writers = collectProperties(packageItem, actorState, choiceViews);
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
  const context = actorRenderContext(
    { properties, choices: choiceViews },
    gauntletActive,
  );
  const traits = packageItem.choices.flatMap((choice) => {
    if (!choiceViews[choice.handle]?.active) return [];
    return choice.grants.flatMap((item, grantIndex): EvaluatedGrantRecord[] =>
      item.kind === "trait" &&
      visibleGrantIsAcquired(choiceViews[choice.handle]?.value)
        ? [
            {
              id: `grant:${entryId}:${actorId}:${choice.handle}:${grantIndex}`,
              kind: "trait",
              name: inheritedGrantName(choice, item, context),
              sourceEntryId: entryId,
              ownerActorId: actorId,
              grantHandle: effectiveGrantHandle(choice, item, grantIndex),
              sourcePackageId: packageItem.logicalId,
              sourcePackageExactHash: packageItem.exactHash,
              tags: [
                ...new Set([...choice.tags, ...item.tags].map(normalizeTag)),
              ],
              description: inheritedDescription(choice, item, context),
              measure: grantMeasure(item, choiceViews[choice.handle]?.value),
              layout: item.layout,
              text: item.text,
              images: item.images,
            },
          ]
        : [],
    );
  });
  return {
    balance: resources.jump_points.balance,
    resources,
    properties,
    choices: choiceViews,
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
    );
    const jumperContext = actorRenderContext(jumperEvaluation, gauntlet.active);
    const imported = new Set<string>();
    const companionTargets = new Map<string, readonly string[]>();
    const entryForms = new Map<string, EvaluatedForm>();

    for (const choice of packageItem.choices) {
      if (!jumperEvaluation.choices[choice.handle]?.active) continue;
      for (const [grantIndex, grant] of choice.grants.entries()) {
        if (grant.kind === "form" && grant.handle) {
          const form: EvaluatedForm = {
            id: `form:${entryId}:${grant.handle}`,
            handle: grant.handle,
            name: inheritedGrantName(choice, grant, jumperContext),
            sourceEntryId: entryId,
            ownerActorId: "jumper",
            description: inheritedDescription(choice, grant, jumperContext),
            initials: initials(
              inheritedGrantName(choice, grant, jumperContext),
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
          const name = inheritedGrantName(choice, grant, jumperContext);
          const companionId = `companion:${entryId}:jumper:${choice.handle}:${grantIndex}`;
          actors[companionId] = {
            id: companionId,
            name,
            role: "Companion",
            joinedEntryId: entryId,
            initials: initials(name),
            summary: inheritedDescription(choice, grant, jumperContext),
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
      for (const inputItem of choice.inputs) {
        const selected = jumperState.inputs[choice.handle]?.[inputItem.handle];
        if (!Array.isArray(selected)) continue;
        const selectedActors = selected.filter(
          (actorId) => actors[actorId]?.role === "Companion",
        );
        for (const importGrant of inputItem.grants)
          if (importGrant.kind === "companion-import" && importGrant.handle) {
            companionTargets.set(importGrant.handle, selectedActors);
            selectedActors.forEach((actorId) => imported.add(actorId));
          }
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
            );
      runtime[entryId].actors[actorId] = evaluation;
      previous[actorId] = evaluation.properties;
      if (!original[actorId]) original[actorId] = evaluation.properties;

      const context = actorRenderContext(evaluation, gauntlet.active);
      for (const choice of packageItem.choices) {
        const evaluatedChoice = evaluation.choices[choice.handle];
        if (!evaluatedChoice?.active) continue;
        for (const [grantIndex, item] of choice.grants.entries()) {
          if (
            (item.kind === "perk" || item.kind === "item") &&
            visibleGrantIsAcquired(evaluatedChoice.value)
          )
            for (const owner of ownersForGrant(item, actorId)) {
              const ownerKey = owner.ownerActorId ?? actorId;
              const id = `grant:${entryId}:${ownerKey}:${choice.handle}:${grantIndex}`;
              records.push({
                id,
                kind: item.kind,
                name: inheritedGrantName(choice, item, context),
                sourceEntryId: entryId,
                ownerActorId: owner.ownerActorId,
                ownerFormId: owner.ownerFormId,
                grantHandle: effectiveGrantHandle(choice, item, grantIndex),
                sourcePackageId: packageItem.logicalId,
                sourcePackageExactHash: packageItem.exactHash,
                tags: [
                  ...new Set([...choice.tags, ...item.tags].map(normalizeTag)),
                ],
                description: inheritedDescription(choice, item, context),
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
                const ownerKey = owner.ownerActorId ?? actorId;
                const id = `grant:${entryId}:${ownerKey}:${choice.handle}:input:${inputItem.handle}:${grantIndex}`;
                records.push({
                  id,
                  kind: item.kind,
                  name: inheritedGrantName(choice, item, context),
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
                  description: inheritedDescription(choice, item, context),
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

export function renderRenderable(
  value: Renderable,
  context: Readonly<Record<string, string | number | boolean | undefined>>,
) {
  const selected = value.variants.find((variant) =>
    evaluateCondition(variant.condition, context),
  );
  return interpolate(selected?.value ?? value.base ?? "", context);
}

function interpolate(
  value: string,
  context: Readonly<Record<string, string | number | boolean | undefined>>,
) {
  return value.replace(/\{\{([a-z0-9_]+)}}/g, (_, handle: string) =>
    String(context[handle] ?? ""),
  );
}

export function evaluateCondition(
  expression: string,
  context: Readonly<Record<string, string | number | boolean | undefined>>,
): boolean {
  const tokens =
    expression.match(
      /"(?:[^"\\]|\\.)*"|-?\d+|!=|<=|>=|[()!<>=]|[a-z0-9_]+/gi,
    ) ?? [];
  let index = 0;
  const value = (): string | number | boolean | undefined => {
    const token = tokens[index++];
    if (token === undefined) return undefined;
    if (token.startsWith('"')) return token.slice(1, -1).replace(/\\"/g, '"');
    if (/^-?\d+$/.test(token)) return Number(token);
    if (token === "true" || token === "false") return token === "true";
    return context[token];
  };
  const comparison = (): boolean => {
    if (tokens[index] === "(") {
      index += 1;
      const result = or();
      if (tokens[index] === ")") index += 1;
      return result;
    }
    const left = value();
    const operator = tokens[index];
    if (!["=", "!=", "<", "<=", ">", ">="].includes(operator))
      return Boolean(left);
    index += 1;
    const right = value();
    if (operator === "=") return left === right;
    if (operator === "!=") return left !== right;
    if (typeof left !== "number" || typeof right !== "number") return false;
    if (operator === "<") return left < right;
    if (operator === "<=") return left <= right;
    if (operator === ">") return left > right;
    return left >= right;
  };
  const not = (): boolean => {
    if (tokens[index] !== "!") return comparison();
    index += 1;
    return !not();
  };
  const and = (): boolean => {
    let result = not();
    while (tokens[index]?.toLowerCase() === "and") {
      index += 1;
      const right = not();
      result = result && right;
    }
    return result;
  };
  const or = (): boolean => {
    let result = and();
    while (tokens[index]?.toLowerCase() === "or") {
      index += 1;
      const right = and();
      result = result || right;
    }
    return result;
  };
  return or();
}
