import { JumpPackageImportService, type PackageImportReview } from "../archive";
import type { InstalledPackage } from "./types";
import type { StoredChainPackage } from "./packageRepository";

export function installedPackageFromReview(
  review: PackageImportReview,
): InstalledPackage {
  return {
    id: `imported-${review.hash}`,
    logicalId: review.packageItem.logicalId,
    exactHash: review.hash,
    name: review.name,
    version: review.version,
    source: "imported",
    description: review.packageItem.description,
    tags: review.packageItem.tags,
    authors: review.packageItem.authors,
    nativeGauntlet: review.packageItem.nativeGauntlet,
    availability: "library",
    document: review.packageItem,
    assets: review.files.assets,
    archive: review.archive,
    archiveLimits: review.limits,
  };
}

export async function restoreStoredChainPackage(
  stored: StoredChainPackage,
): Promise<InstalledPackage | null> {
  try {
    const review = await new JumpPackageImportService().inspect(
      stored.archive,
      stored.limits,
    );
    const packageItem = installedPackageFromReview(review);
    return packageItem.id === stored.id ? packageItem : null;
  } catch {
    return null;
  }
}
