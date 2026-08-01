import { describe, expect, it } from "vitest";
import { createRasterEditorDocument } from "./assetEditorModel";
import { RasterRenderCoordinator } from "./rasterRenderCoordinator";
import type { RasterRenderResult } from "./rasterRenderer";

const document = () =>
  createRasterEditorDocument("png", Uint8Array.from([137, 80, 78, 71]), 1, 1);

describe("RasterRenderCoordinator", () => {
  it("aborts and suppresses an older generation before publishing the next", async () => {
    const pending: Array<{
      signal?: AbortSignal;
      resolve: (result: RasterRenderResult) => void;
    }> = [];
    const coordinator = new RasterRenderCoordinator({
      render: (_document, signal) =>
        new Promise<RasterRenderResult>((resolve) => {
          pending.push({ signal, resolve });
        }),
    });
    const first = coordinator.render(document());
    const second = coordinator.render(document());
    expect(pending[0].signal?.aborted).toBe(true);
    pending[0].resolve({
      bytes: Uint8Array.of(1),
      width: 1,
      height: 1,
      mime: "image/png",
    });
    pending[1].resolve({
      bytes: Uint8Array.of(2),
      width: 1,
      height: 1,
      mime: "image/png",
    });
    await expect(first).resolves.toEqual({ status: "stale" });
    await expect(second).resolves.toMatchObject({
      status: "complete",
      result: { bytes: Uint8Array.of(2) },
    });
  });

  it("distinguishes current failures from explicitly cancelled work", async () => {
    const failure = new Error("render failed");
    const failed = new RasterRenderCoordinator({
      render: () => Promise.reject(failure),
    });
    await expect(failed.render(document())).resolves.toEqual({
      status: "failed",
      error: failure,
    });

    let resolve!: (result: RasterRenderResult) => void;
    const cancelled = new RasterRenderCoordinator({
      render: () =>
        new Promise<RasterRenderResult>((next) => {
          resolve = next;
        }),
    });
    const pending = cancelled.render(document());
    cancelled.cancel();
    resolve({
      bytes: Uint8Array.of(3),
      width: 1,
      height: 1,
      mime: "image/png",
    });
    await expect(pending).resolves.toEqual({ status: "stale" });
  });
});
