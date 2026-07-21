export type SourceRange = {
  file: string;
  line: number;
  column: number;
  from: number;
  to: number;
};

export type DiagnosticSeverity = "info" | "warning" | "error";

export type DiagnosticTarget = {
  file: string;
  declarationFrom: number;
  field?: string;
  occurrence?: number;
  part?: "declaration" | "name" | "value" | "condition";
};

export type PackageDiagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  messageKey?: string;
  parameters?: Readonly<Record<string, string | number>>;
  range?: SourceRange;
  target?: DiagnosticTarget;
};

export type PackageValidationProfile = "editor" | "distribution";

export type PackageValidationOptions = {
  profile?: PackageValidationProfile;
  assetPaths?: readonly string[];
  warnings?: {
    missingImageAlt?: boolean;
    missingLayoutTargets?: boolean;
  };
};

export type SourceField = {
  name: string;
  value: string;
  condition?: string;
  fenced?: boolean;
  range: SourceRange;
  nameRange: SourceRange;
  conditionRange?: SourceRange;
  valueRange: SourceRange;
};

export type SourceNode = {
  kind: string;
  scalar?: string;
  fields: SourceField[];
  children: SourceNode[];
  range: SourceRange;
};

export type ParsedFormatFile = {
  file: string;
  source: string;
  tree: SourceNode[];
  diagnostics: PackageDiagnostic[];
};

export type Renderable = {
  base?: string;
  variants: readonly { condition: string; value: string }[];
};

export type TextBlock = {
  handle: string;
  content: Renderable;
};

export type ImageBlock = {
  handle: string;
  src?: string;
  alt: Renderable;
};

export type SelectionKind = "toggle" | "text" | "integer" | "select";
export type ResolutionKind = "manual" | "random" | "either";
export type SourceMode = "single" | "multi";

export type CostAmount = number | string;
export type JumpCost = {
  resource: string;
  amount: CostAmount;
  mode: "flat" | "each";
};

export type GrantKind =
  | "perk"
  | "item"
  | "form"
  | "companion"
  | "resource"
  | "trait"
  | "property"
  | "companion-import";

export type JumpGrant = {
  kind: GrantKind;
  shorthand?: boolean;
  name?: Renderable;
  layout?: string;
  tags: readonly string[];
  resource?: string;
  amount?: CostAmount;
  handle?: string;
  form?: string;
  companion?: string;
  measure?: "rank" | "quantity";
  value?: string | number | boolean;
  text: readonly TextBlock[];
  images: readonly ImageBlock[];
};

export type JumpInput = {
  handle: string;
  selection: "text" | "integer" | "select" | "companions";
  min?: number;
  max?: number;
  options: readonly Renderable[];
  grants: readonly JumpGrant[];
};

export type JumpChoice = {
  handle: string;
  name: Renderable;
  layout?: string;
  tags: readonly string[];
  groups: readonly string[];
  selection: SelectionKind;
  continuity?: "previous" | "original";
  min?: number;
  max?: number;
  resolution: ResolutionKind;
  options: readonly Renderable[];
  text: readonly TextBlock[];
  images: readonly ImageBlock[];
  inputs: readonly JumpInput[];
  costs: readonly JumpCost[];
  grants: readonly JumpGrant[];
};

export type ChoiceSource = {
  handle: string;
  group?: string;
  mode: SourceMode;
  resolution: ResolutionKind;
};

export type DirectChoice = { handle: string; target: string };
export type SectionMember = {
  kind: "source" | "choice";
  handle: string;
};

export type JumpSection = {
  handle: string;
  name: Renderable;
  layout?: string;
  sources: readonly ChoiceSource[];
  directChoices: readonly DirectChoice[];
  members: readonly SectionMember[];
  text: readonly TextBlock[];
  images: readonly ImageBlock[];
};

export type Presentation = {
  gap?: string;
  padding?: string;
  background?: string;
  align?: string;
  justify?: string;
  textAlign?: string;
  textSize?: string;
  textColor?: string;
  columns?: number;
  size?: string;
  width?: string;
  height?: string;
  fit?: string;
};

export type LayoutNode = {
  kind:
    | "stack"
    | "inline"
    | "wrap"
    | "grid"
    | "slot"
    | "text"
    | "image"
    | "input"
    | "rule"
    | "choice"
    | "expand";
  target?: string;
  source?: string;
  using?: string;
  presentation: Presentation;
  children: readonly LayoutNode[];
};

export type JumpLayout = {
  kind: "section-layout" | "choice-layout" | "trait-layout";
  handle: string;
  root: LayoutNode;
};

export type JumpResource = {
  handle: string;
  name: Renderable;
  abbreviation?: Renderable;
  initial: number;
};

export type CanonicalJumpPackage = {
  id: string;
  logicalId: string;
  exactHash: string;
  format: 1;
  name: Renderable;
  authors: readonly string[];
  version: string;
  description: string;
  source: "builtin" | "imported" | "mock";
  nativeGauntlet: boolean;
  startingPoints: number;
  pointsName: Renderable;
  pointsAbbreviation: Renderable;
  defaultSectionLayout?: string;
  defaultChoiceLayout?: string;
  defaultTraitLayout?: string;
  resources: readonly JumpResource[];
  sections: readonly JumpSection[];
  choices: readonly JumpChoice[];
  layouts: readonly JumpLayout[];
  themes: Readonly<Record<string, string>>;
  tags: readonly string[];
  diagnostics: readonly PackageDiagnostic[];
};

export type PackageSources = {
  id: string;
  logicalId?: string;
  source?: "builtin" | "imported" | "mock";
  exactHash: string;
  files: Readonly<Record<string, string>>;
};
