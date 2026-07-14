export type DropEdge = "before" | "after";

export function dropEdgeAtPointer(
  clientY: number,
  bounds: Pick<DOMRect, "top" | "height">,
): DropEdge {
  return clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

export function dropIndexForTarget(
  fromIndex: number,
  targetIndex: number,
  edge: DropEdge,
  displayOrder: "forward" | "reverse",
) {
  const targetAfterRemoval = targetIndex - Number(fromIndex < targetIndex);
  const insertsBeforeTarget =
    displayOrder === "forward" ? edge === "before" : edge === "after";
  return targetAfterRemoval + Number(!insertsBeforeTarget);
}
