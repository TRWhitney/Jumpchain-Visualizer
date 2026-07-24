import { spawn } from "node:child_process";
import {
  CORE_VERIFICATION_WAVES,
  supportsVerificationRuntime,
  VERIFICATION_MODES,
  verificationTail,
} from "./verification-contract.mjs";

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
let firstFailure;

function runScript(script, environment) {
  return new Promise((resolve) => {
    const child = spawn(corepackCommand, ["pnpm", "run", script], {
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });
    activeChildren.add(child);
    child.on("error", (error) => {
      firstFailure ??= { script, code: 1, error };
      activeChildren.delete(child);
      resolve();
    });
    child.on("exit", (code, signal) => {
      if ((code ?? 1) !== 0 && !firstFailure) {
        firstFailure = { script, code: code ?? 1, signal };
        for (const sibling of activeChildren) {
          if (sibling !== child) sibling.kill("SIGTERM");
        }
      }
      activeChildren.delete(child);
      resolve();
    });
  });
}

async function runWave(scripts, environment = {}) {
  await Promise.all(
    scripts.map((script) =>
      runScript(
        script,
        typeof environment === "function" ? environment(script) : environment,
      ),
    ),
  );
  if (!firstFailure) return;
  const detail = firstFailure.error
    ? `: ${firstFailure.error.message}`
    : firstFailure.signal
      ? ` (${firstFailure.signal})`
      : "";
  console.error(
    `Verification command "${firstFailure.script}" failed${detail}.`,
  );
  process.exit(firstFailure.code);
}

await runWave(CORE_VERIFICATION_WAVES[0]);
await runWave(CORE_VERIFICATION_WAVES[1], (script) =>
  script === "build:client" || script === "test:browser"
    ? { VITE_E2E_LOCALES: "1" }
    : {},
);
await runWave(CORE_VERIFICATION_WAVES[2]);

const useVerifiedBuild = { E2E_SKIP_BUILD: "1" };
for (const wave of verificationTail(mode)) {
  const environment = wave.includes("test:native") ? {} : useVerifiedBuild;
  await runWave(wave, environment);
}
