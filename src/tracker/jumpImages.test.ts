import { describe, expect, it } from "vitest";
import { generatedPackageById } from "../fixtures/generatedPackages";
import { jumpPackageImageSources, resolveJumpImageSource } from "./jumpImages";

describe("Jump image preparation", () => {
  it("collects and deduplicates package-relative section, choice, and grant images", () => {
    expect(
      jumpPackageImageSources(generatedPackageById["confluence-engine"]),
    ).toEqual(["/assets/confluence-engine.svg"]);
    expect(
      jumpPackageImageSources(generatedPackageById["threshold-roads"]),
    ).toEqual(["/assets/threshold-mark.svg"]);
  });

  it("uses the package resolver without allowing absolute or scheme sources", () => {
    expect(
      resolveJumpImageSource("mark.png", (path) => `asset://${path}`),
    ).toBe("asset://mark.png");
    expect(resolveJumpImageSource("/assets/mark.png")).toBeNull();
    expect(resolveJumpImageSource("https://example.test/mark.png")).toBeNull();
  });
});
