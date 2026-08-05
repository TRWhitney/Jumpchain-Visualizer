import { invoke } from "@tauri-apps/api/core";
import type { PackageSizeLimits } from "../archive/packageLimits";
import { ABSOLUTE_PACKAGE_SIZE_LIMITS } from "../archive/packageLimits";
import {
  CHAIN_PACKAGES_STORE_NAME,
  completeObjectStoreTransaction,
  requestObjectStore,
} from "../platform/indexedDb";
import { isTauriRuntime } from "../platform/runtime";

export type StoredChainPackage = {
  key: string;
  chainId: string;
  id: string;
  archive: Uint8Array;
  limits: Readonly<PackageSizeLimits>;
};

export interface ChainPackageRepository {
  list(chainId: string): Promise<readonly StoredChainPackage[]>;
  save(value: StoredChainPackage): Promise<void>;
  remove(chainId: string, id: string): Promise<void>;
  removeChain(chainId: string): Promise<void>;
}

const safeId = (value: string) =>
  value.length > 0 && value.length <= 200 && /^[A-Za-z0-9_-]+$/.test(value);

const validLimit = (value: unknown, maximum: number) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= maximum;

export function chainPackageKey(chainId: string, id: string) {
  return `${chainId}\0${id}`;
}

export function isStoredChainPackage(
  value: unknown,
): value is StoredChainPackage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoredChainPackage>;
  const limits = item.limits;
  return (
    safeId(item.chainId ?? "") &&
    safeId(item.id ?? "") &&
    item.key === chainPackageKey(item.chainId ?? "", item.id ?? "") &&
    item.archive instanceof Uint8Array &&
    item.archive.byteLength > 0 &&
    Boolean(limits) &&
    validLimit(
      limits?.maxArchiveMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxArchiveMiB,
    ) &&
    validLimit(
      limits?.maxDefinitionFileMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxDefinitionFileMiB,
    ) &&
    validLimit(
      limits?.maxAssetFileMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxAssetFileMiB,
    ) &&
    validLimit(
      limits?.maxExpandedPackageMiB,
      ABSOLUTE_PACKAGE_SIZE_LIMITS.maxExpandedPackageMiB,
    ) &&
    item.archive.byteLength <= limits!.maxArchiveMiB * 1024 * 1024
  );
}

export function storedChainPackage(
  chainId: string,
  id: string,
  archive: Uint8Array,
  limits: Readonly<PackageSizeLimits>,
): StoredChainPackage {
  const value = {
    key: chainPackageKey(chainId, id),
    chainId,
    id,
    archive: archive.slice(),
    limits: { ...limits },
  };
  if (!isStoredChainPackage(value))
    throw new Error("Invalid stored chain package.");
  return value;
}

export class MemoryChainPackageRepository implements ChainPackageRepository {
  private readonly values = new Map<string, StoredChainPackage>();

  async list(chainId: string) {
    return [...this.values.values()]
      .filter((item) => item.chainId === chainId)
      .map((item) => structuredClone(item));
  }

  async save(value: StoredChainPackage) {
    if (!isStoredChainPackage(value))
      throw new Error("Invalid stored chain package.");
    this.values.set(value.key, structuredClone(value));
  }

  async remove(chainId: string, id: string) {
    this.values.delete(chainPackageKey(chainId, id));
  }

  async removeChain(chainId: string) {
    for (const [key, value] of this.values)
      if (value.chainId === chainId) this.values.delete(key);
  }
}

export class IndexedDbChainPackageRepository implements ChainPackageRepository {
  private async request<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ) {
    return requestObjectStore(
      CHAIN_PACKAGES_STORE_NAME,
      mode,
      operation,
      () => new Error("Imported Jump storage operation failed."),
    );
  }

  async list(chainId: string) {
    const values = await this.request<unknown[]>("readonly", (store) =>
      store.index("chainId").getAll(chainId),
    );
    return values.filter(isStoredChainPackage);
  }

  async save(value: StoredChainPackage) {
    if (!isStoredChainPackage(value))
      throw new Error("Invalid stored chain package.");
    await this.request<IDBValidKey>("readwrite", (store) => store.put(value));
  }

  async remove(chainId: string, id: string) {
    await this.request<undefined>("readwrite", (store) =>
      store.delete(chainPackageKey(chainId, id)),
    );
  }

  async removeChain(chainId: string) {
    const values = await this.list(chainId);
    await completeObjectStoreTransaction(
      CHAIN_PACKAGES_STORE_NAME,
      (store) => {
        for (const value of values) store.delete(value.key);
      },
      (cause) => cause ?? new Error("Imported Jumps could not be removed."),
    );
  }
}

export class TauriChainPackageRepository implements ChainPackageRepository {
  async list(chainId: string) {
    const metadata = await invoke<unknown>("list_chain_packages", { chainId });
    if (!Array.isArray(metadata)) return [];
    const values = await Promise.all(
      metadata.map(async (value) => {
        try {
          if (!value || typeof value !== "object") return null;
          const item = value as Omit<StoredChainPackage, "key" | "archive">;
          const bytes = await invoke<ArrayBuffer | Uint8Array | number[]>(
            "load_chain_package",
            { chainId: item.chainId, id: item.id },
          );
          const archive =
            bytes instanceof Uint8Array
              ? bytes
              : bytes instanceof ArrayBuffer
                ? new Uint8Array(bytes)
                : new Uint8Array(bytes);
          const stored = {
            ...item,
            key: chainPackageKey(item.chainId, item.id),
            archive,
          };
          return isStoredChainPackage(stored) ? stored : null;
        } catch {
          return null;
        }
      }),
    );
    return values.filter((item): item is StoredChainPackage => item !== null);
  }

  async save(value: StoredChainPackage) {
    if (!isStoredChainPackage(value))
      throw new Error("Invalid stored chain package.");
    const metadata = new TextEncoder().encode(
      JSON.stringify({
        chainId: value.chainId,
        id: value.id,
        limits: value.limits,
      }),
    );
    const payload = new Uint8Array(
      4 + metadata.byteLength + value.archive.byteLength,
    );
    new DataView(payload.buffer).setUint32(0, metadata.byteLength, true);
    payload.set(metadata, 4);
    payload.set(value.archive, 4 + metadata.byteLength);
    await invoke("save_chain_package", payload);
  }

  async remove(chainId: string, id: string) {
    await invoke("remove_chain_package", { chainId, id });
  }

  async removeChain(chainId: string) {
    await invoke("remove_chain_packages", { chainId });
  }
}

export function createPlatformChainPackageRepository(): ChainPackageRepository {
  return isTauriRuntime()
    ? new TauriChainPackageRepository()
    : new IndexedDbChainPackageRepository();
}
