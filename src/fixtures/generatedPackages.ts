import { canonicalizePackage, packageIsValid } from "../markup";
import type { CanonicalJumpPackage, PackageSources } from "../markup";
import { exactHashForSourceFiles } from "../markup/packageSources";

const rawFiles = import.meta.glob<string>("./jumps/*/*.jdef", {
  eager: true,
  query: "?raw",
  import: "default",
});

const metadata: Readonly<
  Record<string, { source: "mock"; logicalId?: string }>
> = {
  "threshold-roads": {
    source: "mock",
  },
  "confluence-engine": {
    source: "mock",
  },
  "last-trial": {
    source: "mock",
  },
};

function packageSources() {
  const grouped = new Map<string, Record<string, string>>();
  for (const [path, source] of Object.entries(rawFiles)) {
    const match = path.match(/\/jumps\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const files = grouped.get(match[1]) ?? {};
    files[match[2]] = source;
    grouped.set(match[1], files);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, files]): PackageSources => {
      const details = metadata[id];
      return {
        id,
        logicalId: details?.logicalId ?? id,
        source: details?.source ?? (id.length % 2 ? "builtin" : "imported"),
        exactHash: exactHashForSourceFiles(files),
        files,
      };
    });
}

export const generatedJumpPackages: readonly CanonicalJumpPackage[] =
  packageSources().map((sources) => canonicalizePackage(sources));

export const validGeneratedJumpPackages =
  generatedJumpPackages.filter(packageIsValid);

export const generatedPackageById: Readonly<
  Record<string, CanonicalJumpPackage>
> = Object.fromEntries(
  validGeneratedJumpPackages.map((item) => [item.id, item]),
);
