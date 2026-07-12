import type { CatalogEntry } from "./model";
import essentialSource from "./essential-catalog.json";
import personalRealitySource from "./personal-reality-catalog.json";
import udsSource from "./uds-catalog.json";

type EssentialSourceRow = {
  handle: string;
  name: string;
  category: string;
  price: string;
  values: number[];
};
type PersonalRealitySourceRow = {
  handle: string;
  name: string;
  category: string;
  price: string;
};
type UdsSourceRow = {
  id: string;
  name: string;
  category: string;
  price: string;
  cost: number;
};

function grouped<T>(
  rows: readonly T[],
  key: (row: T) => string,
): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((result, row) => {
    (result[key(row)] ??= []).push(row);
    return result;
  }, {});
}

type EssentialTuple = readonly [
  string,
  string,
  readonly number[],
  string,
  boolean?,
];

export const representativeEssentialCategoriesRaw: Record<
  string,
  readonly EssentialTuple[]
> = {
  basic: [
    [
      "basic-refinements",
      "Basic Refinements",
      [0],
      "Cosmetic, physical, mental, spiritual, and secondary-power refinements.",
      true,
    ],
    [
      "interface",
      "The Interface",
      [0],
      "Choose optional character, status, party, quest, timer, help, and notification windows.",
    ],
  ],
  physical: [
    [
      "physical-perfection",
      "Physical Perfection",
      [50, 100, 200],
      "Improves all physical performance from peak human through five times peak.",
    ],
    [
      "physical-resilience",
      "Physical Resilience",
      [50, 100, 200],
      "Provides escalating immunity to disease, toxins, radiation, and injury.",
    ],
    [
      "reduced-sustenance",
      "Reduced Sustenance",
      [50, 100, 200],
      "Progressively reduces and broadens ordinary food and drink requirements.",
    ],
    [
      "environmental-tolerance",
      "Environmental Tolerance",
      [50, 100],
      "Protects against breathing, temperature, pressure, and vacuum hazards.",
    ],
    [
      "regeneration",
      "Regeneration",
      [100, 200],
      "Accelerates recovery from minor wounds through severed limbs.",
    ],
    [
      "ageless",
      "Ageless",
      [50, 100],
      "Extends lifespan or stops aging after physical maturity.",
    ],
    [
      "undead-physiology",
      "Undead Physiology",
      [50, 100, 200, 400, 600],
      "Creates an undead base physiology with higher tiers funding associated abilities.",
    ],
    [
      "elemental-physiology",
      "Elemental Physiology",
      [50, 100, 200, 400, 600],
      "Creates an elemental physiology tied to a chosen element.",
    ],
    [
      "creature-soul",
      "Creature Soul",
      [50, 100, 200, 400, 600],
      "Manifests and eventually assumes a chosen creature form.",
    ],
  ],
  mental: [
    [
      "heightened-senses",
      "Heightened Senses",
      [50, 100],
      "Improves the range and precision of ordinary senses.",
    ],
    [
      "heightened-reactions",
      "Heightened Reactions",
      [50, 100],
      "Accelerates reaction time and develops danger awareness.",
    ],
    [
      "mental-prowess",
      "Mental Prowess",
      [50, 100, 200],
      "Improves memory, processing, concentration, and mental endurance.",
    ],
    [
      "mental-resistance",
      "Mental Resistance",
      [50, 100, 200],
      "Resists mental influence and hostile alteration.",
    ],
    [
      "blank",
      "Blank",
      [100, 200],
      "Blocks supernatural observation of personal information and history.",
    ],
    [
      "empathetic",
      "Empathetic",
      [50, 100],
      "Improves awareness and understanding of others’ emotions.",
    ],
    [
      "charismatic",
      "Charismatic",
      [50, 100],
      "Improves personal presence and social influence.",
    ],
  ],
  spiritual: [
    [
      "wild-empathy",
      "Wild Empathy",
      [50, 100],
      "Understand and influence animals and other non-sapient creatures.",
    ],
    [
      "unflappable",
      "Unflappable",
      [50],
      "Maintain composure under pressure and supernatural circumstances.",
    ],
    [
      "corruption-resistance",
      "Corruption Resistance",
      [100],
      "Resist effects that corrupt the body, mind, or soul.",
    ],
    [
      "inertia-of-self",
      "Inertia of Self",
      [100, 200],
      "Preserve identity against unwanted metaphysical change.",
    ],
    [
      "resource-recovery",
      "Supernatural Resource Recovery",
      [50, 100, 200, 400],
      "Accelerates recovery of magical and other non-physical resources.",
    ],
  ],
  skills: [
    [
      "strategic-mastery",
      "Strategic Mastery",
      [50, 100, 200, 400],
      "Learn strategy and tactics from familiarity through mastery.",
    ],
    [
      "leadership-mastery",
      "Leadership Mastery",
      [50, 100, 200, 400],
      "Learn command, administration, and organizational leadership.",
    ],
    [
      "martial-mastery",
      "Martial Mastery",
      [50, 100, 200, 400],
      "Learn armed and unarmed combat disciplines.",
    ],
    [
      "scientific-mastery",
      "Scientific Mastery",
      [50, 100, 200, 400],
      "Learn scientific disciplines encountered across the chain.",
    ],
    [
      "engineering-mastery",
      "Engineering Mastery",
      [50, 100, 200, 400],
      "Learn design, construction, and maintenance disciplines.",
    ],
    [
      "biomedical-mastery",
      "Biomedical Mastery",
      [50, 100, 200, 400],
      "Learn medicine and biological sciences.",
    ],
    [
      "occult-mastery",
      "Occult Mastery",
      [50, 100, 200, 400],
      "Learn occult lore and practices.",
    ],
    [
      "subterfuge-mastery",
      "Subterfuge Mastery",
      [50, 100, 200, 400],
      "Learn stealth, infiltration, and deception.",
    ],
    [
      "social-mastery",
      "Social Mastery",
      [50, 100, 200, 400],
      "Learn social interaction and cultural navigation.",
    ],
    [
      "wilderness-mastery",
      "Wilderness Mastery",
      [50, 100, 200, 400],
      "Learn survival and wilderness disciplines.",
    ],
    [
      "polyglot",
      "Polyglot",
      [50],
      "Quickly understand and learn encountered languages.",
    ],
  ],
  supernatural: [
    [
      "form-mastery",
      "Form Mastery",
      [100, 200, 400],
      "Improves control, access, and combination of alternate forms.",
    ],
    [
      "morphic-form",
      "Morphic Form",
      [100, 200, 400],
      "Allows increasingly extensive shapeshifting.",
    ],
    [
      "energy-projection",
      "Energy Projection",
      [100, 200, 400, 600],
      "Projects a selected form of damaging energy.",
    ],
    [
      "kinesis",
      "Kinesis",
      [100, 200, 400, 600],
      "Manipulates a selected material or force at increasing scale.",
    ],
    [
      "flight",
      "Flight",
      [100, 200, 400, 600],
      "Provides increasingly fast atmospheric flight.",
    ],
    [
      "inventory",
      "Inventory",
      [100, 200, 400, 600],
      "Creates personal extradimensional item storage.",
    ],
    [
      "power-toggle",
      "Power Toggle",
      [100],
      "Suppresses or restores owned abilities and their visible effects.",
    ],
    [
      "power-combination",
      "Power Combination",
      [100, 200, 400],
      "Combines compatible abilities into unified expressions.",
    ],
    [
      "private-reality",
      "Private Reality",
      [600],
      "Creates a personal extradimensional reality.",
    ],
    [
      "cheat-death",
      "Cheat Death",
      [200, 400],
      "Provides limited methods of returning from death.",
    ],
    [
      "healing-touch",
      "Healing Touch",
      [100, 200, 400, 600],
      "Heals others with escalating speed and scope.",
    ],
    [
      "divinity",
      "Divinity",
      [600],
      "Establishes a divine portfolio and metaphysical authority.",
    ],
  ],
  items: [
    [
      "essence-infusion-item",
      "Essence Infusion",
      [100],
      "Give one non-CP item fiat protection and reliable return.",
    ],
    [
      "essence-integration",
      "Essence Integration",
      [100],
      "Treat implanted technology or magitech as part of the base form.",
    ],
    [
      "essential-annexation",
      "Essential Annexation",
      [100, 200, 400, 600],
      "Attach increasingly large owned properties to a persistent space.",
    ],
    [
      "essential-item",
      "Essential Item",
      [100],
      "Allow one item to import into future settings at an appropriate local level.",
    ],
  ],
  companions: [
    [
      "essence-transfer",
      "Essence Transfer",
      [50, 100, 200, 400],
      "Transfer a chosen amount of EP to an eligible companion.",
    ],
    [
      "essence-link",
      "Essence Link",
      [100, 200],
      "Give a companion scaling EP and eventual Essence access.",
    ],
    [
      "essential-companion",
      "Essential Companion",
      [100],
      "Provide persistent import and Gauntlet protections to one companion.",
    ],
  ],
  drawbacks: [
    [
      "dependency",
      "Dependency",
      [-100],
      "Require regular access to a specific substance.",
    ],
    [
      "standout",
      "Standout",
      [-100, -200, -300],
      "Become increasingly noticeable, unnerving, or provocative.",
    ],
    [
      "unnatural-presence",
      "Unnatural Presence",
      [-100],
      "Cause an unmistakable supernatural impression.",
    ],
    [
      "elemental-vulnerability",
      "Elemental Vulnerability",
      [-100, -200],
      "Suffer an escalating weakness to a selected element.",
    ],
    [
      "vulnerability",
      "Vulnerability",
      [-100, -200],
      "Suffer an escalating weakness to a selected substance.",
    ],
    [
      "achilles-heel",
      "Achilles Heel",
      [-100],
      "Retain a vulnerable point that determined enemies may reach.",
    ],
    [
      "lovable-goof",
      "Lovable Goof",
      [-100],
      "Lose access to social enhancement perks in exchange for awkward charm.",
    ],
    [
      "compulsions",
      "Compulsions",
      [-100],
      "Accept several minor compulsions or one major compulsion.",
    ],
    [
      "softhearted",
      "Softhearted",
      [-100],
      "Become unusually susceptible to requests for help.",
    ],
    [
      "form-locked",
      "Form Locked",
      [-100, -200],
      "Restrict supplement abilities to selected forms.",
    ],
    [
      "wardrobe-malfunction",
      "Wardrobe Malfunction",
      [-100, -200],
      "Make shapeshifting unreliable around clothing.",
    ],
  ],
};

export const essentialPageCategories: Record<string, readonly CatalogEntry[]> =
  Object.fromEntries(
    Object.entries(representativeEssentialCategoriesRaw).map(
      ([category, entries]) => [
        category,
        entries.map(([id, name, costs, summary, included = false]) => ({
          id,
          name,
          costs,
          summary,
          category,
          destination: "EP" as const,
          included,
        })),
      ],
    ),
  );

const essentialPageByName = new Map(
  Object.values(essentialPageCategories)
    .flat()
    .map((entry) => [entry.name.toLowerCase(), entry]),
);
export const essentialCategories: Record<string, readonly CatalogEntry[]> =
  Object.fromEntries(
    Object.entries(
      grouped(
        (essentialSource as EssentialSourceRow[]).filter(
          (entry) => !["ep_grant", "essence"].includes(entry.category),
        ),
        (entry) => {
          if (
            [
              "wild_empathy_i_and_ii",
              "unflappable",
              "corruption_resistance",
              "inertia_of_self_i_and_ii",
              "supernatural_resource_recovery_i_to_iv",
            ].includes(entry.handle)
          )
            return "spiritual";
          if (
            [
              "essence_transfer",
              "essence_link_i_and_ii",
              "essential_companion",
            ].includes(entry.handle)
          )
            return "companions";
          return (
            (
              {
                skill: "skills",
                item: "items",
                drawback: "drawbacks",
                basic_option: "basic",
              } as Record<string, string>
            )[entry.category] ?? entry.category
          );
        },
      ),
    ).map(([category, entries]) => [
      category,
      entries.map((entry) => {
        const documented = essentialPageByName.get(entry.name.toLowerCase());
        return {
          id: entry.handle.replaceAll("_", "-"),
          name: entry.name,
          costs: entry.values.length ? entry.values : [0],
          summary:
            documented?.summary ??
            `${entry.name} changes the permanent ${category.replaceAll("-", " ")} build according to its listed ranks and limits.`,
          category,
          destination: "EP" as const,
          included: documented?.included,
        };
      }),
    ]),
  );

export const essentialEssences = [
  ["Warlord", "Lead armies, usually from the front."],
  ["Scholar", "Pursue knowledge, common and obscure."],
  ["Mad Doctor", "Push medical knowledge beyond accepted limits."],
  ["Crafter", "Build things both great and small."],
  ["Assassin", "End lives with precision."],
  ["Archmage", "Learn magic in all of its forms."],
  ["Brute", "Become a one-person force capable of defeating armies."],
  ["Superior", "Stretch human limits through internal and acquired power."],
  ["Lich", "Transcend death to continue magical study."],
  ["Vampire", "Transcend death by draining life from others."],
  ["Shapeshifter", "Transcend one mortal form by taking others."],
  ["King", "Rule a nation of sentient beings or more."],
  ["Beast", "Become an inhuman creature."],
  ["Dragon", "Become a dragon."],
  ["Explorer", "Discover new places and ideas."],
  ["Healer", "Mend the injuries of others."],
  ["Elemental", "Become one with an element."],
  ["Druid", "Harness the power of nature."],
] as const;

export const representativePersonalRealityCategories: Record<
  string,
  readonly CatalogEntry[]
> = Object.fromEntries(
  Object.entries({
    basics: [
      "Cosmic Warehouse",
      "Boxes and Boxes and Boxes",
      "Access Key",
      "Starting Space",
      "Neutral Lighting",
      "Shelving",
      "Environmentally Neutral",
      "A Week & A Button",
      "Security System",
      "Loft",
      "Entrance Hall",
      "The Benefactor Lounge",
      "Cleaning Supplies",
      "Antibiotic Field",
      "Second Reality",
    ],
    utilities: [
      "Electricity",
      "Plumbing",
      "Heating",
      "Cooling",
      "Internet",
      "Communications",
      "ForceWall",
      "GravityLink",
      "Portal",
      "Link",
      "Environmental Controls",
      "Weather Controls",
      "Day-Night Cycle",
      "Waste Processing",
      "Water Purification",
      "Power Core",
      "Automation",
    ],
    cosmetic: [
      "Natural Sky",
      "Landscaping",
      "Interior Themes",
      "Ambient Sound",
      "Seasonal Cycle",
      "Windows",
      "Horizon",
      "Decorative Lighting",
    ],
    facilities: [
      "Housing",
      "Workshop",
      "Medbay",
      "Laboratory",
      "Kitchen",
      "Library",
      "Gymnasium",
      "Dojo",
      "Greenhouse",
      "Stables",
      "Garage",
    ],
    extensions: [
      "More Space",
      "Extra Height",
      "Biome",
      "Ocean",
      "Celestial Vault",
    ],
    items: ["Stasis Pod", "Terminal", "Robots", "Fabricator", "Universal Key"],
    companions: [
      "Companion Housing",
      "Follower Quarters",
      "Guest Access",
      "Resident Staff",
    ],
    misc: [
      "Return",
      "Recall",
      "Remote Access",
      "Time Control",
      "Reality Anchor",
    ],
    limitations: [
      "No Utilities",
      "Limited Access",
      "Shared Entry",
      "Visible Portal",
      "Manual Cleaning",
      "Finite Supplies",
      "Restricted Size",
      "Unstable Climate",
      "No Automation",
      "No Visitors",
      "Slow Time",
      "Single Entrance",
    ],
  }).map(([category, names]) => [
    category,
    names.map((name, index) => ({
      id: `${category}-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      name,
      costs: [
        category === "basics" && index < 14
          ? 0
          : category === "limitations"
            ? -50
            : 50 + (index % 4) * 50,
      ],
      summary: `A ${category.replaceAll("-", " ")} option for the persistent Personal Reality.`,
      category,
      destination: "WP" as const,
    })),
  ]),
);

type RealityTuple = readonly [
  string,
  string,
  readonly number[],
  string,
  boolean?,
];
const freeRealityBasics = [
  "Cosmic Warehouse",
  "Boxes and Boxes and Boxes",
  "Access Key",
  "Starting Space",
  "Neutral Lighting",
  "Shelving",
  "Environmentally Neutral",
  "A Week & A Button",
  "Security System",
  "Loft",
  "Entrance Hall",
  "The Benefactor Lounge",
  "Cleaning Supplies",
  "Antibiotic Field",
] as const;
const personalRealityMockRaw: Record<string, readonly RealityTuple[]> = {
  basics: [
    ...freeRealityBasics.map(
      (name) =>
        [
          name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
          name,
          [0],
          `${name} is included with the starting Personal Reality.`,
          true,
        ] as const,
    ),
    [
      "second-reality",
      "Second Reality",
      [600],
      "Create a separate second Personal Reality with its own purchases and the same Limitations.",
    ],
  ],
  utilities: [
    [
      "additional-space",
      "Additional Space",
      [200, 400, 600],
      "Multiply each standard dimension by ten with every purchase.",
    ],
    [
      "discount-space",
      "Discount Additional Space",
      [100, 200, 300],
      "Multiply each dimension by three; two purchases count as one full expansion.",
    ],
    [
      "adaptive-storage",
      "Adaptive Inactive Storage",
      [200],
      "Create safe inactive storage for CP-backed possessions.",
    ],
    [
      "additional-keys",
      "Additional Keys",
      [50, 100, 150],
      "Add four attuned Personal Reality keys per purchase.",
    ],
    [
      "key-link",
      "Key Link",
      [50, 100, 150],
      "Link the Entry Hall to doors previously opened by an Access Key.",
    ],
    [
      "big-hole",
      "The Big Hole",
      [50],
      "Add a covered disposal opening into the limitless void.",
    ],
    [
      "lofty-loft",
      "Lofty Loft",
      [50],
      "Add a starting-space-sized area reserved for housing and luxury.",
    ],
    [
      "underside",
      "Underside",
      [100],
      "Allow basement spaces beneath the Lofty Loft.",
    ],
    [
      "playing-portals",
      "Playing With Portals",
      [300],
      "Open Personal Reality portals on suitable surfaces without relying on the Access Key.",
    ],
    [
      "portal-link",
      "Portal Link",
      [300],
      "Open portals from inside the Reality to previously visited places.",
    ],
    [
      "portal-control",
      "Portal Control Rod",
      [200],
      "Open portals at range with a summoned control device.",
    ],
    [
      "free-portal",
      "Free Portal",
      [100],
      "Open portals without a supporting surface and target any part of the Reality.",
    ],
    [
      "portal-aperture",
      "Portal Aperture",
      [100, 200, 300],
      "Expand portal size and opening speed.",
    ],
    [
      "power",
      "Who’s Got the Powa",
      [100],
      "Supply enough stable electricity for a major city.",
    ],
    [
      "pipes",
      "Pipes Pipes Pipes",
      [100],
      "Provide vast water, plumbing, and sewage capacity.",
    ],
    [
      "temporal-controls",
      "Temporal Controls",
      [200],
      "Change time flow while the owner is outside the Reality.",
    ],
    [
      "central-control",
      "Central Control",
      [100],
      "Install a pseudo-intelligent control and inventory system.",
    ],
  ],
  cosmetic: [
    [
      "sky-simulator",
      "Sky Simulator",
      [50],
      "Replace the ceiling with a simulated sky.",
    ],
    [
      "natural-lighting",
      "Natural Lighting",
      [50],
      "Provide realistic sun, moon, and star lighting.",
    ],
    [
      "treeline",
      "Treeline & Timber",
      [100],
      "Surround appropriate areas with a convincing forest boundary.",
    ],
    [
      "pond",
      "The Pond",
      [100],
      "Replace a wall with a configurable water feature.",
    ],
    [
      "ground-cover",
      "Realistic Ground Cover",
      [50],
      "Add natural-looking soil and ground cover.",
    ],
    [
      "basic-thematics",
      "Basic Thematics",
      [20, 40, 60],
      "Apply a coherent cosmetic theme to selected areas.",
    ],
    [
      "advanced-thematics",
      "Advanced Thematics",
      [100],
      "Make thematic presentation responsive and immersive.",
    ],
    [
      "theme-park",
      "Theme Park",
      [200],
      "Apply separate managed themes across the Reality.",
    ],
  ],
  facilities: [
    [
      "medical-bay",
      "The Medical Bay",
      [100],
      "Treat medical and dental problems for living patients.",
    ],
    [
      "connecting-doors",
      "Connecting Doors",
      [20, 40, 60],
      "Add paired doors connecting two parts of the Reality.",
    ],
    [
      "housing-complex",
      "Housing Complex",
      [100],
      "Provide housing for the Jumper’s sapient retinue.",
    ],
    [
      "classroom",
      "A Classy Classroom",
      [10],
      "Add a well-equipped teaching space.",
    ],
    [
      "big-pool",
      "The Big Pool",
      [10],
      "Add an Olympic water park when plumbing is available.",
    ],
    [
      "entertainment-room",
      "Entertainment Room",
      [50],
      "Add rooms for passive media and relaxation.",
    ],
    [
      "arsenal",
      "Watch Your Arsenal",
      [200],
      "Add an organized armory for weapons and armor.",
    ],
    [
      "game-room",
      "I’m Game Room",
      [100],
      "Add networked gaming and tabletop facilities.",
    ],
    [
      "garage",
      "The Garage of the Gods",
      [200],
      "Add adaptive berths and maintenance for vehicles.",
    ],
    ["mall", "The Titan’s Mall", [100], "Add a mall with configurable shops."],
    [
      "greenhouse",
      "Guardian’s Greenhouse",
      [100],
      "Add a controlled greenhouse when water and power are available.",
    ],
  ],
  extensions: [
    [
      "library",
      "The Library Jumpxandria",
      [100],
      "Add a protected library for writings collected across the chain.",
    ],
    [
      "starting-collection",
      "Starting Collection",
      [100, 150, 200],
      "Stock the Library with expected reference works.",
    ],
    [
      "parking-station",
      "Parking Station",
      [50],
      "Add vehicle parking and transport support.",
    ],
    [
      "village",
      "The Village",
      [300],
      "Add a populated settlement-scale extension.",
    ],
    [
      "small-multiverse",
      "It’s a Small Multiverse",
      [400],
      "Attach multiple themed pocket environments.",
    ],
    [
      "hollow-earth",
      "Hollow Earth",
      [500],
      "Create a vast internal world extension.",
    ],
  ],
  items: [
    [
      "cleaning-supplies",
      "Cleaning Supplies",
      [0],
      "Provide unlimited ordinary cleaning supplies.",
      true,
    ],
    [
      "music-collection",
      "Music Collection",
      [50],
      "Maintain a broad collection of recorded music.",
    ],
    [
      "movie-collection",
      "Movie & TV Series Collection",
      [50],
      "Maintain a broad collection of recorded visual media.",
    ],
    [
      "printing-precious",
      "Printing Precious",
      [300],
      "Add specialized fabrication and printing machinery.",
    ],
    [
      "one-art",
      "One Art Please",
      [50, 100, 150],
      "Add chosen works of art to the Reality’s collection.",
    ],
  ],
  companions: [
    [
      "calibration-unit",
      "Companion Calibration Unit",
      [300],
      "Calibrate eligible companions for imported forms and local conditions.",
    ],
    [
      "my-harem",
      "My Harem",
      [300],
      "Combine eligible lovers or spouses into shared companion slots.",
    ],
    [
      "all-your-peeps",
      "All Your Peeps",
      [50, 100, 150, 600],
      "Bring selected people from the Origin Reality or buy the unlimited plan.",
    ],
    [
      "podpanion",
      "Podpanion Support",
      [200],
      "Provide protected accommodation and support for pod-based companions.",
    ],
  ],
  misc: [
    [
      "happy-returns",
      "Many Happy Returns",
      [200],
      "Spend another ten years in a previously visited world on the source cadence.",
    ],
    [
      "eye-spy",
      "Eye Spy",
      [100],
      "Observe anything occurring inside the Personal Reality.",
    ],
    [
      "all-your-stuff",
      "All Your Stuff",
      [100],
      "Bring Origin Reality possessions and give them fiat backing.",
    ],
    [
      "mini-reality",
      "Personal Mini-Reality",
      [300],
      "Create a smaller personal domain connected to the main Reality.",
    ],
    [
      "dyson-shell",
      "Shell By Dyson",
      [500],
      "Convert a Personal Mini-Reality into a Dyson-scale system.",
    ],
  ],
  limitations: [
    [
      "crowd-scene",
      "Crowd Scene",
      [-50],
      "Fill the Reality with anonymous metropolitan crowds.",
    ],
    [
      "dangerous-wildlife",
      "Dangerous Wildlife",
      [-100],
      "Make wildlife inside the Reality actively antagonistic.",
    ],
    [
      "infestation",
      "Infestation",
      [-100],
      "Cause recurring colonies of adaptive vermin and pests.",
    ],
    [
      "air-fresheners",
      "Air Fresheners Needed",
      [-100],
      "Require regular airing or cleaning to control accumulated odors.",
    ],
    [
      "journeying-spirits",
      "Journeying Spirits",
      [-100],
      "Make recently departed spirits pass through the Reality.",
    ],
    [
      "warehouse-clock",
      "Warehouse Clock",
      [-100, -200],
      "Limit daily time inside the Reality.",
    ],
    [
      "unsecured",
      "Unsecured",
      [-200],
      "Allow sufficiently powerful or skilled outsiders to breach the Reality.",
    ],
    [
      "natural-disasters",
      "Natural Disasters",
      [-200],
      "Subject the Reality to recurring destructive disasters.",
    ],
    [
      "labyrinth",
      "The Labyrinth of Jumpnos",
      [-300],
      "Distribute purchases through a rearranging labyrinth.",
    ],
    [
      "never-twain",
      "Never the Twain Shall Meet",
      [-500],
      "Make the Reality virtual and prevent physical transfers.",
    ],
    [
      "big-benefactor",
      "Big Benefactor",
      [-500],
      "Turn the chain into pervasive entertainment with assigned challenges.",
    ],
    [
      "woods",
      "The Woods Are Lovely, Dark and Deep",
      [-1000],
      "Place the Reality in a hostile primeval forest; cannot be bought off.",
    ],
  ],
};

export const personalRealityPageCategories: Record<
  string,
  readonly CatalogEntry[]
> = Object.fromEntries(
  Object.entries(personalRealityMockRaw).map(([category, entries]) => [
    category,
    entries.map(([id, name, costs, summary, included = false]) => ({
      id,
      name,
      costs,
      summary,
      included,
      category,
      destination: "WP" as const,
    })),
  ]),
);

const realityPageByName = new Map(
  Object.values(personalRealityPageCategories)
    .flat()
    .map((entry) => [entry.name.toLowerCase(), entry]),
);
export const personalRealityCategories: Record<
  string,
  readonly CatalogEntry[]
> = Object.fromEntries(
  Object.entries(
    grouped(personalRealitySource as PersonalRealitySourceRow[], (entry) =>
      entry.category === "miscellaneous" ? "misc" : entry.category,
    ),
  ).map(([category, entries]) => [
    category,
    entries.map((entry) => {
      const value = Number(
        entry.price.match(/[0-9][0-9,]*/)?.[0].replaceAll(",", "") ?? 0,
      );
      const documented = realityPageByName.get(entry.name.toLowerCase());
      return {
        id: `reality-${entry.handle.replaceAll("_", "-")}`,
        name: documented?.name ?? entry.name,
        costs: documented?.costs ?? [
          entry.price.trim().startsWith("+") ? -value : value,
        ],
        summary:
          documented?.summary ??
          `${entry.name} modifies the Personal Reality’s ${category.replaceAll("-", " ")} configuration at the listed price.`,
        included: documented?.included,
        category,
        destination: "WP" as const,
      };
    }),
  ]),
);

export const udsCategories = [
  "chain",
  "companion",
  "warehouse",
  "starting",
  "powers",
  "setting",
  "ethos",
  "challenge",
] as const;
export const representativeUniversalDrawbacks: readonly CatalogEntry[] = [
  ["without-why", "Without Why", 200, "chain"],
  ["random-chan", "Random-Chan", 200, "chain"],
  ["pseudo-random", "Pseudo-Random-Chan", 50, "chain"],
  ["economic-impact", "Economic Impact", 50, "chain"],
  ["all-by-yourself", "All By Yourself", 200, "companion"],
  ["always-always-on", "Always Always On", 100, "powers"],
  ["earlier-beginning", "Earlier Beginning", 100, "starting"],
  ["slot-o-matic", "Slot-O-Matic", 150, "powers"],
  ["warehouse-lockout", "Warehouse Lockout", 100, "warehouse"],
  ["item-attrition", "Item Attrition", 100, "warehouse"],
  ["memory-of-a-jumper", "The Long Road", 100, "setting"],
  ["language-barrier", "Language Barrier", 50, "setting"],
  ["honorable", "Honorable", 100, "ethos"],
  ["mercy", "Merciful", 100, "ethos"],
  ["powerless", "Powerless", 200, "powers"],
  ["limited-access", "Limited Access", 100, "warehouse"],
  ["single-shot", "Single Shot", 0, "challenge"],
  ["never-ending", "Never Ending", 0, "challenge"],
  ["gauntlet-chain", "Gauntlet Chain", 0, "challenge"],
  ["trainwreck", "Trainwreck", 0, "challenge"],
  ["fresh-start", "Fresh Start", 200, "starting"],
  ["enemy-mine", "Enemy Mine", 100, "companion"],
  ["no-followers", "No Followers", 100, "companion"],
  ["sealed-powers", "Sealed Powers", 200, "powers"],
].map(([id, name, cost, category]) => ({
  id: String(id),
  name: String(name),
  costs: [Number(cost)],
  category: String(category),
  summary:
    "A pinned v1.12 rule represented with an independently written interface summary.",
  destination: "CP" as const,
}));

export const universalDrawbacksPage: readonly CatalogEntry[] = [
  [
    "without-why",
    "Without Why",
    200,
    "chain",
    "The Jumper does not know they are in a Jumpchain or receive the usual explanatory context.",
  ],
  [
    "random-chan",
    "Random-Chan",
    200,
    "chain",
    "Jump order is generated from a large random pool instead of being freely selected.",
  ],
  [
    "pseudo-random",
    "Pseudo-Random-Chan",
    50,
    "chain",
    "The author chooses the route, but the Jumper has no control over the destination or timing.",
  ],
  [
    "economic-impact",
    "Economic Impact",
    50,
    "chain",
    "Imported wealth affects local economies normally; protections against inflation or disruption no longer erase those consequences.",
  ],
  [
    "all-by-yourself",
    "All By Yourself",
    200,
    "companion",
    "Companions are unavailable for the affected scope and no new long-term companions may join during it.",
  ],
  [
    "two-player",
    "Two Player Jumpchain",
    0,
    "companion",
    "Creates two linked Jumpers with divided budgets and shared chain-failure conditions.",
  ],
  [
    "limited-access",
    "Limited Access",
    100,
    "warehouse",
    "Warehouse access is limited to a periodic interval or qualifying owned property; chaining it also supplies its one-time Warehouse benefit.",
  ],
  [
    "ready-access",
    "Ready Access",
    100,
    "warehouse",
    "Warehouse entrances remain vulnerable to outside intrusion and the protective Force Wall is unavailable.",
  ],
  [
    "no-insurance",
    "No Insurance",
    200,
    "warehouse",
    "Stolen Warehouse contents no longer return automatically; chaining it directs an additional stipend to items.",
  ],
  [
    "no-access",
    "No Access",
    300,
    "warehouse",
    "The Warehouse cannot be accessed for the affected Jump and incompatible Warehouse drawbacks are unavailable.",
  ],
  [
    "why-glowing",
    "Why Is It Glowing?",
    100,
    "warehouse",
    "Out-of-setting CP-backed equipment becomes visibly anomalous; its higher chained option directs the award to items.",
  ],
  [
    "hot-water",
    "Hot Water",
    50,
    "starting",
    "The Jump begins at the least desirable non-deadly listed location under an unpleasant insertion.",
  ],
  [
    "hotter-water",
    "Hotter Water",
    50,
    "starting",
    "The bad starting location becomes actively dangerous and harder to escape.",
  ],
  [
    "super-hot",
    "Super Hot",
    100,
    "starting",
    "Each Jump begins in its worst survivable location with a prolonged opening crisis.",
  ],
  [
    "not-so-ooc",
    "Not-So Out of Context",
    200,
    "powers",
    "Abilities brought from earlier settings acquire local counterparts, awareness, and counters in later settings.",
  ],
  [
    "luckless",
    "Luckless",
    100,
    "powers",
    "Luck perks and equivalent effects cannot benefit the affected actor.",
  ],
  [
    "slow-learner",
    "Slow Learner",
    100,
    "powers",
    "Accelerated-learning effects cannot benefit the affected actor.",
  ],
  [
    "setting-amnesia",
    "Setting Amnesia",
    200,
    "setting",
    "Foreknowledge of the current setting and its plot is unavailable while the drawback applies.",
  ],
  [
    "total-amnesia",
    "Total Amnesia",
    400,
    "setting",
    "Prior memories, rather than only setting knowledge, become unavailable for the affected Jump.",
  ],
  [
    "language-block",
    "Language Block",
    50,
    "setting",
    "Insertion supplies only a small kernel of the common language rather than automatic fluency.",
  ],
  [
    "oath-truth",
    "Oath of Truth",
    200,
    "ethos",
    "The actor must not communicate deliberate falsehoods; higher variants also cover misleading omission.",
  ],
  [
    "oath-humility",
    "Oath of Humility",
    200,
    "ethos",
    "The actor must not claim credit or accept rewards outside the selected variant’s narrow allowances.",
  ],
  [
    "npc-blues",
    "NPC Blues",
    0,
    "challenge",
    "A punishment-oriented challenge constrains the Jumper to an ordinary working life for a limited run of Jumps.",
  ],
  [
    "jumpseed",
    "JumpSeed",
    200,
    "challenge",
    "Other Jumpers exist in the originating world and return on their own schedules, restructuring the chain’s larger stakes.",
  ],
].map(([id, name, cost, category, summary]) => ({
  id: String(id),
  name: String(name),
  costs: [Number(cost)],
  category: String(category),
  summary: String(summary),
  destination: "CP" as const,
}));

const udsPageById = new Map(
  universalDrawbacksPage.map((entry) => [entry.id, entry]),
);
export const universalDrawbacks: readonly CatalogEntry[] = (
  udsSource as UdsSourceRow[]
).map((entry) => ({
  id: entry.id,
  name: entry.name,
  costs: [entry.cost],
  category: entry.category,
  summary:
    udsPageById.get(entry.id)?.summary ??
    `${entry.name} applies its listed ${entry.category} restriction and CP adjustment while active.`,
  destination: "CP" as const,
}));
