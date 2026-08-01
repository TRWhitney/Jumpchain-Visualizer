import { useEffect, useRef, useState } from "react";
import { translate } from "../localization";
import { useAssetObjectUrl } from "../ui/useAssetObjectUrls";
import {
  assetBasename,
  assetFolder,
  assetRelativePath,
  validateAssetRelativePath,
  type AssetPathValidationCode,
} from "./assetPaths";
import { AssetImage } from "./EditorExplorer";
import type { EditorTrashEntry } from "./model";

export function AssetStructuredPanel({
  path,
  allPaths,
  referenceCount,
  onRename,
}: {
  path: string;
  allPaths: readonly string[];
  referenceCount: number;
  onRename: (
    currentPath: string,
    nextRelativePath: string,
  ) => Promise<AssetPathValidationCode | "signature" | null>;
}) {
  const [filename, setFilename] = useState(() => assetBasename(path));
  const [folder, setFolder] = useState(() => assetFolder(path));
  const [error, setError] = useState<
    AssetPathValidationCode | "signature" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const onRenameRef = useRef(onRename);
  useEffect(() => {
    onRenameRef.current = onRename;
  }, [onRename]);
  useEffect(() => {
    const currentFilename = assetBasename(path);
    const currentFolder = assetFolder(path);
    if (filename === currentFilename && folder === currentFolder) return;
    let active = true;
    const nextRelativePath = folder ? `${folder}/${filename}` : filename;
    const timer = window.setTimeout(() => {
      const validation = validateAssetRelativePath(
        nextRelativePath,
        allPaths,
        path,
      );
      if (validation) {
        setError(validation);
        return;
      }
      setSaving(true);
      void onRenameRef.current(path, nextRelativePath).then((nextError) => {
        if (!active) return;
        setSaving(false);
        setError(nextError);
      });
    }, 550);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [allPaths, filename, folder, path]);
  const errorId = error ? "editor-asset-path-error" : undefined;
  return (
    <div className="editor-structured-scroll editor-asset-structured">
      <header className="editor-structured-heading">
        <p>{translate("ui.editorWorkspace.asset.assetFile")}</p>
        <h2>{assetBasename(path)}</h2>
        <code>{assetRelativePath(path)}</code>
      </header>
      <form
        className="editor-form-card editor-asset-form"
        aria-busy={saving || undefined}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <h3>{translate("ui.editorWorkspace.asset.manageAsset")}</h3>
        <label className="editor-field-occurrence">
          <span>{translate("ui.editorWorkspace.asset.filename")}</span>
          <input
            required
            type="text"
            value={filename}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            onChange={(event) => {
              setFilename(event.target.value);
              setError(null);
            }}
          />
        </label>
        <label className="editor-field-occurrence">
          <span>{translate("ui.editorWorkspace.asset.folder")}</span>
          <input
            type="text"
            value={folder}
            placeholder={translate("ui.editorWorkspace.asset.rootFolder")}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            onChange={(event) => {
              setFolder(event.target.value);
              setError(null);
            }}
          />
        </label>
        {error && (
          <p className="editor-asset-path-error" id={errorId} role="alert">
            {translate(`ui.editorWorkspace.asset.pathError.${error}`)}
          </p>
        )}
        <p className="editor-asset-reference-count">
          {translate("ui.editorWorkspace.asset.referenceCount", {
            count: referenceCount,
          })}
        </p>
      </form>
    </div>
  );
}

export function TrashSourcePanel({ entry }: { entry: EditorTrashEntry }) {
  if (entry.kind === "asset")
    return (
      <AssetBinarySourcePanel path={entry.originalPath} bytes={entry.bytes} />
    );
  return (
    <div className="editor-source-panel editor-trash-source-panel">
      <div className="editor-source-toolbar">
        <span>
          <strong>{entry.label}</strong>
          <small>
            {translate("ui.editorWorkspace.trash.originalFile", {
              file: entry.originalFile,
            })}
          </small>
        </span>
      </div>
      <pre aria-label={translate("ui.editorWorkspace.ariaLabel.deletedSource")}>
        <code>{entry.source}</code>
      </pre>
      <div className="editor-source-status is-recovered">
        <span>{translate("ui.editorWorkspace.trash.readOnly")}</span>
      </div>
    </div>
  );
}

function AssetBinarySourcePanel({
  path,
  bytes,
}: {
  path: string;
  bytes: Uint8Array;
}) {
  return (
    <div className="editor-source-panel editor-asset-source-panel">
      <div className="editor-source-toolbar">
        <span>
          <strong>{assetRelativePath(path)}</strong>
          <small>{translate("ui.editorWorkspace.asset.binaryFile")}</small>
        </span>
      </div>
      <div className="editor-asset-image-stage">
        <AssetBinaryImage path={path} bytes={bytes} />
      </div>
      <div className="editor-source-status is-valid">
        <span>{translate("ui.editorWorkspace.asset.readOnlyBinary")}</span>
      </div>
    </div>
  );
}

export function AssetContextPreview({
  path,
  source,
}: {
  path: string;
  source?: string;
}) {
  return (
    <div className="editor-preview-panel editor-asset-preview-panel">
      <div className="editor-preview-toolbar">
        <span>
          <strong>{translate("ui.editorWorkspace.asset.assetPreview")}</strong>
          <small>{assetRelativePath(path)}</small>
        </span>
      </div>
      <div className="editor-preview-scroll editor-asset-image-stage">
        <AssetImage
          path={path}
          source={source}
          className="editor-asset-image"
        />
      </div>
    </div>
  );
}

function AssetBinaryImage({
  path,
  bytes,
}: {
  path: string;
  bytes: Uint8Array;
}) {
  const source = useAssetObjectUrl(path, bytes);
  return (
    <AssetImage path={path} source={source} className="editor-asset-image" />
  );
}

export function TrashContextPanel({
  entry,
  tab,
}: {
  entry: EditorTrashEntry;
  tab: "preview" | "properties";
}) {
  if (tab === "preview" && entry.kind === "asset")
    return <TrashAssetContextPreview entry={entry} />;
  return (
    <div className="editor-properties-panel editor-trash-properties">
      <p>{translate("ui.editorWorkspace.text.trash")}</p>
      <h2>{entry.label}</h2>
      <dl>
        <div>
          <dt>{translate("ui.editorWorkspace.trash.kind")}</dt>
          <dd>
            {entry.kind === "asset"
              ? translate("ui.editorWorkspace.trash.assetKind")
              : translate(
                  `ui.editorWorkspace.declaration.${entry.declarationKind}`,
                )}
          </dd>
        </div>
        <div>
          <dt>{translate("ui.editorWorkspace.trash.originalLocation")}</dt>
          <dd>
            <code>
              {entry.kind === "asset" ? entry.originalPath : entry.originalFile}
            </code>
          </dd>
        </div>
        <div>
          <dt>{translate("ui.editorWorkspace.trash.deletedAt")}</dt>
          <dd>{new Date(entry.deletedAt).toLocaleString()}</dd>
        </div>
      </dl>
      <p>{translate("ui.editorWorkspace.trash.readOnly")}</p>
    </div>
  );
}

function TrashAssetContextPreview({
  entry,
}: {
  entry: Extract<EditorTrashEntry, { kind: "asset" }>;
}) {
  const source = useAssetObjectUrl(entry.originalPath, entry.bytes);
  return <AssetContextPreview path={entry.originalPath} source={source} />;
}
