#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import prettier from "prettier";
import { repositoryRoot } from "./workspace-lib.mjs";
import { writeFileSync } from "node:fs";
import { renderFormat1BrowserReference } from "./render-format1-browser-reference.mjs";

const root = repositoryRoot();
const schema = JSON.parse(
  readFileSync(join(root, "schema", "format-1.json"), "utf8"),
);
const markdownPath = join(
  root,
  ".agents",
  "jumpify",
  "references",
  "format-1-authoring.md",
);
const guidePath = join(
  root,
  "documentation",
  "guides",
  "format-1-author-guide.html",
);
const browserReferencePath = join(
  root,
  "documentation",
  "guides",
  "format-1-reference.html",
);
const check = process.argv.includes("--check");
const startMarker = "<!-- BEGIN GENERATED FORMAT 1 REFERENCE -->";
const endMarker = "<!-- END GENERATED FORMAT 1 REFERENCE -->";
const browserStartMarker =
  "<!-- BEGIN GENERATED FORMAT 1 BROWSER REFERENCE -->";
const browserEndMarker = "<!-- END GENERATED FORMAT 1 BROWSER REFERENCE -->";

const text = (value) => {
  if (value === undefined) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  return JSON.stringify(value);
};
const md = (value) => text(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const html = (value) =>
  text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function resolvedFields(fields) {
  if (typeof fields === "string") return schema.fieldSets[fields] ?? {};
  return fields ?? {};
}

function effectiveFields(definition) {
  if (definition.fields) return resolvedFields(definition.fields);
  if (definition.fieldSet) return resolvedFields(definition.fieldSet);
  return {};
}

function fieldRows(fields) {
  return Object.entries(fields).map(([name, rule]) => [
    name,
    rule.type ?? "—",
    rule.required ? "required" : rule.repeatable ? "repeatable" : "optional",
    rule.default ??
      rule.defaultForCompanionSelection ??
      rule.defaultForIntegerVisibleGrant ??
      "—",
    Object.fromEntries(
      Object.entries(rule).filter(
        ([key]) =>
          ![
            "type",
            "required",
            "repeatable",
            "default",
            "defaultForCompanionSelection",
            "defaultForIntegerVisibleGrant",
            "min",
            "max",
          ].includes(key),
      ),
    ),
  ]);
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(md).join(" | ")} |`),
  ].join("\n");
}

function htmlTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((header) => `<th scope="col">${html(header)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) =>
            index === 0
              ? `<th scope="row"><code>${html(cell)}</code></th>`
              : `<td>${html(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function declarationSections(format) {
  const blocks = [];
  for (const [name, definition] of Object.entries(schema.declarations)) {
    const forms = definition.formsByContext
      ? Object.entries(definition.formsByContext)
      : [["all declared contexts", definition]];
    const body = [];
    body.push(
      format === "md"
        ? `Contexts: ${md(definition.contexts?.join(", ") ?? "context-specific")}`
        : `<p><strong>Contexts:</strong> ${html(definition.contexts?.join(", ") ?? "context-specific")}</p>`,
    );
    const declarationRules = Object.fromEntries(
      Object.entries(definition).filter(
        ([key]) =>
          ![
            "contexts",
            "fields",
            "fieldSet",
            "children",
            "formsByContext",
          ].includes(key),
      ),
    );
    if (definition.fieldSet) declarationRules.fieldSet = definition.fieldSet;
    if (Object.keys(declarationRules).length)
      body.push(
        format === "md"
          ? `Rules: ${md(declarationRules)}`
          : `<p><strong>Rules:</strong> ${html(declarationRules)}</p>`,
      );
    for (const [context, form] of forms) {
      const fields = effectiveFields(form);
      if (definition.formsByContext)
        body.push(
          format === "md" ? `#### ${context}` : `<h4>${html(context)}</h4>`,
        );
      if (Object.keys(fields).length)
        body.push(
          format === "md"
            ? markdownTable(
                ["Field", "Type", "Cardinality", "Default", "Rules"],
                fieldRows(fields),
              )
            : htmlTable(
                ["Field", "Type", "Cardinality", "Default", "Rules"],
                fieldRows(fields),
              ),
        );
      const children = form.children ?? definition.children ?? {};
      if (Object.keys(children).length)
        body.push(
          format === "md"
            ? `Children: ${Object.entries(children)
                .map(([child, rule]) => `\`${child}\` (${md(rule)})`)
                .join(", ")}`
            : `<p><strong>Children:</strong> ${Object.entries(children)
                .map(
                  ([child, rule]) =>
                    `<code>${html(child)}</code> (${html(rule)})`,
                )
                .join(", ")}</p>`,
        );
    }
    blocks.push(
      format === "md"
        ? `### \`${name}\`\n\n${body.join("\n\n")}`
        : `<section id="reference-declaration-${name}" data-schema-declaration="${name}"><h3><code>${name}</code></h3>${body.join("")}</section>`,
    );
  }
  return blocks.join(format === "md" ? "\n\n" : "");
}

function layoutSections(format) {
  return Object.entries(schema.layoutNodes)
    .map(([name, node]) => {
      const fields = {
        ...resolvedFields(node.fields),
        ...resolvedFields(node.blockFields),
        ...resolvedFields(node.additionalFields),
      };
      const parts = [];
      if (Object.keys(fields).length)
        parts.push(
          format === "md"
            ? markdownTable(
                ["Field", "Type", "Cardinality", "Default", "Rules"],
                fieldRows(fields),
              )
            : htmlTable(
                ["Field", "Type", "Cardinality", "Default", "Rules"],
                fieldRows(fields),
              ),
        );
      for (const [key, value] of Object.entries(node).filter(
        ([key]) =>
          !["kind", "fields", "blockFields", "additionalFields"].includes(key),
      ))
        parts.push(
          format === "md"
            ? `${key}: ${md(value)}`
            : `<p><strong>${html(key)}:</strong> ${html(value)}</p>`,
        );
      return format === "md"
        ? `### \`${name}\`\n\n${parts.join("\n\n")}`
        : `<section id="reference-layout-${name}" data-schema-layout-node="${name}"><h3><code>${name}</code></h3>${parts.join("")}</section>`;
    })
    .join(format === "md" ? "\n\n" : "");
}

const markdownSource = `# Format 1 authoring reference

Generated from \`schema/format-1.json\`. Do not edit this file by hand. Use it for exact field names, contexts, defaults, and limits; use the workflow references for conversion judgment.

## Contents

- Lexical and package rules
- Value types
- Declarations
- Shared layout field sets
- Layout nodes
- Layout roots
- Semantic constraints

## Lexical and package rules

${markdownTable(["Rule", "Value"], Object.entries(schema.lexical))}

${markdownTable(
  ["File", "Required", "Top-level declarations", "Counts"],
  Object.entries(schema.files).map(([name, rule]) => [
    name,
    rule.required ?? false,
    rule.topLevel,
    rule.counts ?? {},
  ]),
)}

Conditional fields: ${md(schema.conditionalFields)}

## Value types

${markdownTable(["Type", "Definition"], Object.entries(schema.types))}

## Declarations

${declarationSections("md")}

## Shared layout field sets

${Object.entries(schema.fieldSets)
  .map(
    ([name, fields]) =>
      `### \`${name}\`\n\n${markdownTable(["Field", "Type", "Cardinality", "Default", "Rules"], fieldRows(fields))}`,
  )
  .join("\n\n")}

## Layout nodes

${layoutSections("md")}

## Layout roots

${markdownTable(["Root", "Rules"], Object.entries(schema.roots))}

## Semantic constraints

${schema.semanticConstraints.map((constraint, index) => `${index + 1}. ${md(constraint)}`).join("\n")}
`;
const markdown = await prettier.format(markdownSource, { parser: "markdown" });

const generatedHtml = `${startMarker}
<section id="complete-syntax-reference" aria-labelledby="complete-syntax-reference-heading" data-toc-ignore>
  <h2 id="complete-syntax-reference-heading">Complete syntax reference</h2>
  <p>This reference is generated from the Format 1 schema. Cardinality and defaults shown here are authoritative.</p>
  <h3 id="reference-types">Value types</h3>
  ${htmlTable(["Type", "Definition"], Object.entries(schema.types))}
  <h3 id="reference-declarations">Declarations</h3>
  ${declarationSections("html")}
  <h3 id="reference-layout-field-sets">Shared layout fields</h3>
  ${Object.entries(schema.fieldSets)
    .map(
      ([name, fields]) =>
        `<section id="reference-field-set-${name}" data-schema-field-set="${name}"><h4><code>${name}</code></h4>${htmlTable(
          ["Field", "Type", "Cardinality", "Default", "Rules"],
          fieldRows(fields),
        )}</section>`,
    )
    .join("")}
  <h3 id="reference-layout-nodes">Layout nodes</h3>
  ${layoutSections("html")}
  <h3 id="reference-layout-roots">Layout roots</h3>
  ${htmlTable(["Root", "Rules"], Object.entries(schema.roots))}
  <h3 id="reference-semantic-constraints">Semantic constraints</h3>
  <ol>${schema.semanticConstraints.map((constraint) => `<li>${html(constraint)}</li>`).join("")}</ol>
</section>
${endMarker}`;

function updateGeneratedBlock(source, startToken, endToken, generated, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken);
  if (start < 0 || end < start)
    throw new Error(`${label} is missing generated reference markers.`);
  return `${source.slice(0, start)}${generated}${source.slice(end + endToken.length)}`;
}

const guideSource = existsSync(guidePath)
  ? readFileSync(guidePath, "utf8")
  : "";
const expectedGuide = guideSource
  ? await prettier.format(
      updateGeneratedBlock(
        guideSource,
        startMarker,
        endMarker,
        generatedHtml,
        "Author guide",
      ),
      { parser: "html" },
    )
  : guideSource;
const browserReferenceSource = existsSync(browserReferencePath)
  ? readFileSync(browserReferencePath, "utf8")
  : "";
const generatedBrowserReference = `${browserStartMarker}
${renderFormat1BrowserReference(schema)}
${browserEndMarker}`;
const expectedBrowserReference = browserReferenceSource
  ? await prettier.format(
      updateGeneratedBlock(
        browserReferenceSource,
        browserStartMarker,
        browserEndMarker,
        generatedBrowserReference,
        "Browser reference",
      ),
      { parser: "html" },
    )
  : browserReferenceSource;
if (check) {
  const currentMarkdown = existsSync(markdownPath)
    ? readFileSync(markdownPath, "utf8")
    : "";
  if (
    currentMarkdown !== markdown ||
    guideSource !== expectedGuide ||
    browserReferenceSource !== expectedBrowserReference
  ) {
    console.error(
      "Generated Format 1 references are stale. Run generate-format1-reference.mjs.",
    );
    process.exit(1);
  }
  console.log("Generated Format 1 references are current.");
} else {
  writeFileSync(markdownPath, markdown);
  if (guideSource) writeFileSync(guidePath, expectedGuide);
  if (browserReferenceSource)
    writeFileSync(browserReferencePath, expectedBrowserReference);
  console.log(markdownPath);
  if (guideSource) console.log(guidePath);
  if (browserReferenceSource) console.log(browserReferencePath);
}
