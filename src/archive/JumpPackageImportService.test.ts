import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createStarterWorkspace } from "../editor";
import { SAFE_PACKAGE_SIZE_LIMITS } from "../settings/model";
import {
  JumpPackageImportService,
  PackageSecurityError,
} from "./JumpPackageImportService";

const bytes = (value: string) => new TextEncoder().encode(value);
const signatureOffset = (archive: Uint8Array, signature: number) => {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  for (let offset = 0; offset + 4 <= archive.length; offset += 1)
    if (view.getUint32(offset, true) === signature) return offset;
  throw new Error("ZIP signature missing from test fixture");
};

describe("secure Jump package boundary", () => {
  it("round-trips a valid package through export and streamed import", async () => {
    const service = new JumpPackageImportService();
    const workspace = createStarterWorkspace("secure-round-trip");
    const archive = await service.export(
      { definitions: workspace.files, assets: workspace.assets },
      SAFE_PACKAGE_SIZE_LIMITS,
    );
    const review = await service.inspect(archive, SAFE_PACKAGE_SIZE_LIMITS);
    expect(review).toMatchObject({
      status: "ready",
      name: "Untitled Jump",
      version: "0.1",
      definitionCount: 3,
      assetCount: 0,
    });
    expect(review.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks invalid distributable source before compression", async () => {
    await expect(
      new JumpPackageImportService().export(
        {
          definitions: { "jump.jdef": "jump\n  format: 1\n" },
          assets: {},
        },
        SAFE_PACKAGE_SIZE_LIMITS,
      ),
    ).rejects.toMatchObject({ code: "package.invalid" });
  });

  it.each([
    ["../jump.jdef", "archive.path"],
    ["JUMP.JDEF", "archive.path_collision"],
    ["payload.html", "archive.entry_type"],
    ["assets/nested.jmp", "archive.entry_type"],
  ])("blocks unsafe entry %s", async (path, code) => {
    const entries: Record<string, Uint8Array> = {
      "jump.jdef": bytes(createStarterWorkspace().files["jump.jdef"]),
      [path]: bytes("unsafe"),
    };
    if (path === "JUMP.JDEF") entries["jump.jdef"] = bytes("duplicate");
    const archive = zipSync(entries);
    const service = new JumpPackageImportService();
    await expect(
      service.inspect(archive, SAFE_PACKAGE_SIZE_LIMITS),
    ).rejects.toMatchObject({ code });
  });

  it("blocks compression bombs regardless of configured byte budgets", async () => {
    const archive = zipSync({
      "jump.jdef": bytes("A".repeat(500_000)),
    });
    const service = new JumpPackageImportService();
    await expect(
      service.inspect(archive, {
        maxArchiveMiB: 512,
        maxDefinitionFileMiB: 16,
        maxAssetFileMiB: 256,
        maxExpandedPackageMiB: 1024,
      }),
    ).rejects.toBeInstanceOf(PackageSecurityError);
    await expect(
      service.inspect(archive, {
        maxArchiveMiB: 512,
        maxDefinitionFileMiB: 16,
        maxAssetFileMiB: 256,
        maxExpandedPackageMiB: 1024,
      }),
    ).rejects.toMatchObject({ code: "archive.ratio" });
  });

  it("rejects a malformed image before exposing package bytes", async () => {
    const source = createStarterWorkspace().files["jump.jdef"].replace(
      "section\n  handle: introduction",
      'section\n  handle: introduction\n  name: "Introduction"\n\n  image\n    handle: bad\n    src: "assets/bad.png"\n    alt: "Bad"\n\nsection\n  handle: second',
    );
    const archive = zipSync({
      "jump.jdef": bytes(source),
      "assets/bad.png": bytes("<script>alert(1)</script>"),
    });
    await expect(
      new JumpPackageImportService().inspect(archive, SAFE_PACKAGE_SIZE_LIMITS),
    ).rejects.toMatchObject({ code: "asset.signature" });
  });

  it.each([
    [
      "local integrity mismatch",
      "archive.header_mismatch",
      (archive: Uint8Array) => {
        const result = archive.slice();
        result[14] ^= 0xff;
        return result;
      },
    ],
    [
      "encrypted flag",
      "archive.encrypted",
      (archive: Uint8Array) => {
        const result = archive.slice();
        const view = new DataView(result.buffer);
        const central = signatureOffset(result, 0x02014b50);
        view.setUint16(6, view.getUint16(6, true) | 1, true);
        view.setUint16(
          central + 8,
          view.getUint16(central + 8, true) | 1,
          true,
        );
        return result;
      },
    ],
    [
      "trailing polyglot",
      "archive.trailing_data",
      (archive: Uint8Array) => {
        const result = new Uint8Array(archive.length + 8);
        result.set(archive);
        result.set(bytes("<script>"), archive.length);
        return result;
      },
    ],
  ])("rejects %s archives atomically", async (_name, code, mutate) => {
    const archive = zipSync(
      {
        "jump.jdef": bytes(createStarterWorkspace().files["jump.jdef"]),
      },
      { level: 0 },
    );
    await expect(
      new JumpPackageImportService().inspect(
        mutate(archive),
        SAFE_PACKAGE_SIZE_LIMITS,
      ),
    ).rejects.toMatchObject({ code });
  });
});
