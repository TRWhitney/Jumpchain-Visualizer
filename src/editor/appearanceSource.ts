export function insertJumpAppearanceSource(source: string) {
  const leading = /^(?:(?:#[^\n]*)?\n)*/.exec(source)?.[0] ?? "";
  return `${leading}jump-appearance\n${source.slice(leading.length)}`;
}
