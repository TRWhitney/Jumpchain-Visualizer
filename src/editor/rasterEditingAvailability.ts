import { isAnimatedPng } from "./assetEditorModel";
import { translate } from "../localization";

export function rasterEditingAvailability(format: string, bytes: Uint8Array) {
  if (format === "png" && isAnimatedPng(bytes))
    return translate("ui.editorWorkspace.asset.editor.animatedPngReadOnly");
  if (format === "png" || format === "jpg") return null;
  return translate("ui.editorWorkspace.asset.editor.formatUnavailable", {
    format: format.toLocaleUpperCase(),
  });
}
