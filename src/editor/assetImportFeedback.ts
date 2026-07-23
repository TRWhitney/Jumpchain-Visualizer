import { PackageSecurityError } from "../archive";
import type { AssetPathValidationCode } from "./assetPaths";

export type AssetImportRejectionReason =
  | "unsupported_type"
  | "file_too_large"
  | "invalid_path"
  | "duplicate_path"
  | "signature_mismatch"
  | "decode_failed"
  | "png_integrity"
  | "trailing_data"
  | "geometry_limit"
  | "dimension_mismatch"
  | "read_failed"
  | "validation_failed";

export const assetImportRejectionEvent = (reason: AssetImportRejectionReason) =>
  `editor.asset.rejected.${reason}`;

export function assetPathRejectionReason(
  code: AssetPathValidationCode,
): AssetImportRejectionReason {
  if (code === "collision") return "duplicate_path";
  if (code === "extension") return "unsupported_type";
  return "invalid_path";
}

export function assetValidationRejectionReason(
  error: unknown,
): AssetImportRejectionReason {
  if (!(error instanceof PackageSecurityError)) return "validation_failed";
  switch (error.code) {
    case "asset.signature":
      return "signature_mismatch";
    case "asset.decode":
      return "decode_failed";
    case "asset.crc":
      return "png_integrity";
    case "asset.polyglot":
      return "trailing_data";
    case "asset.dimensions":
    case "asset.total_pixels":
      return "geometry_limit";
    case "asset.size_mismatch":
      return "dimension_mismatch";
    case "asset.extension":
      return "unsupported_type";
    default:
      return "validation_failed";
  }
}
