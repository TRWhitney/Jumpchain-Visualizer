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
  preview?: Blob;
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
  onPreview,
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
  onPreview?: (
    path: string,
    preview: Blob | null,
    sourceBytes: Uint8Array,
  ) => void;
  onStatus?: (status: string, invalid: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [status, setStatus] = useState(() =>
    translate("ui.editorWorkspace.asset.editor.ready"),
  );
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
  const publishPreview = useCallback(
    (preview: Blob | null, sourceBytes: Uint8Array) =>
      onPreview?.(path, preview, sourceBytes),
    [onPreview, path],
  );
  const validateAndCommit = async (
    nextBytes: Uint8Array,
    nextDocument: AssetEditorDocument | null,
    historyLabel: string,
    preview?: Blob,
  ) => {
    const generation = ++validationGeneration.current;
    if (nextDocument?.kind === "svg") {
      onCommit({
        path,
        bytes,
        document: nextDocument,
        historyLabel,
      });
      return;
    }
    if (nextDocument?.kind === "raster") {
      // RasterSourceEditor only supplies output produced by the internal
      // full-resolution renderer. Revalidating that generated PNG on the UI
      // thread would repeat its byte-wide CRC pass during every correction.
      onCommit({
        path,
        bytes: nextBytes,
        document: nextDocument,
        historyLabel,
        preview,
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
    } catch {
      if (generation !== validationGeneration.current) return;
      const message = translate(
        "ui.editorWorkspace.asset.editor.renderValidationFailed",
      );
      reportStatus(
        translate("ui.editorWorkspace.asset.editor.validImageRetained", {
          message,
        }),
        true,
      );
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
          <h2>
            {readOnly
              ? translate("ui.editorWorkspace.asset.editor.readOnlyLocalCopy")
              : translate("ui.editorWorkspace.asset.editor.comingLater")}
          </h2>
          <p>
            {readOnly
              ? translate("ui.editorWorkspace.asset.editor.restoreBeforeEdit")
              : unavailable}
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
          onCommit={(nextBytes, nextDocument, historyLabel, preview) =>
            void validateAndCommit(
              nextBytes,
              nextDocument,
              historyLabel,
              preview,
            )
          }
          onPreview={publishPreview}
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
              ? translate("ui.editorWorkspace.asset.editor.secureSvgSource")
              : canonicalType === "png" || canonicalType === "jpg"
                ? translate("ui.editorWorkspace.asset.editor.rasterCorrections")
                : translate("ui.editorWorkspace.asset.editor.validatedAsset")}
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
