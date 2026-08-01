import { describe, expect, it } from "vitest";
import {
  decodeBytesFromJson,
  encodeBytesForJson,
  stringifyBinaryJson,
} from "./binaryJson";

describe("binary JSON persistence", () => {
  it("round-trips bounded byte arrays without numeric-key JSON expansion", () => {
    const bytes = Uint8Array.from(
      { length: 70_000 },
      (_, index) => (index * 17) % 256,
    );
    const encoded = encodeBytesForJson(bytes);
    expect(encoded.$jumpchainBytes).toBe("base64");
    expect(decodeBytesFromJson(encoded, bytes.length)).toEqual(bytes);
    const serialized = stringifyBinaryJson({ assets: { image: bytes } });
    expect(serialized).toContain('"$jumpchainBytes":"base64"');
    expect(serialized).not.toContain('"69999":');
  });

  it("rejects malformed and over-limit encoded bytes before allocation", () => {
    expect(
      decodeBytesFromJson(
        { $jumpchainBytes: "base64", data: "not valid base64!!" },
        100,
      ),
    ).toBeNull();
    expect(
      decodeBytesFromJson(encodeBytesForJson(Uint8Array.from([1, 2, 3])), 2),
    ).toBeNull();
  });

  it("hydrates legacy numeric-key byte objects without accepting sparse data", () => {
    expect(decodeBytesFromJson({ 0: 137, 1: 80, 2: 78, 3: 71 }, 4)).toEqual(
      Uint8Array.from([137, 80, 78, 71]),
    );
    expect(decodeBytesFromJson({ 0: 1, 2: 3 }, 4)).toBeNull();
    expect(decodeBytesFromJson({ 0: 1, 1: 256 }, 4)).toBeNull();
  });
});
