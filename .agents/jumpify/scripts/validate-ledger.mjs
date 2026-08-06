#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  containedPath,
  readJson,
  workspaceFromArgument,
} from "./workspace-lib.mjs";
import {
  hasMatchingFacsimilePanel,
  interactionContractErrors,
} from "./interaction-contracts.mjs";
import {
  facsimileCropAuditConsistencyErrors,
  facsimileCropClearanceFindings,
  facsimileCropSeamFindings,
} from "./facsimile-layout-audit.mjs";
import {
  facsimileContentContractErrors,
  facsimileRenderedAlignmentErrors,
} from "./facsimile-content-audit.mjs";
import {
  experimentEvidencePaths,
  interactionEvidencePaths,
  reviewEvidenceForLedger,
} from "./review-evidence.mjs";

const WIDTHS = [390, 720, 1440];
const ACCEPTANCE_CHECKS = [
  "structure-and-surfaces",
  "text",
  "artwork-and-crops",
  "costs-and-controls",
  "content-and-semantics",
  "responsive-fit",
];
const AUDIT_ACCEPTANCE_CHECKS = {
  overflow: ["structure-and-surfaces", "responsive-fit"],
  clipped: ["structure-and-surfaces", "responsive-fit"],
  missingAlt: ["artwork-and-crops"],
  sourceRowMismatches: ["structure-and-surfaces", "responsive-fit"],
  lowContrast: ["text", "artwork-and-crops"],
  controlBoundaries: ["costs-and-controls", "responsive-fit"],
  overlappingActionElements: ["costs-and-controls", "responsive-fit"],
  avoidableActionWraps: ["costs-and-controls", "responsive-fit"],
  excessiveActionRailSlack: ["costs-and-controls", "responsive-fit"],
  microscopicTextPanels: ["text", "artwork-and-crops", "responsive-fit"],
  excessiveImageLetterboxing: ["text", "artwork-and-crops", "responsive-fit"],
  responsiveHeightInflation: ["structure-and-surfaces", "responsive-fit"],
  stretchedControls: ["costs-and-controls", "responsive-fit"],
  cardBoundaries: ["structure-and-surfaces", "responsive-fit"],
  contentBoundaries: ["structure-and-surfaces", "responsive-fit"],
  viewportBoundaries: ["responsive-fit"],
};
const [workspaceArgument, completeFlag] = process.argv.slice(2);
if (!workspaceArgument) {
  console.error("Usage: validate-ledger.mjs <workspace> [--complete]");
  process.exit(2);
}
const { workspace, manifest } = workspaceFromArgument(workspaceArgument);
const ledger = readJson(join(workspace, "ledger.json"));
const errors = [];
const complete = completeFlag === "--complete";

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value) {
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value ?? "");
}

function validRect(rect) {
  return (
    object(rect) &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function evidenceExists(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must name an evidence file`);
    return false;
  }
  if (isAbsolute(value)) {
    errors.push(`${label} must be workspace-relative`);
    return false;
  }
  try {
    const path = containedPath(workspace, join(workspace, value));
    if (!existsSync(path)) {
      errors.push(`${label} does not exist: ${value}`);
      return false;
    }
  } catch {
    errors.push(`${label} escapes the workspace: ${value}`);
    return false;
  }
  return true;
}

function referencedEvidencePaths(rootValue) {
  const referenced = new Set();
  const pendingJson = [];
  const visit = (value) => {
    if (typeof value === "string" && /^verification\//u.test(value)) {
      if (!referenced.has(value)) {
        referenced.add(value);
        if (value.endsWith(".json")) pendingJson.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (object(value)) for (const item of Object.values(value)) visit(item);
  };
  visit(rootValue);
  for (let index = 0; index < pendingJson.length; index += 1) {
    const relativePath = pendingJson[index];
    try {
      const path = containedPath(workspace, join(workspace, relativePath));
      if (existsSync(path)) visit(readJson(path));
    } catch {
      // evidenceExists reports invalid and escaping paths with their context.
    }
  }
  return referenced;
}

const arrayNames = [
  "sourcePages",
  "sections",
  "entries",
  "assets",
  "colorSamples",
  "comparisons",
  "interactionContracts",
  "mechanics",
  "gaps",
  "acceptance",
];
if (ledger.schemaVersion !== 4) errors.push("schemaVersion must be 4");
if (ledger.mode !== manifest.mode)
  errors.push("ledger mode must match workspace mode");
if (ledger.sourceHash !== manifest.sourceHash)
  errors.push("ledger sourceHash must match workspace sourceHash");
if (ledger.reviewEvidence !== "verification/review-evidence.json")
  errors.push(
    "reviewEvidence must be verification/review-evidence.json so clean-context review has a predictable factual manifest",
  );
if (manifest.mode === "facsimile")
  errors.push(...facsimileContentContractErrors(ledger, null, { complete }));
for (const name of arrayNames)
  if (!Array.isArray(ledger[name])) errors.push(`${name} must be an array`);

const pagesPath = join(workspace, "extracted", "pages", "pages.json");
const pagesManifest = existsSync(pagesPath) ? readJson(pagesPath) : null;
const renderedPages = new Map(
  (pagesManifest?.pages ?? []).map((page) => [page.page, page]),
);
const sourcePages = new Map();
for (const page of ledger.sourcePages ?? []) {
  if (!Number.isInteger(page.page) || page.page < 1) {
    errors.push(`invalid source page: ${page.page}`);
    continue;
  }
  if (sourcePages.has(page.page))
    errors.push(`duplicate source page: ${page.page}`);
  sourcePages.set(page.page, page);
  if (!Number.isInteger(page.width) || page.width < 1)
    errors.push(`sourcePages[${page.page}].width must be positive`);
  if (!Number.isInteger(page.height) || page.height < 1)
    errors.push(`sourcePages[${page.page}].height must be positive`);
  if (!["unreviewed", "verified", "uncertain"].includes(page.status))
    errors.push(`sourcePages[${page.page}].status is invalid`);
  if (!Array.isArray(page.entryIds))
    errors.push(`sourcePages[${page.page}].entryIds must be an array`);
  if (!Array.isArray(page.sectionHandles))
    errors.push(`sourcePages[${page.page}].sectionHandles must be an array`);
  const rendered = renderedPages.get(page.page);
  if (
    rendered &&
    (page.width !== rendered.width || page.height !== rendered.height)
  )
    errors.push(`sourcePages[${page.page}] dimensions differ from pages.json`);
}

const entries = new Map();
for (const entry of ledger.entries ?? []) {
  if (!validId(entry.id)) errors.push(`invalid entry id: ${entry.id}`);
  if (entries.has(entry.id)) errors.push(`duplicate entry id: ${entry.id}`);
  entries.set(entry.id, entry);
  if (!sourcePages.has(entry.page))
    errors.push(`${entry.id}.page is not declared in sourcePages`);
  if (!validRect(entry.rect))
    errors.push(`${entry.id}.rect must be a positive integer rectangle`);
  const page = sourcePages.get(entry.page);
  if (
    page &&
    validRect(entry.rect) &&
    (entry.rect.x + entry.rect.width > page.width ||
      entry.rect.y + entry.rect.height > page.height)
  )
    errors.push(`${entry.id}.rect exceeds source page ${entry.page}`);
  if (
    ![
      "unreviewed",
      "verified",
      "uncertain",
      "externally-corroborated",
    ].includes(entry.verification)
  )
    errors.push(`${entry.id}.verification is invalid`);
  if (!Array.isArray(entry.handles))
    errors.push(`${entry.id}.handles must be an array`);
  if (!object(entry.semantic))
    errors.push(`${entry.id}.semantic must be an object`);
  if (!object(entry.presentation))
    errors.push(`${entry.id}.presentation must be an object`);
  if (
    ["prose", "choice", "heading"].includes(entry.sourceKind) &&
    !entry.transcription?.trim()
  )
    errors.push(
      `${entry.id}.transcription is required for ${entry.sourceKind}`,
    );
}

const sections = new Map();
for (const section of ledger.sections ?? []) {
  if (!validId(section.handle))
    errors.push(`invalid section handle: ${section.handle}`);
  if (sections.has(section.handle))
    errors.push(`duplicate section handle: ${section.handle}`);
  sections.set(section.handle, section);
  if (!section.name?.trim()) errors.push(`${section.handle}.name is required`);
  if (!section.surfaceTree?.trim())
    errors.push(`${section.handle}.surfaceTree is required`);
  if (!Array.isArray(section.sourcePages) || !section.sourcePages.length)
    errors.push(`${section.handle}.sourcePages must not be empty`);
  for (const page of section.sourcePages ?? [])
    if (!sourcePages.has(page))
      errors.push(`${section.handle} references missing source page ${page}`);
  if (!Number.isInteger(section.renderIndex) || section.renderIndex < 1)
    errors.push(`${section.handle}.renderIndex must be positive`);
  if (!["incomplete", "complete"].includes(section.status))
    errors.push(`${section.handle}.status is invalid`);
}

const assetIds = new Set();
for (const asset of ledger.assets ?? []) {
  if (!validId(asset.id) || assetIds.has(asset.id))
    errors.push(`invalid or duplicate asset id: ${asset.id}`);
  assetIds.add(asset.id);
  if (!sourcePages.has(asset.page))
    errors.push(`${asset.id}.page is not declared in sourcePages`);
  if (!validRect(asset.rect)) errors.push(`${asset.id}.rect is invalid`);
  if (!asset.alt?.trim()) errors.push(`${asset.id}.alt is required`);
  if (!/^[^/].*\.png$/i.test(asset.output ?? ""))
    errors.push(`${asset.id}.output must be a relative PNG path`);
  if (!["artwork", "panel"].includes(asset.kind))
    errors.push(`${asset.id}.kind must be artwork or panel`);
  if (
    !object(asset.edgeOwnership) ||
    !["top", "right", "bottom", "left"].every(
      (edge) => typeof asset.edgeOwnership[edge] === "string",
    )
  )
    errors.push(`${asset.id}.edgeOwnership must describe all four edges`);
}

const gapIds = new Set();
for (const gap of ledger.gaps ?? []) {
  if (!validId(gap.id) || gapIds.has(gap.id))
    errors.push(`invalid or duplicate gap id: ${gap.id}`);
  gapIds.add(gap.id);
  for (const field of [
    "requirement",
    "experiment",
    "limitation",
    "fidelityLoss",
    "approximation",
  ])
    if (!gap[field]?.trim()) errors.push(`${gap.id}.${field} is required`);
  if (
    !/^verification\/experiments\/[^/]+-report\.json$/u.test(gap.evidence ?? "")
  )
    errors.push(
      `${gap.id}.evidence must name a verification/experiments/*-report.json minimal experiment report`,
    );
  else if (evidenceExists(gap.evidence, `${gap.id}.evidence`)) {
    try {
      const report = readJson(join(workspace, gap.evidence));
      if (report.id !== gap.id)
        errors.push(`${gap.id}.evidence report id does not match the gap`);
    } catch {
      errors.push(`${gap.id}.evidence report is not valid JSON`);
    }
  }
}

const comparisonKeys = new Set();
for (const comparison of ledger.comparisons ?? []) {
  if (!validId(comparison.id))
    errors.push(`invalid comparison id: ${comparison.id}`);
  if (!sections.has(comparison.section))
    errors.push(
      `${comparison.id} references missing section ${comparison.section}`,
    );
  if (!WIDTHS.includes(comparison.width))
    errors.push(`${comparison.id}.width is invalid`);
  if (!sourcePages.has(comparison.sourcePage))
    errors.push(`${comparison.id}.sourcePage is invalid`);
  const key = `${comparison.section}:${comparison.width}`;
  if (comparisonKeys.has(key)) errors.push(`duplicate comparison: ${key}`);
  comparisonKeys.add(key);
  evidenceExists(comparison.renderPath, `${comparison.id}.renderPath`);
}

const mechanicsIds = new Set();
for (const mechanic of ledger.mechanics ?? []) {
  if (!validId(mechanic.id) || mechanicsIds.has(mechanic.id))
    errors.push(`invalid or duplicate mechanic id: ${mechanic.id}`);
  mechanicsIds.add(mechanic.id);
  if (!mechanic.description?.trim())
    errors.push(`${mechanic.id}.description is required`);
  if (!/^(pass|unreviewed|gap:.+)$/.test(mechanic.status ?? ""))
    errors.push(`${mechanic.id}.status is invalid`);
  if (
    mechanic.status?.startsWith("gap:") &&
    !gapIds.has(mechanic.status.slice(4))
  )
    errors.push(`${mechanic.id} references missing gap ${mechanic.status}`);
  evidenceExists(mechanic.evidence, `${mechanic.id}.evidence`);
}

for (const contract of ledger.interactionContracts ?? []) {
  if (!sourcePages.has(contract.sourcePage))
    errors.push(`${contract.id}.sourcePage is not declared`);
  if (!sections.has(contract.section))
    errors.push(`${contract.id}.section is not declared`);
}
for (const error of interactionContractErrors(ledger, null, { complete }))
  errors.push(error);

const interactionsDirectory = join(workspace, "verification", "interactions");
if (existsSync(interactionsDirectory)) {
  const referenced = referencedEvidencePaths(ledger);
  for (const entry of readdirSync(interactionsDirectory, {
    withFileTypes: true,
  })) {
    const relativePath = `verification/interactions/${entry.name}`;
    if (!entry.isFile())
      errors.push(
        `${relativePath} is not a regular authoritative evidence file; move it under verification/rejected`,
      );
    else if (!referenced.has(relativePath))
      errors.push(
        `${relativePath} is not authoritative evidence; reference it from the ledger/evidence manifest or move it under verification/rejected`,
      );
  }
}

const acceptanceKeys = new Set();
for (const record of ledger.acceptance ?? []) {
  if (!sections.has(record.section))
    errors.push(`acceptance references missing section: ${record.section}`);
  if (!WIDTHS.includes(record.width))
    errors.push(`invalid acceptance width: ${record.width}`);
  if (!ACCEPTANCE_CHECKS.includes(record.check))
    errors.push(`invalid acceptance check: ${record.check}`);
  if (!/^(pass|fail|unreviewed|gap:.+)$/.test(record.status ?? ""))
    errors.push(`invalid acceptance status: ${record.status}`);
  if (record.status?.startsWith("gap:") && !gapIds.has(record.status.slice(4)))
    errors.push(`acceptance references missing gap: ${record.status}`);
  const key = `${record.section}:${record.width}:${record.check}`;
  if (acceptanceKeys.has(key))
    errors.push(`duplicate acceptance record: ${key}`);
  acceptanceKeys.add(key);
  evidenceExists(record.evidence, `${key}.evidence`);
}

if (complete) {
  if (!pagesManifest) errors.push("rendered pages manifest is required");
  if (!sourcePages.size) errors.push("a complete ledger requires source pages");
  if (!sections.size) errors.push("a complete ledger requires sections");
  if (!entries.size) errors.push("a complete ledger requires source entries");
  if (!(ledger.mechanics ?? []).length)
    errors.push("a complete ledger requires a mechanics review record");
  if (!(ledger.interactionContracts ?? []).length)
    errors.push("a complete ledger requires interaction contracts");
  const reviewEvidencePath = join(
    workspace,
    ledger.reviewEvidence ?? "verification/review-evidence.json",
  );
  if (!existsSync(reviewEvidencePath))
    errors.push("review-evidence.json is required");
  else {
    const actual = readJson(reviewEvidencePath);
    const expected = reviewEvidenceForLedger(
      ledger,
      manifest.sourceHash,
      experimentEvidencePaths(workspace),
      interactionEvidencePaths(workspace, ledger),
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      errors.push(
        "review-evidence.json is stale or contains converter verdicts; regenerate it with make-comparison-sheet.mjs",
      );
  }
  if (renderedPages.size !== sourcePages.size)
    errors.push("sourcePages must account for every rendered source page");

  const entryMembership = new Map();
  const sectionIndexes = new Set();
  for (const [pageNumber, page] of sourcePages) {
    if (page.status === "unreviewed")
      errors.push(`source page ${pageNumber} is unreviewed`);
    if (!(page.entryIds ?? []).length)
      errors.push(`source page ${pageNumber} has no ledger entries`);
    if (!(page.sectionHandles ?? []).length)
      errors.push(`source page ${pageNumber} has no output section mapping`);
    for (const id of page.entryIds ?? []) {
      if (!entries.has(id))
        errors.push(`source page ${pageNumber} references missing entry ${id}`);
      entryMembership.set(id, (entryMembership.get(id) ?? 0) + 1);
    }
    for (const handle of page.sectionHandles ?? [])
      if (!sections.has(handle))
        errors.push(
          `source page ${pageNumber} references missing section ${handle}`,
        );
  }
  for (const [id, entry] of entries) {
    if (entry.verification === "unreviewed") errors.push(`${id} is unreviewed`);
    if (entryMembership.get(id) !== 1)
      errors.push(`${id} must belong to exactly one sourcePages entryIds list`);
  }
  for (const [handle, section] of sections) {
    if (section.status !== "complete") errors.push(`${handle} is incomplete`);
    if (sectionIndexes.has(section.renderIndex))
      errors.push(`duplicate section renderIndex: ${section.renderIndex}`);
    sectionIndexes.add(section.renderIndex);
    for (const pageNumber of section.sourcePages ?? [])
      if (!sourcePages.get(pageNumber)?.sectionHandles?.includes(handle))
        errors.push(
          `${handle} is not reciprocally mapped by source page ${pageNumber}`,
        );
    for (const width of WIDTHS) {
      if (!comparisonKeys.has(`${handle}:${width}`))
        errors.push(`missing comparison for ${handle} at ${width}px`);
      for (const check of ACCEPTANCE_CHECKS)
        if (!acceptanceKeys.has(`${handle}:${width}:${check}`))
          errors.push(`missing acceptance ${handle}/${width}/${check}`);
    }
  }
  if (manifest.mode === "facsimile")
    for (const pageNumber of sourcePages.keys())
      if (
        !(ledger.assets ?? []).some(
          (asset) =>
            asset.page === pageNumber &&
            asset.kind === "panel" &&
            asset.package,
        )
      )
        errors.push(
          `facsimile source page ${pageNumber} has no packaged panel`,
        );
  if (manifest.mode === "facsimile")
    for (const entry of entries.values())
      if (
        entry.sourceKind === "choice" &&
        !hasMatchingFacsimilePanel(entry, ledger.assets ?? [])
      )
        errors.push(
          `facsimile Choice entry ${entry.id} requires a matching packaged panel crop`,
        );
  if (manifest.mode === "facsimile") {
    const cropAuditPath = join(workspace, "verification", "crop-audit.json");
    if (!existsSync(cropAuditPath)) errors.push("crop-audit.json is required");
    else {
      const cropAudit = readJson(cropAuditPath);
      for (const error of facsimileCropAuditConsistencyErrors(
        cropAudit,
        ledger.assets ?? [],
        ledger.sourceHash,
      ))
        errors.push(`facsimile ${error}`);
      for (const finding of facsimileCropSeamFindings(cropAudit))
        errors.push(
          `facsimile crop seam ${finding.left}|${finding.right} on page ${finding.page} is not structural; move shared text/content into its parent crop instead of splitting it at x=${finding.x}`,
        );
      for (const finding of facsimileCropClearanceFindings(
        cropAudit,
        ledger.assets ?? [],
      ))
        errors.push(
          `facsimile crop ${finding.id} on page ${finding.page} has clipped or contaminating pixels on its ${finding.side} edge despite ownership ${JSON.stringify(finding.ownership)}`,
        );
    }
  }
  if (
    manifest.mode === "semantic" &&
    (ledger.assets ?? []).some((asset) => asset.kind === "panel")
  )
    errors.push("semantic conversions must not contain panel assets");
  for (const record of ledger.acceptance ?? [])
    if (["fail", "unreviewed"].includes(record.status))
      errors.push(
        `${record.section}/${record.width}/${record.check} is ${record.status}`,
      );
  for (const mechanic of ledger.mechanics ?? [])
    if (mechanic.status === "unreviewed")
      errors.push(`${mechanic.id} is unreviewed`);
  for (const contract of ledger.interactionContracts ?? []) {
    for (const state of contract.states ?? [])
      evidenceExists(state.evidence, `${contract.id}.${state.name}.evidence`);
    if (contract.sourceActivation)
      evidenceExists(
        contract.sourceActivation.evidence,
        `${contract.id}.sourceActivation.evidence`,
      );
    evidenceExists(
      contract.geometry?.evidence,
      `${contract.id}.geometry.evidence`,
    );
  }
  if (manifest.mode === "facsimile") {
    for (const entity of ledger.facsimileContracts?.dynamicEntities ?? [])
      for (const field of [
        "creationEvidence",
        "trackerEvidence",
        ...(entity.continuityEvidence ? ["continuityEvidence"] : []),
        ...(entity.upgradeHandles?.length ? ["upgradeEvidence"] : []),
      ])
        evidenceExists(
          entity[field],
          `${entity.choiceHandle}.dynamicEntity.${field}`,
        );
    for (const relationship of ledger.facsimileContracts
      ?.alignmentRelationships ?? [])
      evidenceExists(
        relationship.evidence,
        `${relationship.id}.alignment.evidence`,
      );
    evidenceExists(
      ledger.facsimileContracts?.independentReview?.evidence,
      "facsimileContracts.independentReview.evidence",
    );
    for (const finding of ledger.facsimileContracts?.independentReview
      ?.findings ?? [])
      evidenceExists(
        finding.evidence,
        `${finding.id}.independentReview.evidence`,
      );
    for (const continuityReview of ledger.facsimileContracts?.independentReview
      ?.entityContinuityReviews ?? [])
      evidenceExists(
        continuityReview.evidence,
        `${continuityReview.sourceEntry}.entityContinuityReview.evidence`,
      );
  }

  const reviewPath = join(workspace, "verification", "package-review.json");
  if (!existsSync(reviewPath)) errors.push("package-review.json is required");
  else {
    const review = readJson(reviewPath);
    if (review.status !== "ready" || review.diagnostics?.length)
      errors.push("package review must be ready with zero diagnostics");
    if (!existsSync(join(workspace, review.archive ?? manifest.archive)))
      errors.push("reviewed archive is missing");
  }

  const renderAuditPath = join(workspace, "verification", "render-audit.json");
  if (!existsSync(renderAuditPath))
    errors.push("render-audit.json is required");
  else {
    const audit = readJson(renderAuditPath);
    if (manifest.mode === "facsimile")
      errors.push(...facsimileRenderedAlignmentErrors(ledger, audit));
    for (const width of WIDTHS) {
      const reports = audit.widths?.[String(width)];
      if (!Array.isArray(reports) || reports.length !== sections.size) {
        errors.push(`render audit at ${width}px must contain every section`);
        continue;
      }
      for (const section of sections.values()) {
        const report = reports.find(
          (item) => item.index === section.renderIndex,
        );
        if (!report) {
          errors.push(
            `render audit is missing ${section.handle} at ${width}px`,
          );
          continue;
        }
        evidenceExists(
          report.screenshot,
          `${section.handle}/${width}.screenshot`,
        );
        for (const field of [
          "overflow",
          "clipped",
          "missingAlt",
          "sourceRowMismatches",
          "lowContrast",
          "controlBoundaries",
          "overlappingActionElements",
          "avoidableActionWraps",
          "excessiveActionRailSlack",
          "microscopicTextPanels",
          "responsiveHeightInflation",
          "stretchedControls",
          "cardBoundaries",
          "contentBoundaries",
          "viewportBoundaries",
        ]) {
          const matchingGap = (AUDIT_ACCEPTANCE_CHECKS[field] ?? []).some(
            (check) =>
              (ledger.acceptance ?? []).some(
                (record) =>
                  record.section === section.handle &&
                  record.width === width &&
                  record.check === check &&
                  record.status?.startsWith("gap:"),
              ),
          );
          if (
            !Array.isArray(report[field]) ||
            (report[field].length && !matchingGap)
          )
            errors.push(
              `${section.handle}/${width}.${field} must be empty or covered by a matching acceptance gap`,
            );
        }
      }
    }
  }

  const comparisonManifestPath = join(
    workspace,
    "verification",
    "comparison-manifest.json",
  );
  if (!existsSync(comparisonManifestPath))
    errors.push("comparison-manifest.json is required");
  else {
    const comparisonManifest = readJson(comparisonManifestPath);
    const created = new Set();
    for (const item of comparisonManifest.comparisons ?? [])
      if (item.status === "created") {
        created.add(item.id);
        evidenceExists(item.output, `${item.id}.comparisonSheet`);
      }
    for (const comparison of ledger.comparisons ?? [])
      if (!created.has(comparison.id))
        errors.push(`comparison sheet was not created: ${comparison.id}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ledger:${error}`);
  process.exit(1);
}
console.log(
  `${workspace}: ledger is ${complete ? "complete" : "structurally valid"}`,
);
