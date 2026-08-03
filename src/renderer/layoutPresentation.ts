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
  xs: ".625rem",
  sm: ".75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2.25rem",
  "2xl": "3.25rem",
  "3xl": "4.5rem",
  "4xl": "6rem",
};

const layoutFontFamilies: Readonly<Record<string, string>> = {
  system:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  sans: "Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  monospace: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
  condensed: "'Arial Narrow', 'Aptos Narrow', Arial, sans-serif",
};
const layoutFontWeights: Readonly<Record<string, number>> = {
  light: 300,
  normal: 400,
  semibold: 600,
  bold: 700,
  black: 900,
};
const layoutLineHeights: Readonly<Record<string, number>> = {
  solid: 0.9,
  tight: 1.05,
  normal: 1.3,
  relaxed: 1.55,
};
const layoutLetterSpacing: Readonly<Record<string, string>> = {
  tight: "-.025em",
  normal: "0",
  wide: ".05em",
  widest: ".1em",
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
  const basePadding = layoutSpacing[presentation.padding ?? "none"];
  return {
    padding: basePadding,
    ...(presentation.paddingBlock
      ? { paddingBlock: layoutSpacing[presentation.paddingBlock] }
      : {}),
    ...(presentation.paddingInline
      ? { paddingInline: layoutSpacing[presentation.paddingInline] }
      : {}),
    ...layoutBackgroundColorStyle(node, packageItem),
    textAlign: textAlignments.has(presentation.textAlign ?? "")
      ? (presentation.textAlign as CSSProperties["textAlign"])
      : undefined,
    color: layoutColor(presentation.textColor, packageItem),
    fontSize: layoutTextSize(presentation.textSize),
    ...(presentation.fontFamily
      ? {
          fontFamily: layoutFontFamilies[presentation.fontFamily],
          ...(presentation.fontFamily === "condensed"
            ? { fontStretch: "condensed" }
            : {}),
        }
      : {}),
    ...(presentation.fontWeight
      ? { fontWeight: layoutFontWeights[presentation.fontWeight] }
      : {}),
    ...(presentation.lineHeight
      ? { lineHeight: layoutLineHeights[presentation.lineHeight] }
      : {}),
    ...(presentation.letterSpacing
      ? { letterSpacing: layoutLetterSpacing[presentation.letterSpacing] }
      : {}),
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

const exactTextSize = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem)$/;
function layoutTextSize(value: string | undefined) {
  if (!value) return undefined;
  if (layoutTextSizes[value]) return layoutTextSizes[value];
  if (!exactTextSize.test(value)) return undefined;
  const amount = Number.parseFloat(value);
  return value.endsWith("px")
    ? amount >= 8 && amount <= 512
      ? value
      : undefined
    : amount >= 0.5 && amount <= 32
      ? value
      : undefined;
}

function layoutDimension(value: string | undefined) {
  if (!value) return undefined;
  const resolved = layoutSizes[value] ?? value;
  if (!exactImageDimension.test(resolved)) return undefined;
  const amount = Number.parseFloat(resolved);
  return resolved.endsWith("px")
    ? amount <= 4096
      ? resolved
      : undefined
    : amount <= 256
      ? resolved
      : undefined;
}

function layoutAspectRatio(value: string | undefined) {
  const match = value?.match(/^([1-9]\d?)\s*\/\s*([1-9]\d?)$/);
  return match ? `${match[1]} / ${match[2]}` : undefined;
}

function placementStyle(
  node: LayoutNode,
  parentKind?: LayoutNode["kind"],
): CSSProperties {
  const grow = node.presentation.grow;
  const minWidth = layoutDimension(node.presentation.minWidth);
  const minHeight = layoutDimension(node.presentation.minHeight);
  return {
    ...(parentKind === "stack" && grow && grow >= 1 && grow <= 12
      ? { flexGrow: grow, flexBasis: 0 }
      : {}),
    ...(parentKind === "grid" && node.presentation.columnSpan
      ? { gridColumn: `span ${node.presentation.columnSpan}` }
      : {}),
    ...(parentKind === "grid" && node.presentation.rowSpan
      ? { gridRow: `span ${node.presentation.rowSpan}` }
      : {}),
    ...(minWidth ? { minWidth: `min(${minWidth}, 100%)` } : {}),
    ...(minHeight ? { minHeight } : {}),
    ...(layoutAspectRatio(node.presentation.aspectRatio)
      ? { aspectRatio: layoutAspectRatio(node.presentation.aspectRatio) }
      : {}),
  };
}

export function layoutContainerPresentationStyle(
  node: LayoutNode,
  packageItem: PackageThemes,
  parentKind?: LayoutNode["kind"],
): CSSProperties {
  const presentation = node.presentation;
  const align = presentation.align ?? "stretch";
  const justify = presentation.justify ?? "start";
  return {
    ...sharedPresentationStyle(node, packageItem),
    ...placementStyle(node, parentKind),
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
    fontSize: presentation.textSize
      ? layoutTextSize(presentation.textSize)
      : parentKind
        ? undefined
        : ".75rem",
    gridTemplateColumns:
      presentation.columns &&
      presentation.columns >= 1 &&
      presentation.columns <= 12
        ? presentation.columnWeights?.length === presentation.columns
          ? presentation.columnWeights
              .map((weight) => `minmax(0, ${weight}fr)`)
              .join(" ")
          : `repeat(${presentation.columns}, minmax(0, 1fr))`
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
  const basePadding = layoutSpacing[node.presentation.padding ?? "none"];
  const leafPadding = {
    padding: basePadding,
    ...(node.presentation.paddingBlock
      ? { paddingBlock: layoutSpacing[node.presentation.paddingBlock] }
      : {}),
    ...(node.presentation.paddingInline
      ? { paddingInline: layoutSpacing[node.presentation.paddingInline] }
      : {}),
  };
  return {
    ...(node.kind === "image" || node.kind === "choice"
      ? {
          ...leafPadding,
          ...layoutBackgroundColorStyle(node, packageItem),
        }
      : layoutNodeUsesControlAlignment(node.kind, node.target)
        ? {
            ...leafPadding,
            ...layoutBackgroundColorStyle(node, packageItem),
            display: "flex",
            justifyContent: controlJustifyContent,
          }
        : layoutNodeSupportsTextStyling(node.kind, node.target)
          ? sharedPresentationStyle(node, packageItem)
          : {}),
    alignSelf: parentKind === "stack" ? positionedAlign : undefined,
    justifySelf: parentKind === "grid" ? positionedAlign : undefined,
    ...placementStyle(node, parentKind),
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
  const authoredGrow =
    node.presentation.grow &&
    node.presentation.grow >= 1 &&
    node.presentation.grow <= 12
      ? node.presentation.grow
      : undefined;
  return {
    ...(authoredGrow ? { flex: `${authoredGrow} 1 0` } : {}),
    justifyContent: align === "stretch" ? "stretch" : "flex-start",
    ...(preservesAuthoredImageSize && !authoredGrow
      ? { flex: "1 1 auto" }
      : {}),
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
  const vertical = node.presentation.orientation === "vertical";
  if (style === "rounded")
    return {
      width: vertical ? lineSize : "100%",
      height: vertical ? "100%" : lineSize,
      minHeight: vertical ? "1em" : undefined,
      margin: 0,
      backgroundColor: color ?? "currentColor",
      border: 0,
      borderStyle: "none",
      borderRadius: "9999px",
    };
  return {
    width: vertical ? lineSize : "100%",
    height: vertical ? "100%" : undefined,
    minHeight: vertical ? "1em" : undefined,
    margin: 0,
    border: 0,
    borderTopColor: vertical ? undefined : color,
    borderTopWidth: vertical ? undefined : lineSize,
    borderTopStyle: vertical
      ? undefined
      : style === "dash"
        ? "dashed"
        : style === "solid"
          ? "solid"
          : undefined,
    borderLeftColor: vertical ? color : undefined,
    borderLeftWidth: vertical ? lineSize : undefined,
    borderLeftStyle: vertical
      ? style === "dash"
        ? "dashed"
        : style === "solid"
          ? "solid"
          : undefined
      : undefined,
  };
}

export function layoutRichTextListStyle(node: LayoutNode): CSSProperties {
  const marker = node.presentation.listMarker;
  return {
    listStyleType:
      marker === "none" ? "none" : marker === "disc" ? "disc" : undefined,
    paddingInlineStart: node.presentation.listIndent
      ? layoutSpacing[node.presentation.listIndent]
      : undefined,
    rowGap: node.presentation.listGap
      ? layoutSpacing[node.presentation.listGap]
      : undefined,
    display: node.presentation.listGap ? "grid" : undefined,
  };
}
