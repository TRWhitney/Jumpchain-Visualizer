import { describe, expect, it } from "vitest";
import {
  assetArchivePath,
  assetBasename,
  assetFolder,
  assetReferences,
  assetRelativePath,
  buildAssetTree,
  renameAssetReferences,
  validateAssetRelativePath,
} from "./assetPaths";

describe("editor asset paths", () => {
  it("keeps the archive root internal while retaining meaningful folders", () => {
    expect(assetArchivePath("icons/banner.png")).toBe(
      "assets/icons/banner.png",
    );
    expect(assetRelativePath("assets/icons/banner.png")).toBe(
      "icons/banner.png",
    );
    expect(assetFolder("assets/icons/banner.png")).toBe("icons");
    expect(assetBasename("assets/icons/banner.png")).toBe("banner.png");
  });

  it.each([
    ["", "empty"],
    ["/banner.png", "absolute"],
    ["C:/banner.png", "absolute"],
    ["icons\\banner.png", "separator"],
    ["icons//banner.png", "segment"],
    ["icons/../banner.png", "segment"],
    ['icons/ban"ner.png', "segment"],
    ["banner.txt", "extension"],
  ] as const)("rejects unsafe relative path %s", (path, code) => {
    expect(validateAssetRelativePath(path)).toBe(code);
  });

  it("detects normalized case-insensitive collisions without colliding with itself", () => {
    const paths = ["assets/icons/Banner.png"];
    expect(validateAssetRelativePath("icons/banner.png", paths)).toBe(
      "collision",
    );
    expect(
      validateAssetRelativePath(
        "icons/Banner.png",
        paths,
        "assets/icons/Banner.png",
      ),
    ).toBeNull();
  });

  it("accepts SVG as a package-relative asset type", () => {
    expect(validateAssetRelativePath("icons/mark.svg")).toBeNull();
  });

  it("finds and atomically rewrites only exact image source fields", () => {
    const files = {
      "jump.jdef": `section
  handle: intro
  name: "Intro"

  image
    handle: hero
    src: "banner.png"
    alt: "Hero"

  text
    handle: note
    content: "banner.png"
`,
      "choices.jdef": `choice
  handle: option
  name: "Option"

  image
    handle: visual
    src: "banner.png"
`,
    };
    expect(assetReferences(files, "banner.png")).toHaveLength(2);
    const renamed = renameAssetReferences(
      files,
      "banner.png",
      "illustrations/hero.png",
    );
    expect(renamed["jump.jdef"]).toContain('src: "illustrations/hero.png"');
    expect(renamed["choices.jdef"]).toContain('src: "illustrations/hero.png"');
    expect(renamed["jump.jdef"]).toContain('content: "banner.png"');
  });

  it("builds folders before basename-only asset leaves", () => {
    expect(
      buildAssetTree([
        "assets/root.png",
        "assets/icons/small/mark.png",
        "assets/icons/banner.png",
      ]),
    ).toEqual([
      {
        kind: "folder",
        name: "icons",
        path: "icons",
        children: [
          {
            kind: "folder",
            name: "small",
            path: "icons/small",
            children: [
              {
                kind: "file",
                archivePath: "assets/icons/small/mark.png",
                name: "mark.png",
              },
            ],
          },
          {
            kind: "file",
            archivePath: "assets/icons/banner.png",
            name: "banner.png",
          },
        ],
      },
      {
        kind: "file",
        archivePath: "assets/root.png",
        name: "root.png",
      },
    ]);
  });
});
