import type {} from "@wdio/types";

const executableSuffix = process.platform === "win32" ? ".exe" : "";

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./e2e/native/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
    },
  ],
  logLevel: "warn",
  framework: "mocha",
  reporters: ["spec"],
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: `./target/debug/jumpchain-visualizer${executableSuffix}`,
        driverProvider: "embedded",
      },
    ],
  ],
  mochaOpts: {
    timeout: 60_000,
  },
};
