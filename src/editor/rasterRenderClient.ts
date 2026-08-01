import type { RasterAssetEditorDocument } from "./assetEditorModel";
import {
  renderRasterDocument,
  renderRasterProxy,
  type RasterProxyRenderResult,
  type RasterProxySource,
  type RasterRenderResult,
} from "./rasterRenderer";

type WorkerRenderResult = RasterRenderResult | RasterProxyRenderResult;

type PendingRender = {
  resolve: (result: WorkerRenderResult) => void;
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
      result?: WorkerRenderResult;
      message?: string;
    }>,
  ) => {
    const pending = this.pending.get(event.data.generation);
    if (!pending) {
      if (event.data.result && "bitmap" in event.data.result)
        event.data.result.bitmap.close();
      return;
    }
    this.pending.delete(event.data.generation);
    pending.removeAbort();
    if (event.data.type === "complete" && event.data.result)
      pending.resolve(event.data.result);
    else pending.reject(new Error(event.data.message ?? "Rendering failed."));
  };

  private request<Result extends WorkerRenderResult>(
    message:
      | { type: "render"; document: RasterAssetEditorDocument }
      | {
          type: "render-proxy";
          document: RasterProxySource;
          width: number;
          height: number;
        },
    fallback: () => Promise<Result>,
    signal?: AbortSignal,
  ) {
    const generation = ++this.generation;
    if (!this.worker) return fallback();
    const worker = this.worker;
    return new Promise<Result>((resolve, reject) => {
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
        resolve: (result) => resolve(result as Result),
        reject,
        removeAbort: () => signal?.removeEventListener("abort", abort),
      });
      worker.postMessage({ ...message, generation });
    });
  }

  render(document: RasterAssetEditorDocument, signal?: AbortSignal) {
    return this.request(
      { type: "render", document },
      () => renderRasterDocument(document, signal),
      signal,
    );
  }

  renderProxy(
    document: RasterProxySource,
    width: number,
    height: number,
    signal?: AbortSignal,
  ) {
    return this.request(
      { type: "render-proxy", document, width, height },
      () => renderRasterProxy(document, width, height, signal),
      signal,
    );
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
