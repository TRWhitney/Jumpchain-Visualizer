import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname);
const coreModules = new Set([
  "archive",
  "domain",
  "markup",
  "platform",
  "renderer",
  "ui",
]);
const featureModules = new Set([
  "editor",
  "settings",
  "supplements",
  "tour",
  "tracker",
]);
const integrationAdapters = new Set([
  "supplements/TrackerSupplements.tsx",
  "tracker/JumpRenderer.tsx",
]);

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
}

function resolveImport(importer: string, specifier: string) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return candidates.find(existsSync) ?? null;
}

function moduleName(path: string) {
  return relative(sourceRoot, path).split(sep)[0];
}

describe("module boundaries", () => {
  it("keeps feature presentation behind feature entry points and app composition", () => {
    const violations: string[] = [];
    for (const importer of sourceFiles(sourceRoot)) {
      const importerModule = moduleName(importer);
      const source = readFileSync(importer, "utf8");
      for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const target = resolveImport(importer, match[1]);
        if (!target) continue;
        const targetModule = moduleName(target);
        const targetRelative = normalize(relative(sourceRoot, target))
          .split(sep)
          .join("/");
        const importsFeatureImplementation = featureModules.has(targetModule);
        const importsFeaturePresentation =
          importsFeatureImplementation && extname(target) === ".tsx";
        const crossesFeatureBoundary =
          featureModules.has(importerModule) &&
          importsFeaturePresentation &&
          importerModule !== targetModule;
        const coreImportsFeatureImplementation =
          coreModules.has(importerModule) && importsFeatureImplementation;
        const featureImportsCompositionRoot =
          featureModules.has(importerModule) && targetModule === "app";
        if (
          (crossesFeatureBoundary ||
            coreImportsFeatureImplementation ||
            featureImportsCompositionRoot) &&
          !integrationAdapters.has(targetRelative)
        )
          violations.push(
            `${relative(sourceRoot, importer)} -> ${targetRelative}`,
          );
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps application composition out of shared and feature modules", () => {
    const violations = sourceFiles(sourceRoot)
      .filter(
        (importer) =>
          moduleName(importer) !== "app" &&
          relative(sourceRoot, importer) !== "main.tsx",
      )
      .flatMap((importer) => {
        const source = readFileSync(importer, "utf8");
        return [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].flatMap(
          (match) => {
            const target = resolveImport(importer, match[1]);
            return target && moduleName(target) === "app"
              ? [
                  `${relative(sourceRoot, importer)} -> ${relative(sourceRoot, target)}`,
                ]
              : [];
          },
        );
      });
    expect(violations).toEqual([]);
  });
});
