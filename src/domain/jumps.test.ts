import { describe, expect, it } from "vitest";
import { validGeneratedJumpPackages } from "../fixtures/generatedPackages";
import {
  emptyActorEntryState,
  emptyJumpEntryState,
  evaluateChain,
  type ActorEntryState,
  type JumpRuntimeState,
} from "./jumps";
import { deterministicRandomIndex } from "./random";

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
      entry: { actors: { jumper }, appliedGauntlet },
    },
    jumperName: "Morgan",
  });

describe("Format 1 chain evaluation", () => {
  it("provides deterministic fixture randomness through an injected port", () => {
    expect(deterministicRandomIndex(3, 0)).toBe(0);
    expect(deterministicRandomIndex(3, 4)).toBe(1);
    expect(() => deterministicRandomIndex(0, 0)).toThrow(RangeError);
  });

  it("evaluates ranked roll allowances, awards, and multiple resources", () => {
    const ranked = one(
      "hero-academy",
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
    expect(ranked.balance).toBe(950);

    const resources = one(
      "hero-academy",
      actor({ danger_stipend: "Accept", academy_requisition: "Field Kit" }),
    ).runtime.entry.actors.jumper.resources;
    expect(resources.jump_points).toMatchObject({
      granted: 100,
      spent: 100,
      balance: 1000,
    });
    expect(resources.merit).toMatchObject({ spent: 2, balance: 3 });
  });

  it("projects perk ranks and resolves conditional descriptions in actor context", () => {
    const ranked = one(
      "cosmic-odyssey",
      actor(
        { random_training: 3 },
        { random_training: { result: 3, sequence: 1 } },
      ),
    ).records.find((record) => record.name === "Random Training");
    expect(ranked?.measure).toEqual({ kind: "rank", value: 3 });

    const ordinary = one(
      "spirit-road",
      actor({ shrine_keeper: true }),
    ).records.find((record) => record.name === "Shrine Keeper");
    expect(ordinary?.description).toBe(
      "You tend the places where memory and spirit meet.",
    );

    const gauntlet = one("spirit-road", actor({ shrine_keeper: true }), [
      { id: "manual", kind: "user", label: "Applied by user" },
    ]).records.find((record) => record.name === "Shrine Keeper");
    expect(gauntlet?.description).toBe(
      "Even without supernatural power, your discipline preserves sacred ground.",
    );
  });

  it("defaults numeric grants to rank and supports explicit quantity measures", () => {
    const evaluation = one(
      "cosmic-odyssey",
      actor({ random_training: 3, training_manuals: 3 }),
    );
    expect(
      evaluation.records.find((record) => record.name === "Random Training")
        ?.measure,
    ).toEqual({ kind: "rank", value: 3 });
    expect(
      evaluation.records.find((record) => record.name === "Training Manuals")
        ?.measure,
    ).toEqual({ kind: "quantity", value: 3 });
    expect(
      one("cosmic-odyssey", actor({ training_manuals: 0 })).records.some(
        (record) => record.name === "Training Manuals",
      ),
    ).toBe(false);
  });

  it("grants forms to the Jumper and keeps targeted perks on the form", () => {
    const evaluation = one(
      "arcane-realms",
      actor({ dragon_form: true, draconic_resilience: true }),
    );
    expect(evaluation.forms).toMatchObject([
      { handle: "dragon_form", name: "Dragon Form", ownerActorId: "jumper" },
    ]);
    const perk = evaluation.records.find(
      (record) => record.name === "Draconic Resilience",
    );
    expect(perk?.ownerFormId).toBe(evaluation.forms[0].id);
    expect(evaluation.forms[0].perkRecordIds).toEqual([perk?.id]);
  });

  it("funds imported companions and assigns targeted perks to their profiles", () => {
    const ren = "companion:war:jumper:banner_command:4";
    const horizon = actor({ horizon_company: true });
    horizon.inputs = { horizon_company: { travelers: [ren] } };
    const renState = actor({ boundary_walking: true });
    const evaluation = evaluateChain({
      order: ["war", "horizon"],
      packageIdByEntry: {
        war: "war-of-crowns",
        horizon: "last-horizon",
      },
      packages,
      jumpState: {
        war: {
          actors: { jumper: actor({ banner_command: true }) },
          appliedGauntlet: [],
        },
        horizon: {
          actors: { jumper: horizon, [ren]: renState },
          appliedGauntlet: [],
        },
      },
      jumperName: "Morgan",
    });

    expect(
      evaluation.runtime.horizon.actors[ren].resources.jump_points,
    ).toEqual(
      expect.objectContaining({ starting: 0, granted: 500, balance: 0 }),
    );
    expect(
      evaluation.companions.find((companion) => companion.actorId === ren)
        ?.importedEntryIds,
    ).toEqual(["horizon"]);
    expect(
      evaluation.records.find((record) => record.name === "Company Pathfinder")
        ?.ownerActorId,
    ).toBe(ren);
  });

  it("does not expose an imported companion when targeted perks have no currency", () => {
    const ren = "companion:war:jumper:banner_command:4";
    const horizon = actor({ horizon_company: true });
    horizon.inputs = { horizon_company: { travelers: [ren] } };
    const source = packages["last-horizon"];
    const unfunded = {
      ...source,
      choices: source.choices.map((choice) => ({
        ...choice,
        inputs: choice.inputs.map((input) => ({
          ...input,
          grants: input.grants.filter(
            (grant) =>
              grant.kind !== "resource" ||
              grant.companion !== "horizon_company",
          ),
        })),
      })),
    };
    const evaluation = evaluateChain({
      order: ["war", "horizon"],
      packageIdByEntry: { war: "war-of-crowns", horizon: "unfunded" },
      packages: { ...packages, unfunded },
      jumpState: {
        war: {
          actors: { jumper: actor({ banner_command: true }) },
          appliedGauntlet: [],
        },
        horizon: { actors: { jumper: horizon }, appliedGauntlet: [] },
      },
      jumperName: "Morgan",
    });

    expect(evaluation.runtime.horizon.actors[ren]).toBeUndefined();
    expect(
      evaluation.companions.find((companion) => companion.actorId === ren)
        ?.importedEntryIds,
    ).toEqual([]);
    expect(
      evaluation.records.find((record) => record.name === "Company Pathfinder")
        ?.ownerActorId,
    ).toBe(ren);
  });

  it("funds a newly purchased companion and grants its targeted perk", () => {
    const evaluation = one("last-horizon", actor({ final_companion: true }));
    const aster = "companion:entry:jumper:final_companion:0";

    expect(evaluation.runtime.entry.actors[aster].balance).toBe(500);
    expect(evaluation.actors[aster].name).toBe("Aster");
    expect(
      evaluation.records.find((record) => record.name === "Boundary Instinct")
        ?.ownerActorId,
    ).toBe(aster);
  });

  it("makes recorded choice and source results free without erasing provenance", () => {
    const choice = one(
      "hero-academy",
      actor({ power_rank: 4 }, { power_rank: { result: 4, sequence: 1 } }),
    ).runtime.entry.actors.jumper.choices.power_rank;
    expect(choice.freeByRoll).toBe(true);
    expect(choice.costs[0].resolvedAmount).toBe(0);

    const source = one(
      "hero-academy",
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
    const native = one("cosmic-odyssey", emptyActorEntryState());
    expect(native.runtime.entry.gauntlet).toMatchObject({
      active: true,
      native: true,
      startingPointContribution: 0,
    });
    expect(native.runtime.entry.actors.jumper.balance).toBe(0);

    const applied = one("hero-academy", emptyActorEntryState(), [
      { id: "manual", kind: "user", label: "Applied by user" },
      { id: "quest", kind: "supplement", label: "Quest Mode" },
    ]);
    expect(applied.runtime.entry.gauntlet.startingPointContribution).toBe(0);
    expect(applied.runtime.entry.actors.jumper.balance).toBe(0);
  });

  it("derives previous/original continuity and frees missing dropdown baselines", () => {
    const order = ["first", "arcane", "shadow", "horizon"];
    const jumpState = Object.fromEntries(
      order.map((id) => [id, emptyJumpEntryState()]),
    );
    jumpState.first.actors.jumper = actor({
      starting_gender: "Female",
      starting_age: 24,
    });
    const result = evaluateChain({
      order,
      packageIdByEntry: {
        first: "first-step",
        arcane: "arcane-realms",
        shadow: "shadow-court",
        horizon: "last-horizon",
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
      result.runtime.arcane.actors.jumper.choices.current_gender,
    ).toMatchObject({
      value: "Female",
      derivedContinuity: true,
      freeByRoll: false,
    });
    expect(
      result.runtime.arcane.actors.jumper.choices.current_gender.costs[0]
        .resolvedAmount,
    ).toBe(0);
    expect(result.runtime.shadow.actors.jumper.choices.court_gender.value).toBe(
      "Female",
    );
    expect(
      result.runtime.horizon.actors.jumper.choices.horizon_gender,
    ).toMatchObject({
      value: null,
      continuityFreeValues: ["Nonbinary", "Agender"],
    });
    expect(result.runtime.horizon.actors.jumper.properties.age?.value).toBe(24);
    expect(
      result.runtime.horizon.actors.jumper.properties.origin,
    ).toBeUndefined();
  });

  it("reports property conflicts while accepting identical writers", () => {
    const conflicts = one(
      "first-step",
      actor({ wanderer: true, local_hero: true }),
    ).runtime.entry.actors.jumper;
    expect(conflicts.diagnostics).toContain("Conflicting values write origin.");
    expect(conflicts.properties.species?.value).toBe("Human");
  });
});
