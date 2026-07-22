import { afterEach, expect, test } from "vitest";
import { platformScreenColorSampler } from "./screenColorSampler";

type TestWindow = typeof window & {
  EyeDropper?: new () => {
    open(): Promise<{ sRGBHex: string }>;
  };
};

const originalEyeDropper = (window as TestWindow).EyeDropper;

afterEach(() => {
  Object.defineProperty(window, "EyeDropper", {
    configurable: true,
    value: originalEyeDropper,
  });
});

test("the browser screen sampler returns the explicitly selected pixel", async () => {
  Object.defineProperty(window, "EyeDropper", {
    configurable: true,
    value: class {
      async open() {
        return { sRGBHex: "#1a2b3c" };
      }
    },
  });

  await expect(platformScreenColorSampler.isAvailable()).resolves.toBe(true);
  await expect(platformScreenColorSampler.sample()).resolves.toEqual({
    status: "selected",
    color: "#1a2b3c",
  });
});

test("the browser screen sampler treats an escaped selection as cancellation", async () => {
  Object.defineProperty(window, "EyeDropper", {
    configurable: true,
    value: class {
      async open(): Promise<{ sRGBHex: string }> {
        throw new DOMException("cancelled", "AbortError");
      }
    },
  });

  await expect(platformScreenColorSampler.sample()).resolves.toEqual({
    status: "cancelled",
  });
});

test("the browser screen sampler reports an unavailable API without opening anything", async () => {
  Object.defineProperty(window, "EyeDropper", {
    configurable: true,
    value: undefined,
  });

  await expect(platformScreenColorSampler.isAvailable()).resolves.toBe(false);
  await expect(platformScreenColorSampler.sample()).resolves.toEqual({
    status: "unavailable",
  });
});
