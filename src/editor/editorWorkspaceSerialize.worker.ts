/// <reference lib="webworker" />

import { stringifyBinaryJson } from "./binaryJson";
import type { EditorWorkspaceSnapshot } from "./model";

self.addEventListener(
  "message",
  (event: MessageEvent<{ workspace: EditorWorkspaceSnapshot }>) => {
    try {
      self.postMessage({ payload: stringifyBinaryJson(event.data.workspace) });
    } catch (error: unknown) {
      self.postMessage({
        error:
          error instanceof Error
            ? error.message
            : "Editor workspace serialization failed.",
      });
    }
  },
);

export {};
