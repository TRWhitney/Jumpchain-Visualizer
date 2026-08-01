import { useEffect, useRef, useState } from "react";
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
  const copy =
    bytes instanceof Uint8Array && bytes.buffer instanceof ArrayBuffer
      ? new Uint8Array<ArrayBuffer>(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        )
      : Uint8Array.from(bytes);
  return URL.createObjectURL(new Blob([copy], { type: assetMimeType(path) }));
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
  const cachedUrls = useRef(
    new Map<string, { bytes: AssetBytes; url: string }>(),
  );
  useEffect(() => {
    let active = true;
    const previous = cachedUrls.current;
    const next = new Map<string, { bytes: AssetBytes; url: string }>();
    const nextUrls = Object.fromEntries(
      Object.entries(assets).map(([path, bytes]) => {
        const cached = previous.get(path);
        const url =
          cached?.bytes === bytes ? cached.url : objectUrl(path, bytes);
        next.set(path, { bytes, url });
        return [rootRelative ? assetRelativePath(path) : path, url];
      }),
    );
    for (const [path, cached] of previous)
      if (next.get(path)?.url !== cached.url) URL.revokeObjectURL(cached.url);
    cachedUrls.current = next;
    queueMicrotask(() => {
      if (active) setUrls(nextUrls);
    });
    return () => {
      active = false;
    };
  }, [assets, rootRelative]);
  useEffect(
    () => () => {
      for (const cached of cachedUrls.current.values())
        URL.revokeObjectURL(cached.url);
      cachedUrls.current = new Map();
    },
    [],
  );
  return urls;
}
