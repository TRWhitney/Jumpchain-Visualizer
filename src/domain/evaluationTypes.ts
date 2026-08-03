import type { CanonicalJumpPackage, ImageBlock, TextBlock } from "../markup";

export type ChoiceValue = boolean | string | number | readonly string[] | null;
export type InputValue = string | number | null;

export type RollRecord = {
  result: string | number;
  sequence: number;
};

export type ActorEntryState = {
  choices: Record<string, ChoiceValue>;
  inputs: Record<string, Record<string, InputValue>>;
  sourceSelections: Record<string, readonly string[]>;
  choiceRolls: Record<string, RollRecord>;
  sourceRolls: Record<string, RollRecord>;
};

export type AppliedGauntletSource = {
  id: string;
  kind: "user" | "supplement";
  label: string;
};

export type JumpEntryState = {
  actors: Record<string, ActorEntryState>;
  appliedGauntlet: readonly AppliedGauntletSource[];
};

export type JumpRuntimeState = Record<string, JumpEntryState>;

export type EvaluatedProperty = {
  value: string | number | boolean;
  sourceLabel: string;
  description?: string;
};

export type EvaluatedGauntletStatus = {
  active: boolean;
  native: boolean;
  sources: readonly {
    id: string;
    kind: "package" | "user" | "supplement";
    label: string;
  }[];
  startingPointContribution: number;
};

export type EvaluatedResource = {
  handle: string;
  name: string;
  abbreviation: string;
  starting: number;
  spent: number;
  granted: number;
  balance: number;
};

export type EvaluatedCost = {
  resource: string;
  originalAmount: number;
  resolvedAmount: number;
  mode: "flat" | "each";
  rankCount?: number;
  rolledAllowance?: number;
  discountBaseAmount?: number;
  discounts?: readonly {
    sourceChoiceHandle: string;
    mode: "flat" | "percent";
    amount: number;
  }[];
};

export type EvaluatedSection = {
  handle: string;
  lockScore: number;
  locked: boolean;
};

export type EvaluatedChoice = {
  handle: string;
  value: ChoiceValue;
  active: boolean;
  costs: readonly EvaluatedCost[];
  rolledResult?: string | number;
  rolledBySource: boolean;
  freeByRoll: boolean;
  continuityBaseline?: string | number;
  continuityFreeValues: readonly (string | number)[];
  derivedContinuity: boolean;
};

export type EvaluatedActorJump = {
  balance: number;
  resources: Readonly<Record<string, EvaluatedResource>>;
  properties: Partial<
    Record<
      "origin" | "species" | "location" | "gender" | "age" | string,
      EvaluatedProperty
    >
  >;
  choices: Readonly<Record<string, EvaluatedChoice>>;
  sections?: Readonly<Record<string, EvaluatedSection>>;
  traits: readonly EvaluatedGrantRecord[];
  diagnostics: readonly string[];
};

export type EvaluatedJumpEntry = {
  gauntlet: EvaluatedGauntletStatus;
  actors: Record<string, EvaluatedActorJump>;
};

export type EvaluatedJumpRuntime = Record<string, EvaluatedJumpEntry>;

export type EvaluatedActor = {
  id: string;
  name: string;
  role: "Jumper" | "Companion";
  acquisitionGender?: string;
  acquisitionAge?: number;
  joinedEntryId?: string;
  initials: string;
  summary: string;
};

export type EvaluatedGrantMeasure = {
  kind: "rank" | "quantity";
  value: number;
};

export type EvaluatedGrantRecord = {
  id: string;
  kind: "perk" | "item" | "trait";
  name: string;
  sourceEntryId: string;
  ownerActorId?: string;
  ownerFormId?: string;
  grantHandle: string;
  sourcePackageId: string;
  sourcePackageExactHash: string;
  tags: readonly string[];
  description: string;
  measure?: EvaluatedGrantMeasure;
  layout?: string;
  text?: readonly TextBlock[];
  images?: readonly ImageBlock[];
};

export type EvaluatedForm = {
  id: string;
  handle: string;
  name: string;
  sourceEntryId: string;
  ownerActorId: "jumper";
  description: string;
  initials: string;
  tags: readonly string[];
  perkRecordIds: readonly string[];
};

export type EvaluatedCompanion = {
  actorId: string;
  sourceEntryId: string;
  tags: readonly string[];
  perkRecordIds: readonly string[];
  itemRecordIds: readonly string[];
  importedEntryIds: readonly string[];
};

export type ChainEvaluation = {
  runtime: EvaluatedJumpRuntime;
  actors: Record<string, EvaluatedActor>;
  records: readonly EvaluatedGrantRecord[];
  forms: readonly EvaluatedForm[];
  companions: readonly EvaluatedCompanion[];
};

export type EvaluateChainInput = {
  order: readonly string[];
  packageIdByEntry: Readonly<Record<string, string>>;
  packages: Readonly<Record<string, CanonicalJumpPackage>>;
  jumpState: JumpRuntimeState;
  jumperName: string;
  bodyModSpecies?: string;
  supplementPointGrants?: Readonly<Record<string, number>>;
  startingPointOverrides?: Readonly<Record<string, number>>;
  initialIdentity?: Partial<Record<string, EvaluatedProperty>>;
};
