import type { CanonicalJumpPackage, LayoutNode, Presentation } from "../markup";

function stripPresentationColors(presentation: Presentation): Presentation {
  const stripped = { ...presentation };
  delete stripped.background;
  delete stripped.textColor;
  delete stripped.color;
  return stripped;
}

function stripNodeColors(node: LayoutNode): LayoutNode {
  return {
    ...node,
    presentation: stripPresentationColors(node.presentation),
    children: node.children.map(stripNodeColors),
  };
}

export function stripPreviewColors(
  packageItem: CanonicalJumpPackage,
): CanonicalJumpPackage {
  return {
    ...packageItem,
    layouts: packageItem.layouts.map((layout) => ({
      ...layout,
      root: stripNodeColors(layout.root),
    })),
    themes: {},
  };
}
