/// <reference lib="webworker" />

import {
  completeObjectStoreTransaction,
  EDITOR_WORKSPACES_STORE_NAME,
} from "../platform/indexedDb";
import type { EditorWorkspaceSnapshot } from "./model";

self.addEventListener(
  "message",
  async (event: MessageEvent<{ workspace: EditorWorkspaceSnapshot }>) => {
    try {
      await completeObjectStoreTransaction(
        EDITOR_WORKSPACES_STORE_NAME,
        (store) => store.put(event.data.workspace),
        (cause) => cause ?? new Error("Editor project could not be saved."),
      );
      self.postMessage({ type: "complete" });
    } catch (error) {
      self.postMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Editor project could not be saved.",
      });
    }
  },
);

export {};
