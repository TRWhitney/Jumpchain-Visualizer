import { translate } from "../localization";

const optionSlug = (value: string) =>
  value.toLocaleLowerCase("en").replaceAll(/[^a-z0-9]+/g, "-");

export const warehouseGroups: Record<
  string,
  readonly [string, number, string, string?][]
> = {
  utilities: [
    ["Electricity", 10, "Outlets, wiring, lights, and switches."],
    ["Plumbing", 10, "Running water and sewer connections."],
    ["Heat / A.C.", 10, "Thermostats and temperature control."],
    ["Local Net", 30, "Secure access to the current universe’s internet."],
    ["ForceWall", 20, "Seal the gateway behind you with a forcefield."],
    ["GravityLink", 10, "Reduce or disable gravity for heavy lifting."],
  ],
  structures: [
    ["Shelving", 0, "Numbered metal shelves for organizing possessions."],
    ["Terminal", 10, "A computer catalog of stored items."],
    ["Robots", 20, "Robots store and retrieve possessions."],
    ["Housing", 20, "A furnished home inside the Warehouse."],
    ["Workshop", 10, "Tools and parts for fabrication."],
    ["Medbay", 20, "A medical treatment facility."],
  ],
  misc: [
    ["Portal", 30, "Open the gateway on a suitable surface."],
    ["Link", 30, "Open two portals for travel.", "Portal"],
    ["Food Supply", 10, "A replenishing supply of ordinary food."],
    ["Loft", 10, "A raised living and storage level."],
    ["Free Space", 30, "Double the available floor area."],
    ["Stasis Pod", 20, "Carry one person safely per pod."],
  ],
};
export const warehouseDescriptions = Object.fromEntries(
  Object.values(warehouseGroups)
    .flat()
    .map(([name, , copy]) => [name, copy]),
);
export function warehouseCost(selected: readonly string[], pods: number) {
  return (
    Object.values(warehouseGroups)
      .flat()
      .filter(([name]) => selected.includes(name) && name !== "Stasis Pod")
      .reduce((sum, [, cost]) => sum + cost, 0) +
    pods * 20
  );
}

export const questRows = [
  [
    "expert",
    "Become an expert",
    100,
    "Master the basics of technology, magic, or another power unique to this setting.",
  ],
  [
    "setup",
    "Set up the usual storyline",
    100,
    "Bring the main characters together and ensure the inciting incident occurs.",
  ],
  ["cast", "Join the main cast", 100, "Become their friend, rival, or enemy."],
  [
    "master",
    "Become a master",
    200,
    "Achieve mastery of a technology, magic, or power unique to this setting.",
  ],
  [
    "form-org",
    "Form a local organization",
    200,
    "Create an organization with meaningful local presence.",
  ],
  [
    "join-org",
    "Join a major organization",
    200,
    "Integrate with a well-known organization or government.",
  ],
  [
    "beats",
    "Preserve the story beats",
    400,
    "Ensure the usual storyline reaches all of its familiar major beats.",
  ],
  [
    "authority",
    "Gain notable authority",
    400,
    "Hold a position of authority in a well-known organization or government.",
  ],
  [
    "local-tone",
    "Transform a local area",
    400,
    "Make its overall tone vastly better or worse.",
  ],
  [
    "fame",
    "Become setting-wide famous",
    600,
    "Earn fame across the setting’s full scope.",
  ],
  [
    "lead-org",
    "Lead a major organization",
    600,
    "Take command of a well-known organization or government.",
  ],
  [
    "setting-tone",
    "Transform the setting",
    600,
    "Make the setting’s overall tone vastly better or worse.",
  ],
] as const;

export const warehouseLabel = (name: string) =>
  translate(`supplements.warehouse.${optionSlug(name)}.label`);

for (const entries of Object.values(warehouseGroups))
  for (const entry of entries) {
    const name = entry[0];
    Object.defineProperty(entry, 2, {
      configurable: true,
      enumerable: true,
      get: () =>
        translate(`supplements.warehouse.${optionSlug(name)}.description`),
    });
    Object.defineProperty(warehouseDescriptions, name, {
      configurable: true,
      enumerable: true,
      get: () =>
        translate(`supplements.warehouse.${optionSlug(name)}.description`),
    });
  }
for (const quest of questRows) {
  const id = quest[0];
  Object.defineProperties(quest, {
    1: {
      configurable: true,
      enumerable: true,
      get: () => translate(`supplements.quests.${id}.label`),
    },
    3: {
      configurable: true,
      enumerable: true,
      get: () => translate(`supplements.quests.${id}.description`),
    },
  });
}
