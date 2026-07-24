import { Unzip, UnzipInflate, zipSync, type Zippable } from "fflate";
import { assetArchivePath, assetRelativePath } from "../markup/assetPath";
import {
  canonicalizePackage,
  sha256,
  type CanonicalJumpPackage,
  type PackageDiagnostic,
} from "../markup";
import type { PackageSizeLimits } from "../settings/model";
import { validateSvgBytes } from "./svgAsset";
import { jpegTechnicalMetadata } from "./jpegTechnicalMetadata";
import {
  imageHeaderMetadata,
  type ImageHeaderMetadata,
} from "./imageHeaderMetadata";

const MAX_ENTRIES = 256;
const MAX_COMPRESSION_RATIO = 100;
const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 24_000_000;
const MAX_TOTAL_IMAGE_PIXELS = 64_000_000;
const MiB = 1024 * 1024;
const allowedAssetExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
]);

export type SecurePackageFiles = {
  definitions: Record<string, string>;
  assets: Record<string, Uint8Array>;
};

export type PackageImportReview = {
  status: "ready" | "warning";
  identity: string;
  name: string;
  version: string;
  hash: string;
  definitionCount: number;
  assetCount: number;
  expandedBytes: number;
  limits: Readonly<PackageSizeLimits>;
  diagnostics: readonly PackageDiagnostic[];
  packageItem: CanonicalJumpPackage;
  files: SecurePackageFiles;
};

export class PackageSecurityError extends Error {
  constructor(
    readonly code: string,
    readonly parameters: Record<string, string | number> = {},
    readonly diagnostic?: PackageDiagnostic,
  ) {
    super(code);
    this.name = "PackageSecurityError";
  }
}

type CentralEntry = {
  name: string;
  compressedSize: number;
  expandedSize: number;
  crc: number;
  method: number;
  flags: number;
  localOffset: number;
};

const fail = (
  code: string,
  parameters: Record<string, string | number>,
): never => {
  throw new PackageSecurityError(code, parameters);
};

const checkedSlice = (bytes: Uint8Array, from: number, length: number) => {
  if (from < 0 || length < 0 || from + length > bytes.length)
    fail("archive.truncated", {});
  return bytes.subarray(from, from + length);
};

const decodeName = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("archive.filename_encoding", {});
  }
};

function validatedPath(name: string) {
  if (
    !name ||
    name.includes("\0") ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[a-z]:/i.test(name) ||
    name.endsWith("/")
  )
    fail("archive.path", {});
  const segments = name.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment !== segment.normalize("NFC"),
    )
  )
    fail("archive.path", {});
  const definition =
    segments.length === 1 && /^[a-z0-9._-]+\.jdef$/i.test(name);
  const extension = name.split(".").at(-1)?.toLocaleLowerCase() ?? "";
  const asset =
    segments.length >= 2 &&
    segments[0] === "assets" &&
    allowedAssetExtensions.has(extension);
  if (!definition && !asset) fail("archive.entry_type", { value0: name });
  return definition ? "definition" : "asset";
}

function parseCentralDirectory(bytes: Uint8Array): CentralEntry[] {
  if (bytes.length < 22) fail("archive.malformed", {});
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.length - 65_557);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) fail("archive.malformed", {});
  const commentLength = view.getUint16(end + 20, true);
  if (end + 22 + commentLength !== bytes.length)
    fail("archive.trailing_data", {});
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== view.getUint16(end + 10, true)
  )
    fail("archive.multi_disk", {});
  const entryCount = view.getUint16(end + 10, true);
  if (entryCount === 0xffff) fail("archive.zip64", {});
  if (entryCount < 1 || entryCount > MAX_ENTRIES)
    fail("archive.entry_count", { value0: MAX_ENTRIES });
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (directoryOffset + directorySize !== end) fail("archive.directory", {});

  const result: CentralEntry[] = [];
  const normalizedNames = new Set<string>();
  const localRanges: Array<readonly [number, number]> = [];
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    checkedSlice(bytes, cursor, 46);
    if (view.getUint32(cursor, true) !== 0x02014b50)
      fail("archive.directory", {});
    const versionMadeBy = view.getUint16(cursor + 4, true);
    const platform = versionMadeBy >>> 8;
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const disk = view.getUint16(cursor + 34, true);
    const externalAttributes = view.getUint32(cursor + 38, true);
    const localOffset = view.getUint32(cursor + 42, true);
    if (disk !== 0) fail("archive.multi_disk", {});
    if (flags & 0x0001 || flags & 0x0040) fail("archive.encrypted", {});
    if (method !== 0 && method !== 8) fail("archive.compression", {});
    const mode = platform === 3 ? externalAttributes >>> 16 : 0;
    const fileType = mode & 0xf000;
    if (
      (fileType !== 0 && fileType !== 0x8000) ||
      (externalAttributes & 0x10) !== 0
    )
      fail("archive.special_entry", {});
    const name = decodeName(checkedSlice(bytes, cursor + 46, nameLength));
    validatedPath(name);
    const normalized = name.normalize("NFC").toLocaleLowerCase();
    if (normalizedNames.has(normalized)) fail("archive.path_collision", {});
    normalizedNames.add(normalized);
    if (compressedSize === 0 && expandedSize > 0) fail("archive.ratio", {});
    if (
      compressedSize > 0 &&
      expandedSize / compressedSize > MAX_COMPRESSION_RATIO
    )
      fail("archive.ratio", { value0: MAX_COMPRESSION_RATIO });
    const extra = checkedSlice(bytes, cursor + 46 + nameLength, extraLength);
    for (let extraOffset = 0; extraOffset + 4 <= extra.length;) {
      const extraView = new DataView(
        extra.buffer,
        extra.byteOffset + extraOffset,
        extra.byteLength - extraOffset,
      );
      const kind = extraView.getUint16(0, true);
      const size = extraView.getUint16(2, true);
      if (extraOffset + 4 + size > extra.length)
        fail("archive.extra_field", {});
      if (kind === 0x0001 || kind === 0x000d) fail("archive.extra_field", {});
      extraOffset += 4 + size;
    }
    const local = localOffset;
    checkedSlice(bytes, local, 30);
    if (view.getUint32(local, true) !== 0x04034b50)
      fail("archive.local_header", {});
    const localFlags = view.getUint16(local + 6, true);
    const localMethod = view.getUint16(local + 8, true);
    const localNameLength = view.getUint16(local + 26, true);
    const localExtraLength = view.getUint16(local + 28, true);
    const localName = decodeName(
      checkedSlice(bytes, local + 30, localNameLength),
    );
    if (localName !== name || localFlags !== flags || localMethod !== method)
      fail("archive.header_mismatch", {});
    if (!(flags & 0x0008)) {
      const localCrc = view.getUint32(local + 14, true);
      const localCompressedSize = view.getUint32(local + 18, true);
      const localExpandedSize = view.getUint32(local + 22, true);
      if (
        localCrc !== crc ||
        localCompressedSize !== compressedSize ||
        localExpandedSize !== expandedSize
      )
        fail("archive.header_mismatch", {});
    }
    const localData = local + 30 + localNameLength + localExtraLength;
    checkedSlice(bytes, localData, compressedSize);
    const localEnd = localData + compressedSize;
    if (
      localRanges.some(
        ([start, endOffset]) => local < endOffset && localEnd > start,
      )
    )
      fail("archive.overlap", {});
    localRanges.push([local, localEnd]);
    result.push({
      name,
      compressedSize,
      expandedSize,
      crc,
      method,
      flags,
      localOffset,
    });
    cursor += 46 + nameLength + extraLength + entryCommentLength;
  }
  if (cursor !== end) fail("archive.directory", {});
  return result;
}

const crcTable = (() => {
  const result = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1)
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    result[value] = current >>> 0;
  }
  return result;
})();

const crc32 = (bytes: Uint8Array) => {
  let value = 0xffffffff;
  for (const byte of bytes)
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

function expandArchive(
  archive: Uint8Array,
  entries: readonly CentralEntry[],
  limits: Readonly<PackageSizeLimits>,
  signal?: AbortSignal,
) {
  const metadata = new Map<string, CentralEntry>(
    entries.map((entry) => [entry.name, entry] as const),
  );
  const output = new Map<string, Uint8Array>();
  const running = new Set<{ terminate?: () => void }>();
  let expandedTotal = 0;
  let compressedTotal = 0;
  let fatal: unknown;
  const unzipper = new Unzip((file) => {
    try {
      if (signal?.aborted) fail("archive.cancelled", {});
      const selectedEntry = metadata.get(file.name);
      if (!selectedEntry) fail("archive.entry_mismatch", {});
      const entry = selectedEntry as CentralEntry;
      compressedTotal += entry.compressedSize;
      const kind = validatedPath(file.name);
      const byteLimit =
        (kind === "definition"
          ? limits.maxDefinitionFileMiB
          : limits.maxAssetFileMiB) * MiB;
      const chunks: Uint8Array[] = [];
      let fileBytes = 0;
      running.add(file);
      file.ondata = (error, chunk, final) => {
        if (fatal) return;
        try {
          if (error) throw error;
          if (signal?.aborted) fail("archive.cancelled", {});
          fileBytes += chunk.length;
          expandedTotal += chunk.length;
          if (fileBytes > byteLimit)
            fail("archive.file_limit", {
              value0: kind,
              value1: byteLimit / MiB,
            });
          if (expandedTotal > limits.maxExpandedPackageMiB * MiB)
            fail("archive.expanded_limit", {
              value0: limits.maxExpandedPackageMiB,
            });
          if (
            entry.compressedSize === 0
              ? fileBytes > 0
              : fileBytes / entry.compressedSize > MAX_COMPRESSION_RATIO
          )
            fail("archive.ratio", { value0: MAX_COMPRESSION_RATIO });
          if (chunk.length) chunks.push(chunk.slice());
          if (!final) return;
          const complete = new Uint8Array(fileBytes);
          let cursor = 0;
          for (const item of chunks) {
            complete.set(item, cursor);
            cursor += item.length;
          }
          if (fileBytes !== entry.expandedSize)
            fail("archive.size_mismatch", {});
          if (crc32(complete) !== entry.crc) fail("archive.crc", {});
          output.set(file.name, complete);
          running.delete(file);
        } catch (caught) {
          fatal = caught;
          for (const active of running) active.terminate?.();
        }
      };
      file.start();
    } catch (caught) {
      fatal = caught;
      for (const active of running) active.terminate?.();
    }
  });
  unzipper.register(UnzipInflate);
  for (let offset = 0; offset < archive.length && !fatal; offset += 64 * 1024)
    unzipper.push(
      archive.subarray(offset, Math.min(offset + 64 * 1024, archive.length)),
      offset + 64 * 1024 >= archive.length,
    );
  if (fatal) throw fatal;
  if (running.size || output.size !== entries.length)
    fail("archive.truncated", {});
  if (
    compressedTotal === 0
      ? expandedTotal > 0
      : expandedTotal / compressedTotal > MAX_COMPRESSION_RATIO
  )
    fail("archive.ratio", { value0: MAX_COMPRESSION_RATIO });
  return { output, expandedTotal };
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((value, index) => bytes[index] === value);

export type CanonicalAssetExtension =
  "png" | "jpg" | "gif" | "webp" | "avif" | "svg";

export function canonicalAssetExtension(
  bytes: Uint8Array,
): CanonicalAssetExtension | null {
  if (startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return "png";
  if (startsWith(bytes, [0xff, 0xd8])) return "jpg";
  const text = new TextDecoder();
  if (["GIF87a", "GIF89a"].includes(text.decode(bytes.subarray(0, 6))))
    return "gif";
  if (
    text.decode(bytes.subarray(0, 4)) === "RIFF" &&
    text.decode(bytes.subarray(8, 12)) === "WEBP"
  )
    return "webp";
  if (
    text.decode(bytes.subarray(4, 8)) === "ftyp" &&
    text.decode(bytes.subarray(8, 32)).includes("avif")
  )
    return "avif";
  if (validateSvgBytes(bytes)?.valid) return "svg";
  return null;
}

function imageGeometry(path: string, bytes: Uint8Array) {
  const extension = path.split(".").at(-1)?.toLocaleLowerCase();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (extension === "png") {
    if (
      bytes.length < 24 ||
      !startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]) ||
      new TextDecoder().decode(bytes.subarray(12, 16)) !== "IHDR"
    )
      fail("asset.signature", { value0: path });
    let offset = 8;
    let width = 0;
    let height = 0;
    let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const end = offset + 12 + length;
      if (end > bytes.length) fail("asset.decode", { value0: path });
      const type = new TextDecoder().decode(
        bytes.subarray(offset + 4, offset + 8),
      );
      const expectedCrc = view.getUint32(offset + 8 + length);
      if (
        crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== expectedCrc
      )
        fail("asset.crc", { value0: path });
      if (offset === 8 && (type !== "IHDR" || length !== 13))
        fail("asset.decode", { value0: path });
      if (type === "IHDR") {
        if (width || height) fail("asset.decode", { value0: path });
        width = view.getUint32(offset + 8);
        height = view.getUint32(offset + 12);
      }
      if (type === "IEND") {
        if (length !== 0 || end !== bytes.length)
          fail("asset.polyglot", { value0: path });
        ended = true;
      }
      offset = end;
      if (ended) break;
    }
    if (!ended || !width || !height) fail("asset.decode", { value0: path });
    return [width, height] as const;
  }
  if (extension === "gif") {
    const header = new TextDecoder().decode(bytes.subarray(0, 6));
    if (bytes.length < 14 || !["GIF87a", "GIF89a"].includes(header))
      fail("asset.signature", { value0: path });
    if (bytes.at(-1) !== 0x3b) fail("asset.polyglot", { value0: path });
    return [view.getUint16(6, true), view.getUint16(8, true)] as const;
  }
  if (extension === "jpg" || extension === "jpeg") {
    if (bytes.length < 4 || !startsWith(bytes, [0xff, 0xd8]))
      fail("asset.signature", { value0: path });
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd9) break;
      if (marker === 0xda) {
        const end = bytes.lastIndexOf(0xff);
        if (end !== bytes.length - 2 || bytes[end + 1] !== 0xd9)
          fail("asset.decode", { value0: path });
        break;
      }
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length)
        fail("asset.decode", { value0: path });
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        const width = view.getUint16(offset + 7);
        const height = view.getUint16(offset + 5);
        const orientation = jpegTechnicalMetadata(bytes).orientation;
        return orientation >= 5 && orientation <= 8
          ? ([height, width] as const)
          : ([width, height] as const);
      }
      offset += 2 + length;
    }
    fail("asset.decode", { value0: path });
  }
  if (extension === "webp") {
    if (
      bytes.length < 30 ||
      new TextDecoder().decode(bytes.subarray(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(bytes.subarray(8, 12)) !== "WEBP" ||
      new TextDecoder().decode(bytes.subarray(12, 16)) !== "VP8X" ||
      view.getUint32(4, true) + 8 !== bytes.length
    )
      fail("asset.decode", { value0: path });
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return [width, height] as const;
  }
  if (extension === "avif") {
    if (
      bytes.length < 32 ||
      new TextDecoder().decode(bytes.subarray(4, 8)) !== "ftyp" ||
      !new TextDecoder().decode(bytes.subarray(8, 32)).includes("avif")
    )
      fail("asset.signature", { value0: path });
    for (let offset = 4; offset + 16 <= bytes.length; offset += 1)
      if (
        new TextDecoder().decode(bytes.subarray(offset, offset + 4)) === "ispe"
      )
        return [
          view.getUint32(offset + 8),
          view.getUint32(offset + 12),
        ] as const;
    fail("asset.decode", { value0: path });
  }
  if (extension === "svg") {
    const validation = validateSvgBytes(bytes);
    if (!validation || !validation.valid)
      return fail("asset.signature", { value0: path });
    return [validation.width, validation.height] as const;
  }
  return fail("asset.extension", { value0: path });
}

async function validateImages(assets: Readonly<Record<string, Uint8Array>>) {
  let totalPixels = 0;
  for (const [path, bytes] of Object.entries(assets)) {
    const [width, height] = imageGeometry(path, bytes);
    const pixels = width * height;
    if (
      width < 1 ||
      height < 1 ||
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION ||
      pixels > MAX_IMAGE_PIXELS
    )
      fail("asset.dimensions", { value0: path });
    totalPixels += pixels;
    if (totalPixels > MAX_TOTAL_IMAGE_PIXELS) fail("asset.total_pixels", {});
    if (
      !path.toLocaleLowerCase().endsWith(".svg") &&
      typeof globalThis.createImageBitmap === "function"
    ) {
      try {
        const copy = bytes.slice();
        const image = await globalThis.createImageBitmap(
          new Blob([copy.buffer], {
            type: path.toLocaleLowerCase().endsWith(".svg")
              ? "image/svg+xml"
              : `image/${path.split(".").at(-1)}`,
          }),
          { imageOrientation: "from-image" },
        );
        const decodedWidth = image.width;
        const decodedHeight = image.height;
        image.close();
        if (decodedWidth !== width || decodedHeight !== height)
          fail("asset.size_mismatch", { value0: path });
      } catch (error) {
        if (error instanceof PackageSecurityError) throw error;
        fail("asset.decode", { value0: path });
      }
    }
  }
}

/** Uses the same mandatory signature, polyglot, geometry, and decode boundary
 * as package import for an asset selected directly in Structured authoring. */
export async function validatePackageAsset(path: string, bytes: Uint8Array) {
  await validateImages({ [path]: bytes });
}

export type PackageAssetMetadata = {
  format: string;
  canonicalExtension: CanonicalAssetExtension;
  width: number;
  height: number;
  bytes: number;
  header: ImageHeaderMetadata;
};

export function inspectPackageAsset(
  path: string,
  bytes: Uint8Array,
): PackageAssetMetadata {
  const [width, height] = imageGeometry(path, bytes);
  const canonicalExtension = canonicalAssetExtension(bytes);
  if (!canonicalExtension) return fail("asset.signature", { value0: path });
  return {
    format:
      canonicalExtension === "jpg"
        ? "JPEG"
        : canonicalExtension.toLocaleUpperCase(),
    canonicalExtension,
    width,
    height,
    bytes: bytes.byteLength,
    header: imageHeaderMetadata(bytes, canonicalExtension),
  };
}

function referencedAssets(packageItem: CanonicalJumpPackage) {
  const fromGrants = packageItem.choices.flatMap((choice) => [
    ...choice.grants.flatMap((grant) => grant.images),
    ...choice.inputs.flatMap((input) =>
      input.grants.flatMap((grant) => grant.images),
    ),
  ]);
  return new Set(
    [
      ...packageItem.sections.flatMap((section) => section.images),
      ...packageItem.choices.flatMap((choice) => choice.images),
      ...fromGrants,
    ].flatMap((image) => (image.src ? [image.src] : [])),
  );
}

function decodePackage(
  extracted: ReadonlyMap<string, Uint8Array>,
  hash: string,
) {
  const definitions: Record<string, string> = {};
  const assets: Record<string, Uint8Array> = {};
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const [path, bytes] of extracted) {
    if (path.endsWith(".jdef")) {
      try {
        definitions[path] = decoder.decode(bytes);
      } catch {
        fail("definition.encoding", { value0: path });
      }
    } else assets[path] = bytes;
  }
  const packageItem = canonicalizePackage(
    {
      id: hash.slice(0, 24),
      logicalId: hash.slice(0, 24),
      source: "imported",
      exactHash: hash,
      files: definitions,
    },
    {
      profile: "distribution",
      assetPaths: Object.keys(assets).map(assetRelativePath),
    },
  );
  const errors = packageItem.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errors.length)
    throw new PackageSecurityError("package.invalid", {}, errors[0]);
  for (const path of referencedAssets(packageItem))
    if (!assets[assetArchivePath(path)])
      fail("package.missing_asset", { value0: path });
  return { packageItem, definitions, assets };
}

export class JumpPackageImportService {
  async inspect(
    archive: Uint8Array,
    limits: Readonly<PackageSizeLimits>,
    signal?: AbortSignal,
  ): Promise<PackageImportReview> {
    if (archive.byteLength > limits.maxArchiveMiB * MiB)
      fail("archive.size_limit", { value0: limits.maxArchiveMiB });
    const entries = parseCentralDirectory(archive);
    const { output, expandedTotal } = expandArchive(
      archive,
      entries,
      limits,
      signal,
    );
    const hash = sha256(archive);
    const { packageItem, definitions, assets } = decodePackage(output, hash);
    await validateImages(assets);
    const warnings = packageItem.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    );
    return {
      status: warnings.length ? "warning" : "ready",
      identity: packageItem.logicalId,
      name: packageItem.name.base ?? "Untitled Jump",
      version: packageItem.version,
      hash,
      definitionCount: Object.keys(definitions).length,
      assetCount: Object.keys(assets).length,
      expandedBytes: expandedTotal,
      limits,
      diagnostics: packageItem.diagnostics,
      packageItem,
      files: { definitions, assets },
    };
  }

  async export(files: SecurePackageFiles, limits: Readonly<PackageSizeLimits>) {
    const entries: Zippable = {};
    let expanded = 0;
    for (const [path, source] of Object.entries(files.definitions)) {
      if (validatedPath(path) !== "definition")
        fail("export.path", { value0: path });
      const bytes = new TextEncoder().encode(source);
      if (bytes.length > limits.maxDefinitionFileMiB * MiB)
        fail("export.file_limit", { value0: path });
      expanded += bytes.length;
      entries[path] = bytes;
    }
    for (const [path, bytes] of Object.entries(files.assets)) {
      if (validatedPath(path) !== "asset")
        fail("export.path", { value0: path });
      if (bytes.length > limits.maxAssetFileMiB * MiB)
        fail("export.file_limit", { value0: path });
      expanded += bytes.length;
      entries[path] = bytes;
    }
    if (Object.keys(entries).length > MAX_ENTRIES)
      fail("export.entry_count", { value0: MAX_ENTRIES });
    if (expanded > limits.maxExpandedPackageMiB * MiB)
      fail("export.expanded_limit", {});
    const staged = new Map<string, Uint8Array>([
      ...Object.entries(files.definitions).map(
        ([path, source]) => [path, new TextEncoder().encode(source)] as const,
      ),
      ...Object.entries(files.assets),
    ]);
    decodePackage(
      staged,
      sha256(
        Object.entries(files.definitions)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, source]) => `${path}\0${source}`)
          .join("\0"),
      ),
    );
    await validateImages(files.assets);
    const archive = zipSync(entries, { level: 6 });
    if (archive.length > limits.maxArchiveMiB * MiB)
      fail("export.archive_limit", {});
    parseCentralDirectory(archive);
    return archive;
  }
}
