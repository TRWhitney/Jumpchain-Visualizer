import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const tscPath = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url),
);

function runTypecheck(directory) {
  return spawnSync(process.execPath, [tscPath, "-p", "tsconfig.json"], {
    cwd: directory,
    encoding: "utf8",
  });
}

test("incremental no-emit state invalidates after a source change", async () => {
  const fixtureDirectory = await mkdtemp(
    join(tmpdir(), "jumpchain-typecheck-incremental-"),
  );
  try {
    await writeFile(
      join(fixtureDirectory, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            incremental: true,
            noEmit: true,
            strict: true,
            tsBuildInfoFile: "./cache.tsbuildinfo",
          },
          files: ["source.ts"],
        },
        null,
        2,
      )}\n`,
    );
    const sourcePath = join(fixtureDirectory, "source.ts");
    await writeFile(sourcePath, 'const value: string = "valid";\n');
    assert.equal(runTypecheck(fixtureDirectory).status, 0);

    await writeFile(sourcePath, "const value: string = 1;\n");
    const invalid = runTypecheck(fixtureDirectory);
    assert.notEqual(invalid.status, 0);
    assert.match(`${invalid.stdout}\n${invalid.stderr}`, /TS2322/);

    await writeFile(sourcePath, 'const value: string = "valid again";\n');
    assert.equal(runTypecheck(fixtureDirectory).status, 0);
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});
