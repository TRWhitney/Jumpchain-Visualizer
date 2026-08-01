import { invoke } from "@tauri-apps/api/core";
import type { BodyModState } from "../supplements/bodyMod";
import type { EnabledModules, ModuleId } from "../supplements/model";
import type { SupplementState } from "../supplements/supplementState";
import {
  EARTH_ENTRY_ID,
  EARTH_ENTRY_STATUS,
  type ChainEntry,
  type TrackerState,
} from "./model";
import type { JumpRuntimeState } from "../domain";
import type { ChainEvaluation } from "../domain";
import { evaluateTracker } from "./evaluateTracker";
import {
  CHAINS_STORE_NAME,
  completeObjectStoreTransaction,
  requestObjectStore,
} from "../platform/indexedDb";
import { ClonedMapStore } from "../platform/memoryStore";
import { isTauriRuntime } from "../platform/runtime";

export const CHAIN_SCHEMA_VERSION = 3 as const;

export type ChainAggregate = {
  schemaVersion: typeof CHAIN_SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  lastOpenedSequence: number;
  lastOpenedLabel: string;
  starred?: boolean;
  entries: Record<string, ChainEntry>;
  order: string[];
  jumpState: JumpRuntimeState;
  enabledSupplements: EnabledModules;
  supplementPage: "manage" | ModuleId;
  bodyMod: BodyModState;
  supplements: SupplementState;
  entrySupplements: TrackerState["entrySupplements"];
  lastValidatedEvaluation: ChainEvaluation;
  selectedEntryId: string;
  inspectionPointId: string;
  nextEntrySerial: number;
};

export interface ChainRepository {
  list(): Promise<readonly ChainAggregate[]>;
  isInitialized(): Promise<boolean>;
  load(id: string): Promise<ChainAggregate | null>;
  save(value: ChainAggregate): Promise<void>;
  remove(id: string): Promise<void>;
}

const CHAIN_REGISTRY_SENTINEL_ID = "__chain_registry_initialized__";

const normalizeSystemEntries = (
  entries: Record<string, ChainEntry>,
): Record<string, ChainEntry> => ({
  ...entries,
  [EARTH_ENTRY_ID]: {
    ...entries[EARTH_ENTRY_ID],
    status: EARTH_ENTRY_STATUS,
  },
});

export function aggregateFromTracker(
  id: string,
  state: TrackerState,
  metadata?: {
    description: string;
    lastOpenedSequence: number;
    lastOpenedLabel: string;
    starred?: boolean;
  },
): ChainAggregate {
  return {
    schemaVersion: CHAIN_SCHEMA_VERSION,
    id,
    name: state.chainName,
    description:
      metadata?.description ?? "A chain saved by Jumpchain Visualizer.",
    lastOpenedSequence: metadata?.lastOpenedSequence ?? 0,
    lastOpenedLabel: metadata?.lastOpenedLabel ?? "Saved",
    starred: metadata?.starred ?? false,
    entries: normalizeSystemEntries(state.entries),
    order: state.order,
    jumpState: state.jumpState,
    enabledSupplements: state.enabledSupplements,
    supplementPage: state.supplementPage,
    bodyMod: state.bodyMod,
    supplements: state.supplements,
    entrySupplements: state.entrySupplements,
    lastValidatedEvaluation: evaluateTracker(
      state,
      state.enabledSupplements["body-mod"] ? state.bodyMod : null,
    ),
    selectedEntryId: state.selectedEntryId,
    inspectionPointId: state.inspectionPointId,
    nextEntrySerial: state.nextEntrySerial,
  };
}

export function applyAggregate(
  base: TrackerState,
  aggregate: ChainAggregate,
): TrackerState {
  if (!isChainAggregate(aggregate))
    throw new Error("Stored chain aggregate is invalid.");
  return {
    ...base,
    chainName: aggregate.name,
    entries: normalizeSystemEntries(aggregate.entries),
    order: aggregate.order,
    jumpState: aggregate.jumpState,
    enabledSupplements: aggregate.enabledSupplements,
    supplementPage: aggregate.supplementPage,
    bodyMod: aggregate.bodyMod,
    supplements: aggregate.supplements,
    entrySupplements: aggregate.entrySupplements ?? {},
    lastValidatedEvaluation: aggregate.lastValidatedEvaluation,
    selectedEntryId: aggregate.selectedEntryId,
    inspectionPointId: aggregate.inspectionPointId,
    nextEntrySerial: aggregate.nextEntrySerial,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function validActorControlState(value: unknown) {
  if (!isRecord(value)) return false;
  const choices = value.choices;
  const inputs = value.inputs;
  const sourceSelections = value.sourceSelections;
  if (!isRecord(choices) || !isRecord(inputs) || !isRecord(sourceSelections))
    return false;
  const scalar = (item: unknown) =>
    item === null ||
    typeof item === "boolean" ||
    (typeof item === "string" && item.length <= 10_000) ||
    (typeof item === "number" && Number.isSafeInteger(item));
  const stringList = (item: unknown) =>
    Array.isArray(item) &&
    item.length <= 1000 &&
    item.every(
      (entry) =>
        typeof entry === "string" && entry.length > 0 && entry.length <= 500,
    ) &&
    new Set(item).size === item.length;
  return (
    Object.values(choices).every((item) => scalar(item) || stringList(item)) &&
    Object.values(inputs).every(
      (owner) => isRecord(owner) && Object.values(owner).every(scalar),
    ) &&
    Object.values(sourceSelections).every(stringList)
  );
}

export function isChainAggregate(value: unknown): value is ChainAggregate {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ChainAggregate>;
  let encodedLength: number;
  try {
    encodedLength = JSON.stringify(value).length;
  } catch {
    return false;
  }
  const entries = item.entries ?? {};
  const entryKeys = Object.keys(entries);
  const order = item.order ?? [];
  const jumpState = isRecord(item.jumpState) ? item.jumpState : {};
  const validEntries = entryKeys.every((key) => {
    const entry = entries[key];
    return (
      entry &&
      entry.id === key &&
      (entry.kind === "earth" || entry.kind === "jump") &&
      typeof entry.packageId === "string" &&
      typeof entry.packageExactHash === "string" &&
      entry.packageExactHash.length > 0 &&
      entry.packageExactHash.length <= 200 &&
      typeof entry.status === "string"
    );
  });
  return (
    encodedLength <= 16 * 1024 * 1024 &&
    item.schemaVersion === CHAIN_SCHEMA_VERSION &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    item.id.length <= 200 &&
    typeof item.name === "string" &&
    item.name.length <= 500 &&
    typeof item.description === "string" &&
    item.description.length <= 10_000 &&
    typeof item.lastOpenedSequence === "number" &&
    Number.isSafeInteger(item.lastOpenedSequence) &&
    typeof item.lastOpenedLabel === "string" &&
    item.lastOpenedLabel.length <= 500 &&
    (item.starred === undefined || typeof item.starred === "boolean") &&
    Array.isArray(item.order) &&
    order.length > 0 &&
    order.length <= 1000 &&
    order[0] === EARTH_ENTRY_ID &&
    new Set(order).size === order.length &&
    entryKeys.length === order.length &&
    order.every((id) => typeof id === "string" && Boolean(entries[id])) &&
    entries[EARTH_ENTRY_ID]?.kind === "earth" &&
    validEntries &&
    Boolean(item.jumpState && typeof item.jumpState === "object") &&
    Boolean(
      item.lastValidatedEvaluation &&
      typeof item.lastValidatedEvaluation === "object",
    ) &&
    order.every((id) => {
      const entryState = jumpState[id];
      if (!isRecord(entryState) || !isRecord(entryState.actors)) return false;
      return Object.values(entryState.actors).every(validActorControlState);
    }) &&
    typeof item.selectedEntryId === "string" &&
    order.includes(item.selectedEntryId) &&
    typeof item.inspectionPointId === "string" &&
    order.includes(item.inspectionPointId) &&
    typeof item.nextEntrySerial === "number"
  );
}

export class MemoryChainRepository implements ChainRepository {
  private readonly values: ClonedMapStore<ChainAggregate>;
  private initialized: boolean;
  constructor(seed: readonly ChainAggregate[] = []) {
    this.values = new ClonedMapStore(seed, (item) => item.id);
    this.initialized = seed.length > 0;
  }
  async list() {
    return this.values.list();
  }
  async isInitialized() {
    return this.initialized;
  }
  async load(id: string) {
    return this.values.get(id);
  }
  async save(value: ChainAggregate) {
    if (!isChainAggregate(value)) throw new Error("Invalid chain aggregate.");
    this.initialized = true;
    this.values.set(value.id, value);
  }
  async remove(id: string) {
    this.initialized = true;
    this.values.delete(id);
  }
}

export class IndexedDbChainRepository implements ChainRepository {
  private async request<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ) {
    return requestObjectStore(
      CHAINS_STORE_NAME,
      mode,
      operation,
      () => new Error("Chain storage operation failed."),
    );
  }
  async list() {
    const values = await this.request<unknown[]>("readonly", (store) =>
      store.getAll(),
    );
    return values.filter(isChainAggregate);
  }
  async isInitialized() {
    return (
      (await this.request<number>("readonly", (store) => store.count())) > 0
    );
  }
  async load(id: string) {
    const value = await this.request<ChainAggregate | undefined>(
      "readonly",
      (store) => store.get(id),
    );
    return isChainAggregate(value) ? value : null;
  }
  async save(value: ChainAggregate) {
    if (!isChainAggregate(value)) throw new Error("Invalid chain aggregate.");
    await this.request<IDBValidKey>("readwrite", (store) => store.put(value));
  }
  async remove(id: string) {
    return completeObjectStoreTransaction(
      CHAINS_STORE_NAME,
      (store) => {
        store.delete(id);
        store.put({ id: CHAIN_REGISTRY_SENTINEL_ID });
      },
      (cause) => cause ?? new Error("Chain could not be removed."),
    );
  }
}

export class TauriChainRepository implements ChainRepository {
  async list() {
    const values = await invoke<unknown>("load_chains");
    return Array.isArray(values) ? values.filter(isChainAggregate) : [];
  }
  async load(id: string) {
    return (await this.list()).find((item) => item.id === id) ?? null;
  }
  async isInitialized() {
    return invoke<boolean>("chains_initialized");
  }
  async save(value: ChainAggregate) {
    if (!isChainAggregate(value)) throw new Error("Invalid chain aggregate.");
    await invoke("save_chain", { payload: JSON.stringify(value) });
  }
  async remove(id: string) {
    await invoke("remove_chain", { id });
  }
}

export function createPlatformChainRepository(): ChainRepository {
  return isTauriRuntime()
    ? new TauriChainRepository()
    : new IndexedDbChainRepository();
}
