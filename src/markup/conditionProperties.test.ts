import { describe, expect, it } from "vitest";
import { parseFormatFile } from "./parseSource";
import {
  conditionControlProperties,
  conditionNodeEntries,
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

choice
  handle: details
  name: "Details"

  input
    handle: note_control
    selection: text

    grant
      kind: property
      handle: note
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
    expect(properties.find((item) => item.handle === "note")).toMatchObject({
      type: "string",
      category: "package",
    });
    expect(properties.find((item) => item.handle === "tier_control")).toBe(
      undefined,
    );
    expect(properties.find((item) => item.handle === "note_control")).toBe(
      undefined,
    );
  });

  it("exposes the owning Choice and supporting Input answers to nested Text", () => {
    const parsed = parseFormatFile(
      "choices.jdef",
      `choice
  handle: prompt
  name: "Prompt"
  selection: text

  text
    handle: description
    content when prompt = "Ready": "{{prompt}} / {{score}} / {{route}}"

  input
    handle: score
    selection: integer
    min: 1
    max: 5

  input
    handle: route
    selection: select
    option: "North"
    option: "South"
`,
    );
    const entry = conditionNodeEntries([parsed]).find(
      ({ node }) => node.kind === "text",
    )!;

    expect(
      conditionControlProperties(entry.node, entry.parent, entry.ancestors),
    ).toEqual([
      expect.objectContaining({
        handle: "prompt",
        type: "string",
        category: "context",
      }),
      expect.objectContaining({
        handle: "score",
        type: "integer",
        minimum: 1,
        maximum: 5,
      }),
      expect.objectContaining({
        handle: "route",
        type: "string",
        values: ["North", "South"],
      }),
    ]);
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

  it.each([
    ["perk", "", "rank"],
    ["item", "    measure: quantity\n", "count"],
  ])(
    "exposes an owning integer Choice's %s context inside nested Grant text",
    (kind, measure, handle) => {
      const parsed = parseFormatFile(
        "jump.jdef",
        `choice
  handle: measured
  name: "Measured"
  selection: integer

  grant
    kind: ${kind}
${measure}
    text
      handle: description
      content: "Measured content"
`,
      );
      const choice = parsed.tree[0];
      const grant = choice.children.find((node) => node.kind === "grant")!;
      const text = grant.children.find((node) => node.kind === "text")!;
      expect(conditionContextHandles(text, grant, [choice, grant])).toEqual([
        handle,
      ]);
    },
  );
});
