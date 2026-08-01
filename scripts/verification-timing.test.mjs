import assert from "node:assert/strict";
import test from "node:test";
import {
  commandFailureDescription,
  formatDuration,
  renderTimingSummary,
} from "./verification-timing.mjs";

test("verification timing renders command results and the critical path", () => {
  const lint = {
    script: "lint",
    ok: true,
    code: 0,
    milliseconds: 1_500,
  };
  const typecheck = {
    script: "typecheck",
    ok: true,
    code: 0,
    milliseconds: 900,
  };
  const browser = {
    script: "test:browser",
    ok: true,
    code: 0,
    milliseconds: 2_500,
  };
  const summary = renderTimingSummary({
    commands: [lint, typecheck, browser],
    waves: [
      { commands: [lint, typecheck], milliseconds: 1_600 },
      { commands: [browser], milliseconds: 2_600 },
    ],
    totalMilliseconds: 4_200,
  });

  assert.match(summary, /lint\s+passed\s+1\.5s/);
  assert.match(summary, /Wave 1\s+passed\s+1\.6s/);
  assert.match(summary, /Wave 2\s+passed\s+2\.6s/);
  assert.match(summary, /Critical path: lint -> test:browser \(4\.0s\)/);
  assert.match(summary, /Total: 4\.2s/);
});

test("verification timing describes process failures", () => {
  assert.equal(formatDuration(999), "999ms");
  assert.equal(
    commandFailureDescription({ error: new Error("spawn failed") }),
    "spawn failed",
  );
  assert.equal(
    commandFailureDescription({ signal: "SIGTERM" }),
    "terminated by SIGTERM",
  );
  assert.equal(commandFailureDescription({ code: 2 }), "exited with code 2");
});
