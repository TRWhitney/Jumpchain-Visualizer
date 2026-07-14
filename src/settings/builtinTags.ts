import {
  tagCategories,
  type TagCategory,
  type TagDefinition,
} from "../tracker/model";
import { shiftInheritedTagColor } from "./tagColor";

export type BuiltinTagPreset = {
  id: string;
  label: string;
  parent: string | null;
  aliases: readonly string[];
  color: string;
  to: string;
  style: TagDefinition["style"];
};

const primary: Record<
  TagCategory,
  Omit<BuiltinTagPreset, "id" | "parent" | "aliases">
> = {
  social: { label: "Social", color: "#a93572", to: "#7b2452", style: "soft" },
  mental: {
    label: "Mental",
    color: "#4f46a5",
    to: "#312e81",
    style: "gradient",
  },
  spiritual: {
    label: "Spiritual",
    color: "#16806f",
    to: "#0e594e",
    style: "outline",
  },
  magic: { label: "Magic", color: "#6d3bb3", to: "#45247a", style: "gradient" },
  meta: { label: "Meta", color: "#7b3f8c", to: "#542a60", style: "outline" },
  stealth: {
    label: "Stealth",
    color: "#475569",
    to: "#293443",
    style: "gradient",
  },
  physical: {
    label: "Physical",
    color: "#a93645",
    to: "#7f2430",
    style: "solid",
  },
  combat: { label: "Combat", color: "#922b21", to: "#671e17", style: "solid" },
  defense: {
    label: "Defense",
    color: "#35755e",
    to: "#245241",
    style: "outline",
  },
  crafting: {
    label: "Crafting",
    color: "#9a4d00",
    to: "#6b3500",
    style: "soft",
  },
  technology: {
    label: "Technology",
    color: "#2563a8",
    to: "#194777",
    style: "solid",
  },
  miscellaneous: {
    label: "Miscellaneous",
    color: "#68707c",
    to: "#454b54",
    style: "soft",
  },
};

type ChildPreset = readonly [
  id: string,
  label: string,
  parent: string,
  aliases?: readonly string[],
];

const children: readonly ChildPreset[] = [
  ["charisma", "Charisma", "social", ["Charm"]],
  ["leadership", "Leadership", "social", ["Command"]],
  ["diplomacy", "Diplomacy", "social", ["Negotiation"]],
  ["deception", "Deception", "social", ["Misdirection"]],
  ["empathy", "Empathy", "social", ["Emotional Insight"]],
  ["reputation", "Reputation", "social", ["Renown"]],
  ["companionship", "Companionship", "social", ["Friendship"]],
  ["teaching", "Teaching", "social", ["Instruction"]],
  ["performance", "Performance", "social", ["Performing Arts"]],
  ["commerce", "Commerce", "social", ["Trade"]],
  ["politics", "Politics", "social", ["Governance"]],
  ["intimidation", "Intimidation", "social", ["Coercion"]],

  ["memory", "Memory", "mental", ["Recall"]],
  ["learning", "Learning", "mental", ["Education"]],
  ["intelligence", "Intelligence", "mental", ["Intellect"]],
  ["willpower", "Willpower", "mental", ["Resolve"]],
  ["creativity", "Creativity", "mental", ["Imagination"]],
  ["calculation", "Calculation", "mental", ["Mathematics"]],
  ["awareness", "Awareness", "mental", ["Alertness"]],
  ["multitasking", "Multitasking", "mental", ["Parallel Thought"]],
  ["planning", "Planning", "mental", ["Preparation"]],
  ["emotion-control", "Emotion Control", "mental", ["Emotional Regulation"]],
  ["language", "Language", "mental", ["Languages", "Linguistics"]],
  ["investigation", "Investigation", "mental", ["Deduction"]],

  ["soul", "Soul", "spiritual", ["Souls", "Essence"]],
  ["faith", "Faith", "spiritual", ["Devotion"]],
  ["ki", "Ki", "spiritual", ["Chi", "Qi"]],
  ["meditation", "Meditation", "spiritual", ["Contemplation"]],
  ["afterlife", "Afterlife", "spiritual", ["Afterlives"]],
  [
    "spirit-interaction",
    "Spirit Interaction",
    "spiritual",
    ["Spirit Communion"],
  ],
  ["reincarnation", "Reincarnation", "spiritual", ["Rebirth"]],
  ["purification", "Purification", "spiritual", ["Cleansing"]],
  ["corruption", "Corruption", "spiritual", ["Taint"]],
  ["karma", "Karma", "spiritual", ["Karmic"]],
  ["exorcism", "Exorcism", "spiritual", ["Banishing"]],

  ["elemental-magic", "Elemental Magic", "magic", ["Elementalism"]],
  ["pyrokinesis", "Pyrokinesis", "magic", ["Fire Control", "Flamecraft"]],
  ["fire-projection", "Fire Projection", "pyrokinesis", ["Flame Projection"]],
  ["heat-control", "Heat Control", "pyrokinesis", ["Thermokinesis"]],
  ["flame-immunity", "Flame Immunity", "pyrokinesis", ["Fire Immunity"]],
  ["cryokinesis", "Cryokinesis", "magic", ["Ice Control"]],
  ["hydrokinesis", "Hydrokinesis", "magic", ["Water Control"]],
  ["aerokinesis", "Aerokinesis", "magic", ["Air Control"]],
  ["geokinesis", "Geokinesis", "magic", ["Earth Control"]],
  ["telekinesis", "Telekinesis", "magic", ["Psychokinesis"]],
  ["healing-magic", "Healing Magic", "magic", ["Restoration Magic"]],
  ["enchantment", "Enchantment", "magic", ["Enchantments"]],
  ["divination", "Divination", "magic", ["Scrying"]],
  ["summoning", "Summoning", "magic", ["Conjuration"]],
  ["necromancy", "Necromancy", "magic", ["Death Magic"]],
  ["illusion", "Illusion", "magic", ["Illusions"]],
  ["runes", "Rune", "magic", ["Runes", "Runecraft"]],
  ["alchemy", "Alchemy", "magic", ["Transmutation"]],
  ["curse", "Curse", "magic", ["Curses", "Hex"]],
  ["ward", "Ward", "magic", ["Wards", "Warding"]],
  ["ritual-magic", "Ritual Magic", "magic", ["Rituals"]],
  ["time-magic", "Time Magic", "magic", ["Chronomancy"]],
  ["space-magic", "Space Magic", "magic", ["Spatial Magic"]],
  ["nature-magic", "Nature Magic", "magic", ["Druidry"]],
  ["blood-magic", "Blood Magic", "magic", ["Hemomancy"]],

  ["chain-rules", "Chain Rules", "meta", ["Chain Mechanics"]],
  ["choice-points", "Choice Point", "meta", ["Choice Points", "CP"]],
  ["fiat", "Fiat", "meta", ["Fiat Backing"]],
  ["perk-interaction", "Perk Interaction", "meta", ["Perk Synergy"]],
  [
    "drawback-interaction",
    "Drawback Interaction",
    "meta",
    ["Drawback Synergy"],
  ],
  ["narrative-control", "Narrative Control", "meta", ["Story Control"]],
  ["probability", "Probability", "meta", ["Chance"]],
  ["reality-warping", "Reality Warping", "meta", ["Reality Alteration"]],
  ["dimensional-travel", "Dimensional Travel", "meta", ["World Travel"]],
  ["out-of-context", "Out of Context", "meta", ["OOC"]],

  ["concealment", "Concealment", "stealth", ["Hiding"]],
  ["infiltration", "Infiltration", "stealth", ["Penetration"]],
  ["disguise", "Disguise", "stealth", ["Disguises"]],
  ["evasion", "Evasion", "stealth", ["Avoidance"]],
  ["espionage", "Espionage", "stealth", ["Spying"]],
  ["lockpicking", "Lockpicking", "stealth", ["Lock Picking"]],
  ["sabotage", "Sabotage", "stealth", ["Subversion"]],
  ["surveillance", "Surveillance", "stealth", ["Observation"]],
  ["escape", "Escape", "stealth", ["Escapes"]],
  ["theft", "Theft", "stealth", ["Larceny"]],
  ["assassination", "Assassination", "stealth", ["Assassinations"]],
  ["tracking", "Tracking", "stealth", ["Trailcraft"]],

  ["strength", "Strength", "physical", ["Might"]],
  ["endurance", "Endurance", "physical", ["Stamina"]],
  ["speed", "Speed", "physical", ["Quickness"]],
  ["agility", "Agility", "physical", ["Dexterity"]],
  ["senses", "Sense", "physical", ["Senses", "Sensory"]],
  ["healing", "Healing", "physical", ["Physical Recovery"]],
  ["regeneration", "Regeneration", "healing", ["Regrowth"]],
  ["adaptation", "Adaptation", "physical", ["Adaptability"]],
  ["shapeshifting", "Shapeshifting", "physical", ["Transformation"]],
  ["size-change", "Size Change", "shapeshifting", ["Size Alteration"]],
  ["flight", "Flight", "physical", ["Flying"]],
  ["aquatic", "Aquatic", "physical", ["Underwater"]],
  ["biology", "Biology", "physical", ["Biological"]],
  ["longevity", "Longevity", "physical", ["Lifespan"]],
  ["movement", "Movement", "physical", ["Mobility"]],

  ["martial-arts", "Martial Art", "combat", ["Martial Arts"]],
  ["weapons", "Weapon", "combat", ["Weapons", "Arms"]],
  ["melee-weapons", "Melee Weapon", "weapons", ["Melee Weapons"]],
  ["ranged-weapons", "Ranged Weapon", "weapons", ["Ranged Weapons"]],
  ["firearms", "Firearm", "ranged-weapons", ["Firearms", "Guns"]],
  ["tactics", "Tactics", "combat", ["Battle Tactics"]],
  ["strategy", "Strategy", "combat", ["Grand Strategy"]],
  ["grappling", "Grappling", "combat", ["Wrestling"]],
  ["dueling", "Dueling", "combat", ["Duels"]],
  ["marksmanship", "Marksmanship", "combat", ["Sharpshooting"]],
  ["battlefield-control", "Battlefield Control", "combat", ["Zone Control"]],
  ["unarmed-combat", "Unarmed Combat", "combat", ["Hand to Hand"]],
  ["military", "Military", "combat", ["Warfare"]],

  ["resistance", "Resistance", "defense", ["Resistances"]],
  [
    "elemental-resistance",
    "Elemental Resistance",
    "resistance",
    ["Elemental Protection"],
  ],
  ["mental-resistance", "Mental Resistance", "resistance", ["Mind Protection"]],
  [
    "magical-resistance",
    "Magical Resistance",
    "resistance",
    ["Magic Resistance"],
  ],
  ["immunity", "Immunity", "defense", ["Immunities"]],
  ["barriers", "Barrier", "defense", ["Barriers", "Shield"]],
  ["armor", "Armor", "defense", ["Armour"]],
  ["recovery", "Recovery", "defense", ["Recuperation"]],
  ["survival", "Survival", "defense", ["Survivability"]],
  ["invulnerability", "Invulnerability", "defense", ["Invincibility"]],
  ["damage-reduction", "Damage Reduction", "defense", ["Damage Mitigation"]],
  [
    "hazard-protection",
    "Hazard Protection",
    "defense",
    ["Environmental Protection"],
  ],
  ["anti-corruption", "Anti-Corruption", "defense", ["Corruption Resistance"]],

  ["engineering", "Engineering", "crafting", ["Engineering Craft"]],
  ["enchanting", "Enchanting", "crafting", ["Item Enchantment"]],
  ["smithing", "Smithing", "crafting", ["Blacksmithing"]],
  ["cooking", "Cooking", "crafting", ["Cuisine"]],
  ["art", "Art", "crafting", ["Arts"]],
  ["repair", "Repair", "crafting", ["Repairs", "Maintenance"]],
  ["architecture", "Architecture", "crafting", ["Building Design"]],
  ["chemistry", "Chemistry", "crafting", ["Chemical Craft"]],
  ["tailoring", "Tailoring", "crafting", ["Sewing"]],
  ["woodworking", "Woodworking", "crafting", ["Carpentry"]],
  ["agriculture", "Agriculture", "crafting", ["Farming"]],
  ["resource-production", "Resource Production", "crafting", ["Manufacturing"]],
  ["invention", "Invention", "crafting", ["Inventing"]],

  ["computing", "Computing", "technology", ["Computer Science"]],
  [
    "artificial-intelligence",
    "Artificial Intelligence",
    "computing",
    ["AI", "AIs"],
  ],
  ["cybernetics", "Cybernetics", "technology", ["Cybernetic"]],
  ["robotics", "Robotics", "technology", ["Robot Engineering"]],
  ["vehicles", "Vehicle", "technology", ["Vehicles"]],
  ["spacecraft", "Spacecraft", "vehicles", ["Starship", "Starships"]],
  ["aircraft", "Aircraft", "vehicles", ["Airplane", "Airplanes"]],
  ["watercraft", "Watercraft", "vehicles", ["Ship", "Ships"]],
  ["science", "Science", "technology", ["Sciences"]],
  ["automation", "Automation", "technology", ["Automated Systems"]],
  ["energy", "Energy", "technology", ["Power Systems"]],
  [
    "weapons-technology",
    "Weapons Technology",
    "technology",
    ["Weapon Technology"],
  ],
  ["biotechnology", "Biotechnology", "technology", ["Biotech"]],
  ["nanotechnology", "Nanotechnology", "technology", ["Nanotech"]],
  [
    "communications",
    "Communication Technology",
    "technology",
    ["Communications"],
  ],
  ["sensors", "Sensor", "technology", ["Sensors"]],
  ["virtual-reality", "Virtual Reality", "technology", ["VR"]],
  ["infrastructure", "Infrastructure", "technology", ["Utilities"]],

  ["convenience", "Convenience", "miscellaneous", ["Quality of Life"]],
  ["novelty", "Novelty", "miscellaneous", ["Gimmick"]],
  ["hobby", "Hobby", "miscellaneous", ["Hobbies"]],
  ["aesthetic", "Aesthetic", "miscellaneous", ["Cosmetic"]],
  ["lifestyle", "Lifestyle", "miscellaneous", ["Living"]],
  ["wealth", "Wealth", "miscellaneous", ["Money"]],
  ["property", "Property", "miscellaneous", ["Properties"]],
  ["storage", "Storage", "miscellaneous", ["Inventory Space"]],
  ["clothing", "Clothing", "miscellaneous", ["Clothes"]],
  ["pet", "Pet", "miscellaneous", ["Pets"]],
  ["travel", "Travel", "miscellaneous", ["Transportation"]],
  ["environment", "Environment", "miscellaneous", ["Environmental"]],
  ["drawback", "Drawback", "miscellaneous", ["Drawbacks"]],
  ["companion", "Companion", "miscellaneous", ["Companions"]],
  ["item", "Item", "miscellaneous", ["Items"]],
  ["perk", "Perk", "miscellaneous", ["Perks"]],
];

const roots = tagCategories.reduce(
  (entries, id) => {
    entries[id] = {
      id,
      parent: null,
      aliases: [],
      ...primary[id],
    };
    return entries;
  },
  {} as Record<TagCategory, BuiltinTagPreset>,
);

const presets = new Map<string, BuiltinTagPreset>(
  tagCategories.map((id) => [id, roots[id]]),
);
for (const [id, label, parentId, aliases = []] of children) {
  const parent = presets.get(parentId);
  if (!parent) throw new Error(`Unknown built-in tag parent: ${parentId}`);
  presets.set(id, {
    id,
    label,
    parent: parentId,
    aliases,
    color: shiftInheritedTagColor(parent.color, label, 0),
    to: shiftInheritedTagColor(parent.to, label, 1),
    style: parent.style,
  });
}

export const primaryTagIds = new Set<string>(tagCategories);
export const builtinTagPresets = [...presets.values()];
export const builtinTagPresetById = Object.fromEntries(
  builtinTagPresets.map((preset) => [preset.id, preset]),
);
export const builtinTagDefinitions: Record<string, TagDefinition> =
  Object.fromEntries(
    builtinTagPresets.map((preset) => [
      preset.id,
      {
        id: preset.id,
        label: preset.label,
        parent: preset.parent ?? undefined,
        aliases: preset.aliases,
        color: preset.color,
        to: preset.to,
        style: preset.style,
      },
    ]),
  );
