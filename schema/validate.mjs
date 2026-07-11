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
