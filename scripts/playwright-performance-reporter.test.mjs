import assert from "node:assert/strict";
import test from "node:test";
import { stepCategory } from "./playwright-performance-reporter.mjs";

test("Playwright performance steps are classified without retaining action data", () => {
  assert.equal(stepCategory('Navigate to "/settings"'), "navigation");
  assert.equal(stepCategory("Create context"), "context");
  assert.equal(stepCategory("Create page"), "page");
  assert.equal(stepCategory("Screenshot locator"), "screenshot");
  assert.equal(stepCategory("Click getByRole('button')"), "action");
  assert.equal(stepCategory("Before Hooks"), "other");
});
