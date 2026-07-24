import { useCallback, useEffect, useRef, useState } from "react";
import { validatePackageAsset } from "../archive";
import type { KeybindingAction, KeybindingChord } from "../settings/model";
import { translate } from "../localization";
import {
  type AssetEditorDocument,
  type RasterAssetEditorDocument,
  type SvgAssetEditorDocument,
} from "./assetEditorModel";
import { RasterSourceEditor } from "./RasterSourceEditor";
import { rasterEditingAvailability } from "./rasterEditingAvailability";
import { SvgSourceEditor } from "./SvgSourceEditor";

export type AssetSourceCommit = {
  path: string;
  bytes: Uint8Array;
  document: AssetEditorDocument | null;
  historyLabel: string;
};

export function AssetSourceWorkspace({
  path,
  canonicalType,
  width,
  height,
  bytes,
  document,
  readOnly,
  keybindings,
  onCommit,
  onStatus,
  onFocusChange,
  onUndo,
  onRedo,
}: {
  path: string;
  canonicalType: "png" | "jpg" | "gif" | "webp" | "avif" | "svg";
  width: number;
  height: number;
  bytes: Uint8Array;
  document?: AssetEditorDocument;
  readOnly: boolean;
  keybindings: Record<KeybindingAction, KeybindingChord>;
  onCommit: (commit: AssetSourceCommit) => void;
  onStatus?: (status: string, invalid: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [status, setStatus] = useState("Local editor ready");
  const [invalid, setInvalid] = useState(false);
  const validationGeneration = useRef(0);
  useEffect(() => {
    validationGeneration.current += 1;
  }, [path]);
  const reportStatus = useCallback(
    (message: string, nextInvalid: boolean) => {
      setStatus(message);
      setInvalid(nextInvalid);
      onStatus?.(message, nextInvalid);
    },
    [onStatus],
  );
  const validateAndCommit = async (
    nextBytes: Uint8Array,
    nextDocument: AssetEditorDocument | null,
    historyLabel: string,
  ) => {
    const generation = ++validationGeneration.current;
    if (
      nextDocument?.kind === "svg" ||
      (nextDocument?.kind === "raster" && nextDocument.validationError)
    ) {
      onCommit({
        path,
        bytes,
        document: nextDocument,
        historyLabel,
      });
      return;
    }
    try {
      await validatePackageAsset(path, nextBytes);
      if (generation !== validationGeneration.current) return;
      onCommit({
        path,
        bytes: nextBytes,
        document: nextDocument,
        historyLabel,
      });
    } catch (error) {
      if (generation !== validationGeneration.current) return;
      const message =
        error instanceof Error
          ? error.message
          : "Rendered bytes failed package validation.";
      reportStatus(`${message} Previous valid image retained.`, true);
      if (nextDocument?.kind === "raster")
        onCommit({
          path,
          bytes,
          document: { ...nextDocument, validationError: message },
          historyLabel: `Keep failed ${historyLabel.toLocaleLowerCase()}`,
        });
    }
  };

  let editor;
  if (canonicalType === "svg")
    editor = (
      <SvgSourceEditor
        path={path}
        bytes={bytes}
        document={
          document?.kind === "svg"
            ? (document as SvgAssetEditorDocument)
            : undefined
        }
        readOnly={readOnly}
        onCommit={(nextBytes, nextDocument, historyLabel) =>
          void validateAndCommit(nextBytes, nextDocument, historyLabel)
        }
        onStatus={reportStatus}
        onFocusChange={(focused) => onFocusChange?.(focused)}
        onUndo={onUndo}
        onRedo={onRedo}
        findKeybinding={keybindings.find}
      />
    );
  else {
    const unavailable = rasterEditingAvailability(canonicalType, bytes);
    editor =
      unavailable || readOnly ? (
        <div className="asset-editor-unavailable">
          <span aria-hidden="true">◇</span>
          <h2>{readOnly ? "Read-only local copy" : "Editor coming later"}</h2>
          <p>
            {readOnly ? "Restore this asset before editing it." : unavailable}
          </p>
        </div>
      ) : (
        <RasterSourceEditor
          path={path}
          bytes={bytes}
          format={canonicalType as "png" | "jpg"}
          width={width}
          height={height}
          document={
            document?.kind === "raster"
              ? (document as RasterAssetEditorDocument)
              : undefined
          }
          readOnly={readOnly}
          keybindings={keybindings}
          onCommit={(nextBytes, nextDocument, historyLabel) =>
            void validateAndCommit(nextBytes, nextDocument, historyLabel)
          }
          onStatus={reportStatus}
          onFocusChange={(focused) => onFocusChange?.(focused)}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      );
  }

  return (
    <div className="asset-source-workspace">
      <header className="asset-source-workspace-header">
        <span>
          <strong>{path.replace(/^assets\//, "")}</strong>
          <small>
            {canonicalType === "svg"
              ? "Secure SVG source"
              : canonicalType === "png" || canonicalType === "jpg"
                ? "Non-destructive corrections & markup"
                : "Validated asset"}
          </small>
        </span>
        <span
          className="asset-local-copy-badge"
          title={translate("ui.editorWorkspace.asset.editor.localCopyTitle")}
        >
          {translate("ui.editorWorkspace.asset.editor.localCopy")}
        </span>
      </header>
      <div className="asset-source-workspace-content">{editor}</div>
      <footer
        className={`asset-source-workspace-status${invalid ? " is-invalid" : ""}`}
        aria-live="polite"
      >
        <span>{status}</span>
        <span>
          {width} × {height} · {canonicalType.toLocaleUpperCase()}
        </span>
      </footer>
    </div>
  );
}
