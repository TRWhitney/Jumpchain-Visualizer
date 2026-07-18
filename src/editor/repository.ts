import { invoke } from "@tauri-apps/api/core";
import {
  EDITOR_WORKSPACES_STORE_NAME,
  openApplicationDatabase,
} from "../platform/indexedDb";
import { isTauriRuntime } from "../settings/repository";
import { hydrateEditorWorkspace, type EditorWorkspaceSnapshot } from "./model";

export interface EditorWorkspaceRepository {
  list(): Promise<EditorWorkspaceSnapshot[]>;
  load(id: string): Promise<EditorWorkspaceSnapshot | null>;
  save(workspace: EditorWorkspaceSnapshot): Promise<void>;
  remove(id: string): Promise<void>;
}

export class MemoryEditorWorkspaceRepository implements EditorWorkspaceRepository {
  #workspaces = new Map<string, EditorWorkspaceSnapshot>();

  constructor(initial: readonly EditorWorkspaceSnapshot[] = []) {
    for (const workspace of initial)
      this.#workspaces.set(workspace.id, structuredClone(workspace));
  }

  async list() {
    return [...this.#workspaces.values()].map((item) => structuredClone(item));
  }

  async load(id: string) {
    const workspace = this.#workspaces.get(id);
    return workspace ? structuredClone(workspace) : null;
  }

  async save(workspace: EditorWorkspaceSnapshot) {
    this.#workspaces.set(workspace.id, structuredClone(workspace));
  }

  async remove(id: string) {
    this.#workspaces.delete(id);
  }
}

export class IndexedDbEditorWorkspaceRepository implements EditorWorkspaceRepository {
  async list() {
    const database = await openApplicationDatabase();
    return new Promise<EditorWorkspaceSnapshot[]>((resolve, reject) => {
      const transaction = database.transaction(
        EDITOR_WORKSPACES_STORE_NAME,
        "readonly",
      );
      const request = transaction
        .objectStore(EDITOR_WORKSPACES_STORE_NAME)
        .getAll();
      request.onerror = () =>
        reject(
          request.error ?? new Error("Editor projects could not be read."),
        );
      request.onsuccess = () =>
        resolve(
          request.result.flatMap((value) => {
            const hydrated = hydrateEditorWorkspace(value);
            return hydrated ? [hydrated] : [];
          }),
        );
      transaction.oncomplete = () => database.close();
    });
  }

  async load(id: string) {
    const database = await openApplicationDatabase();
    return new Promise<EditorWorkspaceSnapshot | null>((resolve, reject) => {
      const transaction = database.transaction(
        EDITOR_WORKSPACES_STORE_NAME,
        "readonly",
      );
      const request = transaction
        .objectStore(EDITOR_WORKSPACES_STORE_NAME)
        .get(id);
      request.onerror = () =>
        reject(request.error ?? new Error("Editor project could not be read."));
      request.onsuccess = () => resolve(hydrateEditorWorkspace(request.result));
      transaction.oncomplete = () => database.close();
    });
  }

  async save(workspace: EditorWorkspaceSnapshot) {
    const database = await openApplicationDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        EDITOR_WORKSPACES_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(EDITOR_WORKSPACES_STORE_NAME).put(workspace);
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Editor project could not be saved."),
        );
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    });
  }

  async remove(id: string) {
    const database = await openApplicationDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        EDITOR_WORKSPACES_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(EDITOR_WORKSPACES_STORE_NAME).delete(id);
      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error("Editor project could not be removed."),
        );
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    });
  }
}

export class TauriEditorWorkspaceRepository implements EditorWorkspaceRepository {
  async list() {
    return invoke<EditorWorkspaceSnapshot[]>("list_editor_workspaces");
  }
  async load(id: string) {
    return invoke<EditorWorkspaceSnapshot | null>("load_editor_workspace", {
      id,
    });
  }
  async save(workspace: EditorWorkspaceSnapshot) {
    await invoke("save_editor_workspace", {
      payload: JSON.stringify(workspace),
    });
  }
  async remove(id: string) {
    await invoke("remove_editor_workspace", { id });
  }
}

export const createPlatformEditorWorkspaceRepository =
  (): EditorWorkspaceRepository =>
    isTauriRuntime()
      ? new TauriEditorWorkspaceRepository()
      : new IndexedDbEditorWorkspaceRepository();
