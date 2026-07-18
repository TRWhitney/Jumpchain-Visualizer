import { Unzip, UnzipInflate, zipSync, type Zippable } from "fflate";
import {
  canonicalizePackage,
  sha256,
  type CanonicalJumpPackage,
  type PackageDiagnostic,
} from "../markup";
import type { PackageSizeLimits } from "../settings/model";

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
    message: string,
  ) {
    super(message);
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

const fail = (code: string, message: string): never => {
  throw new PackageSecurityError(code, message);
};

const checkedSlice = (bytes: Uint8Array, from: number, length: number) => {
  if (from < 0 || length < 0 || from + length > bytes.length)
    fail(
      "archive.truncated",
      "The archive is truncated or has invalid offsets.",
    );
  return bytes.subarray(from, from + length);
};

const decodeName = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail(
      "archive.filename_encoding",
      "An entry name is not valid UTF-8.",
    );
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
    fail("archive.path", "The archive contains an unsafe or non-file path.");
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
    fail("archive.path", "The archive contains a non-canonical path.");
  const definition =
    segments.length === 1 && /^[a-z0-9._-]+\.jdef$/i.test(name);
  const extension = name.split(".").at(-1)?.toLocaleLowerCase() ?? "";
  const asset =
    segments.length >= 2 &&
    segments[0] === "assets" &&
    allowedAssetExtensions.has(extension);
  if (!definition && !asset)
    fail(
      "archive.entry_type",
      `Unexpected package entry “${name}”. Only .jdef files and supported raster assets are allowed.`,
    );
  return definition ? "definition" : "asset";
}

function parseCentralDirectory(bytes: Uint8Array): CentralEntry[] {
  if (bytes.length < 22)
    fail("archive.malformed", "The file is not a complete ZIP archive.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.length - 65_557);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) fail("archive.malformed", "The ZIP end record is missing.");
  const commentLength = view.getUint16(end + 20, true);
  if (end + 22 + commentLength !== bytes.length)
    fail(
      "archive.trailing_data",
      "The archive contains trailing or polyglot data.",
    );
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== view.getUint16(end + 10, true)
  )
    fail("archive.multi_disk", "Multi-disk ZIP archives are not supported.");
  const entryCount = view.getUint16(end + 10, true);
  if (entryCount === 0xffff)
    fail("archive.zip64", "ZIP64 packages are not supported.");
  if (entryCount < 1 || entryCount > MAX_ENTRIES)
    fail(
      "archive.entry_count",
      `Packages must contain between 1 and ${MAX_ENTRIES} entries.`,
    );
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (directoryOffset + directorySize !== end)
    fail("archive.directory", "The central directory bounds are inconsistent.");

  const result: CentralEntry[] = [];
  const normalizedNames = new Set<string>();
  const localRanges: Array<readonly [number, number]> = [];
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    checkedSlice(bytes, cursor, 46);
    if (view.getUint32(cursor, true) !== 0x02014b50)
      fail("archive.directory", "A central-directory header is malformed.");
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
    if (disk !== 0)
      fail("archive.multi_disk", "An entry points to another ZIP disk.");
    if (flags & 0x0001 || flags & 0x0040)
      fail("archive.encrypted", "Encrypted package entries are not allowed.");
    if (method !== 0 && method !== 8)
      fail(
        "archive.compression",
        "An unsupported compression method was used.",
      );
    const mode = platform === 3 ? externalAttributes >>> 16 : 0;
    const fileType = mode & 0xf000;
    if (
      (fileType !== 0 && fileType !== 0x8000) ||
      (externalAttributes & 0x10) !== 0
    )
      fail(
        "archive.special_entry",
        "Links, directories, devices, and other special entries are not allowed.",
      );
    const name = decodeName(checkedSlice(bytes, cursor + 46, nameLength));
    validatedPath(name);
    const normalized = name.normalize("NFC").toLocaleLowerCase();
    if (normalizedNames.has(normalized))
      fail(
        "archive.path_collision",
        "The archive contains duplicate or case-folded path collisions.",
      );
    normalizedNames.add(normalized);
    if (compressedSize === 0 && expandedSize > 0)
      fail(
        "archive.ratio",
        "An entry declares an impossible compression ratio.",
      );
    if (
      compressedSize > 0 &&
      expandedSize / compressedSize > MAX_COMPRESSION_RATIO
    )
      fail(
        "archive.ratio",
        `An entry exceeds the mandatory ${MAX_COMPRESSION_RATIO}:1 compression-ratio limit.`,
      );
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
        fail("archive.extra_field", "An entry has a malformed extra field.");
      if (kind === 0x0001 || kind === 0x000d)
        fail(
          "archive.extra_field",
          "ZIP64 and link-capable Unix extra fields are not allowed.",
        );
      extraOffset += 4 + size;
    }
    const local = localOffset;
    checkedSlice(bytes, local, 30);
    if (view.getUint32(local, true) !== 0x04034b50)
      fail("archive.local_header", "A local file header is malformed.");
    const localFlags = view.getUint16(local + 6, true);
    const localMethod = view.getUint16(local + 8, true);
    const localNameLength = view.getUint16(local + 26, true);
    const localExtraLength = view.getUint16(local + 28, true);
    const localName = decodeName(
      checkedSlice(bytes, local + 30, localNameLength),
    );
    if (localName !== name || localFlags !== flags || localMethod !== method)
      fail(
        "archive.header_mismatch",
        "Local and central entry headers do not agree.",
      );
    if (!(flags & 0x0008)) {
      const localCrc = view.getUint32(local + 14, true);
      const localCompressedSize = view.getUint32(local + 18, true);
      const localExpandedSize = view.getUint32(local + 22, true);
      if (
        localCrc !== crc ||
        localCompressedSize !== compressedSize ||
        localExpandedSize !== expandedSize
      )
        fail(
          "archive.header_mismatch",
          "Local and central entry integrity fields do not agree.",
        );
    }
    const localData = local + 30 + localNameLength + localExtraLength;
    checkedSlice(bytes, localData, compressedSize);
    const localEnd = localData + compressedSize;
    if (
      localRanges.some(
        ([start, endOffset]) => local < endOffset && localEnd > start,
      )
    )
      fail("archive.overlap", "Archive entries overlap in storage.");
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
  if (cursor !== end)
    fail("archive.directory", "The central directory has unexpected bytes.");
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
      if (signal?.aborted) fail("archive.cancelled", "Import was cancelled.");
      const selectedEntry = metadata.get(file.name);
      if (!selectedEntry)
        fail(
          "archive.entry_mismatch",
          "The ZIP stream exposed an unknown entry.",
        );
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
          if (signal?.aborted)
            fail("archive.cancelled", "Import was cancelled.");
          fileBytes += chunk.length;
          expandedTotal += chunk.length;
          if (fileBytes > byteLimit)
            fail(
              "archive.file_limit",
              `An expanded ${kind} exceeds the effective ${byteLimit / MiB} MiB limit.`,
            );
          if (expandedTotal > limits.maxExpandedPackageMiB * MiB)
            fail(
              "archive.expanded_limit",
              `Expanded package data exceeds the effective ${limits.maxExpandedPackageMiB} MiB limit.`,
            );
          if (
            entry.compressedSize === 0
              ? fileBytes > 0
              : fileBytes / entry.compressedSize > MAX_COMPRESSION_RATIO
          )
            fail(
              "archive.ratio",
              `An entry exceeds the mandatory ${MAX_COMPRESSION_RATIO}:1 compression-ratio limit while streaming.`,
            );
          if (chunk.length) chunks.push(chunk.slice());
          if (!final) return;
          const complete = new Uint8Array(fileBytes);
          let cursor = 0;
          for (const item of chunks) {
            complete.set(item, cursor);
            cursor += item.length;
          }
          if (fileBytes !== entry.expandedSize)
            fail(
              "archive.size_mismatch",
              "An entry's actual expanded size does not match its ZIP header.",
            );
          if (crc32(complete) !== entry.crc)
            fail("archive.crc", "An entry failed its CRC integrity check.");
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
    fail("archive.truncated", "Not every archive entry completed extraction.");
  if (
    compressedTotal === 0
      ? expandedTotal > 0
      : expandedTotal / compressedTotal > MAX_COMPRESSION_RATIO
  )
    fail(
      "archive.ratio",
      `The package exceeds the mandatory ${MAX_COMPRESSION_RATIO}:1 overall compression-ratio limit.`,
    );
  return { output, expandedTotal };
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((value, index) => bytes[index] === value);

function imageGeometry(path: string, bytes: Uint8Array) {
  const extension = path.split(".").at(-1)?.toLocaleLowerCase();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (extension === "png") {
    if (
      bytes.length < 24 ||
      !startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]) ||
      new TextDecoder().decode(bytes.subarray(12, 16)) !== "IHDR"
    )
      fail("asset.signature", `${path} is not a well-formed PNG image.`);
    let offset = 8;
    let width = 0;
    let height = 0;
    let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const end = offset + 12 + length;
      if (end > bytes.length)
        fail("asset.decode", `${path} has a truncated PNG chunk.`);
      const type = new TextDecoder().decode(
        bytes.subarray(offset + 4, offset + 8),
      );
      const expectedCrc = view.getUint32(offset + 8 + length);
      if (
        crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== expectedCrc
      )
        fail("asset.crc", `${path} has an invalid PNG chunk CRC.`);
      if (offset === 8 && (type !== "IHDR" || length !== 13))
        fail("asset.decode", `${path} does not begin with one PNG IHDR chunk.`);
      if (type === "IHDR") {
        if (width || height)
          fail("asset.decode", `${path} repeats its PNG IHDR chunk.`);
        width = view.getUint32(offset + 8);
        height = view.getUint32(offset + 12);
      }
      if (type === "IEND") {
        if (length !== 0 || end !== bytes.length)
          fail("asset.polyglot", `${path} contains data after PNG IEND.`);
        ended = true;
      }
      offset = end;
      if (ended) break;
    }
    if (!ended || !width || !height)
      fail("asset.decode", `${path} is not a complete PNG image.`);
    return [width, height] as const;
  }
  if (extension === "gif") {
    const header = new TextDecoder().decode(bytes.subarray(0, 6));
    if (bytes.length < 14 || !["GIF87a", "GIF89a"].includes(header))
      fail("asset.signature", `${path} is not a well-formed GIF image.`);
    if (bytes.at(-1) !== 0x3b)
      fail("asset.polyglot", `${path} has no terminal GIF trailer.`);
    return [view.getUint16(6, true), view.getUint16(8, true)] as const;
  }
  if (extension === "jpg" || extension === "jpeg") {
    if (bytes.length < 4 || !startsWith(bytes, [0xff, 0xd8]))
      fail("asset.signature", `${path} is not a JPEG image.`);
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
          fail("asset.decode", `${path} has no complete JPEG end marker.`);
        break;
      }
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length)
        fail("asset.decode", `${path} has malformed JPEG segments.`);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return [
          view.getUint16(offset + 7),
          view.getUint16(offset + 5),
        ] as const;
      offset += 2 + length;
    }
    fail("asset.decode", `${path} has no supported JPEG frame header.`);
  }
  if (extension === "webp") {
    if (
      bytes.length < 30 ||
      new TextDecoder().decode(bytes.subarray(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(bytes.subarray(8, 12)) !== "WEBP" ||
      new TextDecoder().decode(bytes.subarray(12, 16)) !== "VP8X" ||
      view.getUint32(4, true) + 8 !== bytes.length
    )
      fail(
        "asset.decode",
        `${path} must be a well-formed extended WebP image.`,
      );
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
      fail("asset.signature", `${path} is not an AVIF image.`);
    for (let offset = 4; offset + 16 <= bytes.length; offset += 1)
      if (
        new TextDecoder().decode(bytes.subarray(offset, offset + 4)) === "ispe"
      )
        return [
          view.getUint32(offset + 8),
          view.getUint32(offset + 12),
        ] as const;
    fail("asset.decode", `${path} has no AVIF spatial dimensions.`);
  }
  return fail("asset.extension", `${path} has an unsupported image extension.`);
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
      fail(
        "asset.dimensions",
        `${path} exceeds the mandatory decoded-image dimensions or pixel budget.`,
      );
    totalPixels += pixels;
    if (totalPixels > MAX_TOTAL_IMAGE_PIXELS)
      fail(
        "asset.total_pixels",
        "Package images exceed the mandatory total decoded-pixel budget.",
      );
    if (typeof globalThis.createImageBitmap === "function") {
      try {
        const copy = bytes.slice();
        const image = await globalThis.createImageBitmap(
          new Blob([copy.buffer], { type: `image/${path.split(".").at(-1)}` }),
        );
        const decodedWidth = image.width;
        const decodedHeight = image.height;
        image.close();
        if (decodedWidth !== width || decodedHeight !== height)
          fail(
            "asset.size_mismatch",
            `${path} reports inconsistent decoded dimensions.`,
          );
      } catch (error) {
        if (error instanceof PackageSecurityError) throw error;
        fail("asset.decode", `${path} could not be decoded safely.`);
      }
    }
  }
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
        fail("definition.encoding", `${path} is not valid UTF-8 source.`);
      }
    } else assets[path] = bytes;
  }
  const packageItem = canonicalizePackage({
    id: hash.slice(0, 24),
    logicalId: hash.slice(0, 24),
    source: "imported",
    exactHash: hash,
    files: definitions,
  });
  const errors = packageItem.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errors.length)
    fail("package.invalid", `The package is malformed: ${errors[0].message}`);
  for (const path of referencedAssets(packageItem))
    if (!assets[path])
      fail("package.missing_asset", `Required asset “${path}” is missing.`);
  return { packageItem, definitions, assets };
}

export class JumpPackageImportService {
  async inspect(
    archive: Uint8Array,
    limits: Readonly<PackageSizeLimits>,
    signal?: AbortSignal,
  ): Promise<PackageImportReview> {
    if (archive.byteLength > limits.maxArchiveMiB * MiB)
      fail(
        "archive.size_limit",
        `The .jmp archive exceeds the effective ${limits.maxArchiveMiB} MiB limit.`,
      );
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
        fail("export.path", `Invalid definition path “${path}”.`);
      const bytes = new TextEncoder().encode(source);
      if (bytes.length > limits.maxDefinitionFileMiB * MiB)
        fail(
          "export.file_limit",
          `${path} exceeds the effective definition-file limit.`,
        );
      expanded += bytes.length;
      entries[path] = bytes;
    }
    for (const [path, bytes] of Object.entries(files.assets)) {
      if (validatedPath(path) !== "asset")
        fail("export.path", `Invalid asset path “${path}”.`);
      if (bytes.length > limits.maxAssetFileMiB * MiB)
        fail("export.file_limit", `${path} exceeds the effective asset limit.`);
      expanded += bytes.length;
      entries[path] = bytes;
    }
    if (Object.keys(entries).length > MAX_ENTRIES)
      fail(
        "export.entry_count",
        `Packages may contain at most ${MAX_ENTRIES} entries.`,
      );
    if (expanded > limits.maxExpandedPackageMiB * MiB)
      fail(
        "export.expanded_limit",
        "The package exceeds the expanded-data limit.",
      );
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
      fail(
        "export.archive_limit",
        "The compressed archive exceeds the archive limit.",
      );
    parseCentralDirectory(archive);
    return archive;
  }
}
