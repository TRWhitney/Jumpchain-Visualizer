/// <reference lib="webworker" />

import { encodeBinaryJson } from "./binaryJson";
import type { EditorWorkspaceSnapshot } from "./model";

self.addEventListener(
  "message",
  (event: MessageEvent<{ workspace: EditorWorkspaceSnapshot }>) => {
    try {
      const payload = encodeBinaryJson(event.data.workspace);
      self.postMessage({ payload }, { transfer: [payload.buffer] });
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
