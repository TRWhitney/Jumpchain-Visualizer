import { invoke } from "@tauri-apps/api/core";
import {
  completeObjectStoreTransaction,
  EDITOR_WORKSPACES_STORE_NAME,
  requestObjectStore,
} from "../platform/indexedDb";
import { ClonedMapStore } from "../platform/memoryStore";
import { isTauriRuntime } from "../platform/runtime";
import { runOneShotWorker } from "../platform/workerRequest";
import { hydrateEditorWorkspace, type EditorWorkspaceSnapshot } from "./model";
import { stringifyBinaryJson } from "./binaryJson";

function serializeEditorWorkspace(workspace: EditorWorkspaceSnapshot) {
  if (typeof Worker === "undefined")
    return Promise.resolve(stringifyBinaryJson(workspace));
  return runOneShotWorker(
    new Worker(
      new URL("./editorWorkspaceSerialize.worker.ts", import.meta.url),
      { type: "module", name: "editor-workspace-serializer" },
    ),
    { workspace },
    (response: { payload?: string; error?: string }) => {
      if (response.payload) return response.payload;
      throw new Error(
        response.error ?? "Editor workspace serialization failed.",
      );
    },
    "Editor workspace serialization failed.",
  );
}

function persistEditorWorkspaceInWorker(workspace: EditorWorkspaceSnapshot) {
  if (typeof Worker === "undefined") return null;
  return runOneShotWorker(
    new Worker(new URL("./editorWorkspacePersist.worker.ts", import.meta.url), {
      type: "module",
      name: "editor-workspace-persistence",
    }),
    { workspace },
    (response: { type: "complete" | "error"; message?: string }) => {
      if (response.type === "complete") return;
      throw new Error(response.message ?? "Editor project could not be saved.");
    },
    "Editor project could not be saved.",
  );
}

export interface EditorWorkspaceRepository {
  list(): Promise<EditorWorkspaceSnapshot[]>;
  load(id: string): Promise<EditorWorkspaceSnapshot | null>;
  save(workspace: EditorWorkspaceSnapshot): Promise<void>;
  remove(id: string): Promise<void>;
}

export class MemoryEditorWorkspaceRepository implements EditorWorkspaceRepository {
  readonly #workspaces: ClonedMapStore<EditorWorkspaceSnapshot>;

  constructor(initial: readonly EditorWorkspaceSnapshot[] = []) {
    this.#workspaces = new ClonedMapStore(initial, (workspace) => workspace.id);
  }

  async list() {
    return this.#workspaces.list();
  }

  async load(id: string) {
    return this.#workspaces.get(id);
  }

  async save(workspace: EditorWorkspaceSnapshot) {
    this.#workspaces.set(workspace.id, workspace);
  }

  async remove(id: string) {
    this.#workspaces.delete(id);
  }
}

export class IndexedDbEditorWorkspaceRepository implements EditorWorkspaceRepository {
  async list() {
    const values = await requestObjectStore<unknown[]>(
      EDITOR_WORKSPACES_STORE_NAME,
      "readonly",
      (store) => store.getAll(),
      (cause) => cause ?? new Error("Editor projects could not be read."),
    );
    return values.flatMap((value) => {
      const hydrated = hydrateEditorWorkspace(value);
      return hydrated ? [hydrated] : [];
    });
  }

  async load(id: string) {
    const value = await requestObjectStore(
      EDITOR_WORKSPACES_STORE_NAME,
      "readonly",
      (store) => store.get(id),
      (cause) => cause ?? new Error("Editor project could not be read."),
    );
    return hydrateEditorWorkspace(value);
  }

  async save(workspace: EditorWorkspaceSnapshot) {
    const workerSave = persistEditorWorkspaceInWorker(workspace);
    if (workerSave) return workerSave;
    return completeObjectStoreTransaction(
      EDITOR_WORKSPACES_STORE_NAME,
      (store) => store.put(workspace),
      (cause) => cause ?? new Error("Editor project could not be saved."),
    );
  }

  async remove(id: string) {
    return completeObjectStoreTransaction(
      EDITOR_WORKSPACES_STORE_NAME,
      (store) => store.delete(id),
      (cause) => cause ?? new Error("Editor project could not be removed."),
    );
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
