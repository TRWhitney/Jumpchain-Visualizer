import format1Schema from "../../schema/format-1.json";

export type FieldRule = {
  type?: string;
  values?: readonly string[];
  min?: number;
  max?: number;
  minimum?: number;
  maximum?: number;
  required?: boolean;
  repeatable?: boolean;
  const?: string | number | boolean;
  default?: string | number | boolean;
  conditionalVariants?: boolean;
  exactDuplicate?: string;
  exclusiveWith?: readonly string[];
};

export type DeclarationRule = {
  contexts?: readonly string[];
  fields?: Record<string, FieldRule>;
  children?: Record<
    string,
    {
      min?: number;
      max?: number;
      repeatable?: boolean;
      ownerLocalHandleNamespace?: string;
      appliesWhen?: Readonly<Record<string, readonly string[]>>;
    }
  >;
  fieldSet?: string;
  forms?: {
    scalar?: FieldRule;
    block?: {
      fields?: Record<string, FieldRule>;
      children?: DeclarationRule["children"];
    };
  };
  formsByContext?: Record<
    string,
    {
      fields?: Record<string, FieldRule>;
      children?: DeclarationRule["children"];
    }
  >;
};

export type ChildRule = NonNullable<DeclarationRule["children"]>[string];

type Format1Schema = {
  lexical: { handlePattern: string; integerPattern: string };
  files: Record<string, { topLevel: readonly string[] }>;
  types: Record<
    string,
    {
      enum?: readonly (string | boolean)[];
      oneOf?: readonly string[];
      builtInTokens?: readonly string[];
      costTokens?: readonly string[];
      awardTokens?: readonly string[];
      grantTokens?: readonly string[];
    }
  >;
  conditionalFields: { allowed: readonly string[] };
  declarations: Record<string, DeclarationRule>;
  fieldSets: Record<string, Record<string, FieldRule>>;
  layoutNodes: Record<
    string,
    {
      kind: string;
      fields?: string | Record<string, FieldRule>;
      blockFields?: string;
      additionalFields?: Record<string, FieldRule>;
      compact?: string;
      compactOnly?: boolean;
      children?: string | false;
      allowedLayouts?: readonly string[];
      targetNamespace?: string;
      targetsByLayout?: Record<string, readonly string[]>;
    }
  >;
  roots: Record<
    string,
    {
      exactlyOne?: boolean;
      allowed?: readonly string[];
      descendants?: readonly string[];
    }
  >;
};

export const format1SchemaDefinition =
  format1Schema as unknown as Format1Schema;
export const format1HandlePattern = new RegExp(
  format1SchemaDefinition.lexical.handlePattern,
);
export const format1IntegerPattern = new RegExp(
  format1SchemaDefinition.lexical.integerPattern,
);
