import { describe, expect, it } from "vitest";
import {
  applySafeImageMetadata,
  extractSafeImageMetadata,
} from "./safeImageMetadata";

describe("safe image metadata", () => {
  it("allowlists JFIF density while ignoring comments and unknown APP segments", () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, 0, 72,
      0, 72, 0, 0, 0xff, 0xfe, 0, 7, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0xff, 0xd9,
    ]);
    expect(extractSafeImageMetadata(jpeg, "jpg")).toMatchObject({
      densityX: 72,
      densityY: 72,
      densityUnit: "dpi",
      colorSpace: "srgb",
    });
  });

  it("reapplies only validated density to freshly encoded JPEG bytes", () => {
    const encoded = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const output = applySafeImageMetadata(encoded, "jpg", {
      colorSpace: "srgb",
      densityX: 300,
      densityY: 300,
      densityUnit: "dpi",
    });
    expect(output.subarray(2, 11)).toEqual(
      Uint8Array.from([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]),
    );
    expect(extractSafeImageMetadata(output, "jpg")).toMatchObject({
      densityX: 300,
      densityY: 300,
    });
  });
});
