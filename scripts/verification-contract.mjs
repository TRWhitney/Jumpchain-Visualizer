export const PLAYWRIGHT_MODES = Object.freeze({
  smoke: {
    arguments: ["--project=chromium", "--grep", "@smoke"],
  },
  chromium: {
    arguments: ["--project=chromium", "--grep-invert", "@slow"],
  },
  "cross-browser": {
    arguments: ["--project=firefox", "--project=webkit"],
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
  ["format:check", "lint", "typecheck"],
  ["build:client", "test:browser", "check:rust"],
  ["test", "test:verification"],
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
