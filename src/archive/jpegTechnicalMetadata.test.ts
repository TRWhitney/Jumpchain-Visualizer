import { describe, expect, it } from "vitest";
import { inspectPackageAsset } from "./JumpPackageImportService";
import { jpegTechnicalMetadata } from "./jpegTechnicalMetadata";

function orientedJpeg() {
  const tiff = new Uint8Array(78);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49]);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 4, true);
  const entry = (index: number, tag: number, type: number, value: number) => {
    const offset = 10 + index * 12;
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, 1, true);
    if (type === 3) view.setUint16(offset + 8, value, true);
    else view.setUint32(offset + 8, value, true);
  };
  entry(0, 0x0112, 3, 6);
  entry(1, 0x011a, 5, 62);
  entry(2, 0x011b, 5, 70);
  entry(3, 0x0128, 3, 2);
  view.setUint32(62, 300, true);
  view.setUint32(66, 1, true);
  view.setUint32(70, 300, true);
  view.setUint32(74, 1, true);
  const exif = Uint8Array.from([
    ...new TextEncoder().encode("Exif\0\0"),
    ...tiff,
  ]);
  const appLength = exif.length + 2;
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    appLength >>> 8,
    appLength & 0xff,
    ...exif,
    0xff,
    0xc0,
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

describe("JPEG technical metadata", () => {
  it("reads bounded EXIF orientation and resolution and normalizes geometry", () => {
    const bytes = orientedJpeg();
    expect(jpegTechnicalMetadata(bytes)).toEqual({
      orientation: 6,
      densityX: 300,
      densityY: 300,
      densityUnit: "dpi",
    });
    expect(inspectPackageAsset("assets/oriented.jpg", bytes)).toMatchObject({
      width: 2,
      height: 3,
      canonicalExtension: "jpg",
    });
  });
});
