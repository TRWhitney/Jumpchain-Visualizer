#!/usr/bin/env -S node --import tsx
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import {
  JumpPackageImportService,
  SAFE_PACKAGE_SIZE_LIMITS,
} from "../../../src/archive";
import { canonicalizePackage } from "../../../src/markup";
import {
  duplicateSemanticSlotErrors,
  hasMatchingFacsimilePanel,
  interactionContractErrors,
} from "./interaction-contracts.mjs";

type WorkspaceManifest = {
  slug: string;
  mode: "semantic" | "facsimile";
  sourceHash: string;
  archive: string;
};

const workspace = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(join(workspace, "workspace.json"))) {
  console.error(
    "Usage: corepack pnpm exec tsx .agents/jumpify/scripts/build-and-inspect.ts <workspace>",
  );
  process.exit(2);
}

const manifest = JSON.parse(
  readFileSync(join(workspace, "workspace.json"), "utf8"),
) as WorkspaceManifest;
const project = join(workspace, "project");
const definitions: Record<string, string> = {};
for (const name of ["jump.jdef", "choices.jdef", "layout.jdef"])
  if (existsSync(join(project, name)))
    definitions[name] = readFileSync(join(project, name), "utf8");
if (!definitions["jump.jdef"])
  throw new Error("project/jump.jdef is required.");

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink())
      throw new Error(
        `Symbolic package assets are not accepted: ${entry.name}`,
      );
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const assets: Record<string, Uint8Array> = {};
const assetRoot = join(project, "assets");
for (const path of filesBelow(assetRoot)) {
  if (!statSync(path).isFile())
    throw new Error(`Package asset is not a regular file: ${path}`);
  const local = relative(assetRoot, path).split(sep).join("/");
  if (!local || local.startsWith("../"))
    throw new Error(`Package asset escapes assets/: ${path}`);
  assets[`assets/${local}`] = new Uint8Array(readFileSync(path));
}

const canonical = canonicalizePackage(
  {
    id: `${manifest.slug}-${manifest.mode}`,
    logicalId: `${manifest.slug}-${manifest.mode}`,
    exactHash: manifest.sourceHash,
    source: "imported",
    files: definitions,
  },
  {
    profile: "distribution",
    assetPaths: Object.keys(assets).map((path) => path.slice("assets/".length)),
  },
);
const ledger = JSON.parse(readFileSync(join(workspace, "ledger.json"), "utf8"));
if (ledger.schemaVersion !== 3)
  throw new Error(
    "ledger.json must use schemaVersion 3 before the package can be built.",
  );
const interactionErrors = interactionContractErrors(ledger, canonical, {
  requireCoverage: true,
});
interactionErrors.push(...duplicateSemanticSlotErrors(canonical));
if (manifest.mode === "facsimile")
  for (const entry of ledger.entries ?? [])
    if (
      entry.sourceKind === "choice" &&
      !hasMatchingFacsimilePanel(entry, ledger.assets ?? [])
    )
      interactionErrors.push(
        `facsimile Choice entry ${entry.id} requires a matching packaged panel crop`,
      );
if (interactionErrors.length) {
  for (const error of interactionErrors)
    console.error(`interaction-contract:${error}`);
  throw new Error(
    "Interaction contracts do not match the canonical Format 1 package; archive was not written.",
  );
}
if (canonical.diagnostics.length) {
  for (const diagnostic of canonical.diagnostics)
    console.error(
      `${diagnostic.severity}:${diagnostic.code}:${diagnostic.message}`,
    );
  throw new Error(
    "Distribution validation produced diagnostics; archive was not written.",
  );
}

const service = new JumpPackageImportService();
const archive = await service.export(
  { definitions, assets },
  SAFE_PACKAGE_SIZE_LIMITS,
);
const review = await service.inspect(archive, SAFE_PACKAGE_SIZE_LIMITS);
if (review.status !== "ready" || review.diagnostics.length)
  throw new Error(
    "Secure archive reinspection did not return a clean ready review.",
  );
const target = join(workspace, manifest.archive);
writeFileSync(target, archive);
writeFileSync(
  join(workspace, "verification", "package-review.json"),
  `${JSON.stringify(
    {
      status: review.status,
      identity: review.identity,
      name: review.name,
      version: review.version,
      hash: review.hash,
      definitionCount: review.definitionCount,
      assetCount: review.assetCount,
      expandedBytes: review.expandedBytes,
      diagnostics: review.diagnostics,
      archive: manifest.archive,
    },
    null,
    2,
  )}\n`,
);
console.log(`${target} (${archive.byteLength} bytes)`);
