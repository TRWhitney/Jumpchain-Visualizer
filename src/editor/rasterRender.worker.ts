/// <reference lib="webworker" />

import type { RasterAssetEditorDocument } from "./assetEditorModel";
import { renderRasterDocument } from "./rasterRenderer";

type RenderRequest =
  | {
      type: "render";
      generation: number;
      document: RasterAssetEditorDocument;
    }
  | { type: "cancel"; generation: number };

const controllers = new Map<number, AbortController>();

self.addEventListener("message", (event: MessageEvent<RenderRequest>) => {
  if (event.data.type === "cancel") {
    controllers.get(event.data.generation)?.abort();
    return;
  }
  const { generation, document } = event.data;
  const controller = new AbortController();
  controllers.set(generation, controller);
  void renderRasterDocument(document, controller.signal)
    .then((result) => {
      if (controller.signal.aborted) return;
      self.postMessage(
        {
          type: "complete",
          generation,
          result,
        },
        { transfer: [result.bytes.buffer] },
      );
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted) return;
      self.postMessage({
        type: "error",
        generation,
        message:
          error instanceof Error ? error.message : "Image rendering failed.",
      });
    })
    .finally(() => controllers.delete(generation));
});

export {};
