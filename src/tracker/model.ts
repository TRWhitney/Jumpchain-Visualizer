import type { EvaluatedGrantMeasure } from "../domain";

export const trackerPages = [
  "jump",
  "inventory",
  "forms",
  "companions",
  "supplements",
] as const;
export type TrackerPage = (typeof trackerPages)[number];

export const tagCategories = [
  "social",
  "mental",
  "spiritual",
  "magic",
  "meta",
  "stealth",
  "physical",
  "combat",
  "defense",
  "crafting",
  "technology",
  "miscellaneous",
] as const;
export type TagCategory = (typeof tagCategories)[number];

export type TagDefinition = {
  id: string;
  label: string;
  parent?: string;
  aliases: readonly string[];
  color: string;
  to: string;
  style: "solid" | "soft" | "outline" | "gradient";
  presentation?: {
    background: "solid" | "gradient" | "transparent";
    colors: readonly string[];
    positions: readonly number[];
    angle: number;
    borderColor: string;
    borderWidth: "none" | "thin" | "medium";
    corners: "pill" | "rounded" | "square";
    padding: "compact" | "standard" | "roomy";
    textMode: "auto" | "custom";
    textColor: string;
    weight: "normal" | "medium" | "bold";
    fontStyle: "normal" | "italic";
    decoration: "none" | "underline" | "strike";
    textEffect: "none" | "outline" | "shadow" | "glow";
    animation: "none" | "rainbow" | "marquee" | "ghost" | "bounce";
  };
};

export type InstalledPackage = {
  id: string;
  logicalId: string;
  name: string;
  version: string;
  source: "builtin" | "imported";
  description: string;
  tags: readonly string[];
  availability?: "library" | "foundation";
  exactHash?: string;
  authors?: readonly string[];
  nativeGauntlet?: boolean;
  document?: CanonicalJumpPackage;
};

export type ChainEntry = {
  id: string;
  packageId: string;
  packageExactHash: string;
  kind: "earth" | "jump";
  status: string;
};

export type Actor = {
  id: string;
  name: string;
  role: "Jumper" | "Companion";
  acquisitionGender?: string;
  acquisitionAge?: number;
  joinedEntryId?: string;
  initials: string;
  summary: string;
};

export const EARTH_ENTRY_ID = "entry-earth";
export const EARTH_PACKAGE_ID = "system-earth";
export const EARTH_ENTRY_STATUS = "The Beginning";

export type IdentityProperty =
  "origin" | "species" | "location" | "gender" | "age";

export type InventoryRecord = {
  id: string;
  kind: "perk" | "item";
  name: string;
  sourceEntryId: string;
  ownerActorId: string;
  tags: readonly string[];
  description: string;
  measure?: EvaluatedGrantMeasure;
};

export type FormRecord = {
  id: string;
  name: string;
  sourceEntryId: string;
  subtitle: string;
  description: string;
  initials: string;
  details: readonly string[];
  perkRecordIds: readonly string[];
};

export type CompanionRecord = {
  actorId: string;
  sourceEntryId: string;
  tags: readonly string[];
  perkRecordIds: readonly string[];
  itemRecordIds: readonly string[];
  importedEntryIds: readonly string[];
};

export type TrackerPreferences = {
  warnUpstreamChanges: boolean;
  allowMultiplePackageVersions: boolean;
  allowNegativePointBalances: boolean;
  allowRerolls: boolean;
  showAdditionalJumpInformation: boolean;
};

export type DependencyImpact = {
  kind: "companion-import";
  subjectId: string;
  providerEntryId: string;
  consumerEntryIds: readonly string[];
};

export type PendingMutation =
  | {
      kind: "move";
      entryId: string;
      toIndex: number;
      impacts: readonly DependencyImpact[];
    }
  | {
      kind: "remove";
      entryId: string;
      impacts: readonly DependencyImpact[];
    };

type UndoSnapshot = {
  entries: Record<string, ChainEntry>;
  order: string[];
  selectedEntryId: string;
  inspectionPointId: string;
  jumpState: JumpRuntimeState;
  entrySupplements: TrackerState["entrySupplements"];
  label: string;
};

export type TrackerState = {
  chainName: string;
  packages: Record<string, InstalledPackage>;
  entries: Record<string, ChainEntry>;
  order: string[];
  jumpState: JumpRuntimeState;
  enabledSupplements: EnabledModules;
  supplementPage: "manage" | ModuleId;
  bodyMod: BodyModState;
  supplements: SupplementState;
  entrySupplements: Record<
    string,
    {
      quest: QuestState;
      uds: UdsState;
      realityProgression?: RealityState["progression"];
    }
  >;
  lastValidatedEvaluation?: ChainEvaluation;
  actors: Record<string, Actor>;
  records: readonly InventoryRecord[];
  forms: readonly FormRecord[];
  companions: readonly CompanionRecord[];
  tags: Record<string, TagDefinition>;
  preferences: TrackerPreferences;
  selectedEntryId: string;
  inspectionPointId: string;
  page: TrackerPage;
  railPage: "chain" | "library";
  inventoryView: "search" | "stats";
  inventoryKind: "all" | "perk" | "item";
  inventoryTag: string;
  inventorySearch: string;
  librarySource: "all" | "builtin" | "imported";
  librarySearch: string;
  radarSort: "count" | "tag";
  radarCategory: TagCategory | null;
  radarPath: string[];
  radarPoppedSlice: string | null;
  selectedRecordId: string | null;
  selectedFormId: string | null;
  selectedCompanionId: string | null;
  activeProfile: "form" | "companion" | null;
  pending: PendingMutation | null;
  undo: UndoSnapshot | null;
  nextEntrySerial: number;
};

export type TrackerAction =
  | {
      type: "apply-application-settings";
      preferences: TrackerPreferences;
      tags: Record<string, TagDefinition>;
    }
  | { type: "set-page"; page: TrackerPage }
  | { type: "set-rail-page"; page: "chain" | "library" }
  | { type: "select-entry"; entryId: string }
  | { type: "set-inspection"; entryId: string }
  | { type: "request-move"; entryId: string; toIndex: number }
  | { type: "request-remove"; entryId: string }
  | { type: "cancel-mutation" }
  | { type: "commit-mutation" }
  | { type: "undo" }
  | { type: "dismiss-undo" }
  | { type: "add-package"; packageId: string }
  | { type: "set-library-search"; value: string }
  | { type: "set-library-source"; value: TrackerState["librarySource"] }
  | { type: "set-inventory-view"; value: TrackerState["inventoryView"] }
  | { type: "set-inventory-kind"; value: TrackerState["inventoryKind"] }
  | { type: "set-inventory-tag"; value: string }
  | { type: "set-inventory-search"; value: string }
  | { type: "set-radar-sort"; value: TrackerState["radarSort"] }
  | { type: "select-radar-category"; value: TagCategory | null }
  | { type: "open-radar-node"; value: string }
  | { type: "set-radar-path"; value: string[] }
  | { type: "toggle-radar-slice"; value: string }
  | { type: "radar-back" }
  | { type: "open-record"; id: string | null }
  | { type: "select-form"; id: string | null }
  | { type: "select-companion"; id: string | null }
  | { type: "open-profile"; profile: TrackerState["activeProfile"] }
  | {
      type: "set-choice";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      value: boolean | string | number | null;
    }
  | {
      type: "set-input";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      inputHandle: string;
      value: string | number | readonly string[] | null;
    }
  | { type: "set-enabled-supplements"; value: EnabledModules }
  | { type: "set-supplement-page"; value: "manage" | ModuleId }
  | { type: "set-body-mod"; value: BodyModState }
  | { type: "supplement-action"; action: SupplementAction }
  | {
      type: "record-choice-roll";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      result: string | number;
    }
  | {
      type: "record-source-roll";
      entryId: string;
      actorId: string;
      sourceKey: string;
      result: string;
    }
  | { type: "toggle-applied-gauntlet"; entryId: string };

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function packageForEntry(state: TrackerState, entryId: string) {
  const entry = state.entries[entryId];
  const packageItem = state.packages[entry?.packageId];
  if (!entry || !packageItem) return packageItem;
  return entry.packageExactHash === packageItem.exactHash
    ? packageItem
    : { ...packageItem, document: undefined };
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

export function filteredInventory(state: TrackerState) {
  const terms = normalize(state.inventorySearch).split(/\s+/).filter(Boolean);
  return state.records.filter((record) => {
    if (record.ownerActorId !== "jumper") return false;
    if (!visibleAtInspection(state, record.sourceEntryId)) return false;
    if (state.inventoryKind !== "all" && record.kind !== state.inventoryKind)
      return false;
    if (
      state.inventoryTag !== "all" &&
      !record.tags.some((tag) => tagIsWithin(state, tag, state.inventoryTag))
    )
      return false;
    const entry = packageForEntry(state, record.sourceEntryId);
    const relatedTags = record.tags.flatMap((tag) => {
      const related: string[] = [];
      let current: string | undefined = tag;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        const definition: TagDefinition | undefined = state.tags[current];
        if (!definition) break;
        related.push(definition.label, ...definition.aliases);
        current = definition.parent;
      }
      return related;
    });
    const haystack = normalize(
      [
        record.name,
        record.description,
        entry?.name,
        ...record.tags,
        ...relatedTags,
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
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
    if (
      record.kind !== "perk" ||
      record.ownerActorId !== "jumper" ||
      !visibleAtInspection(state, record.sourceEntryId)
    )
      continue;
    for (const category of tagCategories)
      if (record.tags.some((tag) => tagIsWithin(state, tag, category)))
        result[category] += 1;
  }
  return result;
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
        record.kind === "perk" &&
        record.ownerActorId === "jumper" &&
        visibleAtInspection(state, record.sourceEntryId) &&
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
      const value = actor.choices[choice.handle];
      const active =
        choice.selection === "toggle"
          ? value === true
          : value !== null && value !== undefined && value !== "";
      if (!active) continue;
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
    for (const choice of packageItem.choices) {
      const hasImport = choice.inputs.some((input) =>
        input.grants.some((grant) => grant.kind === "companion-import"),
      );
      if (!hasImport) continue;
      for (const input of choice.inputs) {
        if (!input.grants.some((grant) => grant.kind === "companion-import"))
          continue;
        const selected = actor.inputs[choice.handle]?.[input.handle];
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
  const order = state.order.filter((id) => state.entries[id]?.kind === "jump");
  const supplementInputs = supplementEvaluationInputs(state, order);
  const result = evaluateChain({
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
  return result.runtime[entryId]?.actors[actorId]?.balance ?? 0;
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
  value: boolean | string | number | null,
) {
  const choice = packageForEntry(state, entryId)?.document?.choices.find(
    (item) => item.handle === choiceHandle,
  );
  return choice ? choiceValueIsActive(choice, value) : false;
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
    case "add-package": {
      const packageItem = state.packages[action.packageId];
      if (!packageItem) return state;
      const existing = state.order.find(
        (id) => state.entries[id].packageExactHash === packageItem.exactHash,
      );
      if (existing)
        return trackerReducer(state, {
          type: "select-entry",
          entryId: existing,
        });
      const parallel = state.order.find(
        (id) =>
          state.packages[state.entries[id].packageId]?.logicalId ===
          packageItem.logicalId,
      );
      if (parallel && !state.preferences.allowMultiplePackageVersions)
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
    case "set-choice": {
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
                choices: {
                  ...actor.choices,
                  [action.choiceHandle]: action.value,
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
          action.value,
        ),
      );
    }
    case "set-input": {
      const entry = state.jumpState[action.entryId];
      if (!entry) return state;
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      return {
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
      const actor = entry.actors[action.actorId] ?? emptyActorEntryState();
      const previousSequence =
        actor.sourceRolls[action.sourceKey]?.sequence ?? 0;
      const previousResult = actor.sourceRolls[action.sourceKey]?.result;
      const choices = { ...actor.choices };
      if (typeof previousResult === "string") choices[previousResult] = false;
      choices[action.result] = true;
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
                choices,
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
  ChainEvaluation,
  EvaluatedActorJump,
  EvaluatedJumpRuntime,
  EvaluatedProperty,
  JumpRuntimeState,
} from "../domain";
import {
  choiceValueIsActive,
  emptyActorEntryState,
  emptyJumpEntryState,
  evaluateChain,
} from "../domain";
import type { CanonicalJumpPackage } from "../markup";
import type { BodyModState } from "../supplements/bodyMod";
import type { EnabledModules, ModuleId } from "../supplements/model";
import { supplementEvaluationInputs } from "./supplementEvaluation";
import {
  supplementReducer,
  type QuestState,
  type RealityState,
  type SupplementAction,
  type SupplementState,
  type UdsState,
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
