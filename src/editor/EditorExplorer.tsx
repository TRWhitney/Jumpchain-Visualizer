import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { translate } from "../localization";
import { normalizeFormat1HexColor } from "../markup/format1Colors";
import type { EditorTrashEntry } from "./model";
import { assetRelativePath, type AssetTreeEntry } from "./assetPaths";

type ExplorerEntryButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "title"
> & {
  label: string;
  before?: ReactNode;
  after?: ReactNode;
};

export function ExplorerEntryButton({
  label,
  before,
  after,
  ...buttonProps
}: ExplorerEntryButtonProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = labelRef.current;
    if (!element) return;
    const update = () =>
      setTruncated(element.scrollWidth > element.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [label]);

  return (
    <button
      {...buttonProps}
      type="button"
      title={truncated ? label : undefined}
    >
      {before}
      <span ref={labelRef}>{label}</span>
      {after}
    </button>
  );
}

export function ThemeColorPreview({ value }: { value: string }) {
  const color = normalizeFormat1HexColor(value);
  if (!color) return null;
  return (
    <span
      className="editor-theme-color-preview"
      aria-hidden="true"
      title={translate("ui.editorWorkspace.ariaLabel.themeColorPreview", {
        color,
      })}
      style={{ backgroundColor: color }}
    />
  );
}

export function BreadcrumbSeparator() {
  return (
    <span className="editor-breadcrumb-separator" aria-hidden="true">
      ›
    </span>
  );
}

export function ExplorerDisclosure({
  groupId,
  label,
  count,
  expanded,
  className,
  onToggle,
  onContextMenu,
  onContextMenuKey,
  children,
}: {
  groupId: string;
  label: ReactNode;
  count: number;
  expanded: boolean;
  className?: string;
  onToggle: (expanded: boolean) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onContextMenuKey: (event: ReactKeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  return (
    <details
      className={className}
      data-explorer-group={groupId}
      open={expanded}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary
        aria-haspopup="menu"
        onContextMenu={onContextMenu}
        onKeyDown={onContextMenuKey}
      >
        {label}
        <span>{count}</span>
      </summary>
      {children}
    </details>
  );
}

function assetTreeFileCount(entry: AssetTreeEntry): number {
  return entry.kind === "file"
    ? 1
    : entry.children.reduce(
        (count, child) => count + assetTreeFileCount(child),
        0,
      );
}

export function AssetExplorerEntries({
  entries,
  canonicalExtensions,
  selectedAsset,
  onOpenAsset,
  onContextAsset,
  onContextAssetKey,
}: {
  entries: readonly AssetTreeEntry[];
  canonicalExtensions: Readonly<Record<string, string>>;
  selectedAsset: string | null;
  onOpenAsset: (path: string) => void;
  onContextAsset: (path: string, event: ReactMouseEvent) => void;
  onContextAssetKey: (
    path: string,
    event: ReactKeyboardEvent<HTMLElement>,
  ) => void;
}) {
  return entries.map((entry) =>
    entry.kind === "folder" ? (
      <details className="editor-asset-folder" key={entry.path} open>
        <summary>
          {entry.name}
          <span>{assetTreeFileCount(entry)}</span>
        </summary>
        <AssetExplorerEntries
          entries={entry.children}
          canonicalExtensions={canonicalExtensions}
          selectedAsset={selectedAsset}
          onOpenAsset={onOpenAsset}
          onContextAsset={onContextAsset}
          onContextAssetKey={onContextAssetKey}
        />
      </details>
    ) : (
      <ExplorerEntryButton
        className={
          selectedAsset === entry.archivePath ? "is-selected" : undefined
        }
        key={entry.archivePath}
        label={entry.name}
        after={
          canonicalExtensions[entry.archivePath] ? (
            <small>{canonicalExtensions[entry.archivePath]}</small>
          ) : undefined
        }
        onClick={() => onOpenAsset(entry.archivePath)}
        onContextMenu={(event) => onContextAsset(entry.archivePath, event)}
        onKeyDown={(event) => onContextAssetKey(entry.archivePath, event)}
        aria-haspopup="menu"
      />
    ),
  );
}

export function TrashExplorerEntries({
  entries,
  hideWhenEmpty,
  selectedTrashId,
  groupId,
  expanded,
  onToggle,
  onContextGroup,
  onContextGroupKey,
  onOpen,
  onContext,
  onContextKey,
}: {
  entries: readonly EditorTrashEntry[];
  hideWhenEmpty: boolean;
  selectedTrashId: string | null;
  groupId: string;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  onContextGroup: (event: ReactMouseEvent) => void;
  onContextGroupKey: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onOpen: (entry: EditorTrashEntry) => void;
  onContext: (entry: EditorTrashEntry, event: ReactMouseEvent) => void;
  onContextKey: (
    entry: EditorTrashEntry,
    event: ReactKeyboardEvent<HTMLElement>,
  ) => void;
}) {
  if (hideWhenEmpty && entries.length === 0) return null;
  return (
    <ExplorerDisclosure
      className="editor-trash-group"
      groupId={groupId}
      label={translate("ui.editorWorkspace.text.trash")}
      count={entries.length}
      expanded={expanded}
      onToggle={onToggle}
      onContextMenu={onContextGroup}
      onContextMenuKey={onContextGroupKey}
    >
      {entries.map((entry) => (
        <ExplorerEntryButton
          className={selectedTrashId === entry.id ? "is-selected" : undefined}
          key={entry.id}
          label={entry.label}
          after={
            <small>
              {entry.kind === "asset"
                ? translate("ui.editorWorkspace.trash.assetKind")
                : translate(
                    `ui.editorWorkspace.declaration.${entry.declarationKind}`,
                  )}
            </small>
          }
          onClick={() => onOpen(entry)}
          onContextMenu={(event) => onContext(entry, event)}
          onKeyDown={(event) => onContextKey(entry, event)}
          aria-haspopup="menu"
        />
      ))}
    </ExplorerDisclosure>
  );
}

export function AssetImage({
  path,
  source,
  className,
}: {
  path: string;
  source?: string;
  className: string;
}) {
  return source ? (
    <img
      className={className}
      src={source}
      alt={translate("ui.editorWorkspace.asset.selectedAssetAlt", {
        asset: assetRelativePath(path),
      })}
    />
  ) : (
    <span className="editor-asset-image-loading" aria-live="polite">
      {translate("ui.editorWorkspace.asset.loadingImage")}
    </span>
  );
}
