import createPica from "pica/pica_main";
import picaWorkerUrl from "pica/pica_worker?url";
import type {
  RasterAssetEditorDocument,
  RasterLayer,
  RasterStroke,
} from "./assetEditorModel";
import {
  applyRasterCorrections,
  applyRasterSharpen,
} from "./rasterCorrections";
import { applySafeImageMetadata } from "./safeImageMetadata";

const pica = createPica({
  features: ["js", "ww"],
  workerURL: picaWorkerUrl,
  tile: 1024,
});

export type RasterRenderResult = {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export type RasterProxyRenderResult = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

export type RasterProxySource = Pick<
  RasterAssetEditorDocument,
  "baseBytes" | "baseHeight" | "baseWidth" | "corrections" | "format"
>;

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;
type RenderContext =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const createCanvas = (width: number, height: number): RenderCanvas => {
  if (typeof OffscreenCanvas !== "undefined")
    return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const context2d = (canvas: RenderCanvas) => {
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!context) throw new Error("Canvas 2D rendering is unavailable.");
  return context as RenderContext;
};

export { applyRasterCorrections } from "./rasterCorrections";

function drawArrow(
  context: RenderContext,
  width: number,
  height: number,
  strokeWidth: number,
) {
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(width, height);
  const angle = Math.atan2(height, width);
  const head = Math.max(8, strokeWidth * 4);
  context.lineTo(
    width - head * Math.cos(angle - Math.PI / 6),
    height - head * Math.sin(angle - Math.PI / 6),
  );
  context.moveTo(width, height);
  context.lineTo(
    width - head * Math.cos(angle + Math.PI / 6),
    height - head * Math.sin(angle + Math.PI / 6),
  );
  context.stroke();
}

function drawStroke(context: RenderContext, stroke: RasterStroke) {
  if (stroke.points.length < 1) return;
  context.save();
  context.globalAlpha *= stroke.opacity;
  context.globalCompositeOperation = stroke.erase
    ? "destination-out"
    : "source-over";
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.lineCap = stroke.hardness < 0.5 ? "round" : "square";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
  if (stroke.points.length === 1)
    context.lineTo(stroke.points[0].x + 0.001, stroke.points[0].y + 0.001);
  context.stroke();
  context.restore();
}

function drawLayer(context: RenderContext, layer: RasterLayer) {
  if (!layer.visible) return;
  context.save();
  context.globalAlpha = layer.opacity;
  if (layer.kind === "paint") {
    for (const stroke of layer.strokes) drawStroke(context, stroke);
  } else if (layer.kind === "text") {
    context.translate(layer.x, layer.y);
    context.rotate((layer.rotation * Math.PI) / 180);
    context.font = `${layer.weight} ${layer.size}px ${
      layer.family === "serif"
        ? "serif"
        : layer.family === "mono"
          ? "monospace"
          : "sans-serif"
    }`;
    context.textAlign = layer.align;
    context.textBaseline = "top";
    const anchor =
      layer.align === "left"
        ? 0
        : layer.align === "right"
          ? layer.width
          : layer.width / 2;
    if (layer.background) {
      context.fillStyle = layer.background;
      context.fillRect(0, -3, layer.width, layer.size * 1.25);
    }
    context.fillStyle = layer.color;
    context.fillText(layer.text, anchor, 0);
  } else {
    context.translate(layer.x, layer.y);
    context.rotate((layer.rotation * Math.PI) / 180);
    context.strokeStyle = layer.stroke;
    context.fillStyle = layer.fill ?? "transparent";
    context.lineWidth = layer.strokeWidth;
    if (layer.shape === "line") {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(layer.width, layer.height);
      context.stroke();
    } else if (layer.shape === "arrow")
      drawArrow(context, layer.width, layer.height, layer.strokeWidth);
    else if (layer.shape === "rectangle") {
      if (layer.fill) context.fillRect(0, 0, layer.width, layer.height);
      context.strokeRect(0, 0, layer.width, layer.height);
    } else {
      context.beginPath();
      context.ellipse(
        layer.width / 2,
        layer.height / 2,
        Math.abs(layer.width / 2),
        Math.abs(layer.height / 2),
        0,
        0,
        Math.PI * 2,
      );
      if (layer.fill) context.fill();
      context.stroke();
    }
  }
  context.restore();
}

async function canvasBlob(
  canvas: RenderCanvas,
  mime: "image/png" | "image/jpeg",
  quality: number,
) {
  if (canvas instanceof OffscreenCanvas)
    return canvas.convertToBlob({ type: mime, quality });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image encoding failed.")),
      mime,
      quality,
    ),
  );
}

export function hasExpectedImageSignature(
  bytes: Uint8Array,
  mime: "image/png" | "image/jpeg",
) {
  return mime === "image/png"
    ? [137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value,
      )
    : bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes.at(-2) === 0xff &&
        bytes.at(-1) === 0xd9;
}

export async function renderRasterProxy(
  document: RasterProxySource,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<RasterProxyRenderResult> {
  signal?.throwIfAborted();
  const baseBlob = new Blob([document.baseBytes.slice().buffer], {
    type: document.format === "png" ? "image/png" : "image/jpeg",
  });
  const source = await createImageBitmap(baseBlob, {
    imageOrientation: "from-image",
    colorSpaceConversion: "default",
  });
  try {
    signal?.throwIfAborted();
    const proxyWidth = Math.max(1, Math.round(width));
    const proxyHeight = Math.max(1, Math.round(height));
    const canvas = createCanvas(proxyWidth, proxyHeight);
    const context = context2d(canvas);
    context.drawImage(source, 0, 0, proxyWidth, proxyHeight);
    const imageData = context.getImageData(0, 0, proxyWidth, proxyHeight);
    applyRasterCorrections(imageData.data, document.corrections);
    context.putImageData(imageData, 0, 0);
    const proxyScale = Math.min(
      proxyWidth / document.baseWidth,
      proxyHeight / document.baseHeight,
    );
    if (document.corrections.blur > 0) {
      const blurred = createCanvas(proxyWidth, proxyHeight);
      const blurredContext = context2d(blurred);
      blurredContext.filter = `blur(${(document.corrections.blur / 100) * 8 * proxyScale}px)`;
      blurredContext.drawImage(canvas, 0, 0);
      context.clearRect(0, 0, proxyWidth, proxyHeight);
      context.drawImage(blurred, 0, 0);
    }
    if (document.corrections.sharpen > 0) {
      const sharpened = context.getImageData(0, 0, proxyWidth, proxyHeight);
      applyRasterSharpen(
        sharpened.data,
        proxyWidth,
        proxyHeight,
        document.corrections.sharpen,
      );
      context.putImageData(sharpened, 0, 0);
    }
    signal?.throwIfAborted();
    return {
      bitmap: await createImageBitmap(canvas),
      width: proxyWidth,
      height: proxyHeight,
    };
  } finally {
    source.close();
  }
}

export async function renderRasterDocument(
  document: RasterAssetEditorDocument,
  signal?: AbortSignal,
): Promise<RasterRenderResult> {
  signal?.throwIfAborted();
  const baseBlob = new Blob([document.baseBytes.slice().buffer], {
    type: document.format === "png" ? "image/png" : "image/jpeg",
  });
  const bitmap = await createImageBitmap(baseBlob, {
    imageOrientation: "from-image",
    colorSpaceConversion: "default",
  });
  try {
    signal?.throwIfAborted();
    const baseCanvas = createCanvas(document.baseWidth, document.baseHeight);
    const baseContext = context2d(baseCanvas);
    baseContext.drawImage(
      bitmap,
      0,
      0,
      document.baseWidth,
      document.baseHeight,
    );
    const imageData = baseContext.getImageData(
      0,
      0,
      document.baseWidth,
      document.baseHeight,
    );
    applyRasterCorrections(imageData.data, document.corrections);
    baseContext.putImageData(imageData, 0, 0);
    if (document.corrections.blur > 0) {
      const blurred = createCanvas(document.baseWidth, document.baseHeight);
      const blurredContext = context2d(blurred);
      blurredContext.filter = `blur(${(document.corrections.blur / 100) * 8}px)`;
      blurredContext.drawImage(baseCanvas, 0, 0);
      baseContext.clearRect(0, 0, document.baseWidth, document.baseHeight);
      baseContext.drawImage(blurred, 0, 0);
    }
    if (document.corrections.sharpen > 0) {
      const sharpened = baseContext.getImageData(
        0,
        0,
        document.baseWidth,
        document.baseHeight,
      );
      applyRasterSharpen(
        sharpened.data,
        document.baseWidth,
        document.baseHeight,
        document.corrections.sharpen,
      );
      baseContext.putImageData(sharpened, 0, 0);
    }

    const markup = createCanvas(document.baseWidth, document.baseHeight);
    const markupContext = context2d(markup);
    for (const layer of document.layers) {
      const isolatedLayer = createCanvas(
        document.baseWidth,
        document.baseHeight,
      );
      const isolatedContext = context2d(isolatedLayer);
      drawLayer(isolatedContext, layer);
      for (const erasure of layer.erasures ?? [])
        drawStroke(isolatedContext, erasure);
      markupContext.drawImage(isolatedLayer, 0, 0);
    }
    const composite = createCanvas(document.baseWidth, document.baseHeight);
    const compositeContext = context2d(composite);
    compositeContext.drawImage(baseCanvas, 0, 0);
    compositeContext.drawImage(markup, 0, 0);

    const crop = document.transform.crop ?? {
      x: 0,
      y: 0,
      width: document.baseWidth,
      height: document.baseHeight,
    };
    const rotated =
      document.transform.rotation === 90 || document.transform.rotation === 270;
    const transformWidth = Math.max(
      1,
      Math.round(rotated ? crop.height : crop.width),
    );
    const transformHeight = Math.max(
      1,
      Math.round(rotated ? crop.width : crop.height),
    );
    const transformed = createCanvas(transformWidth, transformHeight);
    const transformedContext = context2d(transformed);
    transformedContext.translate(transformWidth / 2, transformHeight / 2);
    transformedContext.scale(
      document.transform.flipX ? -1 : 1,
      document.transform.flipY ? -1 : 1,
    );
    transformedContext.rotate(
      ((document.transform.rotation + document.transform.straighten) *
        Math.PI) /
        180,
    );
    transformedContext.drawImage(
      composite,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -crop.width / 2,
      -crop.height / 2,
      crop.width,
      crop.height,
    );

    const output = createCanvas(
      document.transform.outputWidth,
      document.transform.outputHeight,
    );
    const outputContext = context2d(output);
    const resized =
      document.format === "jpg"
        ? createCanvas(
            document.transform.outputWidth,
            document.transform.outputHeight,
          )
        : output;
    const cancellation = new Promise((_, reject) =>
      signal?.addEventListener(
        "abort",
        () =>
          reject(signal.reason ?? new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
    await pica.resize(transformed, resized, {
      filter: "mks2013",
      cancelToken: cancellation,
    });
    signal?.throwIfAborted();
    if (document.format === "jpg") {
      outputContext.fillStyle = document.encoding.background;
      outputContext.fillRect(
        0,
        0,
        document.transform.outputWidth,
        document.transform.outputHeight,
      );
      outputContext.drawImage(resized, 0, 0);
    }
    const mime = document.format === "png" ? "image/png" : "image/jpeg";
    const blob = await canvasBlob(
      output,
      mime,
      document.encoding.quality / 100,
    );
    if (blob.type && blob.type !== mime)
      throw new Error(`Encoder returned ${blob.type} instead of ${mime}.`);
    const encodedBytes = new Uint8Array(await blob.arrayBuffer());
    const bytes = applySafeImageMetadata(
      encodedBytes,
      document.format,
      document.metadata,
    );
    if (!hasExpectedImageSignature(bytes, mime))
      throw new Error(`Encoder returned an invalid ${mime} byte signature.`);
    return {
      bytes,
      mime,
      width: document.transform.outputWidth,
      height: document.transform.outputHeight,
    };
  } finally {
    bitmap.close();
  }
}
