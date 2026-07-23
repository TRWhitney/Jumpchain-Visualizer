import { describe, expect, it } from "vitest";
import {
  conditionExpressionSubsumes,
  evaluateConditionExpression,
  parseConditionExpression,
  printConditionExpression,
} from "./conditionExpression";

describe("Format 1 condition expressions", () => {
  it.each([
    ["gauntlet", "gauntlet"],
    ["!companion_name", "!companion_name"],
    ["rank>=2", "rank >= 2"],
    ['gender = "female"', 'gender = "female"'],
    [
      'engine_enabled and (tier >= 3 or engine_path = "Horizon")',
      'engine_enabled and (tier >= 3 or engine_path = "Horizon")',
    ],
    ["!(rank < 2 or count = 0)", "!(rank < 2 or count = 0)"],
    ["true", "true"],
    ["false", "false"],
    [
      'path = "line\\nreturn\\rquote\\"slash\\\\"',
      'path = "line\\nreturn\\rquote\\"slash\\\\"',
    ],
  ])("parses and canonically prints %s", (source, expected) => {
    const parsed = parseConditionExpression(source);
    expect(parsed.errors).toEqual([]);
    expect(parsed.expression).not.toBeNull();
    expect(printConditionExpression(parsed.expression!)).toBe(expected);
  });

  it.each([
    ["gauntlet", { gauntlet: true }, true],
    ["!gauntlet", { gauntlet: false }, true],
    ["rank >= 2 and rank < 4", { rank: 3 }, true],
    ["rank >= 2 and rank < 4", { rank: 4 }, false],
    ['gender = "female"', { gender: "female" }, true],
    ["missing", {}, false],
    ["true or missing", {}, true],
    ["rank = 2", { rank: 2 }, true],
    ["rank != 2", { rank: 3 }, true],
    ["rank < 2", { rank: 1 }, true],
    ["rank <= 2", { rank: 2 }, true],
    ["rank > 2", { rank: 3 }, true],
    ["rank >= 2", { rank: 2 }, true],
    ["false or true and false", {}, false],
  ])("evaluates %s without dynamic code", (source, context, expected) => {
    expect(evaluateConditionExpression(source, context)).toBe(expected);
  });

  it.each([
    "",
    "rank + 2",
    "rank >=",
    "(rank = 2",
    "rank = 2 trailing",
    'gender = "unterminated',
    'gender = "invalid\\qescape"',
  ])("reports invalid syntax with bounded spans for %s", (source) => {
    const parsed = parseConditionExpression(source);
    expect(parsed.expression).toBeNull();
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0].from).toBeGreaterThanOrEqual(0);
    expect(parsed.errors[0].to).toBeLessThanOrEqual(source.length);
  });

  it.each([
    ["true", "rank > 10", true],
    ["rank >= 2", "rank >= 4", true],
    ["rank > 2", "rank >= 3", true],
    ["rank <= 5", "rank < 3", true],
    ["rank >= 4", "rank >= 2", false],
    ["rank = 2", "rank = 3", false],
    ["rank >= 2", "count >= 4", false],
  ])(
    "detects conservative subsumption from %s to %s",
    (earlier, later, expected) => {
      const left = parseConditionExpression(earlier).expression!;
      const right = parseConditionExpression(later).expression!;
      expect(conditionExpressionSubsumes(left, right)).toBe(expected);
    },
  );
});
