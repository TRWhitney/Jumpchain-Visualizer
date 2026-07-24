import type { RasterAssetEditorDocument } from "./assetEditorModel";
import {
  renderRasterDocument,
  type RasterRenderResult,
} from "./rasterRenderer";

type PendingRender = {
  resolve: (result: RasterRenderResult) => void;
  reject: (error: Error) => void;
  removeAbort: () => void;
};

export class RasterRenderClient {
  private readonly worker: Worker | null;
  private readonly pending = new Map<number, PendingRender>();
  private generation = 0;

  constructor(
    workerFactory: (() => Worker) | null = typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
      ? () =>
          new Worker(new URL("./rasterRender.worker.ts", import.meta.url), {
            type: "module",
            name: "asset-raster-renderer",
          })
      : null,
  ) {
    this.worker = workerFactory?.() ?? null;
    this.worker?.addEventListener("message", this.handleMessage);
  }

  private readonly handleMessage = (
    event: MessageEvent<{
      type: "complete" | "error";
      generation: number;
      result?: RasterRenderResult;
      message?: string;
    }>,
  ) => {
    const pending = this.pending.get(event.data.generation);
    if (!pending) return;
    this.pending.delete(event.data.generation);
    pending.removeAbort();
    if (event.data.type === "complete" && event.data.result)
      pending.resolve(event.data.result);
    else pending.reject(new Error(event.data.message ?? "Rendering failed."));
  };

  render(document: RasterAssetEditorDocument, signal?: AbortSignal) {
    const generation = ++this.generation;
    if (!this.worker) return renderRasterDocument(document, signal);
    const worker = this.worker;
    return new Promise<RasterRenderResult>((resolve, reject) => {
      const abort = () => {
        worker.postMessage({ type: "cancel", generation });
        const pending = this.pending.get(generation);
        if (!pending) return;
        this.pending.delete(generation);
        reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new DOMException("Aborted", "AbortError"),
        );
      };
      signal?.addEventListener("abort", abort, { once: true });
      this.pending.set(generation, {
        resolve,
        reject,
        removeAbort: () => signal?.removeEventListener("abort", abort),
      });
      worker.postMessage({ type: "render", generation, document });
    });
  }

  dispose() {
    this.worker?.removeEventListener("message", this.handleMessage);
    this.worker?.terminate();
    for (const pending of this.pending.values()) {
      pending.removeAbort();
      pending.reject(new DOMException("Disposed", "AbortError"));
    }
    this.pending.clear();
  }
}
