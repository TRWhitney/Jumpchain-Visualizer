import {
  evaluateChain,
  type ChainEvaluation,
  type EvaluatedActorJump,
} from "../domain";
import type { BodyModState } from "../supplements/bodyMod";
import { bestialPresentation } from "../supplements/bodyMod";
import { EARTH_ENTRY_ID, type TrackerState } from "./model";
import { supplementEvaluationInputs } from "./supplementEvaluation";

const earthActor = (
  state: TrackerState,
  bodyMod: BodyModState | null,
): EvaluatedActorJump => {
  const values = state.jumpState[EARTH_ENTRY_ID]?.actors.jumper?.choices ?? {};
  const gender =
    typeof values.earth_gender === "string" ? values.earth_gender : undefined;
  const age =
    typeof values.earth_age === "number" ? values.earth_age : undefined;
  const species =
    bodyMod?.type === "Bestial" ? bestialPresentation(bodyMod) : "Human";
  return {
    balance: 0,
    resources: {
      jump_points: {
        handle: "jump_points",
        name: "Choice Points",
        abbreviation: "CP",
        starting: 0,
        spent: 0,
        granted: 0,
        balance: 0,
      },
    },
    properties: {
      origin: {
        value: "Human",
        sourceLabel: "Earth",
        description: "Your life before Jump 1.",
      },
      location: {
        value: "Earth",
        sourceLabel: "Earth",
        description: "The world where the chain begins.",
      },
      species: {
        value: species,
        sourceLabel:
          bodyMod?.type === "Bestial" ? "Classic Body Mod" : "Default species",
      },
      ...(gender ? { gender: { value: gender, sourceLabel: "Earth" } } : {}),
      ...(age ? { age: { value: age, sourceLabel: "Earth" } } : {}),
    },
    choices: {},
    traits: [],
    diagnostics: [],
  };
};

export function evaluateTracker(
  state: TrackerState,
  bodyMod: BodyModState | null,
): ChainEvaluation {
  const order = state.order.filter((entryId) => entryId !== EARTH_ENTRY_ID);
  const packages = Object.fromEntries(
    order.flatMap((entryId) => {
      const entry = state.entries[entryId];
      const item = state.packages[entry.packageId];
      return item?.document && item.exactHash === entry.packageExactHash
        ? [[item.id, item.document] as const]
        : [];
    }),
  );
  const earth = earthActor(state, bodyMod);
  const supplementInputs = supplementEvaluationInputs(state, order);
  const result = evaluateChain({
    order,
    packageIdByEntry: Object.fromEntries(
      order.map((entryId) => [entryId, state.entries[entryId].packageId]),
    ),
    packages,
    jumpState: supplementInputs.jumpState,
    jumperName: state.actors.jumper?.name ?? "Jumper",
    bodyModSpecies:
      bodyMod?.type === "Bestial" ? bestialPresentation(bodyMod) : undefined,
    initialIdentity: earth.properties,
    supplementPointGrants: supplementInputs.supplementPointGrants,
    startingPointOverrides: supplementInputs.startingPointOverrides,
  });
  const unavailableEntries = new Set(
    order.filter((entryId) => {
      const entry = state.entries[entryId];
      const packageItem = state.packages[entry.packageId];
      return (
        !packageItem?.document ||
        packageItem.exactHash !== entry.packageExactHash
      );
    }),
  );
  const cached = state.lastValidatedEvaluation;
  if (cached && unavailableEntries.size) {
    const cachedActors = new Set(
      Object.values(cached.actors)
        .filter(
          (actor) =>
            actor.joinedEntryId && unavailableEntries.has(actor.joinedEntryId),
        )
        .map((actor) => actor.id),
    );
    for (const entryId of unavailableEntries)
      if (cached.runtime[entryId])
        result.runtime[entryId] = cached.runtime[entryId];
    for (const [entryId, cachedEntry] of Object.entries(cached.runtime)) {
      const freshEntry = result.runtime[entryId];
      if (!freshEntry) continue;
      for (const actorId of cachedActors)
        if (!freshEntry.actors[actorId] && cachedEntry.actors[actorId])
          freshEntry.actors[actorId] = cachedEntry.actors[actorId];
    }
    Object.assign(
      result.actors,
      Object.fromEntries(
        Object.entries(cached.actors).filter(([actorId]) =>
          cachedActors.has(actorId),
        ),
      ),
    );
    const records = new Map(
      result.records.map((record) => [record.id, record]),
    );
    for (const record of cached.records)
      if (
        unavailableEntries.has(record.sourceEntryId) ||
        (record.ownerActorId && cachedActors.has(record.ownerActorId))
      )
        records.set(record.id, record);
    result.records = [...records.values()];
    const forms = new Map(result.forms.map((form) => [form.id, form]));
    for (const form of cached.forms)
      if (unavailableEntries.has(form.sourceEntryId)) forms.set(form.id, form);
    result.forms = [...forms.values()];
    const companions = new Map(
      result.companions.map((companion) => [companion.actorId, companion]),
    );
    for (const companion of cached.companions)
      if (cachedActors.has(companion.actorId))
        companions.set(companion.actorId, companion);
    result.companions = [...companions.values()];
  }
  result.runtime[EARTH_ENTRY_ID] = {
    gauntlet: {
      active: false,
      native: false,
      sources: [],
      startingPointContribution: 0,
    },
    actors: { jumper: earth },
  };
  return result;
}

export function projectEvaluation(
  state: TrackerState,
  evaluation: ChainEvaluation,
): TrackerState {
  const records = evaluation.records.flatMap((record) =>
    record.kind === "trait" ? [] : [{ ...record, kind: record.kind }],
  );
  const entries = Object.fromEntries(
    Object.entries(state.entries).map(([entryId, entry]) => {
      if (entry.kind === "earth") return [entryId, entry];
      const actor = evaluation.runtime[entryId]?.actors.jumper;
      const count = actor
        ? Object.values(actor.choices).filter((choice) => choice.active).length
        : 0;
      return [
        entryId,
        {
          ...entry,
          status:
            actor?.balance && actor.balance < 0
              ? "Negative balance"
              : `${count} selection${count === 1 ? "" : "s"}`,
        },
      ];
    }),
  );
  return {
    ...state,
    entries,
    actors: evaluation.actors,
    records,
    forms: evaluation.forms.map((form) => ({
      ...form,
      subtitle: "Granted form",
      details: [
        `Handle · ${form.handle}`,
        `Source · ${state.packages[state.entries[form.sourceEntryId].packageId]?.name ?? "Unavailable package"}`,
      ],
    })),
    companions: evaluation.companions,
  };
}
