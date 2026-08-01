import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import playwrightConfig from "../playwright.config.ts";
import vitestConfig from "../vitest.config.ts";
import {
  WELCOME_TOUR_STORAGE_STATE_PATH,
  sanitizeWelcomeTourStorageState,
  welcomeTourStorageState,
} from "../e2e/browser/support/welcomeTourState.ts";
import {
  CORE_VERIFICATION_WAVES,
  PLAYWRIGHT_MODES,
  supportsVerificationRuntime,
  verificationTail,
  verificationWorkerBudget,
} from "./verification-contract.mjs";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const appTsConfig = JSON.parse(
  await readFile(new URL("../tsconfig.app.json", import.meta.url), "utf8"),
);
const nodeTsConfig = JSON.parse(
  await readFile(new URL("../tsconfig.node.json", import.meta.url), "utf8"),
);
const editorE2eSource = await readFile(
  new URL("../e2e/browser/editor.spec.ts", import.meta.url),
  "utf8",
);
const welcomeTourE2eSource = await readFile(
  new URL("../e2e/browser/welcomeTour.spec.ts", import.meta.url),
  "utf8",
);
const crossBrowserSources = new Map(
  await Promise.all(
    [
      "applicationShell.spec.ts",
      "chainTracker.spec.ts",
      "editor.spec.ts",
      "jumpRenderer.spec.ts",
      "settings.spec.ts",
      "supplements.spec.ts",
      "welcomeTour.spec.ts",
    ].map(async (file) => [
      file,
      await readFile(
        new URL(`../e2e/browser/${file}`, import.meta.url),
        "utf8",
      ),
    ]),
  ),
);
const gitignore = await readFile(
  new URL("../.gitignore", import.meta.url),
  "utf8",
);

test("the everyday and comprehensive Playwright modes remain distinct", () => {
  assert.deepEqual(PLAYWRIGHT_MODES.smoke.arguments, [
    "--project=chromium",
    "--grep",
    "@smoke",
  ]);
  assert.deepEqual(PLAYWRIGHT_MODES["cross-browser"].arguments, [
    "--project=firefox",
    "--project=webkit",
  ]);
  assert.equal(
    PLAYWRIGHT_MODES["cross-browser"].environment.E2E_CROSS_BROWSER,
    "1",
  );
  assert.equal(PLAYWRIGHT_MODES.chromium.environment.E2E_FULL_CHROMIUM, "1");
  assert.equal(PLAYWRIGHT_MODES.exhaustive.environment.E2E_EXHAUSTIVE, "1");
  assert.equal(
    PLAYWRIGHT_MODES.artifacts.environment.UPDATE_REVIEW_ARTIFACTS,
    "1",
  );
  assert.ok(PLAYWRIGHT_MODES.artifacts.arguments.includes("--workers=1"));
});

test("bounded core waves and verification tails preserve every gate", () => {
  assert.equal(CORE_VERIFICATION_WAVES.length, 3);
  assert.deepEqual(CORE_VERIFICATION_WAVES[0], [
    "format:check",
    "lint",
    "typecheck",
    "test:verification",
    "rust:cache:status",
  ]);
  assert.deepEqual(CORE_VERIFICATION_WAVES[1], ["test"]);
  assert.deepEqual(CORE_VERIFICATION_WAVES[2], [
    "build:client",
    "test:browser",
    "check:rust",
  ]);
  assert.deepEqual(verificationTail("fast"), [["test:e2e:smoke"]]);
  assert.deepEqual(verificationTail("full"), [
    ["test:e2e:chromium"],
    ["test:e2e:cross-browser"],
  ]);
  assert.deepEqual(verificationTail("exhaustive"), [["test:e2e:exhaustive"]]);
  assert.deepEqual(verificationTail("release"), [
    ["test:e2e:exhaustive"],
    ["test:native"],
  ]);
  const allGates = new Set([
    ...CORE_VERIFICATION_WAVES.flat(),
    ...["fast", "full", "exhaustive", "release"].flatMap((mode) =>
      verificationTail(mode).flat(),
    ),
  ]);
  assert.deepEqual([...allGates].sort(), [
    "build:client",
    "check:rust",
    "format:check",
    "lint",
    "rust:cache:status",
    "test",
    "test:browser",
    "test:e2e:chromium",
    "test:e2e:cross-browser",
    "test:e2e:exhaustive",
    "test:e2e:smoke",
    "test:native",
    "test:verification",
    "typecheck",
  ]);
});

test("verification accepts only the pinned Node 24 LTS range", () => {
  assert.equal(supportsVerificationRuntime("24.18.0"), true);
  assert.equal(supportsVerificationRuntime("24.99.0"), true);
  assert.equal(supportsVerificationRuntime("24.17.9"), false);
  assert.equal(supportsVerificationRuntime("22.23.1"), false);
  assert.equal(supportsVerificationRuntime("25.0.0"), false);
});

test("parallel core commands share a bounded machine worker budget", () => {
  assert.deepEqual(verificationWorkerBudget(32), {
    unit: 8,
    browser: 8,
    rust: 8,
  });
  assert.deepEqual(verificationWorkerBudget(8), {
    unit: 2,
    browser: 2,
    rust: 2,
  });
  assert.deepEqual(verificationWorkerBudget(1), {
    unit: 1,
    browser: 1,
    rust: 1,
  });
  assert.throws(() => verificationWorkerBudget(0), RangeError);
});

test("unit isolation uses worker threads instead of WSL-crashing child forks", () => {
  const unitProject = vitestConfig.test.projects.find(
    (project) => project.test.name === "unit",
  );
  assert.equal(unitProject?.test.pool, "threads");
});

test("no-emit typechecking covers both projects with independent incremental state", () => {
  assert.equal(appTsConfig.compilerOptions.noEmit, true);
  assert.equal(appTsConfig.compilerOptions.incremental, true);
  assert.equal(nodeTsConfig.compilerOptions.noEmit, true);
  assert.equal(nodeTsConfig.compilerOptions.incremental, true);
  assert.notEqual(
    appTsConfig.compilerOptions.tsBuildInfoFile,
    nodeTsConfig.compilerOptions.tsBuildInfoFile,
  );
  assert.match(packageJson.scripts.typecheck, /tsc -p tsconfig\.app\.json/);
  assert.match(packageJson.scripts.typecheck, /tsc -p tsconfig\.node\.json/);
  assert.match(packageJson.scripts.build, /pnpm typecheck/);
});

test("Playwright prepares reusable onboarding state without weakening isolation", () => {
  const setupProject = playwrightConfig.projects.find(
    (project) => project.name === "setup",
  );
  assert.ok(setupProject);
  for (const projectName of ["chromium", "firefox", "webkit"]) {
    const project = playwrightConfig.projects.find(
      (candidate) => candidate.name === projectName,
    );
    assert.deepEqual(project?.dependencies, ["setup"]);
    assert.match(
      String(project?.testIgnore),
      /welcome-tour-state\\\.setup\\\.ts/,
    );
  }
  assert.equal(
    welcomeTourStorageState("dismissed"),
    WELCOME_TOUR_STORAGE_STATE_PATH,
  );
  assert.deepEqual(welcomeTourStorageState("pending"), {
    cookies: [],
    origins: [],
  });
  assert.deepEqual(
    sanitizeWelcomeTourStorageState({
      cookies: [{ name: "must-not-survive" }],
      origins: [
        {
          origin: "http://127.0.0.1:4173",
          indexedDB: [
            {
              stores: [
                {
                  name: "aggregates",
                  records: [
                    { key: "settings", value: { onboarding: "dismissed" } },
                    { key: "unrelated", value: true },
                  ],
                },
                { name: "chains", records: [{ id: "mock-chain" }] },
              ],
            },
          ],
        },
        {
          origin: "https://unrelated.invalid",
          indexedDB: [{ stores: [] }],
        },
      ],
    }),
    {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4173",
          indexedDB: [
            {
              stores: [
                {
                  name: "aggregates",
                  records: [
                    {
                      key: "settings",
                      value: { onboarding: "dismissed" },
                    },
                  ],
                },
                { name: "chains", records: [] },
              ],
            },
          ],
        },
      ],
    },
  );
  assert.match(gitignore, /^test-results\/$/m);
});

test("exhaustive coverage runs every behavior in Chromium and focused engine contracts elsewhere", () => {
  const chromium = playwrightConfig.projects.find(
    (project) => project.name === "chromium",
  );
  assert.equal(chromium?.grep, undefined);
  for (const projectName of ["firefox", "webkit"]) {
    const project = playwrightConfig.projects.find(
      (candidate) => candidate.name === projectName,
    );
    assert.equal(String(project?.grep), "/@cross-browser/");
  }

  const requiredCoverage = [
    ["applicationShell.spec.ts", "workspace navigation uses real paths"],
    ["applicationShell.spec.ts", "starred chains lead both lists"],
    ["applicationShell.spec.ts", "narrow shell follows the proposal"],
    ["chainTracker.spec.ts", "images decode"],
    ["chainTracker.spec.ts", "dragging a Jump exposes"],
    ["editor.spec.ts", "source keyboard functions are operable"],
    ["editor.spec.ts", "paint canvas drag, resize"],
    ["jumpRenderer.spec.ts", "radio sources visibly selected"],
    ["settings.spec.ts", "preferences persist through IndexedDB"],
    ["settings.spec.ts", "supports RTL"],
    ["settings.spec.ts", "internally scrollable and unclipped"],
    ["supplements.spec.ts", "without horizontal workspace scrolling"],
    ["supplements.spec.ts", "tabs support keyboard navigation"],
    ["welcomeTour.spec.ts", "resumes exact input"],
  ];
  for (const [file, titleFragment] of requiredCoverage) {
    const source = crossBrowserSources.get(file);
    assert.ok(source, `missing ${file}`);
    const titleIndex = source.indexOf(titleFragment);
    assert.notEqual(titleIndex, -1, `missing ${titleFragment}`);
    assert.match(
      source.slice(titleIndex, titleIndex + 400),
      /@cross-browser/,
      `${titleFragment} must remain assigned to secondary engines`,
    );
  }
  assert.equal(
    [...crossBrowserSources.values()].join("\n").match(/@cross-browser/g)
      ?.length,
    requiredCoverage.length,
  );
});

test("editor waits use observable state and diagnostics remain opt-in", () => {
  assert.doesNotMatch(editorE2eSource, /waitForTimeout/);
  assert.doesNotMatch(welcomeTourE2eSource, /waitForTimeout/);
  const diagnosticOutputs =
    editorE2eSource.match(/testInfo\.outputPath/g) ?? [];
  const diagnosticGuards =
    editorE2eSource.match(/if \(reviewArtifactsEnabled\)/g) ?? [];
  assert.ok(diagnosticOutputs.length > 0);
  assert.ok(diagnosticGuards.length >= diagnosticOutputs.length);
});

test("Playwright reports never block verification and remain explicitly viewable", () => {
  assert.deepEqual(playwrightConfig.reporter, [
    ["dot"],
    ["./scripts/playwright-performance-reporter.mjs"],
    ["html", { open: "never" }],
  ]);
  assert.equal(
    packageJson.scripts["test:e2e:report"],
    "playwright show-report",
  );
});
