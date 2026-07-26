import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const USER_FACING_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "description",
  "emptyLabel",
  "heading",
  "label",
  "message",
  "placeholder",
  "title",
]);
const USER_FACING_CALLBACK =
  /^(?:set|on|report).*(?:Error|Label|Message|Status|Title)$/;
const USER_FACING_STATE = /(?:error|label|message|status|title)$/i;

const productionTsxFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory())
      return entry.name === "localization" ? [] : productionTsxFiles(absolute);
    if (
      !entry.name.endsWith(".tsx") ||
      entry.name.includes(".test.") ||
      entry.name.includes(".browser.test.") ||
      entry.name.startsWith("Review")
    )
      return [];
    return [absolute];
  });

const hasTechnicalTextParent = (node: ts.Node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isJsxElement(parent)) continue;
    const tag = parent.openingElement.tagName.getText();
    if (tag === "code" || tag === "kbd") return true;
  }
  return false;
};

const hasTranslationCallParent = (node: ts.Node, boundary: ts.Node) => {
  for (
    let parent = node.parent;
    parent && parent !== boundary;
    parent = parent.parent
  ) {
    if (
      ts.isCallExpression(parent) &&
      ts.isIdentifier(parent.expression) &&
      ["translate", "translateDiagnostic", "translateError"].includes(
        parent.expression.text,
      )
    )
      return true;
  }
  return false;
};

const userFacingJsxBoundary = (node: ts.Node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxAttribute(parent))
      return USER_FACING_ATTRIBUTES.has(parent.name.getText()) ? parent : null;
    if (ts.isJsxExpression(parent)) {
      if (ts.isJsxAttribute(parent.parent))
        return USER_FACING_ATTRIBUTES.has(parent.parent.name.getText())
          ? parent
          : null;
      return parent;
    }
    if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent))
      return null;
  }
  return null;
};

const isDisplayedLiteral = (node: ts.Node, boundary: ts.Node) => {
  let current = node;
  while (current.parent && current.parent !== boundary) {
    const parent = current.parent;
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent) && current !== parent.condition) {
      current = parent;
      continue;
    }
    return false;
  }
  return current.parent === boundary;
};

const literalDisplayText = (node: ts.Node) => {
  if (ts.isTemplateExpression(node))
    return [
      node.head.text,
      ...node.templateSpans.map((span) => span.literal.text),
    ]
      .join(" ")
      .trim();
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isJsxText(node)
  )
    return node.text.trim();
  return node.getText().trim();
};

const isStableCodeLiteral = (node: ts.Node) =>
  (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
  /^[a-z][a-z0-9_-]*$/.test(node.text);

const indirectEditorDisplayBoundary = (node: ts.Node) => {
  const parent = node.parent;
  if (
    ts.isPropertyAssignment(parent) &&
    ts.isIdentifier(parent.name) &&
    USER_FACING_ATTRIBUTES.has(parent.name.text)
  )
    return parent;
  if (ts.isCallExpression(parent)) {
    if (
      ts.isIdentifier(parent.expression) &&
      USER_FACING_CALLBACK.test(parent.expression.text) &&
      parent.arguments.includes(node as ts.Expression)
    )
      return parent;
    if (
      ts.isIdentifier(parent.expression) &&
      parent.expression.text === "useState" &&
      parent.arguments[0] === node
    ) {
      const declaration = parent.parent;
      if (
        ts.isVariableDeclaration(declaration) &&
        ts.isArrayBindingPattern(declaration.name)
      ) {
        const firstStateBinding = declaration.name.elements[0];
        const stateName =
          firstStateBinding && ts.isBindingElement(firstStateBinding)
            ? firstStateBinding.name
            : null;
        if (stateName && USER_FACING_STATE.test(stateName.getText()))
          return parent;
      }
    }
  }
  return null;
};

const localizationFindings = (file: string, sourceText: string) => {
  const findings: string[] = [];
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node: ts.Node) => {
    let literal: ts.Node | undefined;
    if (
      ts.isJsxText(node) &&
      node.getText().trim() &&
      !hasTechnicalTextParent(node)
    )
      literal = node;
    if (
      ts.isJsxAttribute(node) &&
      USER_FACING_ATTRIBUTES.has(node.name.getText()) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    )
      literal = node.initializer;
    if (
      file.includes(`${path.sep}editor${path.sep}`) &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      !ts.isJsxAttribute(node.parent)
    ) {
      const boundary = userFacingJsxBoundary(node);
      const indirectBoundary = indirectEditorDisplayBoundary(node);
      if (
        ((boundary &&
          isDisplayedLiteral(node, boundary) &&
          !hasTechnicalTextParent(boundary)) ||
          indirectBoundary) &&
        !isStableCodeLiteral(node) &&
        !hasTranslationCallParent(node, boundary ?? indirectBoundary!)
      )
        literal = node;
    }
    if (literal) {
      const value = literalDisplayText(literal).replaceAll(/\s+/g, " ").trim();
      if (!/\p{L}{2,}/u.test(value)) {
        ts.forEachChild(node, visit);
        return;
      }
      const position = source.getLineAndCharacterOfPosition(
        literal.getStart(source),
      );
      findings.push(
        `${path.relative(process.cwd(), file)}:${position.line + 1} ${value}`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

describe("localization source audit", () => {
  it("keeps literal user-interface copy out of production JSX", () => {
    const findings = productionTsxFiles(SOURCE_ROOT).flatMap((file) =>
      localizationFindings(file, fs.readFileSync(file, "utf8")),
    );
    expect(findings).toEqual([]);
  });

  it("rejects hardcoded copy in indirect Editor UI sinks", () => {
    const file = path.join(SOURCE_ROOT, "editor", "IndirectExample.tsx");
    const findings = localizationFindings(
      file,
      `
        const [status] = useState("Ready to edit");
        setStatus("Preview updated");
        const item = { label: "Create a companion" };
        const code = { status: "saved" };
      `,
    );
    expect(findings).toEqual([
      "src/editor/IndirectExample.tsx:2 Ready to edit",
      "src/editor/IndirectExample.tsx:3 Preview updated",
      "src/editor/IndirectExample.tsx:4 Create a companion",
    ]);
  });

  it("keeps notification display copy behind stable message keys", () => {
    const logging = fs.readFileSync(
      path.join(SOURCE_ROOT, "settings", "logging.ts"),
      "utf8",
    );
    expect(logging).not.toMatch(/\bmessage\s*:\s*["'`]/);
    expect(logging).toContain("messageKey");
  });

  it("keeps package and UI failures behind codes and translation keys", () => {
    const archive = fs.readFileSync(
      path.join(SOURCE_ROOT, "archive", "JumpPackageImportService.ts"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.join(SOURCE_ROOT, "app", "AppShell.tsx"),
      "utf8",
    );
    expect(archive).not.toMatch(/fail\(\s*["'][^"']+["']\s*,\s*["'`]/);
    expect(shell).not.toMatch(/set(?:Editor|ChainSave)Error\(\s*["'`]/);
    expect(archive).toContain("readonly parameters:");
    expect(shell).toContain("translateError");
  });
});
