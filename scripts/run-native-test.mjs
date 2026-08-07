import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import {
  linuxBuildPath,
  repackAppImageForRuntimeThemes,
} from "./release-linux.mjs";
import {
  ensureLinuxReleaseDrivers,
  projectRoot,
} from "./setup-linux-release.mjs";

const corepack = process.platform === "win32" ? "corepack.cmd" : "corepack";
const targetRoot = join(projectRoot, "target");

function run(arguments_, environment = process.env) {
  const result = spawnSync(corepack, ["pnpm", ...arguments_], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.signal)
    throw new Error(`corepack terminated with ${result.signal}.`);
  if (result.status !== 0)
    throw new Error(
      `corepack exited with status ${result.status ?? "unknown"}.`,
    );
}

function waitForDriver(child, port, timeoutMilliseconds = 10_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    let retryTimer;
    const cleanup = () => {
      clearTimeout(retryTimer);
      child.off("error", fail);
      child.off("exit", exited);
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    const exited = (code, signal) =>
      fail(
        new Error(
          `tauri-driver exited before startup (${signal ?? code ?? "unknown"}).`,
        ),
      );
    const tryConnection = () => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        cleanup();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMilliseconds) {
          fail(new Error(`tauri-driver did not listen on port ${port}`));
          return;
        }
        retryTimer = setTimeout(tryConnection, 100);
      });
    };
    child.once("error", fail);
    child.once("exit", exited);
    tryConnection();
  });
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
  });
}

function exactlyOne(paths, description) {
  if (paths.length !== 1)
    throw new Error(`Expected one ${description}; found ${paths.length}.`);
  return paths[0];
}

function nativeTestAppImage() {
  const bundleRoot = join(targetRoot, "release", "bundle", "appimage");
  const names = readdirSync(bundleRoot);
  const artifact = exactlyOne(
    names
      .filter((name) => name.endsWith(".AppImage"))
      .map((name) => join(bundleRoot, name)),
    "native-test AppImage",
  );
  const appDir = exactlyOne(
    names
      .filter((name) => name.endsWith(".AppDir"))
      .map((name) => join(bundleRoot, name)),
    "native-test AppDir",
  );
  return repackAppImageForRuntimeThemes({ artifact, appDir });
}

let appBinaryPath = process.env.TAURI_APP_BINARY_PATH;
if (!process.env.E2E_NATIVE_SKIP_BUILD) {
  if (process.platform === "linux") {
    run(
      [
        "tauri",
        "build",
        "--bundles",
        "appimage",
        "--features",
        "native-test",
        "--ci",
        "--no-sign",
      ],
      {
        ...process.env,
        PATH: linuxBuildPath(process.env.PATH ?? ""),
      },
    );
    appBinaryPath = nativeTestAppImage();
  } else {
    run(["tauri", "build", "--debug", "--no-bundle"]);
    appBinaryPath = join(
      targetRoot,
      "debug",
      `jumpchain-visualizer${process.platform === "win32" ? ".exe" : ""}`,
    );
  }
}
if (!appBinaryPath)
  throw new Error(
    "TAURI_APP_BINARY_PATH is required when E2E_NATIVE_SKIP_BUILD is set.",
  );

mkdirSync(targetRoot, { recursive: true });
const nativeDataRoot = mkdtempSync(join(targetRoot, "native-test-data-"));
const nativeEnvironment = {
  ...process.env,
  APPIMAGE_EXTRACT_AND_RUN: "1",
  TAURI_APP_BINARY_PATH: appBinaryPath,
  XDG_CACHE_HOME: join(nativeDataRoot, "cache"),
  XDG_CONFIG_HOME: join(nativeDataRoot, "config"),
  XDG_DATA_HOME: join(nativeDataRoot, "data"),
};

const drivers = ensureLinuxReleaseDrivers({ quiet: true });
try {
  if (process.platform !== "linux") {
    run(["exec", "wdio", "run", "wdio.conf.ts"], nativeEnvironment);
  } else {
    const driver = spawn(
      drivers.tauriDriver,
      ["--port", "4444", "--native-driver", drivers.webKitDriver],
      {
        cwd: projectRoot,
        env: nativeEnvironment,
        stdio: "inherit",
      },
    );
    try {
      await waitForDriver(driver, 4444);
      run(["exec", "wdio", "run", "wdio.conf.ts"], nativeEnvironment);
    } finally {
      await stopProcess(driver);
    }
  }
} finally {
  rmSync(nativeDataRoot, { recursive: true, force: true });
}
