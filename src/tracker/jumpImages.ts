import type { CanonicalJumpPackage, ImageBlock, JumpGrant } from "../markup";

export type JumpAssetResolver = (packageRelativePath: string) => string;

export function resolveJumpImageSource(
  source: string | undefined,
  resolveAsset?: JumpAssetResolver,
) {
  if (!source || /^(?:[a-z]+:|\/)/i.test(source)) return null;
  return resolveAsset?.(source) ?? `/${source}`;
}

const grantImages = (grants: readonly JumpGrant[]) =>
  grants.flatMap((grant) => grant.images);

export function jumpPackageImageSources(
  packageItem: CanonicalJumpPackage,
  resolveAsset?: JumpAssetResolver,
) {
  const images: ImageBlock[] = [
    ...packageItem.sections.flatMap((section) => section.images),
    ...packageItem.choices.flatMap((choice) => [
      ...choice.images,
      ...grantImages(choice.grants),
      ...choice.inputs.flatMap((input) => grantImages(input.grants)),
    ]),
  ];
  return [
    ...new Set(
      images
        .map((image) => resolveJumpImageSource(image.src, resolveAsset))
        .filter((source): source is string => source !== null),
    ),
  ];
}

const decodedImages = new Map<string, Promise<void>>();

function waitForImage(image: HTMLImageElement) {
  const settled = () =>
    new Promise<void>((resolve) => {
      if (image.complete) {
        resolve();
        return;
      }
      const finish = () => {
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      image.addEventListener("load", finish);
      image.addEventListener("error", finish);
    });
  if (typeof image.decode !== "function") return settled();
  return image.decode().catch(settled);
}

export function preloadJumpImages(
  packageItem: CanonicalJumpPackage,
  resolveAsset?: JumpAssetResolver,
) {
  if (typeof Image === "undefined") return Promise.resolve();
  return Promise.all(
    jumpPackageImageSources(packageItem, resolveAsset).map((source) => {
      const key = `${packageItem.exactHash}\0${source}`;
      const existing = decodedImages.get(key);
      if (existing) return existing;
      const image = new Image();
      image.src = source;
      const decoded = waitForImage(image);
      decodedImages.set(key, decoded);
      return decoded;
    }),
  ).then(() => undefined);
}

export function waitForRenderedJumpImages(root: ParentNode) {
  const images = [...root.querySelectorAll<HTMLImageElement>("img")];
  if (!images.length) return Promise.resolve();
  return Promise.all(images.map(waitForImage)).then(() => undefined);
}
