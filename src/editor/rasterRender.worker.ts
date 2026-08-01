/// <reference lib="webworker" />

import type { RasterAssetEditorDocument } from "./assetEditorModel";
import {
  renderRasterDocument,
  renderRasterProxy,
  type RasterProxySource,
} from "./rasterRenderer";

type RenderRequest =
  | {
      type: "render";
      generation: number;
      document: RasterAssetEditorDocument;
    }
  | {
      type: "render-proxy";
      generation: number;
      document: RasterProxySource;
      width: number;
      height: number;
    }
  | { type: "cancel"; generation: number };

const controllers = new Map<number, AbortController>();

self.addEventListener("message", (event: MessageEvent<RenderRequest>) => {
  if (event.data.type === "cancel") {
    controllers.get(event.data.generation)?.abort();
    return;
  }
  const { generation } = event.data;
  const controller = new AbortController();
  controllers.set(generation, controller);
  const rendering =
    event.data.type === "render-proxy"
      ? renderRasterProxy(
          event.data.document,
          event.data.width,
          event.data.height,
          controller.signal,
        )
      : renderRasterDocument(event.data.document, controller.signal);
  void rendering
    .then((result) => {
      if (controller.signal.aborted) return;
      const transfer =
        "bitmap" in result ? [result.bitmap] : [result.bytes.buffer];
      self.postMessage(
        {
          type: "complete",
          generation,
          result,
        },
        { transfer },
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
