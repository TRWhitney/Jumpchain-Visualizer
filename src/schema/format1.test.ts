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
      blockFields: "choiceLeafPresentation",
      allowedLayouts: ["section-layout"],
      targetNamespace: "choice-placement",
    });
    expect(schemaJson.fieldSets.choiceLeafPresentation).toEqual({
      target: {
        type: "handleReference:choice-placement",
        min: 1,
        max: 1,
        required: true,
      },
      padding: { type: "spacing", min: 0, max: 1, default: "none" },
      background: {
        type: "color",
        min: 0,
        max: 1,
        exclusiveWith: ["background-image"],
      },
      "background-image": {
        type: "handleReference:owner-local-image",
        min: 0,
        max: 1,
        exclusiveWith: ["background"],
      },
      "background-fit": {
        type: "imageFit",
        min: 0,
        max: 1,
        default: "cover",
      },
      align: { type: "align", min: 0, max: 1 },
    });
  });

  it("shares image fitting and background-image presentation across eligible layout nodes", () => {
    expect(schemaJson.types.imageFit.enum).toEqual([
      "contain",
      "cover",
      "tile",
    ]);
    expect(schemaJson.layoutNodes.image.additionalFields.fit).toEqual({
      type: "imageFit",
    });
    for (const fieldSet of [
      "containerPresentation",
      "contentLeafPresentation",
      "slotLeafPresentation",
      "imageLeafPresentation",
      "choiceLeafPresentation",
    ] as const)
      expect(schemaJson.fieldSets[fieldSet]).toMatchObject({
        background: { exclusiveWith: ["background-image"] },
        "background-image": {
          type: "handleReference:owner-local-image",
          exclusiveWith: ["background"],
        },
        "background-fit": {
          type: "imageFit",
          default: "cover",
        },
      });
  });

  it("accepts continuity only on the top-level choice form", () => {
    const choice = schema.declarations.choice;
    expect(choice.formsByContext?.["top-level"].fields.continuity).toEqual({
      type: "enum",
      values: ["previous", "original"],
      min: 0,
      max: 1,
      appliesWhen: { selection: ["select"] },
    });
    expect(choice.formsByContext?.section.fields.continuity).toBeUndefined();
    expect(
      choice.formsByContext?.["top-level"].fields.species,
    ).toBeUndefined();
  });

  it("defines extensible, bounded presentation for horizontal rules", () => {
    expect(schema.layoutNodes.rule).toMatchObject({
      kind: "leaf",
      fields: {
        color: { type: "color", min: 0, max: 1 },
        thickness: {
          type: "integer",
          minimum: 1,
          maximum: 16,
          default: 1,
        },
        style: {
          type: "enum",
          values: ["solid", "dash", "rounded"],
          default: "solid",
        },
      },
      children: false,
    });
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

  it("amends Format 1 with form targeting and rank-or-quantity measures", () => {
    const fields = schemaJson.declarations.grant.forms.block.fields;
    expect(fields.kind).toMatchObject({
      values: expect.arrayContaining(["perk", "item", "form"]),
    });
    expect(fields).toMatchObject({
      form: { type: "handleReference:form", min: 0, max: 1 },
      measure: { type: "enum", values: ["rank", "quantity"], min: 0, max: 1 },
    });
    expect(schema.declarations.choice.formsByContext?.["top-level"].fields)
      .toMatchObject({
        form: { type: "handleReference:form", min: 0, max: 1 },
        measure: { type: "enum", values: ["rank", "quantity"], min: 0, max: 1 },
      });
    const codes = schema.semanticConstraints.map(({ code }) => code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "grant.form.handle",
        "grant.form.reference",
        "grant.form.target_kind",
        "grant.form.shorthand",
        "grant.measure.integer_only",
        "grant.measure.shorthand",
      ]),
    );
  });

  it("models ordinary Grant descriptions separately from trait layout content", () => {
    const grantChildren = schemaJson.declarations.grant.forms.block.children;
    expect(grantChildren.text).toMatchObject({
      ownerLocalHandleNamespace: "text",
      appliesWhen: {
        kind: ["perk", "item", "form", "companion", "trait"],
      },
    });
    expect(grantChildren.image).toMatchObject({
      ownerLocalHandleNamespace: "image",
      appliesWhen: { kind: ["trait"] },
    });
    expect(
      schemaJson.declarations.text.formsByContext["grant:perk"].fields.handle,
    ).toMatchObject({ const: "description" });
    expect(schemaJson.declarations.image.contexts).toEqual([
      "section",
      "choice",
      "grant:trait",
    ]);
  });
});
