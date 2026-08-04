#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  addOutputBytes,
  imageDimensions,
  MAX_PAGE_PIXELS,
  MAX_SOURCE_PAGES,
  readJson,
  RENDER_SCALE,
  workspaceFromArgument,
  writeJson,
} from "./workspace-lib.mjs";

const [workspaceArgument, forceFlag] = process.argv.slice(2);
if (!workspaceArgument) {
  console.error("Usage: render-source.mjs <workspace> [--force]");
  process.exit(2);
}
const force = forceFlag === "--force";
const { workspace, manifest } = workspaceFromArgument(workspaceArgument);
const outputDirectory = join(workspace, "extracted", "pages");
mkdirSync(outputDirectory, { recursive: true });
let outputBytes = 0;

function writeRenderedFile(target, content, overwrite = true) {
  if (overwrite || !existsSync(target)) writeFileSync(target, content);
  outputBytes = addOutputBytes(outputBytes, statSync(target).size);
}

function assertPixels(width, height, label) {
  const pixels = Math.ceil(width) * Math.ceil(height);
  if (!Number.isFinite(pixels) || pixels <= 0 || pixels > MAX_PAGE_PIXELS)
    throw new Error(
      `${label} decodes to ${pixels} pixels; the limit is ${MAX_PAGE_PIXELS}.`,
    );
}

async function renderImage(file, pageNumber) {
  const source = join(workspace, file.copiedPath);
  const bytes = readFileSync(source);
  const dimensions = imageDimensions(bytes, extname(source));
  assertPixels(dimensions.width, dimensions.height, file.originalName);
  const image = await loadImage(bytes);
  if (image.width !== dimensions.width || image.height !== dimensions.height)
    throw new Error(
      `${file.originalName} decoded dimensions do not match its header.`,
    );
  const target = join(
    outputDirectory,
    `page-${String(pageNumber).padStart(4, "0")}.png`,
  );
  if (force || !existsSync(target)) {
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext("2d").drawImage(image, 0, 0);
    writeRenderedFile(target, canvas.toBuffer("image/png"));
  } else {
    outputBytes = addOutputBytes(outputBytes, statSync(target).size);
  }
  return {
    page: pageNumber,
    source: file.originalName,
    width: image.width,
    height: image.height,
    text: null,
  };
}

async function renderPdf(file) {
  const bytes = new Uint8Array(readFileSync(join(workspace, file.copiedPath)));
  const task = getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await task.promise;
  if (document.numPages > MAX_SOURCE_PAGES)
    throw new Error(
      `PDF has ${document.numPages} pages; the limit is ${MAX_SOURCE_PAGES}.`,
    );
  const pages = [];
  try {
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      assertPixels(viewport.width, viewport.height, `PDF page ${number}`);
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const target = join(
        outputDirectory,
        `page-${String(number).padStart(4, "0")}.png`,
      );
      if (force || !existsSync(target)) {
        const canvas = createCanvas(width, height);
        await page.render({
          canvas,
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;
        writeRenderedFile(target, canvas.toBuffer("image/png"));
      } else {
        outputBytes = addOutputBytes(outputBytes, statSync(target).size);
      }
      const content = await page.getTextContent();
      const extracted = content.items
        .filter((item) => "str" in item)
        .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
      const textPath = join(
        outputDirectory,
        `page-${String(number).padStart(4, "0")}.txt`,
      );
      writeRenderedFile(textPath, extracted ? `${extracted}\n` : "");
      pages.push({
        page: number,
        source: file.originalName,
        width,
        height,
        text: extracted
          ? `extracted/pages/${textPath.split(/[\\/]/).at(-1)}`
          : null,
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

let pages;
if (manifest.files.length === 1 && manifest.files[0].type === "pdf") {
  pages = await renderPdf(manifest.files[0]);
} else {
  pages = [];
  for (const [index, file] of manifest.files.entries())
    pages.push(await renderImage(file, index + 1));
}

const pagesManifest = {
  schemaVersion: 1,
  sourceHash: manifest.sourceHash,
  renderScale: manifest.files[0]?.type === "pdf" ? RENDER_SCALE : 1,
  pages,
};
const pagesJson = `${JSON.stringify(pagesManifest, null, 2)}\n`;
addOutputBytes(outputBytes, Buffer.byteLength(pagesJson));
writeFileSync(join(outputDirectory, "pages.json"), pagesJson);
const ledgerPath = join(workspace, "ledger.json");
const ledger = readJson(ledgerPath);
if (ledger.schemaVersion === 3) {
  const existing = new Map(
    (ledger.sourcePages ?? []).map((page) => [page.page, page]),
  );
  ledger.sourcePages = pages.map((page) => ({
    page: page.page,
    width: page.width,
    height: page.height,
    status: existing.get(page.page)?.status ?? "unreviewed",
    entryIds: existing.get(page.page)?.entryIds ?? [],
    sectionHandles: existing.get(page.page)?.sectionHandles ?? [],
  }));
  writeJson(ledgerPath, ledger);
}
console.log(`${workspace}: rendered ${pages.length} page(s)`);
