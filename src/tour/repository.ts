import { invoke } from "@tauri-apps/api/core";
import {
  completeObjectStoreTransaction,
  requestObjectStore,
  WELCOME_TOUR_STORE_NAME,
} from "../platform/indexedDb";
import { ClonedValueStore } from "../platform/memoryStore";
import { isTauriRuntime } from "../platform/runtime";
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
  readonly #store: ClonedValueStore<WelcomeTourSessionV1 | null>;
  constructor(value: WelcomeTourSessionV1 | null = null) {
    this.#store = new ClonedValueStore(value);
  }

  async load() {
    return this.#store.read();
  }

  async save(session: WelcomeTourSessionV1) {
    const checked = checkedSession(session);
    if (!checked) throw new Error("Welcome tour session is invalid.");
    this.#store.write(checked);
  }

  async clear() {
    this.#store.write(null);
  }
}

export class IndexedDbWelcomeTourSessionRepository implements WelcomeTourSessionRepository {
  async load() {
    const value = await requestObjectStore(
      WELCOME_TOUR_STORE_NAME,
      "readonly",
      (store) => store.get(TOUR_SESSION_KEY),
      (cause) => cause ?? new Error("Welcome tour could not be read."),
    );
    const stored = checkedSession(value);
    const pending = pendingBrowserSession();
    return pending && (!stored || pending.revision > stored.revision)
      ? pending
      : stored;
  }

  async save(session: WelcomeTourSessionV1) {
    const checked = checkedSession(session);
    if (!checked) throw new Error("Welcome tour session is invalid.");
    await completeObjectStoreTransaction(
      WELCOME_TOUR_STORE_NAME,
      (store) => store.put(checked, TOUR_SESSION_KEY),
      (cause) => cause ?? new Error("Welcome tour could not be saved."),
    );
    const pending = pendingBrowserSession();
    if (pending && pending.revision <= checked.revision)
      localStorage.removeItem(TOUR_SESSION_PENDING_MIRROR_KEY);
  }

  async clear() {
    localStorage.removeItem(TOUR_SESSION_PENDING_MIRROR_KEY);
    return completeObjectStoreTransaction(
      WELCOME_TOUR_STORE_NAME,
      (store) => store.delete(TOUR_SESSION_KEY),
      (cause) => cause ?? new Error("Welcome tour could not be cleared."),
    );
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
