import type { CSSProperties } from "react";
import type { CanonicalJumpPackage, LayoutNode } from "../markup";
import { format1BuiltInColors } from "../markup/format1Colors";
import {
  layoutNodeSupportsTextStyling,
  layoutNodeUsesControlAlignment,
} from "../markup/layoutSemantics";

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
  sm: "4rem",
  md: "8rem",
  lg: "16rem",
  xl: "32rem",
  "2xl": "64rem",
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
const borderWidths: Readonly<Record<string, string>> = {
  none: "0",
  thin: "1px",
  medium: "2px",
  thick: "4px",
};
const borderRadii: Readonly<Record<string, string>> = {
  none: "0",
  sm: ".25rem",
  md: ".4rem",
  lg: ".7rem",
  pill: "9999px",
};
const borderStyles = new Set(["solid", "dashed", "dotted"]);

type PackageThemes = Pick<CanonicalJumpPackage, "themes">;
type SharedPresentationStyle = CSSProperties & {
  "--jump-layout-background-color"?: string;
};

function layoutColor(token: string | undefined, packageItem: PackageThemes) {
  if (!token) return undefined;
  const candidate = packageItem.themes[token] ?? token;
  return /^#[0-9a-f]{6}$/i.test(candidate)
    ? candidate
    : format1BuiltInColors[candidate as keyof typeof format1BuiltInColors];
}

function cssImage(source: string) {
  return `url(${JSON.stringify(source)})`;
}

function layoutBackgroundColorStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
): SharedPresentationStyle {
  const backgroundColor = layoutColor(
    node.presentation.background,
    packageItem,
  );
  return {
    backgroundColor,
    "--jump-layout-background-color": backgroundColor,
  };
}

export function layoutBackgroundImageStyle(
  node: LayoutNode,
  source: string | null | undefined,
): CSSProperties {
  if (!source) return {};
  const fit = node.presentation.backgroundFit ?? "cover";
  return {
    backgroundImage: cssImage(source),
    backgroundPosition: fit === "tile" ? "0 0" : "center",
    backgroundRepeat: fit === "tile" ? "repeat" : "no-repeat",
    backgroundSize:
      fit === "tile" ? "auto" : fit === "contain" ? "contain" : "cover",
  };
}

export function layoutTiledImageStyle(source: string): CSSProperties {
  return {
    backgroundImage: cssImage(source),
    backgroundPosition: "0 0",
    backgroundRepeat: "repeat",
    backgroundSize: "auto",
  };
}

function sharedPresentationStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
): SharedPresentationStyle {
  const presentation = node.presentation;
  return {
    padding: layoutSpacing[presentation.padding ?? "none"],
    ...layoutBackgroundColorStyle(node, packageItem),
    textAlign: textAlignments.has(presentation.textAlign ?? "")
      ? (presentation.textAlign as CSSProperties["textAlign"])
      : undefined,
    color: layoutColor(presentation.textColor, packageItem),
    fontSize: presentation.textSize
      ? layoutTextSizes[presentation.textSize]
      : undefined,
    borderColor: layoutColor(presentation.borderColor, packageItem),
    borderWidth: borderWidths[presentation.borderWidth ?? ""],
    borderStyle: borderStyles.has(presentation.borderStyle ?? "")
      ? presentation.borderStyle
      : undefined,
    borderRadius: borderRadii[presentation.corners ?? ""],
    overflow: presentation.clip ? "hidden" : undefined,
  };
}

const exactImageDimension =
  /^(?:0|[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]+)(?:px|rem)$/;

function layoutImageDimension(value: string | undefined) {
  if (!value) return undefined;
  return (
    layoutSizes[value] ?? (exactImageDimension.test(value) ? value : undefined)
  );
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
  const controlAlignment = node.presentation.textAlign;
  const controlJustifyContent =
    controlAlignment === "center"
      ? "center"
      : controlAlignment === "end"
        ? "flex-end"
        : "flex-start";
  return {
    ...(node.kind === "image" || node.kind === "choice"
      ? {
          padding: layoutSpacing[node.presentation.padding ?? "none"],
          ...layoutBackgroundColorStyle(node, packageItem),
        }
      : layoutNodeUsesControlAlignment(node.kind, node.target)
        ? {
            padding: layoutSpacing[node.presentation.padding ?? "none"],
            ...layoutBackgroundColorStyle(node, packageItem),
            display: "flex",
            justifyContent: controlJustifyContent,
          }
        : layoutNodeSupportsTextStyling(node.kind, node.target)
          ? sharedPresentationStyle(node, packageItem)
          : {}),
    alignSelf: parentKind === "stack" ? positionedAlign : undefined,
    justifySelf: parentKind === "grid" ? positionedAlign : undefined,
  };
}

export function layoutInlineChildAreaStyle(node: LayoutNode): CSSProperties {
  const isContainer = ["stack", "inline", "wrap", "grid"].includes(node.kind);
  const align = isContainer ? "stretch" : node.presentation.align;
  const preservesAuthoredImageSize =
    node.kind === "image" &&
    align === "stretch" &&
    Boolean(
      node.presentation.size ||
      node.presentation.width ||
      node.presentation.height,
    );
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
  const inlineSize = reservesTextArea
    ? "min(20rem, 100%)"
    : reservesIntrinsicImageArea
      ? "max-content"
      : undefined;
  return {
    justifyContent: align === "stretch" ? "stretch" : "flex-start",
    ...(preservesAuthoredImageSize ? { flex: "1 1 auto" } : {}),
    marginInlineStart:
      align === "center" || align === "end" ? "auto" : undefined,
    marginInlineEnd: align === "center" ? "auto" : undefined,
    inlineSize,
    maxInlineSize: inlineSize ? "100%" : undefined,
  };
}

function imageUsesAvailableWidth(
  node: LayoutNode,
  parentKind?: LayoutNode["kind"],
) {
  return (
    node.presentation.align === "stretch" ||
    (!node.presentation.align &&
      (parentKind === "stack" || parentKind === "grid"))
  );
}

export function layoutImageStyle(
  node: LayoutNode,
  parentKind?: LayoutNode["kind"],
): CSSProperties {
  const presentation = node.presentation;
  const shorthand = presentation.size
    ? layoutImageDimension(presentation.size)
    : undefined;
  const width = shorthand ?? layoutImageDimension(presentation.width);
  const height = shorthand ?? layoutImageDimension(presentation.height);
  const stretches = imageUsesAvailableWidth(node, parentKind);
  return {
    width: width || stretches ? "100%" : "auto",
    height: shorthand ? "auto" : height ? "100%" : "auto",
    aspectRatio: shorthand ? "1 / 1" : undefined,
    maxWidth: "100%",
    objectFit:
      presentation.fit && imageFits.has(presentation.fit)
        ? (presentation.fit as CSSProperties["objectFit"])
        : undefined,
  };
}

export function layoutImageBoundaryStyle(
  node: LayoutNode,
  parentKind?: LayoutNode["kind"],
): CSSProperties {
  const presentation = node.presentation;
  const shorthand = presentation.size
    ? layoutImageDimension(presentation.size)
    : undefined;
  const width = shorthand ?? layoutImageDimension(presentation.width);
  const height = shorthand ?? layoutImageDimension(presentation.height);
  const stretches = imageUsesAvailableWidth(node, parentKind);
  const inlineIntrinsic = parentKind === "inline" || parentKind === "wrap";
  const preservesAuthoredDimensions =
    inlineIntrinsic && Boolean(shorthand || width || height);
  const padding = layoutSpacing[presentation.padding ?? "none"] ?? "0";
  return {
    width:
      width ??
      (height
        ? undefined
        : stretches
          ? "100%"
          : inlineIntrinsic
            ? undefined
            : "fit-content"),
    height: shorthand ? undefined : height,
    flex: preservesAuthoredDimensions ? "0 1 auto" : undefined,
    boxSizing: "content-box",
    maxWidth: padding === "0" ? "100%" : `calc(100% - (${padding} * 2))`,
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
