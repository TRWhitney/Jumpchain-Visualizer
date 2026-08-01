import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";
import {
  CORE_VERIFICATION_WAVES,
  supportsVerificationRuntime,
  VERIFICATION_MODES,
  verificationTail,
  verificationWorkerBudget,
} from "./verification-contract.mjs";
import {
  commandFailureDescription,
  renderTimingSummary,
} from "./verification-timing.mjs";
import {
  childProcessGroupOptions,
  terminateProcessTree,
} from "./verification-process.mjs";

const mode = process.argv[2] ?? "fast";
const supportedModes = new Set(VERIFICATION_MODES);
if (!supportedModes.has(mode)) {
  console.error(
    `Unknown verification mode "${mode}". Expected one of: ${[...supportedModes].join(", ")}.`,
  );
  process.exit(2);
}

if (!supportsVerificationRuntime(process.versions.node)) {
  console.error(
    `Verification requires Node 24.18.x or newer in the Node 24 LTS line; found ${process.versions.node}.`,
  );
  process.exit(1);
}

const corepackCommand =
  process.platform === "win32" ? "corepack.cmd" : "corepack";
const activeChildren = new Set();
const commandTimings = [];
const waveTimings = [];
const verificationStarted = performance.now();
const workerBudget = verificationWorkerBudget(availableParallelism());
let firstFailure;

function runScript(script, environment) {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const child = spawn(corepackCommand, ["pnpm", "run", script], {
      env: { ...process.env, ...environment },
      stdio: "inherit",
      ...childProcessGroupOptions(),
    });
    activeChildren.add(child);

    const finish = ({ code = 1, error, signal } = {}) => {
      if (settled) return;
      settled = true;
      const result = {
        script,
        code,
        error,
        signal,
        ok: code === 0 && !error && !signal,
        milliseconds: performance.now() - started,
      };
      if (!result.ok && !firstFailure) {
        firstFailure = result;
        for (const sibling of activeChildren) {
          if (sibling !== child) {
            try {
              terminateProcessTree(sibling);
            } catch {
              sibling.kill("SIGTERM");
            }
          }
        }
      }
      activeChildren.delete(child);
      resolve(result);
    };

    child.on("error", (error) => {
      finish({ error });
    });
    child.on("exit", (code, signal) => {
      finish({ code: code ?? 1, signal });
    });
  });
}

async function runWave(scripts, environment = {}) {
  const started = performance.now();
  const commands = await Promise.all(
    scripts.map((script) =>
      runScript(
        script,
        typeof environment === "function" ? environment(script) : environment,
      ),
    ),
  );
  commandTimings.push(...commands);
  waveTimings.push({
    commands,
    milliseconds: performance.now() - started,
  });
  if (!firstFailure) return;
  console.error(
    `Verification command "${firstFailure.script}" failed: ${commandFailureDescription(firstFailure)}.`,
  );
  console.error(
    renderTimingSummary({
      commands: commandTimings,
      waves: waveTimings,
      totalMilliseconds: performance.now() - verificationStarted,
    }),
  );
  process.exit(firstFailure.code);
}

for (const wave of CORE_VERIFICATION_WAVES) {
  await runWave(wave, (script) => {
    const environment =
      script === "build:client" || script === "test:browser"
        ? { VITE_E2E_LOCALES: "1" }
        : {};
    if (script === "test")
      environment.VITEST_MAX_WORKERS = String(workerBudget.unit);
    if (script === "test:browser")
      environment.VITEST_MAX_WORKERS = String(workerBudget.browser);
    if (script === "check:rust")
      environment.CARGO_BUILD_JOBS = String(workerBudget.rust);
    return environment;
  });
}

const useVerifiedBuild = { E2E_SKIP_BUILD: "1" };
for (const wave of verificationTail(mode)) {
  const environment = wave.includes("test:native") ? {} : useVerifiedBuild;
  await runWave(wave, environment);
}

console.log(
  renderTimingSummary({
    commands: commandTimings,
    waves: waveTimings,
    totalMilliseconds: performance.now() - verificationStarted,
  }),
);
