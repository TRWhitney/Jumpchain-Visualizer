/// <reference lib="webworker" />

import {
  EDITOR_WORKSPACES_STORE_NAME,
  openApplicationDatabase,
} from "../platform/indexedDb";
import type { EditorWorkspaceSnapshot } from "./model";

self.addEventListener(
  "message",
  async (event: MessageEvent<{ workspace: EditorWorkspaceSnapshot }>) => {
    try {
      const database = await openApplicationDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          EDITOR_WORKSPACES_STORE_NAME,
          "readwrite",
        );
        transaction
          .objectStore(EDITOR_WORKSPACES_STORE_NAME)
          .put(event.data.workspace);
        transaction.onerror = () =>
          reject(
            transaction.error ??
              new Error("Editor project could not be saved."),
          );
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
      });
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
