import { describe, expect, it } from "vitest";
import { createRasterEditorDocument } from "./assetEditorModel";
import { renderCorrectedRasterProxy } from "./rasterCorrections";
import { renderRasterDocument, renderRasterProxy } from "./rasterRenderer";
import { RasterRenderClient } from "./rasterRenderClient";

async function png(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  paint(context);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) =>
      value ? resolve(value) : reject(new Error("PNG encoding unavailable")),
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

async function pixels(bytes: Uint8Array) {
  const bitmap = await createImageBitmap(
    new Blob([bytes.slice().buffer], { type: "image/png" }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

describe("full raster renderer pixels", () => {
  it("uses the same correction math for the interactive base and flattened preview", async () => {
    const base = await png(12, 8, (context) => {
      const gradient = context.createLinearGradient(0, 0, 12, 8);
      gradient.addColorStop(0, "#123b72");
      gradient.addColorStop(1, "#d09a52");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 12, 8);
    });
    const document = createRasterEditorDocument("png", base, 12, 8);
    document.corrections = {
      exposure: 21,
      contrast: 18,
      highlights: -12,
      shadows: 14,
      saturation: 19,
      vibrance: 23,
      temperature: 31,
      tint: -17,
      blur: 0,
      sharpen: 0,
    };
    const bitmap = await createImageBitmap(
      new Blob([base.slice().buffer], { type: "image/png" }),
    );
    const proxy = renderCorrectedRasterProxy(
      bitmap,
      12,
      8,
      document.corrections,
      1,
    );
    bitmap.close();
    const proxyPixels = proxy.getContext("2d")!.getImageData(0, 0, 12, 8).data;
    const workerProxy = await renderRasterProxy(document, 12, 8);
    const workerProxyCanvas = globalThis.document.createElement("canvas");
    workerProxyCanvas.width = workerProxy.width;
    workerProxyCanvas.height = workerProxy.height;
    const workerProxyContext = workerProxyCanvas.getContext("2d")!;
    workerProxyContext.drawImage(workerProxy.bitmap, 0, 0);
    workerProxy.bitmap.close();
    const workerProxyPixels = workerProxyContext.getImageData(0, 0, 12, 8).data;
    const rendered = await pixels((await renderRasterDocument(document)).bytes);
    for (let offset = 0; offset < proxyPixels.length; offset += 1)
      expect(
        Math.abs(proxyPixels[offset] - rendered.data[offset]),
      ).toBeLessThanOrEqual(3);
    for (let offset = 0; offset < workerProxyPixels.length; offset += 1)
      expect(
        Math.abs(workerProxyPixels[offset] - rendered.data[offset]),
      ).toBeLessThanOrEqual(3);
  });

  it("flips deterministic source pixels without cumulative re-encoding", async () => {
    const base = await png(2, 1, (context) => {
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = "#0000ff";
      context.fillRect(1, 0, 1, 1);
    });
    const document = createRasterEditorDocument("png", base, 2, 1);
    document.transform.flipX = true;
    const result = await renderRasterDocument(document);
    const rendered = await pixels(result.bytes);
    expect([...rendered.data.slice(0, 4)]).toEqual([0, 0, 255, 255]);
    expect([...rendered.data.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect(document.baseBytes).toBe(base);
  });

  it("crops, resizes, corrects, and composites markup at stable positions", async () => {
    const base = await png(8, 8, (context) => {
      context.clearRect(0, 0, 8, 8);
      context.fillStyle = "#202020";
      context.fillRect(0, 0, 8, 8);
    });
    const document = createRasterEditorDocument("png", base, 8, 8);
    document.corrections.exposure = 100;
    document.transform.crop = { x: 2, y: 2, width: 4, height: 4 };
    document.transform.outputWidth = 8;
    document.transform.outputHeight = 8;
    document.layers.push({
      id: "annotation",
      kind: "shape",
      name: "Annotation",
      visible: true,
      locked: false,
      opacity: 1,
      shape: "rectangle",
      x: 3,
      y: 3,
      width: 2,
      height: 2,
      rotation: 0,
      stroke: "#ff0000",
      fill: "#ff0000",
      strokeWidth: 1,
    });
    const result = await renderRasterDocument(document);
    const rendered = await pixels(result.bytes);
    expect(rendered).toMatchObject({ width: 8, height: 8 });
    const center = (4 * rendered.width + 4) * 4;
    expect(rendered.data[center]).toBeGreaterThan(200);
    expect(rendered.data[center + 1]).toBeLessThan(80);
    expect(rendered.data[center + 2]).toBeLessThan(80);
  });

  it("uses eraser strokes to reveal the corrected base instead of painting over it", async () => {
    const base = await png(9, 9, (context) => {
      context.fillStyle = "#2864a0";
      context.fillRect(0, 0, 9, 9);
    });
    const document = createRasterEditorDocument("png", base, 9, 9);
    document.layers.push({
      id: "paint",
      kind: "paint",
      name: "Paint",
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [
        {
          points: [
            { x: 1, y: 4 },
            { x: 7, y: 4 },
          ],
          color: "#ff0000",
          size: 4,
          hardness: 0,
          opacity: 1,
          erase: false,
        },
      ],
      erasures: [
        {
          points: [
            { x: 4, y: 1 },
            { x: 4, y: 7 },
          ],
          color: "#000000",
          size: 2,
          hardness: 0,
          opacity: 1,
          erase: true,
        },
      ],
    });
    const rendered = await pixels((await renderRasterDocument(document)).bytes);
    const erasedCenter = (4 * rendered.width + 4) * 4;
    const untouchedBase = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      expect(
        Math.abs(
          rendered.data[erasedCenter + channel] -
            rendered.data[untouchedBase + channel],
        ),
      ).toBeLessThanOrEqual(10);
    }
    const paintedEdge = (4 * rendered.width + 2) * 4;
    expect(rendered.data[paintedEdge]).toBeGreaterThan(200);
    expect(rendered.data[paintedEdge + 2]).toBeLessThan(80);
  });

  it("changes a text box without scaling its glyphs", async () => {
    const base = await png(160, 40, (context) => {
      context.clearRect(0, 0, 160, 40);
    });
    const renderWidth = async (boxWidth: number) => {
      const document = createRasterEditorDocument("png", base, 160, 40);
      document.layers.push({
        id: "text",
        kind: "text",
        name: "Text",
        visible: true,
        locked: false,
        opacity: 1,
        x: 2,
        y: 2,
        width: boxWidth,
        rotation: 0,
        text: "MMMMMMMM",
        family: "sans",
        size: 20,
        weight: "normal",
        align: "left",
        color: "#ff0000",
        background: null,
      });
      const rendered = await pixels(
        (await renderRasterDocument(document)).bytes,
      );
      const paintedColumns = Array.from({ length: rendered.width }, (_, x) =>
        Array.from(
          { length: rendered.height },
          (_, y) => (y * rendered.width + x) * 4,
        ).some(
          (offset) =>
            rendered.data[offset] > 160 &&
            rendered.data[offset + 1] < 80 &&
            rendered.data[offset + 2] < 80 &&
            rendered.data[offset + 3] > 0,
        ),
      );
      return (
        paintedColumns.lastIndexOf(true) - paintedColumns.indexOf(true) + 1
      );
    };
    expect(await renderWidth(30)).toBe(await renderWidth(120));
  });

  it("uses the feature-detected local canvas fallback without a worker", async () => {
    const base = await png(3, 2, (context) => {
      context.fillStyle = "#4682b4";
      context.fillRect(0, 0, 3, 2);
    });
    const client = new RasterRenderClient(null);
    const result = await client.render(
      createRasterEditorDocument("png", base, 3, 2),
    );
    expect(result).toMatchObject({
      mime: "image/png",
      width: 3,
      height: 2,
    });
    client.dispose();
  });
});
