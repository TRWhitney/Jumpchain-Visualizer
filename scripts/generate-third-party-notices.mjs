import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const outputPath = join(projectRoot, "THIRD_PARTY_NOTICES.txt");
const licenseTextRoot = join(projectRoot, "scripts", "license-texts");
const licenseDocumentPattern =
  /^(licen[cs]e|copying|notice|copyright)([_.-]|$)/i;

function normalizeText(value) {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function displayPerson(value) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value) return value.name;
  return undefined;
}

function displayRepository(value) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "url" in value) return value.url;
  return undefined;
}

function readLicenseDocuments(packageRoot, explicitLicenseFile) {
  const candidates = readdirSync(packageRoot)
    .filter((name) => licenseDocumentPattern.test(name))
    .map((name) => join(packageRoot, name))
    .filter((path) => statSync(path).isFile());

  if (explicitLicenseFile) {
    const path = resolve(packageRoot, explicitLicenseFile);
    if (existsSync(path) && statSync(path).isFile()) candidates.push(path);
  }

  return [...new Set(candidates)]
    .sort((left, right) => basename(left).localeCompare(basename(right)))
    .map((path) => ({
      name: basename(path),
      text: normalizeText(readFileSync(path, "utf8")),
      provenance: "upstream package",
    }));
}

export function fallbackLicense(packageName, license) {
  if (packageName === "dictionary-en") {
    return {
      selectedLicense: license,
      name: "dictionary-en-license.txt",
      path: join(licenseTextRoot, "dictionary-en.txt"),
    };
  }

  if (license === "BSD-3-Clause") {
    return {
      selectedLicense: "BSD-3-Clause",
      name: "BSD-3-Clause.txt",
      path: join(licenseTextRoot, "BSD-3-Clause.txt"),
    };
  }
  if (license === "MPL-2.0") {
    return {
      selectedLicense: "MPL-2.0",
      name: "MPL-2.0.txt",
      path: join(licenseTextRoot, "MPL-2.0.txt"),
    };
  }
  if (/(^|[^A-Za-z])MIT([^A-Za-z]|$)/.test(license)) {
    return {
      selectedLicense: "MIT",
      name: "MIT.txt",
      path: join(licenseTextRoot, "MIT.txt"),
    };
  }
  throw new Error(
    `${packageName} declares ${license}, but its package contains no license document and no reviewed fallback is configured.`,
  );
}

function withLicenseDocuments(dependency, packageRoot, explicitLicenseFile) {
  if (!dependency.license?.trim())
    throw new Error(
      `${dependency.name}@${dependency.version} has no license metadata.`,
    );

  const documents = readLicenseDocuments(packageRoot, explicitLicenseFile);
  if (documents.length) return { ...dependency, documents };

  const fallback = fallbackLicense(dependency.name, dependency.license);
  const copyrightHolder = dependency.authors.length
    ? [...new Set(dependency.authors)].join(", ")
    : `${dependency.name} contributors`;
  const fallbackText = normalizeText(readFileSync(fallback.path, "utf8"))
    .replace("<year> <copyright holders>", copyrightHolder)
    .replace("<year> <owner>", copyrightHolder);
  return {
    ...dependency,
    selectedLicense: fallback.selectedLicense,
    documents: [
      {
        name: fallback.name,
        text: fallbackText,
        provenance:
          "reviewed canonical text with package metadata attribution (upstream archive omitted its license file)",
      },
    ],
  };
}

export function collectJavaScriptDependencies(report) {
  const dependencies = new Map();
  for (const packages of Object.values(report)) {
    for (const summary of packages) {
      for (const packageRoot of summary.paths) {
        const manifest = JSON.parse(
          readFileSync(join(packageRoot, "package.json"), "utf8"),
        );
        const key = `${manifest.name}@${manifest.version}`;
        dependencies.set(
          key,
          withLicenseDocuments(
            {
              ecosystem: "JavaScript",
              name: manifest.name,
              version: manifest.version,
              license: manifest.license ?? summary.license,
              authors: [
                displayPerson(manifest.author),
                ...(manifest.contributors ?? []).map(displayPerson),
              ].filter(Boolean),
              source:
                displayRepository(manifest.repository) ??
                manifest.homepage ??
                summary.homepage,
            },
            packageRoot,
            manifest.licenseFile,
          ),
        );
      }
    }
  }
  return [...dependencies.values()];
}

export function productionCargoPackageIds(metadata) {
  const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
  const included = new Set(metadata.workspace_members);
  const queue = [...metadata.workspace_members];

  while (queue.length) {
    const node = nodes.get(queue.shift());
    if (!node) continue;
    for (const dependency of node.deps) {
      const isProduction = dependency.dep_kinds.some(
        (kind) => kind.kind === null,
      );
      if (isProduction && !included.has(dependency.pkg)) {
        included.add(dependency.pkg);
        queue.push(dependency.pkg);
      }
    }
  }
  for (const member of metadata.workspace_members) included.delete(member);
  return included;
}

export function collectRustDependencies(metadata) {
  const packages = new Map(metadata.packages.map((item) => [item.id, item]));
  return [...productionCargoPackageIds(metadata)].map((id) => {
    const item = packages.get(id);
    if (!item) throw new Error(`Cargo metadata omitted package ${id}.`);
    return withLicenseDocuments(
      {
        ecosystem: "Rust",
        name: item.name,
        version: item.version,
        license: item.license,
        authors: item.authors,
        source: item.repository ?? item.homepage,
      },
      dirname(item.manifest_path),
      item.license_file,
    );
  });
}

function fingerprintFiles() {
  const files = [
    "package.json",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "Cargo.toml",
    "crates/archive-core/Cargo.toml",
    "crates/persistence/Cargo.toml",
    "src-tauri/Cargo.toml",
    "scripts/generate-third-party-notices.mjs",
    ...readdirSync(licenseTextRoot)
      .sort()
      .map((name) => `scripts/license-texts/${name}`),
  ];
  return files;
}

export function sourceFingerprint(root = projectRoot) {
  const digest = createHash("sha256");
  for (const name of fingerprintFiles()) {
    digest.update(`${name}\0`);
    digest.update(readFileSync(join(root, name)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function command(name, args) {
  const executable = process.platform === "win32" ? `${name}.cmd` : name;
  return execFileSync(executable, args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

export function renderNotices(dependencies, fingerprint) {
  const ordered = [...dependencies].sort((left, right) =>
    [left.ecosystem, left.name, left.version]
      .join("\0")
      .localeCompare([right.ecosystem, right.name, right.version].join("\0")),
  );
  const documents = new Map();
  for (const dependency of ordered) {
    dependency.documentIds = dependency.documents.map((document) => {
      const key = hash(document.text);
      if (!documents.has(key)) {
        documents.set(key, {
          ...document,
          id: `L${String(documents.size + 1).padStart(4, "0")}`,
          packages: [],
        });
      }
      const stored = documents.get(key);
      stored.packages.push(
        `${dependency.ecosystem}: ${dependency.name}@${dependency.version}`,
      );
      return stored.id;
    });
  }

  const lines = [
    "THIRD-PARTY SOFTWARE NOTICES",
    "============================",
    "",
    "This file lists third-party software distributed with Jumpchain Visualizer.",
    "It does not change the license of the application itself. Development-only",
    "JavaScript packages and Cargo build/dev dependencies are excluded. Rust",
    "target-specific runtime dependencies are included for every supported target.",
    "",
    "Generated from package.json, pnpm-lock.yaml, Cargo workspace manifests, and",
    "Cargo.lock. Do not edit this file directly; run:",
    "",
    "  corepack pnpm generate:third-party-notices",
    "",
    `Source fingerprint: ${fingerprint}`,
    `Dependencies: ${ordered.length}`,
    `Unique license documents: ${documents.size}`,
    "",
    "DEPENDENCY INVENTORY",
    "====================",
  ];

  for (const dependency of ordered) {
    lines.push(
      "",
      "-------------------------------------------------------------------------------",
      `${dependency.ecosystem}: ${dependency.name}@${dependency.version}`,
      `Declared license: ${dependency.license}`,
    );
    if (dependency.selectedLicense)
      lines.push(`Selected/distributed license: ${dependency.selectedLicense}`);
    if (dependency.authors.length)
      lines.push(
        `Authors/contributors: ${[...new Set(dependency.authors)].join("; ")}`,
      );
    if (dependency.source) lines.push(`Source: ${dependency.source}`);
    lines.push(
      `License documents: ${dependency.documentIds.join(", ")}`,
      `Document provenance: ${[
        ...new Set(dependency.documents.map((document) => document.provenance)),
      ].join("; ")}`,
    );
  }

  lines.push("", "", "LICENSE DOCUMENTS", "=================", "");
  for (const document of documents.values()) {
    lines.push(
      "===============================================================================",
      `${document.id}: ${document.name}`,
      `Used by: ${document.packages.join("; ")}`,
      `Provenance: ${document.provenance}`,
      "-------------------------------------------------------------------------------",
      document.text,
      "",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function checkNoticeFingerprint(notice, expected) {
  const match = notice.match(/^Source fingerprint: ([a-f0-9]{64})$/m);
  if (!match)
    throw new Error("THIRD_PARTY_NOTICES.txt has no valid source fingerprint.");
  if (match[1] !== expected)
    throw new Error(
      "THIRD_PARTY_NOTICES.txt is stale. Run `corepack pnpm generate:third-party-notices`.",
    );
}

function generate() {
  const nodeReport = JSON.parse(
    command("corepack", ["pnpm", "licenses", "list", "--prod", "--json"]),
  );
  const cargoMetadata = JSON.parse(
    command("cargo", ["metadata", "--format-version", "1", "--locked"]),
  );
  const dependencies = [
    ...collectJavaScriptDependencies(nodeReport),
    ...collectRustDependencies(cargoMetadata),
  ];
  writeFileSync(
    outputPath,
    renderNotices(dependencies, sourceFingerprint()),
    "utf8",
  );
  console.log(
    `Wrote ${relative(projectRoot, outputPath)} (${dependencies.length} dependencies).`,
  );
}

function check() {
  if (!existsSync(outputPath))
    throw new Error(
      "THIRD_PARTY_NOTICES.txt is missing. Generate it before packaging.",
    );
  checkNoticeFingerprint(readFileSync(outputPath, "utf8"), sourceFingerprint());
  console.log("THIRD_PARTY_NOTICES.txt is current.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes("--check")) check();
    else generate();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
