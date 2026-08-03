const textSlotTargets = new Set(["name", "cost"]);
const controlSlotTargets = new Set(["control", "roll"]);

export function layoutNodeSupportsTextStyling(kind: string, target?: string) {
  if (["stack", "inline", "wrap", "grid"].includes(kind)) return true;
  if (kind === "slot") return textSlotTargets.has(target ?? "");
  return kind === "text" || kind === "input";
}

export function layoutNodeUsesControlAlignment(kind: string, target?: string) {
  return kind === "slot" && controlSlotTargets.has(target ?? "");
}
