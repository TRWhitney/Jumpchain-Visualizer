import { describe, expect, it, vi } from "vitest";

describe("React development performance initialization", () => {
  it("hides Performance Tracks while React initializes and restores the console", async () => {
    const originalTimeStamp = console.timeStamp;
    vi.resetModules();
    const initialization = await import("./reactDevelopmentPerformance");

    try {
      if (import.meta.env.DEV) expect(console.timeStamp).toBeUndefined();
    } finally {
      initialization.restoreDevelopmentConsoleTimeStamp();
    }

    expect(console.timeStamp).toBe(originalTimeStamp);
  });
});
