import {
  EARTH_ENTRY_ID,
  EARTH_ENTRY_STATUS,
  EARTH_PACKAGE_ID,
  tagCategories,
  type Actor,
  type ChainEntry,
  type CompanionRecord,
  type FormRecord,
  type InstalledPackage,
  type InventoryRecord,
  type TagCategory,
  type TagDefinition,
  type TrackerPreferences,
  type TrackerState,
} from "./model";
import { builtinTagDefinitions } from "../settings/builtinTags";
import { emptyActorEntryState, emptyJumpEntryState } from "../domain";
import { validGeneratedJumpPackages } from "../fixtures/generatedPackages";
import { initialEnabled } from "../supplements/model";
import { initialBodyModState } from "../supplements/bodyMod";
import { initialSupplementState } from "../supplements/supplementState";

const categoryDetails: Record<
  TagCategory,
  Omit<TagDefinition, "id" | "parent" | "aliases"> & {
    children: readonly string[];
  }
> = {
  social: {
    label: "Social",
    color: "#a93572",
    to: "#7b2452",
    style: "soft",
    children: ["Charisma", "Leadership"],
  },
  mental: {
    label: "Mental",
    color: "#4f46a5",
    to: "#312e81",
    style: "gradient",
    children: ["Memory", "Learning"],
  },
  spiritual: {
    label: "Spiritual",
    color: "#16806f",
    to: "#0e594e",
    style: "outline",
    children: ["Soul", "Faith"],
  },
  magic: {
    label: "Magic",
    color: "#6d3bb3",
    to: "#45247a",
    style: "gradient",
    children: [
      "Pyrokinesis",
      "Cryokinesis",
      "Telekinesis",
      "Healing Magic",
      "Enchantment",
      "Divination",
      "Summoning",
      "Necromancy",
      "Illusion",
      "Runes",
      "Alchemy",
      "Astral Magic",
    ],
  },
  meta: {
    label: "Meta",
    color: "#7b3f8c",
    to: "#542a60",
    style: "outline",
    children: ["Chain Rules", "Choice Points"],
  },
  stealth: {
    label: "Stealth",
    color: "#475569",
    to: "#293443",
    style: "gradient",
    children: ["Concealment", "Infiltration"],
  },
  physical: {
    label: "Physical",
    color: "#a93645",
    to: "#7f2430",
    style: "solid",
    children: ["Strength", "Adaptation"],
  },
  combat: {
    label: "Combat",
    color: "#922b21",
    to: "#671e17",
    style: "solid",
    children: ["Martial Arts", "Weapons"],
  },
  defense: {
    label: "Defense",
    color: "#35755e",
    to: "#245241",
    style: "outline",
    children: ["Resistance", "Barriers"],
  },
  crafting: {
    label: "Crafting",
    color: "#9a4d00",
    to: "#6b3500",
    style: "soft",
    children: ["Enchanting", "Engineering"],
  },
  technology: {
    label: "Technology",
    color: "#2563a8",
    to: "#194777",
    style: "solid",
    children: ["Computing", "Vehicles"],
  },
  miscellaneous: {
    label: "Miscellaneous",
    color: "#68707c",
    to: "#454b54",
    style: "soft",
    children: ["Convenience", "Novelty"],
  },
};

const slug = (value: string) =>
  value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-");

export const trackerTags: Record<string, TagDefinition> = builtinTagDefinitions;

const installedTagStrings: Record<string, readonly string[]> = {
  "first-step": ["Adaptation", "Beginner's Luck", "Portable Home"],
  "arcane-realms": ["Magic", "Highcourt Etiquette", "Ley Line Attunement"],
  "cosmic-odyssey": ["Technology", "Xeno Navigation", "Vacuum Habitation"],
  "shadow-court": ["Stealth", "Moonlit Oath", "Immortal Politics"],
  "spirit-road": ["Spiritual", "Shrine Keeping", "Ancestor Dialogue"],
  "clockwork-sea": ["Vehicles", "Brass Seamanship", "Tidal Machinery"],
  "war-of-crowns": ["Combat", "Dynastic Claim", "Banner Command"],
  "last-horizon": ["Meta", "Boundary Walking", "Unmapped Reality"],
  "arcane-realms-v1-1": [
    "Magic",
    "Highcourt Etiquette",
    "Ley Line Attunement",
    "Living Grimoire",
  ],
  "hero-academy": ["Leadership", "Heroic Curriculum", "Team Exercise"],
  "ocean-depths": ["Aquatic", "Abyssal Pressure", "Submerged Culture"],
  "builder-world": ["Crafting", "Settlement Planning", "Civic Logistics"],
  "dream-archive": ["Mental", "Dream Indexing", "Mnemonic Shelves"],
  "mythic-kitchen": ["Cooking", "Legendary Ingredient", "Divine Hospitality"],
};

const legacyPackageList: InstalledPackage[] = [
  [
    "first-step",
    "first-step",
    "First Step",
    "1.0",
    "builtin",
    "Begin a chain with dependable foundations.",
  ],
  [
    "arcane-realms",
    "arcane-realms",
    "Arcane Realms",
    "1.0",
    "imported",
    "Build a life amid spellcraft and ancient kingdoms.",
  ],
  [
    "cosmic-odyssey",
    "cosmic-odyssey",
    "Cosmic Odyssey",
    "2.3",
    "imported",
    "Explore distant systems and stellar mysteries.",
  ],
  [
    "shadow-court",
    "shadow-court",
    "The Long Shadow Court",
    "1.2",
    "imported",
    "Navigate immortal intrigue beneath a moonless sky.",
  ],
  [
    "spirit-road",
    "spirit-road",
    "Pilgrims of the Spirit Road",
    "3.0",
    "builtin",
    "Walk between shrines, memories, and restless worlds.",
  ],
  [
    "clockwork-sea",
    "clockwork-sea",
    "Clockwork Sea",
    "1.8",
    "imported",
    "Sail mechanical oceans aboard an impossible vessel.",
  ],
  [
    "war-of-crowns",
    "war-of-crowns",
    "War of Seven Crowns",
    "4.1",
    "imported",
    "Shape a continent-wide struggle for succession.",
  ],
  [
    "last-horizon",
    "last-horizon",
    "Beyond the Last Horizon",
    "1.0",
    "builtin",
    "Cross the boundary at the end of mapped reality.",
  ],
  [
    "arcane-realms-v1-1",
    "arcane-realms",
    "Arcane Realms",
    "1.1",
    "imported",
    "A separately installed revision of Arcane Realms.",
  ],
  [
    "hero-academy",
    "hero-academy",
    "Hero Academy",
    "1.0",
    "builtin",
    "Train beside a new generation of heroes.",
  ],
  [
    "ocean-depths",
    "ocean-depths",
    "Ocean Depths",
    "1.4",
    "imported",
    "Descend into submerged civilizations.",
  ],
  [
    "builder-world",
    "builder-world",
    "Builder World",
    "1.0",
    "builtin",
    "Create settlements and infrastructure from nothing.",
  ],
  [
    "dream-archive",
    "dream-archive",
    "The Dream Archive",
    "2.0",
    "imported",
    "Recover stories from a library that dreams.",
  ],
  [
    "mythic-kitchen",
    "mythic-kitchen",
    "Mythic Kitchen",
    "1.3",
    "builtin",
    "Cook impossible meals for legendary patrons.",
  ],
].map(([id, logicalId, name, version, source, description]) => ({
  id,
  logicalId,
  name,
  version,
  source: source as InstalledPackage["source"],
  description,
  tags: installedTagStrings[id] ?? [],
}));

const legacyById = new Map(legacyPackageList.map((item) => [item.id, item]));
const corePackageOrder = [
  "first-step",
  "arcane-realms",
  "cosmic-odyssey",
  "shadow-court",
  "spirit-road",
  "clockwork-sea",
  "war-of-crowns",
  "last-horizon",
] as const;
const packageList: InstalledPackage[] = validGeneratedJumpPackages
  .map((document) => {
    const legacy = legacyById.get(document.id);
    return {
      id: document.id,
      logicalId: document.logicalId,
      name: document.name.base ?? document.id,
      version: document.version,
      source: document.source,
      description: legacy?.description ?? document.description,
      tags: [
        ...new Set([
          ...(legacy?.tags ?? []),
          ...document.tags,
          ...document.choices.flatMap((choice) => [
            ...choice.tags,
            ...choice.grants.flatMap((grant) => grant.tags),
          ]),
        ]),
      ],
      exactHash: document.exactHash,
      authors: document.authors,
      nativeGauntlet: document.nativeGauntlet,
      document,
    };
  })
  .sort((left, right) => {
    const leftIndex = corePackageOrder.indexOf(
      left.id as (typeof corePackageOrder)[number],
    );
    const rightIndex = corePackageOrder.indexOf(
      right.id as (typeof corePackageOrder)[number],
    );
    if (leftIndex >= 0 || rightIndex >= 0)
      return (
        (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex)
      );
    return left.name.localeCompare(right.name);
  });

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

const chainPackageIds = packageList.slice(0, 8).map((item) => item.id);

const actors: Record<string, Actor> = Object.fromEntries(
  [
    [
      "jumper",
      "Morgan",
      "Jumper",
      undefined,
      undefined,
      undefined,
      "MO",
      "A versatile traveler building a long and complicated chain.",
    ],
    [
      "ash",
      "Ash",
      "Companion",
      "Male",
      27,
      "entry-0",
      "AS",
      "Reliable traveler and support specialist.",
    ],
    [
      "mira",
      "Mira",
      "Companion",
      "Female",
      31,
      "entry-1",
      "MI",
      "Scholar of magic and careful cross-world researcher.",
    ],
    [
      "io",
      "Io",
      "Companion",
      "Nonbinary",
      29,
      "entry-2",
      "IO",
      "Pilot and systems specialist for unfamiliar technology.",
    ],
    [
      "vesper",
      "Vesper",
      "Companion",
      "Female",
      140,
      "entry-3",
      "VE",
      "Courtly negotiator with a gift for hidden motives.",
    ],
    [
      "orin",
      "Orin",
      "Companion",
      "Male",
      42,
      "entry-4",
      "OR",
      "Spirit guide, historian, and patient field medic.",
    ],
    [
      "cala",
      "Cala",
      "Companion",
      "Nonbinary",
      35,
      "entry-5",
      "CA",
      "Engineer who keeps impossible machines working.",
    ],
    [
      "ren",
      "Ren",
      "Companion",
      "Female",
      33,
      "entry-6",
      "RE",
      "Tactician and veteran of the War of Seven Crowns.",
    ],
  ].map(
    ([
      id,
      name,
      role,
      acquisitionGender,
      acquisitionAge,
      joinedEntryId,
      initials,
      summary,
    ]) => [
      id,
      {
        id,
        name,
        role,
        acquisitionGender,
        acquisitionAge,
        joinedEntryId,
        initials,
        summary,
      } as Actor,
    ],
  ),
);

const seedRecords: InventoryRecord[] = [
  [
    "record-0",
    "perk",
    "Body Calibration",
    "entry-0",
    "jumper",
    ["physical", "adaptation"],
    "Your body adjusts quickly to unfamiliar environments while maintaining a dependable baseline.",
  ],
  [
    "record-1",
    "item",
    "Traveler’s Pack",
    "entry-0",
    "jumper",
    ["miscellaneous", "convenience"],
    "A durable pack whose ordinary compartments keep essential supplies ready to hand.",
  ],
  [
    "record-2",
    "perk",
    "Quick Study",
    "entry-1",
    "jumper",
    ["mental", "learning", "magic"],
    "Focused study reveals unfamiliar systems and makes related techniques easier to retain.",
  ],
  [
    "record-3",
    "perk",
    "Warded Soul",
    "entry-1",
    "jumper",
    ["magic", "pyrokinesis", "defense"],
    "A resilient magical ward protects the spirit from corruption and hostile influence.",
  ],
  [
    "record-4",
    "item",
    "Apprentice Grimoire",
    "entry-1",
    "mira",
    ["magic", "crafting", "enchanting"],
    "A working spellbook filled with practical formulae and annotated discoveries.",
  ],
  [
    "record-5",
    "perk",
    "Stellar Intuition",
    "entry-2",
    "jumper",
    ["technology", "meta"],
    "A practiced instinct for strange vessels, orbital systems, and unfamiliar technology.",
  ],
  [
    "record-6",
    "item",
    "Survey Skiff",
    "entry-2",
    "io",
    ["technology", "vehicles"],
    "A compact survey craft equipped for atmospheric and short-range orbital travel.",
  ],
].map(
  ([id, kind, name, sourceEntryId, ownerActorId, tags, description]) =>
    ({
      id,
      kind,
      name,
      sourceEntryId,
      ownerActorId,
      tags,
      description,
    }) as InventoryRecord,
);

const adjectives = [
  "Resonant",
  "Patient",
  "Hidden",
  "Astral",
  "Adaptive",
  "Vigilant",
  "Clockwork",
  "Radiant",
  "Enduring",
  "Mnemonic",
  "Wayfarer’s",
  "Sovereign",
];
const nouns = [
  "Accord",
  "Method",
  "Lantern",
  "Compass",
  "Mantle",
  "Discipline",
  "Archive",
  "Engine",
  "Aegis",
  "Toolkit",
  "Insight",
  "Promise",
];

const generatedRecords: InventoryRecord[] = Array.from(
  { length: 53 },
  (_, offset) => {
    const index = offset + seedRecords.length;
    const category = tagCategories[index % tagCategories.length];
    const detail = categoryDetails[category];
    const child = slug(
      detail.children[Math.floor(index / 12) % detail.children.length],
    );
    const secondary = tagCategories[(index * 5 + 3) % tagCategories.length];
    const kind = index % 3 === 1 && index !== 58 ? "item" : "perk";
    return {
      id: `record-${index}`,
      kind,
      name: `${adjectives[index % adjectives.length]} ${nouns[(index * 7) % nouns.length]} ${index - 5}`,
      sourceEntryId: `entry-${index % 8}`,
      ownerActorId: Object.keys(actors)[index % Object.keys(actors).length],
      tags: [child, secondary],
      description: `A fully described ${kind} demonstrating ${detail.label.toLocaleLowerCase()} capability, ${detail.children[0].toLocaleLowerCase()}, and cross-category interaction in the dense review chain.`,
    };
  },
);

const magicAssignments = [
  "pyrokinesis",
  "fire-projection",
  "heat-control",
  "flame-immunity",
  "cryokinesis",
  "telekinesis",
  "healing-magic",
  "enchantment",
  "divination",
  "summoning",
  "necromancy",
  "illusion",
  "runes",
  "alchemy",
] as const;

let perkIndex = 0;
const records = [...seedRecords, ...generatedRecords].map((record) => {
  if (record.kind !== "perk") return record;
  const magicTag = magicAssignments[perkIndex];
  perkIndex += 1;
  return magicTag
    ? { ...record, tags: [...new Set([...record.tags, magicTag])] }
    : record;
});

/** REPLACEMENT BOUNDARY: Forms remain fixture-backed until Format 1 form grants exist. */
export const TEMPORARY_FORM_FIXTURE: FormRecord[] = chainPackageIds.map(
  (_, index) => ({
    id: `form-${index}`,
    name: [
      "Jumper",
      "Dragon Form",
      "Digital Avatar",
      "Moonlit Courtier",
      "Pilgrim Spirit",
      "Brass Leviathan",
      "Crowned General",
      "Horizon Walker",
    ][index],
    sourceEntryId: `entry-${index}`,
    subtitle: [
      "Human baseline",
      "Scaled magical body",
      "Network-native body",
      "Immortal shadow form",
      "Incarnate traveling soul",
      "Ocean-going machine body",
      "Battlefield sovereign",
      "Boundary-crossing form",
    ][index],
    description: `A persistent alternate body acquired during ${packageList[index].name}, with a complete profile and inspectable form perks.`,
    initials: ["JU", "DR", "DA", "MC", "PS", "BL", "CG", "HW"][index],
    details: [
      `Body type · ${["Human", "Dragon", "Digital", "Fae", "Spirit", "Machine", "Human", "Abstract"][index]}`,
      `Source · ${packageList[index].name}`,
      `Acquired at Jump ${index + 1}`,
    ],
    perkRecordIds: [
      `record-${(index * 7) % 60}`,
      `record-${(index * 7 + 2) % 60}`,
    ],
  }),
);

const companionActorIds = Object.keys(actors).filter((id) => id !== "jumper");
const companions: CompanionRecord[] = companionActorIds.map(
  (actorId, index) => ({
    actorId,
    sourceEntryId: actors[actorId].joinedEntryId ?? "entry-0",
    tags: [tagCategories[index], tagCategories[(index + 4) % 12]],
    perkRecordIds: [
      `record-${(index * 8 + 2) % 60}`,
      `record-${(index * 8 + 3) % 60}`,
    ],
    itemRecordIds: [`record-${(index * 8 + 4) % 60}`],
    importedEntryIds: Array.from(
      { length: Math.max(1, 7 - index) },
      (_, importIndex) => `entry-${index + importIndex + 1}`,
    ).filter((id) => Number(id.split("-")[1]) < 8),
  }),
);

function makeEntries(packageIds: readonly string[]) {
  return Object.fromEntries(
    packageIds.map((packageId, index): [string, ChainEntry] => [
      `entry-${index}`,
      {
        id: `entry-${index}`,
        packageId,
        packageExactHash:
          packageList.find((item) => item.id === packageId)?.exactHash ??
          "unresolved",
        kind: "jump",
        status: index === 7 ? "Negative balance" : `${index + 1} selections`,
      },
    ]),
  );
}

const activeActor = (
  choices: Record<string, boolean | string | number | null>,
  inputs: ReturnType<typeof emptyActorEntryState>["inputs"] = {},
) => ({ ...emptyActorEntryState(), choices, inputs });

function createGeneratedJumpState(order: readonly string[]) {
  const result = Object.fromEntries(
    order.map((entryId) => [entryId, emptyJumpEntryState()]),
  );
  if (result[EARTH_ENTRY_ID])
    result[EARTH_ENTRY_ID] = {
      ...emptyJumpEntryState(),
      actors: {
        jumper: activeActor({ earth_gender: null, earth_age: null }),
      },
    };
  if (result["entry-0"])
    result["entry-0"].actors.jumper = activeActor({
      starting_gender: "Female",
      starting_age: 24,
      wanderer: true,
      adaptable_baseline: true,
      travelers_pack: true,
      ash_companion: true,
    });
  if (result["entry-1"])
    result["entry-1"].actors.jumper = activeActor(
      {
        scholar: true,
        spellcraft_foundations: true,
        living_grimoire: true,
        technique_ranks: 2,
        elemental_attunement: "Fire",
      },
      {},
    );
  if (result["entry-2"])
    result["entry-2"].actors.jumper = {
      ...activeActor({
        explorer: true,
        stellar_intuition: true,
        survey_skiff: true,
        starting_age: 27,
        random_training: 3,
      }),
      choiceRolls: {
        starting_age: { result: 27, sequence: 1 },
        random_training: { result: 3, sequence: 1 },
      },
      sourceRolls: {
        "expedition:assignment": { result: "explorer", sequence: 1 },
        "systems:systems": { result: "stellar_intuition", sequence: 1 },
      },
    };
  if (result["entry-3"])
    result["entry-3"].actors.jumper = activeActor({
      court_gender: "Female",
      moonlit_oath: true,
      shadow_estate: true,
      binding_oath: true,
    });
  if (result["entry-4"])
    result["entry-4"].actors.jumper = activeActor({
      shrine_keeper: true,
      memory_lantern: true,
      older_pilgrim: 30,
    });
  if (result["entry-5"]) {
    const ash = "companion:entry-0:jumper:ash_companion:0";
    const mira = "companion:entry-1:jumper:spellcraft_foundations:4";
    result["entry-5"].actors.jumper = activeActor(
      {
        brass_seamanship: true,
        impossible_vessel: true,
        import_companions: true,
      },
      {
        brass_seamanship: { vessel_name: "Resolute" },
        impossible_vessel: { vessel_class: "Leviathan" },
        import_companions: { crew: [ash, mira] },
      },
    );
    result["entry-5"].actors[ash] = activeActor({ impossible_vessel: true });
    result["entry-5"].actors[mira] = activeActor({ impossible_vessel: true });
  }
  if (result["entry-6"]) {
    result["entry-6"].actors.jumper = activeActor({
      banner_command: true,
      royal_armory: true,
      war_debt: true,
    });
    result["entry-6"].appliedGauntlet = [
      { id: "manual", kind: "user", label: "Applied by user" },
    ];
  }
  if (result["entry-7"]) {
    const ren = "companion:entry-6:jumper:banner_command:4";
    result["entry-7"].actors.jumper = activeActor(
      {
        boundary_walking: true,
        reality_rewrite: true,
        horizon_company: true,
      },
      { horizon_company: { travelers: [ren] } },
    );
    result["entry-7"].actors[ren] = activeActor({
      boundary_walking: true,
      reality_rewrite: true,
    });
  }
  return result;
}

export function createDenseTrackerFixture(
  preferences: Partial<TrackerPreferences> = {},
): TrackerState {
  return {
    chainName: "Morgan’s Chain",
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
      ...makeEntries(chainPackageIds),
    },
    order: [
      EARTH_ENTRY_ID,
      ...chainPackageIds.map((_, index) => `entry-${index}`),
    ],
    jumpState: createGeneratedJumpState([
      EARTH_ENTRY_ID,
      ...chainPackageIds.map((_, index) => `entry-${index}`),
    ]),
    enabledSupplements: initialEnabled,
    supplementPage: "manage",
    bodyMod: initialBodyModState,
    supplements: initialSupplementState,
    entrySupplements: Object.fromEntries(
      [
        EARTH_ENTRY_ID,
        ...chainPackageIds.map((_, index) => `entry-${index}`),
      ].map((entryId) => [
        entryId,
        {
          quest: {
            ...initialSupplementState.quest,
            checked:
              entryId === "entry-7" ? initialSupplementState.quest.checked : [],
          },
          uds: {
            ...initialSupplementState.uds,
            chain:
              entryId === "entry-7" ? initialSupplementState.uds.chain : [],
            jump: entryId === "entry-7" ? initialSupplementState.uds.jump : [],
          },
        },
      ]),
    ),
    actors,
    records,
    forms: TEMPORARY_FORM_FIXTURE,
    companions,
    tags: trackerTags,
    preferences: {
      warnUpstreamChanges: false,
      allowMultiplePackageVersions: false,
      allowNegativePointBalances: false,
      allowRerolls: false,
      showAdditionalJumpInformation: false,
      ...preferences,
    },
    selectedEntryId: "entry-7",
    inspectionPointId: "entry-7",
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
    nextEntrySerial: 8,
  };
}

export function createReferenceTrackerFixture(): TrackerState {
  const dense = createDenseTrackerFixture();
  const order = [EARTH_ENTRY_ID, "entry-0", "entry-1", "entry-2"];
  const entries = {
    [EARTH_ENTRY_ID]: dense.entries[EARTH_ENTRY_ID],
    ...makeEntries(chainPackageIds.slice(0, 3)),
  };
  const jumpState = createGeneratedJumpState(order);
  return {
    ...dense,
    entries,
    order,
    jumpState,
    entrySupplements: Object.fromEntries(
      order.map((id) => [id, dense.entrySupplements[id]]),
    ),
    records: seedRecords,
    forms: TEMPORARY_FORM_FIXTURE.slice(0, 3),
    companions: companions.slice(0, 3),
    selectedEntryId: "entry-1",
    inspectionPointId: "entry-1",
    nextEntrySerial: 3,
  };
}

export function createSampleTrackerFixture(
  name: string,
  jumpCount: number,
  offset = 0,
): TrackerState {
  const base = createBlankTrackerFixture(name);
  const count = Math.min(Math.max(0, jumpCount), packageList.length);
  const core = chainPackageIds.slice(
    0,
    Math.min(count, chainPackageIds.length),
  );
  const additional = packageList.filter(
    (item) => !chainPackageIds.includes(item.id),
  );
  const selectedPackages = [
    ...core,
    ...Array.from(
      { length: count - core.length },
      (_, index) => additional[(index + offset) % additional.length].id,
    ),
  ];
  const entryIds = selectedPackages.map((_, index) => `entry-${index}`);
  const order = [EARTH_ENTRY_ID, ...entryIds];
  return {
    ...base,
    entries: {
      [EARTH_ENTRY_ID]: base.entries[EARTH_ENTRY_ID],
      ...makeEntries(selectedPackages),
    },
    order,
    jumpState: createGeneratedJumpState(order),
    entrySupplements: Object.fromEntries(
      order.map((id) => [
        id,
        {
          quest: { ...initialSupplementState.quest, checked: [] },
          uds: { ...initialSupplementState.uds, jump: [] },
        },
      ]),
    ),
    selectedEntryId: entryIds.at(-1) ?? EARTH_ENTRY_ID,
    inspectionPointId: entryIds.at(-1) ?? EARTH_ENTRY_ID,
    nextEntrySerial: entryIds.length,
  };
}

export function createBlankTrackerFixture(name = "New Chain"): TrackerState {
  const base = createDenseTrackerFixture();
  return {
    ...base,
    chainName: name,
    entries: { [EARTH_ENTRY_ID]: base.entries[EARTH_ENTRY_ID] },
    order: [EARTH_ENTRY_ID],
    jumpState: createGeneratedJumpState([EARTH_ENTRY_ID]),
    entrySupplements: {
      [EARTH_ENTRY_ID]: base.entrySupplements[EARTH_ENTRY_ID],
    },
    actors: { jumper: base.actors.jumper },
    records: [],
    forms: [],
    companions: [],
    selectedEntryId: EARTH_ENTRY_ID,
    inspectionPointId: EARTH_ENTRY_ID,
    nextEntrySerial: 0,
  };
}
