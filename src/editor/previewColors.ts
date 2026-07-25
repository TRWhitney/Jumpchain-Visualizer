import type { CanonicalJumpPackage, LayoutNode, Presentation } from "../markup";

function stripPresentationColors(presentation: Presentation): Presentation {
  const stripped = { ...presentation };
  delete stripped.background;
  delete stripped.textColor;
  delete stripped.color;
  delete stripped.borderColor;
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
    appearance: Object.fromEntries(
      Object.entries(packageItem.appearance ?? {}).filter(
        ([field]) =>
          !field.includes("color") &&
          !field.endsWith("-background") &&
          !field.endsWith("-text") &&
          !field.endsWith("-border") &&
          !field.endsWith("-label") &&
          !field.endsWith("-title") &&
          !field.endsWith("-description") &&
          !field.endsWith("-heading") &&
          !field.endsWith("-body") &&
          !field.endsWith("-value") &&
          !field.endsWith("-indicator") &&
          !field.endsWith("-accent") &&
          field !== "background",
      ),
    ),
    layouts: packageItem.layouts.map((layout) => ({
      ...layout,
      root: stripNodeColors(layout.root),
    })),
    themes: {},
  };
}
