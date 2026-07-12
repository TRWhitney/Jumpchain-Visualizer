export const bodyModStats = [
  "Strength",
  "Endurance",
  "Speed",
  "Dexterity",
  "Appeal",
  "Shape",
  "Sense",
] as const;
export type BodyModStat = (typeof bodyModStats)[number];
export type BodyModType =
  "None" | "Bodybuilder" | "Athlete" | "Charmer" | "Bestial";

export const bodyModPerks = [
  ["Height", 100, 2],
  ["Flexibility", 100, 2],
  ["Endowed", 50, 999],
  ["Color", 100, 2],
  ["Winged", 150, 1],
  ["Metavore", 100, 1],
  ["Evercleansed", 100, 1],
  ["Genderswap", 150, 1],
] as const;
export type BodyModPerk = (typeof bodyModPerks)[number][0];

export const bodyTypes: Record<
  BodyModType,
  {
    cost: number;
    initials: string;
    stats: Partial<Record<BodyModStat, number>>;
    perks: Partial<Record<BodyModPerk, number>>;
    included: string;
  }
> = {
  None: {
    cost: 0,
    initials: "UM",
    stats: {},
    perks: {},
    included: "No included ranks",
  },
  Bodybuilder: {
    cost: 100,
    initials: "BB",
    stats: { Strength: 2, Endurance: 2 },
    perks: { Height: 1 },
    included: "Strength 2 · Endurance 2 · Height 1",
  },
  Athlete: {
    cost: 100,
    initials: "AT",
    stats: { Speed: 2, Dexterity: 2 },
    perks: { Flexibility: 1 },
    included: "Speed 2 · Dexterity 2 · Flexibility 1",
  },
  Charmer: {
    cost: 100,
    initials: "CH",
    stats: { Appeal: 2, Shape: 2 },
    perks: { Endowed: 3 },
    included: "Appeal 2 · Shape 2 · Endowed 3",
  },
  Bestial: {
    cost: 150,
    initials: "BE",
    stats: { Sense: 2 },
    perks: { Color: 1 },
    included: "Sense 2 · Color 1",
  },
};

export const statDescriptions: Record<BodyModStat, readonly string[]> = {
  Strength: [
    "Human average.",
    "Bench press roughly 180 pounds.",
    "Bench press roughly 250 pounds.",
    "Lift about twice your body weight.",
    "Lift about three times your body weight.",
  ],
  Endurance: [
    "Human average.",
    "Run a mile without heavy breathing.",
    "Finish a 5K and recover easily.",
    "Run a marathon, rest, then do it again.",
    "Remain active all day without fatigue.",
  ],
  Speed: [
    "Human average.",
    "Run steadily at about 6 mph.",
    "Run steadily at about 15 mph.",
    "Comparable to Usain Bolt.",
    "Motorcycle-like sprinting speed.",
  ],
  Dexterity: [
    "Human average.",
    "Clear a hurdle at a sprint.",
    "Basic parkour while maintaining speed.",
    "Balance through difficult precision movement.",
    "Advanced wall-running, ziplines, and fall recovery.",
  ],
  Appeal: [
    "Human average.",
    "Clear, acne-free skin.",
    "Clean, healthy hair and skin.",
    "No wrinkles, scars, or blemishes.",
    "Perfectly smooth, flawless skin.",
  ],
  Shape: [
    "Human average.",
    "Even, healthy fat distribution.",
    "Choose a plausible leg-to-torso ratio.",
    "Pronounced supple or rigid proportions.",
    "An idealized, striking physique.",
  ],
  Sense: [
    "Human average.",
    "20/20 vision and ordinary healthy senses.",
    "Sharper vision and sensory acuity.",
    "Double the power and range of three senses.",
    "Perceive beyond a normal human spectrum.",
  ],
};

export const perkDescriptions: Record<BodyModPerk, readonly string[]> = {
  Height: [
    "No height adjustment.",
    "Adjust height up to one foot from the current age-group average.",
    "Adjust height up to two feet from the current age-group average.",
  ],
  Flexibility: [
    "Ordinary flexibility.",
    "Reach the natural physical limit of the current body.",
    "Become more flexible than the body would ordinarily permit.",
  ],
  Endowed: [
    "No adjustment.",
    "Adjust primary or secondary physical proportions by one tier.",
  ],
  Color: [
    "Natural coloration.",
    "Choose any naturally possible skin, hair, or eye color.",
    "Choose any imaginable coloration.",
  ],
  Winged: [
    "No wings.",
    "Functional wings that fold against the back when not in use.",
  ],
  Metavore: [
    "Ordinary fitness maintenance.",
    "Retain the selected physique with adequate nutrition.",
  ],
  Evercleansed: [
    "Ordinary cleanliness.",
    "Naturally repel dirt, mud, and body odor.",
  ],
  Genderswap: [
    "No Body Mod gender change.",
    "Change gender up to twice during a Jump.",
  ],
};

export type BodyModState = {
  build: string;
  type: BodyModType;
  purchasedStats: Record<BodyModStat, number>;
  purchasedPerks: Record<BodyModPerk, number>;
  animal: string;
  bestialTier: number;
  bestialStat: BodyModStat;
};

export const initialBodyModState: BodyModState = {
  build: "Medium",
  type: "Athlete",
  purchasedStats: {
    Strength: 1,
    Endurance: 0,
    Speed: 1,
    Dexterity: 0,
    Appeal: 0,
    Shape: 0,
    Sense: 0,
  },
  purchasedPerks: {
    Height: 1,
    Flexibility: 0,
    Endowed: 0,
    Color: 0,
    Winged: 0,
    Metavore: 0,
    Evercleansed: 0,
    Genderswap: 0,
  },
  animal: "Wolf",
  bestialTier: 1,
  bestialStat: "Speed",
};

export const changeBodyModType = (
  state: BodyModState,
  type: BodyModType,
): BodyModState => ({ ...state, type });

export function freeStats(state: BodyModState) {
  const free = { ...bodyTypes[state.type].stats };
  if (state.type === "Bestial" && state.bestialTier > 0)
    free[state.bestialStat] = Math.min(
      4,
      (free[state.bestialStat] ?? 0) + state.bestialTier,
    );
  return free;
}
export const freePerks = (state: BodyModState) => bodyTypes[state.type].perks;
export const totalStat = (state: BodyModState, name: BodyModStat) =>
  Math.min(4, (freeStats(state)[name] ?? 0) + state.purchasedStats[name]);
export const totalPerk = (state: BodyModState, name: BodyModPerk) =>
  (freePerks(state)[name] ?? 0) + state.purchasedPerks[name];
export const bodyModStatCost = (state: BodyModState) =>
  Object.values(state.purchasedStats).reduce((sum, rank) => sum + rank * 50, 0);
export const bodyModPerkCost = (state: BodyModState) =>
  bodyModPerks.reduce(
    (sum, [name, price]) => sum + state.purchasedPerks[name] * price,
    0,
  );
export const bodyModRemaining = (state: BodyModState) =>
  600 -
  bodyTypes[state.type].cost -
  bodyModStatCost(state) -
  bodyModPerkCost(state);
export const bestialPresentation = (state: BodyModState) =>
  [
    `${state.animal || "Animal"}-trait body`,
    `${state.animal || "Animal"} Demi-Human`,
    `${state.animal || "Animal"} Anthro`,
  ][state.bestialTier] ?? `${state.animal || "Animal"} Demi-Human`;
