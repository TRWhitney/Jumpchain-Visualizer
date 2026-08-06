import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function interactionPaths(value, output = new Set()) {
  if (typeof value === "string") {
    if (/^verification\/interactions\/[^/]+$/u.test(value)) output.add(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) interactionPaths(item, output);
    return output;
  }
  if (value && typeof value === "object")
    for (const item of Object.values(value)) interactionPaths(item, output);
  return output;
}

/**
 * Projects reviewable facts out of the converter-authored ledger without
 * exposing its acceptance decisions, gaps, or prior independent verdicts.
 */
export function experimentEvidencePaths(workspace) {
  const directory = join(workspace, "verification", "experiments");
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.isSymbolicLink() &&
        entry.name.endsWith("-report.json"),
    )
    .map((entry) => `verification/experiments/${entry.name}`)
    .sort((first, second) => first.localeCompare(second));
}

/**
 * Inventories interaction evidence transitively so a reviewer receives files
 * cited by an authoritative observation manifest as well as direct ledger
 * references. Only direct regular files in verification/interactions qualify.
 */
export function interactionEvidencePaths(workspace, ledger) {
  const output = new Set();
  const pendingJson = [];
  const visit = (value) => {
    if (typeof value === "string") {
      if (!/^verification\/interactions\/[^/]+$/u.test(value)) return;
      if (output.has(value)) return;
      output.add(value);
      if (value.endsWith(".json")) pendingJson.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object")
      for (const item of Object.values(value)) visit(item);
  };
  visit(ledger);
  for (let index = 0; index < pendingJson.length; index += 1) {
    const path = join(workspace, pendingJson[index]);
    if (!existsSync(path)) continue;
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    try {
      visit(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      // The ledger validator reports malformed authoritative JSON separately.
    }
  }
  return [...output].sort((first, second) => first.localeCompare(second));
}

export function reviewEvidenceForLedger(
  ledger,
  sourceHash,
  authoritativeExperimentFiles = [],
  authoritativeInteractionFiles = [...interactionPaths(ledger)].sort(
    (first, second) => first.localeCompare(second),
  ),
) {
  const sourceEntries = new Map(
    (ledger.entries ?? []).map((entry) => [entry.id, entry]),
  );
  const result = {
    schemaVersion: 1,
    sourceHash,
    notice:
      "This manifest contains observed facts and evidence paths only. It intentionally excludes converter-authored acceptance statuses, gaps, and review verdicts.",
    interactionContracts: (ledger.interactionContracts ?? []).map(
      (contract) => ({
        id: contract.id,
        entryIds: contract.entryIds,
        sourcePage: contract.sourcePage,
        sourceBehavior: contract.sourceBehavior,
        section: contract.section,
        owner: contract.owner,
        ...(contract.handle ? { handle: contract.handle } : {}),
        placement: contract.placement,
        ...(contract.sourceHandle
          ? { sourceHandle: contract.sourceHandle }
          : {}),
        ...(contract.sourceActivation
          ? { sourceActivation: contract.sourceActivation }
          : {}),
        selection: contract.selection,
        resolution: contract.resolution,
        continuity: contract.continuity,
        pricing: contract.pricing,
        states: contract.states,
        geometry: contract.geometry,
      }),
    ),
    mechanics: (ledger.mechanics ?? []).map((mechanic) => ({
      id: mechanic.id,
      description: mechanic.description,
      evidence: mechanic.evidence,
    })),
    authoritativeInteractionFiles,
    authoritativeExperimentFiles,
  };
  if (ledger.mode === "facsimile")
    result.facsimileSemantics = {
      semanticNames: ledger.facsimileContracts?.semanticNames ?? [],
      grantInventory: ledger.facsimileContracts?.grantInventory?.grants ?? [],
      sourceGrantReconciliation: (
        ledger.facsimileContracts?.grantInventory?.entryDecisions ?? []
      )
        .filter((decision) =>
          (decision.clauses ?? []).some((clause) =>
            (clause.dispositions ?? []).includes("jump-grant"),
          ),
        )
        .map((decision) => {
          const entry = sourceEntries.get(decision.entryId);
          return {
            entryId: decision.entryId,
            sourcePage: entry?.page,
            sourceRect: entry?.rect,
            sourceText: entry?.transcription,
            clauses: decision.clauses ?? [],
            grantKeys: (decision.clauses ?? []).flatMap(
              (clause) => clause.grantKeys ?? [],
            ),
          };
        }),
      referentResolutions: ledger.facsimileContracts?.referentResolutions ?? [],
      dynamicEntities: ledger.facsimileContracts?.dynamicEntities ?? [],
      tagPlacements: ledger.facsimileContracts?.tagPlacements ?? [],
      tagCardinalityReview:
        ledger.facsimileContracts?.tagCardinalityReview ?? null,
    };
  return result;
}
