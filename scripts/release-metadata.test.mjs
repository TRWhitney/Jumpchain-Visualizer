import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const expected = Object.freeze({
  author: "Whitney White",
  description:
    "Offline-first desktop editor and tracker for Jumpchain packages and chains.",
  homepage: "https://github.com/TRWhitney/Jumpchain-Visualizer",
  identifier: "dev.jumpchainvisualizer.desktop",
  license: "Unlicense",
  repository: "https://github.com/TRWhitney/Jumpchain-Visualizer.git",
  version: "0.1.0",
});

test("Node, Cargo, and Tauri release metadata remain aligned", () => {
  const nodePackage = JSON.parse(readFileSync("package.json", "utf8"));
  const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const indexHtml = readFileSync("index.html", "utf8");
  const linuxTauri = JSON.parse(
    readFileSync("src-tauri/tauri.linux.conf.json", "utf8"),
  );
  const defaultCapability = JSON.parse(
    readFileSync("src-tauri/capabilities/default.json", "utf8"),
  );
  const cargo = JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], {
      encoding: "utf8",
    }),
  );
  const rustToolchain = readFileSync("rust-toolchain.toml", "utf8");

  assert.equal(nodePackage.version, expected.version);
  assert.equal(nodePackage.license, expected.license);
  assert.equal(nodePackage.author, expected.author);
  assert.equal(nodePackage.description, expected.description);
  assert.equal(nodePackage.homepage, expected.homepage);
  assert.equal(nodePackage.repository.url, expected.repository);

  assert.equal(tauri.version, expected.version);
  assert.equal(tauri.identifier, expected.identifier);
  assert.equal(tauri.bundle.license, expected.license);
  assert.equal(tauri.bundle.publisher, expected.author);
  assert.equal(tauri.bundle.homepage, expected.homepage);
  assert.equal(tauri.bundle.licenseFile, "../UNLICENSE.md");
  assert.match(tauri.app.security.csp, /(?:^|;)\s*style-src 'self'(?:;|$)/);
  assert.doesNotMatch(tauri.app.security.csp, /'unsafe-inline'/);
  assert.match(indexHtml, /<style id="tauri-csp-style-nonce">/);
  assert.ok(
    defaultCapability.permissions.includes("core:window:allow-set-theme"),
  );
  assert.deepEqual(tauri.bundle.icon, [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico",
  ]);
  assert.deepEqual(tauri.bundle.resources, {
    "../UNLICENSE.md": "UNLICENSE.md",
    "../THIRD_PARTY_NOTICES.txt": "THIRD_PARTY_NOTICES.txt",
  });
  assert.equal(linuxTauri.bundle.targets, "appimage");
  assert.match(rustToolchain, /^channel = "1\.97\.0"$/m);
  assert.match(rustToolchain, /^components = \["clippy", "rustfmt"\]$/m);

  assert.equal(cargo.packages.length, 3);
  for (const packageMetadata of cargo.packages) {
    assert.equal(packageMetadata.version, expected.version);
    assert.equal(packageMetadata.license, expected.license);
    assert.deepEqual(packageMetadata.authors, [expected.author]);
    assert.equal(packageMetadata.homepage, expected.homepage);
    assert.equal(packageMetadata.repository, expected.repository);
    assert.ok(packageMetadata.description);
  }

  const nativeSource = readFileSync("src-tauri/src/lib.rs", "utf8");
  assert.match(
    nativeSource,
    /#\[cfg\(any\(debug_assertions, feature = "native-test"\)\)\]\s+let builder = builder\.plugin\(tauri_plugin_wdio_webdriver::init\(\)\);/,
  );
});
