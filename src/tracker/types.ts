import type {
  ChainEvaluation,
  ChoiceValue,
  EvaluatedGrantMeasure,
  JumpRuntimeState,
} from "../domain";
import type { TagCategory, TagDefinition } from "../domain/tags";
import type { CanonicalJumpPackage } from "../markup";
import type { BodyModState } from "../supplements/bodyMod";
import type { EnabledModules, ModuleId } from "../supplements/model";
import type {
  QuestState,
  RealityState,
  SupplementAction,
  SupplementState,
  UdsState,
} from "../supplements/supplementState";
import type { TrackerPage } from "./constants";

export type InstalledPackage = {
  id: string;
  logicalId: string;
  name: string;
  version: string;
  source: "builtin" | "imported" | "mock";
  description: string;
  tags: readonly string[];
  availability?: "library" | "foundation";
  exactHash?: string;
  authors?: readonly string[];
  nativeGauntlet?: boolean;
  document?: CanonicalJumpPackage;
  assets?: Readonly<Record<string, Uint8Array>>;
};

export type ChainEntry = {
  id: string;
  packageId: string;
  packageExactHash: string;
  kind: "earth" | "jump";
  status: string;
};

export type Actor = {
  id: string;
  name: string;
  role: "Jumper" | "Companion";
  acquisitionGender?: string;
  acquisitionAge?: number;
  joinedEntryId?: string;
  initials: string;
  summary: string;
};

export type IdentityProperty =
  "origin" | "species" | "location" | "gender" | "age";

export type InventoryRecord = {
  id: string;
  kind: "perk" | "item";
  name: string;
  sourceEntryId: string;
  ownerActorId?: string;
  ownerFormId?: string;
  grantHandle?: string;
  sourcePackageId?: string;
  sourcePackageExactHash?: string;
  tags: readonly string[];
  description: string;
  measure?: EvaluatedGrantMeasure;
  aggregateQuantity?: number;
  acquisitions?: readonly {
    recordId: string;
    sourceEntryId: string;
    description: string;
    quantity: number;
  }[];
};

export type FormRecord = {
  id: string;
  handle?: string;
  name: string;
  sourceEntryId: string;
  subtitle: string;
  description: string;
  initials: string;
  details: readonly string[];
  perkRecordIds: readonly string[];
};

export type CompanionRecord = {
  actorId: string;
  sourceEntryId: string;
  tags: readonly string[];
  perkRecordIds: readonly string[];
  itemRecordIds: readonly string[];
  importedEntryIds: readonly string[];
};

export type TrackerPreferences = {
  warnUpstreamChanges: boolean;
  allowMultiplePackageVersions: boolean;
  allowDuplicateJumps: boolean;
  allowNegativePointBalances: boolean;
  allowRerolls: boolean;
  includeItemTagsInRadar: boolean;
  aggregateSimilarInventory: boolean;
  showAdditionalJumpInformation: boolean;
  showMockData: boolean;
};

export type DependencyImpact = {
  kind: "companion-import";
  subjectId: string;
  providerEntryId: string;
  consumerEntryIds: readonly string[];
};

export type FormDependencyImpact = {
  kind: "form-perk";
  formHandle: string;
  dependentChoiceHandles: readonly string[];
};

export type PendingMutation =
  | {
      kind: "move";
      entryId: string;
      toIndex: number;
      impacts: readonly DependencyImpact[];
    }
  | {
      kind: "remove";
      entryId: string;
      impacts: readonly DependencyImpact[];
    }
  | {
      kind: "uninstall-package";
      packageId: string;
      entryIds: readonly string[];
      impacts: readonly DependencyImpact[];
    }
  | {
      kind: "clear-form";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      value: ChoiceValue;
      impacts: readonly FormDependencyImpact[];
    }
  | {
      kind: "clear-form-source";
      entryId: string;
      actorId: string;
      sourceKey: string;
      value: readonly string[];
      impacts: readonly FormDependencyImpact[];
    };

export type UndoSnapshot = {
  packages: Record<string, InstalledPackage>;
  entries: Record<string, ChainEntry>;
  order: string[];
  selectedEntryId: string;
  inspectionPointId: string;
  jumpState: JumpRuntimeState;
  entrySupplements: TrackerState["entrySupplements"];
  label: string;
};

export type TrackerState = {
  chainName: string;
  packages: Record<string, InstalledPackage>;
  entries: Record<string, ChainEntry>;
  order: string[];
  jumpState: JumpRuntimeState;
  enabledSupplements: EnabledModules;
  supplementPage: "manage" | ModuleId;
  bodyMod: BodyModState;
  supplements: SupplementState;
  entrySupplements: Record<
    string,
    {
      quest: QuestState;
      uds: UdsState;
      realityProgression?: RealityState["progression"];
    }
  >;
  lastValidatedEvaluation?: ChainEvaluation;
  actors: Record<string, Actor>;
  records: readonly InventoryRecord[];
  forms: readonly FormRecord[];
  companions: readonly CompanionRecord[];
  tags: Record<string, TagDefinition>;
  preferences: TrackerPreferences;
  selectedEntryId: string;
  inspectionPointId: string;
  page: TrackerPage;
  railPage: "chain" | "library";
  inventoryView: "search" | "stats";
  inventoryKind: "all" | "perk" | "item";
  inventoryTag: string;
  inventorySearch: string;
  librarySource: "all" | "builtin" | "imported" | "mock";
  librarySearch: string;
  radarSort: "count" | "tag";
  radarCategory: TagCategory | null;
  radarPath: string[];
  radarPoppedSlice: string | null;
  selectedRecordId: string | null;
  selectedFormId: string | null;
  selectedCompanionId: string | null;
  activeProfile: "form" | "companion" | null;
  pending: PendingMutation | null;
  undo: UndoSnapshot | null;
  nextEntrySerial: number;
};

export type TrackerAction =
  | {
      type: "apply-application-settings";
      preferences: TrackerPreferences;
      tags: Record<string, TagDefinition>;
    }
  | { type: "set-page"; page: TrackerPage }
  | { type: "set-rail-page"; page: "chain" | "library" }
  | { type: "select-entry"; entryId: string }
  | { type: "set-inspection"; entryId: string }
  | { type: "request-move"; entryId: string; toIndex: number }
  | { type: "request-remove"; entryId: string }
  | { type: "request-uninstall-package"; packageId: string }
  | { type: "cancel-mutation" }
  | { type: "commit-mutation" }
  | { type: "undo" }
  | { type: "dismiss-undo" }
  | { type: "install-package"; packageItem: InstalledPackage }
  | { type: "add-package"; packageId: string }
  | { type: "set-library-search"; value: string }
  | { type: "set-library-source"; value: TrackerState["librarySource"] }
  | { type: "set-inventory-view"; value: TrackerState["inventoryView"] }
  | { type: "set-inventory-kind"; value: TrackerState["inventoryKind"] }
  | { type: "set-inventory-tag"; value: string }
  | { type: "set-inventory-search"; value: string }
  | { type: "set-radar-sort"; value: TrackerState["radarSort"] }
  | { type: "select-radar-category"; value: TagCategory | null }
  | { type: "open-radar-node"; value: string }
  | { type: "set-radar-path"; value: string[] }
  | { type: "toggle-radar-slice"; value: string }
  | { type: "radar-back" }
  | { type: "open-record"; id: string | null }
  | { type: "select-form"; id: string | null }
  | { type: "select-companion"; id: string | null }
  | { type: "open-profile"; profile: TrackerState["activeProfile"] }
  | { type: "close-dialogs" }
  | {
      type: "set-choice";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      value: ChoiceValue;
    }
  | {
      type: "set-source-selections";
      entryId: string;
      actorId: string;
      sourceKey: string;
      mode: "single" | "multi";
      value: readonly string[];
    }
  | {
      type: "set-input";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      inputHandle: string;
      value: string | number | null;
    }
  | { type: "set-enabled-supplements"; value: EnabledModules }
  | { type: "set-supplement-page"; value: "manage" | ModuleId }
  | { type: "set-body-mod"; value: BodyModState }
  | { type: "supplement-action"; action: SupplementAction }
  | {
      type: "record-choice-roll";
      entryId: string;
      actorId: string;
      choiceHandle: string;
      result: string | number;
    }
  | {
      type: "record-source-roll";
      entryId: string;
      actorId: string;
      sourceKey: string;
      mode: "single" | "multi";
      result: string;
    }
  | { type: "toggle-applied-gauntlet"; entryId: string };
