import { describe, expect, it } from "vitest";
import { validGeneratedJumpPackages } from "../fixtures/generatedPackages";
import {
  emptyActorEntryState,
  emptyJumpEntryState,
  evaluateChain,
  renderRenderable,
  renderRichTextRenderable,
  type ActorEntryState,
  type JumpRuntimeState,
} from "./jumps";
import { deterministicRandomIndex } from "./random";
import { canonicalizePackage } from "../markup";

const packages = Object.fromEntries(
  validGeneratedJumpPackages.map((item) => [item.id, item]),
);

const actor = (
  choices: ActorEntryState["choices"],
  choiceRolls: ActorEntryState["choiceRolls"] = {},
  sourceRolls: ActorEntryState["sourceRolls"] = {},
): ActorEntryState => ({
  ...emptyActorEntryState(),
  choices,
  choiceRolls,
  sourceRolls,
});

const withSourceSelections = (
  packageId: string,
  state: ActorEntryState,
): ActorEntryState => {
  const packageItem = packages[packageId];
  if (!packageItem) return state;
  return {
    ...state,
    sourceSelections: {
      ...Object.fromEntries(
        packageItem.sections.flatMap((section) =>
          section.sources.map((source) => [
            `${section.handle}:${source.handle}`,
            packageItem.choices
              .filter(
                (choice) =>
                  source.group &&
                  choice.groups.includes(source.group) &&
                  Object.hasOwn(state.choices, choice.handle),
              )
              .map((choice) => choice.handle),
          ]),
        ),
      ),
      ...state.sourceSelections,
    },
  };
};

const one = (
  packageId: string,
  jumper: ActorEntryState,
  appliedGauntlet: JumpRuntimeState[string]["appliedGauntlet"] = [],
) =>
  evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageId },
    packages,
    jumpState: {
      entry: {
        actors: { jumper: withSourceSelections(packageId, jumper) },
        appliedGauntlet,
      },
    },
    jumperName: "Morgan",
  });

describe("Format 1 chain evaluation", () => {
  it("preserves stable entry, actor, choice, and aggregate ordering", () => {
    const order = ["threshold", "confluence", "trial"];
    const result = evaluateChain({
      order,
      packageIdByEntry: {
        threshold: "threshold-roads",
        confluence: "confluence-engine",
        trial: "last-trial",
      },
      packages,
      jumpState: Object.fromEntries(
        order.map((entryId) => [entryId, emptyJumpEntryState()]),
      ),
      jumperName: "Morgan",
    });

    expect(Object.keys(result.runtime)).toEqual(order);
    expect(Object.keys(result.runtime.threshold.actors)).toEqual(["jumper"]);
    expect(Object.keys(result.runtime.threshold.actors.jumper.choices)).toEqual(
      packages["threshold-roads"].choices.map((choice) => choice.handle),
    );
    expect(result.records.map((record) => record.id)).toEqual([
      ...new Set(result.records.map((record) => record.id)),
    ]);
    expect(result.forms.map((form) => form.id)).toEqual([
      ...new Set(result.forms.map((form) => form.id)),
    ]);
    expect(result.companions.map((companion) => companion.actorId)).toEqual([
      ...new Set(result.companions.map((companion) => companion.actorId)),
    ]);
  });

  it("keeps interpolated author answers literal inside rich text", () => {
    const blocks = renderRichTextRenderable(
      {
        base: "Answer: {{ answer }}",
        variants: [],
      },
      { answer: "**not bold**\n- not a list" },
    );
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        content: [{ text: "Answer: **not bold**\n- not a list" }],
      },
    ]);
  });

  it("interpolates whitespace-tolerant placeholders in plain renderables", () => {
    expect(
      renderRenderable(
        {
          base: "I can tell you're a smart {{ gender }}.",
          variants: [],
        },
        { gender: "Male" },
      ),
    ).toBe("I can tell you're a smart Male.");
  });

  it("derives reserved basic properties from named Choices and an Origin group", () => {
    const packageItem = canonicalizePackage({
      id: "implicit-basic-properties",
      exactHash: "i".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Implicit basics"
  author: "Tester"
  version: "1"

section
  handle: identity
  name: "Identity"

  choice
    handle: gender_field
    target: gender

  choice
    handle: age_field
    target: age

  choice
    handle: location_field
    target: location

  choice-source
    handle: origin
    group: backgrounds
    mode: single

choice
  handle: gender
  name: "Gender"
  selection: select
  option: "Male"
  option: "Female"

choice
  handle: age
  name: "Age"
  selection: integer

choice
  handle: location
  name: "Location (Poolside)"
  selection: toggle

choice
  handle: roadborn
  name: "Roadborn"
  group: backgrounds

choice
  handle: scholar
  name: "Scholar"
  group: backgrounds
`,
      },
    });
    const evaluated = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: {
        entry: {
          actors: {
            jumper: {
              ...emptyActorEntryState(),
              choices: {
                gender: "Female",
                age: 24,
                location: true,
              },
              sourceSelections: {
                "identity:origin": ["roadborn"],
              },
            },
          },
          appliedGauntlet: [],
        },
      },
      jumperName: "Tester",
    }).runtime.entry.actors.jumper;

    expect(evaluated.properties).toMatchObject({
      gender: { value: "Female", sourceLabel: "Gender" },
      age: { value: 24, sourceLabel: "Age" },
      origin: { value: "Roadborn", sourceLabel: "Roadborn" },
      location: { value: "Poolside", sourceLabel: "Location (Poolside)" },
    });
  });

  it("derives Origin from an ungrouped direct non-integer Choice", () => {
    const packageItem = canonicalizePackage({
      id: "implicit-direct-origin",
      exactHash: "o".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Implicit direct Origin"
  author: "Tester"
  version: "1"

section
  handle: identity
  name: "Identity"

  choice
    handle: origin_field
    target: origin

choice
  handle: origin
  name: "Origin (Local)"
  selection: toggle
`,
      },
    });
    const evaluated = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: {
        entry: {
          actors: {
            jumper: {
              ...emptyActorEntryState(),
              choices: { origin: true },
            },
          },
          appliedGauntlet: [],
        },
      },
      jumperName: "Tester",
    }).runtime.entry.actors.jumper;

    expect(evaluated.properties.origin).toEqual({
      value: "Local",
      sourceLabel: "Origin (Local)",
    });
  });

  it("provides deterministic fixture randomness through an injected port", () => {
    expect(deterministicRandomIndex(3, 0)).toBe(0);
    expect(deterministicRandomIndex(3, 4)).toBe(1);
    expect(() => deterministicRandomIndex(0, 0)).toThrow(RangeError);
  });

  it("evaluates ranked roll allowances, awards, and multiple resources", () => {
    const ranked = one(
      "last-trial",
      actor(
        { technique_ranks: 3 },
        { technique_ranks: { result: 2, sequence: 1 } },
      ),
    ).runtime.entry.actors.jumper;
    expect(ranked.choices.technique_ranks.costs[0]).toMatchObject({
      rankCount: 3,
      rolledAllowance: 2,
      resolvedAmount: 50,
    });
    expect(ranked.balance).toBe(-50);

    const resources = one(
      "last-trial",
      actor({ danger_stipend: "Accept", trial_requisition: "Field Kit" }),
    ).runtime.entry.actors.jumper.resources;
    expect(resources.jump_points).toMatchObject({
      granted: 100,
      spent: 100,
      balance: 0,
    });
    expect(resources.trial_marks).toMatchObject({ spent: 2, balance: 1 });
  });

  it("projects perk ranks and resolves conditional descriptions in actor context", () => {
    const ranked = one(
      "confluence-engine",
      actor(
        { adaptive_mastery: 3 },
        { adaptive_mastery: { result: 3, sequence: 1 } },
      ),
    ).records.find((record) => record.name === "Adaptive Mastery");
    expect(ranked?.measure).toEqual({ kind: "rank", value: 3 });
    expect(ranked?.description).toBe("A practiced discipline at rank 3.");
  });

  it("resolves owning Choice and supporting Input answers in award descriptions", () => {
    const packageItem = canonicalizePackage({
      id: "contextual-answers",
      exactHash: "c".repeat(64),
      files: {
        "jump.jdef": `choice
  handle: prompt
  name: "Prompt"
  selection: text

  input
    handle: detail
    selection: text

  grant
    kind: perk
    name: "Result"

    text
      handle: description
      content: "Waiting"
      content when prompt = "Ready": "{{prompt}} / {{detail}}"
`,
      },
    });
    const state = actor({ prompt: "Ready" });
    state.inputs = { prompt: { detail: "Follow-up" } };
    const evaluation = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: {
        entry: { actors: { jumper: state }, appliedGauntlet: [] },
      },
      jumperName: "Morgan",
    });

    expect(evaluation.records).toMatchObject([
      { name: "Result", description: "Ready / Follow-up" },
    ]);
  });

  it("defaults numeric grants to rank and supports explicit quantity measures", () => {
    const evaluation = one(
      "confluence-engine",
      actor({ adaptive_mastery: 3, facet_crates: 3 }),
    );
    expect(
      evaluation.records.find((record) => record.name === "Adaptive Mastery")
        ?.measure,
    ).toEqual({ kind: "rank", value: 3 });
    expect(
      evaluation.records.find((record) => record.name === "Facet Crates")
        ?.measure,
    ).toEqual({ kind: "quantity", value: 3 });
    expect(
      one("confluence-engine", actor({ facet_crates: 0 })).records.some(
        (record) => record.name === "Facet Crates",
      ),
    ).toBe(false);
  });

  it("grants forms to the Jumper and keeps targeted perks on the form", () => {
    const evaluation = one(
      "confluence-engine",
      actor({ prism_form: true, refractive_hide: true }),
    );
    expect(evaluation.forms).toMatchObject([
      { handle: "prism_form", name: "Prism Form", ownerActorId: "jumper" },
    ]);
    const perk = evaluation.records.find(
      (record) => record.name === "Refractive Hide",
    );
    expect(perk?.ownerFormId).toBe(evaluation.forms[0].id);
    expect(evaluation.forms[0].perkRecordIds).toEqual([perk?.id]);
  });

  it("funds imported companions and assigns targeted perks to their profiles", () => {
    const lyra = "companion:threshold:jumper:lyra_companion:0";
    const witness = "companion:threshold:jumper:quiet_witness:0";
    const trial = actor({
      trial_company: [lyra, witness],
      company_training: true,
    });
    trial.sourceSelections = {
      "companions:companions": ["trial_company", "company_training"],
    };
    const lyraState = withSourceSelections(
      "last-trial",
      actor({ participant_resilience: true }),
    );
    const evaluation = evaluateChain({
      order: ["threshold", "trial"],
      packageIdByEntry: {
        threshold: "threshold-roads",
        trial: "last-trial",
      },
      packages,
      jumpState: {
        threshold: {
          actors: {
            jumper: withSourceSelections(
              "threshold-roads",
              actor({ lyra_companion: true, quiet_witness: true }),
            ),
          },
          appliedGauntlet: [],
        },
        trial: {
          actors: { jumper: trial, [lyra]: lyraState },
          appliedGauntlet: [],
        },
      },
      jumperName: "Morgan",
    });

    expect(evaluation.runtime.trial.actors[lyra].resources.jump_points).toEqual(
      expect.objectContaining({ starting: 0, granted: 500, balance: 400 }),
    );
    expect(
      evaluation.runtime.trial.actors[witness].resources.jump_points,
    ).toEqual(
      expect.objectContaining({ starting: 0, granted: 500, balance: 500 }),
    );
    expect(
      evaluation.companions.find((companion) => companion.actorId === lyra)
        ?.importedEntryIds,
    ).toEqual(["trial"]);
    expect(
      evaluation.records.find((record) => record.name === "Company Pathfinder")
        ?.ownerActorId,
    ).toBe(lyra);
    expect(
      evaluation.records.filter(
        (record) => record.name === "Company Pathfinder",
      ),
    ).toHaveLength(2);
    expect(
      evaluation.records
        .filter((record) => record.name === "Company Training")
        .map((record) => record.ownerActorId)
        .sort(),
    ).toEqual([lyra, witness].sort());
  });

  it("deduplicates authored companion IDs before applying targeted grants", () => {
    const lyra = "companion:threshold:jumper:lyra_companion:0";
    const trial = actor({ trial_company: [lyra, lyra] });
    trial.sourceSelections = {
      "companions:companions": ["trial_company"],
    };
    const evaluation = evaluateChain({
      order: ["threshold", "trial"],
      packageIdByEntry: {
        threshold: "threshold-roads",
        trial: "last-trial",
      },
      packages,
      jumpState: {
        threshold: {
          actors: {
            jumper: withSourceSelections(
              "threshold-roads",
              actor({ lyra_companion: true }),
            ),
          },
          appliedGauntlet: [],
        },
        trial: {
          actors: { jumper: trial },
          appliedGauntlet: [],
        },
      },
      jumperName: "Morgan",
    });

    expect(
      evaluation.runtime.trial.actors[lyra].resources.jump_points.granted,
    ).toBe(500);
    expect(
      evaluation.records.filter(
        (record) =>
          record.name === "Company Pathfinder" && record.ownerActorId === lyra,
      ),
    ).toHaveLength(1);
  });

  it("applies no companion-selection cost or effects below the minimum", () => {
    const lyra = "companion:threshold:jumper:lyra_companion:0";
    const trial = actor({ trial_company: [lyra] });
    trial.sourceSelections = {
      "companions:companions": ["trial_company"],
    };
    const source = packages["last-trial"];
    const requiresTwo = {
      ...source,
      choices: source.choices.map((choice) =>
        choice.handle === "trial_company" ? { ...choice, min: 2 } : choice,
      ),
    };
    const evaluation = evaluateChain({
      order: ["threshold", "trial"],
      packageIdByEntry: {
        threshold: "threshold-roads",
        trial: "requires-two",
      },
      packages: { ...packages, "requires-two": requiresTwo },
      jumpState: {
        threshold: {
          actors: {
            jumper: withSourceSelections(
              "threshold-roads",
              actor({ lyra_companion: true }),
            ),
          },
          appliedGauntlet: [],
        },
        trial: {
          actors: { jumper: trial },
          appliedGauntlet: [],
        },
      },
      jumperName: "Morgan",
    });

    expect(
      evaluation.runtime.trial.actors.jumper.choices.trial_company,
    ).toMatchObject({ active: false });
    expect(
      evaluation.runtime.trial.actors.jumper.choices.trial_company.costs[0]
        .resolvedAmount,
    ).toBe(100);
    expect(
      evaluation.records.some(
        (record) =>
          record.name === "Company Pathfinder" && record.ownerActorId === lyra,
      ),
    ).toBe(false);
  });

  it("keeps grouped answers dormant until their source membership is selected", () => {
    const dormant = actor({ adaptive_mastery: 3 });
    dormant.sourceSelections = { "measures:measures": [] };
    const inactive = one("confluence-engine", dormant).runtime.entry.actors
      .jumper.choices.adaptive_mastery;
    expect(inactive).toMatchObject({ value: 3, active: false });
    expect(inactive.costs[0].resolvedAmount).toBe(150);

    dormant.sourceSelections = {
      "measures:measures": ["adaptive_mastery"],
    };
    const active = one("confluence-engine", dormant).runtime.entry.actors.jumper
      .choices.adaptive_mastery;
    expect(active).toMatchObject({ value: 3, active: true });
    expect(active.costs[0].resolvedAmount).toBeGreaterThan(0);
  });

  it("evaluates a Choice once when direct and Choice Source placements are both active", () => {
    const sourcePackage = packages["confluence-engine"];
    const packageItem = {
      ...sourcePackage,
      id: "duplicate-placement",
      sections: sourcePackage.sections.map((section) =>
        section.handle === "measures"
          ? {
              ...section,
              directChoices: [
                ...section.directChoices,
                {
                  handle: "direct_adaptive_mastery",
                  target: "adaptive_mastery",
                },
              ],
              members: [
                ...section.members,
                { kind: "choice" as const, handle: "direct_adaptive_mastery" },
              ],
            }
          : section,
      ),
    };
    const state = withSourceSelections(
      "confluence-engine",
      actor({ adaptive_mastery: 3 }),
    );
    const evaluation = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: {
        entry: { actors: { jumper: state }, appliedGauntlet: [] },
      },
      jumperName: "Morgan",
    });

    expect(
      evaluation.records.filter((record) => record.name === "Adaptive Mastery"),
    ).toHaveLength(1);
    expect(
      evaluation.runtime.entry.actors.jumper.resources.jump_points.spent,
    ).toBe(150);
  });

  it("does not import a companion created in the same Jump", () => {
    const currentAster = "companion:entry:jumper:aster_companion:0";
    const state = actor({
      aster_companion: true,
      trial_company: [currentAster],
    });
    state.sourceSelections = {
      "companions:companions": ["aster_companion", "trial_company"],
    };
    const evaluation = one("last-trial", state);
    expect(
      evaluation.records.some(
        (record) =>
          record.name === "Company Pathfinder" &&
          record.ownerActorId === currentAster,
      ),
    ).toBe(false);
  });

  it("does not expose an imported companion when targeted perks have no currency", () => {
    const lyra = "companion:threshold:jumper:lyra_companion:0";
    const trial = actor({ trial_company: [lyra] });
    trial.sourceSelections = {
      "companions:companions": ["trial_company"],
    };
    const source = packages["last-trial"];
    const unfunded = {
      ...source,
      choices: source.choices.map((choice) => ({
        ...choice,
        grants: choice.grants.filter(
          (grant) =>
            grant.kind !== "resource" || grant.companion !== "trial_company",
        ),
      })),
    };
    const evaluation = evaluateChain({
      order: ["threshold", "trial"],
      packageIdByEntry: { threshold: "threshold-roads", trial: "unfunded" },
      packages: { ...packages, unfunded },
      jumpState: {
        threshold: {
          actors: {
            jumper: withSourceSelections(
              "threshold-roads",
              actor({ lyra_companion: true }),
            ),
          },
          appliedGauntlet: [],
        },
        trial: { actors: { jumper: trial }, appliedGauntlet: [] },
      },
      jumperName: "Morgan",
    });

    expect(evaluation.runtime.trial.actors[lyra]).toBeUndefined();
    expect(
      evaluation.companions.find((companion) => companion.actorId === lyra)
        ?.importedEntryIds,
    ).toEqual([]);
    expect(
      evaluation.records.find((record) => record.name === "Company Pathfinder")
        ?.ownerActorId,
    ).toBe(lyra);
  });

  it("funds a newly purchased companion and grants its targeted perk", () => {
    const evaluation = one("last-trial", actor({ aster_companion: true }));
    const aster = "companion:entry:jumper:aster_companion:0";

    expect(evaluation.runtime.entry.actors[aster].balance).toBe(500);
    expect(evaluation.actors[aster].name).toBe("Aster");
    expect(
      evaluation.records.find((record) => record.name === "Trial Instinct")
        ?.ownerActorId,
    ).toBe(aster);
  });

  it("makes recorded choice and source results free without erasing provenance", () => {
    const choice = one(
      "last-trial",
      actor({ power_rank: 4 }, { power_rank: { result: 4, sequence: 1 } }),
    ).runtime.entry.actors.jumper.choices.power_rank;
    expect(choice.freeByRoll).toBe(true);
    expect(choice.costs[0].resolvedAmount).toBe(0);

    const source = one(
      "last-trial",
      actor(
        { random_flight: true },
        {},
        {
          "multi_random:electives": {
            result: "random_flight",
            sequence: 1,
          },
        },
      ),
    ).runtime.entry.actors.jumper.choices.random_flight;
    expect(source).toMatchObject({ rolledBySource: true, freeByRoll: true });
    expect(source.costs[0].resolvedAmount).toBe(0);
  });

  it("applies native and manual Gauntlet base reductions idempotently", () => {
    const native = one("last-trial", emptyActorEntryState());
    expect(native.runtime.entry.gauntlet).toMatchObject({
      active: true,
      native: true,
      startingPointContribution: 0,
    });
    expect(native.runtime.entry.actors.jumper.balance).toBe(0);

    const applied = one("threshold-roads", emptyActorEntryState(), [
      { id: "manual", kind: "user", label: "Applied by user" },
      { id: "quest", kind: "supplement", label: "Quest Mode" },
    ]);
    expect(applied.runtime.entry.gauntlet.startingPointContribution).toBe(0);
    expect(applied.runtime.entry.actors.jumper.balance).toBe(0);
  });

  it("derives previous/original continuity and frees missing dropdown baselines", () => {
    const order = ["threshold", "confluence", "trial"];
    const jumpState = Object.fromEntries(
      order.map((id) => [id, emptyJumpEntryState()]),
    );
    const result = evaluateChain({
      order,
      packageIdByEntry: {
        threshold: "threshold-roads",
        confluence: "confluence-engine",
        trial: "last-trial",
      },
      packages,
      jumpState,
      jumperName: "Morgan",
      initialIdentity: {
        gender: { value: "Female", sourceLabel: "Earth" },
        age: { value: 24, sourceLabel: "Earth" },
      },
    });
    expect(
      result.runtime.threshold.actors.jumper.choices.threshold_gender,
    ).toMatchObject({
      value: "Female",
      derivedContinuity: true,
      freeByRoll: false,
    });
    expect(
      result.runtime.threshold.actors.jumper.choices.threshold_gender.costs[0]
        .resolvedAmount,
    ).toBe(0);
    expect(
      result.runtime.confluence.actors.jumper.choices.confluence_gender,
    ).toMatchObject({
      value: "Female",
      continuityFreeValues: ["Female"],
    });
    expect(result.runtime.trial.actors.jumper.properties.age?.value).toBe(24);
    expect(
      result.runtime.trial.actors.jumper.properties.origin,
    ).toBeUndefined();
  });

  it("projects typed literal and copied properties", () => {
    const state = actor({
      roadborn_origin: true,
      threshold_alias: "Wayfinder",
      custom_door: true,
    });
    state.inputs = {
      custom_door: {
        door_name: "Homeward",
        door_count: 2,
        door_material: "Brass",
      },
    };
    const evaluation = one("threshold-roads", state);
    const projected = evaluation.runtime.entry.actors.jumper;
    expect(projected.properties.origin?.value).toBe("Roadborn");
    expect(projected.properties.species?.value).toBe("Human");
    expect(projected.properties.carries_map?.value).toBe(true);
    expect(projected.properties.road_name?.value).toBe("Wayfinder");
    expect(projected.properties.door_name?.value).toBe("Homeward");
    expect(projected.properties.door_count?.value).toBe(2);
    expect(projected.properties.door_material?.value).toBe("Brass");
    expect(
      evaluation.records.find((record) => record.name === "Keeper of Homeward"),
    ).toMatchObject({
      description: "Your 2 Brass doors answer to the name Homeward.",
    });
  });

  it("applies unconditional Jump grants without an artificial Choice", () => {
    const packageItem = canonicalizePackage({
      id: "jump-grants",
      exactHash: "g".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Jump Grants"
  author: "Tester"
  version: "1"

  grant
    kind: item
    name: "Starting Kit"

  grant
    kind: perk
    name: "Traveler's Instinct"

  grant
    kind: form
    handle: local_form
    name: "Local Form"

  grant
    kind: perk
    name: "Local Form Instinct"
    form: local_form

  grant
    kind: companion
    handle: guide
    name: "Guide"

  grant
    kind: perk
    name: "Guide Instinct"
    companion: guide

  grant
    kind: resource
    resource: jump_points
    amount: 25

  grant
    kind: resource
    resource: jump_points
    amount: 100
    companion: guide

  grant
    kind: trait
    name: "Jump Terms"
    text
      handle: description
      content: "Remain for ten years."

  grant
    kind: property
    handle: location
    value: "Kanto"

section
  handle: introduction
  name: "Introduction"
`,
      },
    });
    expect(
      packageItem.diagnostics.filter((item) => item.severity === "error"),
    ).toEqual([]);
    const result = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: emptyJumpEntryState() },
      jumperName: "Morgan",
    });
    expect(result.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "item", name: "Starting Kit" }),
        expect.objectContaining({ kind: "perk", name: "Traveler's Instinct" }),
        expect.objectContaining({
          kind: "perk",
          name: "Local Form Instinct",
          ownerFormId: "form:entry:local_form",
        }),
        expect.objectContaining({
          kind: "perk",
          name: "Guide Instinct",
          ownerActorId: "companion:entry:jumper:jump:4",
        }),
      ]),
    );
    expect(result.forms).toEqual([
      expect.objectContaining({ handle: "local_form", name: "Local Form" }),
    ]);
    expect(result.companions).toEqual([
      expect.objectContaining({
        actorId: "companion:entry:jumper:jump:4",
        perkRecordIds: expect.arrayContaining([
          "grant:entry:companion:entry:jumper:jump:4:jump:5",
        ]),
      }),
    ]);
    expect(result.runtime.entry.actors.jumper.balance).toBe(1025);
    expect(
      result.runtime.entry.actors["companion:entry:jumper:jump:4"].balance,
    ).toBe(100);
    expect(result.runtime.entry.actors.jumper.traits).toEqual([
      expect.objectContaining({
        name: "Jump Terms",
        description: "Remain for ten years.",
      }),
    ]);
    expect(result.runtime.entry.actors.jumper.properties.location?.value).toBe(
      "Kanto",
    );
  });

  it("stacks flat discounts before additive percentages across resources", () => {
    const packageItem = canonicalizePackage({
      id: "discount-effects",
      exactHash: "d".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Discount Effects"
  author: "Tester"
  version: "1"
  discount-stacking: stack
  discount-floor: negative

resource
  handle: mana
  name: "Mana"
  initial: 100

section
  handle: choices
  name: "Choices"

  choice
    handle: flat
    target: flat_origin

  choice
    handle: percent
    target: percent_origin

  choice
    handle: target
    target: training

choice
  handle: flat_origin
  name: "Flat Origin"
  discount
    group: skills
    mode: flat
    amount: 120

choice
  handle: percent_origin
  name: "Percent Origin"
  discount
    group: skills
    mode: percent
    amount: 20
  discount
    group: skills
    mode: percent
    amount: 30
    resource: jump_points

choice
  handle: training
  name: "Training"
  group: skills
  cost: 100
  cost
    resource: mana
    amount: 40
`,
      },
    });
    const state = actor({
      flat_origin: true,
      percent_origin: true,
      training: false,
    });
    const quoted = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Morgan",
    });
    expect(
      quoted.runtime.entry.actors.jumper.choices.training.costs.map(
        (cost) => cost.resolvedAmount,
      ),
    ).toEqual([-30, -96]);
    expect(quoted.runtime.entry.actors.jumper.balance).toBe(1000);
    state.choices.training = true;
    const active = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Morgan",
    });
    expect(active.runtime.entry.actors.jumper.balance).toBe(1030);
    expect(active.runtime.entry.actors.jumper.resources.mana.balance).toBe(196);
  });

  it("uses the strongest result, rounds halves away from zero, and restores quotes", () => {
    const packageItem = canonicalizePackage({
      id: "discount-policy",
      exactHash: "p".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Discount Policy"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
  choice
    handle: flat
    target: flat
  choice
    handle: percent
    target: percent
  choice
    handle: target
    target: target

choice
  handle: flat
  name: "Flat"
  discount
    group: skills
    mode: flat
    amount: 130

choice
  handle: percent
  name: "Percent"
  discount
    group: skills
    mode: percent
    amount: 50

choice
  handle: target
  name: "Target"
  group: skills
  cost: 101
`,
      },
    });
    const state = actor({ flat: true, percent: true, target: false });
    const evaluate = () =>
      evaluateChain({
        order: ["entry"],
        packageIdByEntry: { entry: packageItem.id },
        packages: { [packageItem.id]: packageItem },
        jumpState: {
          entry: { actors: { jumper: state }, appliedGauntlet: [] },
        },
        jumperName: "Morgan",
      });
    expect(
      evaluate().runtime.entry.actors.jumper.choices.target.costs[0],
    ).toMatchObject({
      discountBaseAmount: 101,
      resolvedAmount: 0,
      discounts: [expect.objectContaining({ sourceChoiceHandle: "flat" })],
    });
    state.choices.flat = false;
    expect(
      evaluate().runtime.entry.actors.jumper.choices.target.costs[0]
        .resolvedAmount,
    ).toBe(51);
    state.choices.percent = false;
    expect(
      evaluate().runtime.entry.actors.jumper.choices.target.costs[0]
        .resolvedAmount,
    ).toBe(101);
  });

  it("applies discounts after roll allowances and grows negative values", () => {
    const packageItem = canonicalizePackage({
      id: "discount-order",
      exactHash: "o".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Discount Order"
  author: "Tester"
  version: "1"
  discount-stacking: stack
  discount-floor: negative

section
  handle: content
  name: "Content"
  choice
    handle: discount
    target: discount
  choice
    handle: ranked
    target: ranked
  choice
    handle: flaw
    target: flaw

choice
  handle: discount
  name: "Discount"
  discount
    group: affected
    mode: percent
    amount: 50

choice
  handle: ranked
  name: "Ranked"
  group: affected
  selection: integer
  min: 0
  max: 5
  resolution: either
  cost
    amount: 100
    mode: each

choice
  handle: flaw
  name: "Flaw"
  group: affected
  cost: -101
`,
      },
    });
    const state = actor({ discount: true, ranked: 3, flaw: true });
    state.choiceRolls.ranked = { result: 2, sequence: 1 };
    const result = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Morgan",
    });
    expect(
      result.runtime.entry.actors.jumper.choices.ranked.costs[0].resolvedAmount,
    ).toBe(50);
    expect(
      result.runtime.entry.actors.jumper.choices.flaw.costs[0].resolvedAmount,
    ).toBe(-152);
  });

  it("uses a signed lock score and suspends ordinary mechanics", () => {
    const packageItem = canonicalizePackage({
      id: "section-locks",
      exactHash: "l".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Section Locks"
  author: "Tester"
  version: "1"

section
  handle: controls
  name: "Controls"
  choice
    handle: opener
    target: opener
  choice
    handle: locker
    target: locker
  choice
    handle: shared
    target: shared

section
  handle: training
  name: "Training"
  locked: true
  choice
    handle: purchase
    target: purchase
  choice
    handle: shared_training
    target: shared

choice
  handle: opener
  name: "Open"
  unlock: training

choice
  handle: locker
  name: "Lock"
  lock: training

choice
  handle: purchase
  name: "Purchase"
  cost: 100
  grant: perk

choice
  handle: shared
  name: "Shared placement"
  cost: 50
  grant: perk
`,
      },
    });
    const state = actor({
      opener: true,
      locker: true,
      purchase: true,
      shared: true,
    });
    const locked = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Morgan",
    });
    expect(locked.runtime.entry.actors.jumper.sections?.training).toEqual({
      handle: "training",
      lockScore: 1,
      locked: true,
    });
    expect(locked.runtime.entry.actors.jumper.balance).toBe(950);
    expect(locked.records).toEqual([
      expect.objectContaining({ kind: "perk", name: "Shared placement" }),
    ]);
    state.choices.locker = false;
    const unlocked = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Morgan",
    });
    expect(unlocked.runtime.entry.actors.jumper.sections?.training.locked).toBe(
      false,
    );
    expect(unlocked.runtime.entry.actors.jumper.balance).toBe(850);
    expect(unlocked.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "perk", name: "Purchase" }),
        expect.objectContaining({ kind: "perk", name: "Shared placement" }),
      ]),
    );
  });

  it("keeps a selected lock effect stable when it locks its own Section", () => {
    const packageItem = canonicalizePackage({
      id: "stable-self-lock",
      exactHash: "s".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Stable Self Lock"
  author: "Tester"
  version: "1"

section
  handle: training
  name: "Training"
  choice
    handle: seal
    target: seal

choice
  handle: seal
  name: "Seal"
  lock: training
  cost: 100
  grant: perk
`,
      },
    });
    const state = actor({ seal: true });
    const result = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Morgan",
    });
    expect(result.runtime.entry.actors.jumper.sections?.training).toEqual({
      handle: "training",
      lockScore: 1,
      locked: true,
    });
    expect(result.runtime.entry.actors.jumper.balance).toBe(1000);
    expect(result.records).toEqual([]);
  });
});
