export function insertJumpAppearanceSource(source: string) {
  const leading = /^(?:(?:#[^\n]*)?\n)*/.exec(source)?.[0] ?? "";
  const remainder = source.slice(leading.length);
  return `${leading}jump-appearance\n${remainder.trim() ? "\n" : ""}${remainder}`;
}
