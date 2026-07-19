import {
  tagCategories,
  type TagCategory,
  type TagDefinition,
} from "../tracker/model";
import { shiftInheritedTagColor } from "./tagColor";
import { translate } from "../localization";

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
  social: {
    label: translate("builtinTags.social.label"),
    color: "#a93572",
    to: "#7b2452",
    style: "soft",
  },
  mental: {
    label: translate("builtinTags.mental.label"),
    color: "#4f46a5",
    to: "#312e81",
    style: "gradient",
  },
  spiritual: {
    label: translate("builtinTags.spiritual.label"),
    color: "#16806f",
    to: "#0e594e",
    style: "outline",
  },
  magic: {
    label: translate("builtinTags.magic.label"),
    color: "#6d3bb3",
    to: "#45247a",
    style: "gradient",
  },
  meta: {
    label: translate("builtinTags.meta.label"),
    color: "#7b3f8c",
    to: "#542a60",
    style: "outline",
  },
  stealth: {
    label: translate("builtinTags.stealth.label"),
    color: "#475569",
    to: "#293443",
    style: "gradient",
  },
  physical: {
    label: translate("builtinTags.physical.label"),
    color: "#a93645",
    to: "#7f2430",
    style: "solid",
  },
  combat: {
    label: translate("builtinTags.combat.label"),
    color: "#922b21",
    to: "#671e17",
    style: "solid",
  },
  defense: {
    label: translate("builtinTags.defense.label"),
    color: "#35755e",
    to: "#245241",
    style: "outline",
  },
  crafting: {
    label: translate("builtinTags.crafting.label"),
    color: "#9a4d00",
    to: "#6b3500",
    style: "soft",
  },
  technology: {
    label: translate("builtinTags.technology.label"),
    color: "#2563a8",
    to: "#194777",
    style: "solid",
  },
  miscellaneous: {
    label: translate("builtinTags.miscellaneous.label"),
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
  [
    "charisma",
    translate("builtinTags.charisma.label"),
    "social",
    [translate("builtinTags.charisma.aliases.0")],
  ],
  [
    "leadership",
    translate("builtinTags.leadership.label"),
    "social",
    [translate("builtinTags.leadership.aliases.0")],
  ],
  [
    "diplomacy",
    translate("builtinTags.diplomacy.label"),
    "social",
    [translate("builtinTags.diplomacy.aliases.0")],
  ],
  [
    "deception",
    translate("builtinTags.deception.label"),
    "social",
    [translate("builtinTags.deception.aliases.0")],
  ],
  [
    "empathy",
    translate("builtinTags.empathy.label"),
    "social",
    [translate("builtinTags.empathy.aliases.0")],
  ],
  [
    "reputation",
    translate("builtinTags.reputation.label"),
    "social",
    [translate("builtinTags.reputation.aliases.0")],
  ],
  [
    "companionship",
    translate("builtinTags.companionship.label"),
    "social",
    [translate("builtinTags.companionship.aliases.0")],
  ],
  [
    "teaching",
    translate("builtinTags.teaching.label"),
    "social",
    [translate("builtinTags.teaching.aliases.0")],
  ],
  [
    "performance",
    translate("builtinTags.performance.label"),
    "social",
    [translate("builtinTags.performance.aliases.0")],
  ],
  [
    "commerce",
    translate("builtinTags.commerce.label"),
    "social",
    [translate("builtinTags.commerce.aliases.0")],
  ],
  [
    "politics",
    translate("builtinTags.politics.label"),
    "social",
    [translate("builtinTags.politics.aliases.0")],
  ],
  [
    "intimidation",
    translate("builtinTags.intimidation.label"),
    "social",
    [translate("builtinTags.intimidation.aliases.0")],
  ],

  [
    "memory",
    translate("builtinTags.memory.label"),
    "mental",
    [translate("builtinTags.memory.aliases.0")],
  ],
  [
    "learning",
    translate("builtinTags.learning.label"),
    "mental",
    [translate("builtinTags.learning.aliases.0")],
  ],
  [
    "intelligence",
    translate("builtinTags.intelligence.label"),
    "mental",
    [translate("builtinTags.intelligence.aliases.0")],
  ],
  [
    "willpower",
    translate("builtinTags.willpower.label"),
    "mental",
    [translate("builtinTags.willpower.aliases.0")],
  ],
  [
    "creativity",
    translate("builtinTags.creativity.label"),
    "mental",
    [translate("builtinTags.creativity.aliases.0")],
  ],
  [
    "calculation",
    translate("builtinTags.calculation.label"),
    "mental",
    [translate("builtinTags.calculation.aliases.0")],
  ],
  [
    "awareness",
    translate("builtinTags.awareness.label"),
    "mental",
    [translate("builtinTags.awareness.aliases.0")],
  ],
  [
    "multitasking",
    translate("builtinTags.multitasking.label"),
    "mental",
    [translate("builtinTags.multitasking.aliases.0")],
  ],
  [
    "planning",
    translate("builtinTags.planning.label"),
    "mental",
    [translate("builtinTags.planning.aliases.0")],
  ],
  [
    "emotion-control",
    translate("builtinTags.emotion-control.label"),
    "mental",
    [translate("builtinTags.emotion-control.aliases.0")],
  ],
  [
    "language",
    translate("builtinTags.language.label"),
    "mental",
    [
      translate("builtinTags.language.aliases.0"),
      translate("builtinTags.language.aliases.1"),
    ],
  ],
  [
    "investigation",
    translate("builtinTags.investigation.label"),
    "mental",
    [translate("builtinTags.investigation.aliases.0")],
  ],

  [
    "soul",
    translate("builtinTags.soul.label"),
    "spiritual",
    [
      translate("builtinTags.soul.aliases.0"),
      translate("builtinTags.soul.aliases.1"),
    ],
  ],
  [
    "faith",
    translate("builtinTags.faith.label"),
    "spiritual",
    [translate("builtinTags.faith.aliases.0")],
  ],
  [
    "ki",
    translate("builtinTags.ki.label"),
    "spiritual",
    [
      translate("builtinTags.ki.aliases.0"),
      translate("builtinTags.ki.aliases.1"),
    ],
  ],
  [
    "meditation",
    translate("builtinTags.meditation.label"),
    "spiritual",
    [translate("builtinTags.meditation.aliases.0")],
  ],
  [
    "afterlife",
    translate("builtinTags.afterlife.label"),
    "spiritual",
    [translate("builtinTags.afterlife.aliases.0")],
  ],
  [
    "spirit-interaction",
    translate("builtinTags.spirit-interaction.label"),
    "spiritual",
    [translate("builtinTags.spirit-interaction.aliases.0")],
  ],
  [
    "reincarnation",
    translate("builtinTags.reincarnation.label"),
    "spiritual",
    [translate("builtinTags.reincarnation.aliases.0")],
  ],
  [
    "purification",
    translate("builtinTags.purification.label"),
    "spiritual",
    [translate("builtinTags.purification.aliases.0")],
  ],
  [
    "corruption",
    translate("builtinTags.corruption.label"),
    "spiritual",
    [translate("builtinTags.corruption.aliases.0")],
  ],
  [
    "karma",
    translate("builtinTags.karma.label"),
    "spiritual",
    [translate("builtinTags.karma.aliases.0")],
  ],
  [
    "exorcism",
    translate("builtinTags.exorcism.label"),
    "spiritual",
    [translate("builtinTags.exorcism.aliases.0")],
  ],

  [
    "elemental-magic",
    translate("builtinTags.elemental-magic.label"),
    "magic",
    [translate("builtinTags.elemental-magic.aliases.0")],
  ],
  [
    "pyrokinesis",
    translate("builtinTags.pyrokinesis.label"),
    "magic",
    [
      translate("builtinTags.pyrokinesis.aliases.0"),
      translate("builtinTags.pyrokinesis.aliases.1"),
    ],
  ],
  [
    "fire-projection",
    translate("builtinTags.fire-projection.label"),
    "pyrokinesis",
    [translate("builtinTags.fire-projection.aliases.0")],
  ],
  [
    "heat-control",
    translate("builtinTags.heat-control.label"),
    "pyrokinesis",
    [translate("builtinTags.heat-control.aliases.0")],
  ],
  [
    "flame-immunity",
    translate("builtinTags.flame-immunity.label"),
    "pyrokinesis",
    [translate("builtinTags.flame-immunity.aliases.0")],
  ],
  [
    "cryokinesis",
    translate("builtinTags.cryokinesis.label"),
    "magic",
    [translate("builtinTags.cryokinesis.aliases.0")],
  ],
  [
    "hydrokinesis",
    translate("builtinTags.hydrokinesis.label"),
    "magic",
    [translate("builtinTags.hydrokinesis.aliases.0")],
  ],
  [
    "aerokinesis",
    translate("builtinTags.aerokinesis.label"),
    "magic",
    [translate("builtinTags.aerokinesis.aliases.0")],
  ],
  [
    "geokinesis",
    translate("builtinTags.geokinesis.label"),
    "magic",
    [translate("builtinTags.geokinesis.aliases.0")],
  ],
  [
    "telekinesis",
    translate("builtinTags.telekinesis.label"),
    "magic",
    [translate("builtinTags.telekinesis.aliases.0")],
  ],
  [
    "healing-magic",
    translate("builtinTags.healing-magic.label"),
    "magic",
    [translate("builtinTags.healing-magic.aliases.0")],
  ],
  [
    "enchantment",
    translate("builtinTags.enchantment.label"),
    "magic",
    [translate("builtinTags.enchantment.aliases.0")],
  ],
  [
    "divination",
    translate("builtinTags.divination.label"),
    "magic",
    [translate("builtinTags.divination.aliases.0")],
  ],
  [
    "summoning",
    translate("builtinTags.summoning.label"),
    "magic",
    [translate("builtinTags.summoning.aliases.0")],
  ],
  [
    "necromancy",
    translate("builtinTags.necromancy.label"),
    "magic",
    [translate("builtinTags.necromancy.aliases.0")],
  ],
  [
    "illusion",
    translate("builtinTags.illusion.label"),
    "magic",
    [translate("builtinTags.illusion.aliases.0")],
  ],
  [
    "runes",
    translate("builtinTags.runes.label"),
    "magic",
    [
      translate("builtinTags.runes.aliases.0"),
      translate("builtinTags.runes.aliases.1"),
    ],
  ],
  [
    "alchemy",
    translate("builtinTags.alchemy.label"),
    "magic",
    [translate("builtinTags.alchemy.aliases.0")],
  ],
  [
    "curse",
    translate("builtinTags.curse.label"),
    "magic",
    [
      translate("builtinTags.curse.aliases.0"),
      translate("builtinTags.curse.aliases.1"),
    ],
  ],
  [
    "ward",
    translate("builtinTags.ward.label"),
    "magic",
    [
      translate("builtinTags.ward.aliases.0"),
      translate("builtinTags.ward.aliases.1"),
    ],
  ],
  [
    "ritual-magic",
    translate("builtinTags.ritual-magic.label"),
    "magic",
    [translate("builtinTags.ritual-magic.aliases.0")],
  ],
  [
    "time-magic",
    translate("builtinTags.time-magic.label"),
    "magic",
    [translate("builtinTags.time-magic.aliases.0")],
  ],
  [
    "space-magic",
    translate("builtinTags.space-magic.label"),
    "magic",
    [translate("builtinTags.space-magic.aliases.0")],
  ],
  [
    "nature-magic",
    translate("builtinTags.nature-magic.label"),
    "magic",
    [translate("builtinTags.nature-magic.aliases.0")],
  ],
  [
    "blood-magic",
    translate("builtinTags.blood-magic.label"),
    "magic",
    [translate("builtinTags.blood-magic.aliases.0")],
  ],

  [
    "chain-rules",
    translate("builtinTags.chain-rules.label"),
    "meta",
    [translate("builtinTags.chain-rules.aliases.0")],
  ],
  [
    "choice-points",
    translate("builtinTags.choice-points.label"),
    "meta",
    [
      translate("builtinTags.choice-points.aliases.0"),
      translate("builtinTags.choice-points.aliases.1"),
    ],
  ],
  [
    "fiat",
    translate("builtinTags.fiat.label"),
    "meta",
    [translate("builtinTags.fiat.aliases.0")],
  ],
  [
    "perk-interaction",
    translate("builtinTags.perk-interaction.label"),
    "meta",
    [translate("builtinTags.perk-interaction.aliases.0")],
  ],
  [
    "drawback-interaction",
    translate("builtinTags.drawback-interaction.label"),
    "meta",
    [translate("builtinTags.drawback-interaction.aliases.0")],
  ],
  [
    "narrative-control",
    translate("builtinTags.narrative-control.label"),
    "meta",
    [translate("builtinTags.narrative-control.aliases.0")],
  ],
  [
    "probability",
    translate("builtinTags.probability.label"),
    "meta",
    [translate("builtinTags.probability.aliases.0")],
  ],
  [
    "reality-warping",
    translate("builtinTags.reality-warping.label"),
    "meta",
    [translate("builtinTags.reality-warping.aliases.0")],
  ],
  [
    "dimensional-travel",
    translate("builtinTags.dimensional-travel.label"),
    "meta",
    [translate("builtinTags.dimensional-travel.aliases.0")],
  ],
  [
    "out-of-context",
    translate("builtinTags.out-of-context.label"),
    "meta",
    [translate("builtinTags.out-of-context.aliases.0")],
  ],

  [
    "concealment",
    translate("builtinTags.concealment.label"),
    "stealth",
    [translate("builtinTags.concealment.aliases.0")],
  ],
  [
    "infiltration",
    translate("builtinTags.infiltration.label"),
    "stealth",
    [translate("builtinTags.infiltration.aliases.0")],
  ],
  [
    "disguise",
    translate("builtinTags.disguise.label"),
    "stealth",
    [translate("builtinTags.disguise.aliases.0")],
  ],
  [
    "evasion",
    translate("builtinTags.evasion.label"),
    "stealth",
    [translate("builtinTags.evasion.aliases.0")],
  ],
  [
    "espionage",
    translate("builtinTags.espionage.label"),
    "stealth",
    [translate("builtinTags.espionage.aliases.0")],
  ],
  [
    "lockpicking",
    translate("builtinTags.lockpicking.label"),
    "stealth",
    [translate("builtinTags.lockpicking.aliases.0")],
  ],
  [
    "sabotage",
    translate("builtinTags.sabotage.label"),
    "stealth",
    [translate("builtinTags.sabotage.aliases.0")],
  ],
  [
    "surveillance",
    translate("builtinTags.surveillance.label"),
    "stealth",
    [translate("builtinTags.surveillance.aliases.0")],
  ],
  [
    "escape",
    translate("builtinTags.escape.label"),
    "stealth",
    [translate("builtinTags.escape.aliases.0")],
  ],
  [
    "theft",
    translate("builtinTags.theft.label"),
    "stealth",
    [translate("builtinTags.theft.aliases.0")],
  ],
  [
    "assassination",
    translate("builtinTags.assassination.label"),
    "stealth",
    [translate("builtinTags.assassination.aliases.0")],
  ],
  [
    "tracking",
    translate("builtinTags.tracking.label"),
    "stealth",
    [translate("builtinTags.tracking.aliases.0")],
  ],

  [
    "strength",
    translate("builtinTags.strength.label"),
    "physical",
    [translate("builtinTags.strength.aliases.0")],
  ],
  [
    "endurance",
    translate("builtinTags.endurance.label"),
    "physical",
    [translate("builtinTags.endurance.aliases.0")],
  ],
  [
    "speed",
    translate("builtinTags.speed.label"),
    "physical",
    [translate("builtinTags.speed.aliases.0")],
  ],
  [
    "agility",
    translate("builtinTags.agility.label"),
    "physical",
    [translate("builtinTags.agility.aliases.0")],
  ],
  [
    "senses",
    translate("builtinTags.senses.label"),
    "physical",
    [
      translate("builtinTags.senses.aliases.0"),
      translate("builtinTags.senses.aliases.1"),
    ],
  ],
  [
    "healing",
    translate("builtinTags.healing.label"),
    "physical",
    [translate("builtinTags.healing.aliases.0")],
  ],
  [
    "regeneration",
    translate("builtinTags.regeneration.label"),
    "healing",
    [translate("builtinTags.regeneration.aliases.0")],
  ],
  [
    "adaptation",
    translate("builtinTags.adaptation.label"),
    "physical",
    [translate("builtinTags.adaptation.aliases.0")],
  ],
  [
    "shapeshifting",
    translate("builtinTags.shapeshifting.label"),
    "physical",
    [translate("builtinTags.shapeshifting.aliases.0")],
  ],
  [
    "size-change",
    translate("builtinTags.size-change.label"),
    "shapeshifting",
    [translate("builtinTags.size-change.aliases.0")],
  ],
  [
    "flight",
    translate("builtinTags.flight.label"),
    "physical",
    [translate("builtinTags.flight.aliases.0")],
  ],
  [
    "aquatic",
    translate("builtinTags.aquatic.label"),
    "physical",
    [translate("builtinTags.aquatic.aliases.0")],
  ],
  [
    "biology",
    translate("builtinTags.biology.label"),
    "physical",
    [translate("builtinTags.biology.aliases.0")],
  ],
  [
    "longevity",
    translate("builtinTags.longevity.label"),
    "physical",
    [translate("builtinTags.longevity.aliases.0")],
  ],
  [
    "movement",
    translate("builtinTags.movement.label"),
    "physical",
    [translate("builtinTags.movement.aliases.0")],
  ],

  [
    "martial-arts",
    translate("builtinTags.martial-arts.label"),
    "combat",
    [translate("builtinTags.martial-arts.aliases.0")],
  ],
  [
    "weapons",
    translate("builtinTags.weapons.label"),
    "combat",
    [
      translate("builtinTags.weapons.aliases.0"),
      translate("builtinTags.weapons.aliases.1"),
    ],
  ],
  [
    "melee-weapons",
    translate("builtinTags.melee-weapons.label"),
    "weapons",
    [translate("builtinTags.melee-weapons.aliases.0")],
  ],
  [
    "ranged-weapons",
    translate("builtinTags.ranged-weapons.label"),
    "weapons",
    [translate("builtinTags.ranged-weapons.aliases.0")],
  ],
  [
    "firearms",
    translate("builtinTags.firearms.label"),
    "ranged-weapons",
    [
      translate("builtinTags.firearms.aliases.0"),
      translate("builtinTags.firearms.aliases.1"),
    ],
  ],
  [
    "tactics",
    translate("builtinTags.tactics.label"),
    "combat",
    [translate("builtinTags.tactics.aliases.0")],
  ],
  [
    "strategy",
    translate("builtinTags.strategy.label"),
    "combat",
    [translate("builtinTags.strategy.aliases.0")],
  ],
  [
    "grappling",
    translate("builtinTags.grappling.label"),
    "combat",
    [translate("builtinTags.grappling.aliases.0")],
  ],
  [
    "dueling",
    translate("builtinTags.dueling.label"),
    "combat",
    [translate("builtinTags.dueling.aliases.0")],
  ],
  [
    "marksmanship",
    translate("builtinTags.marksmanship.label"),
    "combat",
    [translate("builtinTags.marksmanship.aliases.0")],
  ],
  [
    "battlefield-control",
    translate("builtinTags.battlefield-control.label"),
    "combat",
    [translate("builtinTags.battlefield-control.aliases.0")],
  ],
  [
    "unarmed-combat",
    translate("builtinTags.unarmed-combat.label"),
    "combat",
    [translate("builtinTags.unarmed-combat.aliases.0")],
  ],
  [
    "military",
    translate("builtinTags.military.label"),
    "combat",
    [translate("builtinTags.military.aliases.0")],
  ],

  [
    "resistance",
    translate("builtinTags.resistance.label"),
    "defense",
    [translate("builtinTags.resistance.aliases.0")],
  ],
  [
    "elemental-resistance",
    translate("builtinTags.elemental-resistance.label"),
    "resistance",
    [translate("builtinTags.elemental-resistance.aliases.0")],
  ],
  [
    "mental-resistance",
    translate("builtinTags.mental-resistance.label"),
    "resistance",
    [translate("builtinTags.mental-resistance.aliases.0")],
  ],
  [
    "magical-resistance",
    translate("builtinTags.magical-resistance.label"),
    "resistance",
    [translate("builtinTags.magical-resistance.aliases.0")],
  ],
  [
    "immunity",
    translate("builtinTags.immunity.label"),
    "defense",
    [translate("builtinTags.immunity.aliases.0")],
  ],
  [
    "barriers",
    translate("builtinTags.barriers.label"),
    "defense",
    [
      translate("builtinTags.barriers.aliases.0"),
      translate("builtinTags.barriers.aliases.1"),
    ],
  ],
  [
    "armor",
    translate("builtinTags.armor.label"),
    "defense",
    [translate("builtinTags.armor.aliases.0")],
  ],
  [
    "recovery",
    translate("builtinTags.recovery.label"),
    "defense",
    [translate("builtinTags.recovery.aliases.0")],
  ],
  [
    "survival",
    translate("builtinTags.survival.label"),
    "defense",
    [translate("builtinTags.survival.aliases.0")],
  ],
  [
    "invulnerability",
    translate("builtinTags.invulnerability.label"),
    "defense",
    [translate("builtinTags.invulnerability.aliases.0")],
  ],
  [
    "damage-reduction",
    translate("builtinTags.damage-reduction.label"),
    "defense",
    [translate("builtinTags.damage-reduction.aliases.0")],
  ],
  [
    "hazard-protection",
    translate("builtinTags.hazard-protection.label"),
    "defense",
    [translate("builtinTags.hazard-protection.aliases.0")],
  ],
  [
    "anti-corruption",
    translate("builtinTags.anti-corruption.label"),
    "defense",
    [translate("builtinTags.anti-corruption.aliases.0")],
  ],

  [
    "engineering",
    translate("builtinTags.engineering.label"),
    "crafting",
    [translate("builtinTags.engineering.aliases.0")],
  ],
  [
    "enchanting",
    translate("builtinTags.enchanting.label"),
    "crafting",
    [translate("builtinTags.enchanting.aliases.0")],
  ],
  [
    "smithing",
    translate("builtinTags.smithing.label"),
    "crafting",
    [translate("builtinTags.smithing.aliases.0")],
  ],
  [
    "cooking",
    translate("builtinTags.cooking.label"),
    "crafting",
    [translate("builtinTags.cooking.aliases.0")],
  ],
  [
    "art",
    translate("builtinTags.art.label"),
    "crafting",
    [translate("builtinTags.art.aliases.0")],
  ],
  [
    "repair",
    translate("builtinTags.repair.label"),
    "crafting",
    [
      translate("builtinTags.repair.aliases.0"),
      translate("builtinTags.repair.aliases.1"),
    ],
  ],
  [
    "architecture",
    translate("builtinTags.architecture.label"),
    "crafting",
    [translate("builtinTags.architecture.aliases.0")],
  ],
  [
    "chemistry",
    translate("builtinTags.chemistry.label"),
    "crafting",
    [translate("builtinTags.chemistry.aliases.0")],
  ],
  [
    "tailoring",
    translate("builtinTags.tailoring.label"),
    "crafting",
    [translate("builtinTags.tailoring.aliases.0")],
  ],
  [
    "woodworking",
    translate("builtinTags.woodworking.label"),
    "crafting",
    [translate("builtinTags.woodworking.aliases.0")],
  ],
  [
    "agriculture",
    translate("builtinTags.agriculture.label"),
    "crafting",
    [translate("builtinTags.agriculture.aliases.0")],
  ],
  [
    "resource-production",
    translate("builtinTags.resource-production.label"),
    "crafting",
    [translate("builtinTags.resource-production.aliases.0")],
  ],
  [
    "invention",
    translate("builtinTags.invention.label"),
    "crafting",
    [translate("builtinTags.invention.aliases.0")],
  ],

  [
    "computing",
    translate("builtinTags.computing.label"),
    "technology",
    [translate("builtinTags.computing.aliases.0")],
  ],
  [
    "artificial-intelligence",
    translate("builtinTags.artificial-intelligence.label"),
    "computing",
    [
      translate("builtinTags.artificial-intelligence.aliases.0"),
      translate("builtinTags.artificial-intelligence.aliases.1"),
    ],
  ],
  [
    "cybernetics",
    translate("builtinTags.cybernetics.label"),
    "technology",
    [translate("builtinTags.cybernetics.aliases.0")],
  ],
  [
    "robotics",
    translate("builtinTags.robotics.label"),
    "technology",
    [translate("builtinTags.robotics.aliases.0")],
  ],
  [
    "vehicles",
    translate("builtinTags.vehicles.label"),
    "technology",
    [translate("builtinTags.vehicles.aliases.0")],
  ],
  [
    "spacecraft",
    translate("builtinTags.spacecraft.label"),
    "vehicles",
    [
      translate("builtinTags.spacecraft.aliases.0"),
      translate("builtinTags.spacecraft.aliases.1"),
    ],
  ],
  [
    "aircraft",
    translate("builtinTags.aircraft.label"),
    "vehicles",
    [
      translate("builtinTags.aircraft.aliases.0"),
      translate("builtinTags.aircraft.aliases.1"),
    ],
  ],
  [
    "watercraft",
    translate("builtinTags.watercraft.label"),
    "vehicles",
    [
      translate("builtinTags.watercraft.aliases.0"),
      translate("builtinTags.watercraft.aliases.1"),
    ],
  ],
  [
    "science",
    translate("builtinTags.science.label"),
    "technology",
    [translate("builtinTags.science.aliases.0")],
  ],
  [
    "automation",
    translate("builtinTags.automation.label"),
    "technology",
    [translate("builtinTags.automation.aliases.0")],
  ],
  [
    "energy",
    translate("builtinTags.energy.label"),
    "technology",
    [translate("builtinTags.energy.aliases.0")],
  ],
  [
    "weapons-technology",
    translate("builtinTags.weapons-technology.label"),
    "technology",
    [translate("builtinTags.weapons-technology.aliases.0")],
  ],
  [
    "biotechnology",
    translate("builtinTags.biotechnology.label"),
    "technology",
    [translate("builtinTags.biotechnology.aliases.0")],
  ],
  [
    "nanotechnology",
    translate("builtinTags.nanotechnology.label"),
    "technology",
    [translate("builtinTags.nanotechnology.aliases.0")],
  ],
  [
    "communications",
    translate("builtinTags.communications.label"),
    "technology",
    [translate("builtinTags.communications.aliases.0")],
  ],
  [
    "sensors",
    translate("builtinTags.sensors.label"),
    "technology",
    [translate("builtinTags.sensors.aliases.0")],
  ],
  [
    "virtual-reality",
    translate("builtinTags.virtual-reality.label"),
    "technology",
    [translate("builtinTags.virtual-reality.aliases.0")],
  ],
  [
    "infrastructure",
    translate("builtinTags.infrastructure.label"),
    "technology",
    [translate("builtinTags.infrastructure.aliases.0")],
  ],

  [
    "convenience",
    translate("builtinTags.convenience.label"),
    "miscellaneous",
    [translate("builtinTags.convenience.aliases.0")],
  ],
  [
    "novelty",
    translate("builtinTags.novelty.label"),
    "miscellaneous",
    [translate("builtinTags.novelty.aliases.0")],
  ],
  [
    "hobby",
    translate("builtinTags.hobby.label"),
    "miscellaneous",
    [translate("builtinTags.hobby.aliases.0")],
  ],
  [
    "aesthetic",
    translate("builtinTags.aesthetic.label"),
    "miscellaneous",
    [translate("builtinTags.aesthetic.aliases.0")],
  ],
  [
    "lifestyle",
    translate("builtinTags.lifestyle.label"),
    "miscellaneous",
    [translate("builtinTags.lifestyle.aliases.0")],
  ],
  [
    "wealth",
    translate("builtinTags.wealth.label"),
    "miscellaneous",
    [translate("builtinTags.wealth.aliases.0")],
  ],
  [
    "property",
    translate("builtinTags.property.label"),
    "miscellaneous",
    [translate("builtinTags.property.aliases.0")],
  ],
  [
    "storage",
    translate("builtinTags.storage.label"),
    "miscellaneous",
    [translate("builtinTags.storage.aliases.0")],
  ],
  [
    "clothing",
    translate("builtinTags.clothing.label"),
    "miscellaneous",
    [translate("builtinTags.clothing.aliases.0")],
  ],
  [
    "pet",
    translate("builtinTags.pet.label"),
    "miscellaneous",
    [translate("builtinTags.pet.aliases.0")],
  ],
  [
    "travel",
    translate("builtinTags.travel.label"),
    "miscellaneous",
    [translate("builtinTags.travel.aliases.0")],
  ],
  [
    "environment",
    translate("builtinTags.environment.label"),
    "miscellaneous",
    [translate("builtinTags.environment.aliases.0")],
  ],
  [
    "drawback",
    translate("builtinTags.drawback.label"),
    "miscellaneous",
    [translate("builtinTags.drawback.aliases.0")],
  ],
  [
    "companion",
    translate("builtinTags.companion.label"),
    "miscellaneous",
    [translate("builtinTags.companion.aliases.0")],
  ],
  [
    "item",
    translate("builtinTags.item.label"),
    "miscellaneous",
    [translate("builtinTags.item.aliases.0")],
  ],
  [
    "perk",
    translate("builtinTags.perk.label"),
    "miscellaneous",
    [translate("builtinTags.perk.aliases.0")],
  ],
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

export function localizedBuiltinTagLabel(id: string, languageTag?: string) {
  const preset = builtinTagPresetById[id];
  return preset
    ? translate(`builtinTags.${id}.label`, { lng: languageTag })
    : id;
}

export function localizedBuiltinTagAliases(id: string, languageTag?: string) {
  const preset = builtinTagPresetById[id];
  if (!preset) return [];
  return preset.aliases.map((alias, index) =>
    translate(`builtinTags.${id}.aliases.${index}`, {
      defaultValue: alias,
      lng: languageTag,
    }),
  );
}

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
