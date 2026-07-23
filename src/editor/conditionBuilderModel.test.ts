import { describe, expect, it } from "vitest";
import { parseConditionExpression } from "../markup";
import {
  addVisualNode,
  expressionToVisual,
  removeVisualNode,
  visualSource,
  type VisualGroup,
  type VisualRule,
} from "./conditionBuilderModel";

const rule = (property: string): VisualRule => ({
  kind: "rule",
  property,
  operator: "active",
});

describe("condition builder model", () => {
  it.each([
    ["tier >= 4 and enabled", "tier >= 4 and enabled"],
    ["tier >= 4 and (enabled)", "tier >= 4 and (enabled)"],
    ['!(enabled or path = "South")', '!(enabled or path = "South")'],
    ["4 <= tier", "tier >= 4"],
  ])("round-trips %s without losing meaningful groups", (source, expected) => {
    const parsed = parseConditionExpression(source).expression!;
    expect(visualSource(expressionToVisual(parsed)!)).toBe(expected);
  });

  it("adds and removes an explicit nested group without flattening it", () => {
    const root: VisualGroup = {
      kind: "group",
      operator: "and",
      inverted: false,
      explicit: false,
      children: [rule("enabled"), rule("gauntlet")],
    };
    const nested: VisualGroup = {
      kind: "group",
      operator: "or",
      inverted: false,
      explicit: true,
      children: [rule("path"), rule("route")],
    };
    const added = addVisualNode(root, [], nested);
    expect(visualSource(added)).toBe(
      "enabled and gauntlet and (path or route)",
    );
    expect(visualSource(removeVisualNode(added, [2])!)).toBe(
      "enabled and gauntlet",
    );
  });
});
