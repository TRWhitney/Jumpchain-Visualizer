import { describe, expect, it } from "vitest";
import { emptyRasterCorrections } from "./assetEditorModel";
import {
  applyRasterCorrections,
  hasExpectedImageSignature,
} from "./rasterRenderer";

describe("raster rendering primitives", () => {
  it("keeps neutral pixels stable and applies exposure deterministically", () => {
    const neutral = Uint8ClampedArray.from([64, 128, 192, 255]);
    expect([
      ...applyRasterCorrections(neutral, emptyRasterCorrections()),
    ]).toEqual([64, 128, 192, 255]);
    const exposed = Uint8ClampedArray.from([64, 64, 64, 255]);
    applyRasterCorrections(exposed, {
      ...emptyRasterCorrections(),
      exposure: 100,
    });
    expect([...exposed]).toEqual([128, 128, 128, 255]);
  });

  it("verifies requested output signatures", () => {
    expect(
      hasExpectedImageSignature(
        Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(
        Uint8Array.from([0xff, 0xd8, 0, 0xff, 0xd9]),
        "image/jpeg",
      ),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(
        Uint8Array.from([137, 80, 78, 71]),
        "image/jpeg",
      ),
    ).toBe(false);
  });
});
