import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  assertAppImageGtkThemeHook,
  patchAppImageGtkThemeHook,
} from "./appimage-theme.mjs";
import {
  childProcessGroupOptions,
  terminateProcessTree,
} from "./verification-process.mjs";
import {
  ensureLinuxReleaseDrivers,
  projectRoot,
} from "./setup-linux-release.mjs";

const targetRoot = join(projectRoot, "target");
const bundleRoot = join(targetRoot, "release", "bundle", "appimage");
const publicationRoot = join(targetRoot, "release-artifacts");
const corepack = process.platform === "win32" ? "corepack.cmd" : "corepack";

export function parseOsRelease(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

export function assertSupportedLinuxBaseline({ platform, architecture, os }) {
  if (platform !== "linux")
    throw new Error("Linux AppImage releases must be built on Linux.");
  if (architecture !== "x64")
    throw new Error(
      `The automated AppImage release supports x86-64; found ${architecture}.`,
    );
  const major = Number.parseInt(os.VERSION_ID ?? "", 10);
  const supported =
    (os.ID === "ubuntu" && major === 22) ||
    (os.ID === "debian" && major === 12);
  if (!supported)
    throw new Error(
      `Use the supported AppImage baseline (Ubuntu 22.04 or Debian 12); found ${os.PRETTY_NAME ?? os.ID ?? "unknown Linux"}.`,
    );
}

export function assertCleanWorktree(status) {
  if (status.trim())
    throw new Error(
      `Release builds require a clean Git worktree. Outstanding paths:\n${status.trim()}`,
    );
}

function safeProductSlug(productName) {
  const slug = productName
    .replaceAll(/[^A-Za-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  if (!slug)
    throw new Error("The product name cannot produce a safe artifact name.");
  return slug;
}

export function releaseFileNames(productName, version) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))
    throw new Error(`Unsupported release version ${version}.`);
  const slug = safeProductSlug(productName);
  return {
    appImage: `${slug}_${version}_linux_x86_64.AppImage`,
    manifest: `${slug}_${version}_linux_x86_64.manifest.json`,
    source: `${slug}_${version}_source.tar.gz`,
    sourcePrefix: `${slug}-${version}/`,
  };
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function renderSha256Sums(entries) {
  return `${[...entries]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, sha256 }) => `${sha256}  ${name}`)
    .join("\n")}\n`;
}

export function linuxBuildPath(pathValue) {
  return pathValue
    .split(delimiter)
    .filter((directory) => directory && !directory.startsWith("/mnt/"))
    .join(delimiter);
}

export function assertX8664Elf(bytes, label) {
  if (
    bytes.length < 20 ||
    bytes[0] !== 0x7f ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0x4c ||
    bytes[3] !== 0x46
  )
    throw new Error(`${label} is not an ELF executable.`);
  if (bytes[4] !== 2 || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 62)
    throw new Error(`${label} is not a little-endian x86-64 ELF executable.`);
}

function walkFiles(root) {
  const paths = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = lstatSync(path);
    if (stat.isDirectory()) paths.push(...walkFiles(path));
    else paths.push(path);
  }
  return paths;
}

function exactlyOne(paths, description) {
  if (paths.length !== 1)
    throw new Error(`Expected one ${description}; found ${paths.length}.`);
  return paths[0];
}

export function verifyExtractedAppImage(extractionRoot, metadata) {
  const files = walkFiles(extractionRoot);
  const binary = join(extractionRoot, "usr", "bin", metadata.binaryName);
  if (!existsSync(binary))
    throw new Error(`AppImage is missing usr/bin/${metadata.binaryName}.`);
  assertX8664Elf(readFileSync(binary).subarray(0, 64), "Bundled application");

  for (const licenseName of ["UNLICENSE", "THIRD_PARTY_NOTICES.txt"]) {
    const bundled = exactlyOne(
      files.filter((path) => path.endsWith(`${sep}${licenseName}`)),
      `bundled ${licenseName}`,
    );
    const source = join(projectRoot, licenseName);
    if (sha256File(bundled) !== sha256File(source))
      throw new Error(`${licenseName} does not match the repository source.`);
  }

  const desktopPath = exactlyOne(
    files.filter(
      (path) =>
        path.endsWith(".desktop") &&
        path.includes(`${sep}usr${sep}share${sep}applications${sep}`),
    ),
    "desktop entry",
  );
  const desktop = readFileSync(desktopPath, "utf8");
  if (!desktop.includes(`Name=${metadata.productName}`))
    throw new Error("The AppImage desktop entry has the wrong product name.");
  if (!desktop.includes(`Exec=${metadata.binaryName}`))
    throw new Error("The AppImage desktop entry has the wrong executable.");

  const icons = files.filter(
    (path) =>
      /\.(?:png|svg|xpm)$/i.test(path) && path.includes(`${sep}icons${sep}`),
  );
  if (!icons.length)
    throw new Error("The AppImage contains no installed application icon.");
  const gtkThemeHook = exactlyOne(
    files.filter((path) =>
      path.endsWith(`${sep}apprun-hooks${sep}linuxdeploy-plugin-gtk.sh`),
    ),
    "GTK AppRun hook",
  );
  assertAppImageGtkThemeHook(readFileSync(gtkThemeHook, "utf8"));
  return { binary, desktopPath, iconCount: icons.length };
}

function run(executable, arguments_, options = {}) {
  const result = spawnSync(executable, arguments_, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.signal)
    throw new Error(`${executable} terminated with ${result.signal}.`);
  if (result.status !== 0)
    throw new Error(
      `${executable} exited with status ${result.status ?? "unknown"}.`,
    );
}

function output(executable, arguments_) {
  return execFileSync(executable, arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
}

function discoverAppImage(version) {
  if (!existsSync(bundleRoot))
    throw new Error("Tauri did not create an AppImage bundle directory.");
  const artifacts = readdirSync(bundleRoot)
    .filter(
      (name) => name.endsWith(".AppImage") && name.includes(`_${version}_`),
    )
    .map((name) => join(bundleRoot, name));
  return exactlyOne(artifacts, `AppImage for version ${version}`);
}

function discoverAppDir(root) {
  const directories = readdirSync(root)
    .filter((name) => {
      const path = join(root, name);
      return name.endsWith(".AppDir") && statSync(path).isDirectory();
    })
    .map((name) => join(root, name));
  return exactlyOne(directories, "Tauri AppDir");
}

export function repackAppImageForRuntimeThemes({
  artifact,
  appDir,
  sourceDateEpoch,
}) {
  const hook = join(appDir, "apprun-hooks", "linuxdeploy-plugin-gtk.sh");
  const patched = patchAppImageGtkThemeHook(readFileSync(hook, "utf8"));
  writeFileSync(hook, patched);

  const cacheRoot = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  const plugin = join(
    cacheRoot,
    "tauri",
    "linuxdeploy-plugin-appimage.AppImage",
  );
  if (!existsSync(plugin))
    throw new Error(`Tauri AppImage packaging plugin not found: ${plugin}`);

  const repacked = join(
    dirname(artifact),
    `.runtime-theme-${Date.now()}.AppImage`,
  );
  try {
    run(plugin, ["--appimage-extract-and-run", `--appdir=${appDir}`], {
      env: {
        ...process.env,
        ARCH: "x86_64",
        LDAI_OUTPUT: repacked,
        ...(sourceDateEpoch ? { SOURCE_DATE_EPOCH: sourceDateEpoch } : {}),
      },
    });
    if (!existsSync(repacked))
      throw new Error("The AppImage repackager produced no output.");
    chmodSync(repacked, 0o755);
    rmSync(artifact, { force: true });
    renameSync(repacked, artifact);
    return artifact;
  } finally {
    rmSync(repacked, { force: true });
  }
}

export function inspectAppImage(artifactPath, metadata) {
  const artifact = resolve(artifactPath);
  if (!existsSync(artifact)) throw new Error(`AppImage not found: ${artifact}`);
  if ((statSync(artifact).mode & 0o111) === 0)
    throw new Error("The AppImage is not executable.");
  assertX8664Elf(readFileSync(artifact).subarray(0, 64), "AppImage");

  mkdirSync(targetRoot, { recursive: true });
  const inspectionDirectory = mkdtempSync(
    join(targetRoot, "appimage-inspection-"),
  );
  try {
    execFileSync(artifact, ["--appimage-extract"], {
      cwd: inspectionDirectory,
      stdio: "ignore",
    });
    const extractionRoot = join(inspectionDirectory, "squashfs-root");
    if (!existsSync(extractionRoot))
      throw new Error("AppImage extraction produced no squashfs-root.");
    const contents = verifyExtractedAppImage(extractionRoot, metadata);
    return { artifact, bytes: statSync(artifact).size, ...contents };
  } finally {
    rmSync(inspectionDirectory, { recursive: true, force: true });
  }
}

async function smokeLaunchAppImage(artifact) {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)
    throw new Error(
      "The AppImage launch smoke requires DISPLAY, WAYLAND_DISPLAY, or a virtual display.",
    );
  const smokeRoot = mkdtempSync(join(targetRoot, "appimage-smoke-"));
  const child = spawn(artifact, [], {
    cwd: projectRoot,
    env: {
      ...process.env,
      APPIMAGE_EXTRACT_AND_RUN: "1",
      XDG_CACHE_HOME: join(smokeRoot, "cache"),
      XDG_CONFIG_HOME: join(smokeRoot, "config"),
      XDG_DATA_HOME: join(smokeRoot, "data"),
    },
    stdio: ["ignore", "ignore", "pipe"],
    ...childProcessGroupOptions(),
  });
  let diagnostics = "";
  child.stderr?.on("data", (chunk) => {
    if (diagnostics.length < 16_384) diagnostics += String(chunk);
  });

  try {
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        child.off("error", onError);
        child.off("exit", onExit);
        resolvePromise();
      }, 8_000);
      const onError = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      const onExit = (code, signal) => {
        clearTimeout(timer);
        reject(
          new Error(
            `AppImage exited during launch smoke (${signal ?? code ?? "unknown"}).${diagnostics ? `\n${diagnostics.trim()}` : ""}`,
          ),
        );
      };
      child.once("error", onError);
      child.once("exit", onExit);
    });
  } finally {
    terminateProcessTree(child);
    await new Promise((resolvePromise) => {
      if (child.exitCode !== null || child.signalCode !== null)
        resolvePromise();
      else child.once("exit", resolvePromise);
      setTimeout(resolvePromise, 3_000);
    });
    if (child.exitCode === null && child.signalCode === null && child.pid)
      process.kill(-child.pid, "SIGKILL");
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}

function loadReleaseMetadata() {
  const tauri = JSON.parse(
    readFileSync(join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const cargoMetadata = JSON.parse(
    output("cargo", ["metadata", "--format-version", "1", "--no-deps"]),
  );
  const application = cargoMetadata.packages.find(
    (item) => item.name === "jumpchain-visualizer",
  );
  if (!application)
    throw new Error("Cargo metadata has no jumpchain-visualizer package.");
  return {
    productName: tauri.productName,
    version: tauri.version,
    identifier: tauri.identifier,
    binaryName: "jumpchain-visualizer",
    publisher: tauri.bundle.publisher,
    repository: application.repository,
  };
}

function publicationManifest(metadata, appImage, source, host, git) {
  const notice = readFileSync(
    join(projectRoot, "THIRD_PARTY_NOTICES.txt"),
    "utf8",
  );
  const fingerprint = notice.match(
    /^Source fingerprint: ([a-f0-9]{64})$/m,
  )?.[1];
  if (!fingerprint)
    throw new Error("Third-party notices contain no source fingerprint.");
  return {
    schemaVersion: 1,
    productName: metadata.productName,
    version: metadata.version,
    identifier: metadata.identifier,
    publisher: metadata.publisher,
    repository: metadata.repository,
    platform: "linux",
    architecture: "x86_64",
    format: "AppImage",
    unsigned: true,
    gitCommit: git.commit,
    sourceDateEpoch: Number(git.epoch),
    builtAt: new Date().toISOString(),
    buildHost: host,
    thirdPartyNoticeFingerprint: fingerprint,
    files: [
      { role: "application", ...appImage },
      { role: "source", ...source },
    ],
    verification: [
      "pnpm check:release",
      "AppImage extraction",
      "AppImage launch smoke",
    ],
  };
}

function stagePublication(metadata, sourceArtifact, host, git) {
  mkdirSync(publicationRoot, { recursive: true });
  const names = releaseFileNames(metadata.productName, metadata.version);
  const temporary = mkdtempSync(join(publicationRoot, ".staging-"));
  const finalDirectory = join(publicationRoot, metadata.version);
  if (!finalDirectory.startsWith(`${publicationRoot}${sep}`))
    throw new Error(
      "Refusing to write outside the release artifact directory.",
    );

  try {
    const appImagePath = join(temporary, names.appImage);
    copyFileSync(sourceArtifact, appImagePath);
    chmodSync(appImagePath, 0o755);
    const sourcePath = join(temporary, names.source);
    run("git", [
      "archive",
      "--format=tar.gz",
      `--prefix=${names.sourcePrefix}`,
      `--output=${sourcePath}`,
      "HEAD",
    ]);

    const appImage = {
      name: names.appImage,
      bytes: statSync(appImagePath).size,
      sha256: sha256File(appImagePath),
    };
    const source = {
      name: names.source,
      bytes: statSync(sourcePath).size,
      sha256: sha256File(sourcePath),
    };
    const manifestPath = join(temporary, names.manifest);
    writeFileSync(
      manifestPath,
      `${JSON.stringify(publicationManifest(metadata, appImage, source, host, git), null, 2)}\n`,
    );
    writeFileSync(
      join(temporary, "SHA256SUMS"),
      renderSha256Sums([
        appImage,
        source,
        { name: names.manifest, sha256: sha256File(manifestPath) },
      ]),
    );

    rmSync(finalDirectory, { recursive: true, force: true });
    renameSync(temporary, finalDirectory);
    return finalDirectory;
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function hostInformation() {
  const os = parseOsRelease(readFileSync("/etc/os-release", "utf8"));
  assertSupportedLinuxBaseline({
    platform: process.platform,
    architecture: process.arch,
    os,
  });
  return {
    distribution: os.PRETTY_NAME,
    glibc: output("getconf", ["GNU_LIBC_VERSION"]),
  };
}

function buildAppImage(version, sourceDateEpoch) {
  run(
    corepack,
    ["pnpm", "tauri", "build", "--bundles", "appimage", "--ci", "--no-sign"],
    {
      env: {
        ...process.env,
        PATH: linuxBuildPath(process.env.PATH ?? ""),
        ...(sourceDateEpoch ? { SOURCE_DATE_EPOCH: sourceDateEpoch } : {}),
      },
    },
  );
  const artifact = discoverAppImage(version);
  return repackAppImageForRuntimeThemes({
    artifact,
    appDir: discoverAppDir(bundleRoot),
    sourceDateEpoch,
  });
}

async function createRelease() {
  const host = hostInformation();
  const metadata = loadReleaseMetadata();
  ensureLinuxReleaseDrivers();
  assertCleanWorktree(
    output("git", ["status", "--porcelain", "--untracked-files=all"]),
  );

  run(corepack, ["pnpm", "check:release"]);
  assertCleanWorktree(
    output("git", ["status", "--porcelain", "--untracked-files=all"]),
  );

  const git = {
    commit: output("git", ["rev-parse", "HEAD"]),
    epoch: output("git", ["show", "-s", "--format=%ct", "HEAD"]),
  };
  const artifact = buildAppImage(metadata.version, git.epoch);
  const inspection = inspectAppImage(artifact, metadata);
  await smokeLaunchAppImage(inspection.artifact);
  const outputDirectory = stagePublication(metadata, artifact, host, git);
  console.log(`Linux release ready: ${relative(projectRoot, outputDirectory)}`);
  console.log(
    readFileSync(join(outputDirectory, "SHA256SUMS"), "utf8").trimEnd(),
  );
}

async function inspectCommand(path) {
  const metadata = loadReleaseMetadata();
  const artifact = path
    ? resolve(projectRoot, path)
    : discoverAppImage(metadata.version);
  const result = inspectAppImage(artifact, metadata);
  await smokeLaunchAppImage(result.artifact);
  console.log(
    `Verified ${relative(projectRoot, result.artifact)} (${result.bytes} bytes, ${result.iconCount} icons).`,
  );
}

function buildCommand() {
  hostInformation();
  buildAppImage(loadReleaseMetadata().version);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, path, ...unexpected] = process.argv.slice(2);
    if (
      unexpected.length ||
      (command && command !== "inspect" && command !== "build") ||
      (command === "build" && path)
    )
      throw new Error(
        "Usage: node scripts/release-linux.mjs [build | inspect [AppImage-path]]",
      );
    if (command === "build") buildCommand();
    else if (command === "inspect") await inspectCommand(path);
    else await createRelease();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
