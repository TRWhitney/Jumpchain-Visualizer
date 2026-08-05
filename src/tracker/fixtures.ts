import { emptyActorEntryState, emptyJumpEntryState } from "../domain";
import {
  MOCK_CHAIN_ID,
  mockInstalledPackages,
  mockPackageIds,
} from "../fixtures/mockData";
import { builtinTagDefinitions } from "../settings/builtinTags";
import {
  createUntouchedBodyModState,
  initialBodyModState,
} from "../supplements/bodyMod";
import {
  createUntouchedEnabledModules,
  initialEnabled,
} from "../supplements/model";
import {
  createUntouchedSupplementState,
  initialSupplementState,
} from "../supplements/supplementState";
import {
  EARTH_ENTRY_ID,
  EARTH_ENTRY_STATUS,
  EARTH_PACKAGE_ID,
  type Actor,
  type ChainEntry,
  type InstalledPackage,
  type TrackerPreferences,
  type TrackerState,
} from "./model";
import { evaluateTracker } from "./evaluateTracker";

export const trackerTags = builtinTagDefinitions;
export const DEMONSTRATION_CHAIN_ID = MOCK_CHAIN_ID;

const packageOrder = mockPackageIds;
const packageList: InstalledPackage[] = [...mockInstalledPackages];

export const installedPackages = packageList;

const earthPackage: InstalledPackage = {
  id: EARTH_PACKAGE_ID,
  logicalId: EARTH_PACKAGE_ID,
  name: "Earth",
  version: "1.0",
  source: "builtin",
  description: "The application-owned identity setup before Jump 1.",
  tags: [],
  availability: "foundation",
  exactHash: "earth-system-format-1",
};

export function reconcileDemonstrationPackageBindings(
  state: TrackerState,
  chainId: string,
): TrackerState {
  if (chainId !== DEMONSTRATION_CHAIN_ID) return state;
  const canonicalPackages = [earthPackage, ...packageList];
  const canonicalById = new Map(
    canonicalPackages.map((packageItem) => [packageItem.id, packageItem]),
  );
  let packages = state.packages;
  for (const packageItem of canonicalPackages) {
    if (packages[packageItem.id] === packageItem) continue;
    if (packages === state.packages) packages = { ...state.packages };
    packages[packageItem.id] = packageItem;
  }
  let entries = state.entries;
  for (const [entryId, entry] of Object.entries(state.entries)) {
    const packageItem = canonicalById.get(entry.packageId);
    if (
      !packageItem?.exactHash ||
      entry.packageExactHash === packageItem.exactHash
    )
      continue;
    if (entries === state.entries) entries = { ...state.entries };
    entries[entryId] = {
      ...entry,
      packageExactHash: packageItem.exactHash,
    };
  }
  return packages === state.packages && entries === state.entries
    ? state
    : { ...state, packages, entries };
}

const jumper: Actor = {
  id: "jumper",
  name: "Morgan",
  role: "Jumper",
  initials: "MO",
  summary: "A traveler following the three gates of the demonstration chain.",
};

const activeActor = (
  packageId: string,
  choices: ReturnType<typeof emptyActorEntryState>["choices"],
  inputs: ReturnType<typeof emptyActorEntryState>["inputs"] = {},
) => {
  const packageItem = packageList.find(
    (item) => item.id === packageId,
  )?.document;
  const sourceSelections = packageItem
    ? Object.fromEntries(
        packageItem.sections.flatMap((section) =>
          section.sources.map((source) => [
            `${section.handle}:${source.handle}`,
            packageItem.choices
              .filter(
                (choice) =>
                  source.group &&
                  choice.groups.includes(source.group) &&
                  Object.hasOwn(choices, choice.handle),
              )
              .map((choice) => choice.handle),
          ]),
        ),
      )
    : {};
  return {
    ...emptyActorEntryState(),
    choices,
    inputs,
    sourceSelections,
  };
};

const makeEntries = () =>
  Object.fromEntries(
    packageOrder.map((packageId, index): [string, ChainEntry] => [
      `entry-${index}`,
      {
        id: `entry-${index}`,
        packageId,
        packageExactHash:
          packageList.find((item) => item.id === packageId)?.exactHash ??
          "unresolved",
        kind: "jump",
        status: "Curated demonstration state",
      },
    ]),
  );

const lyraId = "companion:entry-0:jumper:lyra_companion:0";

function createCuratedJumpState() {
  const result = Object.fromEntries(
    [EARTH_ENTRY_ID, "entry-0", "entry-1", "entry-2"].map((entryId) => [
      entryId,
      emptyJumpEntryState(),
    ]),
  );
  result[EARTH_ENTRY_ID].actors.jumper = activeActor(EARTH_PACKAGE_ID, {
    earth_gender: "Female",
    earth_age: 28,
  });
  result["entry-0"].actors.jumper = activeActor(
    packageOrder[0],
    {
      roadborn_origin: true,
      threshold_alias: "Wayfinder",
      remembered_years: 0,
      gate_scholar: true,
      threshold_training: 2,
      spare_keys: 3,
      travelers_pack: true,
      many_pockets: true,
      threshold_blessing: true,
      lyra_companion: true,
      quiet_witness: true,
      custom_door: true,
    },
    {
      custom_door: {
        door_name: "Homeward",
        door_count: 2,
        door_material: "Brass",
      },
    },
  );
  result["entry-1"].actors.jumper = activeActor(
    packageOrder[1],
    {
      engine_tier: 3,
      engine_path: "Synthesis",
      engine_enabled: true,
      confluence_gender: "Female",
      debt_offset: true,
      multi_resource_lens: true,
      adaptive_mastery: 3,
      explicit_resonance_rank: 2,
      facet_crates: 3,
      layered_trait: 2,
      calibrated_cache: true,
      prism_form: true,
      refractive_hide: true,
      spectrum_mind: true,
      conditional_signal: true,
      second_path_anchor: true,
      second_path_compass: true,
      implicit_expansion: true,
    },
    { calibrated_cache: { cache_quantity: 3 } },
  );
  result["entry-2"].actors.jumper = {
    ...activeActor(
      packageOrder[2],
      {
        trial_stipend: true,
        trial_oath: true,
        trial_name: "Wayfinder's End",
        extra_attempts: 0,
        manual_training: 2,
        random_age: 27,
        random_training: 3,
        power_rank: 2,
        technique_ranks: 3,
        starting_region: "Central Arena",
        destiny: "Guide",
        element: "Wind",
        danger_stipend: "Accept",
        trial_requisition: "Field Kit",
        trial_gender: "Female",
        manual_scholar: true,
        random_scholar: true,
        either_scholar: true,
        random_flight: true,
        either_flight: true,
        aster_companion: true,
        sentinel_companion: true,
        trial_company: [lyraId],
        company_training: true,
      },
      {},
    ),
    choiceRolls: {
      random_age: { result: 27, sequence: 1 },
      random_training: { result: 3, sequence: 1 },
      power_rank: { result: 1, sequence: 1 },
      technique_ranks: { result: 2, sequence: 1 },
      destiny: { result: "Guide", sequence: 1 },
      element: { result: "Fire", sequence: 1 },
      danger_stipend: { result: "Accept", sequence: 1 },
      trial_requisition: { result: "Field Kit", sequence: 1 },
    },
    sourceRolls: {
      "single_random:assignment": { result: "random_scholar", sequence: 1 },
      "single_either:assignment": { result: "either_scholar", sequence: 1 },
      "multi_random:electives": { result: "random_flight", sequence: 1 },
      "multi_either:electives": { result: "either_flight", sequence: 1 },
    },
  };
  result["entry-2"].actors[lyraId] = activeActor(packageOrder[2], {
    trial_stipend: true,
    manual_scholar: true,
    manual_flight: true,
    random_flight: true,
    either_flight: true,
    participant_resilience: true,
    participant_kit: true,
    participant_identity: "Female",
  });
  return result;
}

const defaultPreferences: TrackerPreferences = {
  warnUpstreamChanges: false,
  allowMultiplePackageVersions: false,
  allowDuplicateJumps: false,
  allowNegativePointBalances: false,
  allowRerolls: false,
  includeItemTagsInRadar: false,
  aggregateSimilarInventory: true,
  showAdditionalJumpInformation: false,
  showMockData: true,
};

const demonstrationEnabledSupplements = {
  ...initialEnabled,
  "quest-mode": false,
};

const supplementEntryState = (entryId: string) =>
  structuredClone({
    quest: {
      ...initialSupplementState.quest,
      checked:
        entryId === "entry-2" ? initialSupplementState.quest.checked : [],
    },
    uds: {
      ...initialSupplementState.uds,
      chain: entryId === "entry-2" ? initialSupplementState.uds.chain : [],
      jump: entryId === "entry-2" ? initialSupplementState.uds.jump : [],
    },
  });

export function createDenseTrackerFixture(
  preferences: Partial<TrackerPreferences> = {},
): TrackerState {
  const order = [EARTH_ENTRY_ID, "entry-0", "entry-1", "entry-2"];
  return {
    chainName: "Morgan",
    packages: Object.fromEntries(
      [earthPackage, ...packageList].map((item) => [item.id, item]),
    ),
    entries: {
      [EARTH_ENTRY_ID]: {
        id: EARTH_ENTRY_ID,
        packageId: EARTH_PACKAGE_ID,
        packageExactHash: earthPackage.exactHash!,
        kind: "earth",
        status: EARTH_ENTRY_STATUS,
      },
      ...makeEntries(),
    },
    order,
    jumpState: createCuratedJumpState(),
    enabledSupplements: demonstrationEnabledSupplements,
    supplementPage: "manage",
    bodyMod: structuredClone(initialBodyModState),
    supplements: structuredClone(initialSupplementState),
    entrySupplements: Object.fromEntries(
      order.map((entryId) => [entryId, supplementEntryState(entryId)]),
    ),
    actors: { jumper: structuredClone(jumper) },
    records: [],
    forms: [],
    companions: [],
    tags: trackerTags,
    preferences: { ...defaultPreferences, ...preferences },
    selectedEntryId: "entry-2",
    inspectionPointId: "entry-2",
    page: "jump",
    railPage: "chain",
    inventoryView: "search",
    inventoryKind: "all",
    inventoryTag: "all",
    inventorySearch: "",
    librarySource: "all",
    librarySearch: "",
    radarSort: "count",
    radarCategory: null,
    radarPath: [],
    radarPoppedSlice: null,
    selectedRecordId: null,
    selectedFormId: null,
    selectedCompanionId: null,
    activeProfile: null,
    pending: null,
    undo: null,
    nextEntrySerial: 3,
  };
}

export function createCompanionProfileTrackerFixture(
  preferences: Partial<TrackerPreferences> = {},
) {
  return createDenseTrackerFixture(preferences);
}

export function createSparseRadarTrackerFixture(
  preferences: Partial<TrackerPreferences> = {},
) {
  const state = createDenseTrackerFixture(preferences);
  const cached = evaluateTracker(state, state.bodyMod);
  const sparseRecords = [
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `sparse-mental-${index + 1}`,
      kind: "perk" as const,
      name: `Mental fixture ${index + 1}`,
      sourceEntryId: "entry-2",
      grantHandle: `sparse_mental_${index + 1}`,
      sourcePackageId: state.entries["entry-2"].packageId,
      sourcePackageExactHash: state.entries["entry-2"].packageExactHash,
      ownerActorId: "jumper",
      tags: ["mental"],
      description: "Sparse radar geometry fixture.",
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `sparse-stealth-${index + 1}`,
      kind: "perk" as const,
      name: `Stealth fixture ${index + 1}`,
      sourceEntryId: "entry-2",
      grantHandle: `sparse_stealth_${index + 1}`,
      sourcePackageId: state.entries["entry-2"].packageId,
      sourcePackageExactHash: state.entries["entry-2"].packageExactHash,
      ownerActorId: "jumper",
      tags: ["stealth"],
      description: "Sparse radar geometry fixture.",
    })),
  ];
  return {
    ...state,
    entries: Object.fromEntries(
      Object.entries(state.entries).map(([entryId, entry]) => [
        entryId,
        entry.kind === "earth"
          ? entry
          : { ...entry, packageExactHash: `sparse-radar-${entryId}` },
      ]),
    ),
    lastValidatedEvaluation: {
      ...cached,
      records: sparseRecords,
      forms: [],
      companions: [],
    },
  };
}

export function createReferenceTrackerFixture() {
  return createDenseTrackerFixture();
}

export function createBlankTrackerFixture(name = "New Chain"): TrackerState {
  const base = createDenseTrackerFixture();
  const supplements = createUntouchedSupplementState();
  return {
    ...base,
    chainName: name,
    entries: { [EARTH_ENTRY_ID]: base.entries[EARTH_ENTRY_ID] },
    order: [EARTH_ENTRY_ID],
    jumpState: {
      [EARTH_ENTRY_ID]: base.jumpState[EARTH_ENTRY_ID] ?? emptyJumpEntryState(),
    },
    enabledSupplements: createUntouchedEnabledModules(),
    bodyMod: createUntouchedBodyModState(),
    supplements,
    entrySupplements: {
      [EARTH_ENTRY_ID]: structuredClone({
        quest: supplements.quest,
        uds: supplements.uds,
      }),
    },
    actors: { jumper: structuredClone(jumper) },
    records: [],
    forms: [],
    companions: [],
    selectedEntryId: EARTH_ENTRY_ID,
    inspectionPointId: EARTH_ENTRY_ID,
    nextEntrySerial: 0,
  };
}
