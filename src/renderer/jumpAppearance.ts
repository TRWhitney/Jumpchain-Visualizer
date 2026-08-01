import type { CSSProperties } from "react";

import type { CanonicalJumpPackage } from "../markup";
import { format1BuiltInColors } from "../markup/format1Colors";

const spacing = {
  none: "0",
  xs: ".25rem",
  sm: ".5rem",
  md: ".75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
} as const;

const corners = {
  none: "0",
  sm: ".25rem",
  md: ".4rem",
  lg: ".7rem",
  pill: "9999px",
} as const;

const borderWidths = {
  none: "0",
  thin: "1px",
  medium: "2px",
  thick: "4px",
} as const;

type AppearanceStyle = CSSProperties & Record<`--jump-${string}`, string>;

export const defaultCostAppearanceColors = {
  "cost-background": "#fffdf7",
  "cost-text": "#5c4500",
  "cost-border": "#d8cfb6",
  "cost-benefit-background": "#dcebdc",
  "cost-benefit-text": "#173c25",
  "cost-benefit-border": "#8eb99a",
  "cost-award-background": "#dcebdc",
  "cost-award-text": "#173c25",
  "cost-award-border": "#8eb99a",
  "cost-pending-background": "#30302d",
  "cost-pending-text": "#d5d1c8",
  "cost-pending-border": "#77736b",
} as const;

export function resolveAppearanceColor(
  value: string | undefined,
  packageItem: Pick<CanonicalJumpPackage, "themes">,
) {
  if (!value) return undefined;
  const candidate = packageItem.themes[value] ?? value;
  return /^#[0-9a-f]{6}$/i.test(candidate)
    ? candidate
    : format1BuiltInColors[candidate as keyof typeof format1BuiltInColors];
}

/**
 * Resolves an exact role through family and shared roots without materializing
 * inherited values in the authored declaration.
 */
export function resolvedJumpAppearance(
  packageItem: Pick<CanonicalJumpPackage, "appearance" | "themes">,
) {
  const authored = packageItem.appearance ?? {};
  const structuralBorderWidth =
    borderWidths[
      authored["structural-border-width"] as keyof typeof borderWidths
    ] ?? "1px";
  const raw = (role: string, family: string | undefined, shared: string) =>
    authored[role] ??
    (family ? authored[`${family}-${shared}`] : undefined) ??
    authored[
      shared === "background"
        ? "background"
        : shared === "text"
          ? "text-color"
          : `${shared}-color`
    ];
  const textRoot = authored["text-color"];
  const color = (
    role: string,
    family: string | undefined,
    shared: "background" | "text" | "border" | "accent",
    fallback: string,
  ) =>
    resolveAppearanceColor(
      raw(role, family, shared) ??
        (shared === "border" || shared === "accent" ? textRoot : undefined),
      packageItem,
    ) ?? fallback;

  return {
    surfaceBackground: color(
      "surface-background",
      undefined,
      "background",
      "#f5f1e6",
    ),
    surfaceText: color("surface-text", undefined, "text", "#171717"),
    surfaceBorder: color("surface-border", undefined, "border", "#d8cfb6"),
    headerBackground: color(
      "header-background",
      "surface",
      "background",
      "#f5f1e6",
    ),
    headerLabel: color("header-label", "surface", "text", "#171717"),
    headerTitle: color("header-title", "surface", "text", "#171717"),
    headerDescription: color(
      "header-description",
      "surface",
      "text",
      "#5f5a4d",
    ),
    headerBorder: color("header-border", "surface", "border", "#d8cfb6"),
    budgetBackground: color(
      "budget-background",
      "surface",
      "background",
      "#fffdf7",
    ),
    budgetLabel: color("budget-label", "surface", "text", "#5f5a4d"),
    budgetValue: color("budget-value", "surface", "text", "#5c4500"),
    budgetBorder: color("budget-border", "surface", "border", "#d8cfb6"),
    sectionGutter: color("section-gutter", "surface", "background", "#f5f1e6"),
    sectionBackground: color(
      "section-background",
      "surface",
      "background",
      "transparent",
    ),
    sectionHeading: color("section-heading", "surface", "text", "#26231f"),
    sectionBody: color("section-body", "surface", "text", "#5f5a4d"),
    sectionBorder: color("section-border", "surface", "border", "#45443f"),
    choiceBackground: color(
      "choice-background",
      "surface",
      "background",
      "transparent",
    ),
    choiceHeading: color("choice-heading", "surface", "text", "#26231f"),
    choiceBody: color("choice-body", "surface", "text", "#5f5a4d"),
    choiceBorder: color("choice-border", "surface", "border", "#d8cfb6"),
    groupBackground: color(
      "group-background",
      "surface",
      "background",
      "transparent",
    ),
    groupFooterBackground: color(
      "group-footer-background",
      "surface",
      "background",
      "transparent",
    ),
    groupText: color("group-text", "surface", "text", "#26231f"),
    groupBorder: color("group-border", "surface", "border", "#d8cfb6"),
    controlBackground: color(
      "control-background",
      "surface",
      "background",
      "#fffdf7",
    ),
    controlText: color("control-text", "surface", "text", "#26231f"),
    controlMutedText: color("control-muted-text", "surface", "text", "#716c62"),
    controlBorder: color("control-border", "surface", "border", "#bdb49e"),
    controlIndicator: color(
      "control-indicator",
      undefined,
      "accent",
      "#5c4500",
    ),
    controlAccent: color("control-accent", undefined, "accent", "#725a13"),
    controlHoverBackground: color(
      "control-hover-background",
      "control",
      "background",
      "#f4edda",
    ),
    controlHoverText: color("control-hover-text", "control", "text", "#26231f"),
    controlHoverBorder: color(
      "control-hover-border",
      "control",
      "border",
      "#8f825f",
    ),
    controlPressedBackground: color(
      "control-pressed-background",
      "control",
      "background",
      "#e9dfc6",
    ),
    controlPressedText: color(
      "control-pressed-text",
      "control",
      "text",
      "#171717",
    ),
    controlPressedBorder: color(
      "control-pressed-border",
      "control",
      "border",
      "#725a13",
    ),
    controlSelectedBackground: color(
      "control-selected-background",
      "control",
      "background",
      "#ece1bf",
    ),
    controlSelectedText: color(
      "control-selected-text",
      "control",
      "text",
      "#26231f",
    ),
    controlSelectedBorder: color(
      "control-selected-border",
      "control",
      "border",
      "#725a13",
    ),
    controlDisabledBackground: color(
      "control-disabled-background",
      "control",
      "background",
      "#ece9df",
    ),
    controlDisabledText: color(
      "control-disabled-text",
      "control",
      "text",
      "#77736b",
    ),
    controlDisabledBorder: color(
      "control-disabled-border",
      "control",
      "border",
      "#c8c1b1",
    ),
    controlDisabledIndicator: color(
      "control-disabled-indicator",
      undefined,
      "accent",
      "#77736b",
    ),
    costBackground: color(
      "cost-background",
      "surface",
      "background",
      defaultCostAppearanceColors["cost-background"],
    ),
    costText: color(
      "cost-text",
      "surface",
      "text",
      defaultCostAppearanceColors["cost-text"],
    ),
    costBorder: color(
      "cost-border",
      "surface",
      "border",
      defaultCostAppearanceColors["cost-border"],
    ),
    costBenefitBackground: color(
      "cost-benefit-background",
      "cost",
      "background",
      defaultCostAppearanceColors["cost-benefit-background"],
    ),
    costBenefitText: color(
      "cost-benefit-text",
      "cost",
      "text",
      defaultCostAppearanceColors["cost-benefit-text"],
    ),
    costBenefitBorder: color(
      "cost-benefit-border",
      "cost",
      "border",
      defaultCostAppearanceColors["cost-benefit-border"],
    ),
    costAwardBackground: color(
      "cost-award-background",
      "cost",
      "background",
      defaultCostAppearanceColors["cost-award-background"],
    ),
    costAwardText: color(
      "cost-award-text",
      "cost",
      "text",
      defaultCostAppearanceColors["cost-award-text"],
    ),
    costAwardBorder: color(
      "cost-award-border",
      "cost",
      "border",
      defaultCostAppearanceColors["cost-award-border"],
    ),
    costPendingBackground: color(
      "cost-pending-background",
      "cost",
      "background",
      defaultCostAppearanceColors["cost-pending-background"],
    ),
    costPendingText: color(
      "cost-pending-text",
      "cost",
      "text",
      defaultCostAppearanceColors["cost-pending-text"],
    ),
    costPendingBorder: color(
      "cost-pending-border",
      "cost",
      "border",
      defaultCostAppearanceColors["cost-pending-border"],
    ),
    tooltipBackground: color(
      "tooltip-background",
      "surface",
      "background",
      "#26231f",
    ),
    tooltipText: color("tooltip-text", "surface", "text", "#ffffff"),
    tooltipBorder: color("tooltip-border", "surface", "border", "#5f5a4d"),
    canvasPadding:
      spacing[authored["canvas-padding"] as keyof typeof spacing] ?? "0",
    sectionSpacing:
      spacing[authored["section-spacing"] as keyof typeof spacing] ?? "0",
    sectionPadding:
      spacing[authored["section-padding"] as keyof typeof spacing] ?? "1rem",
    corners: corners[authored.corners as keyof typeof corners] ?? ".3rem",
    controlCorners:
      corners[authored["control-corners"] as keyof typeof corners] ?? ".28rem",
    costCorners:
      corners[authored["cost-corners"] as keyof typeof corners] ?? "9999px",
    borderWidth: structuralBorderWidth,
    sectionBorderWidth:
      authored.corners && authored.corners !== "none"
        ? structuralBorderWidth
        : `${structuralBorderWidth} 0 0`,
  };
}

export function jumpAppearanceStyle(
  packageItem: Pick<CanonicalJumpPackage, "appearance" | "themes">,
): AppearanceStyle {
  const value = resolvedJumpAppearance(packageItem);
  return Object.fromEntries(
    Object.entries(value).map(([name, resolved]) => [
      `--jump-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      resolved,
    ]),
  ) as AppearanceStyle;
}

export function inheritedAppearanceValue(
  field: string,
  packageItem: Pick<CanonicalJumpPackage, "appearance" | "themes">,
) {
  const property =
    {
      background: "surfaceBackground",
      "text-color": "surfaceText",
      "border-color": "surfaceBorder",
      "accent-color": "controlAccent",
    }[field] ??
    field.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const value = resolvedJumpAppearance(packageItem) as Record<string, string>;
  return value[property];
}
