import { sha256 } from "./sha256";

export function exactHashForSourceFiles(
  files: Readonly<Record<string, string>>,
) {
  return sha256(
    Object.entries(files)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, source]) => `${file}\0${source}`)
      .join("\0"),
  );
}
