import { availableParallelism } from "node:os";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const requestedWorkers = Number(process.env.VITEST_MAX_WORKERS);
const configuredWorkers =
  Number.isInteger(requestedWorkers) && requestedWorkers > 0
    ? requestedWorkers
    : undefined;

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "nspell",
      "react",
      "react/jsx-dev-runtime",
      "vitest-browser-react",
    ],
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          pool: "threads",
          maxWorkers: configuredWorkers ?? 8,
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "browser",
          maxWorkers: configuredWorkers ?? Math.min(16, availableParallelism()),
          include: ["src/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
