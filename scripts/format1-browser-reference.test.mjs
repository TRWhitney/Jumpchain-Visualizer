import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const repository = process.cwd();
const schema = JSON.parse(
  readFileSync(join(repository, "schema", "format-1.json"), "utf8"),
);
const reference = readFileSync(
  join(repository, "documentation", "guides", "format-1-reference.html"),
  "utf8",
);

const resolveFields = (value) =>
  typeof value === "string" ? (schema.fieldSets[value] ?? {}) : (value ?? {});

test("browser reference indexes every Format 1 declaration, field, layout node, and type", () => {
  for (const declaration of Object.keys(schema.declarations))
    assert.match(reference, new RegExp(`id="declaration-${declaration}"`));

  const fields = new Set();
  for (const definition of Object.values(schema.declarations)) {
    Object.keys(
      resolveFields(definition.fields ?? definition.fieldSet),
    ).forEach((field) => fields.add(field));
    for (const form of Object.values(definition.formsByContext ?? {}))
      Object.keys(resolveFields(form.fields ?? form.fieldSet)).forEach(
        (field) => fields.add(field),
      );
    for (const form of Object.values(definition.forms ?? {}))
      Object.keys(resolveFields(form.fields ?? form.fieldSet)).forEach(
        (field) => fields.add(field),
      );
  }
  for (const node of Object.values(schema.layoutNodes))
    for (const source of [node.fields, node.blockFields, node.additionalFields])
      Object.keys(resolveFields(source)).forEach((field) => fields.add(field));

  for (const field of fields)
    assert.match(reference, new RegExp(`id="field-${field}"`));
  for (const node of Object.keys(schema.layoutNodes))
    assert.match(reference, new RegExp(`id="layout-${node}"`));
  for (const type of Object.keys(schema.types))
    assert.match(reference, new RegExp(`id="type-${type}"`));

  assert.match(reference, /id="special-description"/);
  assert.match(reference, /id="special-identity-properties"/);
  assert.match(reference, /id="special-choice-contexts"/);
  assert.match(reference, /id="special-scalar-block"/);
  assert.doesNotMatch(reference, />undefined</);
});

test("browser reference exposes schema-driven lexical pattern testers", () => {
  for (const key of ["handlePattern", "integerPattern", "hexColorPattern"]) {
    assert.match(
      reference,
      new RegExp(`data-lexical-key="${key}"`),
      `${key} should have an interactive tester`,
    );
    assert.ok(
      reference.includes(`data-lexical-pattern="${schema.lexical[key]}"`),
      `${key} should use the schema's pattern`,
    );
  }
  assert.equal(reference.match(/data-lexical-tester(?:\s|>)/g)?.length, 3);
});

test("browser reference exposes declaration builders for every declaration", () => {
  for (const declaration of Object.keys(schema.declarations))
    assert.match(
      reference,
      new RegExp(`id="declaration-builder-${declaration}"`),
      `${declaration} should have a declaration builder`,
    );

  assert.match(
    reference,
    /id="declaration-builder-section-layout"[\s\S]*?data-skeleton-root="stack"/,
  );
  assert.doesNotMatch(
    reference,
    /data-skeleton-(?:field-value|scalar)="undefined"/,
  );
});

test("browser reference exposes focused value checkers without claiming Tag presentation", () => {
  for (const type of [
    "tag",
    "textSize",
    "layoutDimension",
    "aspectRatio",
    "imageDimension",
    "costAmount",
    "grantAmount",
    "propertyValue",
  ])
    assert.match(
      reference,
      new RegExp(`id="value-tester-${type}"`),
      `${type} should have a value checker`,
    );

  assert.equal(reference.match(/data-value-tester(?:\s|>)/g)?.length, 8);
  assert.ok(
    reference
      .replace(/\s+/g, " ")
      .includes(
        "Canonicalization affects Tag identity only. The active User Tag profile owns all badge presentation.",
      ),
  );
});

test("browser reference sentence-cases lexical prose without changing literals", () => {
  for (const prose of [
    "Two spaces",
    "Error",
    "Full-line # comments only",
    "One field per physical line",
    "Insignificant except conditional variants",
  ])
    assert.ok(
      reference.includes(prose),
      `expected sentence-cased prose: ${prose}`,
    );

  for (const literal of [
    schema.lexical.encoding,
    schema.lexical.lineEnding,
    schema.lexical.handlePattern,
    schema.lexical.integerPattern,
    schema.lexical.hexColorPattern,
    schema.lexical.assetPathSeparator,
  ])
    assert.ok(reference.includes(`<code>${literal}</code>`));
});
