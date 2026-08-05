#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  containedPath,
  readJson,
  workspaceFromArgument,
  writeJson,
} from "./workspace-lib.mjs";
import {
  experimentEvidencePaths,
  interactionEvidencePaths,
  reviewEvidenceForLedger,
} from "./review-evidence.mjs";

const [workspaceArgument] = process.argv.slice(2);
if (!workspaceArgument) {
  console.error("Usage: make-comparison-sheet.mjs <workspace>");
  process.exit(2);
}
const { workspace, manifest } = workspaceFromArgument(workspaceArgument);
const ledger = readJson(join(workspace, "ledger.json"));
const results = [];

for (const comparison of ledger.comparisons ?? []) {
  const sourcePath = join(
    workspace,
    "extracted",
    "pages",
    `page-${String(comparison.sourcePage).padStart(4, "0")}.png`,
  );
  const renderPath = containedPath(
    workspace,
    join(workspace, comparison.renderPath),
  );
  if (!existsSync(sourcePath) || !existsSync(renderPath)) {
    results.push({
      id: comparison.id,
      status: "missing",
      sourcePath,
      renderPath,
    });
    continue;
  }
  const source = await loadImage(readFileSync(sourcePath));
  const rendered = await loadImage(readFileSync(renderPath));
  const rect = comparison.sourceRect ?? {
    x: 0,
    y: 0,
    width: source.width,
    height: source.height,
  };
  if (
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > source.width ||
    rect.y + rect.height > source.height
  )
    throw new Error(`${comparison.id} has an invalid sourceRect.`);
  const panelWidth = rendered.width;
  const sourceHeight = Math.max(
    1,
    Math.round((rect.height * panelWidth) / rect.width),
  );
  const labelHeight = 42;
  const canvas = createCanvas(
    panelWidth * 2 + 24,
    Math.max(sourceHeight, rendered.height) + labelHeight,
  );
  const context = canvas.getContext("2d");
  context.fillStyle = "#1f1f1f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = "600 18px sans-serif";
  context.fillText("SOURCE", 8, 27);
  context.fillText("RENDER", panelWidth + 32, 27);
  context.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    labelHeight,
    panelWidth,
    sourceHeight,
  );
  context.drawImage(
    rendered,
    0,
    0,
    rendered.width,
    rendered.height,
    panelWidth + 24,
    labelHeight,
    panelWidth,
    rendered.height,
  );
  const output = containedPath(
    join(workspace, "verification", "comparisons"),
    join(workspace, "verification", "comparisons", `${comparison.id}.png`),
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, canvas.toBuffer("image/png"));
  results.push({
    id: comparison.id,
    status: "created",
    source: basename(sourcePath),
    rendered: comparison.renderPath,
    output: `verification/comparisons/${comparison.id}.png`,
    sourceSize: [rect.width, rect.height],
    displayedSourceSize: [panelWidth, sourceHeight],
    renderedSize: [rendered.width, rendered.height],
  });
}

writeJson(join(workspace, "verification", "comparison-manifest.json"), {
  schemaVersion: 1,
  sourceHash: manifest.sourceHash,
  warning:
    "Contact sheets support direct inspection. Pixel or dimension similarity is not an acceptance decision.",
  comparisons: results,
});
writeJson(
  join(workspace, ledger.reviewEvidence ?? "verification/review-evidence.json"),
  reviewEvidenceForLedger(
    ledger,
    manifest.sourceHash,
    experimentEvidencePaths(workspace),
    interactionEvidencePaths(workspace, ledger),
  ),
);
console.log(
  `${workspace}: created ${results.filter((result) => result.status === "created").length} comparison sheet(s) and the independent-review evidence manifest`,
);
