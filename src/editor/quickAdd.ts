export type QuickAddMnemonic = {
  label: string;
  key: string | null;
  index: number;
};

export function assignQuickAddMnemonics(
  labels: readonly string[],
  reserved: readonly string[] = [],
): QuickAddMnemonic[] {
  const used = new Set(reserved.map((key) => key.toLocaleLowerCase()));
  return labels.map((label) => {
    let index = -1;
    for (let candidate = 0; candidate < label.length; candidate += 1) {
      const key = label[candidate].toLocaleLowerCase();
      if (!/[a-z]/.test(key) || used.has(key)) continue;
      index = candidate;
      used.add(key);
      break;
    }
    return {
      label,
      key: index < 0 ? null : label[index].toLocaleLowerCase(),
      index,
    };
  });
}
