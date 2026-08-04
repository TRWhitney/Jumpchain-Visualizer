#!/usr/bin/env node
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { PNG } from "pngjs";
import {
  containedPath,
  readJson,
  workspaceFromArgument,
  writeJson,
} from "./workspace-lib.mjs";

const [workspaceArgument] = process.argv.slice(2);
if (!workspaceArgument) {
  console.error("Usage: crop-assets.mjs <workspace>");
  process.exit(2);
}
const { workspace, manifest } = workspaceFromArgument(workspaceArgument);
const ledger = readJson(join(workspace, "ledger.json"));

function coordinate(value, label) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function edgeSummary(image, side) {
  const pixels = [];
  const add = (x, y) => {
    const offset = (y * image.width + x) * 4;
    pixels.push(
      `${image.data[offset].toString(16).padStart(2, "0")}${image.data[
        offset + 1
      ]
        .toString(16)
        .padStart(
          2,
          "0",
        )}${image.data[offset + 2].toString(16).padStart(2, "0")}`,
    );
  };
  if (side === "top" || side === "bottom") {
    const y = side === "top" ? 0 : image.height - 1;
    for (let x = 0; x < image.width; x += 1) add(x, y);
  } else {
    const x = side === "left" ? 0 : image.width - 1;
    for (let y = 0; y < image.height; y += 1) add(x, y);
  }
  const frequencies = new Map();
  for (const color of pixels)
    frequencies.set(color, (frequencies.get(color) ?? 0) + 1);
  const [dominantColor = "000000", dominantCount = 0] =
    [...frequencies.entries()].sort((left, right) => right[1] - left[1])[0] ??
    [];
  return {
    dominantColor: `#${dominantColor}`,
    dominantRatio: Number((dominantCount / pixels.length).toFixed(4)),
    possibleStructuralEdge: dominantCount / pixels.length >= 0.9,
  };
}

const reports = [];
for (const asset of ledger.assets ?? []) {
  const page = coordinate(asset.page, `${asset.id}.page`);
  if (page < 1) throw new Error(`${asset.id}.page starts at 1.`);
  const pagePath = join(
    workspace,
    "extracted",
    "pages",
    `page-${String(page).padStart(4, "0")}.png`,
  );
  const source = PNG.sync.read(readFileSync(pagePath));
  const x = coordinate(asset.rect?.x, `${asset.id}.rect.x`);
  const y = coordinate(asset.rect?.y, `${asset.id}.rect.y`);
  const width = coordinate(asset.rect?.width, `${asset.id}.rect.width`);
  const height = coordinate(asset.rect?.height, `${asset.id}.rect.height`);
  if (
    !width ||
    !height ||
    x + width > source.width ||
    y + height > source.height
  )
    throw new Error(
      `${asset.id} crop ${x},${y},${width},${height} exceeds page ${page} (${source.width}×${source.height}).`,
    );
  if (!asset.output || extname(asset.output).toLowerCase() !== ".png")
    throw new Error(`${asset.id}.output must be a relative PNG path.`);

  const crop = new PNG({ width, height });
  PNG.bitblt(source, crop, x, y, width, height, 0, 0);
  const target = containedPath(
    join(workspace, "extracted", "assets"),
    join(workspace, "extracted", "assets", asset.output),
  );
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, PNG.sync.write(crop));
  if (asset.package === true) {
    const packageTarget = containedPath(
      join(workspace, "project", "assets"),
      join(workspace, "project", "assets", asset.output),
    );
    mkdirSync(dirname(packageTarget), { recursive: true });
    copyFileSync(target, packageTarget);
  }
  reports.push({
    id: asset.id,
    mode: manifest.mode,
    page,
    rect: { x, y, width, height },
    output: asset.output,
    packaged: asset.package === true,
    alt: asset.alt ?? null,
    edges: Object.fromEntries(
      ["top", "right", "bottom", "left"].map((side) => [
        side,
        edgeSummary(crop, side),
      ]),
    ),
  });
}

writeJson(join(workspace, "verification", "crop-audit.json"), {
  schemaVersion: 1,
  sourceHash: manifest.sourceHash,
  warning:
    "Structural-edge candidates require visual ownership review; a uniform edge is not automatically wrong.",
  assets: reports,
});
console.log(`${workspace}: cropped ${reports.length} asset(s)`);
