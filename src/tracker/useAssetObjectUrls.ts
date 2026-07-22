import { useEffect, useState } from "react";
import { assetRelativePath } from "../markup/assetPath";

type AssetBytes = Uint8Array | readonly number[];

function assetMimeType(path: string) {
  const extension = path.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  if (extension === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

function objectUrl(path: string, bytes: AssetBytes) {
  const copy = Uint8Array.from(bytes);
  return URL.createObjectURL(
    new Blob([copy.buffer], { type: assetMimeType(path) }),
  );
}

export function useAssetObjectUrl(path: string, bytes: AssetBytes) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    const nextUrl = objectUrl(path, bytes);
    queueMicrotask(() => {
      if (active) setUrl(nextUrl);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(nextUrl);
    };
  }, [bytes, path]);
  return url;
}

export function useAssetObjectUrls(
  assets: Readonly<Record<string, AssetBytes>>,
  rootRelative = false,
) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const nextUrls = Object.fromEntries(
      Object.entries(assets).map(([path, bytes]) => [
        rootRelative ? assetRelativePath(path) : path,
        objectUrl(path, bytes),
      ]),
    );
    queueMicrotask(() => {
      if (active) setUrls(nextUrls);
    });
    return () => {
      active = false;
      for (const url of Object.values(nextUrls)) URL.revokeObjectURL(url);
    };
  }, [assets, rootRelative]);
  return urls;
}
