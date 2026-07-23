import { describe, expect, it } from "vitest";
import { PackageSecurityError } from "../archive";
import {
  assetImportRejectionEvent,
  assetPathRejectionReason,
  assetValidationRejectionReason,
  type AssetImportRejectionReason,
} from "./assetImportFeedback";

describe("asset import rejection feedback", () => {
  it.each([
    ["empty", "invalid_path"],
    ["absolute", "invalid_path"],
    ["separator", "invalid_path"],
    ["segment", "invalid_path"],
    ["extension", "unsupported_type"],
    ["collision", "duplicate_path"],
  ] as const)("maps %s asset paths to %s", (code, reason) => {
    expect(assetPathRejectionReason(code)).toBe(reason);
  });

  it.each([
    ["asset.signature", "signature_mismatch"],
    ["asset.decode", "decode_failed"],
    ["asset.crc", "png_integrity"],
    ["asset.polyglot", "trailing_data"],
    ["asset.dimensions", "geometry_limit"],
    ["asset.total_pixels", "geometry_limit"],
    ["asset.size_mismatch", "dimension_mismatch"],
    ["asset.extension", "unsupported_type"],
    ["asset.unknown", "validation_failed"],
  ] as const)("maps %s validation to %s", (code, reason) => {
    expect(assetValidationRejectionReason(new PackageSecurityError(code))).toBe(
      reason,
    );
  });

  it("keeps unreadable and unexpected validation failures distinct", () => {
    expect(assetImportRejectionEvent("read_failed")).toBe(
      "editor.asset.rejected.read_failed",
    );
    expect(assetValidationRejectionReason(new Error("read failed"))).toBe(
      "validation_failed",
    );
  });

  it.each<AssetImportRejectionReason>([
    "unsupported_type",
    "file_too_large",
    "invalid_path",
    "duplicate_path",
    "signature_mismatch",
    "decode_failed",
    "png_integrity",
    "trailing_data",
    "geometry_limit",
    "dimension_mismatch",
    "read_failed",
    "validation_failed",
  ])("creates a closed feedback event for %s", (reason) => {
    expect(assetImportRejectionEvent(reason)).toBe(
      `editor.asset.rejected.${reason}`,
    );
  });
});
