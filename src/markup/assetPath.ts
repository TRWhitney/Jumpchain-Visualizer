export const assetArchiveRoot = "assets/";

export function assetRelativePath(archivePath: string) {
  return archivePath.startsWith(assetArchiveRoot)
    ? archivePath.slice(assetArchiveRoot.length)
    : archivePath;
}

export function assetArchivePath(relativePath: string) {
  return `${assetArchiveRoot}${relativePath}`;
}
