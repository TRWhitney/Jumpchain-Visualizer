import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./runtime";

export type NativeTheme = "light" | "dark";

export interface NativeThemeBridge {
  isAvailable(): boolean;
  setTheme(theme: NativeTheme): Promise<void>;
}

export const platformNativeThemeBridge: NativeThemeBridge = {
  isAvailable: isTauriRuntime,
  async setTheme(theme) {
    await getCurrentWindow().setTheme(theme);
  },
};
