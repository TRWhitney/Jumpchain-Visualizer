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

describe("localization source audit", () => {
  it("keeps literal user-interface copy out of production JSX", () => {
    const findings: string[] = [];
    for (const file of productionTsxFiles(SOURCE_ROOT)) {
      const sourceText = fs.readFileSync(file, "utf8");
      const source = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node) => {
        let literal: ts.StringLiteral | ts.JsxText | undefined;
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
        if (literal) {
          const value = literal.getText().replaceAll(/\s+/g, " ").trim();
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
    }
    expect(findings).toEqual([]);
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
