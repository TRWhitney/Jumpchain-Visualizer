import { describe, expect, it } from "vitest";
import { parseFormatFile } from "./parseSource";
import {
  conditionContextHandles,
  conditionPropertyCatalog,
} from "./conditionProperties";

describe("condition property catalog", () => {
  it("discovers engine, copied, literal, option, and bounded properties", () => {
    const parsed = [
      parseFormatFile(
        "jump.jdef",
        `jump
  format: 1
  name: "Conditions"
  author: "Author"
  version: "1"

section
  handle: start
  name: "Start"

choice
  handle: tier_control
  name: "Tier"
  selection: integer
  min: 1
  max: 5
  grant
    kind: property
    handle: tier

choice
  handle: path_control
  name: "Path"
  selection: select
  option: "A"
  option when tier >= 2: "A Prime"
  option: "B"
  grant
    kind: property
    handle: path

choice
  handle: enabled_control
  name: "Enabled"
  grant
    kind: property
    handle: enabled
    value: true
`,
      ),
    ];
    const properties = conditionPropertyCatalog(parsed);
    expect(properties.find((item) => item.handle === "gauntlet")).toMatchObject(
      {
        type: "boolean",
        category: "engine",
      },
    );
    expect(properties.find((item) => item.handle === "tier")).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 5,
    });
    expect(properties.find((item) => item.handle === "path")?.values).toEqual([
      "A",
      "A Prime",
      "B",
    ]);
    expect(properties.find((item) => item.handle === "enabled")).toMatchObject({
      type: "boolean",
      values: [true],
    });
  });

  it.each([
    ["grant: perk", "rank"],
    ["grant: item\n  measure: quantity", "count"],
  ])(
    "limits %s conditional context to its visible measure",
    (grant, handle) => {
      const parsed = parseFormatFile(
        "jump.jdef",
        `choice
  handle: measured
  name: "Measured"
  selection: integer
  ${grant}
  text
    handle: description
    content: "Measured content"
`,
      );
      const owner = parsed.tree[0];
      const text = owner.children.find((node) => node.kind === "text")!;
      expect(conditionContextHandles(text, owner)).toEqual([handle]);
    },
  );
});
