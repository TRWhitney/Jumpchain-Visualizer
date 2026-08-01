export type PackageSizeLimits = {
  maxArchiveMiB: number;
  maxDefinitionFileMiB: number;
  maxAssetFileMiB: number;
  maxExpandedPackageMiB: number;
};

export const SAFE_PACKAGE_SIZE_LIMITS: Readonly<PackageSizeLimits> = {
  maxArchiveMiB: 64,
  maxDefinitionFileMiB: 2,
  maxAssetFileMiB: 16,
  maxExpandedPackageMiB: 96,
};

export const ABSOLUTE_PACKAGE_SIZE_LIMITS: Readonly<PackageSizeLimits> = {
  maxArchiveMiB: 512,
  maxDefinitionFileMiB: 16,
  maxAssetFileMiB: 256,
  maxExpandedPackageMiB: 1024,
};
