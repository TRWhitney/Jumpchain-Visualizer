import assert from "node:assert/strict";
import test from "node:test";
import {
  childProcessGroupOptions,
  terminateProcessTree,
} from "./verification-process.mjs";

test("verification isolates Unix commands into terminable process groups", () => {
  assert.deepEqual(childProcessGroupOptions("linux"), { detached: true });
  assert.deepEqual(childProcessGroupOptions("win32"), { detached: false });

  const signals = [];
  const child = { pid: 42, kill: () => assert.fail("used child.kill") };
  terminateProcessTree(child, "linux", (pid, signal) => {
    signals.push([pid, signal]);
    return true;
  });
  assert.deepEqual(signals, [[-42, "SIGTERM"]]);
});

test("verification uses the direct child signal on Windows", () => {
  const signals = [];
  const child = {
    pid: 42,
    kill: (signal) => {
      signals.push(signal);
      return true;
    },
  };
  terminateProcessTree(child, "win32");
  assert.deepEqual(signals, ["SIGTERM"]);
});
