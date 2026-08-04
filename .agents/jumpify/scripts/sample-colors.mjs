#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import {
  readJson,
  workspaceFromArgument,
  writeJson,
} from "./workspace-lib.mjs";

const [workspaceArgument] = process.argv.slice(2);
if (!workspaceArgument) {
  console.error("Usage: sample-colors.mjs <workspace>");
  process.exit(2);
}
const { workspace, manifest } = workspaceFromArgument(workspaceArgument);
const ledger = readJson(join(workspace, "ledger.json"));
const pageCache = new Map();

function pageImage(page) {
  if (!pageCache.has(page))
    pageCache.set(
      page,
      PNG.sync.read(
        readFileSync(
          join(
            workspace,
            "extracted",
            "pages",
            `page-${String(page).padStart(4, "0")}.png`,
          ),
        ),
      ),
    );
  return pageCache.get(page);
}

function hex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const samples = [];
for (const sample of ledger.colorSamples ?? []) {
  const image = pageImage(sample.page);
  const radius = sample.radius ?? 0;
  if (
    ![sample.page, sample.x, sample.y, radius].every(Number.isInteger) ||
    radius < 0
  )
    throw new Error(
      `${sample.id} requires integer page, x, y, and non-negative radius.`,
    );
  if (
    sample.x - radius < 0 ||
    sample.y - radius < 0 ||
    sample.x + radius >= image.width ||
    sample.y + radius >= image.height
  )
    throw new Error(`${sample.id} sample exceeds page bounds.`);
  const colors = new Map();
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = sample.y - radius; y <= sample.y + radius; y += 1)
    for (let x = sample.x - radius; x <= sample.x + radius; x += 1) {
      const offset = (y * image.width + x) * 4;
      const values = [
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2],
      ];
      red += values[0];
      green += values[1];
      blue += values[2];
      count += 1;
      const color = hex(...values);
      colors.set(color, (colors.get(color) ?? 0) + 1);
    }
  const dominant = [...colors.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];
  samples.push({
    id: sample.id,
    page: sample.page,
    x: sample.x,
    y: sample.y,
    radius,
    average: hex(
      Math.round(red / count),
      Math.round(green / count),
      Math.round(blue / count),
    ),
    dominant: dominant?.[0] ?? null,
    dominantRatio: dominant ? Number((dominant[1] / count).toFixed(4)) : 0,
  });
}

writeJson(join(workspace, "verification", "color-samples.json"), {
  schemaVersion: 1,
  sourceHash: manifest.sourceHash,
  samples,
});
console.log(`${workspace}: sampled ${samples.length} color region(s)`);
