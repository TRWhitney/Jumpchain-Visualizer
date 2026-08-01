import { invoke } from "@tauri-apps/api/core";
import type { ApplicationSettings } from "./model";
import {
  completeObjectStoreTransaction,
  requestObjectStore,
  SETTINGS_STORE_NAME,
} from "../platform/indexedDb";
import { ClonedValueStore } from "../platform/memoryStore";
import { isTauriRuntime } from "../platform/runtime";

export { isTauriRuntime } from "../platform/runtime";

export interface SettingsRepository {
  load(): Promise<unknown | null>;
  save(settings: ApplicationSettings): Promise<void>;
}

export class MemorySettingsRepository implements SettingsRepository {
  readonly #store: ClonedValueStore<unknown | null>;
  constructor(value: unknown | null = null) {
    this.#store = new ClonedValueStore(value);
  }
  async load() {
    return this.#store.read();
  }
  async save(settings: ApplicationSettings) {
    this.#store.write(settings);
  }
}

export class IndexedDbSettingsRepository implements SettingsRepository {
  async load() {
    return (
      (await requestObjectStore(
        SETTINGS_STORE_NAME,
        "readonly",
        (store) => store.get("settings"),
        (cause) => cause ?? new Error("Settings could not be read."),
      )) ?? null
    );
  }
  async save(settings: ApplicationSettings) {
    return completeObjectStoreTransaction(
      SETTINGS_STORE_NAME,
      (store) => store.put(settings, "settings"),
      (cause) => cause ?? new Error("Settings could not be saved."),
    );
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
