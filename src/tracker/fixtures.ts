import {
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

const packageList: InstalledPackage[] = [
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

export const installedPackages = packageList;

const chainPackageIds = packageList.slice(0, 8).map((item) => item.id);

const actors: Record<string, Actor> = Object.fromEntries(
  [
    [
      "jumper",
      "Morgan",
      "Jumper",
      "Female",
      24,
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
  ].map(([id, name, role, gender, age, joinedEntryId, initials, summary]) => [
    id,
    { id, name, role, gender, age, joinedEntryId, initials, summary } as Actor,
  ]),
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

const forms: FormRecord[] = chainPackageIds.map((_, index) => ({
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
}));

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
        status: index === 7 ? "Negative balance" : `${index + 1} selections`,
        actorBalances:
          index === 7
            ? { jumper: 250, ren: -150 }
            : {
                jumper: 1000 - index * 75,
                ...(index > 1 ? { ash: 600 - index * 40 } : {}),
              },
        origin: ["Wanderer", "Scholar", "Explorer", "Courtier"][index % 4],
        location: [
          "Crossroads",
          "Highcourt",
          "Orbital Survey",
          "Moonlit Palace",
        ][index % 4],
      },
    ]),
  );
}

export function createDenseTrackerFixture(
  preferences: Partial<TrackerPreferences> = {},
): TrackerState {
  return {
    chainName: "Morgan’s Chain",
    packages: Object.fromEntries(packageList.map((item) => [item.id, item])),
    entries: makeEntries(chainPackageIds),
    order: chainPackageIds.map((_, index) => `entry-${index}`),
    actors,
    records,
    forms,
    companions,
    tags: trackerTags,
    preferences: {
      warnUpstreamChanges: false,
      allowMultiplePackageVersions: false,
      allowNegativePointBalances: false,
      allowRerolls: false,
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
  const order = ["entry-0", "entry-1", "entry-2"];
  const entries = makeEntries(chainPackageIds.slice(0, 3));
  entries["entry-1"] = {
    ...entries["entry-1"],
    actorBalances: { jumper: 1000, ash: 600 },
    origin: "Not selected",
    location: undefined,
  };
  return {
    ...dense,
    entries,
    order,
    records: seedRecords,
    forms: forms.slice(0, 3),
    companions: companions.slice(0, 3),
    selectedEntryId: "entry-1",
    inspectionPointId: "entry-1",
    nextEntrySerial: 3,
  };
}
