import { defineConfig, devices } from "@playwright/test";

const exhaustive = process.env.E2E_EXHAUSTIVE === "1";
const chromiumOnly = /@chromium-only/;
const webServerCommand =
  process.env.E2E_SKIP_BUILD === "1"
    ? "corepack pnpm preview"
    : "VITE_E2E_LOCALES=1 corepack pnpm build && corepack pnpm preview";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: true,
  retries: process.env.CI ? 1 : 0,
  reportSlowTests: { max: 10, threshold: 10_000 },
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      grep: exhaustive ? undefined : /@cross-browser/,
      grepInvert: chromiumOnly,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      grep: exhaustive ? undefined : /@cross-browser/,
      grepInvert: chromiumOnly,
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
