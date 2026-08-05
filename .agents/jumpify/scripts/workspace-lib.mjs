import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_SOURCE_BYTES = 512 * 1024 * 1024;
export const MAX_SOURCE_PAGES = 500;
export const MAX_PAGE_PIXELS = 40_000_000;
export const MAX_RENDERED_OUTPUT_BYTES = 4 * 1024 * 1024 * 1024;
export const RENDER_SCALE = 2;
export const MODES = new Set(["semantic", "facsimile"]);
export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export function repositoryRoot() {
  let candidate = resolve(scriptDirectory, "../../..");
  while (candidate !== dirname(candidate)) {
    if (existsSync(join(candidate, "schema", "format-1.json")))
      return candidate;
    candidate = dirname(candidate);
  }
  throw new Error(
    "Run Jumpify from a Jumpchain Visualizer repository checkout.",
  );
}

export function naturalCompare(left, right) {
  return left.localeCompare(right, "en", {
    numeric: true,
    sensitivity: "base",
  });
}

function safeEntry(path) {
  const details = lstatSync(path);
  if (details.isSymbolicLink())
    throw new Error(`Symbolic links are not accepted: ${path}`);
  if (!details.isFile())
    throw new Error(`Only regular files are accepted: ${path}`);
  return details;
}

export function sourceFiles(input) {
  const requested = resolve(input);
  if (!existsSync(requested))
    throw new Error(`Source does not exist: ${requested}`);
  const rootDetails = lstatSync(requested);
  if (rootDetails.isSymbolicLink())
    throw new Error(`Symbolic source paths are not accepted: ${requested}`);

  let files;
  let sourceName;
  if (rootDetails.isDirectory()) {
    sourceName = basename(requested);
    files = readdirSync(requested)
      .filter((name) => !name.startsWith("."))
      .sort(naturalCompare)
      .map((name) => {
        const path = join(requested, name);
        safeEntry(path);
        if (!IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
          throw new Error(
            `Page directories may contain only PNG or JPEG files: ${path}`,
          );
        return { path: realpathSync(path), relativePath: name, type: "image" };
      });
    if (!files.length) throw new Error(`Page directory is empty: ${requested}`);
  } else {
    safeEntry(requested);
    sourceName = basename(requested, extname(requested));
    const extension = extname(requested).toLowerCase();
    if (extension !== ".pdf" && !IMAGE_EXTENSIONS.has(extension))
      throw new Error(
        `Supported sources are PDF, PNG, JPG, and JPEG: ${requested}`,
      );
    files = [
      {
        path: realpathSync(requested),
        relativePath: basename(requested),
        type: extension === ".pdf" ? "pdf" : "image",
      },
    ];
  }

  if (files.length > MAX_SOURCE_PAGES)
    throw new Error(
      `Source contains ${files.length} files; the limit is ${MAX_SOURCE_PAGES}.`,
    );
  const totalBytes = files.reduce(
    (sum, file) => sum + statSync(file.path).size,
    0,
  );
  if (totalBytes > MAX_SOURCE_BYTES)
    throw new Error(
      `Source is ${totalBytes} bytes; the limit is ${MAX_SOURCE_BYTES}.`,
    );
  if (files.some((file) => file.type === "pdf") && files.length !== 1)
    throw new Error("A PDF must be supplied as a single file.");
  return { requested, sourceName, files, totalBytes };
}

export function hashSource(files) {
  const hash = createHash("sha256");
  hash.update("jumpify-source-v1\0");
  for (const file of files) {
    hash.update(file.relativePath.normalize("NFC"));
    hash.update("\0");
    hash.update(readFileSync(file.path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function sourceSlug(name) {
  const result = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return result || "jump";
}

export function containedPath(root, candidate) {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const difference = relative(resolvedRoot, resolvedCandidate);
  if (
    difference === "" ||
    (!difference.startsWith(`..${sep}`) &&
      difference !== ".." &&
      !difference.startsWith(sep))
  )
    return resolvedCandidate;
  throw new Error(`Path escapes the workspace: ${candidate}`);
}

function rejectWorkspaceSymlinks(root, candidate) {
  containedPath(root, candidate);
  const segments = relative(root, candidate).split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error(`Symbolic workspace paths are not accepted: ${current}`);
  }
}

function numberedWorkspaces(jumpifyRoot) {
  if (!existsSync(jumpifyRoot)) return [];
  return readdirSync(jumpifyRoot, { withFileTypes: true }).flatMap((entry) => {
    const match = /^(\d+)-.+-(semantic|facsimile)$/.exec(entry.name);
    if (!match) return [];
    const sequence = Number(match[1]);
    if (!Number.isSafeInteger(sequence) || sequence < 1)
      throw new Error(`Invalid numbered workspace: ${entry.name}`);
    const workspace = join(jumpifyRoot, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(
        `Symbolic workspace paths are not accepted: ${workspace}`,
      );
    if (!entry.isDirectory()) return [];
    const manifestPath = join(workspace, "workspace.json");
    return [
      {
        sequence,
        workspace,
        manifest: existsSync(manifestPath) ? readJson(manifestPath) : null,
      },
    ];
  });
}

function migrateArchiveName(workspace, previousManifest, archive) {
  if (!previousManifest?.archive || previousManifest.archive === archive)
    return;
  const previousArchive = containedPath(
    workspace,
    join(workspace, previousManifest.archive),
  );
  const nextArchive = containedPath(workspace, join(workspace, archive));
  if (existsSync(previousArchive)) {
    if (existsSync(nextArchive))
      throw new Error(`Both old and numbered archives exist: ${workspace}`);
    renameSync(previousArchive, nextArchive);
  }
  const reviewPath = join(workspace, "verification", "package-review.json");
  if (existsSync(reviewPath)) {
    const review = readJson(reviewPath);
    if (review.archive === previousManifest.archive) {
      review.archive = archive;
      writeJson(reviewPath, review);
    }
  }
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function imageDimensions(bytes, extension) {
  const normalized = extension.toLowerCase();
  if (normalized === ".png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (
      bytes.length < 24 ||
      !signature.every((value, index) => bytes[index] === value)
    )
      throw new Error("Invalid PNG signature or header.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (normalized !== ".jpg" && normalized !== ".jpeg")
    throw new Error(`Unsupported image extension: ${extension}`);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new Error("Invalid JPEG signature.");
  let offset = 2;
  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  while (offset + 3 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length)
      throw new Error("Invalid JPEG segment length.");
    if (frameMarkers.has(marker)) {
      if (length < 7) throw new Error("Invalid JPEG frame header.");
      return {
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
      };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions were not found before image data.");
}

export function addOutputBytes(
  current,
  additional,
  limit = MAX_RENDERED_OUTPUT_BYTES,
) {
  const total = current + additional;
  if (
    !Number.isSafeInteger(current) ||
    !Number.isSafeInteger(additional) ||
    current < 0 ||
    additional < 0 ||
    total > limit
  )
    throw new Error(
      `Rendered output would exceed the ${limit}-byte workspace limit.`,
    );
  return total;
}

export function prepareWorkspace(input, mode, root = repositoryRoot()) {
  if (!MODES.has(mode))
    throw new Error(`Mode must be semantic or facsimile: ${mode}`);
  const source = sourceFiles(input);
  const hash = hashSource(source.files);
  const slug = sourceSlug(source.sourceName);
  const jumpifyRoot = resolve(root, "scratch", "jumpify");
  const existing = numberedWorkspaces(jumpifyRoot);
  const matches = existing.filter(
    (candidate) =>
      candidate.manifest?.mode === mode &&
      candidate.manifest?.slug === slug &&
      candidate.manifest?.sourceHash === hash,
  );
  if (matches.length > 1)
    throw new Error(`Duplicate numbered workspaces match ${slug} in ${mode}.`);
  const sequence =
    matches[0]?.sequence ??
    existing.reduce(
      (highest, candidate) => Math.max(highest, candidate.sequence),
      0,
    ) + 1;
  const sequenceLabel = String(sequence).padStart(3, "0");
  const readableLabel = slug.endsWith(`-${mode}`) ? slug : `${slug}-${mode}`;
  const canonicalWorkspace = resolve(
    jumpifyRoot,
    `${sequenceLabel}-${readableLabel}`,
  );
  let workspace = matches[0]?.workspace ?? canonicalWorkspace;
  if (matches.length && workspace !== canonicalWorkspace) {
    rejectWorkspaceSymlinks(jumpifyRoot, canonicalWorkspace);
    if (existsSync(canonicalWorkspace))
      throw new Error("Canonical numbered workspace already exists.");
    renameSync(workspace, canonicalWorkspace);
    workspace = canonicalWorkspace;
  }
  const readableHashWorkspace = resolve(
    jumpifyRoot,
    slug,
    `${mode}-${hash.slice(0, 12)}`,
  );
  const originalHashWorkspace = resolve(
    jumpifyRoot,
    `${slug}-${hash.slice(0, 12)}`,
    mode,
  );
  rejectWorkspaceSymlinks(jumpifyRoot, workspace);
  const legacyCandidates = [readableHashWorkspace, originalHashWorkspace];
  for (const candidate of legacyCandidates)
    rejectWorkspaceSymlinks(jumpifyRoot, candidate);
  if (!matches.length) {
    const resumableLegacy = legacyCandidates.filter((candidate) =>
      existsSync(join(candidate, "workspace.json")),
    );
    if (resumableLegacy.length > 1)
      throw new Error(`Duplicate legacy workspaces match ${slug} in ${mode}.`);
    if (resumableLegacy.length === 1) {
      const previous = readJson(join(resumableLegacy[0], "workspace.json"));
      if (previous.mode !== mode || previous.sourceHash !== hash)
        throw new Error(`Legacy workspace metadata does not match its source.`);
      mkdirSync(dirname(workspace), { recursive: true });
      renameSync(resumableLegacy[0], workspace);
      const legacyParent = dirname(resumableLegacy[0]);
      if (
        legacyParent !== jumpifyRoot &&
        readdirSync(legacyParent).length === 0
      )
        rmdirSync(legacyParent);
    }
  }
  const directories = [
    "source",
    "project/assets",
    "extracted/pages",
    "extracted/assets",
    "verification/rendered",
    "verification/comparisons",
  ];
  for (const directory of directories)
    mkdirSync(join(workspace, directory), { recursive: true });

  const copiedFiles = source.files.map((file, index) => {
    const extension = extname(file.path).toLowerCase();
    const targetName =
      file.type === "pdf"
        ? "source.pdf"
        : `page-${String(index + 1).padStart(4, "0")}${extension}`;
    const target = join(workspace, "source", targetName);
    if (!existsSync(target)) copyFileSync(file.path, target);
    return {
      order: index + 1,
      originalName: file.relativePath,
      copiedPath: `source/${targetName}`,
      type: file.type,
      bytes: statSync(file.path).size,
    };
  });

  const archive = `${sequenceLabel}-${readableLabel}.jmp`;
  const manifestPath = join(workspace, "workspace.json");
  const previousManifest = existsSync(manifestPath)
    ? readJson(manifestPath)
    : null;
  migrateArchiveName(workspace, previousManifest, archive);
  const manifest = {
    schemaVersion: 1,
    sequence,
    mode,
    slug,
    sourceHash: hash,
    originalSource: source.requested,
    totalBytes: source.totalBytes,
    files: copiedFiles,
    archive,
  };
  writeJson(manifestPath, manifest);

  const ledgerPath = join(workspace, "ledger.json");
  if (!existsSync(ledgerPath))
    writeJson(ledgerPath, {
      schemaVersion: 3,
      mode,
      sourceHash: hash,
      sourcePages: [],
      sections: [],
      entries: [],
      assets: [],
      colorSamples: [],
      comparisons: [],
      interactionContracts: [],
      reviewEvidence: "verification/review-evidence.json",
      ...(mode === "facsimile"
        ? {
            facsimileContracts: {
              semanticNames: [],
              grantInventory: {
                entryDecisions: [],
                sourceEntryIds: [],
                status: "unreviewed",
                note: "",
                grants: [],
              },
              dynamicEntities: [],
              tagPlacements: [],
              alignmentRelationships: [],
              independentReview: {
                reviewer: "clean-context-agent",
                status: "unreviewed",
                evidence: "",
                findings: [],
              },
            },
          }
        : {}),
      mechanics: [],
      gaps: [],
      acceptance: [],
    });
  return {
    workspace,
    manifest,
    ledgerPath,
    archivePath: join(workspace, manifest.archive),
  };
}

export function workspaceFromArgument(argument) {
  const workspace = resolve(argument);
  const manifestPath = join(workspace, "workspace.json");
  if (!existsSync(manifestPath))
    throw new Error(`Not a Jumpify workspace: ${workspace}`);
  return { workspace, manifest: readJson(manifestPath) };
}
