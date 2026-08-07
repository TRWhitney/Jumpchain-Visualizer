import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertCleanWorktree,
  assertSupportedLinuxBaseline,
  assertX8664Elf,
  parseOsRelease,
  linuxBuildPath,
  releaseFileNames,
  renderSha256Sums,
  verifyExtractedAppImage,
} from "./release-linux.mjs";
import {
  assertAppImageGtkThemeHook,
  patchAppImageGtkThemeHook,
} from "./appimage-theme.mjs";
import { findExecutable } from "./setup-linux-release.mjs";

test("release baseline accepts only supported x86-64 build distributions", () => {
  assert.doesNotThrow(() =>
    assertSupportedLinuxBaseline({
      platform: "linux",
      architecture: "x64",
      os: { ID: "ubuntu", VERSION_ID: "22.04", PRETTY_NAME: "Ubuntu 22.04" },
    }),
  );
  assert.doesNotThrow(() =>
    assertSupportedLinuxBaseline({
      platform: "linux",
      architecture: "x64",
      os: { ID: "debian", VERSION_ID: "12", PRETTY_NAME: "Debian 12" },
    }),
  );
  for (const unsupported of [
    { platform: "darwin", architecture: "x64", os: {} },
    {
      platform: "linux",
      architecture: "arm64",
      os: { ID: "ubuntu", VERSION_ID: "22.04" },
    },
    {
      platform: "linux",
      architecture: "x64",
      os: { ID: "ubuntu", VERSION_ID: "24.04" },
    },
    {
      platform: "linux",
      architecture: "x64",
      os: { ID: "fedora", VERSION_ID: "42" },
    },
  ]) {
    assert.throws(() => assertSupportedLinuxBaseline(unsupported));
  }
});

test("OS release parsing and worktree checks fail closed", () => {
  assert.deepEqual(
    parseOsRelease(
      'ID=ubuntu\nVERSION_ID="22.04"\nPRETTY_NAME="Ubuntu 22.04.5 LTS"\n',
    ),
    {
      ID: "ubuntu",
      VERSION_ID: "22.04",
      PRETTY_NAME: "Ubuntu 22.04.5 LTS",
    },
  );
  assert.doesNotThrow(() => assertCleanWorktree("\n"));
  assert.throws(
    () => assertCleanWorktree(" M package.json\n?? accidental.txt\n"),
    /package\.json[\s\S]*accidental\.txt/,
  );
});

test("release filenames and checksum output are deterministic", () => {
  assert.deepEqual(releaseFileNames("Jumpchain Visualizer", "0.1.0"), {
    appImage: "Jumpchain-Visualizer_0.1.0_linux_x86_64.AppImage",
    manifest: "Jumpchain-Visualizer_0.1.0_linux_x86_64.manifest.json",
    source: "Jumpchain-Visualizer_0.1.0_source.tar.gz",
    sourcePrefix: "Jumpchain-Visualizer-0.1.0/",
  });
  assert.equal(
    renderSha256Sums([
      { name: "z", sha256: "2" },
      { name: "a", sha256: "1" },
    ]),
    "1  a\n2  z\n",
  );
  assert.throws(() => releaseFileNames("../", "not-a-version"));
});

test("AppImage builds exclude inherited Windows paths", () => {
  assert.equal(
    linuxBuildPath(
      [
        "/usr/local/bin",
        "/mnt/c/Windows/System32",
        "/home/test/.cargo/bin",
      ].join(":"),
    ),
    "/usr/local/bin:/home/test/.cargo/bin",
  );
});

test("AppImage GTK hooks permit runtime light and dark theme changes", () => {
  const generated = `#! /usr/bin/env bash

gsettings get org.gnome.desktop.interface gtk-theme 2> /dev/null | grep -qi "dark" && GTK_THEME_VARIANT="dark" || GTK_THEME_VARIANT="light"
APPIMAGE_GTK_THEME="\${APPIMAGE_GTK_THEME:-"Adwaita:$GTK_THEME_VARIANT"}" # Allow user to override theme (discouraged)

export APPDIR="appdir"
export GTK_THEME="$APPIMAGE_GTK_THEME" # Custom themes are broken
export GDK_BACKEND=x11 # Crash with Wayland backend on Wayland - We tested it without it and ended up with this: https://github.com/tauri-apps/tauri/issues/8541
`;
  const patched = patchAppImageGtkThemeHook(generated);
  assert.doesNotThrow(() => assertAppImageGtkThemeHook(patched));
  assert.doesNotMatch(patched, /GTK_THEME=/);
  assert.doesNotMatch(patched, /GDK_BACKEND=x11/);
  assert.throws(
    () => patchAppImageGtkThemeHook(patched),
    /theme preamble has changed/,
  );
  assert.throws(
    () => assertAppImageGtkThemeHook(generated),
    /forces GTK_THEME/,
  );
});

function x8664Elf() {
  const bytes = Buffer.alloc(64);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]);
  bytes.writeUInt16LE(62, 18);
  return bytes;
}

test("AppImage contents require the binary, exact licenses, desktop entry, and icons", () => {
  const root = mkdtempSync(join(tmpdir(), "jumpchain-appimage-fixture-"));
  try {
    const binaryDirectory = join(root, "usr", "bin");
    const resourceDirectory = join(root, "usr", "lib", "Jumpchain Visualizer");
    const applicationDirectory = join(root, "usr", "share", "applications");
    const iconDirectory = join(
      root,
      "usr",
      "share",
      "icons",
      "hicolor",
      "128x128",
      "apps",
    );
    for (const directory of [
      binaryDirectory,
      resourceDirectory,
      applicationDirectory,
      iconDirectory,
    ])
      mkdirSync(directory, { recursive: true });
    const binary = join(binaryDirectory, "jumpchain-visualizer");
    writeFileSync(binary, x8664Elf());
    chmodSync(binary, 0o755);
    copyFileSync("UNLICENSE.md", join(resourceDirectory, "UNLICENSE.md"));
    copyFileSync(
      "THIRD_PARTY_NOTICES.txt",
      join(resourceDirectory, "THIRD_PARTY_NOTICES.txt"),
    );
    writeFileSync(
      join(applicationDirectory, "jumpchain-visualizer.desktop"),
      "[Desktop Entry]\nName=Jumpchain Visualizer\nExec=jumpchain-visualizer\n",
    );
    symlinkSync(
      "usr/share/applications/jumpchain-visualizer.desktop",
      join(root, "jumpchain-visualizer.desktop"),
    );
    writeFileSync(join(iconDirectory, "jumpchain-visualizer.png"), "icon");
    const hookDirectory = join(root, "apprun-hooks");
    mkdirSync(hookDirectory, { recursive: true });
    writeFileSync(
      join(hookDirectory, "linuxdeploy-plugin-gtk.sh"),
      "export GTK_DATA_PREFIX=appdir\n",
    );

    const result = verifyExtractedAppImage(root, {
      binaryName: "jumpchain-visualizer",
      productName: "Jumpchain Visualizer",
    });
    assert.equal(result.iconCount, 1);
    writeFileSync(join(resourceDirectory, "UNLICENSE.md"), "wrong");
    assert.throws(
      () =>
        verifyExtractedAppImage(root, {
          binaryName: "jumpchain-visualizer",
          productName: "Jumpchain Visualizer",
        }),
      /UNLICENSE\.md does not match/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ELF and executable discovery reject malformed inputs", () => {
  assert.doesNotThrow(() => assertX8664Elf(x8664Elf(), "fixture"));
  assert.throws(
    () => assertX8664Elf(Buffer.alloc(64), "fixture"),
    /not an ELF/,
  );

  const root = mkdtempSync(join(tmpdir(), "jumpchain-path-fixture-"));
  try {
    const executable = join(root, "tool");
    writeFileSync(executable, "tool");
    chmodSync(executable, 0o755);
    assert.equal(findExecutable("tool", root), executable);
    chmodSync(executable, 0o644);
    assert.equal(findExecutable("tool", root), undefined);
    assert.equal(findExecutable("missing", root), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
