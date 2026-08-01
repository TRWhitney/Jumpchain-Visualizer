export const PLAYWRIGHT_MODES = Object.freeze({
  smoke: {
    arguments: ["--project=chromium", "--grep", "@smoke"],
  },
  chromium: {
    arguments: ["--project=chromium", "--grep-invert", "@slow"],
    environment: { E2E_FULL_CHROMIUM: "1" },
  },
  "cross-browser": {
    arguments: ["--project=firefox", "--project=webkit"],
    environment: { E2E_CROSS_BROWSER: "1" },
  },
  exhaustive: {
    arguments: [],
    environment: { E2E_EXHAUSTIVE: "1" },
  },
  artifacts: {
    arguments: ["--project=chromium", "--workers=1"],
    environment: { UPDATE_REVIEW_ARTIFACTS: "1" },
  },
});

export const VERIFICATION_MODES = Object.freeze([
  "core",
  "fast",
  "full",
  "exhaustive",
  "release",
]);

export const CORE_VERIFICATION_WAVES = Object.freeze([
  [
    "format:check",
    "lint",
    "typecheck",
    "test:verification",
    "rust:cache:status",
  ],
  ["test"],
  ["build:client", "test:browser", "check:rust"],
]);

export function verificationTail(mode) {
  if (mode === "core") return [];
  if (mode === "fast") return [["test:e2e:smoke"]];
  if (mode === "full")
    return [["test:e2e:chromium"], ["test:e2e:cross-browser"]];
  if (mode === "exhaustive") return [["test:e2e:exhaustive"]];
  if (mode === "release") return [["test:e2e:exhaustive"], ["test:native"]];
  throw new Error(`Unknown verification mode "${mode}".`);
}

export function supportsVerificationRuntime(version) {
  const [major, minor] = version.split(".").map(Number);
  return major === 24 && minor >= 18;
}

export function verificationWorkerBudget(availableWorkers) {
  if (!Number.isInteger(availableWorkers) || availableWorkers < 1)
    throw new RangeError("availableWorkers must be a positive integer.");
  const unit = Math.max(1, Math.min(8, Math.floor(availableWorkers / 4)));
  const browser = Math.max(1, Math.min(8, Math.floor(availableWorkers / 4)));
  const rust = Math.max(1, Math.min(8, Math.floor(availableWorkers / 4)));
  return Object.freeze({ unit, browser, rust });
}
