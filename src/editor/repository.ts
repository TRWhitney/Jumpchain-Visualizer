import { invoke } from "@tauri-apps/api/core";
import {
  EDITOR_WORKSPACES_STORE_NAME,
  openApplicationDatabase,
} from "../platform/indexedDb";
import { isTauriRuntime } from "../settings/repository";
import { hydrateEditorWorkspace, type EditorWorkspaceSnapshot } from "./model";
import { stringifyBinaryJson } from "./binaryJson";

function serializeEditorWorkspace(workspace: EditorWorkspaceSnapshot) {
  if (typeof Worker === "undefined")
    return Promise.resolve(stringifyBinaryJson(workspace));
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(
      new URL("./editorWorkspaceSerialize.worker.ts", import.meta.url),
      { type: "module", name: "editor-workspace-serializer" },
    );
    const finish = () => worker.terminate();
    worker.addEventListener(
      "message",
      (event: MessageEvent<{ payload?: string; error?: string }>) => {
        finish();
        if (event.data.payload) resolve(event.data.payload);
        else
          reject(
            new Error(
              event.data.error ?? "Editor workspace serialization failed.",
            ),
          );
      },
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => {
        finish();
        reject(new Error("Editor workspace serialization failed."));
      },
      { once: true },
    );
    worker.postMessage({ workspace });
  });
}

function persistEditorWorkspaceInWorker(workspace: EditorWorkspaceSnapshot) {
  if (typeof Worker === "undefined") return null;
  return new Promise<void>((resolve, reject) => {
    const worker = new Worker(
      new URL("./editorWorkspacePersist.worker.ts", import.meta.url),
      { type: "module", name: "editor-workspace-persistence" },
    );
    const finish = () => worker.terminate();
    worker.addEventListener(
      "message",
      (
        event: MessageEvent<{ type: "complete" | "error"; message?: string }>,
      ) => {
        finish();
        if (event.data.type === "complete") resolve();
        else
          reject(
            new Error(
              event.data.message ?? "Editor project could not be saved.",
            ),
          );
      },
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => {
        finish();
        reject(new Error("Editor project could not be saved."));
      },
      { once: true },
    );
    worker.postMessage({ workspace });
  });
}

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
    const workerSave = persistEditorWorkspaceInWorker(workspace);
    if (workerSave) return workerSave;
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
    const values = await invoke<unknown[]>("list_editor_workspaces");
    return values.flatMap((value) => {
      const hydrated = hydrateEditorWorkspace(value);
      return hydrated ? [hydrated] : [];
    });
  }
  async load(id: string) {
    const value = await invoke<unknown>("load_editor_workspace", {
      id,
    });
    return hydrateEditorWorkspace(value);
  }
  async save(workspace: EditorWorkspaceSnapshot) {
    const payload = await serializeEditorWorkspace(workspace);
    await invoke("save_editor_workspace", {
      payload,
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
