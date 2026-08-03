import {
  tagCategories,
  type TagCategory,
  type TagDefinition,
} from "../domain/tags";
import type {
  DependencyImpact,
  FormDependencyImpact,
  InstalledPackage,
  InventoryRecord,
  TrackerAction,
  TrackerState,
  UndoSnapshot,
} from "./types";

export type * from "./types";

export { tagCategories } from "../domain/tags";
export type { TagCategory, TagDefinition } from "../domain/tags";
export {
  EARTH_ENTRY_ID,
  EARTH_ENTRY_STATUS,
  EARTH_PACKAGE_ID,
  trackerPages,
} from "./constants";
export type { TrackerPage } from "./constants";

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function packageForEntry(
  state: TrackerState,
  entryId: string,
): InstalledPackage {
  const entry = state.entries[entryId];
  const packageItem = state.packages[entry?.packageId];
  if (!entry || !packageItem)
    return {
      id: entry?.packageId ?? `unavailable:${entryId}`,
      logicalId: entry?.packageId ?? `unavailable:${entryId}`,
      name: "Unavailable Jump package",
      version: "unavailable",
      source: "imported",
      description:
        "The exact package for this chain entry is not currently installed.",
      tags: [],
      exactHash: entry?.packageExactHash,
    };
  return entry.packageExactHash === packageItem.exactHash
    ? packageItem
    : { ...packageItem, document: undefined };
}

function evaluateCurrentState(state: TrackerState) {
  const order = state.order.filter((id) => state.entries[id]?.kind === "jump");
  const supplementInputs = supplementEvaluationInputs(state, order);
  return evaluateChain({
    order,
    packageIdByEntry: Object.fromEntries(
      order.map((id) => [id, state.entries[id].packageId]),
    ),
    packages: Object.fromEntries(
      Object.values(state.packages)
        .filter((item) => item.document)
        .map((item) => [item.id, item.document!]),
    ),
    jumpState: supplementInputs.jumpState,
    jumperName: state.actors.jumper?.name ?? "Jumper",
    supplementPointGrants: supplementInputs.supplementPointGrants,
    startingPointOverrides: supplementInputs.startingPointOverrides,
  });
}

function sectionIsLocked(
  state: TrackerState,
  entryId: string,
  actorId: string,
  sectionHandle: string,
) {
  return Boolean(
    evaluateCurrentState(state).runtime[entryId]?.actors[actorId]?.sections?.[
      sectionHandle
    ]?.locked,
  );
}

function choiceEditingIsLocked(
  state: TrackerState,
  entryId: string,
  actorId: string,
  choiceHandle: string,
) {
  const packageItem = packageForEntry(state, entryId)?.document;
  const choice = packageItem?.choices.find(
    (candidate) => candidate.handle === choiceHandle,
  );
  if (!packageItem || !choice) return false;
  const sections = packageItem.sections.flatMap((section) =>
    section.directChoices.some(
      (placement) => placement.target === choiceHandle,
    ) ||
    section.sources.some(
      (source) =>
        source.group !== undefined && choice.groups.includes(source.group),
    )
      ? [section.handle]
      : [],
  );
  return (
    sections.length > 0 &&
    sections.every((section) =>
      sectionIsLocked(state, entryId, actorId, section),
    )
  );
}

export function chronologyIndex(state: TrackerState, entryId: string) {
  return state.order.indexOf(entryId);
}

export function jumpEntryIds(state: Pick<TrackerState, "entries" | "order">) {
  return state.order.filter((id) => state.entries[id]?.kind === "jump");
}

export function jumpNumber(
  state: Pick<TrackerState, "entries" | "order">,
  entryId: string,
) {
  const index = jumpEntryIds(state).indexOf(entryId);
  return index < 0 ? null : index + 1;
}

export function visibleAtInspection(
  state: TrackerState,
  sourceEntryId: string,
) {
  const source = chronologyIndex(state, sourceEntryId);
  const cutoff = chronologyIndex(state, state.inspectionPointId);
  return source >= 0 && cutoff >= 0 && source <= cutoff;
}

export function tagIsWithin(
  state: Pick<TrackerState, "tags">,
  tagId: string,
  selectedId: string,
) {
  if (selectedId === "all") return true;
  let current: string | undefined = tagId;
  while (current) {
    if (current === selectedId) return true;
    current = state.tags[current]?.parent;
  }
  return false;
}

function inventoryRecordPool(state: TrackerState) {
  return aggregateInventoryRecords(
    state.records.filter((record) => {
      if (record.ownerActorId !== "jumper") return false;
      if (record.ownerFormId) return false;
      if (!visibleAtInspection(state, record.sourceEntryId)) return false;
      if (state.inventoryKind !== "all" && record.kind !== state.inventoryKind)
        return false;
      return true;
    }),
    state.preferences.aggregateSimilarInventory,
  );
}

function inventoryRecordMatchesSearch(
  state: TrackerState,
  record: InventoryRecord,
  terms: readonly string[],
) {
  if (!terms.length) return true;
  const relatedTags = record.tags.flatMap((tag) =>
    inventoryTagSearchValues(state, tag),
  );
  const acquisitions = record.acquisitions ?? [record];
  const haystack = normalize(
    [
      record.name,
      ...acquisitions.flatMap((acquisition) => [
        acquisition.description,
        packageForEntry(state, acquisition.sourceEntryId)?.name,
      ]),
      ...relatedTags,
    ].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

function inventoryTagSearchValues(
  state: Pick<TrackerState, "tags">,
  tagId: string,
) {
  const related = [tagId];
  let current: string | undefined = tagId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const definition: TagDefinition | undefined = state.tags[current];
    if (!definition) break;
    related.push(definition.label, ...definition.aliases);
    current = definition.parent;
  }
  return related;
}

export function inventoryRecordTagProjection(
  state: Pick<TrackerState, "inventorySearch" | "inventoryTag" | "tags">,
  record: InventoryRecord,
  limit = 5,
) {
  const allIds = [...new Set(record.tags)].filter((id) => state.tags[id]);
  const boundedLimit = Math.max(0, Math.trunc(limit));
  if (allIds.length <= boundedLimit)
    return { allIds, visibleIds: allIds, hiddenCount: 0 };

  const searchTerms = normalize(state.inventorySearch)
    .split(/\s+/)
    .filter(Boolean);
  const shouldPrioritize = (id: string) => {
    const searchText = normalize(inventoryTagSearchValues(state, id).join(" "));
    return (
      searchTerms.some((term) => searchText.includes(term)) ||
      (state.inventoryTag !== "all" &&
        tagIsWithin(state, id, state.inventoryTag))
    );
  };
  const priorityIds = allIds.filter(shouldPrioritize);
  const prioritySet = new Set(priorityIds);
  const selected = new Set(
    [...priorityIds, ...allIds.filter((id) => !prioritySet.has(id))].slice(
      0,
      boundedLimit,
    ),
  );
  const visibleIds = allIds.filter((id) => selected.has(id));
  return {
    allIds,
    visibleIds,
    hiddenCount: allIds.length - visibleIds.length,
  };
}

function inventoryRecordsBeforeTagFilter(state: TrackerState) {
  const terms = normalize(state.inventorySearch).split(/\s+/).filter(Boolean);
  return inventoryRecordPool(state).filter((record) =>
    inventoryRecordMatchesSearch(state, record, terms),
  );
}

export function filteredInventory(state: TrackerState) {
  return inventoryRecordsBeforeTagFilter(state).filter(
    (record) =>
      state.inventoryTag === "all" ||
      record.tags.some((tag) => tagIsWithin(state, tag, state.inventoryTag)),
  );
}

export type InventoryTagNode = {
  id: string;
  children: readonly InventoryTagNode[];
};

export function inventoryTagTree(state: TrackerState): InventoryTagNode[] {
  const available = new Set<string>();
  for (const record of inventoryRecordsBeforeTagFilter(state))
    for (const id of record.tags) {
      let current: string | undefined = id;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        if (!state.tags[current]) break;
        available.add(current);
        current = state.tags[current].parent;
      }
    }

  const childrenByParent = new Map<string, string[]>();
  for (const tag of Object.values(state.tags)) {
    if (!tag.parent || !available.has(tag.id)) continue;
    childrenByParent.set(tag.parent, [
      ...(childrenByParent.get(tag.parent) ?? []),
      tag.id,
    ]);
  }
  for (const children of childrenByParent.values())
    children.sort((first, second) =>
      state.tags[first].label.localeCompare(state.tags[second].label),
    );

  const build = (
    id: string,
    ancestors: ReadonlySet<string>,
  ): InventoryTagNode | null => {
    if (!available.has(id) || ancestors.has(id)) return null;
    const nextAncestors = new Set(ancestors).add(id);
    return {
      id,
      children: (childrenByParent.get(id) ?? [])
        .map((child) => build(child, nextAncestors))
        .filter((child): child is InventoryTagNode => child !== null),
    } satisfies InventoryTagNode;
  };

  return tagCategories
    .map((category) => build(category, new Set()))
    .filter((node): node is InventoryTagNode => node !== null);
}

export function aggregateInventoryRecords(
  records: readonly InventoryRecord[],
  aggregateSimilar = true,
): InventoryRecord[] {
  const grouped = new Map<string, InventoryRecord[]>();
  for (const record of records) {
    const rank = record.measure?.kind === "rank" ? record.measure.value : "";
    const ownerAndPresentation = [
      record.ownerActorId ?? "",
      record.ownerFormId ?? "",
      record.kind,
      record.name,
      rank,
    ];
    const key = aggregateSimilar
      ? ownerAndPresentation.join("\u0000")
      : record.grantHandle && record.sourcePackageExactHash
        ? [
            ...ownerAndPresentation,
            record.grantHandle,
            record.sourcePackageId ?? "",
            record.sourcePackageExactHash,
          ].join("\u0000")
        : record.id;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return [...grouped.values()].map((group) => {
    const first = group[0];
    const acquisitions = group.map((record) => ({
      recordId: record.id,
      sourceEntryId: record.sourceEntryId,
      description: record.description,
      quantity: record.measure?.kind === "quantity" ? record.measure.value : 1,
    }));
    const tags = [...new Set(group.flatMap((record) => record.tags))];
    if (group.some((record) => record.measure?.kind === "quantity"))
      return {
        ...first,
        tags,
        measure: {
          kind: "quantity",
          value: group.reduce(
            (total, record) =>
              total +
              (record.measure?.kind === "quantity" ? record.measure.value : 1),
            0,
          ),
        },
        acquisitions,
      };
    return {
      ...first,
      tags,
      aggregateQuantity: group.length > 1 ? group.length : undefined,
      acquisitions,
    };
  });
}

export function visibleForms(state: TrackerState) {
  return state.forms.filter((form) =>
    visibleAtInspection(state, form.sourceEntryId),
  );
}

export function visibleCompanions(state: TrackerState) {
  return state.companions.filter((companion) =>
    visibleAtInspection(state, companion.sourceEntryId),
  );
}

export function radarCounts(state: TrackerState) {
  const result = Object.fromEntries(
    tagCategories.map((category) => [category, 0]),
  ) as Record<TagCategory, number>;
  for (const record of state.records) {
    if (!recordContributesToRadar(state, record)) continue;
    for (const category of tagCategories)
      if (record.tags.some((tag) => tagIsWithin(state, tag, category)))
        result[category] += 1;
  }
  return result;
}

export function recordContributesToRadar(
  state: TrackerState,
  record: InventoryRecord,
) {
  const eligibleOwner =
    record.ownerActorId === "jumper" || Boolean(record.ownerFormId);
  const eligibleKind =
    record.kind === "perk" ||
    (record.kind === "item" && state.preferences.includeItemTagsInRadar);
  return (
    eligibleOwner &&
    eligibleKind &&
    visibleAtInspection(state, record.sourceEntryId)
  );
}

export type TagBreakdownNode = {
  id: string;
  label: string;
  aliases: readonly string[];
  count: number;
  direct: boolean;
  children: readonly TagBreakdownNode[];
};

function tagDepth(state: Pick<TrackerState, "tags">, tagId: string) {
  let depth = 0;
  let current = state.tags[tagId]?.parent;
  while (current) {
    depth += 1;
    current = state.tags[current]?.parent;
  }
  return depth;
}

function bucketForRecord(
  state: TrackerState,
  record: InventoryRecord,
  parentId: string,
) {
  const selected = record.tags
    .filter((id) => tagIsWithin(state, id, parentId))
    .sort(
      (first, second) => tagDepth(state, second) - tagDepth(state, first),
    )[0];
  if (!selected || selected === parentId) return selected;
  let current = selected;
  while (state.tags[current]?.parent !== parentId) {
    const next = state.tags[current]?.parent;
    if (!next) return parentId;
    current = next;
  }
  return current;
}

function tagBreakdownFromRecords(
  state: TrackerState,
  nodeId: string,
  records: readonly InventoryRecord[],
): TagBreakdownNode | null {
  const definition = state.tags[nodeId];
  if (!definition) return null;
  const directCount = records.filter(
    (record) => bucketForRecord(state, record, nodeId) === nodeId,
  ).length;
  const childDefinitions = Object.values(state.tags).filter(
    (tag) => tag.parent === nodeId,
  );
  const children = childDefinitions
    .map((child) =>
      tagBreakdownFromRecords(
        state,
        child.id,
        records.filter(
          (record) => bucketForRecord(state, record, nodeId) === child.id,
        ),
      ),
    )
    .filter((child): child is TagBreakdownNode => Boolean(child?.count));
  return {
    id: nodeId,
    label: definition.label,
    aliases: definition.aliases,
    count: records.length,
    direct: false,
    children: [
      ...(directCount
        ? [
            {
              id: `direct:${nodeId}`,
              label: definition.label,
              aliases: definition.aliases,
              count: directCount,
              direct: true,
              children: [],
            } satisfies TagBreakdownNode,
          ]
        : []),
      ...children,
    ],
  };
}

export function tagBreakdown(
  state: TrackerState,
  nodeId: string,
): TagBreakdownNode | null {
  return tagBreakdownFromRecords(
    state,
    nodeId,
    state.records.filter(
      (record) =>
        recordContributesToRadar(state, record) &&
        record.tags.some((tag) => tagIsWithin(state, tag, nodeId)),
    ),
  );
}

export type TagBreakdownSlice = {
  key: string;
  node: TagBreakdownNode;
  color: string;
  isMore: boolean;
};

const piePalette = [
  "#d4af37",
  "#2f80ed",
  "#d97706",
  "#0f8a78",
  "#c44555",
  "#8b5cf6",
  "#5f8f22",
  "#c13f87",
  "#64748b",
] as const;

export function visibleTagBreakdownSlices(
  node: TagBreakdownNode,
  categoryColor: string,
): readonly TagBreakdownSlice[] {
  const ordered = [...node.children].sort((first, second) => {
    if (first.direct) return -1;
    if (second.direct) return 1;
    return (
      second.count - first.count || first.label.localeCompare(second.label)
    );
  });
  const shown = ordered.slice(0, 9);
  const remaining = ordered.slice(9);
  const slices: TagBreakdownSlice[] = shown.map((child, index) => ({
    key: `slice-${index}`,
    node: child,
    color: index === 0 ? categoryColor : piePalette[index % piePalette.length],
    isMore: false,
  }));
  if (remaining.length) {
    slices.push({
      key: "slice-more",
      node: {
        id: `more:${node.id}`,
        label: `More in ${node.label}`,
        aliases: [],
        count: remaining.reduce((total, child) => total + child.count, 0),
        direct: false,
        children: remaining,
      },
      color: "#68707c",
      isMore: true,
    });
  }
  return slices;
}

export function resolveTagBreakdownStack(
  state: TrackerState,
  category: TagCategory,
) {
  const root = tagBreakdown(state, category);
  if (!root) return [];
  const stack: { node: TagBreakdownNode; isMore: boolean }[] = [
    { node: root, isMore: false },
  ];
  for (const id of state.radarPath) {
    if (id === category && stack.length === 1) continue;
    const current = stack.at(-1)?.node;
    if (!current) break;
    const slice = visibleTagBreakdownSlices(
      current,
      state.tags[category].color,
    ).find((candidate) => candidate.node.id === id);
    if (!slice) break;
    stack.push({ node: slice.node, isMore: slice.isMore });
  }
  return stack;
}

export function companionImportDependencies(state: TrackerState) {
  const providers = new Map<string, string>();
  for (const entryId of state.order) {
    const packageItem =
      state.packages[state.entries[entryId]?.packageId]?.document;
    const actor = state.jumpState[entryId]?.actors.jumper;
    if (!packageItem || !actor) continue;
    for (const choice of packageItem.choices) {
      if (!choiceStateIsActive(packageItem, actor, choice)) continue;
      choice.grants.forEach((grant, grantIndex) => {
        if (grant.kind === "companion")
          providers.set(
            `companion:${entryId}:jumper:${choice.handle}:${grantIndex}`,
            entryId,
          );
      });
    }
  }
  const dependencies: {
    kind: "companion-import";
    subjectId: string;
    providerEntryId: string;
    consumerEntryId: string;
  }[] = [];
  for (const consumerEntryId of state.order) {
    const packageItem =
      state.packages[state.entries[consumerEntryId]?.packageId]?.document;
    const actor = state.jumpState[consumerEntryId]?.actors.jumper;
    if (!packageItem || !actor) continue;
    const choiceIsActive = (choice: (typeof packageItem.choices)[number]) => {
      return choiceStateIsActive(packageItem, actor, choice);
    };
    const fundedTargets = new Set(
      packageItem.choices.flatMap((choice) => {
        if (!choiceIsActive(choice)) return [];
        const grants = [...choice.grants];
        for (const input of choice.inputs) {
          const value = actor.inputs[choice.handle]?.[input.handle];
          const activeInput =
            value !== null && value !== undefined && value !== "";
          if (activeInput) grants.push(...input.grants);
        }
        return grants.flatMap((grant) =>
          grant.kind === "resource" &&
          grant.companion &&
          grant.amount !== undefined &&
          (typeof grant.amount === "number" ? grant.amount > 0 : true)
            ? [grant.companion]
            : [],
        );
      }),
    );
    for (const choice of packageItem.choices) {
      if (
        !choiceIsActive(choice) ||
        choice.selection !== "companions" ||
        !fundedTargets.has(choice.handle)
      )
        continue;
      const selected = actor.choices[choice.handle];
      if (!Array.isArray(selected)) continue;
      for (const subjectId of selected) {
        const providerEntryId = providers.get(subjectId);
        if (providerEntryId)
          dependencies.push({
            kind: "companion-import",
            subjectId,
            providerEntryId,
            consumerEntryId,
          });
      }
    }
  }
  return dependencies;
}

function isDependencyValid(
  order: readonly string[],
  provider: string,
  consumer: string,
) {
  const providerIndex = order.indexOf(provider);
  const consumerIndex = order.indexOf(consumer);
  return (
    providerIndex >= 0 && consumerIndex >= 0 && providerIndex < consumerIndex
  );
}

function groupDependencyImpacts(
  dependencies: ReturnType<typeof companionImportDependencies>,
) {
  const grouped = new Map<string, DependencyImpact>();
  for (const dependency of dependencies) {
    const key = `${dependency.kind}:${dependency.subjectId}:${dependency.providerEntryId}`;
    const current = grouped.get(key);
    grouped.set(key, {
      kind: dependency.kind,
      subjectId: dependency.subjectId,
      providerEntryId: dependency.providerEntryId,
      consumerEntryIds: [
        ...(current?.consumerEntryIds ?? []),
        dependency.consumerEntryId,
      ],
    });
  }
  return [...grouped.values()];
}

export function moveDependencyImpacts(
  state: TrackerState,
  entryId: string,
  toIndex: number,
) {
  const nextOrder = applyMove(state, entryId, toIndex).order;
  return groupDependencyImpacts(
    companionImportDependencies(state).filter(
      (dependency) =>
        isDependencyValid(
          state.order,
          dependency.providerEntryId,
          dependency.consumerEntryId,
        ) &&
        !isDependencyValid(
          nextOrder,
          dependency.providerEntryId,
          dependency.consumerEntryId,
        ),
    ),
  );
}

export function removeDependencyImpacts(state: TrackerState, entryId: string) {
  return groupDependencyImpacts(
    companionImportDependencies(state).filter(
      (dependency) =>
        dependency.providerEntryId === entryId &&
        isDependencyValid(
          state.order,
          dependency.providerEntryId,
          dependency.consumerEntryId,
        ),
    ),
  );
}

function snapshot(state: TrackerState, label: string): UndoSnapshot {
  return {
    entries: state.entries,
    order: state.order,
    selectedEntryId: state.selectedEntryId,
    inspectionPointId: state.inspectionPointId,
    jumpState: state.jumpState,
    entrySupplements: state.entrySupplements,
    label,
  };
}

function evaluatedBalance(
  state: TrackerState,
  entryId: string,
  actorId: string,
) {
  return (
    evaluateCurrentState(state).runtime[entryId]?.actors[actorId]?.balance ?? 0
  );
}

function enforceBalancePolicy(
  state: TrackerState,
  candidate: TrackerState,
  entryId: string,
  actorId: string,
  activeChoiceSelection: boolean,
) {
  if (state.preferences.allowNegativePointBalances || !activeChoiceSelection)
    return candidate;
  const before = evaluatedBalance(state, entryId, actorId);
  const after = evaluatedBalance(candidate, entryId, actorId);
  return after < 0 && after < before ? state : candidate;
}

function actionActivatesChoice(
  state: TrackerState,
  entryId: string,
  choiceHandle: string,
  value: import("../domain").ChoiceValue,
) {
  const choice = packageForEntry(state, entryId)?.document?.choices.find(
    (item) => item.handle === choiceHandle,
  );
  return choice ? choiceValueIsActive(choice, value) : false;
}

function activeFormHandles(
  state: TrackerState,
  entryId: string,
  actorId: string,
) {
  if (actorId !== "jumper") return new Set<string>();
  const packageItem = packageForEntry(state, entryId)?.document;
  const actor = state.jumpState[entryId]?.actors[actorId];
  if (!packageItem || !actor) return new Set<string>();
  const handles = new Set<string>();
  for (const choice of packageItem.choices) {
    if (!choiceStateIsActive(packageItem, actor, choice)) continue;
    for (const grant of choice.grants)
      if (grant.kind === "form" && grant.handle) handles.add(grant.handle);
  }
  return handles;
}

function cascadeRemovedFormDependencies(
  state: TrackerState,
  candidate: TrackerState,
  entryId: string,
  actorId: string,
) {
  const removed = [...activeFormHandles(state, entryId, actorId)].filter(
    (handle) => !activeFormHandles(candidate, entryId, actorId).has(handle),
  );
  if (!removed.length) return candidate;
  const packageItem = packageForEntry(candidate, entryId)?.document;
  const entry = candidate.jumpState[entryId];
  const actor = entry?.actors[actorId];
  if (!packageItem || !entry || !actor) return candidate;
  const choices = { ...actor.choices };
  const inputs = { ...actor.inputs };
  for (const choice of packageItem.choices) {
    if (
      choice.grants.some((grant) => grant.form && removed.includes(grant.form))
    )
      choices[choice.handle] = null;
    for (const input of choice.inputs)
      if (
        input.grants.some((grant) => grant.form && removed.includes(grant.form))
      )
        inputs[choice.handle] = {
          ...inputs[choice.handle],
          [input.handle]: null,
        };
  }
  return {
    ...candidate,
    jumpState: {
      ...candidate.jumpState,
      [entryId]: {
        ...entry,
        actors: {
          ...entry.actors,
          [actorId]: { ...actor, choices, inputs },
        },
      },
    },
  };
}

function removedFormDependencyImpacts(
  state: TrackerState,
  candidate: TrackerState,
  entryId: string,
  actorId: string,
): FormDependencyImpact[] {
  const removed = [...activeFormHandles(state, entryId, actorId)].filter(
    (handle) => !activeFormHandles(candidate, entryId, actorId).has(handle),
  );
  const packageItem = packageForEntry(state, entryId)?.document;
  const actor = state.jumpState[entryId]?.actors[actorId];
  if (!removed.length || !packageItem || !actor) return [];
  return removed.flatMap((formHandle) => {
    const dependentChoiceHandles = packageItem.choices
      .filter(
        (choice) =>
          choiceStateIsActive(packageItem, actor, choice) &&
          choice.grants.some((grant) => grant.form === formHandle),
      )
      .map((choice) => choice.handle);
    return dependentChoiceHandles.length
      ? [{ kind: "form-perk" as const, formHandle, dependentChoiceHandles }]
      : [];
  });
}

export function choiceMutationWasBlocked(
  state: TrackerState,
  nextState: TrackerState,
  action: TrackerAction,
) {
  if (
    state.preferences.allowNegativePointBalances ||
    nextState !== state ||
    !("entryId" in action) ||
    !("actorId" in action)
  )
    return false;
  const actor = state.jumpState[action.entryId]?.actors[action.actorId];
  if (action.type === "set-choice")
    return actor?.choices[action.choiceHandle] !== action.value;
  if (action.type === "set-source-selections")
    return actor?.sourceSelections[action.sourceKey] !== action.value;
  if (action.type === "record-choice-roll")
    return actor?.choiceRolls[action.choiceHandle]?.result !== action.result;
  if (action.type === "record-source-roll")
    return actor?.sourceRolls[action.sourceKey]?.result !== action.result;
  return false;
}

function applyMove(state: TrackerState, entryId: string, toIndex: number) {
  if (state.entries[entryId]?.kind === "earth") return state;
  const from = state.order.indexOf(entryId);
  if (from < 0) return state;
  const order = [...state.order];
  order.splice(from, 1);
  order.splice(Math.max(1, Math.min(toIndex, order.length)), 0, entryId);
  return { ...state, order };
}

function applyRemove(state: TrackerState, entryId: string) {
  if (state.entries[entryId]?.kind === "earth") return state;
  if (state.order.length <= 1) return state;
  const removedIndex = state.order.indexOf(entryId);
  if (removedIndex < 0) return state;
  const order = state.order.filter((id) => id !== entryId);
  const entries = { ...state.entries };
  delete entries[entryId];
  const jumpState = { ...state.jumpState };
  delete jumpState[entryId];
  const entrySupplements = { ...state.entrySupplements };
  delete entrySupplements[entryId];
  const fallback = order[Math.min(removedIndex, order.length - 1)];
  return {
    ...state,
    entries,
    order,
    jumpState,
    entrySupplements,
    selectedEntryId:
      state.selectedEntryId === entryId ? fallback : state.selectedEntryId,
    inspectionPointId:
      state.inspectionPointId === entryId ? fallback : state.inspectionPointId,
  };
}

export function trackerReducer(
  state: TrackerState,
  action: TrackerAction,
): TrackerState {
  switch (action.type) {
    case "apply-application-settings":
      return {
        ...state,
        preferences: action.preferences,
        tags: action.tags,
      };
    case "set-page":
      return { ...state, page: action.page };
    case "set-rail-page":
      return { ...state, railPage: action.page };
    case "select-entry":
      return state.entries[action.entryId]
        ? {
            ...state,
            selectedEntryId: action.entryId,
            inspectionPointId: action.entryId,
            page: "jump",
            railPage: "chain",
          }
        : state;
    case "set-inspection":
      return state.entries[action.entryId]
        ? { ...state, inspectionPointId: action.entryId }
        : state;
    case "request-move": {
      if (state.entries[action.entryId]?.kind === "earth") return state;
      const impacts = moveDependencyImpacts(
        state,
        action.entryId,
        action.toIndex,
      );
      if (!state.preferences.warnUpstreamChanges || !impacts.length)
        return {
          ...applyMove(state, action.entryId, action.toIndex),
          undo: snapshot(state, "Reorder"),
        };
      return { ...state, pending: { ...action, kind: "move", impacts } };
    }
    case "request-remove": {
      if (state.entries[action.entryId]?.kind === "earth") return state;
      const impacts = removeDependencyImpacts(state, action.entryId);
      if (!state.preferences.warnUpstreamChanges || !impacts.length)
        return {
          ...applyRemove(state, action.entryId),
          undo: snapshot(state, "Remove Jump"),
        };
      return {
        ...state,
        pending: { kind: "remove", entryId: action.entryId, impacts },
      };
    }
    case "cancel-mutation":
      return { ...state, pending: null };
    case "commit-mutation": {
      if (!state.pending) return state;
      if (
        state.pending.kind === "clear-form" ||
        state.pending.kind === "clear-form-source"
      ) {
        const pending = state.pending;
        const entry = state.jumpState[pending.entryId];
        if (!entry) return { ...state, pending: null };
        const actor = entry.actors[pending.actorId] ?? emptyActorEntryState();
        const candidate: TrackerState = {
          ...state,
          pending: null,
          jumpState: {
            ...state.jumpState,
            [pending.entryId]: {
              ...entry,
              actors: {
                ...entry.actors,
                [pending.actorId]:
                  pending.kind === "clear-form"
                    ? {
                        ...actor,
                        choices: {
                          ...actor.choices,
                          [pending.choiceHandle]: pending.value,
                        },
                      }
                    : {
                        ...actor,
                        sourceSelections: {
                          ...actor.sourceSelections,
                          [pending.sourceKey]: pending.value,
                        },
                      },
              },
            },
          },
        };
        return cascadeRemovedFormDependencies(
          state,
          candidate,
          pending.entryId,
          pending.actorId,
        );
      }
      const next =
        state.pending.kind === "move"
          ? applyMove(state, state.pending.entryId, state.pending.toIndex)
          : applyRemove(state, state.pending.entryId);
      return {
        ...next,
        pending: null,
        undo: snapshot(
          state,
          state.pending.kind === "move" ? "Reorder" : "Remove Jump",
        ),
      };
    }
    case "undo":
      return state.undo
        ? {
            ...state,
            entries: state.undo.entries,
            order: state.undo.order,
            selectedEntryId: state.undo.selectedEntryId,
            inspectionPointId: state.undo.inspectionPointId,
            jumpState: state.undo.jumpState,
            entrySupplements: state.undo.entrySupplements,
            undo: null,
          }
        : state;
    case "dismiss-undo":
      return state.undo ? { ...state, undo: null } : state;
    case "install-package": {
      const packageItem = action.packageItem;
      if (
        !packageItem.exactHash ||
        state.packages[packageItem.id]?.exactHash === packageItem.exactHash
      )
        return state;
      return {
        ...state,
        packages: {
          ...state.packages,
          [packageItem.id]: packageItem,
        },
        librarySource: "imported",
        librarySearch: "",
      };
    }
    case "add-package": {
      const packageItem = state.packages[action.packageId];
      if (!packageItem) return state;
      const existing = state.order.find(
        (id) => state.entries[id].packageExactHash === packageItem.exactHash,
      );
      if (existing && !state.preferences.allowDuplicateJumps)
        return trackerReducer(state, {
          type: "select-entry",
          entryId: existing,
        });
      const parallel = state.order.find(
        (id) =>
          state.packages[state.entries[id].packageId]?.logicalId ===
          packageItem.logicalId,
      );
      if (
        parallel &&
        !existing &&
        !state.preferences.allowMultiplePackageVersions
      )
        return trackerReducer(state, {
          type: "select-entry",
          entryId: parallel,
        });
      const id = `entry-${state.nextEntrySerial}`;
      return {
        ...state,
        entries: {
          ...state.entries,
          [id]: {
            id,
            packageId: action.packageId,
            packageExactHash: packageItem.exactHash ?? "unresolved",
            kind: "jump",
            status: "No choices",
          },
        },
        jumpState: { ...state.jumpState, [id]: emptyJumpEntryState() },
        entrySupplements: {
          ...state.entrySupplements,
          [id]: {
            quest: { ...state.supplements.quest, checked: [], switching: [] },
            uds: { ...state.supplements.uds, jump: [], hiatus: [] },
          },
        },
        order: [...state.order, id],
        selectedEntryId: id,
        inspectionPointId: id,
        railPage: "chain",
        page: "jump",
        nextEntrySerial: state.nextEntrySerial + 1,
      };
    }
    case "set-library-search":
      return { ...state, librarySearch: action.value };
    case "set-library-source":
      return { ...state, librarySource: action.value };
    case "set-inventory-view":
      return { ...state, inventoryView: action.value };
    case "set-inventory-kind":
      return { ...state, inventoryKind: action.value };
    case "set-inventory-tag":
      return { ...state, inventoryTag: action.value };
    case "set-inventory-search":
      return { ...state, inventorySearch: action.value };
    case "set-radar-sort":
      return { ...state, radarSort: action.value };
    case "select-radar-category":
      return {
        ...state,
        radarCategory: action.value,
        radarPath: [],
        radarPoppedSlice: null,
      };
    case "open-radar-node":
      return {
        ...state,
        radarPath: [...state.radarPath, action.value],
        radarPoppedSlice: null,
      };
    case "set-radar-path":
      return {
        ...state,
        radarPath: action.value,
        radarPoppedSlice: null,
      };
    case "toggle-radar-slice":
      return {
        ...state,
        radarPoppedSlice:
          state.radarPoppedSlice === action.value ? null : action.value,
      };
    case "radar-back":
      return state.radarPath.length
        ? {
            ...state,
            radarPath: state.radarPath.slice(0, -1),
            radarPoppedSlice: null,
          }
        : { ...state, radarCategory: null, radarPoppedSlice: null };
    case "open-record":
      return { ...state, selectedRecordId: action.id };
    case "select-form":
      return { ...state, selectedFormId: action.id };
    case "select-companion":
      return { ...state, selectedCompanionId: action.id };
    case "open-profile":
      return { ...state, activeProfile: action.profile };
    case "close-dialogs":
      return {
        ...state,
        selectedRecordId: null,
        activeProfile: null,
        pending: null,
      };
    case "set-choice": {
      if (
        choiceEditingIsLocked(
          state,
          action.entryId,
          action.actorId,
          action.choiceHandle,
        )
      )
        return state;
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      let candidate: TrackerState = {
        ...state,
        jumpState: {
          ...state.jumpState,
          [action.entryId]: {
            ...entry,
            actors: {
              ...entry.actors,
              [action.actorId]: {
                ...actor,
                choices: {
                  ...actor.choices,
                  [action.choiceHandle]: action.value,
                },
              },
            },
          },
        },
      };
      const formImpacts = removedFormDependencyImpacts(
        state,
        candidate,
        action.entryId,
        action.actorId,
      );
      if (formImpacts.length)
        return {
          ...state,
          pending: {
            kind: "clear-form",
            entryId: action.entryId,
            actorId: action.actorId,
            choiceHandle: action.choiceHandle,
            value: action.value,
            impacts: formImpacts,
          },
        };
      candidate = cascadeRemovedFormDependencies(
        state,
        candidate,
        action.entryId,
        action.actorId,
      );
      const choice = packageForEntry(
        candidate,
        action.entryId,
      )?.document?.choices.find((item) => item.handle === action.choiceHandle);
      const targets =
        choice?.grants.flatMap((grant) => (grant.form ? [grant.form] : [])) ??
        [];
      if (
        actionActivatesChoice(
          state,
          action.entryId,
          action.choiceHandle,
          action.value,
        ) &&
        targets.some(
          (target) =>
            !activeFormHandles(candidate, action.entryId, action.actorId).has(
              target,
            ),
        )
      )
        return state;
      return enforceBalancePolicy(
        state,
        candidate,
        action.entryId,
        action.actorId,
        actionActivatesChoice(
          state,
          action.entryId,
          action.choiceHandle,
          action.value,
        ),
      );
    }
    case "set-source-selections": {
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      if (
        sectionIsLocked(
          state,
          action.entryId,
          action.actorId,
          action.sourceKey.split(":", 1)[0],
        )
      )
        return state;
      const packageItem = packageForEntry(state, action.entryId)?.document;
      const sourceContext = packageItem?.sections
        .flatMap((section) =>
          section.sources.map((source) => ({
            key: `${section.handle}:${source.handle}`,
            source,
          })),
        )
        .find((item) => item.key === action.sourceKey);
      if (!packageItem || !sourceContext) return state;
      const allowed = new Set(
        packageItem.choices
          .filter(
            (choice) =>
              sourceContext.source.group !== undefined &&
              choice.groups.includes(sourceContext.source.group),
          )
          .map((choice) => choice.handle),
      );
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      const uniqueValue = [
        ...new Set(action.value.filter((handle) => allowed.has(handle))),
      ];
      const value =
        sourceContext.source.mode === "single"
          ? uniqueValue.slice(-1)
          : sourceContext.source.max &&
              uniqueValue.length > sourceContext.source.max
            ? uniqueValue.length <
              (actor.sourceSelections[action.sourceKey]?.length ?? 0)
              ? uniqueValue
              : (actor.sourceSelections[action.sourceKey] ?? []).filter(
                  (handle) => allowed.has(handle),
                )
            : uniqueValue;
      let candidate: TrackerState = {
        ...state,
        jumpState: {
          ...state.jumpState,
          [action.entryId]: {
            ...entry,
            actors: {
              ...entry.actors,
              [action.actorId]: {
                ...actor,
                sourceSelections: {
                  ...actor.sourceSelections,
                  [action.sourceKey]: value,
                },
              },
            },
          },
        },
      };
      const formImpacts = removedFormDependencyImpacts(
        state,
        candidate,
        action.entryId,
        action.actorId,
      );
      if (formImpacts.length)
        return {
          ...state,
          pending: {
            kind: "clear-form-source",
            entryId: action.entryId,
            actorId: action.actorId,
            sourceKey: action.sourceKey,
            value,
            impacts: formImpacts,
          },
        };
      candidate = cascadeRemovedFormDependencies(
        state,
        candidate,
        action.entryId,
        action.actorId,
      );
      const previous = actor.sourceSelections[action.sourceKey] ?? [];
      return enforceBalancePolicy(
        state,
        candidate,
        action.entryId,
        action.actorId,
        value.some((handle) => !previous.includes(handle)),
      );
    }
    case "set-input": {
      if (
        choiceEditingIsLocked(
          state,
          action.entryId,
          action.actorId,
          action.choiceHandle,
        )
      )
        return state;
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      const candidate: TrackerState = {
        ...state,
        jumpState: {
          ...state.jumpState,
          [action.entryId]: {
            ...entry,
            actors: {
              ...entry.actors,
              [action.actorId]: {
                ...actor,
                inputs: {
                  ...actor.inputs,
                  [action.choiceHandle]: {
                    ...actor.inputs[action.choiceHandle],
                    [action.inputHandle]: action.value,
                  },
                },
              },
            },
          },
        },
      };
      const input = packageForEntry(candidate, action.entryId)
        ?.document?.choices.find(
          (choice) => choice.handle === action.choiceHandle,
        )
        ?.inputs.find((item) => item.handle === action.inputHandle);
      const activeValue = Array.isArray(action.value)
        ? action.value.length > 0
        : action.value !== null && action.value !== "";
      if (
        activeValue &&
        input?.grants.some(
          (grant) =>
            grant.form &&
            !activeFormHandles(candidate, action.entryId, action.actorId).has(
              grant.form,
            ),
        )
      )
        return state;
      return candidate;
    }
    case "set-enabled-supplements":
      return { ...state, enabledSupplements: action.value };
    case "set-supplement-page":
      return { ...state, supplementPage: action.value };
    case "set-body-mod":
      return { ...state, bodyMod: action.value };
    case "supplement-action":
      if (
        action.action.type === "quest" ||
        action.action.type === "uds" ||
        action.action.type === "realityProgress"
      ) {
        const current = state.entrySupplements[state.selectedEntryId] ?? {
          quest: state.supplements.quest,
          uds: state.supplements.uds,
        };
        const next = supplementReducer(
          {
            ...state.supplements,
            quest: current.quest,
            uds: current.uds,
            reality: {
              ...state.supplements.reality,
              progression:
                current.realityProgression ??
                state.supplements.reality.progression,
            },
          },
          action.action,
        );
        return {
          ...state,
          entrySupplements: {
            ...state.entrySupplements,
            [state.selectedEntryId]: {
              quest: next.quest,
              uds: next.uds,
              realityProgression: next.reality.progression,
            },
          },
        };
      }
      return {
        ...state,
        supplements: supplementReducer(state.supplements, action.action),
      };
    case "record-choice-roll": {
      if (
        choiceEditingIsLocked(
          state,
          action.entryId,
          action.actorId,
          action.choiceHandle,
        )
      )
        return state;
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      const previousSequence =
        actor.choiceRolls[action.choiceHandle]?.sequence ?? 0;
      const candidate: TrackerState = {
        ...state,
        jumpState: {
          ...state.jumpState,
          [action.entryId]: {
            ...entry,
            actors: {
              ...entry.actors,
              [action.actorId]: {
                ...actor,
                choices: {
                  ...actor.choices,
                  [action.choiceHandle]: action.result,
                },
                choiceRolls: {
                  ...actor.choiceRolls,
                  [action.choiceHandle]: {
                    result: action.result,
                    sequence: previousSequence + 1,
                  },
                },
              },
            },
          },
        },
      };
      return enforceBalancePolicy(
        state,
        candidate,
        action.entryId,
        action.actorId,
        actionActivatesChoice(
          state,
          action.entryId,
          action.choiceHandle,
          action.result,
        ),
      );
    }
    case "record-source-roll": {
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      if (
        sectionIsLocked(
          state,
          action.entryId,
          action.actorId,
          action.sourceKey.split(":", 1)[0],
        )
      )
        return state;
      const packageItem = packageForEntry(state, action.entryId)?.document;
      const source = packageItem?.sections
        .flatMap((section) =>
          section.sources.map((candidate) => ({
            key: `${section.handle}:${candidate.handle}`,
            source: candidate,
          })),
        )
        .find((candidate) => candidate.key === action.sourceKey)?.source;
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      const previousSequence =
        actor.sourceRolls[action.sourceKey]?.sequence ?? 0;
      const previousResult = actor.sourceRolls[action.sourceKey]?.result;
      if (
        source?.mode === "multi" &&
        source.max !== undefined &&
        !previousResult &&
        (actor.sourceSelections[action.sourceKey]?.length ?? 0) >= source.max
      )
        return state;
      const sourceSelections =
        (source?.mode ?? action.mode) === "single"
          ? [action.result]
          : [
              ...(actor.sourceSelections[action.sourceKey] ?? []).filter(
                (handle) =>
                  handle !== previousResult && handle !== action.result,
              ),
              action.result,
            ];
      const candidate: TrackerState = {
        ...state,
        jumpState: {
          ...state.jumpState,
          [action.entryId]: {
            ...entry,
            actors: {
              ...entry.actors,
              [action.actorId]: {
                ...actor,
                sourceSelections: {
                  ...actor.sourceSelections,
                  [action.sourceKey]: sourceSelections,
                },
                sourceRolls: {
                  ...actor.sourceRolls,
                  [action.sourceKey]: {
                    result: action.result,
                    sequence: previousSequence + 1,
                  },
                },
              },
            },
          },
        },
      };
      return enforceBalancePolicy(
        state,
        candidate,
        action.entryId,
        action.actorId,
        actionActivatesChoice(state, action.entryId, action.result, true),
      );
    }
    case "toggle-applied-gauntlet": {
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      const active = entry.appliedGauntlet.some((item) => item.id === "manual");
      return {
        ...state,
        jumpState: {
          ...state.jumpState,
          [action.entryId]: {
            ...entry,
            appliedGauntlet: active
              ? entry.appliedGauntlet.filter((item) => item.id !== "manual")
              : [
                  ...entry.appliedGauntlet,
                  { id: "manual", kind: "user", label: "Applied by user" },
                ],
          },
        },
      };
    }
  }
}
import type {
  EvaluatedActorJump,
  EvaluatedJumpRuntime,
  EvaluatedProperty,
} from "../domain";
import {
  choiceStateIsActive,
  choiceValueIsActive,
  emptyActorEntryState,
  emptyJumpEntryState,
  evaluateChain,
} from "../domain";
import { supplementEvaluationInputs } from "./supplementEvaluation";
import {
  supplementReducer,
  type SupplementState,
} from "../supplements/supplementState";

export type { EvaluatedActorJump, EvaluatedJumpRuntime, EvaluatedProperty };

export function supplementStateForEntry(
  state: TrackerState,
  entryId = state.selectedEntryId,
): SupplementState {
  const entryState = state.entrySupplements[entryId];
  const storyJumps = state.order.flatMap((id) => {
    if (state.entries[id]?.kind !== "jump") return [];
    const existing = state.supplements.story.jumps.find(
      (jump) => jump.id === id,
    );
    return [
      existing ?? {
        id,
        name:
          state.packages[state.entries[id].packageId]?.name ??
          "Unavailable Jump",
        chapters: [],
      },
    ];
  });
  return {
    ...state.supplements,
    story: { ...state.supplements.story, jumps: storyJumps },
    quest: entryState?.quest ?? state.supplements.quest,
    uds: entryState?.uds ?? state.supplements.uds,
    reality: {
      ...state.supplements.reality,
      progression:
        entryState?.realityProgression ?? state.supplements.reality.progression,
    },
  };
}
