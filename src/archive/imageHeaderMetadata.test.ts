import { describe, expect, it } from "vitest";
import { imageHeaderMetadata } from "./imageHeaderMetadata";

const text = (value: string) => new TextEncoder().encode(value);

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

function pngChunk(type: string, data: Uint8Array) {
  const output = new Uint8Array(data.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(text(type), 4);
  output.set(data, 8);
  return output;
}

function technicalPng() {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, 80);
  headerView.setUint32(4, 50);
  header[8] = 8;
  header[9] = 3;
  header[12] = 1;
  const density = new Uint8Array(9);
  const densityView = new DataView(density.buffer);
  densityView.setUint32(0, 11_811);
  densityView.setUint32(4, 11_811);
  density[8] = 1;
  return concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("PLTE", new Uint8Array(48)),
    pngChunk("tRNS", Uint8Array.from([0, 255])),
    pngChunk("sRGB", Uint8Array.from([0])),
    pngChunk("pHYs", density),
    pngChunk("IDAT", new Uint8Array()),
  ]);
}

function progressiveJpeg() {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0,
    16,
    ...text("JFIF\0"),
    1,
    1,
    1,
    0,
    72,
    0,
    72,
    0,
    0,
    0xff,
    0xc2,
    0,
    17,
    8,
    0,
    2,
    0,
    3,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
    0xff,
    0xd9,
  ]);
}

function extendedWebp() {
  const bytes = new Uint8Array(38);
  const view = new DataView(bytes.buffer);
  bytes.set(text("RIFF"), 0);
  view.setUint32(4, 30, true);
  bytes.set(text("WEBPVP8X"), 8);
  view.setUint32(16, 10, true);
  bytes[20] = 0x32;
  bytes.set(text("VP8L"), 30);
  view.setUint32(34, 0, true);
  return bytes;
}

describe("image header metadata", () => {
  it("reads PNG color, palette, transparency, profile, density, and interlace", () => {
    expect(imageHeaderMetadata(technicalPng(), "png")).toEqual({
      colorModel: "indexed",
      bitDepth: 8,
      interlaced: true,
      alpha: true,
      paletteColors: 16,
      colorProfile: "srgb",
      densityX: 300,
      densityY: 300,
      densityUnit: "dpi",
    });
  });

  it("reads JPEG process, samples, orientation, and JFIF density", () => {
    expect(imageHeaderMetadata(progressiveJpeg(), "jpg")).toEqual({
      colorModel: "ycbcr",
      bitDepth: 8,
      encoding: "progressive",
      alpha: false,
      orientation: 1,
      densityX: 72,
      densityY: 72,
      densityUnit: "dpi",
    });
  });

  it("reads GIF logical-screen header fields", () => {
    const gif = new Uint8Array(13);
    gif.set(text("GIF89a"));
    gif[10] = 0xf7;
    expect(imageHeaderMetadata(gif, "gif")).toEqual({
      colorModel: "indexed",
      colorResolution: 8,
      version: "GIF89a",
      paletteColors: 256,
    });
  });

  it("reads extended WebP feature flags and payload encoding", () => {
    expect(imageHeaderMetadata(extendedWebp(), "webp")).toEqual({
      colorModel: "rgba",
      encoding: "lossless",
      alpha: true,
      animated: true,
      colorProfile: "icc",
    });
  });

  it("returns only safely available fields for short or unsupported headers", () => {
    expect(imageHeaderMetadata(Uint8Array.from([0xff, 0xd8]), "jpg")).toEqual({
      alpha: false,
      orientation: 1,
    });
    expect(imageHeaderMetadata(text("<svg/>"), "svg")).toEqual({});
    expect(imageHeaderMetadata(new Uint8Array(), "avif")).toEqual({});
  });
});
