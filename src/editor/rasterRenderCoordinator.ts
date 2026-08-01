import type { RasterAssetEditorDocument } from "./assetEditorModel";
import type { RasterRenderClient } from "./rasterRenderClient";
import type { RasterRenderResult } from "./rasterRenderer";

export type RasterRenderOutcome =
  | { status: "complete"; result: RasterRenderResult }
  | { status: "failed"; error: unknown }
  | { status: "stale" };

export class RasterRenderCoordinator {
  private controller: AbortController | null = null;
  private generation = 0;

  constructor(private readonly client: Pick<RasterRenderClient, "render">) {}

  async render(
    document: RasterAssetEditorDocument,
  ): Promise<RasterRenderOutcome> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    try {
      const result = await this.client.render(document, controller.signal);
      if (generation !== this.generation || controller.signal.aborted)
        return { status: "stale" };
      return { status: "complete", result };
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted)
        return { status: "stale" };
      return { status: "failed", error };
    }
  }

  cancel() {
    this.controller?.abort();
    this.controller = null;
    this.generation += 1;
  }
}
