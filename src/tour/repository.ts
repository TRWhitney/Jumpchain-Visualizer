import { invoke } from "@tauri-apps/api/core";
import {
  openApplicationDatabase,
  WELCOME_TOUR_STORE_NAME,
} from "../platform/indexedDb";
import { isTauriRuntime } from "../settings/repository";
import { isWelcomeTourSession, type WelcomeTourSessionV1 } from "./model";

const TOUR_SESSION_KEY = "active";
const TOUR_SESSION_MAX_BYTES = 2 * 1024 * 1024;
const TOUR_SESSION_PENDING_MIRROR_KEY =
  "jumpchain-visualizer:welcome-tour-pending";

export interface WelcomeTourSessionRepository {
  load(): Promise<WelcomeTourSessionV1 | null>;
  save(session: WelcomeTourSessionV1): Promise<void>;
  clear(): Promise<void>;
}

function checkedSession(value: unknown): WelcomeTourSessionV1 | null {
  if (!isWelcomeTourSession(value)) return null;
  if (
    new TextEncoder().encode(JSON.stringify(value)).length >
    TOUR_SESSION_MAX_BYTES
  )
    return null;
  return value;
}

function pendingBrowserSession() {
  try {
    const serialized = localStorage.getItem(TOUR_SESSION_PENDING_MIRROR_KEY);
    return serialized ? checkedSession(JSON.parse(serialized)) : null;
  } catch {
    return null;
  }
}

export function stageWelcomeTourSession(session: WelcomeTourSessionV1) {
  if (isTauriRuntime()) return;
  const checked = checkedSession(session);
  if (!checked) throw new Error("Welcome tour session is invalid.");
  try {
    localStorage.setItem(
      TOUR_SESSION_PENDING_MIRROR_KEY,
      JSON.stringify(checked),
    );
  } catch {
    // IndexedDB remains the durable store when synchronous staging is full.
  }
}

export class MemoryWelcomeTourSessionRepository implements WelcomeTourSessionRepository {
  constructor(private value: WelcomeTourSessionV1 | null = null) {}

  async load() {
    return this.value ? structuredClone(this.value) : null;
  }

  async save(session: WelcomeTourSessionV1) {
    const checked = checkedSession(session);
    if (!checked) throw new Error("Welcome tour session is invalid.");
    this.value = structuredClone(checked);
  }

  async clear() {
    this.value = null;
  }
}

export class IndexedDbWelcomeTourSessionRepository implements WelcomeTourSessionRepository {
  async load() {
    const database = await openApplicationDatabase();
    return new Promise<WelcomeTourSessionV1 | null>((resolve, reject) => {
      const transaction = database.transaction(
        WELCOME_TOUR_STORE_NAME,
        "readonly",
      );
      const request = transaction
        .objectStore(WELCOME_TOUR_STORE_NAME)
        .get(TOUR_SESSION_KEY);
      request.onerror = () =>
        reject(request.error ?? new Error("Welcome tour could not be read."));
      request.onsuccess = () => {
        const stored = checkedSession(request.result);
        const pending = pendingBrowserSession();
        resolve(
          pending && (!stored || pending.revision > stored.revision)
            ? pending
            : stored,
        );
      };
      transaction.oncomplete = () => database.close();
    });
  }

  async save(session: WelcomeTourSessionV1) {
    const checked = checkedSession(session);
    if (!checked) throw new Error("Welcome tour session is invalid.");
    const database = await openApplicationDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        WELCOME_TOUR_STORE_NAME,
        "readwrite",
      );
      transaction
        .objectStore(WELCOME_TOUR_STORE_NAME)
        .put(checked, TOUR_SESSION_KEY);
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Welcome tour could not be saved."),
        );
      transaction.oncomplete = () => {
        database.close();
        const pending = pendingBrowserSession();
        if (pending && pending.revision <= checked.revision)
          localStorage.removeItem(TOUR_SESSION_PENDING_MIRROR_KEY);
        resolve();
      };
    });
  }

  async clear() {
    localStorage.removeItem(TOUR_SESSION_PENDING_MIRROR_KEY);
    const database = await openApplicationDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        WELCOME_TOUR_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(WELCOME_TOUR_STORE_NAME).delete(TOUR_SESSION_KEY);
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Welcome tour could not be cleared."),
        );
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    });
  }
}

export class TauriWelcomeTourSessionRepository implements WelcomeTourSessionRepository {
  async load() {
    return checkedSession(await invoke<unknown>("load_welcome_tour_session"));
  }

  async save(session: WelcomeTourSessionV1) {
    const checked = checkedSession(session);
    if (!checked) throw new Error("Welcome tour session is invalid.");
    await invoke("save_welcome_tour_session", {
      payload: JSON.stringify(checked),
    });
  }

  async clear() {
    await invoke("clear_welcome_tour_session");
  }
}

export const createWelcomeTourSessionRepository =
  (): WelcomeTourSessionRepository =>
    isTauriRuntime()
      ? new TauriWelcomeTourSessionRepository()
      : new IndexedDbWelcomeTourSessionRepository();
