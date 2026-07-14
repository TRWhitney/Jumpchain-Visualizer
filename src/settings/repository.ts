import { invoke } from "@tauri-apps/api/core";
import type { ApplicationSettings } from "./model";
import {
  openApplicationDatabase,
  SETTINGS_STORE_NAME,
} from "../platform/indexedDb";

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

export class IndexedDbSettingsRepository implements SettingsRepository {
  async load() {
    const database = await openApplicationDatabase();
    return new Promise<unknown | null>((resolve, reject) => {
      const transaction = database.transaction(SETTINGS_STORE_NAME, "readonly");
      const request = transaction
        .objectStore(SETTINGS_STORE_NAME)
        .get("settings");
      request.onerror = () =>
        reject(request.error ?? new Error("Settings could not be read."));
      request.onsuccess = () => resolve(request.result ?? null);
      transaction.oncomplete = () => database.close();
    });
  }
  async save(settings: ApplicationSettings) {
    const database = await openApplicationDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        SETTINGS_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(SETTINGS_STORE_NAME).put(settings, "settings");
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
