import type { ChoiceSource } from "../markup";

export function sourceOptionGroupName(
  entryId: string,
  actorId: string,
  source: Pick<ChoiceSource, "group" | "handle">,
) {
  return `${entryId}:${actorId}:${source.group ?? source.handle}`;
}
