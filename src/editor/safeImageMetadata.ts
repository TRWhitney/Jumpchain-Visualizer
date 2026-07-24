import { unzlibSync, zlibSync } from "fflate";
import type { RasterAssetEditorDocument } from "./assetEditorModel";
import { jpegTechnicalMetadata } from "../archive/jpegTechnicalMetadata";

type SafeMetadata = RasterAssetEditorDocument["metadata"];

const text = new TextDecoder("latin1");
const ascii = (bytes: Uint8Array) => text.decode(bytes);

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validSrgbIcc(profile: Uint8Array) {
  if (
    profile.length < 128 ||
    profile.length > 4 * 1024 * 1024 ||
    new DataView(
      profile.buffer,
      profile.byteOffset,
      profile.byteLength,
    ).getUint32(0) !== profile.length ||
    ascii(profile.subarray(36, 40)) !== "acsp" ||
    ascii(profile.subarray(16, 20)) !== "RGB "
  )
    return false;
  return ascii(profile).toLocaleLowerCase().includes("srgb");
}

export function extractSafeImageMetadata(
  bytes: Uint8Array,
  format: "png" | "jpg",
): SafeMetadata {
  const metadata: SafeMetadata = { colorSpace: "srgb" };
  if (format === "png") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = ascii(bytes.subarray(offset + 4, offset + 8));
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      if (type === "pHYs" && length === 9) {
        const x = view.getUint32(offset + 8);
        const y = view.getUint32(offset + 12);
        const unit = bytes[offset + 16];
        if (x && y && unit === 1) {
          metadata.densityX = Math.round((x / 39.3701) * 100) / 100;
          metadata.densityY = Math.round((y / 39.3701) * 100) / 100;
          metadata.densityUnit = "dpi";
        }
      } else if (type === "iCCP") {
        const separator = data.indexOf(0);
        if (separator > 0 && separator <= 79 && data[separator + 1] === 0) {
          try {
            const profile = unzlibSync(data.subarray(separator + 2));
            if (validSrgbIcc(profile)) metadata.iccProfile = profile;
            else metadata.profileNormalized = true;
          } catch {
            metadata.profileNormalized = true;
          }
        }
      }
      offset += length + 12;
      if (type === "IDAT") break;
    }
    return metadata;
  }

  const exif = jpegTechnicalMetadata(bytes);
  if (exif.densityX && exif.densityY) {
    metadata.densityX = exif.densityX;
    metadata.densityY = exif.densityY;
    metadata.densityUnit = exif.densityUnit;
  }
  const iccParts = new Map<number, Uint8Array>();
  let iccPartCount = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const data = bytes.subarray(offset + 4, offset + 2 + length);
    if (
      marker === 0xe0 &&
      ascii(data.subarray(0, 5)) === "JFIF\0" &&
      data.length >= 12
    ) {
      const unit = data[7];
      const x = (data[8] << 8) | data[9];
      const y = (data[10] << 8) | data[11];
      if (x && y && (unit === 1 || unit === 2)) {
        metadata.densityX = x;
        metadata.densityY = y;
        metadata.densityUnit = unit === 1 ? "dpi" : "dpcm";
      }
    }
    if (
      marker === 0xe2 &&
      ascii(data.subarray(0, 12)) === "ICC_PROFILE\0" &&
      data.length > 14
    ) {
      iccParts.set(data[12], data.subarray(14));
      iccPartCount = data[13];
    }
    offset += 2 + length;
  }
  if (
    iccPartCount > 0 &&
    iccParts.size === iccPartCount &&
    [...iccParts.keys()].every((part) => part >= 1 && part <= iccPartCount)
  ) {
    const size = [...iccParts.values()].reduce(
      (total, part) => total + part.length,
      0,
    );
    const profile = new Uint8Array(size);
    let cursor = 0;
    for (let part = 1; part <= iccPartCount; part += 1) {
      profile.set(iccParts.get(part)!, cursor);
      cursor += iccParts.get(part)!.length;
    }
    if (validSrgbIcc(profile)) metadata.iccProfile = profile;
    else metadata.profileNormalized = true;
  }
  return metadata;
}

function pngChunk(type: string, data: Uint8Array) {
  const output = new Uint8Array(data.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(new TextEncoder().encode(type), 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, crc32(output.subarray(4, 8 + data.length)));
  return output;
}

function concat(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function stripPngMetadataChunks(
  bytes: Uint8Array,
  removeColorProfile: boolean,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) return bytes;
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    const allowed = [
      "IHDR",
      "PLTE",
      "IDAT",
      "IEND",
      "tRNS",
      "sRGB",
      "gAMA",
      "cHRM",
      "iCCP",
    ].includes(type);
    if (
      allowed &&
      type !== "pHYs" &&
      (!removeColorProfile || !["iCCP", "sRGB", "gAMA", "cHRM"].includes(type))
    )
      parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

function stripJpegMetadataSegments(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const parts = [bytes.subarray(0, 2)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(offset));
      return concat(parts);
    }
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return bytes;
    const end = offset + 2 + length;
    if (!((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe))
      parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  parts.push(bytes.subarray(offset));
  return concat(parts);
}

export function applySafeImageMetadata(
  bytes: Uint8Array,
  format: "png" | "jpg",
  metadata: SafeMetadata,
) {
  if (format === "png") {
    const chunks: Uint8Array[] = [];
    if (metadata.iccProfile && validSrgbIcc(metadata.iccProfile)) {
      const compressed = zlibSync(metadata.iccProfile);
      chunks.push(
        pngChunk(
          "iCCP",
          concat([
            new TextEncoder().encode("sRGB"),
            Uint8Array.from([0, 0]),
            compressed,
          ]),
        ),
      );
    }
    if (metadata.densityX && metadata.densityY) {
      const data = new Uint8Array(9);
      const view = new DataView(data.buffer);
      const multiplier = metadata.densityUnit === "dpcm" ? 100 : 39.3701;
      view.setUint32(
        0,
        Math.max(1, Math.round(metadata.densityX * multiplier)),
      );
      view.setUint32(
        4,
        Math.max(1, Math.round(metadata.densityY * multiplier)),
      );
      data[8] = 1;
      chunks.push(pngChunk("pHYs", data));
    }
    if (!chunks.length) return stripPngMetadataChunks(bytes, false);
    const sanitized = stripPngMetadataChunks(
      bytes,
      Boolean(metadata.iccProfile),
    );
    const ihdrEnd = 8 + 12 + 13;
    return concat([
      sanitized.subarray(0, ihdrEnd),
      ...chunks,
      sanitized.subarray(ihdrEnd),
    ]);
  }
  const segments: Uint8Array[] = [];
  if (metadata.densityX && metadata.densityY)
    segments.push(
      Uint8Array.from([
        0xff,
        0xe0,
        0,
        16,
        0x4a,
        0x46,
        0x49,
        0x46,
        0,
        1,
        1,
        metadata.densityUnit === "dpcm" ? 2 : 1,
        (Math.round(metadata.densityX) >>> 8) & 0xff,
        Math.round(metadata.densityX) & 0xff,
        (Math.round(metadata.densityY) >>> 8) & 0xff,
        Math.round(metadata.densityY) & 0xff,
        0,
        0,
      ]),
    );
  if (metadata.iccProfile && validSrgbIcc(metadata.iccProfile)) {
    const partSize = 65_519;
    const partCount = Math.ceil(metadata.iccProfile.length / partSize);
    for (let part = 0; part < partCount; part += 1) {
      const profilePart = metadata.iccProfile.subarray(
        part * partSize,
        (part + 1) * partSize,
      );
      const payload = concat([
        new TextEncoder().encode("ICC_PROFILE\0"),
        Uint8Array.from([part + 1, partCount]),
        profilePart,
      ]);
      const segment = new Uint8Array(payload.length + 4);
      const view = new DataView(segment.buffer);
      segment.set([0xff, 0xe2], 0);
      view.setUint16(2, payload.length + 2);
      segment.set(payload, 4);
      segments.push(segment);
    }
  }
  const sanitized = stripJpegMetadataSegments(bytes);
  return segments.length
    ? concat([sanitized.subarray(0, 2), ...segments, sanitized.subarray(2)])
    : sanitized;
}
