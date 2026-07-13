import { invoke } from "@tauri-apps/api/core";
import type { ApplicationSettings } from "./model";

export interface SettingsRepository {
  load(): Promise<unknown | null>;
  save(settings: ApplicationSettings): Promise<void>;
}

export class MemorySettingsRepository implements SettingsRepository {
  constructor(private value: unknown | null = null) {}
  async load() {
    return structuredClone(this.value);
  }
  async save(settings: ApplicationSettings) {
    this.value = structuredClone(settings);
  }
}

const databaseName = "jumpchain-visualizer";
const storeName = "aggregates";

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
  });

export class IndexedDbSettingsRepository implements SettingsRepository {
  async load() {
    const database = await openDatabase();
    return new Promise<unknown | null>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get("settings");
      request.onerror = () =>
        reject(request.error ?? new Error("Settings could not be read."));
      request.onsuccess = () => resolve(request.result ?? null);
      transaction.oncomplete = () => database.close();
    });
  }
  async save(settings: ApplicationSettings) {
    const database = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(settings, "settings");
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Settings could not be saved."));
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    });
  }
}

export class TauriSettingsRepository implements SettingsRepository {
  async load() {
    return invoke<unknown | null>("load_settings");
  }
  async save(settings: ApplicationSettings) {
    await invoke("save_settings", { payload: JSON.stringify(settings) });
  }
}

export const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;
export const createSettingsRepository = (): SettingsRepository =>
  isTauriRuntime()
    ? new TauriSettingsRepository()
    : new IndexedDbSettingsRepository();

export interface ReportExporter {
  save(name: string, content: string): Promise<"saved" | "cancelled">;
}

export class BrowserReportExporter implements ReportExporter {
  async save(name: string, content: string) {
    const anchor = document.createElement("a");
    anchor.download = name;
    anchor.href = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return "saved" as const;
  }
}

export class TauriReportExporter implements ReportExporter {
  async save(name: string, content: string) {
    return invoke<"saved" | "cancelled">("save_diagnostic_report", {
      suggestedName: name,
      content,
    });
  }
}

export const createReportExporter = (): ReportExporter =>
  isTauriRuntime() ? new TauriReportExporter() : new BrowserReportExporter();
