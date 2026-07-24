import assert from "node:assert/strict";
import test from "node:test";
import {
  CORE_VERIFICATION_WAVES,
  PLAYWRIGHT_MODES,
  supportsVerificationRuntime,
  verificationTail,
} from "./verification-contract.mjs";

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
  assert.equal(PLAYWRIGHT_MODES.exhaustive.environment.E2E_EXHAUSTIVE, "1");
  assert.equal(
    PLAYWRIGHT_MODES.artifacts.environment.UPDATE_REVIEW_ARTIFACTS,
    "1",
  );
  assert.ok(PLAYWRIGHT_MODES.artifacts.arguments.includes("--workers=1"));
});

test("bounded core waves and verification tails preserve every gate", () => {
  assert.ok(CORE_VERIFICATION_WAVES.every((wave) => wave.length <= 4));
  assert.deepEqual(verificationTail("fast"), [["test:e2e:smoke"]]);
  assert.deepEqual(verificationTail("full"), [
    ["test:e2e:chromium"],
    ["test:e2e:cross-browser"],
  ]);
  assert.deepEqual(verificationTail("release"), [
    ["test:e2e:exhaustive"],
    ["test:native"],
  ]);
});

test("verification accepts only the pinned Node 24 LTS range", () => {
  assert.equal(supportsVerificationRuntime("24.18.0"), true);
  assert.equal(supportsVerificationRuntime("24.99.0"), true);
  assert.equal(supportsVerificationRuntime("24.17.9"), false);
  assert.equal(supportsVerificationRuntime("22.23.1"), false);
  assert.equal(supportsVerificationRuntime("25.0.0"), false);
});
