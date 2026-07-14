import { describe, expect, it } from "vitest";
import schemaJson from "../../schema/format-1.json";

type FormatSchema = {
  format: number;
  schemaVersion: number;
  declarations: Record<
    string,
    {
      contexts?: readonly string[];
      formsByContext?: Record<string, { fields: Record<string, unknown> }>;
    }
  >;
  layoutNodes: Record<string, Record<string, unknown>>;
  semanticConstraints: readonly { code: string; rule: string }[];
};

const schema = schemaJson as FormatSchema;

describe("unreleased Format 1 identity amendment", () => {
  it("adds owner-local direct choice associations and a compact layout leaf", () => {
    const choice = schema.declarations.choice;
    expect(choice.contexts).toEqual(["top-level", "section"]);
    expect(choice.formsByContext?.section.fields).toMatchObject({
      handle: { type: "handle", min: 1, max: 1, required: true },
      target: {
        type: "handleReference:choice",
        min: 1,
        max: 1,
        required: true,
      },
    });
    expect(schema.layoutNodes.choice).toMatchObject({
      kind: "leaf",
      compact: "choice: <target>",
      compactOnly: true,
      allowedLayouts: ["section-layout"],
      targetNamespace: "choice-placement",
    });
  });

  it("accepts continuity only on the top-level choice form", () => {
    const choice = schema.declarations.choice;
    expect(choice.formsByContext?.["top-level"].fields.continuity).toEqual({
      type: "enum",
      values: ["previous", "original"],
      min: 0,
      max: 1,
    });
    expect(choice.formsByContext?.section.fields.continuity).toBeUndefined();
    expect(
      choice.formsByContext?.["top-level"].fields.species,
    ).toBeUndefined();
  });

  it("codifies reserved types, copied-control domains, and entry scope", () => {
    const constraints = Object.fromEntries(
      schema.semanticConstraints.map(({ code, rule }) => [code, rule]),
    );
    expect(constraints["choice.continuity.domain"]).toContain(
      "selection select",
    );
    expect(constraints["grant.property.reserved_types"]).toContain(
      "copied gender requires a select choice",
    );
    expect(constraints["grant.property.reserved_types"]).toContain(
      "copied age requires an integer choice",
    );
    expect(constraints["grant.property.entry_scope"]).toContain(
      "only engine identity continuity",
    );
  });
});
