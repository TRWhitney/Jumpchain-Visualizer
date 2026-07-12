import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "corepack pnpm build && corepack pnpm preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
