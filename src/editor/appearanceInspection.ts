export type AppearanceColorKind = "background" | "text" | "border" | "accent";

export type LayoutColorOwnership = {
  kind: "section-layout" | "choice-layout" | "trait-layout";
  handle: string;
  path: string;
};

export type AppearanceColorInspection = {
  field: string;
  kind: AppearanceColorKind;
  layout?: LayoutColorOwnership;
};

type AppearanceInspectionRule = AppearanceColorInspection & {
  selector: string;
  borderField?: string;
};

export const appearanceInspectionRules: readonly AppearanceInspectionRule[] = [
  {
    selector: ".jump-image-alt-tooltip",
    field: "tooltip-background",
    kind: "background",
    borderField: "tooltip-border",
  },
  {
    selector: "input[placeholder], textarea[placeholder]",
    field: "control-muted-text",
    kind: "text",
    borderField: "control-border",
  },
  {
    selector: ".control-range, [data-roll-output], [data-group-status]",
    field: "control-muted-text",
    kind: "text",
  },
  {
    selector: "input:is([type='checkbox'], [type='radio'])",
    field: "control-indicator",
    kind: "accent",
    borderField: "control-border",
  },
  {
    selector: ".cost-badge.is-roll-pending",
    field: "cost-pending-background",
    kind: "background",
    borderField: "cost-pending-border",
  },
  {
    selector: ".cost-badge.is-award",
    field: "cost-award-background",
    kind: "background",
    borderField: "cost-award-border",
  },
  {
    selector: ".cost-badge.is-benefit",
    field: "cost-benefit-background",
    kind: "background",
    borderField: "cost-benefit-border",
  },
  {
    selector: ".cost-badge",
    field: "cost-background",
    kind: "background",
    borderField: "cost-border",
  },
  {
    selector: ".tracker-budget output",
    field: "budget-value",
    kind: "text",
  },
  {
    selector: ".tracker-budget > span",
    field: "budget-label",
    kind: "text",
  },
  {
    selector: ".tracker-budget",
    field: "budget-background",
    kind: "background",
    borderField: "budget-border",
  },
  {
    selector: ".shared-jump-renderer > header p",
    field: "header-label",
    kind: "text",
  },
  {
    selector: ".shared-jump-renderer > header h4",
    field: "header-title",
    kind: "text",
  },
  {
    selector: ".shared-jump-renderer > header span",
    field: "header-description",
    kind: "text",
  },
  {
    selector: ".shared-jump-renderer > header",
    field: "header-background",
    kind: "background",
    borderField: "header-border",
  },
  {
    selector: ".rendered-jump-section > header h5, .jump-section-layout-name",
    field: "section-heading",
    kind: "text",
  },
  {
    selector: ".rendered-jump-section > header p, .rendered-jump-section > p",
    field: "section-body",
    kind: "text",
  },
  {
    selector: ".default-choice-heading > strong",
    field: "choice-heading",
    kind: "text",
  },
  {
    selector: ".jump-choice-description, .jump-layout-text, .earth-explanation",
    field: "choice-body",
    kind: "text",
  },
  {
    selector: ".selection-specimen > footer, .jump-choice-group > footer",
    field: "group-footer-background",
    kind: "background",
    borderField: "group-border",
  },
  {
    selector:
      ".selection-specimen.has-group, .group-options, .jump-choice-group",
    field: "group-background",
    kind: "background",
    borderField: "group-border",
  },
  {
    selector:
      ".default-choice-actions :is(button, input, select, textarea), .jump-nested-inputs :is(button, input, select, textarea)",
    field: "control-text",
    kind: "text",
    borderField: "control-border",
  },
  {
    selector: ".default-choice-card, .selection-specimen",
    field: "choice-background",
    kind: "background",
    borderField: "choice-border",
  },
  {
    selector: ".rendered-jump-section",
    field: "section-background",
    kind: "background",
    borderField: "section-border",
  },
  {
    selector: ".shared-jump-renderer",
    field: "section-gutter",
    kind: "background",
    borderField: "surface-border",
  },
];

const inspectionAttributeNames = [
  "data-appearance-color-field",
  "data-appearance-color-kind",
  "data-appearance-border-field",
] as const;

export function annotateAppearanceInspectionTargets(root: HTMLElement) {
  const annotated: HTMLElement[] = [];
  for (const rule of appearanceInspectionRules) {
    for (const element of root.querySelectorAll<HTMLElement>(rule.selector)) {
      if (
        element.dataset.appearanceColorField ||
        element.closest(".tag-profile-badge")
      )
        continue;
      element.dataset.appearanceColorField = rule.field;
      element.dataset.appearanceColorKind = rule.kind;
      if (rule.borderField)
        element.dataset.appearanceBorderField = rule.borderField;
      annotated.push(element);
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-layout-color-owner-kind]",
  )) {
    if (element.dataset.appearanceColorField) continue;
    const inspection =
      (element.dataset.layoutColorBackground && {
        field: element.dataset.layoutColorBackground,
        kind: "background" as const,
      }) ||
      (element.dataset.layoutColorText && {
        field: element.dataset.layoutColorText,
        kind: "text" as const,
      }) ||
      (element.dataset.layoutColorBorder && {
        field: element.dataset.layoutColorBorder,
        kind: "border" as const,
      }) ||
      (element.dataset.layoutColorAccent && {
        field: element.dataset.layoutColorAccent,
        kind: "accent" as const,
      });
    if (!inspection) continue;
    element.dataset.appearanceColorField = inspection.field;
    element.dataset.appearanceColorKind = inspection.kind;
    annotated.push(element);
  }
  return () => {
    for (const element of annotated)
      for (const attribute of inspectionAttributeNames)
        element.removeAttribute(attribute);
  };
}

function isNearBorder(element: HTMLElement, clientX: number, clientY: number) {
  const bounds = element.getBoundingClientRect();
  const edge = Math.min(6, bounds.width / 4, bounds.height / 4);
  return (
    clientX - bounds.left <= edge ||
    bounds.right - clientX <= edge ||
    clientY - bounds.top <= edge ||
    bounds.bottom - clientY <= edge
  );
}

function layoutOwnership(element: HTMLElement): LayoutColorOwnership | null {
  const kind = element.dataset.layoutColorOwnerKind;
  const handle = element.dataset.layoutColorOwnerHandle;
  const path = element.dataset.layoutColorOwnerPath;
  return (kind === "section-layout" ||
    kind === "choice-layout" ||
    kind === "trait-layout") &&
    handle &&
    path
    ? { kind, handle, path }
    : null;
}

function layoutColorInspection(
  source: Element,
  appearanceKind: AppearanceColorKind | undefined,
  clientX: number,
  clientY: number,
): (AppearanceColorInspection & { element: HTMLElement }) | null {
  for (
    let candidate = source.closest<HTMLElement>(
      "[data-layout-color-owner-kind]",
    );
    candidate;
    candidate =
      candidate.parentElement?.closest<HTMLElement>(
        "[data-layout-color-owner-kind]",
      ) ?? null
  ) {
    const layout = layoutOwnership(candidate);
    if (!layout) continue;
    if (
      candidate.dataset.layoutColorBorder &&
      isNearBorder(candidate, clientX, clientY)
    )
      return {
        element: candidate,
        field: candidate.dataset.layoutColorBorder,
        kind: "border",
        layout,
      };
    const field =
      appearanceKind === "text"
        ? candidate.dataset.layoutColorText
        : appearanceKind === "background"
          ? candidate.dataset.layoutColorBackground
          : appearanceKind === "accent"
            ? candidate.dataset.layoutColorAccent
            : undefined;
    if (field)
      return {
        element: candidate,
        field,
        kind: appearanceKind!,
        layout,
      };
  }
  return null;
}

export function appearanceInspectionAtPoint(
  source: Element,
  clientX: number,
  clientY: number,
): (AppearanceColorInspection & { element: HTMLElement }) | null {
  const element = source.closest<HTMLElement>("[data-appearance-color-field]");
  const appearanceKind = element?.dataset.appearanceColorKind;
  const attributedKind =
    appearanceKind === "background" ||
    appearanceKind === "text" ||
    appearanceKind === "border" ||
    appearanceKind === "accent"
      ? appearanceKind
      : undefined;
  const textualSource = source.closest(
    "strong, em, b, i, u, s, p, h1, h2, h3, h4, h5, h6, li, td, th, label, output",
  );
  const layoutOwner = source.closest("[data-layout-color-owner-kind]");
  const kind =
    textualSource && layoutOwner?.contains(textualSource)
      ? ("text" as const)
      : attributedKind;
  const layoutInspection = layoutColorInspection(
    source,
    kind,
    clientX,
    clientY,
  );
  if (layoutInspection) return layoutInspection;
  if (!element) return null;
  const borderField = element.dataset.appearanceBorderField;
  if (borderField && isNearBorder(element, clientX, clientY))
    return { element, field: borderField, kind: "border" };
  const field = element.dataset.appearanceColorField;
  return field && kind ? { element, field, kind } : null;
}
