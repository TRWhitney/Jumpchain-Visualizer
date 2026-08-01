import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";

const exhaustive = process.env.E2E_EXHAUSTIVE === "1";
const crossBrowser = process.env.E2E_CROSS_BROWSER === "1";
const fullChromium = process.env.E2E_FULL_CHROMIUM === "1";
const chromiumOnly = /@chromium-only/;
const welcomeTourStateSetup = /welcome-tour-state\.setup\.ts/;
const workers = process.env.CI
  ? 3
  : Math.min(
      exhaustive ? 3 : crossBrowser ? 8 : fullChromium ? 9 : 12,
      availableParallelism(),
    );
const webServerCommand =
  process.env.E2E_SKIP_BUILD === "1"
    ? "corepack pnpm preview"
    : "VITE_E2E_LOCALES=1 corepack pnpm build && corepack pnpm preview";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  workers,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: true,
  retries: 0,
  reportSlowTests: { max: 10, threshold: 10_000 },
  reporter: [
    ["dot"],
    ["./scripts/playwright-performance-reporter.mjs"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: welcomeTourStateSetup },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: welcomeTourStateSetup,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      dependencies: ["setup"],
      grep: /@cross-browser/,
      grepInvert: chromiumOnly,
      testIgnore: welcomeTourStateSetup,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      dependencies: ["setup"],
      grep: /@cross-browser/,
      grepInvert: chromiumOnly,
      testIgnore: welcomeTourStateSetup,
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
