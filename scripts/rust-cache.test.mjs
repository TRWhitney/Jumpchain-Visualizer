import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  formatBytes,
  renderRustCacheReport,
  scanRustCache,
} from "./rust-cache.mjs";

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "rust-cache-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("Rust cache scan classifies artifacts and does not follow symlinks", async () => {
  await withTemporaryDirectory(async (directory) => {
    const paths = {
      dependencies: path.join(directory, "debug", "deps"),
      incremental: path.join(directory, "debug", "incremental"),
      buildScripts: path.join(directory, "debug", "build"),
      other: path.join(directory, "debug"),
      external: path.join(
        directory,
        "..",
        `${path.basename(directory)}-outside`,
      ),
    };
    await Promise.all(
      Object.values(paths).map((candidate) =>
        mkdir(candidate, { recursive: true }),
      ),
    );
    await Promise.all([
      writeFile(path.join(paths.dependencies, "dependency.rlib"), "1234"),
      writeFile(path.join(paths.incremental, "state.bin"), "12345"),
      writeFile(path.join(paths.buildScripts, "output.bin"), "123456"),
      writeFile(path.join(paths.other, "application"), "1234567"),
      writeFile(path.join(paths.external, "large.bin"), "x".repeat(100)),
    ]);
    await symlink(paths.external, path.join(directory, "external-cache"));

    const result = await scanRustCache(directory);

    assert.equal(result.total, 22);
    assert.equal(result.dependencies, 4);
    assert.equal(result.incremental, 5);
    assert.equal(result.buildScripts, 6);
    assert.equal(result.other, 7);
    assert.equal(result.files, 4);
    assert.equal(result.excludedSymlinks, 1);

    await rm(paths.external, { recursive: true, force: true });
  });
});

test("Rust cache scan treats a missing target directory as empty", async () => {
  await withTemporaryDirectory(async (directory) => {
    const result = await scanRustCache(path.join(directory, "missing"));

    assert.equal(result.exists, false);
    assert.equal(result.total, 0);
  });
});

test("Rust cache report warns only above the configured threshold", () => {
  const base = {
    targetDirectory: "/workspace/target",
    exists: true,
    dependencies: 4,
    incremental: 3,
    buildScripts: 2,
    other: 1,
    files: 4,
    excludedSymlinks: 0,
  };

  assert.equal(
    renderRustCacheReport({ ...base, total: 10 }, 10).warning,
    false,
  );
  const oversized = renderRustCacheReport({ ...base, total: 11 }, 10);
  assert.equal(oversized.warning, true);
  assert.match(oversized.text, /clean explicitly/);
  assert.equal(formatBytes(1024 ** 3), "1.0 GiB");
});
