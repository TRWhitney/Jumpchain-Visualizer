import type { CSSProperties } from "react";
import type { CanonicalJumpPackage, LayoutNode } from "../markup";
import { format1BuiltInColors } from "../markup/format1Colors";

const layoutSpacing: Readonly<Record<string, string>> = {
  none: "0",
  xs: ".25rem",
  sm: ".5rem",
  md: ".75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
};

const layoutSizes: Readonly<Record<string, string>> = {
  xs: "2rem",
  sm: "3rem",
  md: "5rem",
  lg: "8rem",
  xl: "12rem",
  "2xl": "16rem",
};

const layoutTextSizes: Readonly<Record<string, string>> = {
  xs: ".58rem",
  sm: ".66rem",
  md: ".75rem",
  lg: ".9rem",
  xl: "1.1rem",
  "2xl": "1.35rem",
};

const alignments = new Set(["start", "center", "end", "stretch"]);
const justifications = new Set(["start", "center", "end", "between"]);
const textAlignments = new Set(["start", "center", "end", "justify"]);
const imageFits = new Set(["contain", "cover"]);

type PackageThemes = Pick<CanonicalJumpPackage, "themes">;

function layoutColor(token: string | undefined, packageItem: PackageThemes) {
  if (!token) return undefined;
  const candidate = packageItem.themes[token] ?? token;
  return /^#[0-9a-f]{6}$/i.test(candidate)
    ? candidate
    : format1BuiltInColors[candidate as keyof typeof format1BuiltInColors];
}

function sharedPresentationStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
): CSSProperties {
  const presentation = node.presentation;
  return {
    padding: layoutSpacing[presentation.padding ?? "none"],
    backgroundColor: layoutColor(presentation.background, packageItem),
    textAlign: textAlignments.has(presentation.textAlign ?? "")
      ? (presentation.textAlign as CSSProperties["textAlign"])
      : undefined,
    color: layoutColor(presentation.textColor, packageItem),
    fontSize: presentation.textSize
      ? layoutTextSizes[presentation.textSize]
      : undefined,
  };
}

export function layoutContainerPresentationStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
): CSSProperties {
  const presentation = node.presentation;
  const align = presentation.align ?? "stretch";
  const justify = presentation.justify ?? "start";
  const textSize = presentation.textSize ?? "md";
  return {
    ...sharedPresentationStyle(node, packageItem),
    gap: layoutSpacing[presentation.gap ?? "none"],
    alignItems: alignments.has(align)
      ? (align as CSSProperties["alignItems"])
      : undefined,
    justifyContent: justifications.has(justify)
      ? justify === "between"
        ? "space-between"
        : (justify as CSSProperties["justifyContent"])
      : undefined,
    textAlign: textAlignments.has(presentation.textAlign ?? "start")
      ? ((presentation.textAlign ?? "start") as CSSProperties["textAlign"])
      : undefined,
    fontSize: layoutTextSizes[textSize],
    gridTemplateColumns:
      presentation.columns &&
      presentation.columns >= 1 &&
      presentation.columns <= 12
        ? `repeat(${presentation.columns}, minmax(0, 1fr))`
        : undefined,
  };
}

export function layoutLeafPresentationStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
  parentKind?: LayoutNode["kind"],
): CSSProperties {
  const align = node.presentation.align;
  const positionedAlign =
    align && alignments.has(align)
      ? (align as CSSProperties["alignSelf"])
      : undefined;
  return {
    ...sharedPresentationStyle(node, packageItem),
    alignSelf: parentKind === "stack" ? positionedAlign : undefined,
    justifySelf: parentKind === "grid" ? positionedAlign : undefined,
  };
}

export function layoutInlineChildAreaStyle(node: LayoutNode): CSSProperties {
  const isContainer = ["stack", "inline", "wrap", "grid"].includes(node.kind);
  const align = isContainer ? "stretch" : node.presentation.align;
  const reservesTextArea =
    ["text", "slot", "input"].includes(node.kind) &&
    align !== "stretch" &&
    Boolean(align || node.presentation.textAlign);
  const reservesIntrinsicImageArea =
    node.kind === "image" &&
    align !== "stretch" &&
    !node.presentation.size &&
    !node.presentation.width &&
    !node.presentation.height;
  const reservesInlineArea = reservesTextArea || reservesIntrinsicImageArea;
  return {
    justifyContent: align === "stretch" ? "stretch" : "flex-start",
    marginInlineStart:
      align === "center" || align === "end" ? "auto" : undefined,
    marginInlineEnd: align === "center" ? "auto" : undefined,
    inlineSize: reservesInlineArea ? "min(20rem, 100%)" : undefined,
    maxInlineSize: reservesInlineArea ? "100%" : undefined,
  };
}

export function layoutImageStyle(node: LayoutNode): CSSProperties {
  const presentation = node.presentation;
  const shorthand = presentation.size
    ? layoutSizes[presentation.size]
    : undefined;
  const width = shorthand ?? layoutSizes[presentation.width ?? ""];
  const height = shorthand ?? layoutSizes[presentation.height ?? ""];
  return {
    width: width || !height ? "100%" : "auto",
    height: height ? "100%" : "auto",
    objectFit:
      presentation.fit && imageFits.has(presentation.fit)
        ? (presentation.fit as CSSProperties["objectFit"])
        : undefined,
  };
}

export function layoutImageBoundaryStyle(node: LayoutNode): CSSProperties {
  const presentation = node.presentation;
  const shorthand = presentation.size
    ? layoutSizes[presentation.size]
    : undefined;
  const width = shorthand ?? layoutSizes[presentation.width ?? ""];
  const height = shorthand ?? layoutSizes[presentation.height ?? ""];
  const isPositioned = presentation.align && presentation.align !== "stretch";
  return {
    width:
      width ??
      (height ? undefined : isPositioned ? "min(100%, 20rem)" : "100%"),
    height,
  };
}

export function layoutRuleStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
): CSSProperties {
  const thickness = node.presentation.thickness ?? 1;
  const style = node.presentation.style ?? "solid";
  const lineSize =
    Number.isInteger(thickness) && thickness >= 1 && thickness <= 16
      ? `${thickness}px`
      : undefined;
  const color = layoutColor(node.presentation.color, packageItem);
  if (style === "rounded")
    return {
      width: "100%",
      height: lineSize,
      margin: 0,
      backgroundColor: color ?? "currentColor",
      border: 0,
      borderStyle: "none",
      borderRadius: "9999px",
    };
  return {
    width: "100%",
    margin: 0,
    border: 0,
    borderTopColor: color,
    borderTopWidth: lineSize,
    borderTopStyle:
      style === "dash" ? "dashed" : style === "solid" ? "solid" : undefined,
  };
}
