import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEventHandler,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import {
  conditionContextHandles,
  conditionNodeEntries,
  conditionPropertyCatalog,
  packageIsValid,
  type PackageDiagnostic,
} from "../markup";
import {
  inspectPackageAsset,
  validatePackageAsset,
  type ImageHeaderMetadata,
  type PackageAssetMetadata,
} from "../archive";
import { NumberStepperButtons } from "../tracker/NumberStepper";
import { integerFieldControl } from "./integerField";
import {
  chordFor,
  effectivePackageSizeLimits,
  keybindingActions,
  keybindingDisplay,
  matchesKeybinding,
  type ApplicationSettings,
  type KeybindingAction,
  type KeybindingChord,
} from "../settings/model";
import { JumpPreview, type LayoutBoundHover } from "./JumpPreview";
import {
  previewSelectionForSymbol,
  type PreviewSelection,
} from "./previewSelection";
import { Format1LanguageService, type FormatSymbol } from "./languageService";
import {
  summarizeWorkspace,
  type EditorTrashEntry,
  type EditorWorkspaceSnapshot,
} from "./model";
import { createSelectControlModel } from "./selectControl";
import {
  addDocumentField,
  createAndAssignDocumentResource,
  declarationFieldNames,
  fieldDefault,
  fieldDefinition,
  fieldValues,
  insertDocumentChild,
  moveConditionalDocumentField,
  moveDocumentChild,
  removeDocumentDeclaration,
  removeDocumentFields,
  resolveDocumentSymbol,
  type FieldDefault,
  quickAddFieldMode,
  readConditionalSourceFieldGroups,
  readSourceField,
  readSourceFields,
  setDocumentField,
  setConditionalDocumentField,
  structuredContext,
} from "./documentEditor";
import {
  collapseLayoutLeaf,
  convertLayoutNode,
  createLayoutEditorTree,
  expandLayoutLeaf,
  insertLayoutChild,
  insertLayoutRoot,
  layoutAllowedNodeKinds,
  layoutNodeForPath,
  layoutNodeIsContainer,
  layoutNodeSourceSelection,
  layoutSelectionKey,
  layoutRootKinds,
  layoutSlotTargets,
  moveLayoutNode,
  removeLayoutNode,
  reorderLayoutNode,
  setLayoutNodeTarget,
  type LayoutEditResult,
  type LayoutEditorNode,
  type LayoutNodeRef,
} from "./layoutEditor";
import {
  SourceCodeEditor,
  type SourceCodeEditorHandle,
  type SourceSearchStatus,
} from "./SourceCodeEditor";
import { assignQuickAddMnemonics } from "./quickAdd";
import { translate, translateDiagnostic } from "../localization";
import {
  format1BuiltInColors,
  normalizeFormat1HexColor,
} from "../markup/format1Colors";
import { ColorFieldControl, type EditorColorChoice } from "./ColorFieldControl";
import { ImageDimensionFieldControl } from "./ImageDimensionFieldControl";
import { ConditionalVariants } from "./ConditionalVariants";
import { useAssetObjectUrl } from "../tracker/useAssetObjectUrls";
import { ConfirmationDialog } from "../ui";
import {
  assetArchivePath,
  assetBasename,
  assetFolder,
  assetReferences,
  assetRelativePath,
  buildAssetTree,
  renameAssetReferences,
  validateAssetRelativePath,
  type AssetPathValidationCode,
  type AssetTreeEntry,
} from "./assetPaths";
import {
  permanentlyDeleteAsset,
  permanentlyDeleteDeclaration,
  restoreAsset,
  restoreDeclaration,
  trashAsset,
  trashDeclaration,
} from "./trash";
import {
  assetImportRejectionEvent,
  assetPathRejectionReason,
  assetValidationRejectionReason,
} from "./assetImportFeedback";
import {
  AssetSourceWorkspace,
  type AssetSourceCommit,
} from "./AssetSourceWorkspace";
import {
  trimAssetWorkspaceHistory,
  type AssetWorkspaceHistoryState,
} from "./assetHistory";

type SaveState = "Saved" | "Saving" | "Unsaved" | "Save failed";
type NavigationTab = "content" | "files";
type EditingTab = "structured" | "source";
type ContextTab = "preview" | "properties";
type Severity = PackageDiagnostic["severity"];
type WorkspaceHistoryState = AssetWorkspaceHistoryState;
type LayoutInspectionHandle = { inspect: (path: string) => void };
type ExplorerAddKind =
  | "resource"
  | "section"
  | "choice"
  | "section layout"
  | "choice layout"
  | "trait layout"
  | "theme"
  | "asset";
type ExplorerContextTarget =
  | { kind: "symbol"; symbol: FormatSymbol }
  | { kind: "asset"; path: string }
  | { kind: "trash"; entry: EditorTrashEntry }
  | {
      kind: "group";
      groupId: string;
      expanded: boolean;
      additions: readonly ExplorerAddKind[];
    };
type ExplorerContextMenuState = ExplorerContextTarget & {
  x: number;
  y: number;
};
type PermanentRemovalTarget =
  | { kind: "trash"; id: string; label: string }
  | { kind: "symbol"; symbol: FormatSymbol; label: string }
  | { kind: "asset"; path: string; label: string };

const service = new Format1LanguageService();
let fallbackTrashId = 0;
const createTrashEntryId = () =>
  globalThis.crypto?.randomUUID?.() ?? `trash-${fallbackTrashId++}`;

type ExplorerEntryButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "title"
> & {
  label: string;
  before?: ReactNode;
  after?: ReactNode;
};

function ExplorerEntryButton({
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

function ThemeColorPreview({ value }: { value: string }) {
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

function BreadcrumbSeparator() {
  return (
    <span className="editor-breadcrumb-separator" aria-hidden="true">
      ›
    </span>
  );
}

function ExplorerDisclosure({
  groupId,
  label,
  count,
  expanded,
  className,
  onToggle,
  onContextMenu,
  children,
}: {
  groupId: string;
  label: ReactNode;
  count: number;
  expanded: boolean;
  className?: string;
  onToggle: (expanded: boolean) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <details
      className={className}
      data-explorer-group={groupId}
      open={expanded}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary onContextMenu={onContextMenu}>
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

function AssetExplorerEntries({
  entries,
  canonicalExtensions,
  selectedAsset,
  onOpenAsset,
  onContextAsset,
}: {
  entries: readonly AssetTreeEntry[];
  canonicalExtensions: Readonly<Record<string, string>>;
  selectedAsset: string | null;
  onOpenAsset: (path: string) => void;
  onContextAsset: (path: string, event: ReactMouseEvent) => void;
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
      />
    ),
  );
}

function TrashExplorerEntries({
  entries,
  hideWhenEmpty,
  selectedTrashId,
  groupId,
  expanded,
  onToggle,
  onContextGroup,
  onOpen,
  onContext,
}: {
  entries: readonly EditorTrashEntry[];
  hideWhenEmpty: boolean;
  selectedTrashId: string | null;
  groupId: string;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  onContextGroup: (event: ReactMouseEvent) => void;
  onOpen: (entry: EditorTrashEntry) => void;
  onContext: (entry: EditorTrashEntry, event: ReactMouseEvent) => void;
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
        />
      ))}
    </ExplorerDisclosure>
  );
}

function AssetImage({
  path,
  bytes,
  className,
}: {
  path: string;
  bytes: Uint8Array;
  className: string;
}) {
  const source = useAssetObjectUrl(path, bytes);
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

function assetMetadata(path: string, bytes: Uint8Array) {
  try {
    return inspectPackageAsset(path, bytes);
  } catch {
    return undefined;
  }
}

function editorColorChoices(
  files: Readonly<Record<string, string>>,
  symbols: readonly FormatSymbol[],
): EditorColorChoice[] {
  const choices: EditorColorChoice[] = Object.entries(format1BuiltInColors).map(
    ([value, color]) => ({ value, color, source: "built-in" }),
  );
  for (const symbol of symbols) {
    if (symbol.kind !== "theme" || !symbol.handle) continue;
    const color = normalizeFormat1HexColor(
      readSourceField(files[symbol.file], symbol, "color"),
    );
    if (!color || choices.some((choice) => choice.value === symbol.handle))
      continue;
    choices.push({ value: symbol.handle, color, source: "theme" });
  }
  return choices;
}

const declarationGroups = [
  {
    id: "resources",
    heading: "Resources",
    kinds: ["resource"],
    additions: ["resource"],
  },
  {
    id: "sections",
    heading: "Sections",
    kinds: ["section"],
    additions: ["section"],
  },
  {
    id: "choices",
    heading: "Choices",
    kinds: ["choice"],
    additions: ["choice"],
  },
  {
    id: "layouts",
    heading: "Layouts",
    kinds: ["section-layout", "choice-layout", "trait-layout"],
    additions: ["section layout", "choice layout", "trait layout"],
  },
  {
    id: "themes",
    heading: "Themes",
    kinds: ["theme"],
    additions: ["theme"],
  },
] as const;

function defaultShadowText(defaultValue: FieldDefault | null) {
  if (!defaultValue) return undefined;
  const value =
    defaultValue.kind === "built-in-layout"
      ? translate(
          {
            section: "ui.editorWorkspace.defaultValue.builtInSectionLayout",
            choice: "ui.editorWorkspace.defaultValue.builtInChoiceLayout",
            trait: "ui.editorWorkspace.defaultValue.builtInTraitLayout",
          }[defaultValue.layout],
        )
      : typeof defaultValue.value === "boolean"
        ? translate(
            `ui.editorWorkspace.defaultValue.boolean${defaultValue.value ? "True" : "False"}`,
          )
        : String(defaultValue.value);
  return translate("ui.editorWorkspace.defaultValue.template", { value });
}

const handleIdentityDeclarations = new Set([
  "theme",
  "section-layout",
  "choice-layout",
  "trait-layout",
]);

const layoutRowDragBoundarySelector = [
  "[data-editor-drag-boundary]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "button:not(:disabled)",
  '[contenteditable="true"]',
].join(", ");

function symbolLabel(symbol: FormatSymbol) {
  if (handleIdentityDeclarations.has(symbol.kind))
    return symbol.handle || symbol.kind.replaceAll("-", " ");
  return symbol.name || symbol.handle || symbol.kind.replaceAll("-", " ");
}

function explorerSymbolLabel(symbol: FormatSymbol) {
  return symbol.handle || symbol.kind.replaceAll("-", " ");
}

function sourceLine(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}

function editableSnippetSelection(snippet: string) {
  const field = /:\s*("([^"]*)"|([^\n]*))/.exec(snippet);
  if (!field || field.index === undefined)
    return { from: snippet.length, to: snippet.length };
  const rawValue = field[1];
  const valueFrom = field.index + field[0].indexOf(rawValue);
  return rawValue.startsWith('"')
    ? { from: valueFrom + 1, to: valueFrom + rawValue.length - 1 }
    : { from: valueFrom, to: valueFrom + rawValue.length };
}

const addTemplates = {
  resource: `\nresource\n  handle: new_resource\n  name: "New Resource"\n  abbreviation: "NR"\n  initial: 0\n`,
  section: `\nsection\n  handle: new_section\n  name: "New Section"\n`,
  choice: `\nchoice\n  handle: new_choice\n  name: "New Choice"\n  selection: toggle\n`,
  "section layout": `\nsection-layout\n  handle: new_section_layout\n\n  stack\n    gap: md\n\n    slot: name\n`,
  "choice layout": `\nchoice-layout\n  handle: new_choice_layout\n\n  stack\n    gap: sm\n\n    slot: name\n    slot: control\n`,
  "trait layout": `\ntrait-layout\n  handle: new_trait_layout\n\n  stack\n    gap: sm\n\n    slot: name\n`,
  theme: `\ntheme\n  handle: new_theme\n  color: "#68707c"\n`,
} as const;

function uniqueTopLevelTemplate(
  template: string,
  symbols: readonly FormatSymbol[],
) {
  const match = /\n {2}handle:\s*([a-z0-9_]+)/.exec(template);
  if (!match) return template;
  const handles = new Set(symbols.flatMap((symbol) => symbol.handle ?? []));
  if (!handles.has(match[1])) return template;
  let suffix = 2;
  while (handles.has(`${match[1]}_${suffix}`)) suffix += 1;
  return template.replace(
    `\n  handle: ${match[1]}`,
    `\n  handle: ${match[1]}_${suffix}`,
  );
}

export function EditorWorkspace({
  workspace,
  settings,
  saveState,
  onChange,
  onSave,
  onExport,
  onFeedback,
}: {
  workspace: EditorWorkspaceSnapshot;
  settings: ApplicationSettings;
  saveState: SaveState;
  onChange: (workspace: EditorWorkspaceSnapshot, continuous?: boolean) => void;
  onSave: () => void;
  onExport: () => void;
  onFeedback: (eventName: string) => void;
}) {
  const [navigationTab, setNavigationTab] = useState<NavigationTab>("content");
  const [editingTab, setEditingTab] = useState<EditingTab>("structured");
  const [contentEditingTab, setContentEditingTab] =
    useState<EditingTab>("structured");
  const [assetEditingTab, setAssetEditingTab] =
    useState<EditingTab>("structured");
  const [contextTab, setContextTab] = useState<ContextTab>("preview");
  const [selected, setSelected] = useState<PreviewSelection>({
    kind: "package",
  });
  const [selectedSymbol, setSelectedSymbol] = useState<FormatSymbol | null>(
    null,
  );
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedTrashId, setSelectedTrashId] = useState<string | null>(null);
  const [explorerContextMenu, setExplorerContextMenu] =
    useState<ExplorerContextMenuState | null>(null);
  const [expandedExplorerGroups, setExpandedExplorerGroups] = useState<
    Record<string, boolean>
  >({});
  const [permanentRemoval, setPermanentRemoval] =
    useState<PermanentRemovalTarget | null>(null);
  const [file, setFile] = useState(
    Object.keys(workspace.files).includes("jump.jdef")
      ? "jump.jdef"
      : Object.keys(workspace.files)[0],
  );
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findWholeWord, setFindWholeWord] = useState(false);
  const [findRegexp, setFindRegexp] = useState(false);
  const [findStatus, setFindStatus] = useState<SourceSearchStatus>({
    current: 0,
    total: 0,
    valid: true,
  });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [sourceCursor, setSourceCursor] = useState(0);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [structuredFocus, setStructuredFocus] = useState<string | null>(null);
  const [activeLayoutContainers, setActiveLayoutContainers] = useState<
    Record<string, string>
  >({});
  const [structuredAnnouncement, setStructuredAnnouncement] = useState("");
  const [resourceCreation, setResourceCreation] = useState<{
    owner: FormatSymbol;
  } | null>(null);
  const [structuredReturnTarget, setStructuredReturnTarget] =
    useState<FormatSymbol | null>(null);
  const [diagnosticFilters, setDiagnosticFilters] = useState<
    Record<Severity, boolean>
  >({ error: true, warning: true, info: true });
  const [showBounds, setShowBounds] = useState(false);
  const [stripColor, setStripColor] = useState(false);
  const [hoveredBound, setHoveredBound] = useState<LayoutBoundHover | null>(
    null,
  );
  const layoutInspectionRef = useRef<LayoutInspectionHandle>(null);
  const [history, setHistory] = useState<WorkspaceHistoryState[]>(() => [
    {
      files: workspace.files,
      assets: workspace.assets,
      assetEditorDocuments: workspace.assetEditorDocuments,
      trash: workspace.trash,
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const historyGroupRef = useRef<string | null>(null);
  const historyGroupTimer = useRef<number | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const explorerContextMenuRef = useRef<HTMLDivElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [lastValid, setLastValid] = useState(
    () => service.analyze(workspace.files).packageItem,
  );
  const sourceRef = useRef<SourceCodeEditorHandle>(null);
  const isExplorerGroupExpanded = (groupId: string) =>
    expandedExplorerGroups[groupId] ?? true;
  const setExplorerGroupExpanded = (groupId: string, expanded: boolean) =>
    setExpandedExplorerGroups((current) =>
      current[groupId] === expanded
        ? current
        : { ...current, [groupId]: expanded },
    );
  const handleSearchInputKeyDown = (
    event: Parameters<KeyboardEventHandler<HTMLInputElement>>[0],
    enterAction: "navigate" | "replace",
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      sourceRef.current?.findPrevious();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      sourceRef.current?.findNext();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (enterAction === "replace") sourceRef.current?.replaceNext();
      else if (event.shiftKey) sourceRef.current?.findPrevious();
      else sourceRef.current?.findNext();
    } else if (event.key === "Escape") {
      setFindOpen(false);
      sourceRef.current?.focus();
    }
  };
  const sourceKeybindings = useMemo(
    () =>
      Object.fromEntries(
        keybindingActions.map((action) => [action, chordFor(settings, action)]),
      ) as Record<KeybindingAction, KeybindingChord>,
    [settings],
  );

  useEffect(() => {
    if (!addOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !addMenuRef.current?.contains(event.target)
      )
        setAddOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [addOpen]);
  useEffect(() => {
    if (!explorerContextMenu) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !explorerContextMenuRef.current?.contains(event.target)
      )
        setExplorerContextMenu(null);
    };
    const closeMenu = () => setExplorerContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [explorerContextMenu]);
  const sourceShortcutLabels = useMemo(
    () =>
      Object.fromEntries(
        keybindingActions.map((action) => [
          action,
          keybindingDisplay(sourceKeybindings[action]),
        ]),
      ) as Record<KeybindingAction, string>,
    [sourceKeybindings],
  );
  const analysis = useMemo(
    () =>
      service.analyze(workspace.files, {
        assetPaths: Object.keys(workspace.assets).map(assetRelativePath),
        warnings: {
          missingImageAlt: settings.editor.warnMissingImageAlt,
          missingLayoutTargets: settings.editor.warnMissingLayoutTargets,
        },
      }),
    [
      settings.editor.warnMissingImageAlt,
      settings.editor.warnMissingLayoutTargets,
      workspace.assets,
      workspace.files,
    ],
  );
  const resolvedSelectedSymbol = selectedSymbol
    ? resolveDocumentSymbol(analysis.symbols, selectedSymbol)
    : null;
  const activeLayoutSelectionKey =
    resolvedSelectedSymbol &&
    ["section-layout", "choice-layout", "trait-layout"].includes(
      resolvedSelectedSymbol.kind,
    )
      ? layoutSelectionKey(resolvedSelectedSymbol)
      : null;
  const rememberActiveLayoutContainer = useCallback(
    (selectionKey: string, path: string) => {
      setActiveLayoutContainers((current) =>
        current[selectionKey] === path
          ? current
          : { ...current, [selectionKey]: path },
      );
    },
    [],
  );
  const previewSelection =
    navigationTab === "content" && resolvedSelectedSymbol && !selectedAsset
      ? previewSelectionForSymbol(workspace.files, resolvedSelectedSymbol)
      : selected;
  const recoveredAnalysis = useMemo(
    () =>
      service.analyze(service.recover(workspace.files), {
        assetPaths: Object.keys(workspace.assets).map(assetRelativePath),
        warnings: {
          missingImageAlt: settings.editor.warnMissingImageAlt,
          missingLayoutTargets: settings.editor.warnMissingLayoutTargets,
        },
      }),
    [
      settings.editor.warnMissingImageAlt,
      settings.editor.warnMissingLayoutTargets,
      workspace.assets,
      workspace.files,
    ],
  );
  const currentValid = packageIsValid(analysis.packageItem);
  const recoveredValid = packageIsValid(recoveredAnalysis.packageItem);
  const previewPackage = currentValid
    ? analysis.packageItem
    : recoveredValid
      ? recoveredAnalysis.packageItem
      : lastValid;
  const layoutPackageItem =
    previewSelection.kind === "layout"
      ? [analysis.packageItem, recoveredAnalysis.packageItem, lastValid].find(
          (packageItem) =>
            packageItem.layouts.some(
              (layout) => layout.handle === previewSelection.handle,
            ),
        )
      : undefined;
  const previewStatus = layoutPackageItem
    ? translate("ui.editorWorkspace.previewStatus.layoutPreview")
    : currentValid
      ? translate("ui.editorWorkspace.previewStatus.currentSource")
      : recoveredValid
        ? translate("ui.editorWorkspace.previewStatus.safelyRecovered")
        : translate("ui.editorWorkspace.previewStatus.lastValid");
  const sourceStatus = layoutPackageItem
    ? translate("ui.editorWorkspace.previewStatus.layoutUsesRepresentativeData")
    : currentValid
      ? translate("ui.editorWorkspace.previewStatus.sourceValid")
      : recoveredValid
        ? translate("ui.editorWorkspace.previewStatus.sourceRecovered")
        : translate("ui.editorWorkspace.previewStatus.sourceLastValid");
  const summary = summarizeWorkspace(workspace);
  const archiveAssetPaths = useMemo(
    () => Object.keys(workspace.assets),
    [workspace.assets],
  );
  const assetCanonicalExtensions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(workspace.assets).flatMap(([path, bytes]) => {
          const extension = assetMetadata(path, bytes)?.canonicalExtension;
          return extension ? [[path, extension]] : [];
        }),
      ),
    [workspace.assets],
  );
  const selectedAssetBytes = selectedAsset
    ? workspace.assets[selectedAsset]
    : undefined;
  const selectedAssetReferences = selectedAsset
    ? assetReferences(workspace.files, assetRelativePath(selectedAsset))
    : [];
  const selectedAssetMetadata =
    selectedAsset && selectedAssetBytes
      ? assetMetadata(selectedAsset, selectedAssetBytes)
      : undefined;
  const selectedTrash = selectedTrashId
    ? (workspace.trash.find((entry) => entry.id === selectedTrashId) ?? null)
    : null;
  const filteredDiagnostics = analysis.diagnostics.filter(
    (diagnostic) => diagnosticFilters[diagnostic.severity],
  );
  const priorityDiagnostic =
    service.highestPriorityDiagnostic(filteredDiagnostics);
  const quickFixAvailable =
    service.quickFix(workspace.files[file] ?? "") !==
    (workspace.files[file] ?? "");
  const sourceContextSymbol = useMemo(
    () =>
      analysis.symbols
        .filter(
          (symbol) =>
            symbol.file === file &&
            symbol.from <= sourceCursor &&
            symbol.to >= sourceCursor,
        )
        .sort((left, right) => right.depth - left.depth)[0] ?? null,
    [analysis.symbols, file, sourceCursor],
  );
  const sourceCompletionItems = useMemo(() => {
    if (!sourceContextSymbol)
      return service.completions("jump").fields.map((value) => ({
        value,
        kind: "field" as const,
      }));
    const source = workspace.files[sourceContextSymbol.file] ?? "";
    const context = structuredContext(workspace.files, sourceContextSymbol);
    return [
      ...service
        .contextualCompletions(workspace.files, sourceContextSymbol)
        .fields.filter(
          (value) =>
            quickAddFieldMode(
              source,
              sourceContextSymbol,
              value,
              context?.fields[value],
            ) !== null,
        )
        .map((value) => ({ value, kind: "field" as const })),
      ...service
        .contextualCompletions(workspace.files, sourceContextSymbol)
        .children.map((value) => ({ value, kind: "declaration" as const })),
    ];
  }, [sourceContextSymbol, workspace.files]);

  useEffect(() => {
    if (!currentValid) return;
    const update = window.setTimeout(
      () => setLastValid(analysis.packageItem),
      0,
    );
    return () => window.clearTimeout(update);
  }, [analysis.packageItem, currentValid]);

  useEffect(() => {
    if (settings.editor.saveMode !== "explicit" || saveState === "Saved")
      return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [saveState, settings.editor.saveMode]);

  const commitWorkspace = (
    nextFiles: Record<string, string>,
    nextAssets: Record<string, Uint8Array>,
    continuous = false,
    preserveRedo = false,
    historyGroup = "continuous",
    nextTrash = workspace.trash,
    nextAssetEditorDocuments = workspace.assetEditorDocuments,
  ) => {
    if (
      Object.keys(nextFiles).length === Object.keys(workspace.files).length &&
      Object.entries(nextFiles).every(
        ([path, source]) => workspace.files[path] === source,
      ) &&
      Object.keys(nextAssets).length === Object.keys(workspace.assets).length &&
      Object.entries(nextAssets).every(
        ([path, bytes]) => workspace.assets[path] === bytes,
      ) &&
      Object.keys(nextAssetEditorDocuments).length ===
        Object.keys(workspace.assetEditorDocuments).length &&
      Object.entries(nextAssetEditorDocuments).every(
        ([path, document]) => workspace.assetEditorDocuments[path] === document,
      ) &&
      nextTrash.length === workspace.trash.length &&
      nextTrash.every((entry, index) => workspace.trash[index] === entry)
    )
      return false;
    if (!preserveRedo) {
      let nextHistory: WorkspaceHistoryState[];
      let nextIndex: number;
      const entry = {
        files: nextFiles,
        assets: nextAssets,
        assetEditorDocuments: nextAssetEditorDocuments,
        trash: nextTrash,
      };
      if (
        continuous &&
        historyGroupRef.current === historyGroup &&
        historyIndexRef.current > 0
      ) {
        nextHistory = [...historyRef.current];
        nextHistory[historyIndexRef.current] = entry;
        nextIndex = historyIndexRef.current;
      } else {
        nextHistory = trimAssetWorkspaceHistory([
          ...historyRef.current.slice(0, historyIndexRef.current + 1),
          entry,
        ]);
        nextIndex = nextHistory.length - 1;
      }
      historyRef.current = nextHistory;
      historyIndexRef.current = nextIndex;
      setHistory(nextHistory);
      setHistoryIndex(nextIndex);
      historyGroupRef.current = continuous ? historyGroup : null;
      if (historyGroupTimer.current)
        window.clearTimeout(historyGroupTimer.current);
      if (continuous && historyGroup.startsWith("source:"))
        historyGroupTimer.current = window.setTimeout(() => {
          historyGroupRef.current = null;
          historyGroupTimer.current = null;
        }, 750);
    }
    onChange(
      {
        ...workspace,
        files: nextFiles,
        assets: nextAssets,
        assetEditorDocuments: nextAssetEditorDocuments,
        trash: nextTrash,
        updatedAt: new Date().toISOString(),
        revision: workspace.revision + 1,
      },
      continuous,
    );
    return true;
  };

  const endHistoryGroup = () => {
    historyGroupRef.current = null;
    if (historyGroupTimer.current)
      window.clearTimeout(historyGroupTimer.current);
    historyGroupTimer.current = null;
  };

  const commitFiles = (
    nextFiles: Record<string, string>,
    continuous = false,
    preserveRedo = false,
    historyGroup = "continuous",
  ) =>
    commitWorkspace(
      nextFiles,
      workspace.assets,
      continuous,
      preserveRedo,
      historyGroup,
    );

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyGroupRef.current = null;
    const nextIndex = historyIndexRef.current - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const entry = historyRef.current[nextIndex];
    if (selectedAsset) {
      const selectedBytes = workspace.assets[selectedAsset];
      setSelectedAsset(
        entry.assets[selectedAsset]
          ? selectedAsset
          : (Object.entries(entry.assets).find(
              ([, bytes]) => bytes === selectedBytes,
            )?.[0] ?? null),
      );
    }
    commitWorkspace(
      entry.files,
      entry.assets,
      false,
      true,
      "continuous",
      entry.trash,
      entry.assetEditorDocuments,
    );
  };
  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyGroupRef.current = null;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const entry = historyRef.current[nextIndex];
    if (selectedAsset) {
      const selectedBytes = workspace.assets[selectedAsset];
      setSelectedAsset(
        entry.assets[selectedAsset]
          ? selectedAsset
          : (Object.entries(entry.assets).find(
              ([, bytes]) => bytes === selectedBytes,
            )?.[0] ?? null),
      );
    }
    commitWorkspace(
      entry.files,
      entry.assets,
      false,
      true,
      "continuous",
      entry.trash,
      entry.assetEditorDocuments,
    );
  };

  const openSymbol = (symbol: FormatSymbol) => {
    setStructuredReturnTarget(null);
    setSelectedTrashId(null);
    setSelectedAsset(null);
    setSelectedSymbol(symbol);
    setSelected(previewSelectionForSymbol(workspace.files, symbol));
    setFile(symbol.file);
    setEditingTab(contentEditingTab);
  };

  const openFile = (nextFile: string) => {
    setSelectedTrashId(null);
    setSelectedAsset(null);
    setSelectedSymbol(null);
    setSelected({ kind: "package" });
    setFile(nextFile);
    setNavigationTab("files");
    setEditingTab("source");
    requestAnimationFrame(() => sourceRef.current?.focus());
  };

  const openContentAsset = (path: string) => {
    setSelectedTrashId(null);
    setSelectedAsset(path);
    setSelectedSymbol(null);
    setSelected({ kind: "package" });
    setNavigationTab("content");
    setEditingTab(assetEditingTab);
    setContextTab("preview");
  };

  const openFileAsset = (path: string) => {
    setSelectedTrashId(null);
    setSelectedAsset(path);
    setSelectedSymbol(null);
    setSelected({ kind: "package" });
    setNavigationTab("files");
    setEditingTab("source");
    setContextTab("preview");
  };

  const renameOrMoveAsset = async (
    currentPath: string,
    nextRelativePath: string,
  ): Promise<AssetPathValidationCode | "signature" | null> => {
    const validation = validateAssetRelativePath(
      nextRelativePath,
      Object.keys(workspace.assets),
      currentPath,
    );
    if (validation) return validation;
    const nextPath = assetArchivePath(nextRelativePath);
    if (nextPath === currentPath) return null;
    const bytes = workspace.assets[currentPath];
    if (!bytes) return "empty";
    try {
      await validatePackageAsset(nextPath, bytes);
    } catch {
      return "signature";
    }
    const nextAssets = { ...workspace.assets };
    delete nextAssets[currentPath];
    nextAssets[nextPath] = bytes;
    const nextAssetEditorDocuments = {
      ...workspace.assetEditorDocuments,
    };
    const editorDocument = nextAssetEditorDocuments[currentPath];
    delete nextAssetEditorDocuments[currentPath];
    if (editorDocument) nextAssetEditorDocuments[nextPath] = editorDocument;
    const nextFiles = renameAssetReferences(
      workspace.files,
      assetRelativePath(currentPath),
      nextRelativePath,
    );
    commitWorkspace(
      nextFiles,
      nextAssets,
      false,
      false,
      "continuous",
      workspace.trash,
      nextAssetEditorDocuments,
    );
    setSelectedAsset(nextPath);
    setStructuredAnnouncement(
      translate("ui.editorWorkspace.announcement.assetMoved", {
        asset: nextRelativePath,
      }),
    );
    return null;
  };

  const commitAssetSource = ({
    path,
    bytes,
    document,
    historyLabel,
  }: AssetSourceCommit) => {
    if (!workspace.assets[path]) return;
    const nextDocuments = { ...workspace.assetEditorDocuments };
    if (document) nextDocuments[path] = document;
    else delete nextDocuments[path];
    commitWorkspace(
      workspace.files,
      { ...workspace.assets, [path]: bytes },
      false,
      false,
      `asset:${path}:${historyLabel}`,
      workspace.trash,
      nextDocuments,
    );
  };

  const openTrash = (entry: EditorTrashEntry) => {
    setSelectedTrashId(entry.id);
    setSelectedAsset(null);
    setSelectedSymbol(null);
    setSelected({ kind: "package" });
    setEditingTab("source");
    setExplorerContextMenu(null);
    setContextTab("properties");
  };

  const openExplorerContextMenu = (
    event: ReactMouseEvent,
    target: ExplorerContextTarget,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const estimatedHeight =
      target.kind === "group" ? 42 * (target.additions.length + 1) + 8 : 150;
    setExplorerContextMenu({
      ...target,
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - estimatedHeight),
    });
  };

  const moveSymbolToTrash = (symbol: FormatSymbol) => {
    const result = trashDeclaration(
      workspace.files,
      symbol,
      createTrashEntryId(),
      new Date().toISOString(),
    );
    if (!result.changed) return;
    const nextTrash = [...workspace.trash, result.value.entry];
    if (
      !commitWorkspace(
        result.value.files,
        workspace.assets,
        false,
        false,
        "continuous",
        nextTrash,
      )
    )
      return;
    openTrash(result.value.entry);
    setStructuredAnnouncement(
      translate("ui.editorWorkspace.announcement.movedToTrash", {
        item: result.value.entry.label,
      }),
    );
  };

  const moveAssetToTrash = (path: string) => {
    const result = trashAsset(
      workspace.assets,
      path,
      createTrashEntryId(),
      new Date().toISOString(),
    );
    if (!result.changed) return;
    const editorDocument = workspace.assetEditorDocuments[path];
    const entry = editorDocument
      ? { ...result.value.entry, editorDocument }
      : result.value.entry;
    const nextTrash = [...workspace.trash, entry];
    const nextDocuments = { ...workspace.assetEditorDocuments };
    delete nextDocuments[path];
    if (
      !commitWorkspace(
        workspace.files,
        result.value.assets,
        false,
        false,
        "continuous",
        nextTrash,
        nextDocuments,
      )
    )
      return;
    openTrash(entry);
    setStructuredAnnouncement(
      translate("ui.editorWorkspace.announcement.movedToTrash", {
        item: entry.label,
      }),
    );
  };

  const restoreTrashEntry = (entry: EditorTrashEntry) => {
    const nextTrash = workspace.trash.filter(
      (candidate) => candidate.id !== entry.id,
    );
    if (entry.kind === "asset") {
      const result = restoreAsset(workspace.assets, entry);
      if (!result.changed) {
        setStructuredAnnouncement(
          translate("ui.editorWorkspace.announcement.trashRestoreCollision", {
            item: entry.label,
          }),
        );
        return;
      }
      commitWorkspace(
        workspace.files,
        result.value,
        false,
        false,
        "continuous",
        nextTrash,
        entry.editorDocument
          ? {
              ...workspace.assetEditorDocuments,
              [entry.originalPath]: entry.editorDocument,
            }
          : workspace.assetEditorDocuments,
      );
      if (navigationTab === "content") openContentAsset(entry.originalPath);
      else openFileAsset(entry.originalPath);
    } else {
      const result = restoreDeclaration(workspace.files, entry);
      if (!result.changed) {
        setStructuredAnnouncement(
          translate("ui.editorWorkspace.announcement.trashRestoreMissingFile", {
            file: entry.originalFile,
          }),
        );
        return;
      }
      commitWorkspace(
        result.value,
        workspace.assets,
        false,
        false,
        "continuous",
        nextTrash,
      );
      const restored = [...service.analyze(result.value).symbols]
        .reverse()
        .find(
          (symbol) =>
            symbol.file === entry.originalFile &&
            symbol.depth === 0 &&
            symbol.kind === entry.declarationKind &&
            explorerSymbolLabel(symbol) === entry.label,
        );
      setSelectedTrashId(null);
      setSelectedAsset(null);
      setSelectedSymbol(restored ?? null);
      setSelected(
        restored
          ? previewSelectionForSymbol(result.value, restored)
          : { kind: "package" },
      );
      setFile(entry.originalFile);
      setNavigationTab("content");
      setEditingTab(contentEditingTab);
    }
    setExplorerContextMenu(null);
    setStructuredAnnouncement(
      translate("ui.editorWorkspace.announcement.restoredFromTrash", {
        item: entry.label,
      }),
    );
  };

  const commitPermanentRemoval = (
    nextFiles: Record<string, string>,
    nextAssets: Record<string, Uint8Array>,
    nextTrash: EditorTrashEntry[],
    item: string,
    nextAssetEditorDocuments = workspace.assetEditorDocuments,
  ) => {
    const nextHistory = [
      {
        files: nextFiles,
        assets: nextAssets,
        assetEditorDocuments: nextAssetEditorDocuments,
        trash: nextTrash,
      },
    ];
    historyRef.current = nextHistory;
    historyIndexRef.current = 0;
    setHistory(nextHistory);
    setHistoryIndex(0);
    setSelectedTrashId(null);
    setSelectedAsset(null);
    setSelectedSymbol(null);
    setSelected({ kind: "package" });
    setPermanentRemoval(null);
    setExplorerContextMenu(null);
    onChange({
      ...workspace,
      files: nextFiles,
      assets: nextAssets,
      assetEditorDocuments: nextAssetEditorDocuments,
      trash: nextTrash,
      updatedAt: new Date().toISOString(),
      revision: workspace.revision + 1,
    });
    setStructuredAnnouncement(
      translate("ui.editorWorkspace.announcement.permanentlyDeleted", {
        item,
      }),
    );
  };

  const permanentlyDeleteTrashEntry = (entry: EditorTrashEntry) => {
    const nextTrash = workspace.trash.filter(
      (candidate) => candidate.id !== entry.id,
    );
    commitPermanentRemoval(
      workspace.files,
      workspace.assets,
      nextTrash,
      entry.label,
    );
  };

  const permanentlyDeleteLiveSymbol = (symbol: FormatSymbol) => {
    const removed = permanentlyDeleteDeclaration(workspace.files, symbol);
    if (!removed.changed) {
      setPermanentRemoval(null);
      return;
    }
    commitPermanentRemoval(
      removed.value,
      workspace.assets,
      workspace.trash,
      explorerSymbolLabel(symbol),
    );
  };

  const permanentlyDeleteLiveAsset = (path: string) => {
    const removed = permanentlyDeleteAsset(workspace.assets, path);
    if (!removed.changed) {
      setPermanentRemoval(null);
      return;
    }
    commitPermanentRemoval(
      workspace.files,
      removed.value,
      workspace.trash,
      assetBasename(path),
      Object.fromEntries(
        Object.entries(workspace.assetEditorDocuments).filter(
          ([candidate]) => candidate !== path,
        ),
      ),
    );
  };

  const confirmPermanentRemoval = () => {
    if (!permanentRemoval) return;
    if (permanentRemoval.kind === "trash") {
      const entry = workspace.trash.find(
        (candidate) => candidate.id === permanentRemoval.id,
      );
      if (entry) permanentlyDeleteTrashEntry(entry);
      else setPermanentRemoval(null);
    } else if (permanentRemoval.kind === "symbol")
      permanentlyDeleteLiveSymbol(permanentRemoval.symbol);
    else permanentlyDeleteLiveAsset(permanentRemoval.path);
  };

  const inspectLayoutBound = (bound: LayoutBoundHover) => {
    if (
      navigationTab !== "content" ||
      selected.kind !== "layout" ||
      !resolvedSelectedSymbol ||
      !["section-layout", "choice-layout", "trait-layout"].includes(
        resolvedSelectedSymbol.kind,
      )
    )
      return;
    const tree = createLayoutEditorTree(
      workspace.files,
      resolvedSelectedSymbol,
    );
    if (!tree) return;
    if (editingTab === "source") {
      const selection = layoutNodeSourceSelection(tree, bound.path);
      if (!selection) return;
      setFile(selection.file);
      requestAnimationFrame(() =>
        sourceRef.current?.setSelectionRange(selection.from, selection.to),
      );
      return;
    }
    if (!layoutNodeForPath(tree, bound.path)) return;
    layoutInspectionRef.current?.inspect(bound.path);
  };

  const runFormat = () => {
    try {
      const current = workspace.files[file] ?? "";
      const formatted = service.format(current);
      if (formatted === current) {
        onFeedback("editor.format.noop");
        return;
      }
      commitFiles({ ...workspace.files, [file]: formatted });
      onFeedback("editor.format.succeeded");
    } catch {
      onFeedback("editor.format.failed");
    }
  };

  const runQuickFix = () => {
    try {
      const current = workspace.files[file] ?? "";
      const fixed = service.quickFix(current);
      if (fixed === current) {
        onFeedback("editor.quick_fix.noop");
        return;
      }
      commitFiles({ ...workspace.files, [file]: fixed });
      onFeedback("editor.quick_fix.succeeded");
    } catch {
      onFeedback("editor.quick_fix.failed");
    }
  };

  const sourceSearch = useMemo(
    () => ({
      find,
      replace,
      caseSensitive: findCaseSensitive,
      wholeWord: findWholeWord,
      regexp: findRegexp,
    }),
    [find, findCaseSensitive, findRegexp, findWholeWord, replace],
  );
  const updateFindStatus = useCallback(
    (status: SourceSearchStatus) => setFindStatus(status),
    [],
  );

  const addAsset = async (candidate: File) => {
    const extension = candidate.name.split(".").at(-1)?.toLocaleLowerCase();
    const allowed = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"];
    const limit =
      effectivePackageSizeLimits(settings.developer).maxAssetFileMiB *
      1024 *
      1024;
    if (!extension || !allowed.includes(extension)) {
      onFeedback(assetImportRejectionEvent("unsupported_type"));
      return;
    }
    if (candidate.size > limit) {
      onFeedback(assetImportRejectionEvent("file_too_large"));
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await candidate.arrayBuffer());
    } catch {
      onFeedback(assetImportRejectionEvent("read_failed"));
      return;
    }
    const safeName = candidate.name.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
    const pathValidation = validateAssetRelativePath(
      safeName,
      Object.keys(workspace.assets),
    );
    if (pathValidation) {
      onFeedback(
        assetImportRejectionEvent(assetPathRejectionReason(pathValidation)),
      );
      return;
    }
    const path = assetArchivePath(safeName);
    try {
      await validatePackageAsset(path, bytes);
      const changed = commitWorkspace(workspace.files, {
        ...workspace.assets,
        [path]: bytes,
      });
      if (changed) openContentAsset(path);
      onFeedback("editor.asset.added");
    } catch (error) {
      onFeedback(
        assetImportRejectionEvent(assetValidationRejectionReason(error)),
      );
    }
  };

  const addTopLevelDeclaration = (kind: keyof typeof addTemplates) => {
    const target =
      kind.includes("layout") || kind === "theme"
        ? "layout.jdef"
        : kind === "choice"
          ? "choices.jdef"
          : "jump.jdef";
    const template = uniqueTopLevelTemplate(
      addTemplates[kind],
      analysis.symbols,
    );
    const nextFiles = {
      ...workspace.files,
      [target]: (workspace.files[target] ?? "") + template,
    };
    commitFiles(nextFiles);
    setFile(target);
    const declarationKind = kind.replace(" ", "-");
    const added = service
      .analyze(nextFiles)
      .symbols.filter(
        (symbol) => symbol.file === target && symbol.kind === declarationKind,
      )
      .at(-1);
    if (added) {
      setStructuredFocus(
        ["resource", "section", "choice", "theme"].includes(declarationKind)
          ? "handle"
          : "name",
      );
      openSymbol(added);
      setStructuredAnnouncement(
        translate("ui.editorWorkspace.announcement.declarationAdded", {
          declaration: translate(
            `ui.editorWorkspace.declaration.${declarationKind}`,
          ),
        }),
      );
    }
    setAddOpen(false);
    setExplorerContextMenu(null);
  };

  const requestAssetAddition = () => {
    setAddOpen(false);
    setExplorerContextMenu(null);
    assetInputRef.current?.click();
  };

  const runExplorerAddAction = (kind: ExplorerAddKind) => {
    if (kind === "asset") requestAssetAddition();
    else addTopLevelDeclaration(kind);
  };

  const symbolQuery = search.trim().toLocaleLowerCase();
  const visibleSymbols = analysis.symbols.filter(
    (symbol) =>
      (symbol.depth === 0 || Boolean(symbolQuery)) &&
      (!symbolQuery ||
        `${symbol.kind} ${symbol.handle ?? ""} ${symbol.name ?? ""}`
          .toLocaleLowerCase()
          .includes(symbolQuery)),
  );
  const errors = analysis.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warnings = analysis.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  const infos = analysis.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "info",
  ).length;

  return (
    <div className="production-editor" aria-label={`${summary.name} Editor`}>
      <div className="editor-project-toolbar">
        <strong title={summary.name}>{summary.name}</strong>
        <span
          className={`editor-save-state is-${saveState.toLocaleLowerCase().replace(" ", "-")}`}
        >
          {saveState}
        </span>
        <span className="editor-toolbar-spacer" />
        <button
          type="button"
          onClick={undo}
          disabled={historyIndex <= 0}
          aria-label={translate("ui.editorWorkspace.ariaLabel.undo")}
        >
          ↶
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          aria-label={translate("ui.editorWorkspace.ariaLabel.redo")}
        >
          ↷
        </button>
        {settings.editor.saveMode === "explicit" && (
          <button type="button" onClick={onSave}>
            {translate("ui.editorWorkspace.text.save")}
          </button>
        )}
        <button type="button" onClick={onExport}>
          {translate("ui.editorWorkspace.text.exportJmp")}
        </button>
        <div ref={addMenuRef} className="editor-add-menu">
          <button
            className="editor-primary-action"
            type="button"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((value) => !value)}
          >
            {translate("ui.editorWorkspace.text.add")}
          </button>
          {addOpen && (
            <div className="editor-add-options">
              {Object.keys(addTemplates).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  onClick={() =>
                    addTopLevelDeclaration(kind as keyof typeof addTemplates)
                  }
                >
                  {translate(
                    `ui.editorWorkspace.declaration.${kind.replaceAll(" ", "-")}`,
                  )}
                </button>
              ))}
              <button type="button" onClick={requestAssetAddition}>
                {translate("ui.editorWorkspace.text.asset")}
              </button>
            </div>
          )}
          <input
            ref={assetInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
            onChange={(event) => {
              const candidate = event.target.files?.[0];
              if (candidate) void addAsset(candidate);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <aside className="editor-explorer">
        <div
          className="editor-tabs editor-navigation-tabs"
          role="tablist"
          aria-label={translate("ui.editorWorkspace.ariaLabel.navigation")}
        >
          {(["content", "files"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={navigationTab === tab}
              onClick={() => {
                if (selectedTrash) {
                  setNavigationTab(tab);
                  setEditingTab("source");
                  return;
                }
                if (selectedAsset) {
                  if (tab === "content") openContentAsset(selectedAsset);
                  else openFileAsset(selectedAsset);
                  return;
                }
                setNavigationTab(tab);
                setEditingTab(tab === "files" ? "source" : contentEditingTab);
              }}
            >
              {tab[0].toLocaleUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {navigationTab === "content" ? (
          <div className="editor-explorer-panel">
            <label className="editor-outline-search">
              <span className="sr-only">
                {translate("ui.editorWorkspace.text.searchPackageContent")}
              </span>
              <input
                type="search"
                spellCheck={false}
                placeholder={translate(
                  "ui.editorWorkspace.placeholder.searchContent",
                )}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="editor-outline-scroll">
              <ExplorerEntryButton
                className={
                  selected.kind === "package" &&
                  !selectedAsset &&
                  !selectedTrash
                    ? "is-selected"
                    : ""
                }
                label={translate("ui.editorWorkspace.text.jumpDetails")}
                onClick={() => {
                  setSelected({ kind: "package" });
                  setSelectedSymbol(
                    analysis.symbols.find((symbol) => symbol.kind === "jump") ??
                      null,
                  );
                  setSelectedAsset(null);
                  setSelectedTrashId(null);
                  setFile("jump.jdef");
                  setEditingTab(contentEditingTab);
                }}
              />
              {declarationGroups.map(({ id, heading, kinds, additions }) => {
                const symbols = visibleSymbols.filter(
                  (symbol) =>
                    (kinds as readonly string[]).includes(symbol.kind) &&
                    (symbol.depth === 0 || Boolean(symbolQuery)),
                );
                if (!symbols.length && symbolQuery) return null;
                const groupId = `content:${id}`;
                const expanded = isExplorerGroupExpanded(groupId);
                return (
                  <ExplorerDisclosure
                    groupId={groupId}
                    key={heading}
                    label={heading}
                    count={symbols.length}
                    expanded={expanded}
                    onToggle={(nextExpanded) =>
                      setExplorerGroupExpanded(groupId, nextExpanded)
                    }
                    onContextMenu={(event) =>
                      openExplorerContextMenu(event, {
                        kind: "group",
                        groupId,
                        expanded,
                        additions,
                      })
                    }
                  >
                    {symbols.map((symbol) => (
                      <ExplorerEntryButton
                        className={
                          selectedSymbol?.file === symbol.file &&
                          selectedSymbol.from === symbol.from
                            ? "is-selected"
                            : ""
                        }
                        key={`${symbol.file}:${symbol.from}`}
                        label={explorerSymbolLabel(symbol)}
                        after={
                          symbol.kind.includes("layout") ? (
                            <small>{symbol.kind.replace("-layout", "")}</small>
                          ) : symbol.kind === "theme" ? (
                            <ThemeColorPreview
                              value={readSourceField(
                                workspace.files[symbol.file],
                                symbol,
                                "color",
                              )}
                            />
                          ) : undefined
                        }
                        onClick={() => openSymbol(symbol)}
                        onContextMenu={(event) =>
                          openExplorerContextMenu(event, {
                            kind: "symbol",
                            symbol,
                          })
                        }
                      />
                    ))}
                  </ExplorerDisclosure>
                );
              })}
              {symbolQuery &&
                visibleSymbols.some(
                  (symbol) =>
                    symbol.depth > 0 &&
                    !declarationGroups.some(({ kinds }) =>
                      (kinds as readonly string[]).includes(symbol.kind),
                    ),
                ) && (
                  <details open>
                    <summary>
                      {translate("ui.editorWorkspace.text.nestedResults")}{" "}
                      <span>
                        {
                          visibleSymbols.filter(
                            (symbol) =>
                              symbol.depth > 0 &&
                              !declarationGroups.some(({ kinds }) =>
                                (kinds as readonly string[]).includes(
                                  symbol.kind,
                                ),
                              ),
                          ).length
                        }
                      </span>
                    </summary>
                    {visibleSymbols
                      .filter(
                        (symbol) =>
                          symbol.depth > 0 &&
                          !declarationGroups.some(({ kinds }) =>
                            (kinds as readonly string[]).includes(symbol.kind),
                          ),
                      )
                      .map((symbol) => (
                        <ExplorerEntryButton
                          key={`nested:${symbol.file}:${symbol.from}`}
                          label={explorerSymbolLabel(symbol)}
                          after={<small>{symbol.kind}</small>}
                          onClick={() => openSymbol(symbol)}
                        />
                      ))}
                  </details>
                )}
              {(() => {
                const assets = Object.keys(workspace.assets).filter(
                  (asset) =>
                    !symbolQuery ||
                    assetRelativePath(asset)
                      .toLocaleLowerCase()
                      .includes(symbolQuery),
                );
                if (!assets.length && symbolQuery) return null;
                const groupId = "content:assets";
                const expanded = isExplorerGroupExpanded(groupId);
                return (
                  <ExplorerDisclosure
                    groupId={groupId}
                    label={translate("ui.editorWorkspace.text.assets")}
                    count={assets.length}
                    expanded={expanded}
                    onToggle={(nextExpanded) =>
                      setExplorerGroupExpanded(groupId, nextExpanded)
                    }
                    onContextMenu={(event) =>
                      openExplorerContextMenu(event, {
                        kind: "group",
                        groupId,
                        expanded,
                        additions: ["asset"],
                      })
                    }
                  >
                    <AssetExplorerEntries
                      entries={buildAssetTree(assets)}
                      canonicalExtensions={assetCanonicalExtensions}
                      selectedAsset={selectedAsset}
                      onOpenAsset={openContentAsset}
                      onContextAsset={(path, event) =>
                        openExplorerContextMenu(event, { kind: "asset", path })
                      }
                    />
                  </ExplorerDisclosure>
                );
              })()}
              <TrashExplorerEntries
                entries={workspace.trash}
                hideWhenEmpty={settings.editor.permanentlyDeleteSidebarItems}
                selectedTrashId={selectedTrashId}
                groupId="content:trash"
                expanded={isExplorerGroupExpanded("content:trash")}
                onToggle={(expanded) =>
                  setExplorerGroupExpanded("content:trash", expanded)
                }
                onContextGroup={(event) =>
                  openExplorerContextMenu(event, {
                    kind: "group",
                    groupId: "content:trash",
                    expanded: isExplorerGroupExpanded("content:trash"),
                    additions: [],
                  })
                }
                onOpen={openTrash}
                onContext={(entry, event) =>
                  openExplorerContextMenu(event, { kind: "trash", entry })
                }
              />
            </div>
          </div>
        ) : (
          <div className="editor-explorer-panel editor-file-list">
            <p>{translate("ui.editorWorkspace.text.packageFiles")}</p>
            <div className="editor-outline-scroll">
              {Object.keys(workspace.files)
                .sort()
                .map((path) => (
                  <ExplorerEntryButton
                    className={
                      file === path && !selectedAsset && !selectedTrash
                        ? "is-selected"
                        : ""
                    }
                    key={path}
                    label={path}
                    before={<span aria-hidden="true">▤</span>}
                    onClick={() => openFile(path)}
                  />
                ))}
              <ExplorerDisclosure
                groupId="files:assets"
                label={translate("ui.editorWorkspace.text.assets")}
                count={Object.keys(workspace.assets).length}
                expanded={isExplorerGroupExpanded("files:assets")}
                onToggle={(expanded) =>
                  setExplorerGroupExpanded("files:assets", expanded)
                }
                onContextMenu={(event) =>
                  openExplorerContextMenu(event, {
                    kind: "group",
                    groupId: "files:assets",
                    expanded: isExplorerGroupExpanded("files:assets"),
                    additions: ["asset"],
                  })
                }
              >
                <AssetExplorerEntries
                  entries={buildAssetTree(Object.keys(workspace.assets))}
                  canonicalExtensions={assetCanonicalExtensions}
                  selectedAsset={selectedAsset}
                  onOpenAsset={openFileAsset}
                  onContextAsset={(path, event) =>
                    openExplorerContextMenu(event, { kind: "asset", path })
                  }
                />
              </ExplorerDisclosure>
              <TrashExplorerEntries
                entries={workspace.trash}
                hideWhenEmpty={settings.editor.permanentlyDeleteSidebarItems}
                selectedTrashId={selectedTrashId}
                groupId="files:trash"
                expanded={isExplorerGroupExpanded("files:trash")}
                onToggle={(expanded) =>
                  setExplorerGroupExpanded("files:trash", expanded)
                }
                onContextGroup={(event) =>
                  openExplorerContextMenu(event, {
                    kind: "group",
                    groupId: "files:trash",
                    expanded: isExplorerGroupExpanded("files:trash"),
                    additions: [],
                  })
                }
                onOpen={openTrash}
                onContext={(entry, event) =>
                  openExplorerContextMenu(event, { kind: "trash", entry })
                }
              />
            </div>
          </div>
        )}
      </aside>

      <section
        className="editor-authoring-pane"
        aria-label={translate("ui.editorWorkspace.ariaLabel.authoring")}
      >
        <div
          className="editor-tabs"
          role="tablist"
          aria-label={translate("ui.editorWorkspace.ariaLabel.editingView")}
        >
          {(selectedTrash
            ? (["source"] as const)
            : selectedAsset
              ? navigationTab === "files"
                ? (["source"] as const)
                : (["structured", "source"] as const)
              : navigationTab === "files"
                ? (["source"] as const)
                : (["structured", "source"] as const)
          ).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={editingTab === tab}
              onClick={() => {
                setEditingTab(tab);
                if (navigationTab === "content") {
                  if (selectedAsset) setAssetEditingTab(tab);
                  else setContentEditingTab(tab);
                }
              }}
            >
              {tab[0].toLocaleUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {editingTab === "structured" ? (
          <>
            <span className="sr-only" aria-live="polite">
              {structuredAnnouncement}
            </span>
            {selectedAsset && selectedAssetBytes ? (
              <AssetStructuredPanel
                key={selectedAsset}
                path={selectedAsset}
                allPaths={archiveAssetPaths}
                referenceCount={selectedAssetReferences.length}
                onRename={renameOrMoveAsset}
              />
            ) : (
              <StructuredPanel
                key={`${resolvedSelectedSymbol?.file ?? "jump.jdef"}:${resolvedSelectedSymbol?.from ?? 0}`}
                packageName={summary.name}
                diagnostics={analysis.diagnostics}
                symbol={
                  resolvedSelectedSymbol ??
                  analysis.symbols.find((item) => item.kind === "jump") ??
                  null
                }
                files={workspace.files}
                assets={archiveAssetPaths.map(assetRelativePath)}
                focusField={structuredFocus}
                layoutInspectionRef={layoutInspectionRef}
                activeLayoutContainerPath={
                  activeLayoutSelectionKey
                    ? (activeLayoutContainers[activeLayoutSelectionKey] ?? null)
                    : null
                }
                activeLayoutSelectionKey={activeLayoutSelectionKey}
                onActiveLayoutContainerChange={rememberActiveLayoutContainer}
                returnTarget={structuredReturnTarget}
                onOpenSymbol={openSymbol}
                onOpenPackage={() => {
                  const jump = analysis.symbols.find(
                    (item) => item.kind === "jump",
                  );
                  if (jump) openSymbol(jump);
                }}
                onEndFieldEdit={endHistoryGroup}
                onUpdate={(symbol, field, value, occurrence = 0) => {
                  const result = setDocumentField(
                    workspace.files,
                    symbol,
                    field,
                    value,
                    occurrence,
                  );
                  if (!result.changed) return;
                  commitFiles(
                    result.files,
                    true,
                    false,
                    `field:${symbol.file}:${symbol.from}:${field}:${occurrence}`,
                  );
                  setSelectedSymbol(
                    service
                      .analyze(result.files)
                      .symbols.find(
                        (candidate) =>
                          candidate.file === symbol.file &&
                          candidate.kind === symbol.kind &&
                          candidate.from === symbol.from,
                      ) ?? symbol,
                  );
                }}
                onLayoutEdit={(result, announcement, continuous = false) => {
                  if (!result.changed) return;
                  commitFiles(
                    result.files,
                    continuous,
                    false,
                    continuous ? "layout-field" : "continuous",
                  );
                  if (announcement) setStructuredAnnouncement(announcement);
                }}
                onAddField={(symbol, field) => {
                  const result = addDocumentField(
                    workspace.files,
                    symbol,
                    field,
                  );
                  if (result.changed) commitFiles(result.files);
                }}
                onInsertChild={(owner, kind) => {
                  const result = insertDocumentChild(
                    workspace.files,
                    owner,
                    kind,
                  );
                  if (!result.changed || !result.target) return;
                  commitFiles(result.files);
                  setStructuredFocus(result.focusField ?? null);
                  openSymbol(result.target);
                  setStructuredAnnouncement(
                    translate(
                      "ui.editorWorkspace.announcement.declarationAdded",
                      {
                        declaration: kind.replaceAll("-", " "),
                      },
                    ),
                  );
                }}
                onCreateResource={(owner) => setResourceCreation({ owner })}
                onRemoveChild={(owner, child) => {
                  const result = removeDocumentDeclaration(
                    workspace.files,
                    child,
                  );
                  if (!result.changed) return;
                  commitFiles(result.files);
                  setStructuredFocus(null);
                  openSymbol(result.target ?? owner);
                  setStructuredAnnouncement(
                    translate(
                      "ui.editorWorkspace.announcement.declarationRemoved",
                      {
                        declaration: child.kind.replaceAll("-", " "),
                      },
                    ),
                  );
                }}
                onRemoveInvalidField={(symbol, field) => {
                  const result = removeDocumentFields(
                    workspace.files,
                    symbol,
                    field,
                  );
                  if (result.changed) commitFiles(result.files);
                }}
                onMoveChild={(owner, child, direction) => {
                  const result = moveDocumentChild(
                    workspace.files,
                    owner,
                    child,
                    direction,
                  );
                  if (!result.changed) return;
                  commitFiles(result.files);
                  if (result.target) openSymbol(result.target);
                  setStructuredAnnouncement(
                    translate(
                      "ui.editorWorkspace.announcement.declarationMoved",
                      {
                        declaration: child.kind.replaceAll("-", " "),
                      },
                    ),
                  );
                }}
                onUpdateVariant={(
                  symbol,
                  field,
                  occurrence,
                  condition,
                  value,
                  baseOccurrence,
                ) => {
                  const result = setConditionalDocumentField(
                    workspace.files,
                    symbol,
                    field,
                    occurrence,
                    condition,
                    value,
                    baseOccurrence,
                  );
                  if (result.changed) commitFiles(result.files);
                }}
                onMoveVariant={(symbol, field, occurrence, direction) => {
                  const result = moveConditionalDocumentField(
                    workspace.files,
                    symbol,
                    field,
                    occurrence,
                    direction,
                  );
                  if (result.changed) commitFiles(result.files);
                }}
                onReplace={(symbol, declaration, continuous = false) =>
                  commitFiles(
                    {
                      ...workspace.files,
                      [symbol.file]:
                        workspace.files[symbol.file].slice(0, symbol.from) +
                        declaration +
                        workspace.files[symbol.file].slice(symbol.to),
                    },
                    continuous,
                    false,
                    `field:${symbol.file}:${symbol.from}:layout-tree`,
                  )
                }
              />
            )}
          </>
        ) : selectedTrash ? (
          <TrashSourcePanel entry={selectedTrash} />
        ) : selectedAsset && selectedAssetBytes && selectedAssetMetadata ? (
          <AssetSourceWorkspace
            key={selectedAsset}
            path={selectedAsset}
            canonicalType={selectedAssetMetadata.canonicalExtension}
            width={selectedAssetMetadata.width}
            height={selectedAssetMetadata.height}
            bytes={selectedAssetBytes}
            document={workspace.assetEditorDocuments[selectedAsset]}
            readOnly={false}
            keybindings={sourceKeybindings}
            onCommit={commitAssetSource}
            onUndo={undo}
            onRedo={redo}
          />
        ) : (
          <div className={`editor-source-panel${findOpen ? " has-find" : ""}`}>
            <div className="editor-source-toolbar">
              <span>
                <strong>{file}</strong>
                {selectedSymbol ? ` / ${symbolLabel(selectedSymbol)}` : ""}
              </span>
              <div>
                <button
                  type="button"
                  aria-expanded={findOpen}
                  onClick={() => setFindOpen((value) => !value)}
                >
                  <span>{translate("ui.editorWorkspace.text.find")}</span>
                  <kbd aria-hidden="true">{sourceShortcutLabels.find}</kbd>
                </button>
                <button
                  type="button"
                  aria-expanded={quickAddOpen}
                  onClick={() => {
                    setQuickAddOpen((value) => !value);
                    setCompletionOpen(false);
                  }}
                >
                  <span>{translate("ui.editorWorkspace.text.quickAdd")}</span>
                  <kbd aria-hidden="true">{sourceShortcutLabels.quickAdd}</kbd>
                </button>
                <button type="button" onClick={runFormat}>
                  <span>{translate("ui.editorWorkspace.text.format")}</span>
                  <kbd aria-hidden="true">{sourceShortcutLabels.format}</kbd>
                </button>
                <button
                  type="button"
                  onClick={runQuickFix}
                  disabled={!quickFixAvailable}
                  title={
                    quickFixAvailable
                      ? "Apply the deterministic repair at the cursor"
                      : "No deterministic repair is available"
                  }
                >
                  <span>{translate("ui.editorWorkspace.text.quickFix")}</span>
                  <kbd aria-hidden="true">{sourceShortcutLabels.quickFix}</kbd>
                </button>
              </div>
            </div>
            {findOpen && (
              <div className="editor-find-bar" role="search">
                <div className="editor-find-row">
                  <div className="editor-find-field-shell">
                    <label>
                      <span className="sr-only">
                        {translate("ui.editorWorkspace.text.find")}
                      </span>
                      <input
                        autoFocus
                        spellCheck={false}
                        placeholder={translate(
                          "ui.editorWorkspace.placeholder.find",
                        )}
                        value={find}
                        aria-invalid={!findStatus.valid}
                        onKeyDown={(event) =>
                          handleSearchInputKeyDown(event, "navigate")
                        }
                        onChange={(event) => setFind(event.target.value)}
                      />
                    </label>
                    <div
                      className="editor-find-modes"
                      role="group"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.findOptions",
                      )}
                    >
                      <button
                        type="button"
                        className="editor-find-mode"
                        aria-label={translate(
                          "ui.editorWorkspace.ariaLabel.matchCase",
                        )}
                        aria-pressed={findCaseSensitive}
                        title={translate("ui.editorWorkspace.title.matchCase")}
                        onClick={() => setFindCaseSensitive((value) => !value)}
                      >
                        {translate("ui.editorWorkspace.text.aa")}
                      </button>
                      <button
                        type="button"
                        className="editor-find-mode"
                        aria-label={translate(
                          "ui.editorWorkspace.ariaLabel.matchWholeWord",
                        )}
                        aria-pressed={findWholeWord}
                        title={translate(
                          "ui.editorWorkspace.title.matchWholeWord",
                        )}
                        onClick={() => setFindWholeWord((value) => !value)}
                      >
                        {translate("ui.editorWorkspace.text.ab")}
                      </button>
                      <button
                        type="button"
                        className="editor-find-mode"
                        aria-label={translate(
                          "ui.editorWorkspace.ariaLabel.useRegularExpression",
                        )}
                        aria-pressed={findRegexp}
                        title={translate(
                          "ui.editorWorkspace.title.useRegularExpression",
                        )}
                        onClick={() => setFindRegexp((value) => !value)}
                      >
                        .*
                      </button>
                    </div>
                  </div>
                  <div className="editor-find-navigation">
                    <button
                      type="button"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.previousMatch",
                      )}
                      disabled={!findStatus.valid || !findStatus.total}
                      onClick={() => sourceRef.current?.findPrevious()}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.nextMatch",
                      )}
                      disabled={!findStatus.valid || !findStatus.total}
                      onClick={() => sourceRef.current?.findNext()}
                    >
                      ↓
                    </button>
                  </div>
                  <span className="editor-find-count" aria-live="polite">
                    {findStatus.valid
                      ? `${findStatus.current} of ${findStatus.total}`
                      : findStatus.error}
                  </span>
                  <label className="editor-replace-toggle">
                    <input
                      type="checkbox"
                      checked={replaceOpen}
                      onChange={(event) => setReplaceOpen(event.target.checked)}
                    />
                    <span>{translate("ui.editorWorkspace.text.replace")}</span>
                  </label>
                </div>
                {replaceOpen && (
                  <div className="editor-replace-row">
                    <label className="editor-replace-field-shell">
                      <span className="sr-only">
                        {translate("ui.editorWorkspace.text.replace")}
                      </span>
                      <input
                        spellCheck={false}
                        placeholder={translate(
                          "ui.editorWorkspace.placeholder.replace",
                        )}
                        value={replace}
                        onKeyDown={(event) =>
                          handleSearchInputKeyDown(event, "replace")
                        }
                        onChange={(event) => setReplace(event.target.value)}
                      />
                    </label>
                    <div className="editor-replace-actions">
                      <button
                        type="button"
                        disabled={!findStatus.valid || !findStatus.total}
                        onClick={() => sourceRef.current?.replaceNext()}
                      >
                        {translate("ui.editorWorkspace.text.replace")}
                      </button>
                      <button
                        type="button"
                        disabled={!findStatus.valid || !findStatus.total}
                        onClick={() => sourceRef.current?.replaceAll()}
                      >
                        {translate("ui.editorWorkspace.text.replaceAll")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="editor-code-stage">
              <SourceCodeEditor
                ref={sourceRef}
                file={file}
                value={workspace.files[file] ?? ""}
                searchQuery={sourceSearch}
                onSearchStatus={updateFindStatus}
                onSelectionChange={(from) => setSourceCursor(from)}
                onOpenFind={() => setFindOpen(true)}
                onQuickAdd={() => {
                  setQuickAddOpen((value) => !value);
                  setCompletionOpen(false);
                }}
                onFormat={runFormat}
                onQuickFix={runQuickFix}
                onCompletion={() => {
                  setCompletionOpen((value) => !value);
                }}
                onUndo={undo}
                onRedo={redo}
                completions={sourceCompletionItems.map((item) => item.value)}
                keybindings={sourceKeybindings}
                diagnostics={analysis.diagnostics.flatMap((diagnostic) => {
                  const extent = service.diagnosticExtent(
                    diagnostic,
                    analysis.parsed,
                  );
                  return diagnostic.range?.file === file && extent
                    ? [
                        {
                          ...extent,
                          severity: diagnostic.severity,
                          message: translateDiagnostic(diagnostic),
                        } as const,
                      ]
                    : [];
                })}
                onChange={(source, continuous) =>
                  commitFiles(
                    { ...workspace.files, [file]: source },
                    continuous,
                    false,
                    `source:${file}`,
                  )
                }
              />
              {quickAddOpen && (
                <SourcePalette
                  title={
                    sourceContextSymbol
                      ? `${sourceContextSymbol.kind} · ${sourceContextSymbol.handle ?? "declaration"}`
                      : file
                  }
                  symbol={sourceContextSymbol}
                  files={workspace.files}
                  source={
                    workspace.files[sourceContextSymbol?.file ?? file] ?? ""
                  }
                  onClose={() => setQuickAddOpen(false)}
                  onAdd={(field) => {
                    if (sourceContextSymbol) {
                      const result = addDocumentField(
                        workspace.files,
                        sourceContextSymbol,
                        field,
                      );
                      if (result.changed) {
                        commitFiles(result.files);
                        if (result.selection?.file === file) {
                          sourceRef.current?.syncExternalValue(
                            result.files[file],
                            result.selection,
                          );
                        }
                      } else if (result.selection?.file === file) {
                        sourceRef.current?.setSelectionRange(
                          result.selection.from,
                          result.selection.to,
                        );
                      }
                    }
                    setQuickAddOpen(false);
                  }}
                  onAddChild={(kind) => {
                    const indentation = " ".repeat(
                      ((sourceContextSymbol?.depth ?? 0) + 1) * 2,
                    );
                    const childBody =
                      kind === "cost"
                        ? "resource: jump_points\namount: 0"
                        : kind === "grant"
                          ? 'kind: perk\nname: "New grant"'
                          : kind === "choice"
                            ? "handle: new_placement\ntarget: choice_handle"
                            : kind === "choice-source"
                              ? "handle: new_source\nmode: multi"
                              : ["stack", "inline", "wrap"].includes(kind)
                                ? "gap: md"
                                : kind === "grid"
                                  ? "columns: 2"
                                  : `handle: new_${kind.replaceAll("-", "_")}`;
                    const snippet = `\n${indentation}${kind}\n${childBody
                      .split("\n")
                      .map((line) => `${indentation}  ${line}`)
                      .join("\n")}\n`;
                    sourceRef.current?.insert(
                      snippet,
                      editableSnippetSelection(snippet),
                    );
                    setQuickAddOpen(false);
                  }}
                  onQuickFix={() => {
                    runQuickFix();
                    setQuickAddOpen(false);
                  }}
                  quickFixAvailable={quickFixAvailable}
                  keybindings={sourceKeybindings}
                  shortcutLabels={sourceShortcutLabels}
                  onCompletion={() => {
                    setCompletionOpen((value) => !value);
                  }}
                />
              )}
              {completionOpen && (
                <div
                  className="editor-completion-list"
                  role="listbox"
                  aria-label={translate(
                    "ui.editorWorkspace.ariaLabel.allCompletions",
                  )}
                  onKeyDown={(event) => {
                    if (
                      matchesKeybinding(
                        event.nativeEvent,
                        sourceKeybindings.completions,
                      )
                    ) {
                      event.preventDefault();
                      setCompletionOpen(false);
                      sourceRef.current?.focus();
                    }
                  }}
                >
                  <header>
                    <strong>
                      {translate("ui.editorWorkspace.text.completions")}
                    </strong>
                    <button
                      type="button"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.closeCompletions",
                      )}
                      onClick={() => setCompletionOpen(false)}
                    >
                      ×
                    </button>
                  </header>
                  {sourceCompletionItems.map((item) => (
                    <button
                      type="button"
                      role="option"
                      key={`${item.kind}:${item.value}`}
                      onClick={() => {
                        if (item.kind === "field" && sourceContextSymbol) {
                          const result = addDocumentField(
                            workspace.files,
                            sourceContextSymbol,
                            item.value,
                          );
                          if (result.changed) {
                            commitFiles(result.files);
                            if (result.selection?.file === file) {
                              sourceRef.current?.syncExternalValue(
                                result.files[file],
                                result.selection,
                              );
                            }
                          } else if (result.selection?.file === file) {
                            sourceRef.current?.setSelectionRange(
                              result.selection.from,
                              result.selection.to,
                            );
                          }
                        } else {
                          sourceRef.current?.insert(
                            item.kind === "declaration"
                              ? `\n${" ".repeat(((sourceContextSymbol?.depth ?? 0) + 1) * 2)}${item.value}\n`
                              : `${item.value}: `,
                          );
                        }
                        setCompletionOpen(false);
                      }}
                    >
                      <code>{item.value}</code>
                      <small>
                        {translate("ui.editorWorkspace.text.format1")}
                        {item.kind}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className={`editor-source-status ${currentValid ? "is-valid" : "is-recovered"}`}
            >
              <span>{sourceStatus}</span>
              <strong>
                {translate("ui.editorWorkspace.previewStatus.label", {
                  status: previewStatus,
                })}
              </strong>
            </div>
          </div>
        )}
      </section>

      <aside className="editor-context-pane">
        <div
          className="editor-tabs"
          role="tablist"
          aria-label={translate("ui.editorWorkspace.ariaLabel.contextView")}
        >
          {(["preview", "properties"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={contextTab === tab}
              onClick={() => setContextTab(tab)}
            >
              {tab[0].toLocaleUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {selectedTrash ? (
          <TrashContextPanel entry={selectedTrash} tab={contextTab} />
        ) : contextTab === "preview" &&
          navigationTab === "content" &&
          selectedAsset &&
          selectedAssetBytes ? (
          <AssetContextPreview
            path={selectedAsset}
            bytes={selectedAssetBytes}
          />
        ) : contextTab === "preview" ? (
          <div className="editor-preview-panel">
            <div className="editor-preview-toolbar">
              <span>
                <strong>
                  {translate("ui.editorWorkspace.text.livePreview")}
                </strong>
                <small>{previewStatus}</small>
              </span>
              <div className="editor-preview-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={showBounds}
                    onChange={(event) => setShowBounds(event.target.checked)}
                  />{" "}
                  {translate("ui.editorWorkspace.text.showBounds")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={stripColor}
                    onChange={(event) => setStripColor(event.target.checked)}
                  />{" "}
                  {translate("ui.editorWorkspace.text.stripColor")}
                </label>
              </div>
            </div>
            <div className="editor-bounds-tools" hidden={!showBounds}>
              <div
                className="editor-bounds-legend"
                aria-label={translate(
                  "ui.editorWorkspace.ariaLabel.layoutBoundsLegend",
                )}
              >
                <span className="is-container">
                  {translate("ui.editorWorkspace.text.container")}
                </span>
                <span className="is-slot">
                  {translate("ui.editorWorkspace.text.slot")}
                </span>
                <span className="is-reference">
                  {translate("ui.editorWorkspace.text.reference")}
                </span>
              </div>
              <output
                className="editor-bound-readout"
                data-layout-bound-kind={hoveredBound?.kind}
                aria-label={translate(
                  "ui.editorWorkspace.ariaLabel.layoutBoundReadout",
                )}
                aria-live="polite"
              >
                <i aria-hidden="true" />
                <span>
                  {hoveredBound
                    ? translate("ui.editorWorkspace.text.layoutBoundReadout", {
                        kind: translate(
                          `ui.editorWorkspace.text.${hoveredBound.kind}`,
                        ),
                        path: hoveredBound.path,
                      })
                    : translate(
                        "ui.editorWorkspace.text.layoutBoundReadoutIdle",
                      )}
                </span>
              </output>
            </div>
            <div className="editor-preview-scroll">
              <JumpPreview
                packageItem={previewPackage}
                layoutPackageItem={layoutPackageItem}
                assets={workspace.assets}
                selection={previewSelection}
                showBounds={showBounds}
                stripColor={stripColor}
                layoutPreviewPlaceholderCharacterLimit={
                  settings.editor.layoutPreviewPlaceholderCharacterLimit
                }
                hoveredBound={hoveredBound}
                onHoveredBoundChange={setHoveredBound}
                onBoundActivate={inspectLayoutBound}
              />
            </div>
          </div>
        ) : (
          <PropertiesPanel
            summary={summary}
            symbol={resolvedSelectedSymbol}
            symbolLine={
              resolvedSelectedSymbol
                ? sourceLine(
                    workspace.files[resolvedSelectedSymbol.file] ?? "",
                    resolvedSelectedSymbol.from,
                  )
                : undefined
            }
            asset={selectedAsset}
            assetMetadata={selectedAssetMetadata}
            assetReferenceCount={selectedAssetReferences.length}
            selectedFile={
              navigationTab === "files" && !selectedAsset ? file : null
            }
            selectedFileBytes={
              navigationTab === "files" && !selectedAsset
                ? new TextEncoder().encode(workspace.files[file] ?? "")
                    .byteLength
                : undefined
            }
            selectedFileDiagnosticCount={
              navigationTab === "files" && !selectedAsset
                ? analysis.diagnostics.filter(
                    (diagnostic) => diagnostic.range?.file === file,
                  ).length
                : undefined
            }
            symbolOwner={
              resolvedSelectedSymbol
                ? structuredContext(workspace.files, resolvedSelectedSymbol)
                    ?.parent
                : undefined
            }
          />
        )}
      </aside>

      <section
        className={`editor-diagnostics ${diagnosticsOpen ? "is-open" : ""}`}
        aria-label={translate(
          "ui.editorWorkspace.ariaLabel.documentDiagnostics",
        )}
      >
        <div className="editor-diagnostics-bar">
          <button
            className="editor-diagnostics-toggle"
            type="button"
            aria-expanded={diagnosticsOpen}
            onClick={() => setDiagnosticsOpen((value) => !value)}
          >
            <span className="editor-diagnostics-chevron" aria-hidden="true">
              ›
            </span>
            <span>{translate("ui.editorWorkspace.text.diagnostics")}</span>
          </button>
          <div
            className="editor-diagnostic-filters"
            aria-label={translate(
              "ui.editorWorkspace.ariaLabel.filterDiagnosticsBySeverity",
            )}
          >
            {(["error", "warning", "info"] as const).map((severity) => {
              const count =
                severity === "error"
                  ? errors
                  : severity === "warning"
                    ? warnings
                    : infos;
              return (
                <button
                  className={`is-${severity}`}
                  key={severity}
                  type="button"
                  aria-pressed={diagnosticFilters[severity]}
                  aria-label={`${count} ${severity === "info" ? "information" : `${severity}s`}`}
                  title={`Toggle ${severity}s`}
                  onClick={() =>
                    setDiagnosticFilters((current) => ({
                      ...current,
                      [severity]: !current[severity],
                    }))
                  }
                >
                  <span className="editor-diagnostic-icon" aria-hidden="true">
                    {severity === "error"
                      ? "×"
                      : severity === "warning"
                        ? "!"
                        : "i"}
                  </span>{" "}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
          <div
            className={`editor-diagnostics-summary${priorityDiagnostic ? ` is-${priorityDiagnostic.severity}` : ""}`}
            aria-live="polite"
          >
            {priorityDiagnostic && (
              <span className="editor-diagnostic-icon" aria-hidden="true">
                {priorityDiagnostic.severity === "error"
                  ? "×"
                  : priorityDiagnostic.severity === "warning"
                    ? "!"
                    : "i"}
              </span>
            )}
            <span className="editor-diagnostics-summary-text">
              {priorityDiagnostic
                ? translateDiagnostic(priorityDiagnostic)
                : "No included diagnostics."}
            </span>
          </div>
        </div>
        {diagnosticsOpen && (
          <div className="editor-diagnostics-details">
            {filteredDiagnostics.map((diagnostic, index) => (
              <button
                type="button"
                className={`is-${diagnostic.severity}`}
                key={`${diagnostic.code}:${index}`}
                disabled={!diagnostic.range}
                onClick={() => {
                  if (!diagnostic.range) return;
                  openFile(diagnostic.range.file);
                  requestAnimationFrame(() => {
                    sourceRef.current?.setSelectionRange(
                      diagnostic.range!.from,
                      diagnostic.range!.to,
                    );
                  });
                }}
              >
                <span className="editor-diagnostic-icon" aria-hidden="true">
                  {diagnostic.severity === "error"
                    ? "×"
                    : diagnostic.severity === "warning"
                      ? "!"
                      : "i"}
                </span>
                <span>{translateDiagnostic(diagnostic)}</span>
                <code>
                  {diagnostic.range
                    ? `${diagnostic.range.file}:${diagnostic.range.line}`
                    : diagnostic.code}
                </code>
              </button>
            ))}
            {!filteredDiagnostics.length && (
              <p>
                {translate(
                  "ui.editorWorkspace.text.noDiagnosticClassesAreIncluded",
                )}
              </p>
            )}
          </div>
        )}
      </section>
      {explorerContextMenu && (
        <div
          ref={explorerContextMenuRef}
          className="editor-explorer-context-menu"
          role="menu"
          aria-label={translate(
            explorerContextMenu.kind === "group"
              ? "ui.editorWorkspace.ariaLabel.sidebarGroupMenu"
              : "ui.editorWorkspace.ariaLabel.sidebarItemMenu",
          )}
          style={{ left: explorerContextMenu.x, top: explorerContextMenu.y }}
        >
          {explorerContextMenu.kind === "group" ? (
            <>
              {explorerContextMenu.additions.map((addition, index) => {
                const item =
                  addition === "asset"
                    ? translate("ui.editorWorkspace.text.asset")
                    : translate(
                        `ui.editorWorkspace.declaration.${addition.replaceAll(" ", "-")}`,
                      );
                return (
                  <button
                    type="button"
                    role="menuitem"
                    autoFocus={index === 0}
                    key={addition}
                    onClick={() => runExplorerAddAction(addition)}
                  >
                    {translate("ui.editorWorkspace.text.addItem", { item })}
                  </button>
                );
              })}
              <button
                type="button"
                role="menuitem"
                autoFocus={!explorerContextMenu.additions.length}
                onClick={() => {
                  setExplorerGroupExpanded(
                    explorerContextMenu.groupId,
                    !explorerContextMenu.expanded,
                  );
                  setExplorerContextMenu(null);
                }}
              >
                {translate(
                  explorerContextMenu.expanded
                    ? "ui.editorWorkspace.text.collapse"
                    : "ui.editorWorkspace.text.expand",
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={() => {
                  if (explorerContextMenu.kind === "symbol")
                    openSymbol(explorerContextMenu.symbol);
                  else if (explorerContextMenu.kind === "asset") {
                    if (navigationTab === "content")
                      openContentAsset(explorerContextMenu.path);
                    else openFileAsset(explorerContextMenu.path);
                  } else openTrash(explorerContextMenu.entry);
                  setExplorerContextMenu(null);
                }}
              >
                {translate("ui.editorWorkspace.text.open")}
              </button>
              {explorerContextMenu.kind === "trash" && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    explorerContextMenu.entry.kind === "asset" &&
                    Boolean(
                      workspace.assets[explorerContextMenu.entry.originalPath],
                    )
                  }
                  onClick={() => restoreTrashEntry(explorerContextMenu.entry)}
                >
                  {translate("ui.editorWorkspace.text.restore")}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  if (explorerContextMenu.kind === "symbol") {
                    if (settings.editor.permanentlyDeleteSidebarItems) {
                      setPermanentRemoval({
                        kind: "symbol",
                        symbol: explorerContextMenu.symbol,
                        label: explorerSymbolLabel(explorerContextMenu.symbol),
                      });
                      setExplorerContextMenu(null);
                    } else moveSymbolToTrash(explorerContextMenu.symbol);
                  } else if (explorerContextMenu.kind === "asset") {
                    if (settings.editor.permanentlyDeleteSidebarItems) {
                      setPermanentRemoval({
                        kind: "asset",
                        path: explorerContextMenu.path,
                        label: assetBasename(explorerContextMenu.path),
                      });
                      setExplorerContextMenu(null);
                    } else moveAssetToTrash(explorerContextMenu.path);
                  } else {
                    setPermanentRemoval({
                      kind: "trash",
                      id: explorerContextMenu.entry.id,
                      label: explorerContextMenu.entry.label,
                    });
                    setExplorerContextMenu(null);
                  }
                }}
              >
                {translate("ui.editorWorkspace.text.delete")}
              </button>
            </>
          )}
        </div>
      )}
      {resourceCreation && (
        <ResourceCreationDialog
          onCancel={() => setResourceCreation(null)}
          onCreate={(values) => {
            const result = createAndAssignDocumentResource(
              workspace.files,
              resourceCreation.owner,
              values,
            );
            if (!result.changed || !result.target) return false;
            commitFiles(result.files);
            setResourceCreation(null);
            setStructuredFocus(result.focusField ?? null);
            openSymbol(result.target);
            setStructuredReturnTarget(resourceCreation.owner);
            setStructuredAnnouncement(
              translate("ui.editorWorkspace.announcement.resourceCreated", {
                resource: values.name,
              }),
            );
            return true;
          }}
        />
      )}
      {permanentRemoval && (
        <ConfirmationDialog
          application
          title={translate("ui.editorWorkspace.trash.permanentDeleteHeading", {
            item: permanentRemoval.label,
          })}
          confirmLabel={translate("ui.editorWorkspace.trash.deleteForever")}
          cancelLabel={translate("ui.editorWorkspace.text.cancel")}
          onCancel={() => setPermanentRemoval(null)}
          onConfirm={confirmPermanentRemoval}
        >
          {translate("ui.editorWorkspace.trash.permanentDeleteDescription")}
        </ConfirmationDialog>
      )}
    </div>
  );
}

function LayoutNodeFields({
  assets,
  diagnostics,
  files,
  symbol,
  onEndFieldEdit,
  onUpdate,
  fields,
  showHeading = true,
}: {
  assets: readonly string[];
  diagnostics: readonly PackageDiagnostic[];
  files: Readonly<Record<string, string>>;
  symbol: FormatSymbol;
  onEndFieldEdit: () => void;
  onUpdate: (
    symbol: FormatSymbol,
    field: string,
    value: string,
    occurrence?: number,
  ) => void;
  fields?: readonly string[];
  showHeading?: boolean;
}) {
  const context = structuredContext(files, symbol);
  if (!context) return null;
  const symbols = service.analyze(files).symbols;
  const visibleFields = fields
    ? context.visibleFields.filter((field) => fields.includes(field))
    : context.visibleFields;
  return (
    <div className="editor-form-grid editor-layout-node-fields">
      {showHeading && (
        <strong>
          {translate("ui.editorWorkspace.text.editLayoutNode", {
            node: symbol.kind,
          })}
        </strong>
      )}
      {visibleFields.map((fieldName) => {
        const definition = context.fields[fieldName];
        const value = readSourceField(files[symbol.file], symbol, fieldName);
        const options = fieldValues(definition);
        const omissionDefault: FieldDefault | null =
          definition.default === undefined
            ? null
            : { kind: "value", value: definition.default };
        const selectControl = createSelectControlModel(
          value,
          omissionDefault,
          options,
        );
        const referenceKind = definition.type?.startsWith("handleReference:")
          ? definition.type.slice("handleReference:".length)
          : null;
        const references = [
          ...(definition.type === "quotedString:assetRelativePath"
            ? assets
            : []),
          ...(referenceKind
            ? symbols
                .filter((candidate) => {
                  if (referenceKind === "owner-local-content")
                    return candidate.kind === symbol.kind;
                  if (referenceKind === "choice-placement")
                    return candidate.kind === "choice" && candidate.depth > 0;
                  return candidate.kind === referenceKind;
                })
                .flatMap((candidate) =>
                  candidate.handle ? [candidate.handle] : [],
                )
            : []),
        ];
        const colorChoices =
          definition.type === "color" ? editorColorChoices(files, symbols) : [];
        const matchingDiagnostics = diagnostics.filter(
          (diagnostic) =>
            diagnostic.target?.file === symbol.file &&
            diagnostic.target.declarationFrom === symbol.from &&
            diagnostic.target.field === fieldName,
        );
        const fieldSeverity = (["error", "warning", "info"] as const).find(
          (severity) =>
            matchingDiagnostics.some(
              (diagnostic) => diagnostic.severity === severity,
            ),
        );
        const listId = `layout-${symbol.from}-${fieldName}`;
        const fieldLabel = translate(
          `ui.editorWorkspace.layoutField.${fieldName}`,
        );
        const common = {
          "aria-invalid": matchingDiagnostics.length ? true : undefined,
          "aria-describedby": matchingDiagnostics.length
            ? `${listId}-diagnostics`
            : undefined,
        } as const;
        const integerControl = integerFieldControl(value, {
          minimum: definition.minimum,
          maximum: definition.maximum,
          defaultValue:
            typeof definition.default === "number"
              ? definition.default
              : undefined,
        });
        return (
          <div className="editor-schema-field" key={fieldName}>
            <div
              className={`editor-field-occurrence${fieldSeverity ? ` is-${fieldSeverity}` : ""}`}
            >
              <span>
                {fieldLabel}
                {definition.required && (
                  <small>{translate("ui.editorWorkspace.text.required")}</small>
                )}
              </span>
              {["color", "hexColor"].includes(definition.type ?? "") ? (
                <ColorFieldControl
                  label={fieldLabel}
                  value={value}
                  choices={colorChoices}
                  allowTokens={definition.type === "color"}
                  ariaInvalid={matchingDiagnostics.length > 0}
                  ariaDescribedBy={
                    matchingDiagnostics.length
                      ? `${listId}-diagnostics`
                      : undefined
                  }
                  onChange={(nextValue) =>
                    onUpdate(symbol, fieldName, nextValue)
                  }
                  onBlur={onEndFieldEdit}
                />
              ) : definition.type === "quotedString:assetRelativePath" ? (
                <select
                  aria-label={fieldLabel}
                  value={value}
                  {...common}
                  onChange={(event) =>
                    onUpdate(symbol, fieldName, event.target.value)
                  }
                  onBlur={onEndFieldEdit}
                >
                  <option value="">
                    {translate("ui.editorWorkspace.text.notSet")}
                  </option>
                  {value && !references.includes(value) && (
                    <option value={value}>
                      {translate("ui.editorWorkspace.asset.missingOption", {
                        asset: value,
                      })}
                    </option>
                  )}
                  {references.map((reference) => (
                    <option value={reference} key={reference}>
                      {reference}
                    </option>
                  ))}
                </select>
              ) : definition.type === "imageDimension" ? (
                <ImageDimensionFieldControl
                  label={fieldLabel}
                  value={value}
                  tokens={options}
                  ariaInvalid={matchingDiagnostics.length > 0}
                  ariaDescribedBy={
                    matchingDiagnostics.length
                      ? `${listId}-diagnostics`
                      : undefined
                  }
                  onChange={(nextValue) =>
                    onUpdate(symbol, fieldName, nextValue)
                  }
                  onBlur={onEndFieldEdit}
                />
              ) : options.length &&
                [
                  "enum",
                  "spacing",
                  "size",
                  "align",
                  "justify",
                  "textAlign",
                ].includes(definition.type ?? "") ? (
                <select
                  aria-label={fieldLabel}
                  value={selectControl.value}
                  {...common}
                  onChange={(event) =>
                    onUpdate(
                      symbol,
                      fieldName,
                      selectControl.authoredValue(event.target.value),
                    )
                  }
                  onBlur={onEndFieldEdit}
                >
                  {!definition.required && selectControl.showNotSet && (
                    <option value="">
                      {translate("ui.editorWorkspace.text.notSet")}
                    </option>
                  )}
                  {selectControl.options.map((option) => (
                    <option key={option} value={option}>
                      {symbol.kind === "rule" && fieldName === "style"
                        ? translate(
                            `ui.editorWorkspace.layoutOption.ruleStyle.${option}`,
                          )
                        : option}
                    </option>
                  ))}
                </select>
              ) : definition.type === "integer" ? (
                <span className="number-stepper editor-number-stepper is-fluid">
                  <input
                    aria-label={fieldLabel}
                    type="number"
                    min={definition.minimum}
                    max={definition.maximum}
                    value={value}
                    placeholder={
                      value === ""
                        ? defaultShadowText(omissionDefault)
                        : undefined
                    }
                    {...common}
                    onChange={(event) =>
                      onUpdate(symbol, fieldName, event.target.value)
                    }
                    onBlur={onEndFieldEdit}
                  />
                  <NumberStepperButtons
                    label={fieldLabel}
                    increaseDisabled={integerControl.increaseDisabled}
                    decreaseDisabled={integerControl.decreaseDisabled}
                    onIncrease={() =>
                      onUpdate(
                        symbol,
                        fieldName,
                        String(integerControl.increase()),
                      )
                    }
                    onDecrease={() =>
                      onUpdate(
                        symbol,
                        fieldName,
                        String(integerControl.decrease()),
                      )
                    }
                  />
                </span>
              ) : (
                <input
                  aria-label={fieldLabel}
                  type="text"
                  value={value}
                  list={references.length ? listId : undefined}
                  {...common}
                  onChange={(event) =>
                    onUpdate(symbol, fieldName, event.target.value)
                  }
                  onBlur={onEndFieldEdit}
                />
              )}
              {matchingDiagnostics.length > 0 && (
                <span
                  className="editor-field-diagnostics"
                  id={`${listId}-diagnostics`}
                >
                  {matchingDiagnostics.map((diagnostic, index) => (
                    <small
                      className={`is-${diagnostic.severity}`}
                      key={`${diagnostic.code}:${index}`}
                    >
                      {translateDiagnostic(diagnostic)}
                    </small>
                  ))}
                </span>
              )}
              {references.length > 0 && (
                <datalist id={listId}>
                  {references.map((reference) => (
                    <option key={reference} value={reference} />
                  ))}
                </datalist>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LayoutInvalidFields({
  diagnostics,
  files,
  symbol,
  onRemove,
}: {
  diagnostics: readonly PackageDiagnostic[];
  files: Readonly<Record<string, string>>;
  symbol: FormatSymbol;
  onRemove: (field: string) => void;
}) {
  const context = structuredContext(files, symbol);
  const invalidFields = context?.invalidAuthoredFields.filter(
    (field) => !context.childKinds.includes(field),
  );
  if (!invalidFields?.length) return null;
  return (
    <section className="editor-layout-invalid-fields">
      <strong>{translate("ui.editorWorkspace.text.needsAttention")}</strong>
      <p>{translate("ui.editorWorkspace.text.fieldsInvalidInContext")}</p>
      {invalidFields.map((field) => {
        const matchingDiagnostics = diagnostics.filter(
          (diagnostic) =>
            diagnostic.target?.file === symbol.file &&
            diagnostic.target.declarationFrom === symbol.from &&
            diagnostic.target.field === field,
        );
        return (
          <div key={field}>
            <label>
              <span>{field.replaceAll("-", " ")}</span>
              <input
                aria-invalid="true"
                readOnly
                value={readSourceField(files[symbol.file], symbol, field)}
              />
            </label>
            {matchingDiagnostics.map((diagnostic, index) => (
              <small
                className={`is-${diagnostic.severity}`}
                key={`${diagnostic.code}:${index}`}
              >
                {translateDiagnostic(diagnostic)}
              </small>
            ))}
            <button type="button" onClick={() => onRemove(field)}>
              {translate("ui.editorWorkspace.text.removeInvalidField")}
            </button>
          </div>
        );
      })}
    </section>
  );
}

function diagnosticsForLayoutNode(
  diagnostics: readonly PackageDiagnostic[],
  node: LayoutEditorNode,
) {
  return diagnostics.filter((diagnostic) => {
    if (diagnostic.range?.file !== node.file) return false;
    if (!node.compact) return diagnostic.target?.declarationFrom === node.from;
    const valueRange = node.sourceField?.valueRange;
    return Boolean(
      valueRange &&
      diagnostic.range &&
      diagnostic.range.from >= valueRange.from &&
      diagnostic.range.to <= valueRange.to,
    );
  });
}

function LayoutNodeDiagnostics({
  diagnostics,
  id,
}: {
  diagnostics: readonly PackageDiagnostic[];
  id: string;
}) {
  if (!diagnostics.length) return null;
  return (
    <span className="editor-layout-inline-diagnostics" id={id}>
      {diagnostics.map((diagnostic, index) => (
        <small
          className={`is-${diagnostic.severity}`}
          key={`${diagnostic.code}:${index}`}
        >
          {translateDiagnostic(diagnostic)}
        </small>
      ))}
    </span>
  );
}

function layoutNodeReference(node: LayoutEditorNode): LayoutNodeRef {
  return {
    file: node.file,
    from: node.from,
    kind: node.kind,
    compact: node.compact,
  };
}

function layoutNodeSymbol(
  layout: FormatSymbol,
  node: LayoutEditorNode,
): FormatSymbol {
  return {
    kind: node.kind,
    file: node.file,
    from: node.from,
    to: node.to,
    depth: layout.depth + node.depth + 1,
  };
}

type LayoutDropTarget = {
  id: string;
  placement: "before" | "inside" | "after";
};

function LayoutTreeEditor({
  assets,
  diagnostics,
  files,
  layout,
  symbols,
  onApply,
  onEndFieldEdit,
  inspectionRef,
  activeContainerPath,
  selectionKey,
  onActiveContainerChange,
}: {
  assets: readonly string[];
  diagnostics: readonly PackageDiagnostic[];
  files: Readonly<Record<string, string>>;
  layout: FormatSymbol;
  symbols: readonly FormatSymbol[];
  onApply: (
    result: LayoutEditResult,
    announcement?: string,
    continuous?: boolean,
  ) => void;
  onEndFieldEdit: () => void;
  inspectionRef: Ref<LayoutInspectionHandle>;
  activeContainerPath: string | null;
  selectionKey: string | null;
  onActiveContainerChange: (selectionKey: string, path: string) => void;
}) {
  const tree = useMemo(
    () => createLayoutEditorTree(files, layout),
    [files, layout],
  );
  const editorRef = useRef<HTMLElement>(null);
  const [inspectedPath, setInspectedPath] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] =
    useState<LayoutNodeRef | null>(null);
  const [editingNode, setEditingNode] = useState<LayoutNodeRef | null>(null);
  const [movingNode, setMovingNode] = useState<LayoutNodeRef | null>(null);
  const [moveDestination, setMoveDestination] = useState("");
  const [newKind, setNewKind] = useState("slot");
  const [newTarget, setNewTarget] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newUsing, setNewUsing] = useState("");
  const [draggedNode, setDraggedNode] = useState<LayoutNodeRef | null>(null);
  const draggedNodeRef = useRef<LayoutNodeRef | null>(null);
  const [layoutDragBoundaryActive, setLayoutDragBoundaryActive] =
    useState(false);
  const layoutDragBoundaryActiveRef = useRef(false);
  const [dropTarget, setDropTarget] = useState<LayoutDropTarget | null>(null);
  const dropTargetRef = useRef<LayoutDropTarget | null>(null);
  const [containerPresentationOpen, setContainerPresentationOpen] =
    useState(false);

  useImperativeHandle(
    inspectionRef,
    () => ({
      inspect: (path) => {
        if (!tree) return;
        const node = layoutNodeForPath(tree, path);
        if (!node) return;
        flushSync(() => {
          if (node.container) {
            setSelectedContainer(layoutNodeReference(node));
          } else {
            const parent = node.parentId
              ? tree.nodes[node.parentId]
              : undefined;
            if (parent) setSelectedContainer(layoutNodeReference(parent));
          }
          setEditingNode(null);
          setContainerPresentationOpen(false);
          setInspectedPath(path);
        });
        window.requestAnimationFrame(() => {
          const region = Array.from(
            editorRef.current?.querySelectorAll<HTMLElement>(
              node.container
                ? "[data-layout-container-editor-path]"
                : "[data-layout-node-path]",
            ) ?? [],
          ).find((candidate) =>
            node.container
              ? candidate.dataset.layoutContainerEditorPath === node.path
              : candidate.dataset.layoutNodePath === node.path,
          );
          if (!region) return;
          region.classList.remove("is-layout-inspected");
          void region.offsetWidth;
          region.classList.add("is-layout-inspected");
          region.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
      },
    }),
    [tree],
  );

  const resolve = (reference: LayoutNodeRef | null) =>
    tree && reference
      ? Object.values(tree.nodes).find(
          (node) =>
            node.file === reference.file &&
            node.from === reference.from &&
            node.kind === reference.kind &&
            node.compact === reference.compact,
        )
      : undefined;
  const root = tree?.rootId ? tree.nodes[tree.rootId] : undefined;
  const rememberedContainer =
    tree && activeContainerPath
      ? layoutNodeForPath(tree, activeContainerPath)
      : undefined;
  const selected =
    resolve(selectedContainer) ??
    (rememberedContainer?.container ? rememberedContainer : undefined) ??
    root;
  const selectedPath = selected?.path;
  useEffect(() => {
    if (selectionKey && selectedPath)
      onActiveContainerChange(selectionKey, selectedPath);
  }, [onActiveContainerChange, selectedPath, selectionKey]);

  if (!tree) return null;

  const selectedRef = selected ? layoutNodeReference(selected) : null;
  const edited = resolve(editingNode);
  const selectActiveContainer = (node: LayoutEditorNode) => {
    if (node.id !== selected?.id) setEditingNode(null);
    setSelectedContainer(layoutNodeReference(node));
  };
  const selectedDiagnostics = selected
    ? diagnosticsForLayoutNode(diagnostics, selected).filter(
        (diagnostic) => !diagnostic.target?.field,
      )
    : [];
  const children = selected
    ? selected.childIds.map((id) => tree.nodes[id]).filter(Boolean)
    : [];
  const allowedKinds = layoutAllowedNodeKinds(tree.layoutKind);
  const leafKinds = allowedKinds.filter((kind) => !layoutNodeIsContainer(kind));
  const rootKinds = layoutRootKinds(tree.layoutKind);
  const slots = layoutSlotTargets(tree.layoutKind);
  const referenceValues = (kind: string) =>
    symbols
      .filter((candidate) => {
        if (kind === "choice")
          return candidate.kind === "choice" && candidate.depth > 0;
        return candidate.kind === kind;
      })
      .flatMap((candidate) => candidate.handle ?? []);
  const targetValues = newKind === "slot" ? slots : referenceValues(newKind);
  const targetRequired = ["slot", "text", "image", "input", "choice"].includes(
    newKind,
  );
  const legalTarget =
    !targetRequired ||
    (newKind === "slot"
      ? slots.includes(newTarget || slots[0])
      : /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(newTarget));
  const displayKind = (kind: string) =>
    translate(`ui.editorWorkspace.declaration.${kind}`);
  const announce = (key: string, node: string) =>
    translate(`ui.editorWorkspace.announcement.${key}`, {
      node: displayKind(node),
    });
  const apply = (
    result: LayoutEditResult,
    announcement: string,
    select?: "container" | "node",
  ) => {
    if (!result.changed) return;
    onApply(result, announcement);
    if (result.target && select === "container") {
      setEditingNode(null);
      setSelectedContainer(result.target);
    }
    if (result.target && select === "node") setEditingNode(result.target);
  };
  const applyReparent = (
    result: LayoutEditResult,
    announcement: string,
    movedNode: LayoutEditorNode,
  ) => {
    if (!result.changed) return;
    setEditingNode(null);
    apply(result, announcement, movedNode.container ? "container" : undefined);
  };
  const updateLayoutField = (
    nodeSymbol: FormatSymbol,
    field: string,
    value: string,
    occurrence?: number,
  ) => {
    let result = setDocumentField(files, nodeSymbol, field, value, occurrence);
    if (!result.changed) return;
    const definition = structuredContext(files, nodeSymbol)?.fields[field];
    if (value && definition?.exclusiveWith) {
      for (const exclusiveField of definition.exclusiveWith) {
        const removal = removeDocumentFields(
          result.files,
          nodeSymbol,
          exclusiveField,
        );
        if (removal.changed) result = removal;
      }
    }
    onApply(
      { changed: true, files: result.files },
      announce("layoutNodeUpdated", nodeSymbol.kind),
      true,
    );
  };
  const removeInvalidLayoutField = (
    nodeSymbol: FormatSymbol,
    field: string,
  ) => {
    const result = removeDocumentFields(files, nodeSymbol, field);
    if (!result.changed) return;
    onApply(
      { changed: true, files: result.files },
      translate("ui.editorWorkspace.announcement.invalidLayoutFieldRemoved", {
        field,
      }),
    );
  };
  const ancestors: LayoutEditorNode[] = [];
  let ancestor = selected;
  while (ancestor) {
    ancestors.unshift(ancestor);
    ancestor = ancestor.parentId ? tree.nodes[ancestor.parentId] : undefined;
  }
  const destinationsForNode = (node: LayoutEditorNode) =>
    tree.containerIds
      .map((id) => tree.nodes[id])
      .filter((candidate) => {
        if (candidate.id === node.id || candidate.id === node.parentId)
          return false;
        let parent = candidate;
        while (parent.parentId) {
          if (parent.parentId === node.id) return false;
          parent = tree.nodes[parent.parentId];
        }
        return true;
      });
  const moving = resolve(movingNode);
  const moveDestinations = moving ? destinationsForNode(moving) : [];
  const updateDraggedNode = (node: LayoutNodeRef | null) => {
    draggedNodeRef.current = node;
    setDraggedNode(node);
  };
  const updateDropTarget = (target: LayoutDropTarget | null) => {
    dropTargetRef.current = target;
    setDropTarget(target);
  };
  const beginLayoutControlGesture = (
    row: HTMLDivElement,
    target: EventTarget | null,
  ) => {
    const blocksRowDrag =
      target instanceof Element &&
      Boolean(target.closest(layoutRowDragBoundarySelector));
    if (blocksRowDrag && layoutDragBoundaryActiveRef.current) {
      row.draggable = false;
      return;
    }
    layoutDragBoundaryActiveRef.current = blocksRowDrag;
    setLayoutDragBoundaryActive(blocksRowDrag);
    if (!blocksRowDrag) return;
    row.draggable = false;
    const restoreRowDrag = () => {
      window.removeEventListener("pointerup", restoreRowDrag);
      window.removeEventListener("mouseup", restoreRowDrag);
      window.setTimeout(() => {
        layoutDragBoundaryActiveRef.current = false;
        setLayoutDragBoundaryActive(false);
      });
    };
    window.addEventListener("pointerup", restoreRowDrag);
    window.addEventListener("mouseup", restoreRowDrag);
  };

  const reorderToDrop = (target: LayoutEditorNode, after: boolean) => {
    const dragged = resolve(draggedNodeRef.current);
    if (
      !dragged ||
      dragged.parentId !== target.parentId ||
      dragged.id === target.id
    )
      return;
    const withoutDragged = children.filter((node) => node.id !== dragged.id);
    const targetIndex = withoutDragged.findIndex(
      (node) => node.id === target.id,
    );
    const desiredIndex = targetIndex + (after ? 1 : 0);
    let currentIndex = children.findIndex((node) => node.id === dragged.id);
    let workingFiles: Readonly<Record<string, string>> = files;
    let workingRef = layoutNodeReference(dragged);
    let lastResult: LayoutEditResult | null = null;
    while (currentIndex !== desiredIndex) {
      const direction = currentIndex < desiredIndex ? "down" : "up";
      lastResult = reorderLayoutNode(
        workingFiles,
        layout,
        workingRef,
        direction,
      );
      if (!lastResult.changed || !lastResult.target) break;
      workingFiles = lastResult.files;
      workingRef = lastResult.target;
      currentIndex += direction === "down" ? 1 : -1;
    }
    if (lastResult?.changed)
      onApply(lastResult, announce("layoutNodeReordered", dragged.kind));
    updateDraggedNode(null);
    updateDropTarget(null);
  };
  const moveToDropContainer = (destination: LayoutEditorNode) => {
    const dragged = resolve(draggedNodeRef.current);
    if (
      !dragged ||
      !destinationsForNode(dragged).some(
        (candidate) => candidate.id === destination.id,
      )
    )
      return;
    applyReparent(
      moveLayoutNode(
        files,
        layout,
        layoutNodeReference(dragged),
        layoutNodeReference(destination),
      ),
      announce("layoutNodeMoved", dragged.kind),
      dragged,
    );
    updateDraggedNode(null);
    updateDropTarget(null);
  };

  return (
    <section className="editor-form-card editor-layout-builder" ref={editorRef}>
      <div className="editor-layout-heading">
        <strong>{translate("ui.editorWorkspace.text.layoutEditor")}</strong>
        <span>
          {translate("ui.editorWorkspace.text.layoutNodeCount", {
            count: Object.keys(tree.nodes).length,
          })}
        </span>
      </div>
      {!root ? (
        <div className="editor-layout-root-create">
          <p>{translate("ui.editorWorkspace.text.layoutNeedsRoot")}</p>
          <label>
            <span>{translate("ui.editorWorkspace.text.containerFlow")}</span>
            <select
              value={rootKinds.includes(newKind) ? newKind : rootKinds[0]}
              onChange={(event) => setNewKind(event.target.value)}
            >
              {rootKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {displayKind(kind)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              apply(
                insertLayoutRoot(
                  files,
                  layout,
                  rootKinds.includes(newKind) ? newKind : rootKinds[0],
                ),
                announce(
                  "layoutNodeAdded",
                  rootKinds.includes(newKind) ? newKind : rootKinds[0],
                ),
                "container",
              )
            }
          >
            {translate("ui.editorWorkspace.text.createRootContainer")}
          </button>
        </div>
      ) : (
        <>
          {!tree.structurallySafe && (
            <p className="editor-layout-unsafe" role="alert">
              {translate("ui.editorWorkspace.text.layoutStructureUnsafe")}
            </p>
          )}
          <div className="editor-layout-level-navigation">
            <label>
              <span>
                {translate("ui.editorWorkspace.text.editingContainer")}
              </span>
              <select
                value={selected?.id}
                onChange={(event) => {
                  const next = tree.nodes[event.target.value];
                  if (next) selectActiveContainer(next);
                }}
              >
                {tree.containerIds.map((id) => (
                  <option key={id} value={id}>
                    {tree.nodes[id].path}
                  </option>
                ))}
              </select>
            </label>
            <nav
              className="editor-layout-breadcrumb"
              aria-label={translate(
                "ui.editorWorkspace.ariaLabel.layoutContainerBreadcrumbs",
              )}
            >
              {ancestors.map((node, index) => (
                <span key={node.id}>
                  {index > 0 && <i aria-hidden="true">›</i>}
                  <button
                    type="button"
                    aria-current={node.id === selected?.id ? "page" : undefined}
                    onClick={() => selectActiveContainer(node)}
                  >
                    {node.kind}[{node.path.match(/\[(\d+)\]$/)?.[1] ?? "1"}]
                  </button>
                </span>
              ))}
            </nav>
          </div>
          {selected && (
            <div
              className={`editor-layout-selected-editor${
                inspectedPath === selected.path ? " is-layout-inspected" : ""
              }`}
              data-layout-container-editor-path={selected.path}
              tabIndex={-1}
            >
              <label>
                <span>{translate("ui.editorWorkspace.text.path")}</span>
                <span className="editor-layout-static-control">
                  {selected.path}
                </span>
              </label>
              <label>
                <span>
                  {translate("ui.editorWorkspace.text.containerFlow")}
                </span>
                <select
                  value={selected.kind}
                  disabled={!tree.structurallySafe}
                  onChange={(event) =>
                    apply(
                      convertLayoutNode(
                        files,
                        layout,
                        layoutNodeReference(selected),
                        event.target.value,
                      ),
                      announce("layoutNodeConverted", event.target.value),
                      "container",
                    )
                  }
                >
                  {allowedKinds.filter(layoutNodeIsContainer).map((kind) => (
                    <option key={kind} value={kind}>
                      {displayKind(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <LayoutNodeFields
                assets={assets}
                diagnostics={diagnostics}
                files={files}
                symbol={layoutNodeSymbol(layout, selected)}
                onEndFieldEdit={onEndFieldEdit}
                onUpdate={updateLayoutField}
                fields={["columns", "gap"]}
                showHeading={false}
              />
              <button
                type="button"
                className="editor-layout-presentation-button"
                aria-expanded={containerPresentationOpen}
                aria-label={translate(
                  "ui.editorWorkspace.ariaLabel.editLayoutNodePresentation",
                  { node: displayKind(selected.kind) },
                )}
                title={translate(
                  "ui.editorWorkspace.ariaLabel.editLayoutNodePresentation",
                  { node: displayKind(selected.kind) },
                )}
                onClick={() =>
                  setContainerPresentationOpen((current) => !current)
                }
              >
                ◫
              </button>
              {containerPresentationOpen && (
                <div className="editor-layout-container-presentation">
                  <LayoutNodeFields
                    assets={assets}
                    diagnostics={diagnostics}
                    files={files}
                    symbol={layoutNodeSymbol(layout, selected)}
                    onEndFieldEdit={onEndFieldEdit}
                    onUpdate={updateLayoutField}
                    fields={[
                      "padding",
                      "background",
                      "align",
                      "justify",
                      "text-align",
                      "text-size",
                      "text-color",
                    ]}
                    showHeading={false}
                  />
                </div>
              )}
              <LayoutInvalidFields
                diagnostics={diagnostics}
                files={files}
                symbol={layoutNodeSymbol(layout, selected)}
                onRemove={(field) =>
                  removeInvalidLayoutField(
                    layoutNodeSymbol(layout, selected),
                    field,
                  )
                }
              />
              <LayoutNodeDiagnostics
                diagnostics={selectedDiagnostics}
                id={`layout-container-${selected.from}-diagnostics`}
              />
            </div>
          )}
          <div className="editor-layout-children-heading">
            <strong>
              {translate("ui.editorWorkspace.text.childrenOf", {
                path: selected?.path ?? "",
              })}
            </strong>
            <span>
              {translate("ui.editorWorkspace.text.layoutItemCount", {
                count: children.length,
              })}
            </span>
          </div>
          <div className="editor-layout-table">
            {children.map((node, index) => {
              const isMoving = moving?.id === node.id;
              const movePanelId = `layout-move-${node.id.replaceAll(":", "-")}`;
              const targetListId = `layout-target-${node.id.replaceAll(":", "-")}`;
              const nodeReferenceValues = referenceValues(node.kind);
              const nodeDiagnostics = diagnosticsForLayoutNode(
                diagnostics,
                node,
              );
              const nodeDiagnosticId = `layout-node-${node.from}-diagnostics`;
              const diagnosticAttributes = nodeDiagnostics.length
                ? {
                    "aria-invalid": true as const,
                    "aria-describedby": nodeDiagnosticId,
                  }
                : {};
              const canCompact =
                !node.compact &&
                node.fieldNames.length === 1 &&
                node.fieldNames[0] === "target";
              return (
                <div
                  className={`editor-layout-row${
                    draggedNode && resolve(draggedNode)?.id === node.id
                      ? " dragging"
                      : ""
                  }${
                    dropTarget?.id === node.id
                      ? ` drop-${dropTarget.placement}`
                      : ""
                  }${
                    inspectedPath === node.path ? " is-layout-inspected" : ""
                  }`}
                  draggable={tree.structurallySafe && !layoutDragBoundaryActive}
                  data-layout-node-kind={node.kind}
                  data-layout-node-path={node.path}
                  tabIndex={-1}
                  key={node.id}
                  onPointerDownCapture={(event) =>
                    beginLayoutControlGesture(event.currentTarget, event.target)
                  }
                  onMouseDownCapture={(event) =>
                    beginLayoutControlGesture(event.currentTarget, event.target)
                  }
                  onDragStartCapture={(event) => {
                    if (layoutDragBoundaryActiveRef.current)
                      event.preventDefault();
                  }}
                  onDragStart={(event) => {
                    if (event.defaultPrevented) return;
                    event.dataTransfer.effectAllowed = "move";
                    updateDraggedNode(layoutNodeReference(node));
                  }}
                  onDragEnd={() => {
                    updateDraggedNode(null);
                    updateDropTarget(null);
                  }}
                  onDragOver={(event) => {
                    const dragged = resolve(draggedNodeRef.current);
                    if (!dragged || dragged.id === node.id) {
                      updateDropTarget(null);
                      return;
                    }
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const position =
                      (event.clientY - bounds.top) / bounds.height;
                    const canMoveInside =
                      node.container &&
                      destinationsForNode(dragged).some(
                        (candidate) => candidate.id === node.id,
                      );
                    const placement =
                      canMoveInside && position >= 1 / 3 && position <= 2 / 3
                        ? "inside"
                        : dragged.parentId === node.parentId
                          ? position > 0.5
                            ? "after"
                            : "before"
                          : null;
                    if (!placement) {
                      updateDropTarget(null);
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    updateDropTarget({
                      id: node.id,
                      placement,
                    });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const currentDropTarget = dropTargetRef.current;
                    if (
                      currentDropTarget?.id === node.id &&
                      currentDropTarget.placement === "inside"
                    )
                      moveToDropContainer(node);
                    else
                      reorderToDrop(
                        node,
                        currentDropTarget?.id === node.id &&
                          currentDropTarget.placement === "after",
                      );
                  }}
                >
                  <span
                    className="editor-layout-drag-handle"
                    draggable={tree.structurallySafe}
                    title={translate("ui.editorWorkspace.title.dragLayoutNode")}
                    aria-hidden="true"
                  >
                    ⋮⋮
                  </span>
                  <label>
                    <span>{translate("ui.editorWorkspace.text.nodeType")}</span>
                    {node.container ? (
                      <span className="editor-layout-static-control">
                        {displayKind(node.kind)}
                      </span>
                    ) : (
                      <select
                        value={node.kind}
                        disabled={!tree.structurallySafe}
                        {...diagnosticAttributes}
                        onChange={(event) =>
                          apply(
                            convertLayoutNode(
                              files,
                              layout,
                              layoutNodeReference(node),
                              event.target.value,
                            ),
                            announce("layoutNodeConverted", event.target.value),
                          )
                        }
                      >
                        {leafKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {displayKind(kind)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label>
                    <span>
                      {node.kind === "expand"
                        ? translate("ui.editorWorkspace.text.reference")
                        : translate("ui.editorWorkspace.text.target")}
                    </span>
                    {node.container ? (
                      <span className="editor-layout-static-control">
                        {node.path}
                      </span>
                    ) : node.kind === "rule" ? (
                      <span className="editor-layout-static-control">
                        {translate("ui.editorWorkspace.text.notApplicable")}
                      </span>
                    ) : node.kind === "slot" ? (
                      <select
                        value={node.target ?? ""}
                        disabled={!tree.structurallySafe}
                        {...diagnosticAttributes}
                        onChange={(event) =>
                          apply(
                            setLayoutNodeTarget(
                              files,
                              layout,
                              layoutNodeReference(node),
                              event.target.value,
                            ),
                            announce("layoutNodeUpdated", node.kind),
                          )
                        }
                      >
                        {slots.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    ) : node.kind === "expand" ? (
                      <div className="editor-layout-expand-controls">
                        <input
                          aria-label={translate(
                            "ui.editorWorkspace.text.source",
                          )}
                          defaultValue={node.source ?? ""}
                          list="layout-choice-sources"
                          {...diagnosticAttributes}
                          onBlur={(event) => {
                            updateLayoutField(
                              layoutNodeSymbol(layout, node),
                              "source",
                              event.target.value,
                            );
                            onEndFieldEdit();
                          }}
                        />
                        <input
                          aria-label={translate(
                            "ui.editorWorkspace.text.using",
                          )}
                          defaultValue={node.using ?? ""}
                          list="layout-choice-layouts"
                          {...diagnosticAttributes}
                          onBlur={(event) => {
                            updateLayoutField(
                              layoutNodeSymbol(layout, node),
                              "using",
                              event.target.value,
                            );
                            onEndFieldEdit();
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        key={`${node.id}:${node.target}`}
                        aria-label={translate(
                          "ui.editorWorkspace.ariaLabel.layoutNodeTarget",
                          { node: displayKind(node.kind) },
                        )}
                        defaultValue={node.target ?? ""}
                        list={targetListId}
                        {...diagnosticAttributes}
                        onBlur={(event) =>
                          apply(
                            setLayoutNodeTarget(
                              files,
                              layout,
                              layoutNodeReference(node),
                              event.target.value,
                            ),
                            announce("layoutNodeUpdated", node.kind),
                          )
                        }
                      />
                    )}
                    {nodeReferenceValues.length > 0 && (
                      <datalist id={targetListId}>
                        {nodeReferenceValues.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    )}
                  </label>
                  <label>
                    <span>
                      {translate("ui.editorWorkspace.text.container")}
                    </span>
                    {node.container ? (
                      <button
                        type="button"
                        className="editor-layout-open"
                        aria-label={translate(
                          "ui.editorWorkspace.ariaLabel.openLayoutContainer",
                          { container: node.path },
                        )}
                        title={translate(
                          "ui.editorWorkspace.ariaLabel.openLayoutContainer",
                          { container: node.path },
                        )}
                        onClick={() => selectActiveContainer(node)}
                      >
                        {translate("ui.editorWorkspace.text.open")}
                      </button>
                    ) : (
                      <span className="editor-layout-static-control">
                        {selected?.path}
                      </span>
                    )}
                  </label>
                  <div className="editor-layout-row-actions">
                    <button
                      type="button"
                      className="editor-layout-action-move"
                      title={translate(
                        "ui.editorWorkspace.ariaLabel.moveLayoutNodeToContainer",
                        { node: displayKind(node.kind) },
                      )}
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.moveLayoutNodeToContainer",
                        { node: displayKind(node.kind) },
                      )}
                      aria-controls={movePanelId}
                      aria-expanded={isMoving}
                      disabled={
                        !tree.structurallySafe ||
                        destinationsForNode(node).length === 0
                      }
                      onClick={() => {
                        if (isMoving) {
                          setMovingNode(null);
                          return;
                        }
                        setMovingNode(layoutNodeReference(node));
                        const destination = destinationsForNode(node)[0];
                        setMoveDestination(destination?.id ?? "");
                      }}
                    >
                      {translate("ui.editorWorkspace.text.moveEllipsis")}
                    </button>
                    <button
                      type="button"
                      className="editor-layout-action-presentation"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.editLayoutNodePresentation",
                        { node: displayKind(node.kind) },
                      )}
                      title={translate(
                        "ui.editorWorkspace.ariaLabel.editLayoutNodePresentation",
                        { node: displayKind(node.kind) },
                      )}
                      aria-expanded={edited?.id === node.id && !node.compact}
                      disabled={!tree.structurallySafe}
                      onClick={() => {
                        if (node.compact) {
                          apply(
                            expandLayoutLeaf(
                              files,
                              layout,
                              layoutNodeReference(node),
                            ),
                            announce("layoutNodeExpanded", node.kind),
                            "node",
                          );
                        } else if (edited?.id === node.id) {
                          if (canCompact)
                            apply(
                              collapseLayoutLeaf(
                                files,
                                layout,
                                layoutNodeReference(node),
                              ),
                              announce("layoutNodeCollapsed", node.kind),
                            );
                          setEditingNode(null);
                        } else {
                          setEditingNode(layoutNodeReference(node));
                        }
                      }}
                    >
                      ◫
                    </button>
                    <button
                      type="button"
                      className="editor-layout-action-up"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.moveLayoutNodeUp",
                        { node: displayKind(node.kind) },
                      )}
                      title={translate(
                        "ui.editorWorkspace.ariaLabel.moveLayoutNodeUp",
                        { node: displayKind(node.kind) },
                      )}
                      disabled={!tree.structurallySafe || index === 0}
                      onClick={() =>
                        apply(
                          reorderLayoutNode(
                            files,
                            layout,
                            layoutNodeReference(node),
                            "up",
                          ),
                          announce("layoutNodeReordered", node.kind),
                        )
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="editor-layout-action-down"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.moveLayoutNodeDown",
                        { node: displayKind(node.kind) },
                      )}
                      title={translate(
                        "ui.editorWorkspace.ariaLabel.moveLayoutNodeDown",
                        { node: displayKind(node.kind) },
                      )}
                      disabled={
                        !tree.structurallySafe || index === children.length - 1
                      }
                      onClick={() =>
                        apply(
                          reorderLayoutNode(
                            files,
                            layout,
                            layoutNodeReference(node),
                            "down",
                          ),
                          announce("layoutNodeReordered", node.kind),
                        )
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="editor-layout-action-remove"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.removeLayoutNode",
                        { node: displayKind(node.kind) },
                      )}
                      title={translate(
                        "ui.editorWorkspace.ariaLabel.removeLayoutNode",
                        { node: displayKind(node.kind) },
                      )}
                      disabled={!tree.structurallySafe}
                      onClick={() => {
                        apply(
                          removeLayoutNode(
                            files,
                            layout,
                            layoutNodeReference(node),
                          ),
                          announce("layoutNodeRemoved", node.kind),
                        );
                        setEditingNode(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <LayoutNodeDiagnostics
                    diagnostics={nodeDiagnostics}
                    id={nodeDiagnosticId}
                  />
                  {isMoving && (
                    <div className="editor-layout-move-panel" id={movePanelId}>
                      <label>
                        <span>
                          {translate("ui.editorWorkspace.text.moveToContainer")}
                        </span>
                        <select
                          value={moveDestination}
                          onChange={(event) =>
                            setMoveDestination(event.target.value)
                          }
                        >
                          {moveDestinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.path}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={!moveDestination}
                        onClick={() => {
                          const destination = tree.nodes[moveDestination];
                          if (destination)
                            applyReparent(
                              moveLayoutNode(
                                files,
                                layout,
                                layoutNodeReference(node),
                                layoutNodeReference(destination),
                              ),
                              announce("layoutNodeMoved", node.kind),
                              node,
                            );
                          setMovingNode(null);
                        }}
                      >
                        {translate("ui.editorWorkspace.text.move")}
                      </button>
                    </div>
                  )}
                  {edited?.id === node.id && !node.compact && (
                    <div className="editor-layout-row-node-fields">
                      <LayoutNodeFields
                        assets={assets}
                        diagnostics={diagnostics}
                        files={files}
                        symbol={layoutNodeSymbol(layout, node)}
                        onEndFieldEdit={onEndFieldEdit}
                        onUpdate={updateLayoutField}
                      />
                      <LayoutInvalidFields
                        diagnostics={diagnostics}
                        files={files}
                        symbol={layoutNodeSymbol(layout, node)}
                        onRemove={(field) =>
                          removeInvalidLayoutField(
                            layoutNodeSymbol(layout, node),
                            field,
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {selectedRef && (
            <div className="editor-layout-add-row">
              <label>
                <span>{translate("ui.editorWorkspace.text.newNodeType")}</span>
                <select
                  value={
                    allowedKinds.includes(newKind) ? newKind : allowedKinds[0]
                  }
                  onChange={(event) => {
                    setNewKind(event.target.value);
                    setNewTarget(
                      event.target.value === "slot" ? (slots[0] ?? "") : "",
                    );
                  }}
                >
                  {allowedKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {displayKind(kind)}
                    </option>
                  ))}
                </select>
              </label>
              {targetRequired && (
                <label>
                  <span>{translate("ui.editorWorkspace.text.target")}</span>
                  {newKind === "slot" ? (
                    <select
                      value={newTarget || slots[0]}
                      onChange={(event) => setNewTarget(event.target.value)}
                    >
                      {slots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={newTarget}
                      list="layout-new-targets"
                      onChange={(event) => setNewTarget(event.target.value)}
                    />
                  )}
                </label>
              )}
              {newKind === "expand" && (
                <>
                  <label>
                    <span>{translate("ui.editorWorkspace.text.source")}</span>
                    <input
                      value={newSource}
                      list="layout-choice-sources"
                      onChange={(event) => setNewSource(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{translate("ui.editorWorkspace.text.using")}</span>
                    <input
                      value={newUsing}
                      list="layout-choice-layouts"
                      onChange={(event) => setNewUsing(event.target.value)}
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                className="editor-layout-add"
                disabled={!tree.structurallySafe || !legalTarget}
                onClick={() => {
                  const effectiveTarget =
                    newKind === "slot" ? newTarget || slots[0] : newTarget;
                  const result = insertLayoutChild(
                    files,
                    layout,
                    selectedRef,
                    newKind,
                    {
                      target: effectiveTarget,
                      source: newSource || undefined,
                      using: newUsing || undefined,
                    },
                  );
                  apply(
                    result,
                    announce("layoutNodeAdded", newKind),
                    layoutNodeIsContainer(newKind) ? "container" : undefined,
                  );
                  if (result.changed) {
                    setNewTarget(newKind === "slot" ? (slots[0] ?? "") : "");
                    setNewSource("");
                    setNewUsing("");
                  }
                }}
              >
                {translate("ui.editorWorkspace.text.addChild")}
              </button>
              <datalist id="layout-new-targets">
                {targetValues.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              <datalist id="layout-choice-sources">
                {referenceValues("choice-source").map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              <datalist id="layout-choice-layouts">
                {referenceValues("choice-layout").map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ResourceCreationDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (values: {
    handle: string;
    name: string;
    abbreviation?: string;
    initial?: string;
  }) => boolean;
}) {
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [initial, setInitial] = useState("0");
  const [error, setError] = useState("");
  const initialControl = integerFieldControl(initial, {});
  const initialLabel = translate("ui.editorWorkspace.field.initial");
  return (
    <div className="editor-departure-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-create-resource-heading"
      >
        <p>{translate("ui.editorWorkspace.text.secondaryCurrency")}</p>
        <h2 id="editor-create-resource-heading">
          {translate("ui.editorWorkspace.text.createResource")}
        </h2>
        <form
          className="editor-resource-form"
          onSubmit={(event) => {
            event.preventDefault();
            const created = onCreate({
              handle,
              name,
              abbreviation: abbreviation || undefined,
              initial,
            });
            if (!created)
              setError(
                translate("ui.editorWorkspace.text.resourceValuesInvalid"),
              );
          }}
        >
          <label>
            <span>{translate("ui.editorWorkspace.field.handle")}</span>
            <input
              autoFocus
              required
              pattern="[a-z0-9]+(?:_[a-z0-9]+)*"
              value={handle}
              onChange={(event) => {
                setHandle(event.target.value);
                setError("");
              }}
            />
          </label>
          <label>
            <span>{translate("ui.editorWorkspace.field.name")}</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>{translate("ui.editorWorkspace.field.abbreviation")}</span>
            <input
              value={abbreviation}
              onChange={(event) => setAbbreviation(event.target.value)}
            />
          </label>
          <div className="editor-resource-form-field">
            <span>{initialLabel}</span>
            <span className="number-stepper editor-number-stepper is-fluid">
              <input
                required
                aria-label={initialLabel}
                type="number"
                value={initial}
                onChange={(event) => setInitial(event.target.value)}
              />
              <NumberStepperButtons
                label={initialLabel}
                onIncrease={() => setInitial(String(initialControl.increase()))}
                onDecrease={() => setInitial(String(initialControl.decrease()))}
              />
            </span>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="editor-resource-form-actions">
            <button type="submit">
              {translate("ui.editorWorkspace.text.createAndUseResource")}
            </button>
            <button type="button" onClick={onCancel}>
              {translate("ui.editorWorkspace.text.cancel")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StructuredPanel({
  packageName,
  diagnostics,
  symbol,
  files,
  assets,
  focusField,
  layoutInspectionRef,
  activeLayoutContainerPath,
  activeLayoutSelectionKey,
  onActiveLayoutContainerChange,
  returnTarget,
  onUpdate,
  onLayoutEdit,
  onReplace,
  onOpenPackage,
  onOpenSymbol,
  onAddField,
  onInsertChild,
  onCreateResource,
  onRemoveChild,
  onRemoveInvalidField,
  onMoveChild,
  onUpdateVariant,
  onMoveVariant,
  onEndFieldEdit,
}: {
  packageName: string;
  diagnostics: readonly PackageDiagnostic[];
  symbol: FormatSymbol | null;
  files: Readonly<Record<string, string>>;
  assets: readonly string[];
  focusField: string | null;
  layoutInspectionRef: Ref<LayoutInspectionHandle>;
  activeLayoutContainerPath: string | null;
  activeLayoutSelectionKey: string | null;
  onActiveLayoutContainerChange: (selectionKey: string, path: string) => void;
  returnTarget: FormatSymbol | null;
  onUpdate: (
    symbol: FormatSymbol,
    field: string,
    value: string,
    occurrence?: number,
  ) => void;
  onLayoutEdit: (
    result: LayoutEditResult,
    announcement?: string,
    continuous?: boolean,
  ) => void;
  onReplace: (
    symbol: FormatSymbol,
    declaration: string,
    continuous?: boolean,
  ) => void;
  onOpenPackage: () => void;
  onOpenSymbol: (symbol: FormatSymbol) => void;
  onAddField: (symbol: FormatSymbol, field: string) => void;
  onInsertChild: (symbol: FormatSymbol, kind: string) => void;
  onCreateResource: (symbol: FormatSymbol) => void;
  onRemoveChild: (owner: FormatSymbol, child: FormatSymbol) => void;
  onRemoveInvalidField: (symbol: FormatSymbol, field: string) => void;
  onMoveChild: (
    owner: FormatSymbol,
    child: FormatSymbol,
    direction: "up" | "down",
  ) => void;
  onEndFieldEdit: () => void;
  onUpdateVariant: (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
    condition: string,
    value: string,
    baseOccurrence?: number,
  ) => void;
  onMoveVariant: (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
    direction: "up" | "down",
  ) => void;
}) {
  const source = symbol ? files[symbol.file].slice(symbol.from, symbol.to) : "";
  const field = (name: string) =>
    symbol ? readSourceField(files[symbol.file], symbol, name) : "";
  if (!symbol)
    return (
      <div className="editor-empty-panel">
        <strong>
          {translate("ui.editorWorkspace.text.noDeclarationSelected")}
        </strong>
        <span>
          {translate(
            "ui.editorWorkspace.text.choosePackageContentFromTheExplorer",
          )}
        </span>
      </div>
    );
  const handle = field("handle");
  const name = handleIdentityDeclarations.has(symbol.kind)
    ? handle
    : field("name") || (symbol.kind === "jump" ? packageName : handle);
  const resolvedContext = structuredContext(files, symbol);
  const isLayout = symbol.kind.includes("layout");
  const scalarForm = new RegExp(
    `^\\s*${symbol.kind.replaceAll("-", "\\-")}:\\s*(.+)$`,
  ).exec(source.split("\n")[0] ?? "");
  const visibleFieldNames =
    resolvedContext?.visibleFields ?? declarationFieldNames(symbol.kind);
  const identityFields = visibleFieldNames.filter((item) =>
    ["handle", "name", "description", "author", "version"].includes(item),
  );
  const detailFields = visibleFieldNames.filter(
    (item) => !identityFields.includes(item),
  );
  const childKinds = resolvedContext?.childKinds ?? [];
  const structuredAnalysis = service.analyze(files);
  const symbols = structuredAnalysis.symbols;
  const allConditionProperties = conditionPropertyCatalog(
    structuredAnalysis.parsed,
  );
  const jumpSymbol = symbols.find((candidate) => candidate.kind === "jump");
  const jumpField = (name: string) =>
    jumpSymbol ? readSourceField(files[jumpSymbol.file], jumpSymbol, name) : "";
  const owningControl = symbols
    .filter(
      (candidate) =>
        candidate.file === symbol.file &&
        candidate.from < symbol.from &&
        candidate.to >= symbol.to &&
        ["choice", "input"].includes(candidate.kind),
    )
    .sort((left, right) => right.depth - left.depth)[0];
  const ownerSelection = owningControl
    ? readSourceField(files[owningControl.file], owningControl, "selection")
    : "";
  const directGrants =
    symbol.kind === "choice"
      ? readSourceFields(files[symbol.file], symbol, "grant")
      : [];
  const integerVisibleGrant =
    (symbol.kind === "grant" &&
      ownerSelection === "integer" &&
      ["perk", "item", "trait"].includes(field("kind"))) ||
    (symbol.kind === "choice" &&
      field("selection") === "integer" &&
      directGrants.length === 1 &&
      ["perk", "item"].includes(directGrants[0]));
  const conditionEntry = conditionNodeEntries(structuredAnalysis.parsed).find(
    ({ node }) =>
      node.kind === symbol.kind &&
      node.range.file === symbol.file &&
      node.range.from === symbol.from,
  );
  const contextualConditionHandles = conditionEntry
    ? conditionContextHandles(conditionEntry.node, conditionEntry.parent)
    : [];
  const conditionProperties = allConditionProperties.filter(
    (property) =>
      property.category !== "context" ||
      contextualConditionHandles.some((handle) => handle === property.handle),
  );
  const renderField = (fieldName: string) => {
    const definition =
      resolvedContext?.fields[fieldName] ??
      fieldDefinition(symbol.kind, fieldName);
    const defaultValue = fieldDefault(symbol.kind, fieldName, {
      gauntlet: field("gauntlet"),
      selection: field("selection"),
      grantKind: field("kind"),
      integerVisibleGrant: String(integerVisibleGrant),
      sectionLayout: jumpField("section-layout"),
      choiceLayout: jumpField("choice-layout"),
      traitLayout: jumpField("trait-layout"),
    });
    const shadowText = defaultShadowText(defaultValue);
    const referenceKind = definition?.type?.startsWith("handleReference:")
      ? definition.type.slice("handleReference:".length)
      : null;
    const referenceSymbolKinds: Readonly<Record<string, readonly string[]>> = {
      form: ["grant"],
      companionTarget: ["grant"],
      "owner-local-content": ["text", "image", "input"],
      "choice-placement": ["choice"],
    };
    const referenceOptions = [
      ...(referenceKind === "resource" ? ["jump_points"] : []),
      ...(referenceKind
        ? symbols
            .filter((candidate) =>
              (referenceSymbolKinds[referenceKind] ?? [referenceKind]).includes(
                candidate.kind,
              ),
            )
            .filter((candidate) => {
              if (referenceKind === "form")
                return (
                  readSourceField(files[candidate.file], candidate, "kind") ===
                  "form"
                );
              if (referenceKind === "companionTarget")
                return ["companion", "companion-import"].includes(
                  readSourceField(files[candidate.file], candidate, "kind"),
                );
              if (referenceKind === "choice-placement")
                return candidate.depth > 0;
              return true;
            })
            .flatMap((candidate) =>
              candidate.handle ? [candidate.handle] : [],
            )
        : []),
      ...(definition?.type === "quotedString:assetRelativePath" ? assets : []),
      ...(["costAmount", "grantAmount"].includes(definition?.type ?? "")
        ? fieldValues(definition)
        : []),
    ].filter((option, index, options) => options.indexOf(option) === index);
    const enumValues = fieldValues(definition);
    const colorChoices =
      definition?.type === "color" ? editorColorChoices(files, symbols) : [];
    const listId =
      `editor-${symbol.file}-${symbol.from}-${fieldName}`.replaceAll(
        /[^a-zA-Z0-9_-]/g,
        "-",
      );
    const values = readSourceFields(files[symbol.file], symbol, fieldName);
    const variants = readConditionalSourceFieldGroups(
      files[symbol.file],
      symbol,
      fieldName,
    );
    const displayed = values.length ? values : [""];
    return (
      <div
        className={`editor-schema-field${["description", "content", "author", "option", "tag", "group"].includes(fieldName) ? " is-wide" : ""}`}
        key={fieldName}
      >
        {displayed.map((value, occurrence) =>
          (() => {
            const selectControl = createSelectControlModel(
              value,
              defaultValue,
              enumValues,
            );
            const matchingDiagnostics = diagnostics.filter(
              (diagnostic) =>
                diagnostic.target?.file === symbol.file &&
                diagnostic.target.declarationFrom === symbol.from &&
                diagnostic.target.field === fieldName &&
                diagnostic.target.part !== "condition" &&
                (diagnostic.target.occurrence ?? 0) === occurrence,
            );
            const fieldSeverity = (["error", "warning", "info"] as const).find(
              (severity) =>
                matchingDiagnostics.some(
                  (diagnostic) => diagnostic.severity === severity,
                ),
            );
            const diagnosticId = matchingDiagnostics.length
              ? `${listId}-${occurrence}-diagnostics`
              : undefined;
            const accessibility = {
              "aria-invalid": matchingDiagnostics.length ? true : undefined,
              "aria-describedby": diagnosticId,
            } as const;
            return (
              <div
                className={`editor-field-occurrence${fieldSeverity ? ` is-${fieldSeverity}` : ""}`}
                key={`${fieldName}:${occurrence}`}
              >
                <span>
                  {fieldName.replaceAll("-", " ")}
                  {definition?.required && (
                    <small>
                      {translate("ui.editorWorkspace.text.required")}
                    </small>
                  )}
                </span>
                <span className="editor-schema-field-control">
                  {definition?.type === "boolean" ? (
                    <>
                      <input
                        type="checkbox"
                        autoFocus={fieldName === focusField && occurrence === 0}
                        aria-label={`${fieldName}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                        checked={value === "true"}
                        {...accessibility}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          const matchesDefault =
                            defaultValue?.kind === "value" &&
                            defaultValue.value === checked;
                          onUpdate(
                            symbol,
                            fieldName,
                            matchesDefault ? "" : String(checked),
                            occurrence,
                          );
                        }}
                        onBlur={onEndFieldEdit}
                      />
                      {value === "" && shadowText && (
                        <small className="editor-field-default">
                          {shadowText}
                        </small>
                      )}
                    </>
                  ) : ["color", "hexColor"].includes(definition?.type ?? "") ? (
                    <ColorFieldControl
                      label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      choices={colorChoices}
                      allowTokens={definition?.type === "color"}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={diagnosticId}
                      onChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
                      onBlur={onEndFieldEdit}
                    />
                  ) : definition?.type === "quotedString:assetRelativePath" ? (
                    <select
                      autoFocus={fieldName === focusField && occurrence === 0}
                      aria-label={`${fieldName}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      {...accessibility}
                      onChange={(event) =>
                        onUpdate(
                          symbol,
                          fieldName,
                          event.target.value,
                          occurrence,
                        )
                      }
                      onBlur={onEndFieldEdit}
                    >
                      <option value="">
                        {translate("ui.editorWorkspace.text.notSet")}
                      </option>
                      {value && !referenceOptions.includes(value) && (
                        <option value={value}>
                          {translate("ui.editorWorkspace.asset.missingOption", {
                            asset: value,
                          })}
                        </option>
                      )}
                      {referenceOptions.map((option) => (
                        <option value={option} key={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : definition?.type === "imageDimension" ? (
                    <ImageDimensionFieldControl
                      label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      tokens={enumValues}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={diagnosticId}
                      onChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
                      onBlur={onEndFieldEdit}
                    />
                  ) : enumValues.length > 0 &&
                    [
                      "enum",
                      "spacing",
                      "size",
                      "align",
                      "justify",
                      "textAlign",
                    ].includes(definition?.type ?? "") ? (
                    <select
                      autoFocus={fieldName === focusField && occurrence === 0}
                      aria-label={`${fieldName}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={selectControl.value}
                      {...accessibility}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        onUpdate(
                          symbol,
                          fieldName,
                          selectControl.authoredValue(nextValue),
                          occurrence,
                        );
                      }}
                      onBlur={onEndFieldEdit}
                    >
                      {!definition?.required && selectControl.showNotSet && (
                        <option value="">
                          {translate("ui.editorWorkspace.text.notSet")}
                        </option>
                      )}
                      {selectControl.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : ["description", "content"].includes(fieldName) ||
                    definition?.type === "richText" ? (
                    <textarea
                      autoFocus={fieldName === focusField && occurrence === 0}
                      spellCheck
                      aria-label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      rows={fieldName === "content" ? 6 : 3}
                      value={value}
                      {...accessibility}
                      onChange={(event) =>
                        onUpdate(
                          symbol,
                          fieldName,
                          event.target.value,
                          occurrence,
                        )
                      }
                      onBlur={onEndFieldEdit}
                    />
                  ) : definition?.type === "integer" ||
                    definition?.type === "number" ? (
                    <span className="number-stepper editor-number-stepper is-fluid">
                      <input
                        autoFocus={fieldName === focusField && occurrence === 0}
                        aria-label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                        type="number"
                        min={
                          typeof definition.const === "number"
                            ? definition.const
                            : undefined
                        }
                        max={
                          typeof definition.const === "number"
                            ? definition.const
                            : undefined
                        }
                        placeholder={value === "" ? shadowText : undefined}
                        value={value}
                        {...accessibility}
                        onChange={(event) =>
                          onUpdate(
                            symbol,
                            fieldName,
                            event.target.value,
                            occurrence,
                          )
                        }
                        onBlur={onEndFieldEdit}
                      />
                      <NumberStepperButtons
                        label={fieldName.replaceAll("-", " ")}
                        increaseDisabled={
                          typeof definition.const === "number" &&
                          value !== "" &&
                          Number(value) >= definition.const
                        }
                        decreaseDisabled={
                          typeof definition.const === "number" &&
                          value !== "" &&
                          Number(value) <= definition.const
                        }
                        onIncrease={() => {
                          const parsed = Number(value);
                          const next =
                            typeof definition.const === "number"
                              ? definition.const
                              : (Number.isFinite(parsed) ? parsed : -1) + 1;
                          onUpdate(symbol, fieldName, String(next), occurrence);
                        }}
                        onDecrease={() => {
                          const parsed = Number(value);
                          const next =
                            typeof definition.const === "number"
                              ? definition.const
                              : (Number.isFinite(parsed) ? parsed : 1) - 1;
                          onUpdate(symbol, fieldName, String(next), occurrence);
                        }}
                      />
                    </span>
                  ) : (
                    <input
                      autoFocus={fieldName === focusField && occurrence === 0}
                      aria-label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      type="text"
                      spellCheck={[
                        "author",
                        "description",
                        "name",
                        "title",
                      ].includes(fieldName)}
                      value={value}
                      {...accessibility}
                      placeholder={value === "" ? shadowText : undefined}
                      list={referenceOptions.length ? listId : undefined}
                      onChange={(event) =>
                        onUpdate(
                          symbol,
                          fieldName,
                          event.target.value,
                          occurrence,
                        )
                      }
                      onBlur={onEndFieldEdit}
                    />
                  )}
                  {fieldName === "resource" &&
                    ["cost", "grant"].includes(symbol.kind) && (
                      <button
                        type="button"
                        onClick={() => onCreateResource(symbol)}
                      >
                        {translate(
                          "ui.editorWorkspace.text.createResourceEllipsis",
                        )}
                      </button>
                    )}
                  {definition?.repeatable && values.length > 0 && (
                    <button
                      type="button"
                      aria-label={`Remove ${fieldName} ${occurrence + 1}`}
                      onClick={() =>
                        onUpdate(symbol, fieldName, "", occurrence)
                      }
                    >
                      ×
                    </button>
                  )}
                </span>
                {matchingDiagnostics.length > 0 && (
                  <span className="editor-field-diagnostics" id={diagnosticId}>
                    {matchingDiagnostics.map((diagnostic, diagnosticIndex) => (
                      <small
                        className={`is-${diagnostic.severity}`}
                        key={`${diagnostic.code}:${diagnosticIndex}`}
                      >
                        {translateDiagnostic(diagnostic)}
                      </small>
                    ))}
                  </span>
                )}
                {referenceOptions.length > 0 && (
                  <datalist id={listId}>
                    {referenceOptions.map((option) => (
                      <option value={option} key={option} />
                    ))}
                  </datalist>
                )}
              </div>
            );
          })(),
        )}
        {definition?.repeatable && (
          <button type="button" onClick={() => onAddField(symbol, fieldName)}>
            {translate("ui.editorWorkspace.text.addPrefix")}
            {fieldName.replaceAll("-", " ")}
          </button>
        )}
        {definition?.conditionalVariants && (
          <>
            {(definition.repeatable
              ? displayed.map((_, occurrence) => occurrence)
              : [0]
            ).map((baseOccurrence) => (
              <div
                className="editor-conditional-variant-group"
                key={`${fieldName}:base:${baseOccurrence}`}
              >
                {definition.repeatable && (
                  <strong>
                    {translate(
                      "ui.editorWorkspace.text.variantsForOccurrence",
                      {
                        field: fieldName.replaceAll("-", " "),
                        occurrence: baseOccurrence + 1,
                      },
                    )}
                  </strong>
                )}
                <ConditionalVariants
                  fieldName={fieldName}
                  baseOccurrence={baseOccurrence}
                  variants={variants}
                  fieldType={definition.type}
                  properties={conditionProperties}
                  diagnostics={diagnostics.filter(
                    (diagnostic) =>
                      diagnostic.target?.file === symbol.file &&
                      diagnostic.target.declarationFrom === symbol.from,
                  )}
                  onUpdate={(occurrence, condition, value, associatedBase) =>
                    onUpdateVariant(
                      symbol,
                      fieldName,
                      occurrence,
                      condition,
                      value,
                      associatedBase,
                    )
                  }
                  onMove={(occurrence, direction) =>
                    onMoveVariant(symbol, fieldName, occurrence, direction)
                  }
                  onEndFieldEdit={onEndFieldEdit}
                />
              </div>
            ))}
          </>
        )}
      </div>
    );
  };
  const authoredFieldNames = resolvedContext?.node.fields.map(
    (candidate) => candidate.name,
  );
  const collapseValue =
    symbol.kind === "cost" &&
    !scalarForm &&
    field("resource") === "jump_points" &&
    ["", "flat"].includes(field("mode")) &&
    (authoredFieldNames ?? []).every((item) =>
      ["resource", "amount", "mode"].includes(item),
    )
      ? field("amount")
      : symbol.kind === "grant" &&
          !scalarForm &&
          ["perk", "item", "companion"].includes(field("kind")) &&
          authoredFieldNames?.every((item) => item === "kind") &&
          !resolvedContext?.children.length
        ? field("kind")
        : "";
  return (
    <div className="editor-structured-scroll">
      <header className="editor-structured-heading">
        <p>{symbol.kind.replaceAll("-", " ")}</p>
        <h2>{name}</h2>
        <code>
          {symbol.file}:{sourceLine(files[symbol.file], symbol.from)}
        </code>
      </header>
      <nav
        className="editor-breadcrumbs"
        aria-label={translate(
          "ui.editorWorkspace.ariaLabel.declarationBreadcrumbs",
        )}
      >
        {returnTarget && (
          <>
            <button type="button" onClick={() => onOpenSymbol(returnTarget)}>
              {translate("ui.editorWorkspace.text.backToDeclaration", {
                declaration: explorerSymbolLabel(returnTarget),
              })}
            </button>
            <BreadcrumbSeparator />
          </>
        )}
        <button type="button" onClick={onOpenPackage}>
          {translate("ui.editorWorkspace.text.package")}
        </button>
        {resolvedContext?.ancestors
          .filter((ancestor) => ancestor.kind !== "jump")
          .map((ancestor) => (
            <Fragment key={`${ancestor.file}:${ancestor.from}`}>
              <BreadcrumbSeparator />
              <button type="button" onClick={() => onOpenSymbol(ancestor)}>
                {explorerSymbolLabel(ancestor)}
              </button>
            </Fragment>
          ))}
        <BreadcrumbSeparator />
        <span>{symbol.kind.replaceAll("-", " ")}</span>
        {handle && (
          <>
            <BreadcrumbSeparator />
            <strong>{handle}</strong>
          </>
        )}
      </nav>
      {identityFields.length > 0 && (
        <section className="editor-form-card">
          <h3>{translate("ui.editorWorkspace.text.identity")}</h3>
          {identityFields.map(renderField)}
        </section>
      )}
      {scalarForm && ["cost", "grant"].includes(symbol.kind) && (
        <section className="editor-form-card">
          <h3>{translate("ui.editorWorkspace.text.scalarShorthand")}</h3>
          <label className="editor-schema-field is-wide">
            {translate("ui.editorWorkspace.text.valuePrefix")}
            <input
              spellCheck={false}
              value={scalarForm[1]}
              onChange={(event) =>
                onReplace(symbol, `${symbol.kind}: ${event.target.value}`, true)
              }
              onBlur={onEndFieldEdit}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onReplace(
                symbol,
                symbol.kind === "cost"
                  ? `cost\n  resource: jump_points\n  amount: ${scalarForm[1]}\n  mode: flat`
                  : `grant\n  kind: perk\n  name: ${scalarForm[1]}`,
              )
            }
          >
            {translate("ui.editorWorkspace.text.expandToFields")}
          </button>
        </section>
      )}
      {isLayout ? (
        <LayoutTreeEditor
          assets={assets}
          diagnostics={diagnostics}
          files={files}
          layout={symbol}
          symbols={symbols}
          onApply={onLayoutEdit}
          onEndFieldEdit={onEndFieldEdit}
          inspectionRef={layoutInspectionRef}
          activeContainerPath={activeLayoutContainerPath}
          selectionKey={activeLayoutSelectionKey}
          onActiveContainerChange={onActiveLayoutContainerChange}
        />
      ) : (
        detailFields.length > 0 &&
        !scalarForm && (
          <section className="editor-form-card">
            <h3>{translate("ui.editorWorkspace.text.fieldsAndBehavior")}</h3>
            <div className="editor-form-grid">
              {detailFields.map(renderField)}
            </div>
            {collapseValue && (
              <button
                type="button"
                onClick={() =>
                  onReplace(symbol, `${symbol.kind}: ${collapseValue}`)
                }
              >
                {translate("ui.editorWorkspace.text.collapseToShorthand")}
              </button>
            )}
          </section>
        )
      )}
      {!isLayout &&
        (childKinds.length > 0 ||
          Boolean(resolvedContext?.children.length)) && (
          <section className="editor-form-card">
            <h3>
              {translate("ui.editorWorkspace.text.contentAndDeclarations")}
            </h3>
            <p>
              {translate(
                "ui.editorWorkspace.text.addADeclarationValidInsideThis",
              )}
              {symbol.kind}.
            </p>
            {Boolean(resolvedContext?.children.length) && (
              <div className="editor-child-list">
                {resolvedContext?.children.map((child, index, allChildren) => (
                  <div key={`${child.file}:${child.from}`}>
                    <button type="button" onClick={() => onOpenSymbol(child)}>
                      <span>{symbolLabel(child)}</span>
                      <small>{child.kind.replaceAll("-", " ")}</small>
                    </button>
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.moveDeclarationUp",
                        { declaration: symbolLabel(child) },
                      )}
                      onClick={() => onMoveChild(symbol, child, "up")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === allChildren.length - 1}
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.moveDeclarationDown",
                        { declaration: symbolLabel(child) },
                      )}
                      onClick={() => onMoveChild(symbol, child, "down")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.removeDeclaration",
                        { declaration: symbolLabel(child) },
                      )}
                      onClick={() => onRemoveChild(symbol, child)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="editor-contextual-add">
              {childKinds.map((kind) => (
                <button
                  type="button"
                  key={kind}
                  onClick={() => onInsertChild(symbol, kind)}
                >
                  +{" "}
                  {kind === "choice" && symbol.kind === "section"
                    ? translate("ui.editorWorkspace.declaration.directChoice")
                    : translate(`ui.editorWorkspace.declaration.${kind}`)}
                </button>
              ))}
            </div>
          </section>
        )}
      {Boolean(resolvedContext?.invalidAuthoredFields.length) && (
        <section className="editor-form-card editor-needs-attention">
          <h3>{translate("ui.editorWorkspace.text.needsAttention")}</h3>
          <p>{translate("ui.editorWorkspace.text.fieldsInvalidInContext")}</p>
          <div className="editor-form-grid">
            {resolvedContext?.invalidAuthoredFields.map((fieldName) => (
              <div className="editor-invalid-field" key={fieldName}>
                {renderField(fieldName)}
                <button
                  type="button"
                  onClick={() => onRemoveInvalidField(symbol, fieldName)}
                >
                  {translate("ui.editorWorkspace.text.removeInvalidField")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SourcePalette({
  title,
  symbol,
  files,
  source,
  onClose,
  onAdd,
  onAddChild,
  onQuickFix,
  quickFixAvailable,
  keybindings,
  shortcutLabels,
  onCompletion,
}: {
  title: string;
  symbol: FormatSymbol | null;
  files: Readonly<Record<string, string>>;
  source: string;
  onClose: () => void;
  onAdd: (field: string) => void;
  onAddChild: (kind: string) => void;
  onQuickFix: () => void;
  quickFixAvailable: boolean;
  keybindings: Record<KeybindingAction, KeybindingChord>;
  shortcutLabels: Record<KeybindingAction, string>;
  onCompletion: () => void;
}) {
  const context = symbol ? structuredContext(files, symbol) : null;
  const completions = useMemo(
    () =>
      (symbol
        ? (context?.visibleFields ?? declarationFieldNames(symbol.kind)).filter(
            (field) =>
              quickAddFieldMode(
                source,
                symbol,
                field,
                context?.fields[field],
              ) !== null,
          )
        : service.completions("jump").fields
      ).slice(0, 8),
    [context, source, symbol],
  );
  const childCompletions = useMemo(
    () => (symbol ? (context?.childKinds ?? []).slice(0, 8) : []),
    [context, symbol],
  );
  const validItems = useMemo(
    () => [
      ...completions.map((label) => ({
        id: `field:${label}`,
        label,
        description:
          symbol &&
          quickAddFieldMode(source, symbol, label, context?.fields[label]) ===
            "complete"
            ? translate("ui.editorWorkspace.text.completeExistingFieldIn", {
                title,
              })
            : translate("ui.editorWorkspace.text.addToDeclaration", { title }),
        action: () => onAdd(label),
      })),
      ...childCompletions.map((label) => ({
        id: `child:${label}`,
        label,
        description: translate("ui.editorWorkspace.text.insertInside", {
          title,
        }),
        action: () => onAddChild(label),
      })),
    ],
    [
      childCompletions,
      completions,
      context,
      onAdd,
      onAddChild,
      source,
      symbol,
      title,
    ],
  );
  const mnemonics = useMemo(
    () =>
      assignQuickAddMnemonics(
        validItems.map((item) => item.label),
        keybindingActions.flatMap((action) => {
          const chord = keybindings[action];
          return chord.primary &&
            !chord.alt &&
            !chord.shift &&
            /^[a-z]$/i.test(chord.key)
            ? [chord.key]
            : [];
        }),
      ),
    [keybindings, validItems],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (matchesKeybinding(event, keybindings.quickAdd)) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey)
        return;
      const itemIndex = mnemonics.findIndex(
        (item) => item.key === event.key.toLocaleLowerCase(),
      );
      if (itemIndex < 0) return;
      event.preventDefault();
      event.stopPropagation();
      validItems[itemIndex].action();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [keybindings.quickAdd, mnemonics, onClose, validItems]);

  return (
    <aside
      className="editor-source-palette"
      aria-label={translate("ui.editorWorkspace.ariaLabel.quickAdd")}
    >
      <header>
        <span>
          <strong>{translate("ui.editorWorkspace.text.quickAddAction")}</strong>
          <small>{title}</small>
        </span>
        <button
          type="button"
          aria-label={translate("ui.editorWorkspace.ariaLabel.closeQuickAdd")}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p>{translate("ui.editorWorkspace.text.validHere")}</p>
      {validItems.map((item, index) => {
        const mnemonic = mnemonics[index];
        return (
          <button type="button" key={item.id} onClick={item.action}>
            <span>
              <code>
                {mnemonic.index < 0 ? (
                  item.label
                ) : (
                  <>
                    {item.label.slice(0, mnemonic.index)}
                    <u className="editor-quick-add-mnemonic">
                      {item.label[mnemonic.index]}
                    </u>
                    {item.label.slice(mnemonic.index + 1)}
                  </>
                )}
              </code>
              <small>{item.description}</small>
            </span>
            {mnemonic.key && <kbd>⌘ {mnemonic.key.toLocaleUpperCase()}</kbd>}
          </button>
        );
      })}
      {!completions.length && !childCompletions.length && (
        <small>
          {translate(
            "ui.editorWorkspace.text.noAdditionalDeclarationsAreValidHere",
          )}
        </small>
      )}
      <p>{translate("ui.editorWorkspace.text.commands")}</p>
      <button
        type="button"
        onClick={onQuickFix}
        disabled={!quickFixAvailable}
        title={
          quickFixAvailable
            ? "Apply the deterministic repair"
            : "No deterministic repair is available"
        }
      >
        <span>
          {translate("ui.editorWorkspace.text.quickFix")}
          <small>
            {translate("ui.editorWorkspace.text.writeADeterministicRepair")}
          </small>
        </span>
        <kbd>{shortcutLabels.quickFix}</kbd>
      </button>
      <button type="button" onClick={onCompletion}>
        <span>
          {translate("ui.editorWorkspace.text.allCompletions")}
          <small>
            {translate("ui.editorWorkspace.text.showFieldsValuesAndHandles")}
          </small>
        </span>
        <kbd>{shortcutLabels.completions}</kbd>
      </button>
    </aside>
  );
}

function AssetStructuredPanel({
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

function TrashSourcePanel({ entry }: { entry: EditorTrashEntry }) {
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
        <AssetImage path={path} bytes={bytes} className="editor-asset-image" />
      </div>
      <div className="editor-source-status is-valid">
        <span>{translate("ui.editorWorkspace.asset.readOnlyBinary")}</span>
      </div>
    </div>
  );
}

function AssetContextPreview({
  path,
  bytes,
}: {
  path: string;
  bytes: Uint8Array;
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
        <AssetImage path={path} bytes={bytes} className="editor-asset-image" />
      </div>
    </div>
  );
}

function TrashContextPanel({
  entry,
  tab,
}: {
  entry: EditorTrashEntry;
  tab: ContextTab;
}) {
  if (tab === "preview" && entry.kind === "asset")
    return (
      <AssetContextPreview path={entry.originalPath} bytes={entry.bytes} />
    );
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

function PropertiesPanel({
  summary,
  symbol,
  symbolLine,
  symbolOwner,
  asset,
  assetMetadata,
  assetReferenceCount,
  selectedFile,
  selectedFileBytes,
  selectedFileDiagnosticCount,
}: {
  summary: ReturnType<typeof summarizeWorkspace>;
  symbol: FormatSymbol | null;
  symbolLine?: number;
  symbolOwner?: FormatSymbol;
  asset: string | null;
  assetMetadata?: PackageAssetMetadata;
  assetReferenceCount: number;
  selectedFile: string | null;
  selectedFileBytes?: number;
  selectedFileDiagnosticCount?: number;
}) {
  const title = asset
    ? assetBasename(asset)
    : selectedFile
      ? selectedFile
      : symbol
        ? symbolLabel(symbol)
        : summary.name;
  return (
    <div className="editor-properties-panel">
      <p>{translate("ui.editorWorkspace.text.selection")}</p>
      <h2>{title}</h2>
      <dl>
        {asset ? (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
              <dd>{translate("ui.editorWorkspace.asset.assetFile")}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.asset.folder")}</dt>
              <dd>
                {assetFolder(asset) ||
                  translate("ui.editorWorkspace.asset.rootFolder")}
              </dd>
            </div>
            {assetMetadata && (
              <>
                <div>
                  <dt>{translate("ui.editorWorkspace.asset.format")}</dt>
                  <dd>{assetMetadata.format}</dd>
                </div>
                <div>
                  <dt>{translate("ui.editorWorkspace.asset.dimensions")}</dt>
                  <dd>
                    {assetMetadata.width} × {assetMetadata.height}
                  </dd>
                </div>
                <div>
                  <dt>{translate("ui.editorWorkspace.text.size")}</dt>
                  <dd>
                    {assetMetadata.bytes}
                    {translate("ui.editorWorkspace.text.bytes")}
                  </dd>
                </div>
                {assetHeaderProperties(assetMetadata.header).map((property) => (
                  <div key={property.key}>
                    <dt>{property.label}</dt>
                    <dd>{property.value}</dd>
                  </div>
                ))}
              </>
            )}
            <div>
              <dt>{translate("ui.editorWorkspace.asset.references")}</dt>
              <dd>{assetReferenceCount}</dd>
            </div>
          </>
        ) : selectedFile ? (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
              <dd>{translate("ui.editorWorkspace.asset.definitionFile")}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.size")}</dt>
              <dd>
                {selectedFileBytes ?? 0}
                {translate("ui.editorWorkspace.text.bytes")}
              </dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.diagnostics")}</dt>
              <dd>{selectedFileDiagnosticCount ?? 0}</dd>
            </div>
          </>
        ) : symbol && symbol.kind !== "jump" ? (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
              <dd>{symbol.kind.replaceAll("-", " ")}</dd>
            </div>
            {symbol.handle && (
              <div>
                <dt>{translate("ui.editorWorkspace.field.handle")}</dt>
                <dd>{symbol.handle}</dd>
              </div>
            )}
            {symbolOwner && (
              <div>
                <dt>{translate("ui.editorWorkspace.asset.owner")}</dt>
                <dd>{symbolLabel(symbolOwner)}</dd>
              </div>
            )}
            <div>
              <dt>{translate("ui.editorWorkspace.asset.sourceLocation")}</dt>
              <dd>
                {symbol.file}:{symbolLine ?? 1}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.version")}</dt>
              <dd>{summary.version}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.authors")}</dt>
              <dd>{summary.authors.join(", ")}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.sections")}</dt>
              <dd>{summary.sectionCount}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.choices")}</dt>
              <dd>{summary.choiceCount}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.gauntlet")}</dt>
              <dd>
                {summary.nativeGauntlet
                  ? translate("ui.editorWorkspace.asset.native")
                  : translate("ui.editorWorkspace.asset.no")}
              </dd>
            </div>
          </>
        )}
      </dl>
      <p className="editor-property-note">
        {translate("ui.editorWorkspace.asset.propertiesReadOnly")}
      </p>
    </div>
  );
}

function formatHeaderNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function assetHeaderProperties(header: ImageHeaderMetadata) {
  const properties: { key: string; label: string; value: string }[] = [];
  const add = (key: string, value: string | undefined) => {
    if (value)
      properties.push({
        key,
        label: translate(`ui.editorWorkspace.asset.header.${key}`),
        value,
      });
  };
  add(
    "colorModel",
    header.colorModel
      ? translate(
          `ui.editorWorkspace.asset.header.colorModelValue.${header.colorModel}`,
        )
      : undefined,
  );
  add(
    "bitDepth",
    header.bitDepth
      ? translate("ui.editorWorkspace.asset.header.bits", {
          count: header.bitDepth,
        })
      : undefined,
  );
  add(
    "colorResolution",
    header.colorResolution
      ? translate("ui.editorWorkspace.asset.header.bits", {
          count: header.colorResolution,
        })
      : undefined,
  );
  add(
    "encoding",
    header.encoding
      ? translate(
          `ui.editorWorkspace.asset.header.encodingValue.${header.encoding}`,
        )
      : undefined,
  );
  add(
    "interlaced",
    header.interlaced === undefined
      ? undefined
      : translate(
          `ui.editorWorkspace.asset.header.boolean.${header.interlaced ? "yes" : "no"}`,
        ),
  );
  add(
    "alpha",
    header.alpha === undefined
      ? undefined
      : translate(
          `ui.editorWorkspace.asset.header.boolean.${header.alpha ? "yes" : "no"}`,
        ),
  );
  add(
    "animated",
    header.animated === undefined
      ? undefined
      : translate(
          `ui.editorWorkspace.asset.header.boolean.${header.animated ? "yes" : "no"}`,
        ),
  );
  add(
    "colorProfile",
    header.colorProfile
      ? translate(
          `ui.editorWorkspace.asset.header.colorProfileValue.${header.colorProfile}`,
        )
      : undefined,
  );
  add(
    "pixelDensity",
    header.densityX && header.densityY && header.densityUnit
      ? translate("ui.editorWorkspace.asset.header.pixelDensityValue", {
          x: formatHeaderNumber(header.densityX),
          y: formatHeaderNumber(header.densityY),
          unit: header.densityUnit,
        })
      : undefined,
  );
  add(
    "orientation",
    header.orientation
      ? translate(
          `ui.editorWorkspace.asset.header.orientationValue.${header.orientation}`,
        )
      : undefined,
  );
  add("version", header.version);
  add(
    "palette",
    header.paletteColors
      ? translate("ui.editorWorkspace.asset.header.paletteValue", {
          count: header.paletteColors,
        })
      : undefined,
  );
  return properties;
}
