import { describe, expect, it } from "vitest";
import { createRasterEditorDocument } from "./assetEditorModel";
import { RasterRenderClient } from "./rasterRenderClient";

class FakeWorker {
  readonly messages: unknown[] = [];
  private listener:
    ((event: MessageEvent<Record<string, unknown>>) => void) | null = null;

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<Record<string, unknown>>) => void,
  ) {
    this.listener = listener;
  }
  removeEventListener() {
    this.listener = null;
  }
  postMessage(message: unknown) {
    this.messages.push(message);
  }
  emit(data: Record<string, unknown>) {
    this.listener?.({ data } as MessageEvent<Record<string, unknown>>);
  }
  terminate() {}
}

describe("raster render client", () => {
  it("cancels stale worker generations and rejects their pending commit", async () => {
    const worker = new FakeWorker();
    const client = new RasterRenderClient(() => worker as unknown as Worker);
    const controller = new AbortController();
    const pending = client.render(
      createRasterEditorDocument(
        "png",
        Uint8Array.from([137, 80, 78, 71]),
        1,
        1,
      ),
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.messages).toEqual([
      expect.objectContaining({ type: "render", generation: 1 }),
      { type: "cancel", generation: 1 },
    ]);
    let staleBitmapClosed = false;
    worker.emit({
      type: "complete",
      generation: 1,
      result: {
        bitmap: {
          close: () => {
            staleBitmapClosed = true;
          },
        },
        width: 1,
        height: 1,
      },
    });
    expect(staleBitmapClosed).toBe(true);
    client.dispose();
  });

  it("sends bounded correction proxies to a separate worker request", async () => {
    const worker = new FakeWorker();
    const client = new RasterRenderClient(() => worker as unknown as Worker);
    const document = createRasterEditorDocument(
      "png",
      Uint8Array.from([137, 80, 78, 71]),
      80,
      48,
    );
    document.corrections.temperature = -24;
    const proxySource = {
      baseBytes: document.baseBytes,
      baseWidth: document.baseWidth,
      baseHeight: document.baseHeight,
      corrections: document.corrections,
      format: document.format,
    };
    const pending = client.renderProxy(proxySource, 40, 24);
    expect(worker.messages).toEqual([
      expect.objectContaining({
        type: "render-proxy",
        generation: 1,
        width: 40,
        height: 24,
        document: proxySource,
      }),
    ]);
    const bitmap = { close: () => undefined } as unknown as ImageBitmap;
    worker.emit({
      type: "complete",
      generation: 1,
      result: { bitmap, width: 40, height: 24 },
    });
    await expect(pending).resolves.toEqual({ bitmap, width: 40, height: 24 });
    client.dispose();
  });
});
