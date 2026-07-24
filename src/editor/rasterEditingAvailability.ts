import { isAnimatedPng } from "./assetEditorModel";

export function rasterEditingAvailability(format: string, bytes: Uint8Array) {
  if (format === "png" && isAnimatedPng(bytes))
    return "Animated PNG is preserved read-only to avoid flattening animation.";
  if (format === "png" || format === "jpg") return null;
  return `${format.toLocaleUpperCase()} editing is not available yet. The validated local copy remains unchanged.`;
}
