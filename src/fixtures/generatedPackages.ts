import { canonicalizePackage, packageIsValid } from "../markup";
import type { CanonicalJumpPackage, PackageSources } from "../markup";
import { sha256 } from "../markup/sha256";

const rawFiles = import.meta.glob<string>("./jumps/*/*.jdef", {
  eager: true,
  query: "?raw",
  import: "default",
});

const metadata: Readonly<
  Record<
    string,
    { description: string; source: "builtin" | "imported"; logicalId?: string }
  >
> = {
  "first-step": {
    description: "Begin a chain with dependable foundations.",
    source: "builtin",
  },
  "arcane-realms": {
    description: "Build a life amid spellcraft and ancient kingdoms.",
    source: "imported",
  },
  "cosmic-odyssey": {
    description: "Explore distant systems and stellar mysteries.",
    source: "imported",
  },
  "shadow-court": {
    description: "Navigate immortal intrigue beneath a moonless sky.",
    source: "imported",
  },
  "spirit-road": {
    description: "Walk between shrines, memories, and restless worlds.",
    source: "builtin",
  },
  "clockwork-sea": {
    description: "Sail mechanical oceans aboard an impossible vessel.",
    source: "imported",
  },
  "war-of-crowns": {
    description: "Shape a continent-wide struggle for succession.",
    source: "imported",
  },
  "last-horizon": {
    description: "Cross the boundary at the end of mapped reality.",
    source: "builtin",
  },
  "arcane-realms-v1-1": {
    logicalId: "arcane-realms",
    description: "A separately installed revision of Arcane Realms.",
    source: "imported",
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
      const completeSource = Object.entries(files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([file, source]) => `${file}\0${source}`)
        .join("\0");
      return {
        id,
        logicalId: details?.logicalId ?? id,
        source: details?.source ?? (id.length % 2 ? "builtin" : "imported"),
        description:
          details?.description ??
          "A generated Format 1 package with complete choices and provenance.",
        exactHash: sha256(completeSource),
        files,
      };
    });
}

export const generatedJumpPackages: readonly CanonicalJumpPackage[] =
  packageSources().map(canonicalizePackage);

export const validGeneratedJumpPackages =
  generatedJumpPackages.filter(packageIsValid);

export const generatedPackageById: Readonly<
  Record<string, CanonicalJumpPackage>
> = Object.fromEntries(
  validGeneratedJumpPackages.map((item) => [item.id, item]),
);
