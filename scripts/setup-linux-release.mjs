import { execFileSync } from "node:child_process";
import {
  chmodSync,
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
export const projectRoot = resolve(dirname(scriptPath), "..");
export const localWebKitDriver = join(
  projectRoot,
  "target",
  "release-tools",
  "webkit2gtk-driver",
  "usr",
  "bin",
  "WebKitWebDriver",
);

export function findExecutable(name, pathValue = process.env.PATH ?? "") {
  const names = process.platform === "win32" ? [name, `${name}.exe`] : [name];
  for (const directory of pathValue.split(delimiter)) {
    for (const candidate of names) {
      const path = join(directory, candidate);
      try {
        accessSync(path, constants.X_OK);
        return path;
      } catch {
        // Keep searching for an executable candidate.
      }
    }
  }
  return undefined;
}

function run(executable, arguments_, { quiet = false, ...options } = {}) {
  return execFileSync(executable, arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "inherit"] : "inherit",
    ...options,
  });
}

function installTauriDriver(quiet) {
  run("cargo", ["install", "tauri-driver", "--version", "2.0.6", "--locked"], {
    quiet,
  });
  const path = findExecutable("tauri-driver");
  if (!path)
    throw new Error(
      "tauri-driver installation completed but it is not on PATH.",
    );
  return path;
}

function installLocalWebKitDriver(quiet) {
  for (const command of ["apt-get", "dpkg-deb"]) {
    if (!findExecutable(command))
      throw new Error(
        `${command} is required to install WebKitWebDriver without root privileges.`,
      );
  }

  const downloadDirectory = mkdtempSync(
    join(tmpdir(), "jumpchain-webkit-driver-"),
  );
  try {
    run("apt-get", ["download", "webkit2gtk-driver"], {
      cwd: downloadDirectory,
      quiet,
    });
    const packages = readdirSync(downloadDirectory).filter((name) =>
      /^webkit2gtk-driver_.*\.deb$/.test(name),
    );
    if (packages.length !== 1)
      throw new Error(
        `Expected one downloaded webkit2gtk-driver package; found ${packages.length}.`,
      );
    const extractionRoot = resolve(dirname(localWebKitDriver), "../..");
    mkdirSync(extractionRoot, { recursive: true });
    run(
      "dpkg-deb",
      ["--extract", join(downloadDirectory, packages[0]), extractionRoot],
      { quiet },
    );
    if (!existsSync(localWebKitDriver))
      throw new Error(
        "The downloaded package did not contain WebKitWebDriver.",
      );
    chmodSync(localWebKitDriver, 0o755);
    return localWebKitDriver;
  } finally {
    rmSync(downloadDirectory, { recursive: true, force: true });
  }
}

export function ensureLinuxReleaseDrivers({ quiet = false } = {}) {
  if (process.platform !== "linux") return {};
  const tauriDriver =
    findExecutable("tauri-driver") ?? installTauriDriver(quiet);
  const webKitDriver =
    findExecutable("WebKitWebDriver") ??
    (existsSync(localWebKitDriver)
      ? localWebKitDriver
      : installLocalWebKitDriver(quiet));

  if (!quiet) {
    console.log(`tauri-driver: ${tauriDriver}`);
    console.log(`WebKitWebDriver: ${webKitDriver}`);
  }
  return { tauriDriver, webKitDriver };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    ensureLinuxReleaseDrivers({ quiet: process.argv.includes("--quiet") });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
