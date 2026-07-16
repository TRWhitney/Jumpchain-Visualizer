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
    const trial = actor({ trial_company: true });
    trial.inputs = { trial_company: { travelers: [lyra] } };
    const lyraState = actor({ participant_resilience: true });
    const evaluation = evaluateChain({
      order: ["threshold", "trial"],
      packageIdByEntry: {
        threshold: "threshold-roads",
        trial: "last-trial",
      },
      packages,
      jumpState: {
        threshold: {
          actors: { jumper: actor({ lyra_companion: true }) },
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
      evaluation.companions.find((companion) => companion.actorId === lyra)
        ?.importedEntryIds,
    ).toEqual(["trial"]);
    expect(
      evaluation.records.find((record) => record.name === "Company Pathfinder")
        ?.ownerActorId,
    ).toBe(lyra);
  });

  it("does not expose an imported companion when targeted perks have no currency", () => {
    const lyra = "companion:threshold:jumper:lyra_companion:0";
    const trial = actor({ trial_company: true });
    trial.inputs = { trial_company: { travelers: [lyra] } };
    const source = packages["last-trial"];
    const unfunded = {
      ...source,
      choices: source.choices.map((choice) => ({
        ...choice,
        inputs: choice.inputs.map((input) => ({
          ...input,
          grants: input.grants.filter(
            (grant) =>
              grant.kind !== "resource" || grant.companion !== "trial_company",
          ),
        })),
      })),
    };
    const evaluation = evaluateChain({
      order: ["threshold", "trial"],
      packageIdByEntry: { threshold: "threshold-roads", trial: "unfunded" },
      packages: { ...packages, unfunded },
      jumpState: {
        threshold: {
          actors: { jumper: actor({ lyra_companion: true }) },
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
    const projected = one(
      "threshold-roads",
      actor({ roadborn_origin: true, threshold_alias: "Wayfinder" }),
    ).runtime.entry.actors.jumper;
    expect(projected.properties.origin?.value).toBe("Roadborn");
    expect(projected.properties.species?.value).toBe("Human");
    expect(projected.properties.carries_map?.value).toBe(true);
    expect(projected.properties.road_name?.value).toBe("Wayfinder");
  });
});
