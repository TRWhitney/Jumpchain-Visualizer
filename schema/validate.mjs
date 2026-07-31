import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const load = async (name) => JSON.parse(await readFile(join(root, name), "utf8"));
const schema = await load("format-1.json");
const conformance = await load("conformance.json");
const errors = [];

const requireReference = (collection, name, context) => {
  if (!collection[name]) errors.push(`${context} references unknown ${name}`);
};

if (schema.format !== 1 || schema.schemaVersion !== 1) errors.push("format-1.json must declare format and schemaVersion 1");
if (conformance.format !== schema.format) errors.push("conformance format does not match schema format");

for (const [file, definition] of Object.entries(schema.files)) {
  for (const declaration of definition.topLevel) requireReference(schema.declarations, declaration, `files.${file}.topLevel`);
}

for (const [name, declaration] of Object.entries(schema.declarations)) {
  if (declaration.fieldSet) requireReference(schema.fieldSets, declaration.fieldSet, `declarations.${name}.fieldSet`);
  if (declaration.root) requireReference(schema.roots, declaration.root, `declarations.${name}.root`);
}

const choice = schema.declarations.choice;
if (!choice?.formsByContext?.["top-level"]?.fields?.continuity)
  errors.push("format-1 choice must define top-level continuity");
if (!choice?.formsByContext?.section?.fields?.target)
  errors.push("format-1 choice must define its section association form");
if (choice?.formsByContext?.["top-level"]?.fields?.species)
  errors.push("format-1 choice.species must be replaced by property grants");
if (!schema.layoutNodes.choice?.blockFields)
  errors.push("format-1 section choice layout leaf must define block presentation fields");
if (
  JSON.stringify(schema.types.imageFit?.enum) !==
  JSON.stringify(["contain", "cover", "tile"])
)
  errors.push("format-1 image fit values must include contain, cover, and tile");
for (const fieldSet of [
  "containerPresentation",
  "contentLeafPresentation",
  "slotLeafPresentation",
  "imageLeafPresentation",
  "choiceLeafPresentation",
])
  if (
    !schema.fieldSets[fieldSet]?.["background-image"] ||
    !schema.fieldSets[fieldSet]?.["background-fit"]
  )
    errors.push(`${fieldSet} must define background image presentation`);
if (!choice?.formsByContext?.["top-level"]?.fields?.form)
  errors.push("format-1 choice shorthand must define form targeting");
if (!choice?.formsByContext?.["top-level"]?.fields?.measure)
  errors.push("format-1 choice shorthand must define grant measure semantics");
const grantFields = schema.declarations?.grant?.forms?.block?.fields;
const grantKinds = grantFields?.kind?.values ?? [];
if (!grantKinds.includes("form"))
  errors.push("format-1 grant kinds must include form");
if (!grantFields?.form || !grantFields?.measure)
  errors.push("format-1 grants must define form and measure fields");
const constraintCodes = new Set(
  schema.semanticConstraints.map((constraint) => constraint.code),
);
for (const code of [
  "grant.form.handle",
  "grant.form.reference",
  "grant.form.target_kind",
  "grant.form.shorthand",
  "grant.measure.integer_only",
  "grant.measure.shorthand",
])
  if (!constraintCodes.has(code))
    errors.push(`format-1 semantic constraints must include ${code}`);

for (const [name, node] of Object.entries(schema.layoutNodes)) {
  if (typeof node.fields === "string") requireReference(schema.fieldSets, node.fields, `layoutNodes.${name}.fields`);
  if (typeof node.blockFields === "string") requireReference(schema.fieldSets, node.blockFields, `layoutNodes.${name}.blockFields`);
}

for (const [name, definition] of Object.entries(schema.roots)) {
  for (const node of [...definition.allowed, ...definition.descendants]) {
    requireReference(schema.layoutNodes, node, `roots.${name}`);
  }
}

for (const fixture of conformance.cases) {
  const fixtureRoot = join(root, fixture.directory);
  try {
    if (!(await stat(fixtureRoot)).isDirectory()) errors.push(`${fixture.name} fixture is not a directory`);
    const files = await readdir(fixtureRoot);
    if (!files.includes("jump.jdef")) errors.push(`${fixture.name} fixture lacks jump.jdef`);
    const source = await readFile(join(fixtureRoot, "jump.jdef"), "utf8");
    if (!/^jump\n/m.test(source) || !/^  format: 1$/m.test(source)) errors.push(`${fixture.name} fixture does not declare format 1`);
  } catch (error) {
    errors.push(`${fixture.name} fixture cannot be read: ${error.message}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated format ${schema.format}: ${Object.keys(schema.declarations).length} declarations, ${Object.keys(schema.layoutNodes).length} layout nodes, ${conformance.cases.length} fixture cases.`);
}
