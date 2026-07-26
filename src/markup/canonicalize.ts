import type {
  CanonicalJumpPackage,
  ChoiceSource,
  CostAmount,
  DirectChoice,
  ImageBlock,
  JumpChoice,
  JumpCost,
  JumpGrant,
  JumpInput,
  JumpLayout,
  JumpResource,
  JumpSection,
  LayoutNode,
  PackageDiagnostic,
  PackageValidationOptions,
  PackageSources,
  ParsedFormatFile,
  Renderable,
  SourceField,
  SourceNode,
  TextBlock,
} from "./model";
import { parseFormatFile } from "./parseSource";
import { validateFormat1 } from "./validateFormat1";
import { format1BuiltInColors } from "./format1Colors";

const handles = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const costTokens: Record<string, number> = {
  trivial: 100,
  small: 200,
  medium: 400,
  large: 600,
  major: 800,
  extreme: 1200,
  add_trivial: -100,
  add_small: -200,
  add_medium: -400,
  add_large: -600,
  add_major: -800,
  add_extreme: -1200,
};

function unquote(value: string) {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed;
  try {
    return JSON.parse(trimmed) as string;
  } catch {
    return trimmed.slice(1, -1);
  }
}

const fields = (node: SourceNode, name: string) =>
  node.fields.filter((field) => field.name === name);
const field = (node: SourceNode, name: string) => fields(node, name).at(-1);
const value = (node: SourceNode, name: string) => {
  const selected = field(node, name)?.value;
  return selected === undefined ? undefined : unquote(selected);
};
const integer = (node: SourceNode, name: string) => {
  const selected = value(node, name);
  if (selected === undefined || !/^-?\d+$/.test(selected)) return undefined;
  return Number(selected);
};
const boolean = (node: SourceNode, name: string) => {
  const selected = value(node, name);
  return selected === "true" ? true : selected === "false" ? false : undefined;
};

function renderable(node: SourceNode, name: string): Renderable {
  const matching = fields(node, name);
  return {
    base: matching.find((item) => !item.condition)?.value
      ? unquote(matching.find((item) => !item.condition)!.value)
      : undefined,
    variants: matching
      .filter((item): item is SourceField & { condition: string } =>
        Boolean(item.condition),
      )
      .map((item) => ({
        condition: item.condition,
        value: unquote(item.value),
      })),
  };
}

function diagnostic(
  diagnostics: PackageDiagnostic[],
  code: string,
  _message: string,
  node?: SourceNode | SourceField,
  severity: PackageDiagnostic["severity"] = "error",
  parameters: Readonly<Record<string, string | number>> = {},
) {
  diagnostics.push({
    code,
    severity,
    messageKey: `diagnostics.${code}`,
    parameters,
    range: node?.range,
  });
}

function appearanceContrastDiagnostics(
  packageItem: Omit<CanonicalJumpPackage, "diagnostics">,
  node: SourceNode | undefined,
): PackageDiagnostic[] {
  const authored = packageItem.appearance ?? {};
  if (!node || Object.keys(authored).length === 0) return [];
  const resolve = (candidate: string | undefined) => {
    if (!candidate) return undefined;
    const value = packageItem.themes[candidate] ?? candidate;
    return /^#[0-9a-f]{6}$/i.test(value)
      ? value
      : format1BuiltInColors[value as keyof typeof format1BuiltInColors];
  };
  const role = (
    exact: string,
    family: string | undefined,
    shared: "background" | "text" | "border" | "accent",
    fallback: string,
  ) =>
    resolve(
      authored[exact] ??
        (family ? authored[`${family}-${shared}`] : undefined) ??
        authored[
          shared === "background"
            ? "background"
            : shared === "text"
              ? "text-color"
              : `${shared}-color`
        ] ??
        (shared === "border" || shared === "accent"
          ? authored["text-color"]
          : undefined),
    ) ?? fallback;
  const channel = (hex: string, offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = (hex: string) =>
    channel(hex, 1) * 0.2126 +
    channel(hex, 3) * 0.7152 +
    channel(hex, 5) * 0.0722;
  const ratio = (foreground: string, background: string) => {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const surfaceBackground = role(
    "surface-background",
    undefined,
    "background",
    "#f5f1e6",
  );
  const checks = [
    [
      "surfaceText",
      role("surface-text", undefined, "text", "#171717"),
      surfaceBackground,
      4.5,
    ],
    [
      "headerTitle",
      role("header-title", "surface", "text", "#171717"),
      role("header-background", "surface", "background", "#f5f1e6"),
      3,
    ],
    [
      "headerDescription",
      role("header-description", "surface", "text", "#5f5a4d"),
      role("header-background", "surface", "background", "#f5f1e6"),
      4.5,
    ],
    [
      "sectionBody",
      role("section-body", "surface", "text", "#5f5a4d"),
      role("section-background", "surface", "background", "#f5f1e6"),
      4.5,
    ],
    [
      "choiceBody",
      role("choice-body", "surface", "text", "#5f5a4d"),
      role("choice-background", "surface", "background", "#f5f1e6"),
      4.5,
    ],
    [
      "controlText",
      role("control-text", "surface", "text", "#26231f"),
      role("control-background", "surface", "background", "#fffdf7"),
      4.5,
    ],
    [
      "controlIndicator",
      role("control-indicator", undefined, "accent", "#5c4500"),
      role("control-background", "surface", "background", "#fffdf7"),
      3,
    ],
    [
      "focusIndicator",
      role("control-accent", undefined, "accent", "#725a13"),
      surfaceBackground,
      3,
    ],
    [
      "meaningfulBorder",
      role("surface-border", undefined, "border", "#d8cfb6"),
      surfaceBackground,
      3,
    ],
  ] as const;
  return checks.flatMap(([roleName, foreground, background, expected]) => {
    const measured = ratio(foreground, background);
    if (measured >= expected) return [];
    return [
      {
        code: "appearance.contrast",
        severity: "warning" as const,
        messageKey: `diagnostics.appearance.contrast.${roleName}`,
        parameters: {
          measured: measured.toFixed(2),
          expected: expected.toFixed(1),
        },
        range: node.range,
      },
    ];
  });
}

function requireValue(
  node: SourceNode,
  name: string,
  diagnostics: PackageDiagnostic[],
) {
  const selected = value(node, name);
  if (selected === undefined || selected === "")
    diagnostic(
      diagnostics,
      `${node.kind}.${name}.required`,
      `${node.kind} requires ${name}.`,
      node,
    );
  return selected ?? "";
}

function validateHandle(
  handle: string,
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
) {
  if (!handles.test(handle))
    diagnostic(
      diagnostics,
      "handle.invalid",
      `Invalid handle “${handle}”.`,
      node,
    );
  return handle;
}

function textBlock(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): TextBlock {
  return {
    handle: validateHandle(
      requireValue(node, "handle", diagnostics),
      node,
      diagnostics,
    ),
    content: renderable(node, "content"),
  };
}

function imageBlock(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): ImageBlock {
  const src = value(node, "src");
  if (src && (/^(?:[a-z]+:|\/)/i.test(src) || src.split("/").includes("..")))
    diagnostic(
      diagnostics,
      "package.asset_path",
      "Assets must use a package-relative path without traversal or a URI scheme.",
      node,
    );
  return {
    handle: validateHandle(
      requireValue(node, "handle", diagnostics),
      node,
      diagnostics,
    ),
    src,
    alt: renderable(node, "alt"),
  };
}

function amount(raw: string | undefined): CostAmount | undefined {
  if (raw === undefined) return undefined;
  const normalized = unquote(raw);
  if (/^-?\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}

function grant(
  node: SourceNode | SourceField,
  diagnostics: PackageDiagnostic[],
): JumpGrant {
  const scalar = "fields" in node ? node.scalar : node.value;
  const kind =
    ("fields" in node ? value(node, "kind") : undefined) ?? scalar ?? "";
  const permitted = new Set([
    "perk",
    "item",
    "form",
    "companion",
    "resource",
    "trait",
    "property",
  ]);
  if (!permitted.has(kind))
    diagnostic(
      diagnostics,
      "grant.kind",
      `Unknown grant kind “${kind}”.`,
      node,
      "error",
      { kind },
    );
  const result: JumpGrant = {
    kind: (permitted.has(kind) ? kind : "trait") as JumpGrant["kind"],
    shorthand: !("fields" in node),
    name:
      "fields" in node && fields(node, "name").length
        ? renderable(node, "name")
        : undefined,
    layout: "fields" in node ? value(node, "layout") : undefined,
    tags:
      "fields" in node
        ? fields(node, "tag").map((item) => unquote(item.value))
        : [],
    resource: "fields" in node ? value(node, "resource") : undefined,
    amount: "fields" in node ? amount(field(node, "amount")?.value) : undefined,
    handle: "fields" in node ? value(node, "handle") : undefined,
    form: "fields" in node ? value(node, "form") : undefined,
    companion: "fields" in node ? value(node, "companion") : undefined,
    measure:
      "fields" in node &&
      ["rank", "quantity"].includes(value(node, "measure") ?? "")
        ? (value(node, "measure") as JumpGrant["measure"])
        : undefined,
    value:
      "fields" in node
        ? parsePropertyValue(field(node, "value")?.value)
        : undefined,
    text:
      "fields" in node
        ? node.children
            .filter((child) => child.kind === "text")
            .map((child) => textBlock(child, diagnostics))
        : [],
    images:
      "fields" in node
        ? node.children
            .filter((child) => child.kind === "image")
            .map((child) => imageBlock(child, diagnostics))
        : [],
  };
  if (
    result.kind === "resource" &&
    (!result.resource || result.amount === undefined)
  )
    diagnostic(
      diagnostics,
      "grant.resource.fields",
      "Resource grants require resource and amount.",
      node,
    );
  if (result.kind === "property" && !result.handle)
    diagnostic(
      diagnostics,
      "grant.property.fields",
      "Property grants require a handle.",
      node,
    );
  if (result.kind === "form" && !result.handle)
    diagnostic(
      diagnostics,
      "grant.form.handle",
      "Form grants require a stable handle.",
      node,
    );
  if (result.kind === "companion" && !result.handle && "fields" in node)
    diagnostic(
      diagnostics,
      "grant.companion.handle",
      "Companion grants require a stable handle.",
      node,
    );
  if (
    ["form", "companion"].includes(result.kind) &&
    result.handle &&
    "fields" in node
  )
    result.handle = validateHandle(result.handle, node, diagnostics);
  if (result.form && result.kind !== "perk")
    diagnostic(
      diagnostics,
      "grant.form.target_kind",
      "Only perk grants may target a form.",
      node,
    );
  if (result.companion && result.kind !== "perk" && result.kind !== "resource")
    diagnostic(
      diagnostics,
      "grant.companion.target_kind",
      "Only perk and resource grants may target a companion.",
      node,
    );
  if (result.form && result.companion)
    diagnostic(
      diagnostics,
      "grant.owner.conflict",
      "A grant cannot target both a form and a companion.",
      node,
    );
  if (
    "fields" in node &&
    field(node, "measure") &&
    !["rank", "quantity"].includes(value(node, "measure") ?? "")
  )
    diagnostic(
      diagnostics,
      "grant.measure.value",
      "Measure must be rank or quantity.",
      field(node, "measure"),
    );
  if (result.measure && !["perk", "item", "trait"].includes(result.kind))
    diagnostic(
      diagnostics,
      "grant.measure.kind",
      "Measure is valid only on perk, item, and trait grants.",
      node,
    );
  return result;
}

function parsePropertyValue(raw: string | undefined) {
  if (raw === undefined) return undefined;
  const normalized = unquote(raw);
  if (/^-?\d+$/.test(normalized)) return Number(normalized);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return normalized;
}

function validatePropertyGrants(
  selection: string,
  grants: readonly JumpGrant[],
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
) {
  for (const item of grants) {
    if (item.kind !== "property" || !item.handle) continue;
    const stringProperty = ["origin", "species", "location", "gender"].includes(
      item.handle,
    );
    const copiedWithWrongControl =
      item.value === undefined &&
      ((item.handle === "gender" && selection !== "select") ||
        (item.handle === "age" && selection !== "integer") ||
        (["origin", "species", "location"].includes(item.handle) &&
          !["text", "select"].includes(selection)));
    const literalHasWrongType =
      item.value !== undefined &&
      ((item.handle === "age" && typeof item.value !== "number") ||
        (stringProperty && typeof item.value !== "string"));
    if (copiedWithWrongControl || literalHasWrongType)
      diagnostic(
        diagnostics,
        "grant.property.reserved_types",
        `Property ${item.handle} is incompatible with its authored value or ${selection} control.`,
        node,
        "error",
        { property: item.handle ?? "", selection },
      );
  }
}

function validateMeasureGrants(
  selection: string,
  grants: readonly JumpGrant[],
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
) {
  if (
    selection !== "integer" &&
    grants.some((item) => item.measure !== undefined)
  )
    diagnostic(
      diagnostics,
      "grant.measure.integer_only",
      "Measure requires an owning integer choice or input.",
      node,
    );
}

function input(node: SourceNode, diagnostics: PackageDiagnostic[]): JumpInput {
  const selection = requireValue(node, "selection", diagnostics);
  const permitted = new Set(["text", "integer", "select"]);
  if (!permitted.has(selection))
    diagnostic(
      diagnostics,
      "input.selection",
      `Invalid input selection “${selection}”.`,
      node,
      "error",
      { selection },
    );
  const grants = [
    ...fields(node, "grant").map((item) => grant(item, diagnostics)),
    ...node.children
      .filter((child) => child.kind === "grant")
      .map((child) => grant(child, diagnostics)),
  ];
  if (grants.some((item) => item.kind === "form"))
    diagnostic(
      diagnostics,
      "grant.form.context",
      "Form grants are valid only directly on choices.",
      node,
    );
  validatePropertyGrants(selection, grants, node, diagnostics);
  validateMeasureGrants(selection, grants, node, diagnostics);
  return {
    handle: validateHandle(
      requireValue(node, "handle", diagnostics),
      node,
      diagnostics,
    ),
    selection: (permitted.has(selection)
      ? selection
      : "text") as JumpInput["selection"],
    placeholder: value(node, "placeholder"),
    min: integer(node, "min"),
    max: integer(node, "max"),
    options: optionRenderables(node),
    grants,
  };
}

function optionRenderables(node: SourceNode) {
  const result: {
    base?: string;
    variants: { condition: string; value: string }[];
  }[] = [];
  for (const item of fields(node, "option")) {
    if (!item.condition)
      result.push({ base: unquote(item.value), variants: [] });
    else if (result.length)
      result.at(-1)!.variants.push({
        condition: item.condition,
        value: unquote(item.value),
      });
  }
  return result;
}

function choice(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): JumpChoice {
  const choiceHandle = validateHandle(
    requireValue(node, "handle", diagnostics),
    node,
    diagnostics,
  );
  const selection = value(node, "selection") ?? "toggle";
  const resolution = value(node, "resolution") ?? "manual";
  const permittedSelection = new Set([
    "toggle",
    "text",
    "integer",
    "select",
    "companions",
  ]);
  const permittedResolution = new Set(["manual", "random", "either"]);
  const costs: JumpCost[] = fields(node, "cost").map((item) => ({
    resource: "jump_points",
    amount: amount(item.value) ?? 0,
    mode: "flat",
  }));
  costs.push(
    ...node.children
      .filter((child) => child.kind === "cost")
      .map((child) => ({
        resource: requireValue(child, "resource", diagnostics),
        amount: amount(field(child, "amount")?.value) ?? 0,
        mode:
          value(child, "mode") === "each"
            ? ("each" as const)
            : ("flat" as const),
      })),
  );
  if (new Set(costs.map((item) => item.resource)).size !== costs.length)
    diagnostic(
      diagnostics,
      "cost.unique_resource",
      "A choice may declare at most one cost per resource.",
      node,
    );
  const choiceGrants = [
    ...fields(node, "grant").map((item) => grant(item, diagnostics)),
    ...node.children
      .filter((child) => child.kind === "grant")
      .map((child) => grant(child, diagnostics)),
  ];
  for (const choiceGrant of choiceGrants)
    if (choiceGrant.kind === "companion" && choiceGrant.shorthand)
      choiceGrant.handle = choiceHandle;
  const shorthandForm = value(node, "form");
  const shorthandCompanion = value(node, "companion");
  const shorthandMeasure = value(node, "measure");
  const shorthandTarget = choiceGrants.length === 1 ? choiceGrants[0] : null;
  if (shorthandForm) {
    if (shorthandTarget?.kind === "perk" && fields(node, "grant").length === 1)
      shorthandTarget.form = shorthandForm;
    else
      diagnostic(
        diagnostics,
        "grant.form.shorthand",
        "Choice form requires exactly one shorthand perk grant.",
        field(node, "form"),
      );
  }
  if (shorthandCompanion) {
    if (shorthandTarget?.kind === "perk" && fields(node, "grant").length === 1)
      shorthandTarget.companion = shorthandCompanion;
    else
      diagnostic(
        diagnostics,
        "grant.companion.shorthand",
        "Choice companion requires exactly one shorthand perk grant.",
        field(node, "companion"),
      );
  }
  if (shorthandForm && shorthandCompanion)
    diagnostic(
      diagnostics,
      "grant.owner.conflict",
      "A shorthand perk cannot target both a form and a companion.",
      node,
    );
  if (shorthandMeasure) {
    if (!["rank", "quantity"].includes(shorthandMeasure))
      diagnostic(
        diagnostics,
        "grant.measure.value",
        "Measure must be rank or quantity.",
        field(node, "measure"),
      );
    else if (
      shorthandTarget &&
      ["perk", "item"].includes(shorthandTarget.kind) &&
      fields(node, "grant").length === 1
    )
      shorthandTarget.measure = shorthandMeasure as JumpGrant["measure"];
    else
      diagnostic(
        diagnostics,
        "grant.measure.shorthand",
        "Choice measure requires exactly one shorthand perk or item grant.",
        field(node, "measure"),
      );
  }
  const result: JumpChoice = {
    handle: choiceHandle,
    name: renderable(node, "name"),
    layout: value(node, "layout"),
    tags: fields(node, "tag").map((item) => unquote(item.value)),
    groups: fields(node, "group").map((item) => unquote(item.value)),
    selection: (permittedSelection.has(selection)
      ? selection
      : "toggle") as JumpChoice["selection"],
    placeholder: value(node, "placeholder"),
    continuity:
      value(node, "continuity") === "previous" ||
      value(node, "continuity") === "original"
        ? (value(node, "continuity") as JumpChoice["continuity"])
        : undefined,
    min:
      integer(node, "min") ??
      (permittedSelection.has(selection) && selection === "companions"
        ? 1
        : undefined),
    max:
      integer(node, "max") ??
      (permittedSelection.has(selection) && selection === "companions"
        ? 1
        : undefined),
    resolution: (permittedResolution.has(resolution)
      ? resolution
      : "manual") as JumpChoice["resolution"],
    options: optionRenderables(node),
    text: node.children
      .filter((child) => child.kind === "text")
      .map((child) => textBlock(child, diagnostics)),
    images: node.children
      .filter((child) => child.kind === "image")
      .map((child) => imageBlock(child, diagnostics)),
    inputs: node.children
      .filter((child) => child.kind === "input")
      .map((child) => input(child, diagnostics)),
    costs,
    grants: choiceGrants,
  };
  if (!result.name.base && !result.name.variants.length)
    diagnostic(
      diagnostics,
      "choice.name.required",
      "choice requires name.",
      node,
    );
  if (result.selection === "select" && !result.options.length)
    diagnostic(
      diagnostics,
      "choice.select.options",
      "Select choice has no options.",
      node,
      "warning",
    );
  if (
    result.resolution !== "manual" &&
    !["integer", "select"].includes(result.selection)
  )
    diagnostic(
      diagnostics,
      "choice.resolution.domain",
      "Choice resolution is valid only for integer and select choices.",
      node,
    );
  if (
    result.resolution !== "manual" &&
    result.selection === "integer" &&
    (result.min === undefined || result.max === undefined)
  )
    diagnostic(
      diagnostics,
      "choice.integer.bounds",
      "Random integer choices require finite min and max.",
      node,
    );
  if (
    result.min !== undefined &&
    result.max !== undefined &&
    result.min > result.max
  )
    diagnostic(
      diagnostics,
      "choice.integer.bounds",
      "Choice min exceeds max.",
      node,
    );
  if (
    result.costs.some((item) => item.mode === "each") &&
    result.selection !== "integer"
  )
    diagnostic(
      diagnostics,
      "cost.each.integer_only",
      "Per-rank costs require an integer choice.",
      node,
    );
  const copiedGender = result.grants.filter(
    (item) =>
      item.kind === "property" &&
      item.handle === "gender" &&
      item.value === undefined,
  );
  if (
    result.continuity &&
    (result.selection !== "select" || copiedGender.length !== 1)
  )
    diagnostic(
      diagnostics,
      "choice.continuity.domain",
      "Continuity requires a select choice copying exactly one gender property.",
      node,
    );
  validatePropertyGrants(result.selection, result.grants, node, diagnostics);
  validateMeasureGrants(result.selection, result.grants, node, diagnostics);
  return result;
}

function section(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): JumpSection {
  return {
    handle: validateHandle(
      requireValue(node, "handle", diagnostics),
      node,
      diagnostics,
    ),
    name: renderable(node, "name"),
    layout: value(node, "layout"),
    sources: node.children
      .filter((child) => child.kind === "choice-source")
      .map((child): ChoiceSource => ({
        handle: validateHandle(
          requireValue(child, "handle", diagnostics),
          child,
          diagnostics,
        ),
        group: value(child, "group"),
        mode: value(child, "mode") === "single" ? "single" : "multi",
        resolution:
          value(child, "resolution") === "random" ||
          value(child, "resolution") === "either"
            ? (value(child, "resolution") as ChoiceSource["resolution"])
            : "manual",
      })),
    directChoices: node.children
      .filter((child) => child.kind === "choice")
      .map((child): DirectChoice => ({
        handle: validateHandle(
          requireValue(child, "handle", diagnostics),
          child,
          diagnostics,
        ),
        target: requireValue(child, "target", diagnostics),
      })),
    members: node.children.flatMap((child) =>
      child.kind === "choice-source" || child.kind === "choice"
        ? [
            {
              kind: child.kind === "choice-source" ? "source" : "choice",
              handle: requireValue(child, "handle", diagnostics),
            } as const,
          ]
        : [],
    ),
    text: node.children
      .filter((child) => child.kind === "text")
      .map((child) => textBlock(child, diagnostics)),
    images: node.children
      .filter((child) => child.kind === "image")
      .map((child) => imageBlock(child, diagnostics)),
  };
}

const containerKinds = new Set(["stack", "inline", "wrap", "grid"]);
const leafKinds = new Set(["slot", "text", "image", "input", "choice"]);

function layoutNode(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): LayoutNode {
  const children = [
    ...node.children.map((child) => ({
      from: child.range.from,
      value: layoutNode(child, diagnostics),
    })),
    ...node.fields
      .filter((item) => leafKinds.has(item.name))
      .map((item) => ({
        from: item.range.from,
        value: {
          kind: item.name as LayoutNode["kind"],
          target: unquote(item.value),
          presentation: {},
          children: [],
        } satisfies LayoutNode,
      })),
  ]
    .sort((left, right) => left.from - right.from)
    .map((item) => item.value);
  const target = value(node, "target") ?? node.scalar;
  return {
    kind: node.kind as LayoutNode["kind"],
    target,
    source: value(node, "source"),
    using: value(node, "using"),
    presentation: {
      gap: value(node, "gap"),
      padding: value(node, "padding"),
      background: value(node, "background"),
      align: value(node, "align"),
      justify: value(node, "justify"),
      textAlign: value(node, "text-align"),
      textSize: value(node, "text-size"),
      textColor: value(node, "text-color"),
      columns: integer(node, "columns"),
      size: value(node, "size"),
      width: value(node, "width"),
      height: value(node, "height"),
      fit: value(node, "fit"),
      color: value(node, "color"),
      thickness: integer(node, "thickness"),
      style: value(node, "style"),
      borderColor: value(node, "border-color"),
      borderWidth: value(node, "border-width"),
      borderStyle: value(node, "border-style"),
      corners: value(node, "corners"),
      clip: boolean(node, "clip"),
    },
    children,
  };
}

function layout(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): JumpLayout {
  const roots = node.children.filter((child) => containerKinds.has(child.kind));
  if (roots.length !== 1)
    diagnostic(
      diagnostics,
      "layout.root",
      "A layout requires exactly one container root.",
      node,
    );
  return {
    kind: node.kind as JumpLayout["kind"],
    handle: validateHandle(
      requireValue(node, "handle", diagnostics),
      node,
      diagnostics,
    ),
    root: roots[0]
      ? layoutNode(roots[0], diagnostics)
      : { kind: "stack", presentation: {}, children: [] },
  };
}

function resource(
  node: SourceNode,
  diagnostics: PackageDiagnostic[],
): JumpResource {
  const handle = validateHandle(
    requireValue(node, "handle", diagnostics),
    node,
    diagnostics,
  );
  if (handle === "jump_points")
    diagnostic(
      diagnostics,
      "resource.reserved",
      "jump_points is the engine-owned primary resource.",
      node,
    );
  return {
    handle,
    name: renderable(node, "name"),
    abbreviation: fields(node, "abbreviation").length
      ? renderable(node, "abbreviation")
      : undefined,
    initial: integer(node, "initial") ?? 0,
  };
}

function validateRelations(
  result: Omit<CanonicalJumpPackage, "diagnostics">,
  diagnostics: PackageDiagnostic[],
) {
  const duplicates = (values: readonly string[]) => [
    ...new Set(values.filter((item, index) => values.indexOf(item) !== index)),
  ];
  for (const [namespace, values] of [
    ["resource", result.resources.map((item) => item.handle)],
    ["section", result.sections.map((item) => item.handle)],
    ["choice", result.choices.map((item) => item.handle)],
    [
      "form",
      result.choices.flatMap((item) =>
        item.grants.flatMap((grantItem) =>
          grantItem.kind === "form" && grantItem.handle
            ? [grantItem.handle]
            : [],
        ),
      ),
    ],
    [
      "companion",
      result.choices.flatMap((item) => [
        ...(item.selection === "companions" ? [item.handle] : []),
        ...item.grants.flatMap((grantItem) =>
          grantItem.kind === "companion" && grantItem.handle
            ? [grantItem.handle]
            : [],
        ),
      ]),
    ],
    ["layout", result.layouts.map((item) => item.handle)],
  ] as const)
    for (const duplicate of duplicates(values))
      diagnostic(
        diagnostics,
        `${namespace}.handle.unique`,
        `Duplicate ${namespace} handle “${duplicate}”.`,
        undefined,
        "error",
        { namespace, handle: duplicate },
      );

  const choices = new Set(result.choices.map((item) => item.handle));
  const layouts = new Map(result.layouts.map((item) => [item.handle, item]));
  const resources = new Set([
    "jump_points",
    ...result.resources.map((item) => item.handle),
  ]);
  const formHandles = result.choices.flatMap((item) =>
    item.grants.flatMap((grantItem) =>
      grantItem.kind === "form" && grantItem.handle ? [grantItem.handle] : [],
    ),
  );
  const forms = new Set(formHandles);
  const companionHandles = result.choices.flatMap((item) => [
    ...(item.selection === "companions" ? [item.handle] : []),
    ...item.grants.flatMap((grantItem) =>
      grantItem.kind === "companion" && grantItem.handle
        ? [grantItem.handle]
        : [],
    ),
  ]);
  const companions = new Set(companionHandles);
  const allGrants = result.choices.flatMap((choiceItem) => [
    ...choiceItem.grants,
    ...choiceItem.inputs.flatMap((inputItem) => inputItem.grants),
  ]);
  for (const duplicate of duplicates(formHandles))
    diagnostic(
      diagnostics,
      "grant.form.handle",
      `Form handle “${duplicate}” must be unique within the package.`,
      undefined,
      "error",
      { handle: duplicate },
    );
  for (const duplicate of duplicates(companionHandles))
    diagnostic(
      diagnostics,
      "grant.companion.handle",
      `Companion target handle “${duplicate}” must be unique within the package.`,
      undefined,
      "error",
      { handle: duplicate },
    );
  for (const importHandle of result.choices
    .filter((choiceItem) => choiceItem.selection === "companions")
    .map((choiceItem) => choiceItem.handle))
    if (
      !allGrants.some(
        (grantItem) =>
          grantItem.kind === "resource" &&
          grantItem.companion === importHandle &&
          grantItem.amount !== undefined &&
          resolveCostAmount(grantItem.amount) > 0,
      )
    )
      diagnostic(
        diagnostics,
        "choice.companions.funding",
        `Companion selection “${importHandle}” requires a positive targeted resource grant.`,
        undefined,
        "error",
        { handle: importHandle },
      );
  for (const sectionItem of result.sections) {
    const directHandles = sectionItem.directChoices.map((item) => item.handle);
    const directTargets = sectionItem.directChoices.map((item) => item.target);
    for (const duplicate of duplicates(directHandles))
      diagnostic(
        diagnostics,
        "section.choice.handle.unique",
        `Section ${sectionItem.handle} repeats placement “${duplicate}”.`,
        undefined,
        "error",
        { section: sectionItem.handle, handle: duplicate },
      );
    for (const duplicate of duplicates(directTargets))
      diagnostic(
        diagnostics,
        "section.choice.target.unique",
        `Section ${sectionItem.handle} associates choice “${duplicate}” more than once.`,
        undefined,
        "error",
        { section: sectionItem.handle, target: duplicate },
      );
    for (const direct of sectionItem.directChoices)
      if (!choices.has(direct.target))
        diagnostic(
          diagnostics,
          "section.choice.target",
          `Direct choice target “${direct.target}” does not exist.`,
          undefined,
          "error",
          { target: direct.target },
        );
    if (sectionItem.layout && !layouts.has(sectionItem.layout))
      diagnostic(
        diagnostics,
        "layout.reference",
        `Section layout “${sectionItem.layout}” does not exist.`,
        undefined,
        "error",
        { layout: sectionItem.layout, ownerKind: "Section" },
      );
    for (const source of sectionItem.sources) {
      if (!source.group)
        diagnostic(
          diagnostics,
          "choice-source.group.missing",
          `Choice source ${sectionItem.handle}.${source.handle} has no group and cannot contain choices.`,
          undefined,
          "warning",
          { section: sectionItem.handle, source: source.handle },
        );
      else if (
        !result.choices.some((item) => item.groups.includes(source.group!))
      )
        diagnostic(
          diagnostics,
          "choice-source.empty",
          `Choice source ${sectionItem.handle}.${source.handle} matches no choices.`,
          undefined,
          "warning",
          { section: sectionItem.handle, source: source.handle },
        );
    }
  }
  for (const choiceItem of result.choices) {
    if (choiceItem.layout && !layouts.has(choiceItem.layout))
      diagnostic(
        diagnostics,
        "layout.reference",
        `Choice layout “${choiceItem.layout}” does not exist.`,
        undefined,
        "error",
        { layout: choiceItem.layout, ownerKind: "Choice" },
      );
    for (const cost of choiceItem.costs)
      if (!resources.has(cost.resource))
        diagnostic(
          diagnostics,
          "resource.reference",
          `Cost resource “${cost.resource}” is not declared.`,
          undefined,
          "error",
          { resource: cost.resource, usage: "Cost" },
        );
    for (const item of [
      ...choiceItem.grants,
      ...choiceItem.inputs.flatMap((inputItem) => inputItem.grants),
    ]) {
      if (item.resource && !resources.has(item.resource))
        diagnostic(
          diagnostics,
          "resource.reference",
          `Grant resource “${item.resource}” is not declared.`,
          undefined,
          "error",
          { resource: item.resource, usage: "Grant" },
        );
      if (item.form && !forms.has(item.form))
        diagnostic(
          diagnostics,
          "grant.form.reference",
          `Form target “${item.form}” does not exist.`,
          undefined,
          "error",
          { target: item.form },
        );
      if (item.companion && !companions.has(item.companion))
        diagnostic(
          diagnostics,
          "grant.companion.reference",
          `Companion target “${item.companion}” does not exist.`,
          undefined,
          "error",
          { target: item.companion },
        );
    }
  }

  const reachableChoices = new Set(
    result.sections.flatMap((sectionItem) => [
      ...sectionItem.directChoices.map((item) => item.target),
      ...result.choices
        .filter((choiceItem) =>
          sectionItem.sources.some(
            (source) =>
              source.group && choiceItem.groups.includes(source.group),
          ),
        )
        .map((item) => item.handle),
    ]),
  );
  for (const choiceItem of result.choices)
    if (!reachableChoices.has(choiceItem.handle))
      diagnostic(
        diagnostics,
        "choice.unreachable",
        `Choice “${choiceItem.handle}” is not associated with a section.`,
        undefined,
        "warning",
        { choice: choiceItem.handle },
      );

  const walk = (node: LayoutNode): LayoutNode[] => [
    node,
    ...node.children.flatMap(walk),
  ];
  for (const layoutItem of result.layouts) {
    const nodes = walk(layoutItem.root);
    const containers = nodes.filter((item) => containerKinds.has(item.kind));
    for (const container of containers) {
      if (
        container.kind === "grid" &&
        (container.presentation.columns === undefined ||
          container.presentation.columns < 1 ||
          container.presentation.columns > 12)
      )
        diagnostic(
          diagnostics,
          "layout.grid.columns",
          `Grid in ${layoutItem.handle} requires columns from 1 through 12.`,
          undefined,
          "error",
          { layout: layoutItem.handle },
        );
    }
    if (
      layoutItem.kind !== "section-layout" &&
      nodes.some((item) => item.kind === "expand" || item.kind === "choice")
    )
      diagnostic(
        diagnostics,
        "layout.node.context",
        `${layoutItem.kind} ${layoutItem.handle} cannot contain expand or direct choice nodes.`,
        undefined,
        "error",
        { layout: layoutItem.handle, layoutKind: layoutItem.kind },
      );
    if (
      layoutItem.kind === "trait-layout" &&
      nodes.some(
        (item) => item.kind === "slot" && item.target && item.target !== "name",
      )
    )
      diagnostic(
        diagnostics,
        "layout.slot.context",
        `Trait layout ${layoutItem.handle} supports only the name slot.`,
        undefined,
        "error",
        { layout: layoutItem.handle },
      );
  }

  for (const sectionItem of result.sections) {
    const selectedLayout = sectionItem.layout
      ? layouts.get(sectionItem.layout)
      : result.defaultSectionLayout
        ? layouts.get(result.defaultSectionLayout)
        : undefined;
    if (!selectedLayout || selectedLayout.kind !== "section-layout") continue;
    const nodes = walk(selectedLayout.root);
    const expanded = nodes.filter((item) => item.kind === "expand");
    const placed = nodes
      .filter((item) => item.kind === "choice")
      .flatMap((item) => (item.target ? [item.target] : []));
    const sourceHandles = sectionItem.sources.map((item) => item.handle);
    const expandedHandles = expanded.flatMap((item) => {
      if (item.source) return [item.source];
      return sourceHandles.length === 1 ? [sourceHandles[0]] : [];
    });
    if (expanded.some((item) => !item.source) && sourceHandles.length !== 1)
      diagnostic(
        diagnostics,
        "layout.expand.ambiguous",
        `Layout ${selectedLayout.handle} omits an expansion source for section ${sectionItem.handle}.`,
        undefined,
        "error",
        { layout: selectedLayout.handle, section: sectionItem.handle },
      );
    for (const source of expanded) {
      const target = source.source ?? sourceHandles[0];
      if (target && !sourceHandles.includes(target))
        diagnostic(
          diagnostics,
          "layout.expand.source",
          `Expansion source “${target}” does not exist in section ${sectionItem.handle}.`,
          undefined,
          "error",
          { source: target, section: sectionItem.handle },
        );
      if (source.using && layouts.get(source.using)?.kind !== "choice-layout")
        diagnostic(
          diagnostics,
          "layout.expand.using",
          `Expansion layout “${source.using}” is not a choice layout.`,
          undefined,
          "error",
          { layout: source.using },
        );
    }
    for (const duplicate of duplicates(expandedHandles))
      diagnostic(
        diagnostics,
        "layout.expand.unique",
        `Section layout ${selectedLayout.handle} expands source “${duplicate}” more than once.`,
        undefined,
        "error",
        { layout: selectedLayout.handle, source: duplicate },
      );
    for (const source of sectionItem.sources)
      if (!expandedHandles.includes(source.handle))
        diagnostic(
          diagnostics,
          "layout.expand.unreachable",
          `Choice source ${sectionItem.handle}.${source.handle} is omitted by its explicit layout.`,
          undefined,
          "warning",
          { section: sectionItem.handle, source: source.handle },
        );
    const placementHandles = sectionItem.directChoices.map(
      (item) => item.handle,
    );
    for (const target of placed)
      if (!placementHandles.includes(target))
        diagnostic(
          diagnostics,
          "layout.choice.target",
          `Direct choice placement “${target}” does not exist in section ${sectionItem.handle}.`,
          undefined,
          "error",
          { target, section: sectionItem.handle },
        );
    for (const duplicate of duplicates(placed))
      diagnostic(
        diagnostics,
        "layout.choice.unique",
        `Section layout ${selectedLayout.handle} places “${duplicate}” more than once.`,
        undefined,
        "error",
        { layout: selectedLayout.handle, target: duplicate },
      );
    for (const direct of sectionItem.directChoices)
      if (!placed.includes(direct.handle))
        diagnostic(
          diagnostics,
          "layout.choice.unreachable",
          `Direct choice ${sectionItem.handle}.${direct.handle} is omitted by its explicit layout.`,
          undefined,
          "warning",
          { section: sectionItem.handle, choice: direct.handle },
        );
  }
}

export function canonicalizePackage(
  sources: PackageSources,
  options: PackageValidationOptions = {},
): CanonicalJumpPackage {
  const parsed: ParsedFormatFile[] = Object.entries(sources.files).map(
    ([file, source]) => parseFormatFile(file, source),
  );
  const diagnostics = parsed.flatMap((item) => item.diagnostics);
  const roots = parsed.flatMap((item) => item.tree);
  const jumpNodes = roots.filter((node) => node.kind === "jump");
  const appearanceNodes = roots.filter(
    (node) => node.kind === "jump-appearance",
  );
  if (appearanceNodes.length > 1)
    diagnostic(
      diagnostics,
      "jump-appearance.cardinality",
      "A package can contain only one jump appearance declaration.",
      appearanceNodes[1],
    );
  if (jumpNodes.length !== 1)
    diagnostic(
      diagnostics,
      "jump.cardinality",
      "A package requires exactly one jump declaration.",
      jumpNodes[0],
    );
  const root = jumpNodes[0] ?? {
    kind: "jump",
    fields: [],
    children: [],
    range: { file: "jump.jdef", line: 1, column: 1, from: 0, to: 0 },
  };
  const format = integer(root, "format");
  if (format !== 1)
    diagnostic(
      diagnostics,
      "jump.format",
      "Only Format 1 packages are supported.",
      root,
    );
  const authors = fields(root, "author").map((item) => unquote(item.value));
  if (!authors.length)
    diagnostic(
      diagnostics,
      "jump.author.required",
      "jump requires at least one author.",
      root,
    );
  const nativeGauntlet = boolean(root, "gauntlet") ?? false;
  const canonical: Omit<CanonicalJumpPackage, "diagnostics"> = {
    id: sources.id,
    logicalId: sources.logicalId ?? sources.id,
    exactHash: sources.exactHash,
    format: 1,
    name: renderable(root, "name"),
    authors,
    version: requireValue(root, "version", diagnostics),
    description: value(root, "description") ?? "",
    source: sources.source ?? "builtin",
    nativeGauntlet,
    startingPoints:
      integer(root, "starting-points") ?? (nativeGauntlet ? 0 : 1000),
    pointsName: fields(root, "points-name").length
      ? renderable(root, "points-name")
      : { base: "Choice Points", variants: [] },
    pointsAbbreviation: fields(root, "points-abbreviation").length
      ? renderable(root, "points-abbreviation")
      : { base: "CP", variants: [] },
    defaultSectionLayout: value(root, "section-layout"),
    defaultChoiceLayout: value(root, "choice-layout"),
    defaultTraitLayout: value(root, "trait-layout"),
    resources: roots
      .filter((node) => node.kind === "resource")
      .map((node) => resource(node, diagnostics)),
    sections: roots
      .filter((node) => node.kind === "section")
      .map((node) => section(node, diagnostics)),
    choices: roots
      .filter((node) => node.kind === "choice")
      .map((node) => choice(node, diagnostics)),
    layouts: roots
      .filter((node) =>
        ["section-layout", "choice-layout", "trait-layout"].includes(node.kind),
      )
      .map((node) => layout(node, diagnostics)),
    appearance: Object.fromEntries(
      (appearanceNodes[0]?.fields ?? []).map((item) => [
        item.name,
        unquote(item.value),
      ]),
    ),
    themes: Object.fromEntries(
      roots
        .filter((node) => node.kind === "theme")
        .map((node) => [
          requireValue(node, "handle", diagnostics),
          requireValue(node, "color", diagnostics),
        ]),
    ),
    tags: [],
  };
  if (!canonical.name.base && !canonical.name.variants.length)
    diagnostic(diagnostics, "jump.name.required", "jump requires name.", root);
  if (!canonical.sections.length)
    diagnostic(
      diagnostics,
      "section.required",
      "A distributable package requires at least one section.",
      root,
    );
  validateRelations(canonical, diagnostics);
  const schemaDiagnostics = validateFormat1(parsed, canonical, options);
  const replacedLegacyCodes = new Set([
    "handle.invalid",
    "input.selection",
    "layout.reference",
    "section.choice.target",
    "resource.reference",
    "grant.form.reference",
    "grant.companion.reference",
    "choice-source.group.missing",
    "choice-source.empty",
    "jump.cardinality",
    "section.required",
    "layout.root",
    "layout.node.context",
    "layout.expand.ambiguous",
    "layout.expand.source",
    "layout.expand.using",
    "layout.choice.target",
    "cost.unique_resource",
    "cost.each.integer_only",
    "resource.reserved",
    "section.choice.target.unique",
    "choice.select.options",
  ]);
  const retainedDiagnostics = diagnostics
    .filter(
      (item) =>
        !replacedLegacyCodes.has(item.code) &&
        !item.code.endsWith(".handle.unique") &&
        !(item.code.endsWith(".required") && item.code !== "section.required"),
    )
    .map((item) => {
      if (
        options.profile === "editor" &&
        [
          "layout.expand.ambiguous",
          "layout.expand.source",
          "layout.expand.using",
          "layout.choice.target",
        ].includes(item.code)
      )
        return { ...item, severity: "warning" as const };
      return item;
    });
  return {
    ...canonical,
    tags: [
      ...new Set(
        canonical.choices.flatMap((item) => [
          ...item.tags,
          ...item.grants.flatMap((grantItem) => grantItem.tags),
        ]),
      ),
    ],
    diagnostics: [
      ...retainedDiagnostics,
      ...schemaDiagnostics,
      ...appearanceContrastDiagnostics(canonical, appearanceNodes[0]),
    ],
  };
}

export function resolveCostAmount(value: CostAmount): number {
  if (typeof value === "number") return value;
  return costTokens[value] ?? 0;
}

export function packageIsValid(packageItem: CanonicalJumpPackage) {
  return !packageItem.diagnostics.some((item) => item.severity === "error");
}
