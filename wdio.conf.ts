import type {} from "@wdio/types";

const executableSuffix = process.platform === "win32" ? ".exe" : "";
const linuxExternalDriver = process.platform === "linux";
const appBinaryPath =
  process.env.TAURI_APP_BINARY_PATH ??
  `./target/debug/jumpchain-visualizer${executableSuffix}`;

const capabilities = linuxExternalDriver
  ? [
      {
        "tauri:options": {
          application: appBinaryPath,
        },
      },
    ]
  : [
      {
        browserName: "tauri",
      },
    ];

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./e2e/native/**/*.e2e.ts"],
  maxInstances: 1,
  hostname: linuxExternalDriver ? "127.0.0.1" : undefined,
  port: linuxExternalDriver ? 4444 : undefined,
  capabilities: capabilities as WebdriverIO.Config["capabilities"],
  logLevel: "warn",
  framework: "mocha",
  reporters: ["spec"],
  services: linuxExternalDriver
    ? []
    : [
        [
          "@wdio/tauri-service",
          {
            appBinaryPath,
            driverProvider: "embedded",
          },
        ],
      ],
  mochaOpts: {
    timeout: 60_000,
  },
};
