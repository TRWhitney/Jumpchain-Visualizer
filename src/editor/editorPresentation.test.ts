import format1Schema from "../../schema/format-1.json";
import english from "../localization/languages/English/editor.json";
import { describe, expect, it } from "vitest";
import {
  editorDeclarationLabel,
  editorFieldPresentation,
  editorLayoutFieldPresentation,
  editorLayoutNodePresentation,
  editorOptionPresentation,
} from "./editorPresentation";

type FieldDefinition = {
  values?: readonly (string | boolean)[];
  type?: string;
};

type FieldMap = Readonly<Record<string, FieldDefinition>>;

const schema = format1Schema as {
  declarations: Readonly<
    Record<
      string,
      {
        fields?: FieldMap;
        fieldSet?: string;
        forms?: { block?: { fields?: FieldMap } };
        formsByContext?: Readonly<Record<string, { fields?: FieldMap }>>;
      }
    >
  >;
  fieldSets: Readonly<Record<string, FieldMap>>;
  layoutNodes: Readonly<
    Record<
      string,
      {
        fields?: string | FieldMap;
        blockFields?: string;
        additionalFields?: FieldMap;
      }
    >
  >;
  types: Readonly<
    Record<
      string,
      {
        enum?: readonly (string | boolean)[];
        builtInTokens?: readonly string[];
        costTokens?: readonly string[];
        awardTokens?: readonly string[];
        grantTokens?: readonly string[];
      }
    >
  >;
};

const messages = english.ui.editorWorkspace;

const declarationFields = (definition: (typeof schema.declarations)[string]) =>
  [
    definition.fieldSet ? schema.fieldSets[definition.fieldSet] : undefined,
    definition.fields,
    definition.forms?.block?.fields,
    ...Object.values(definition.formsByContext ?? {}).map(
      (context) => context.fields,
    ),
  ].filter((fields): fields is FieldMap => Boolean(fields));

const layoutFields = (definition: (typeof schema.layoutNodes)[string]) =>
  [
    typeof definition.fields === "string"
      ? schema.fieldSets[definition.fields]
      : definition.fields,
    definition.blockFields
      ? schema.fieldSets[definition.blockFields]
      : undefined,
    definition.additionalFields,
  ].filter((fields): fields is FieldMap => Boolean(fields));

const valuesFor = (definition: FieldDefinition) => {
  const type = definition.type ? schema.types[definition.type] : undefined;
  return [
    ...(definition.values ?? []),
    ...(type?.enum ?? []),
    ...(type?.builtInTokens ?? []),
    ...(type?.costTokens ?? []),
    ...(type?.awardTokens ?? []),
    ...(type?.grantTokens ?? []),
  ].map(String);
};

describe("Editor field presentation catalog", () => {
  it("covers every Structured declaration and layout field", () => {
    for (const [kind, declaration] of Object.entries(schema.declarations)) {
      expect(editorDeclarationLabel(kind), kind).not.toBe(kind);
      for (const fields of declarationFields(declaration)) {
        for (const [field, definition] of Object.entries(fields)) {
          if (kind !== "jump-appearance")
            expect(
              editorFieldPresentation(kind, field).label,
              `${kind}.${field}`,
            ).not.toBe(field);
          for (const value of valuesFor(definition))
            expect(
              editorOptionPresentation(kind, field, value).label,
              `${kind}.${field}=${value}`,
            ).not.toBe(value);
        }
      }
    }

    for (const [kind, node] of Object.entries(schema.layoutNodes)) {
      expect(editorLayoutNodePresentation(kind).label, kind).not.toBe(kind);
      expect(editorLayoutNodePresentation(kind).description, kind).not.toMatch(
        /^ui\./,
      );
      for (const fields of layoutFields(node)) {
        for (const [field, definition] of Object.entries(fields)) {
          expect(editorLayoutFieldPresentation(field).label, field).not.toBe(
            field,
          );
          for (const value of valuesFor(definition))
            expect(
              editorOptionPresentation(kind, field, value).label,
              `${kind}.${field}=${value}`,
            ).not.toBe(value);
        }
      }
    }
  });

  it("requires explicit English labels for every displayed enum value", () => {
    const expected = new Set<string>();
    for (const declaration of Object.values(schema.declarations))
      for (const fields of declarationFields(declaration))
        for (const definition of Object.values(fields))
          valuesFor(definition).forEach((value) => expected.add(value));
    for (const node of Object.values(schema.layoutNodes))
      for (const fields of layoutFields(node))
        for (const definition of Object.values(fields))
          valuesFor(definition).forEach((value) => expected.add(value));

    expect(
      [...expected].filter((value) => !(value in messages.optionLabel)),
    ).toEqual([]);
  });

  it("keeps canonical stored values distinct from localized labels", () => {
    expect(editorOptionPresentation("input", "selection", "integer")).toEqual({
      value: "integer",
      label: "Integer",
      description:
        "Enter a whole number, optionally limited by minimum and maximum.",
    });
    expect(
      editorOptionPresentation("choice", "selection", "unknown-mode"),
    ).toEqual({
      value: "unknown-mode",
      label: "unknown-mode",
      description: "",
    });
  });
});
