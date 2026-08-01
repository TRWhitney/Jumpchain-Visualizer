import { execFile } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

export const RUST_CACHE_WARNING_BYTES = 10 * 1024 ** 3;

const execFileAsync = promisify(execFile);

function cacheCategory(relativePath) {
  const segments = relativePath.split(path.sep);
  if (segments.includes("incremental")) return "incremental";
  if (segments.includes("build")) return "buildScripts";
  if (segments.includes("deps")) return "dependencies";
  return "other";
}

export async function scanRustCache(targetDirectory) {
  const totals = {
    targetDirectory,
    exists: true,
    total: 0,
    dependencies: 0,
    incremental: 0,
    buildScripts: 0,
    other: 0,
    files: 0,
    excludedSymlinks: 0,
  };
  const pending = [{ absolute: targetDirectory, relative: "" }];

  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = await readdir(current.absolute, { withFileTypes: true });
    } catch (error) {
      if (
        current.relative === "" &&
        error &&
        typeof error === "object" &&
        error.code === "ENOENT"
      ) {
        totals.exists = false;
        return totals;
      }
      throw error;
    }

    for (const entry of entries) {
      const absolute = path.join(current.absolute, entry.name);
      const relative = path.join(current.relative, entry.name);
      if (entry.isSymbolicLink()) {
        totals.excludedSymlinks += 1;
        continue;
      }
      if (entry.isDirectory()) {
        pending.push({ absolute, relative });
        continue;
      }
      if (!entry.isFile()) continue;

      let stats;
      try {
        stats = await lstat(absolute);
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT")
          continue;
        throw error;
      }
      const category = cacheCategory(relative);
      totals.total += stats.size;
      totals[category] += stats.size;
      totals.files += 1;
    }
  }

  return totals;
}

export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function renderRustCacheReport(
  totals,
  warningBytes = RUST_CACHE_WARNING_BYTES,
) {
  if (!totals.exists) {
    return {
      warning: false,
      text: `Rust cache: no target directory at ${totals.targetDirectory}`,
    };
  }

  const warning = totals.total > warningBytes;
  const lines = [
    `Rust cache: ${formatBytes(totals.total)} across ${totals.files.toLocaleString("en-US")} files`,
    `  dependencies ${formatBytes(totals.dependencies)} · incremental ${formatBytes(totals.incremental)} · build scripts ${formatBytes(totals.buildScripts)} · other ${formatBytes(totals.other)}`,
  ];
  if (totals.excludedSymlinks > 0)
    lines.push(`  ignored ${totals.excludedSymlinks} symbolic link(s)`);
  if (warning) {
    lines.push(
      `  warning: exceeds ${formatBytes(warningBytes)}; inspect with pnpm rust:cache:status and clean explicitly with pnpm rust:cache:clean`,
    );
  }
  return { warning, text: lines.join("\n") };
}

export async function resolveCargoTargetDirectory(cwd = process.cwd()) {
  const { stdout } = await execFileAsync(
    process.platform === "win32" ? "cargo.exe" : "cargo",
    ["metadata", "--no-deps", "--format-version=1"],
    { cwd, maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(stdout).target_directory;
}

async function main() {
  const targetDirectory = await resolveCargoTargetDirectory();
  const totals = await scanRustCache(targetDirectory);
  const report = renderRustCacheReport(totals);
  const writer = report.warning ? console.warn : console.log;
  writer(report.text);
}

const entryPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (entryPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      `Unable to inspect the Rust cache: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
