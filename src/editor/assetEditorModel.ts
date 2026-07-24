export const ASSET_EDITOR_DOCUMENT_VERSION = 1;

export type RasterCorrectionName =
  | "exposure"
  | "contrast"
  | "highlights"
  | "shadows"
  | "saturation"
  | "vibrance"
  | "temperature"
  | "tint"
  | "blur"
  | "sharpen";

export type RasterCorrections = Record<RasterCorrectionName, number>;

export type RasterPoint = { x: number; y: number };

export type RasterStroke = {
  points: RasterPoint[];
  color: string;
  size: number;
  hardness: number;
  opacity: number;
  erase: boolean;
};

type RasterLayerBase = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  erasures?: RasterStroke[];
};

export type RasterPaintLayer = RasterLayerBase & {
  kind: "paint";
  strokes: RasterStroke[];
};

export type RasterTextLayer = RasterLayerBase & {
  kind: "text";
  x: number;
  y: number;
  width: number;
  rotation: number;
  text: string;
  family: "sans" | "serif" | "mono";
  size: number;
  weight: "normal" | "bold";
  align: "left" | "center" | "right";
  color: string;
  background: string | null;
};

export type RasterShapeLayer = RasterLayerBase & {
  kind: "shape";
  shape: "line" | "arrow" | "rectangle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  stroke: string;
  fill: string | null;
  strokeWidth: number;
};

export type RasterLayer = RasterPaintLayer | RasterTextLayer | RasterShapeLayer;

export type SvgAssetEditorDocument = {
  version: 1;
  kind: "svg";
  invalidDraft: string;
};

export type RasterAssetEditorDocument = {
  version: 1;
  kind: "raster";
  format: "png" | "jpg";
  baseBytes: Uint8Array;
  baseWidth: number;
  baseHeight: number;
  transform: {
    crop: { x: number; y: number; width: number; height: number } | null;
    rotation: 0 | 90 | 180 | 270;
    straighten: number;
    flipX: boolean;
    flipY: boolean;
    outputWidth: number;
    outputHeight: number;
  };
  corrections: RasterCorrections;
  layers: RasterLayer[];
  selectedLayerId: string | null;
  encoding: {
    quality: number;
    background: string;
  };
  metadata: {
    densityX?: number;
    densityY?: number;
    densityUnit?: "dpi" | "dpcm";
    colorSpace: "srgb";
    profileNormalized?: boolean;
    iccProfile?: Uint8Array;
  };
  validationError?: string;
};

export type AssetEditorDocument =
  SvgAssetEditorDocument | RasterAssetEditorDocument;

export const emptyRasterCorrections = (): RasterCorrections => ({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  blur: 0,
  sharpen: 0,
});

export function createRasterEditorDocument(
  format: "png" | "jpg",
  baseBytes: Uint8Array,
  width: number,
  height: number,
): RasterAssetEditorDocument {
  return {
    version: ASSET_EDITOR_DOCUMENT_VERSION,
    kind: "raster",
    format,
    baseBytes,
    baseWidth: width,
    baseHeight: height,
    transform: {
      crop: null,
      rotation: 0,
      straighten: 0,
      flipX: false,
      flipY: false,
      outputWidth: width,
      outputHeight: height,
    },
    corrections: emptyRasterCorrections(),
    layers: [],
    selectedLayerId: null,
    encoding: { quality: 92, background: "#ffffff" },
    metadata: { colorSpace: "srgb" },
    validationError: undefined,
  };
}

const finite = (value: unknown, minimum: number, maximum: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum;

const string = (value: unknown, maximum = 512) =>
  typeof value === "string" && value.length <= maximum;

const color = (value: unknown) =>
  typeof value === "string" && /^(?:#[0-9a-f]{6}|#[0-9a-f]{8})$/i.test(value);

const bytes = (value: unknown) => {
  if (value instanceof Uint8Array) return value;
  if (
    Array.isArray(value) &&
    value.length <= 16 * 1024 * 1024 &&
    value.every(
      (entry) =>
        typeof entry === "number" &&
        Number.isInteger(entry) &&
        entry >= 0 &&
        entry <= 255,
    )
  )
    return Uint8Array.from(value);
  return null;
};

function hydrateStrokes(
  value: unknown,
  maximumStrokes: number,
): RasterStroke[] | null {
  if (!Array.isArray(value) || value.length > maximumStrokes) return null;
  const strokes: RasterStroke[] = [];
  for (const candidate of value) {
    if (
      !candidate ||
      !Array.isArray(candidate.points) ||
      candidate.points.length > 20_000 ||
      !color(candidate.color) ||
      !finite(candidate.size, 0.1, 2_048) ||
      !finite(candidate.hardness, 0, 1) ||
      !finite(candidate.opacity, 0, 1) ||
      typeof candidate.erase !== "boolean" ||
      candidate.points.some(
        (point: Partial<RasterPoint>) =>
          !point ||
          !finite(point.x, -100_000, 100_000) ||
          !finite(point.y, -100_000, 100_000),
      )
    )
      return null;
    strokes.push({
      points: candidate.points.map((point: RasterPoint) => ({
        x: point.x,
        y: point.y,
      })),
      color: candidate.color,
      size: candidate.size,
      hardness: candidate.hardness,
      opacity: candidate.opacity,
      erase: candidate.erase,
    });
  }
  return strokes;
}

function hydrateLayer(value: unknown): RasterLayer | null {
  if (!value || typeof value !== "object") return null;
  const layer = value as Partial<RasterLayer>;
  if (
    !string(layer.id, 128) ||
    !string(layer.name, 128) ||
    typeof layer.visible !== "boolean" ||
    typeof layer.locked !== "boolean" ||
    !finite(layer.opacity, 0, 1)
  )
    return null;
  const erasures =
    layer.erasures === undefined ? [] : hydrateStrokes(layer.erasures, 2_000);
  if (!erasures) return null;
  const base: RasterLayerBase = {
    id: layer.id!,
    name: layer.name!,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity!,
    ...(erasures.length > 0 ? { erasures } : {}),
  };
  if (layer.kind === "paint") {
    const strokes = hydrateStrokes(layer.strokes, 2_000);
    if (!strokes) return null;
    return { ...base, kind: "paint", strokes };
  }
  if (layer.kind === "text") {
    if (
      !finite(layer.x, -100_000, 100_000) ||
      !finite(layer.y, -100_000, 100_000) ||
      !(layer.width === undefined || finite(layer.width, 1, 100_000)) ||
      !finite(layer.rotation, -360, 360) ||
      !string(layer.text, 10_000) ||
      !["sans", "serif", "mono"].includes(layer.family ?? "") ||
      !finite(layer.size, 1, 2_048) ||
      !["normal", "bold"].includes(layer.weight ?? "") ||
      !["left", "center", "right"].includes(layer.align ?? "") ||
      !color(layer.color) ||
      !(layer.background === null || color(layer.background))
    )
      return null;
    return {
      ...base,
      ...(layer as RasterTextLayer),
      kind: "text",
      width:
        typeof layer.width === "number"
          ? layer.width
          : Math.max(120, layer.size! * layer.text!.length * 0.65),
    };
  }
  if (layer.kind === "shape") {
    if (
      !["line", "arrow", "rectangle", "ellipse"].includes(layer.shape ?? "") ||
      !finite(layer.x, -100_000, 100_000) ||
      !finite(layer.y, -100_000, 100_000) ||
      !finite(layer.width, -100_000, 100_000) ||
      !finite(layer.height, -100_000, 100_000) ||
      !finite(layer.rotation, -360, 360) ||
      !color(layer.stroke) ||
      !(layer.fill === null || color(layer.fill)) ||
      !finite(layer.strokeWidth, 0.1, 2_048)
    )
      return null;
    return { ...base, ...(layer as RasterShapeLayer), kind: "shape" };
  }
  return null;
}

export function hydrateAssetEditorDocument(
  value: unknown,
): AssetEditorDocument | null {
  if (!value || typeof value !== "object") return null;
  const document = value as Partial<AssetEditorDocument>;
  if (document.version !== ASSET_EDITOR_DOCUMENT_VERSION) return null;
  if (
    document.kind === "svg" &&
    typeof document.invalidDraft === "string" &&
    document.invalidDraft.length <= 4 * 1024 * 1024
  )
    return {
      version: ASSET_EDITOR_DOCUMENT_VERSION,
      kind: "svg",
      invalidDraft: document.invalidDraft,
    };
  if (document.kind !== "raster") return null;
  const base = bytes(document.baseBytes);
  const transform = document.transform;
  const corrections = document.corrections;
  const encoding = document.encoding;
  const metadata = document.metadata;
  if (
    !base ||
    !["png", "jpg"].includes(document.format ?? "") ||
    !finite(document.baseWidth, 1, 8_192) ||
    !finite(document.baseHeight, 1, 8_192) ||
    !transform ||
    ![0, 90, 180, 270].includes(transform.rotation ?? -1) ||
    !finite(transform.straighten, -45, 45) ||
    typeof transform.flipX !== "boolean" ||
    typeof transform.flipY !== "boolean" ||
    !finite(transform.outputWidth, 1, 8_192) ||
    !finite(transform.outputHeight, 1, 8_192) ||
    (transform.crop !== null &&
      (!transform.crop ||
        !finite(transform.crop.x, 0, 8_192) ||
        !finite(transform.crop.y, 0, 8_192) ||
        !finite(transform.crop.width, 1, 8_192) ||
        !finite(transform.crop.height, 1, 8_192))) ||
    !corrections ||
    Object.keys(emptyRasterCorrections()).some(
      (name) => !finite(corrections[name as RasterCorrectionName], -100, 100),
    ) ||
    !Array.isArray(document.layers) ||
    document.layers.length > 500 ||
    !encoding ||
    !finite(encoding.quality, 60, 100) ||
    !color(encoding.background) ||
    !metadata ||
    metadata.colorSpace !== "srgb"
  )
    return null;
  const layers = document.layers.map(hydrateLayer);
  if (layers.some((layer) => !layer)) return null;
  const ids = new Set(layers.map((layer) => layer!.id));
  if (ids.size !== layers.length) return null;
  return {
    version: ASSET_EDITOR_DOCUMENT_VERSION,
    kind: "raster",
    format: document.format as "png" | "jpg",
    baseBytes: base,
    baseWidth: document.baseWidth!,
    baseHeight: document.baseHeight!,
    transform: {
      crop: transform.crop
        ? {
            x: transform.crop.x,
            y: transform.crop.y,
            width: transform.crop.width,
            height: transform.crop.height,
          }
        : null,
      rotation: transform.rotation as 0 | 90 | 180 | 270,
      straighten: transform.straighten,
      flipX: transform.flipX,
      flipY: transform.flipY,
      outputWidth: transform.outputWidth,
      outputHeight: transform.outputHeight,
    },
    corrections: Object.fromEntries(
      Object.keys(emptyRasterCorrections()).map((name) => [
        name,
        corrections[name as RasterCorrectionName],
      ]),
    ) as RasterCorrections,
    layers: layers as RasterLayer[],
    selectedLayerId:
      typeof document.selectedLayerId === "string" &&
      ids.has(document.selectedLayerId)
        ? document.selectedLayerId
        : null,
    encoding: {
      quality: encoding.quality,
      background: encoding.background,
    },
    metadata: {
      colorSpace: "srgb",
      densityX: finite(metadata.densityX, 1, 100_000)
        ? metadata.densityX
        : undefined,
      densityY: finite(metadata.densityY, 1, 100_000)
        ? metadata.densityY
        : undefined,
      densityUnit: ["dpi", "dpcm"].includes(metadata.densityUnit ?? "")
        ? metadata.densityUnit
        : undefined,
      profileNormalized:
        typeof metadata.profileNormalized === "boolean"
          ? metadata.profileNormalized
          : undefined,
      iccProfile: bytes(metadata.iccProfile) ?? undefined,
    },
    validationError:
      typeof document.validationError === "string" &&
      document.validationError.length <= 1_000
        ? document.validationError
        : undefined,
  };
}

export function cloneAssetEditorDocument(
  document: AssetEditorDocument,
): AssetEditorDocument {
  return structuredClone(document);
}

export function rasterPreset(
  _corrections: RasterCorrections,
  preset: "monochrome" | "warm" | "cool" | "vivid" | "muted" | "contrast",
) {
  const next = emptyRasterCorrections();
  if (preset === "monochrome") next.saturation = -100;
  if (preset === "warm") {
    next.temperature = 24;
    next.vibrance = 12;
  }
  if (preset === "cool") {
    next.temperature = -24;
    next.tint = 6;
  }
  if (preset === "vivid") {
    next.vibrance = 35;
    next.contrast = 12;
  }
  if (preset === "muted") {
    next.saturation = -28;
    next.contrast = -8;
  }
  if (preset === "contrast") next.contrast = 36;
  return next;
}

export function transformLayerForResize(
  layer: RasterLayer,
  scaleX: number,
  scaleY: number,
): RasterLayer {
  const erasures = layer.erasures?.map((stroke) => ({
    ...stroke,
    size: stroke.size * Math.sqrt(scaleX * scaleY),
    points: stroke.points.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    })),
  }));
  if (layer.kind === "paint")
    return {
      ...layer,
      erasures,
      strokes: layer.strokes.map((stroke) => ({
        ...stroke,
        size: stroke.size * Math.sqrt(scaleX * scaleY),
        points: stroke.points.map((point) => ({
          x: point.x * scaleX,
          y: point.y * scaleY,
        })),
      })),
    };
  if (layer.kind === "text")
    return {
      ...layer,
      erasures,
      x: layer.x * scaleX,
      y: layer.y * scaleY,
      width: layer.width * scaleX,
      size: layer.size * Math.sqrt(scaleX * scaleY),
    };
  return {
    ...layer,
    erasures,
    x: layer.x * scaleX,
    y: layer.y * scaleY,
    width: layer.width * scaleX,
    height: layer.height * scaleY,
    strokeWidth: layer.strokeWidth * Math.sqrt(scaleX * scaleY),
  };
}

export type RasterLayerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function paintLayerBounds(layer: RasterPaintLayer): RasterLayerBounds {
  const points = layer.strokes.flatMap((stroke) => stroke.points);
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...points.map((point) => point.x));
  const y = Math.min(...points.map((point) => point.y));
  const maximumX = Math.max(...points.map((point) => point.x));
  const maximumY = Math.max(...points.map((point) => point.y));
  return {
    x,
    y,
    width: Math.max(1, maximumX - x),
    height: Math.max(1, maximumY - y),
  };
}

export function transformPaintLayerToBounds(
  layer: RasterPaintLayer,
  next: RasterLayerBounds,
): RasterPaintLayer {
  const current = paintLayerBounds(layer);
  const scaleX = next.width / current.width;
  const scaleY = next.height / current.height;
  return {
    ...layer,
    erasures: layer.erasures?.map((stroke) => ({
      ...stroke,
      size: stroke.size * Math.sqrt(Math.abs(scaleX * scaleY)),
      points: stroke.points.map((point) => ({
        x: next.x + (point.x - current.x) * scaleX,
        y: next.y + (point.y - current.y) * scaleY,
      })),
    })),
    strokes: layer.strokes.map((stroke) => ({
      ...stroke,
      size: stroke.size * Math.sqrt(Math.abs(scaleX * scaleY)),
      points: stroke.points.map((point) => ({
        x: next.x + (point.x - current.x) * scaleX,
        y: next.y + (point.y - current.y) * scaleY,
      })),
    })),
  };
}

export function eraseUnlockedLayers(
  layers: RasterLayer[],
  stroke: RasterStroke,
): RasterLayer[] {
  return layers.map((layer) =>
    layer.visible && !layer.locked
      ? {
          ...layer,
          erasures: [...(layer.erasures ?? []), stroke],
        }
      : layer,
  );
}

export function isAnimatedPng(bytes: Uint8Array) {
  if (
    bytes.length < 33 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(
      bytes.subarray(offset + 4, offset + 8),
    );
    if (type === "acTL") return true;
    if (type === "IDAT" || type === "IEND") return false;
    offset += length + 12;
  }
  return false;
}
