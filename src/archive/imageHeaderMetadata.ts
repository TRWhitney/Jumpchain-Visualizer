import type { CanonicalAssetExtension } from "./JumpPackageImportService";
import { jpegTechnicalMetadata } from "./jpegTechnicalMetadata";

export type ImageColorModel =
  | "grayscale"
  | "grayscale-alpha"
  | "indexed"
  | "rgb"
  | "rgba"
  | "ycbcr"
  | "cmyk";

export type ImageEncoding = "baseline" | "progressive" | "lossy" | "lossless";

export type ImageHeaderMetadata = {
  colorModel?: ImageColorModel;
  bitDepth?: number;
  colorResolution?: number;
  encoding?: ImageEncoding;
  interlaced?: boolean;
  alpha?: boolean;
  animated?: boolean;
  colorProfile?: "srgb" | "icc";
  densityX?: number;
  densityY?: number;
  densityUnit?: "dpi" | "dpcm";
  orientation?: number;
  version?: "GIF87a" | "GIF89a";
  paletteColors?: number;
};

const latin1 = new TextDecoder("latin1");
const ascii = (bytes: Uint8Array) => latin1.decode(bytes);

function pngHeaderMetadata(bytes: Uint8Array): ImageHeaderMetadata {
  if (bytes.length < 29 || ascii(bytes.subarray(12, 16)) !== "IHDR") return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const colorType = bytes[25];
  const colorModels: Readonly<Record<number, ImageColorModel>> = {
    0: "grayscale",
    2: "rgb",
    3: "indexed",
    4: "grayscale-alpha",
    6: "rgba",
  };
  const metadata: ImageHeaderMetadata = {
    colorModel: colorModels[colorType],
    bitDepth: bytes[24],
    interlaced: bytes[28] === 1,
    alpha: colorType === 4 || colorType === 6,
  };
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) break;
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    if (type === "tRNS") metadata.alpha = true;
    else if (type === "sRGB") metadata.colorProfile = "srgb";
    else if (type === "iCCP") metadata.colorProfile = "icc";
    else if (type === "PLTE" && length % 3 === 0)
      metadata.paletteColors = length / 3;
    else if (type === "pHYs" && length === 9 && bytes[offset + 16] === 1) {
      const pixelsPerMeterX = view.getUint32(offset + 8);
      const pixelsPerMeterY = view.getUint32(offset + 12);
      if (pixelsPerMeterX && pixelsPerMeterY) {
        metadata.densityX = Math.round((pixelsPerMeterX / 39.3701) * 100) / 100;
        metadata.densityY = Math.round((pixelsPerMeterY / 39.3701) * 100) / 100;
        metadata.densityUnit = "dpi";
      }
    }
    offset = end;
    if (type === "IDAT") break;
  }
  return metadata;
}

const jpegStartOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegHeaderMetadata(bytes: Uint8Array): ImageHeaderMetadata {
  const technical = jpegTechnicalMetadata(bytes);
  const metadata: ImageHeaderMetadata = {
    alpha: false,
    orientation: technical.orientation,
    densityX: technical.densityX,
    densityY: technical.densityY,
    densityUnit: technical.densityUnit,
  };
  if (bytes.length < 4) return metadata;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) break;
    const dataOffset = offset + 4;
    if (
      marker === 0xe0 &&
      ascii(bytes.subarray(dataOffset, dataOffset + 5)) === "JFIF\0" &&
      length >= 14
    ) {
      const unit = bytes[dataOffset + 7];
      const densityX = view.getUint16(dataOffset + 8);
      const densityY = view.getUint16(dataOffset + 10);
      if (densityX && densityY && (unit === 1 || unit === 2)) {
        metadata.densityX = densityX;
        metadata.densityY = densityY;
        metadata.densityUnit = unit === 1 ? "dpi" : "dpcm";
      }
    }
    if (
      marker === 0xe2 &&
      ascii(bytes.subarray(dataOffset, dataOffset + 12)) === "ICC_PROFILE\0"
    )
      metadata.colorProfile = "icc";
    if (
      jpegStartOfFrameMarkers.has(marker) &&
      length >= 8 &&
      dataOffset + 6 <= bytes.length
    ) {
      metadata.bitDepth = bytes[dataOffset];
      const components = bytes[dataOffset + 5];
      metadata.colorModel =
        components === 1
          ? "grayscale"
          : components === 3
            ? "ycbcr"
            : components === 4
              ? "cmyk"
              : undefined;
      if (marker === 0xc0) metadata.encoding = "baseline";
      else if ([0xc2, 0xc6, 0xca, 0xce].includes(marker))
        metadata.encoding = "progressive";
    }
    offset = end;
  }
  return metadata;
}

function gifHeaderMetadata(bytes: Uint8Array): ImageHeaderMetadata {
  const version = ascii(bytes.subarray(0, 6));
  if (bytes.length < 13 || (version !== "GIF87a" && version !== "GIF89a"))
    return {};
  const packed = bytes[10];
  const hasGlobalPalette = Boolean(packed & 0x80);
  return {
    colorModel: "indexed",
    colorResolution: ((packed >> 4) & 0x07) + 1,
    version,
    paletteColors: hasGlobalPalette ? 2 ** ((packed & 0x07) + 1) : undefined,
  };
}

function webpHeaderMetadata(bytes: Uint8Array): ImageHeaderMetadata {
  if (bytes.length < 30 || ascii(bytes.subarray(12, 16)) !== "VP8X") return {};
  const flags = bytes[20];
  const alpha = Boolean(flags & 0x10);
  const metadata: ImageHeaderMetadata = {
    colorModel: alpha ? "rgba" : "rgb",
    alpha,
    animated: Boolean(flags & 0x02),
    colorProfile: flags & 0x20 ? "icc" : undefined,
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes.subarray(offset, offset + 4));
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length + (length % 2);
    if (end > bytes.length) break;
    if (type === "VP8 ") metadata.encoding = "lossy";
    else if (type === "VP8L") metadata.encoding = "lossless";
    offset = end;
  }
  return metadata;
}

export function imageHeaderMetadata(
  bytes: Uint8Array,
  format: CanonicalAssetExtension,
): ImageHeaderMetadata {
  if (format === "png") return pngHeaderMetadata(bytes);
  if (format === "jpg") return jpegHeaderMetadata(bytes);
  if (format === "gif") return gifHeaderMetadata(bytes);
  if (format === "webp") return webpHeaderMetadata(bytes);
  return {};
}
