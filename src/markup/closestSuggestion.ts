export function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let column = 1; column <= right.length; column += 1) {
    let previous = rows[0];
    rows[0] = column;
    for (let row = 1; row <= left.length; row += 1) {
      const current = rows[row];
      rows[row] = Math.min(
        rows[row] + 1,
        rows[row - 1] + 1,
        previous + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return rows[left.length];
}

export function closestSuggestion(
  value: string,
  candidates: readonly string[],
) {
  const ranked = candidates
    .map((candidate) => [candidate, editDistance(value, candidate)] as const)
    .sort((left, right) => left[1] - right[1]);
  const selected = ranked[0];
  return selected && selected[1] <= Math.max(2, Math.floor(value.length / 3))
    ? selected[0]
    : undefined;
}
