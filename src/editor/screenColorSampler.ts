import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/runtime";

export type ScreenColorSample =
  | { status: "selected"; color: string }
  | { status: "cancelled" }
  | { status: "unavailable" };

export interface ScreenColorSampler {
  isAvailable(): Promise<boolean>;
  sample(): Promise<ScreenColorSample>;
}

type BrowserEyeDropper = {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
};

type BrowserEyeDropperConstructor = new () => BrowserEyeDropper;

function eyeDropperConstructor() {
  return (
    window as typeof window & {
      EyeDropper?: BrowserEyeDropperConstructor;
    }
  ).EyeDropper;
}

export const platformScreenColorSampler: ScreenColorSampler = {
  async isAvailable() {
    if (eyeDropperConstructor()) return true;
    if (!isTauriRuntime()) return false;
    try {
      return await invoke<boolean>("screen_color_sampler_available");
    } catch {
      return false;
    }
  },

  async sample() {
    const EyeDropper = eyeDropperConstructor();
    if (EyeDropper) {
      try {
        const result = await new EyeDropper().open();
        return { status: "selected", color: result.sRGBHex } as const;
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError"
          ? ({ status: "cancelled" } as const)
          : ({ status: "unavailable" } as const);
      }
    }
    if (!isTauriRuntime()) return { status: "unavailable" };
    try {
      const color = await invoke<string | null>("sample_screen_color");
      return color
        ? ({ status: "selected", color } as const)
        : ({ status: "cancelled" } as const);
    } catch {
      return { status: "unavailable" };
    }
  },
};
