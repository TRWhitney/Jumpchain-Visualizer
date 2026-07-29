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
  type KeyboardEvent as ReactKeyboardEvent,
  type KeyboardEventHandler,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import {
  Chevron,
  DisclosureSection,
  useContextMenu,
  useSettingDefaultedState,
  type ContextMenuAction,
} from "../ui";
import {
  conditionControlProperties,
  conditionContextHandles,
  conditionNodeEntries,
  conditionPropertyCatalog,
  layoutNodeUsesControlAlignment,
  packageIsValid,
  type ConditionPropertyDescriptor,
  type DiagnosticTarget,
  type PackageDiagnostic,
} from "../markup";
import {
  inspectPackageAsset,
  validatePackageAsset,
  type ImageHeaderMetadata,
  type PackageAssetMetadata,
} from "../archive";
import { NumberStepperButtons } from "../tracker/NumberStepper";
import { inheritedAppearanceValue } from "../tracker/jumpAppearance";
import type { TagDefinition } from "../tracker/model";
import { CanonicalTrackerTagBadge } from "../settings/TagBadge";
import { primaryTagIds } from "../settings/builtinTags";
import { normalizeTag } from "../settings/tagProfile";
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
import { layoutPreviewAcceptsChoiceLayout } from "./layoutPreview";
import { FreeTextSuggestionCombobox } from "./FreeTextSuggestionCombobox";
import { HandleFieldControl } from "./HandleFieldControl";
import { SetFieldControl } from "./SetFieldControl";
import { SpellingTextArea, SpellingTextInput } from "./SpellingTextControl";
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
import { insertJumpAppearanceSource } from "./appearanceSource";
import {
  addDocumentField,
  createAndAssignDocumentResource,
  createAndAssignTopLevelDocumentReference,
  createTopLevelDocumentDeclaration,
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
  type CreatableTopLevelDeclarationKind,
} from "./documentEditor";
import {
  collapseLayoutLeaf,
  convertLayoutNode,
  createLayoutEditorTree,
  expandLayoutLeaf,
  insertLayoutChild,
  insertLayoutRoot,
  layoutAllowedNodeKinds,
  layoutContentTargetHandles,
  layoutNodeForPath,
  layoutNodeHasEditableFields,
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
import { ConditionalVariants, InsertValueControl } from "./ConditionalVariants";
import {
  editorDeclarationLabel,
  editorFieldPresentation,
  editorLayoutFieldPresentation,
  editorLayoutNodePresentation,
  editorOptionPresentation,
  editorSectionLabel,
} from "./editorPresentation";
import { useAssetObjectUrl } from "../tracker/useAssetObjectUrls";
import { ConfirmationDialog } from "../ui";
import type { AppearanceColorInspection } from "./appearanceInspection";
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
  handleCanPropagate,
  renameDocumentHandleReferences,
} from "./handleReferences";
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
import type { WelcomeTourStepId } from "../tour/model";

type SaveState = "saved" | "saving" | "unsaved" | "failed";
type NavigationTab = "content" | "files";
type EditingTab = "structured" | "source";
type ContextTab = "preview" | "properties";
type Severity = PackageDiagnostic["severity"];
type WorkspaceHistoryState = AssetWorkspaceHistoryState;
type StructuredDisclosureState = Readonly<Record<string, boolean>>;

const emptyStructuredDisclosureState: StructuredDisclosureState = {};

function structuredDisclosureOwnerKey(
  symbol: FormatSymbol,
  files: Readonly<Record<string, string>>,
  symbols: readonly FormatSymbol[],
) {
  const lineage = [
    ...(structuredContext(files, symbol)?.ancestors ?? []),
    symbol,
  ];
  return lineage
    .map((item, index) => {
      const siblings =
        index === 0
          ? symbols.filter((candidate) => candidate.depth === item.depth)
          : (structuredContext(files, lineage[index - 1])?.children ?? []);
      const occurrence = siblings
        .filter((candidate) => candidate.kind === item.kind)
        .findIndex(
          (candidate) =>
            candidate.file === item.file && candidate.from === item.from,
        );
      return occurrence < 0
        ? `${item.file}:${item.kind}:offset:${item.from}`
        : `${item.file}:${item.kind}:occurrence:${occurrence}`;
    })
    .join("/");
}

type AssetImportTarget = {
  symbol: FormatSymbol;
  field: string;
  occurrence: number;
};
type LayoutInspectionHandle = {
  inspect: (path: string, field?: string) => void;
};

type PendingHandleRename = {
  key: string;
  symbol: Pick<FormatSymbol, "file" | "from" | "kind">;
  expectedHandle: string;
  historyGroup: string;
  historyIndex: number;
};

const importAssetOptionValue = "__editor_import_asset__";

function revealEditorInspection(
  region: HTMLElement,
  block: ScrollLogicalPosition = "nearest",
) {
  region.classList.remove("is-editor-inspected");
  void region.offsetWidth;
  region.classList.add("is-editor-inspected");
  region.scrollIntoView({ block, inline: "nearest" });
}

function appearanceColorKindForField(
  field: string,
): AppearanceColorInspection["kind"] {
  if (field.includes("background")) return "background";
  if (field.includes("border")) return "border";
  if (field.includes("accent") || field.includes("indicator")) return "accent";
  return "text";
}

function diagnosticActivationKey(diagnostic: PackageDiagnostic) {
  return [
    diagnostic.code,
    diagnostic.messageKey ?? "",
    diagnostic.range?.file ?? "",
    diagnostic.range?.from ?? "",
    diagnostic.range?.to ?? "",
  ].join(":");
}

type ExplorerAddKind =
  | "jump appearance"
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
type PermanentRemovalTarget =
  | { kind: "trash"; id: string; label: string }
  | { kind: "symbol"; symbol: FormatSymbol; label: string }
  | { kind: "asset"; path: string; label: string };

const service = new Format1LanguageService();
let fallbackTrashId = 0;
const createTrashEntryId = () =>
  globalThis.crypto?.randomUUID?.() ?? `trash-${fallbackTrashId++}`;

function InterpolatedTextArea({
  label,
  value,
  rows,
  autoFocus,
  ariaInvalid,
  ariaDescribedBy,
  properties,
  showExplanatoryText,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  rows: number;
  autoFocus: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  properties: readonly ConditionPropertyDescriptor[];
  showExplanatoryText: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const control = useRef<HTMLTextAreaElement>(null);
  const insert = (handle: string) => {
    const start = control.current?.selectionStart ?? value.length;
    const end = control.current?.selectionEnd ?? start;
    const token = `{{${handle}}}`;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      control.current?.focus();
      const caret = start + token.length;
      control.current?.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="editor-interpolated-text">
      <span className="editor-rich-text-toolbar">
        <InsertValueControl
          properties={properties}
          showDescriptions={showExplanatoryText}
          onInsert={insert}
        />
      </span>
      <SpellingTextArea
        ref={control}
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        rows={rows}
        value={value}
        onSpellingChange={onChange}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

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

function AssetExplorerEntries({
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

function TrashExplorerEntries({
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
    headingKey: "resources",
    kinds: ["resource"],
    additions: ["resource"],
  },
  {
    id: "sections",
    headingKey: "sections",
    kinds: ["section"],
    additions: ["section"],
  },
  {
    id: "choices",
    headingKey: "choices",
    kinds: ["choice"],
    additions: ["choice"],
  },
  {
    id: "layouts",
    headingKey: "layouts",
    kinds: ["section-layout", "choice-layout", "trait-layout"],
    additions: ["section layout", "choice layout", "trait layout"],
  },
  {
    id: "themes",
    headingKey: "themes",
    kinds: ["theme"],
    additions: ["theme"],
  },
] as const;

const noviceCollapsedExplorerGroups = new Set([
  "content:resources",
  "content:layouts",
  "content:themes",
  "content:trash",
  "files:trash",
]);

const appearanceFieldGroups = [
  {
    key: "sharedColors",
    fields: ["background", "text-color", "border-color", "accent-color"],
  },
  {
    key: "surfaces",
    fields: ["surface-background", "surface-text", "surface-border"],
  },
  {
    key: "headerAndBudget",
    fields: [
      "header-background",
      "header-label",
      "header-title",
      "header-description",
      "header-border",
      "budget-background",
      "budget-label",
      "budget-value",
      "budget-border",
    ],
  },
  {
    key: "sections",
    fields: [
      "section-gutter",
      "section-background",
      "section-heading",
      "section-body",
      "section-border",
    ],
  },
  {
    key: "choicesAndGroups",
    fields: [
      "choice-background",
      "choice-heading",
      "choice-body",
      "choice-border",
      "group-background",
      "group-footer-background",
      "group-text",
      "group-border",
    ],
  },
  {
    key: "controls",
    fields: [
      "control-background",
      "control-text",
      "control-muted-text",
      "control-border",
      "control-indicator",
      "control-accent",
      "control-hover-background",
      "control-hover-text",
      "control-hover-border",
      "control-pressed-background",
      "control-pressed-text",
      "control-pressed-border",
      "control-selected-background",
      "control-selected-text",
      "control-selected-border",
      "control-disabled-background",
      "control-disabled-text",
      "control-disabled-border",
      "control-disabled-indicator",
    ],
  },
  {
    key: "costsAndSemanticStates",
    fields: [
      "cost-background",
      "cost-text",
      "cost-border",
      "cost-benefit-background",
      "cost-benefit-text",
      "cost-benefit-border",
      "cost-award-background",
      "cost-award-text",
      "cost-award-border",
      "cost-pending-background",
      "cost-pending-text",
      "cost-pending-border",
    ],
  },
  {
    key: "tooltips",
    fields: ["tooltip-background", "tooltip-text", "tooltip-border"],
  },
  {
    key: "shapeAndSpacing",
    fields: [
      "canvas-padding",
      "section-spacing",
      "section-padding",
      "corners",
      "control-corners",
      "cost-corners",
      "structural-border-width",
    ],
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
    return symbol.handle || editorDeclarationLabel(symbol.kind);
  return symbol.name || symbol.handle || editorDeclarationLabel(symbol.kind);
}

function explorerSymbolLabel(symbol: FormatSymbol) {
  return symbol.handle || editorDeclarationLabel(symbol.kind);
}

function indentDeclarationContinuation(declaration: string, depth: number) {
  const indentation = "  ".repeat(depth);
  return declaration.replaceAll("\n", `\n${indentation}`);
}

function layoutContentOwnerLabel(
  files: Readonly<Record<string, string>>,
  symbols: readonly FormatSymbol[],
  owner: FormatSymbol,
) {
  if (owner.kind !== "grant") return explorerSymbolLabel(owner);
  const ancestor = symbols
    .filter(
      (candidate) =>
        candidate.file === owner.file &&
        candidate.from < owner.from &&
        candidate.to >= owner.to &&
        ["choice", "input"].includes(candidate.kind),
    )
    .sort((left, right) => right.depth - left.depth)[0];
  const grantName = readSourceField(files[owner.file], owner, "name");
  return `${explorerSymbolLabel(ancestor ?? owner)} · ${grantName || translate("ui.editorWorkspace.text.traitGrant")}`;
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

const addDeclarationKinds = [
  "jump appearance",
  "resource",
  "section",
  "choice",
  "section layout",
  "choice layout",
  "trait layout",
  "theme",
] as const;

type AddDeclarationKind = (typeof addDeclarationKinds)[number];

export function EditorWorkspace({
  workspace,
  settings,
  tags,
  saveState,
  onChange,
  onSave,
  onExport,
  onFeedback,
  tour,
}: {
  workspace: EditorWorkspaceSnapshot;
  settings: ApplicationSettings;
  tags: Readonly<Record<string, TagDefinition>>;
  saveState: SaveState;
  onChange: (workspace: EditorWorkspaceSnapshot, continuous?: boolean) => void;
  onSave: () => void;
  onExport: () => void;
  onFeedback: (eventName: string) => void;
  tour?: {
    stepId: WelcomeTourStepId;
    advancedOpen: boolean;
    onAdvancedOpenChange: (open: boolean) => void;
    onNavigate: (
      destination: "details" | "section" | "files" | "appearance",
    ) => void;
  };
}) {
  const [navigationTab, setNavigationTab] = useState<NavigationTab>("content");
  const [editingTab, setEditingTab] = useState<EditingTab>("structured");
  const [contentEditingTab, setContentEditingTab] =
    useState<EditingTab>("structured");
  const [assetEditingTab, setAssetEditingTab] =
    useState<EditingTab>("structured");
  const [contextTab, setContextTab] = useState<ContextTab>("preview");
  const [advancedViewsOpen, setAdvancedViewsOpen, advancedViewsSettingChanged] =
    useSettingDefaultedState(
      settings.editor.collapseAdvancedViews,
      !settings.editor.collapseAdvancedViews,
    );
  const [previewInspectionToolsOpen, setPreviewInspectionToolsOpen] =
    useSettingDefaultedState(
      settings.editor.collapsePreviewInspectionTools,
      !settings.editor.collapsePreviewInspectionTools,
    );
  const [selected, setSelected] = useState<PreviewSelection>({
    kind: "package",
  });
  const [selectedSymbol, setSelectedSymbol] = useState<FormatSymbol | null>(
    null,
  );
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedTrashId, setSelectedTrashId] = useState<string | null>(null);
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const [collapseOptionalSectionsInitially] = useState(
    settings.general.collapseOptionalSectionsByDefault,
  );
  const [expandedExplorerGroups, setExpandedExplorerGroups] = useState<
    Record<string, boolean>
  >({});
  const [structuredDisclosureStates, setStructuredDisclosureStates] = useState<
    Record<string, StructuredDisclosureState>
  >({});
  const rememberStructuredDisclosure = useCallback(
    (owner: string, section: string, expanded: boolean) => {
      setStructuredDisclosureStates((current) => {
        const ownerState = current[owner] ?? emptyStructuredDisclosureState;
        if (ownerState[section] === expanded) return current;
        return {
          ...current,
          [owner]: {
            ...ownerState,
            [section]: expanded,
          },
        };
      });
    },
    [],
  );
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
  const [layoutPreviewChoiceLayouts, setLayoutPreviewChoiceLayouts] = useState<
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
  const [appearancePreviewMode, setAppearancePreviewMode] = useState<
    "components" | "jump"
  >("components");
  const [hoveredBound, setHoveredBound] = useState<LayoutBoundHover | null>(
    null,
  );
  const [hoveredAppearanceColor, setHoveredAppearanceColor] =
    useState<AppearanceColorInspection | null>(null);
  const layoutInspectionRef = useRef<LayoutInspectionHandle>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const preparedTourStepRef = useRef<string | null>(null);
  const advancedViewsButtonRef = useRef<HTMLButtonElement>(null);
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
  const commitFilesRef = useRef<
    (
      nextFiles: Record<string, string>,
      continuous?: boolean,
      preserveRedo?: boolean,
      historyGroup?: string,
    ) => boolean
  >(() => false);
  const handleReferenceLineageRef = useRef(new Map<string, string>());
  const [pendingHandleRename, setPendingHandleRename] =
    useState<PendingHandleRename | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const assetImportTargetRef = useRef<AssetImportTarget | null>(null);
  const diagnosticActivationRef = useRef<{
    key: string;
    index: number;
  } | null>(null);
  const [lastValid, setLastValid] = useState(
    () => service.analyze(workspace.files).packageItem,
  );
  const sourceRef = useRef<SourceCodeEditorHandle>(null);
  if (advancedViewsSettingChanged && settings.editor.collapseAdvancedViews) {
    setNavigationTab("content");
    setEditingTab("structured");
    setContentEditingTab("structured");
    setAssetEditingTab("structured");
    setContextTab("preview");
  }
  const isExplorerGroupExpanded = (groupId: string) =>
    expandedExplorerGroups[groupId] ??
    (!collapseOptionalSectionsInitially ||
      !noviceCollapsedExplorerGroups.has(groupId));
  const setExplorerGroupExpanded = (groupId: string, expanded: boolean) =>
    setExpandedExplorerGroups((current) =>
      current[groupId] === expanded
        ? current
        : { ...current, [groupId]: expanded },
    );
  const toggleAdvancedViews = () => {
    if (advancedViewsOpen) {
      setNavigationTab("content");
      setEditingTab("structured");
      setContentEditingTab("structured");
      setAssetEditingTab("structured");
      setContextTab("preview");
    }
    const next = !advancedViewsOpen;
    setAdvancedViewsOpen(next);
    tour?.onAdvancedOpenChange(next);
    requestAnimationFrame(() => advancedViewsButtonRef.current?.focus());
  };
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
  const structuredSymbol =
    resolvedSelectedSymbol ??
    analysis.symbols.find((item) => item.kind === "jump") ??
    null;
  const structuredDisclosureOwner = structuredSymbol
    ? structuredDisclosureOwnerKey(
        structuredSymbol,
        workspace.files,
        analysis.symbols,
      )
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
      ? resolvedSelectedSymbol.kind === "jump-appearance"
        ? { kind: "appearance" as const, mode: appearancePreviewMode }
        : previewSelectionForSymbol(workspace.files, resolvedSelectedSymbol)
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
              (layout) =>
                layout.kind === previewSelection.layoutKind &&
                layout.handle === previewSelection.handle,
            ),
        )
      : undefined;
  const choicePackageItem =
    previewSelection.kind === "choice"
      ? [analysis.packageItem, recoveredAnalysis.packageItem, lastValid].find(
          (packageItem) =>
            packageItem.choices.some(
              (choice) => choice.handle === previewSelection.handle,
            ),
        )
      : undefined;
  const previewedLayout =
    previewSelection.kind === "layout"
      ? layoutPackageItem?.layouts.find(
          (layout) =>
            layout.kind === previewSelection.layoutKind &&
            layout.handle === previewSelection.handle,
        )
      : undefined;
  const previewChoiceLayoutOptions =
    previewSelection.kind === "layout" &&
    previewSelection.layoutKind === "section-layout" &&
    previewedLayout &&
    layoutPreviewAcceptsChoiceLayout(previewedLayout)
      ? (layoutPackageItem?.layouts ?? [])
          .filter((layout) => layout.kind === "choice-layout")
          .map((layout) => layout.handle)
      : [];
  const previewChoiceLayoutKey =
    previewSelection.kind === "layout" &&
    previewSelection.layoutKind === "section-layout"
      ? activeLayoutSelectionKey
      : null;
  const requestedPreviewChoiceLayout = previewChoiceLayoutKey
    ? (layoutPreviewChoiceLayouts[previewChoiceLayoutKey] ?? "")
    : "";
  const previewChoiceLayout = previewChoiceLayoutOptions.includes(
    requestedPreviewChoiceLayout,
  )
    ? requestedPreviewChoiceLayout
    : "";
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
    if (settings.editor.saveMode !== "explicit" || saveState === "saved")
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

  useEffect(() => {
    commitFilesRef.current = commitFiles;
  });

  useEffect(() => {
    if (!pendingHandleRename) return;
    const timer = window.setTimeout(() => {
      const currentAnalysis = service.analyze(workspace.files);
      const currentSymbol = currentAnalysis.symbols.find(
        (candidate) =>
          candidate.file === pendingHandleRename.symbol.file &&
          candidate.kind === pendingHandleRename.symbol.kind &&
          candidate.from === pendingHandleRename.symbol.from,
      );
      const referencedHandle = handleReferenceLineageRef.current.get(
        pendingHandleRename.key,
      );
      if (
        !currentSymbol ||
        !referencedHandle ||
        currentSymbol.handle !== pendingHandleRename.expectedHandle ||
        !handleCanPropagate(
          workspace.files,
          currentSymbol,
          currentAnalysis.symbols,
          currentAnalysis.diagnostics,
        )
      ) {
        setPendingHandleRename(null);
        return;
      }
      const nextFiles = renameDocumentHandleReferences(
        workspace.files,
        currentSymbol,
        referencedHandle,
        currentSymbol.handle,
      );
      handleReferenceLineageRef.current.delete(pendingHandleRename.key);
      setPendingHandleRename(null);
      if (
        historyIndexRef.current === pendingHandleRename.historyIndex &&
        historyRef.current[pendingHandleRename.historyIndex]?.files ===
          workspace.files
      ) {
        const nextHistory = [...historyRef.current];
        nextHistory[pendingHandleRename.historyIndex] = {
          ...nextHistory[pendingHandleRename.historyIndex],
          files: nextFiles,
        };
        historyRef.current = nextHistory;
        setHistory(nextHistory);
        commitFilesRef.current(
          nextFiles,
          true,
          true,
          pendingHandleRename.historyGroup,
        );
      } else
        commitFilesRef.current(
          nextFiles,
          true,
          false,
          pendingHandleRename.historyGroup,
        );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [pendingHandleRename, workspace.files]);

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

  useEffect(() => {
    if (!tour) return;
    const preparationKey = `${tour.stepId}:${tour.advancedOpen}`;
    if (preparedTourStepRef.current === preparationKey) return;
    const kind =
      tour.stepId === "editor-metadata"
        ? "jump"
        : tour.stepId === "editor-configure-choice"
          ? "choice"
          : tour.stepId === "editor-place-choice"
            ? "section"
            : null;
    const symbol = analysis.symbols.find(
      (candidate) => candidate.depth === 0 && candidate.kind === kind,
    );
    if (kind && !symbol) return;
    const frame = window.requestAnimationFrame(() => {
      preparedTourStepRef.current = preparationKey;
      if (advancedViewsOpen !== tour.advancedOpen)
        setAdvancedViewsOpen(tour.advancedOpen);
      if (!symbol) return;
      setSelectedTrashId(null);
      setSelectedAsset(null);
      setSelectedSymbol(symbol);
      setSelected(previewSelectionForSymbol(workspace.files, symbol));
      setFile(symbol.file);
      setNavigationTab("content");
      setEditingTab("structured");
      setContentEditingTab("structured");
      if (kind === "section") {
        const owner = structuredDisclosureOwnerKey(
          symbol,
          workspace.files,
          analysis.symbols,
        );
        setStructuredDisclosureStates((current) => ({
          ...current,
          [owner]: {
            ...(current[owner] ?? {}),
            "content-and-effects": true,
          },
        }));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    analysis.symbols,
    advancedViewsOpen,
    setAdvancedViewsOpen,
    tour,
    workspace.files,
  ]);

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
    setContextTab("properties");
  };

  const explorerContextMenuRequest = (target: ExplorerContextTarget) => {
    const actions: ContextMenuAction[] =
      target.kind === "group"
        ? [
            ...target.additions.map((addition) => {
              const item =
                addition === "asset"
                  ? translate("ui.editorWorkspace.text.asset")
                  : translate(
                      `ui.editorWorkspace.declaration.${addition.replaceAll(" ", "-")}`,
                    );
              return {
                id: `add-${addition}`,
                label: translate("ui.editorWorkspace.text.addItem", { item }),
                onAction: () => runExplorerAddAction(addition),
              };
            }),
            {
              id: "toggle",
              label: translate(
                target.expanded
                  ? "ui.editorWorkspace.text.collapse"
                  : "ui.editorWorkspace.text.expand",
              ),
              separatorBefore: target.additions.length > 0,
              onAction: () =>
                setExplorerGroupExpanded(target.groupId, !target.expanded),
            },
          ]
        : [
            {
              id: "open",
              label: translate("ui.editorWorkspace.text.open"),
              onAction: () => {
                if (target.kind === "symbol") openSymbol(target.symbol);
                else if (target.kind === "asset") {
                  if (navigationTab === "content")
                    openContentAsset(target.path);
                  else openFileAsset(target.path);
                } else openTrash(target.entry);
              },
            },
            ...(target.kind === "trash"
              ? [
                  {
                    id: "restore",
                    label: translate("ui.editorWorkspace.text.restore"),
                    disabled:
                      target.entry.kind === "asset" &&
                      Boolean(workspace.assets[target.entry.originalPath]),
                    onAction: () => restoreTrashEntry(target.entry),
                  },
                ]
              : []),
            {
              id: "delete",
              label: translate("ui.editorWorkspace.text.delete"),
              danger: true,
              separatorBefore: true,
              onAction: () => {
                if (target.kind === "symbol") {
                  if (settings.editor.permanentlyDeleteSidebarItems)
                    setPermanentRemoval({
                      kind: "symbol",
                      symbol: target.symbol,
                      label: explorerSymbolLabel(target.symbol),
                    });
                  else moveSymbolToTrash(target.symbol);
                } else if (target.kind === "asset") {
                  if (settings.editor.permanentlyDeleteSidebarItems)
                    setPermanentRemoval({
                      kind: "asset",
                      path: target.path,
                      label: assetBasename(target.path),
                    });
                  else moveAssetToTrash(target.path);
                } else
                  setPermanentRemoval({
                    kind: "trash",
                    id: target.entry.id,
                    label: target.entry.label,
                  });
              },
            },
          ];
    return {
      label: translate(
        target.kind === "group"
          ? "ui.editorWorkspace.ariaLabel.sidebarGroupMenu"
          : "ui.editorWorkspace.ariaLabel.sidebarItemMenu",
      ),
      actions,
    };
  };

  const openExplorerContextMenu = (
    event: ReactMouseEvent,
    target: ExplorerContextTarget,
  ) => {
    openContextMenu(event, explorerContextMenuRequest(target));
  };

  const openExplorerContextMenuFromKeyboard = (
    event: ReactKeyboardEvent<HTMLElement>,
    target: ExplorerContextTarget,
  ) => {
    openContextMenuFromKeyboard(event, explorerContextMenuRequest(target));
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

  const inspectAppearanceColor = (color: AppearanceColorInspection) => {
    if (navigationTab !== "content") return;
    if (color.layout) {
      const layoutSymbol = analysis.symbols.find(
        (symbol) =>
          symbol.kind === color.layout?.kind &&
          symbol.handle === color.layout.handle,
      );
      if (!layoutSymbol) return;
      flushSync(() => {
        openSymbol(layoutSymbol);
        setEditingTab("structured");
        setContentEditingTab("structured");
      });
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() =>
          layoutInspectionRef.current?.inspect(color.layout!.path, color.field),
        ),
      );
      return;
    }
    const appearanceSymbol = analysis.symbols.find(
      (symbol) => symbol.kind === "jump-appearance",
    );
    if (!appearanceSymbol) return;
    flushSync(() => {
      openSymbol(appearanceSymbol);
      setEditingTab("structured");
      setContentEditingTab("structured");
    });
    window.requestAnimationFrame(() => {
      const region = Array.from(
        editorRootRef.current?.querySelectorAll<HTMLElement>(
          "[data-appearance-field]",
        ) ?? [],
      ).find((candidate) => candidate.dataset.appearanceField === color.field);
      if (!region) return;
      const group = region.closest<HTMLDetailsElement>(
        ".editor-appearance-group",
      );
      if (group && !group.open) group.open = true;
      window.requestAnimationFrame(() =>
        revealEditorInspection(region, "center"),
      );
    });
  };

  const diagnosticOwner = (file: string, from: number, to: number = from) =>
    analysis.symbols
      .filter(
        (symbol) =>
          symbol.file === file && symbol.from <= from && symbol.to >= to,
      )
      .sort((left, right) => left.to - left.from - (right.to - right.from))[0];

  const fallbackStructuredTarget = (
    diagnostic: PackageDiagnostic,
  ): DiagnosticTarget | undefined => {
    if (!diagnostic.range) return undefined;
    const owner = diagnosticOwner(
      diagnostic.range.file,
      diagnostic.range.from,
      diagnostic.range.to,
    );
    return owner
      ? {
          file: owner.file,
          declarationFrom: owner.from,
          part: "declaration",
        }
      : undefined;
  };

  const revealStructuredTarget = (
    target: DiagnosticTarget,
    diagnostic: PackageDiagnostic,
  ) => {
    const exactSymbol = analysis.symbols.find(
      (symbol) =>
        symbol.file === target.file && symbol.from === target.declarationFrom,
    );
    const layoutSymbol = analysis.symbols
      .filter(
        (symbol) =>
          symbol.file === target.file &&
          ["section-layout", "choice-layout", "trait-layout"].includes(
            symbol.kind,
          ) &&
          symbol.from <= target.declarationFrom &&
          symbol.to >= target.declarationFrom,
      )
      .sort((left, right) => left.to - left.from - (right.to - right.from))[0];
    if (layoutSymbol) {
      const tree = createLayoutEditorTree(workspace.files, layoutSymbol);
      const layoutNode = tree
        ? ((diagnostic.range
            ? Object.values(tree.nodes).find((node) => {
                const fieldRange = node.sourceField?.range;
                return Boolean(
                  node.compact &&
                  fieldRange &&
                  fieldRange.from <= diagnostic.range!.from &&
                  fieldRange.to >= diagnostic.range!.to,
                );
              })
            : undefined) ??
          Object.values(tree.nodes).find(
            (node) => node.from === target.declarationFrom,
          ))
        : undefined;
      if (layoutNode) {
        flushSync(() => {
          openSymbol(layoutSymbol);
          setEditingTab("structured");
          setContentEditingTab("structured");
        });
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() =>
            layoutInspectionRef.current?.inspect(layoutNode.path, target.field),
          ),
        );
        return;
      }
    }
    const symbol =
      exactSymbol ??
      (diagnostic.range
        ? diagnosticOwner(
            diagnostic.range.file,
            diagnostic.range.from,
            diagnostic.range.to,
          )
        : undefined);
    if (!symbol) return;
    flushSync(() => {
      openSymbol(symbol);
      setEditingTab("structured");
      setContentEditingTab("structured");
    });
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        let region: HTMLElement | undefined;
        if (target.field && target.part === "condition") {
          region = Array.from(
            editorRootRef.current?.querySelectorAll<HTMLElement>(
              "[data-structured-variant-field]",
            ) ?? [],
          ).find(
            (candidate) =>
              candidate.dataset.structuredVariantField === target.field &&
              Number(candidate.dataset.structuredVariantOccurrence) ===
                (target.variantOccurrence ?? target.occurrence ?? 0),
          );
        } else if (target.field) {
          const fieldRegion = Array.from(
            editorRootRef.current?.querySelectorAll<HTMLElement>(
              "[data-structured-field]",
            ) ?? [],
          ).find(
            (candidate) => candidate.dataset.structuredField === target.field,
          );
          region =
            Array.from(
              fieldRegion?.querySelectorAll<HTMLElement>(
                "[data-structured-occurrence]",
              ) ?? [],
            ).find(
              (candidate) =>
                Number(candidate.dataset.structuredOccurrence) ===
                (target.occurrence ?? 0),
            ) ?? fieldRegion;
        } else {
          region =
            editorRootRef.current?.querySelector<HTMLElement>(
              ".editor-structured-heading",
            ) ?? undefined;
        }
        if (!region) return;
        const disclosure = region.closest<HTMLDetailsElement>("details");
        if (disclosure && !disclosure.open) disclosure.open = true;
        window.requestAnimationFrame(() =>
          revealEditorInspection(region, "center"),
        );
      }),
    );
  };

  const openDiagnosticSource = (diagnostic: PackageDiagnostic) => {
    if (!diagnostic.range) return;
    if (navigationTab === "files") {
      openFile(diagnostic.range.file);
    } else {
      const owner = diagnosticOwner(
        diagnostic.range.file,
        diagnostic.range.from,
        diagnostic.range.to,
      );
      setSelectedTrashId(null);
      setSelectedAsset(null);
      setSelectedSymbol(owner ?? null);
      setSelected(
        owner
          ? previewSelectionForSymbol(workspace.files, owner)
          : { kind: "package" },
      );
      setFile(diagnostic.range.file);
      setEditingTab("source");
      setContentEditingTab("source");
    }
    window.requestAnimationFrame(() =>
      sourceRef.current?.setSelectionRange(
        diagnostic.range!.from,
        diagnostic.range!.to,
      ),
    );
  };

  const activateDiagnostic = (diagnostic: PackageDiagnostic) => {
    if (navigationTab !== "content" || editingTab !== "structured") {
      openDiagnosticSource(diagnostic);
      return;
    }
    const targets =
      diagnostic.structuredTargets ??
      (diagnostic.target ? [diagnostic.target] : []);
    const availableTargets = targets.length
      ? targets
      : [fallbackStructuredTarget(diagnostic)].filter(
          (target): target is DiagnosticTarget => Boolean(target),
        );
    if (!availableTargets.length) return;
    const key = diagnosticActivationKey(diagnostic);
    const prior = diagnosticActivationRef.current;
    const index =
      prior?.key === key ? (prior.index + 1) % availableTargets.length : 0;
    diagnosticActivationRef.current = { key, index };
    const target = availableTargets[index];
    if (diagnostic.code === "appearance.contrast" && target.field) {
      inspectAppearanceColor({
        field: target.field,
        kind: appearanceColorKindForField(target.field),
      });
      return;
    }
    revealStructuredTarget(target, diagnostic);
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

  const addAsset = async (
    candidate: File,
    target: AssetImportTarget | null = null,
  ) => {
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
      const fieldEdit = target
        ? setDocumentField(
            workspace.files,
            target.symbol,
            target.field,
            assetRelativePath(path),
            target.occurrence,
          )
        : null;
      if (target && !fieldEdit?.changed && fieldEdit?.reason !== "no-change") {
        onFeedback(assetImportRejectionEvent("validation_failed"));
        return;
      }
      const nextFiles = fieldEdit?.files ?? workspace.files;
      const changed = commitWorkspace(nextFiles, {
        ...workspace.assets,
        [path]: bytes,
      });
      if (changed && target) {
        setSelectedSymbol(
          service
            .analyze(nextFiles)
            .symbols.find(
              (candidate) =>
                candidate.file === target.symbol.file &&
                candidate.kind === target.symbol.kind &&
                candidate.from === target.symbol.from,
            ) ?? target.symbol,
        );
      } else if (changed) {
        openContentAsset(path);
      }
      onFeedback("editor.asset.added");
    } catch (error) {
      onFeedback(
        assetImportRejectionEvent(assetValidationRejectionReason(error)),
      );
    }
  };

  const addTopLevelDeclaration = (kind: AddDeclarationKind) => {
    const declarationKind = kind.replace(" ", "-");
    const result =
      kind === "jump appearance"
        ? {
            changed: true,
            files: {
              ...workspace.files,
              "layout.jdef": insertJumpAppearanceSource(
                workspace.files["layout.jdef"] ?? "",
              ),
            },
            target: undefined,
            focusField: "background",
          }
        : createTopLevelDocumentDeclaration(
            workspace.files,
            declarationKind as CreatableTopLevelDeclarationKind,
          );
    commitFiles(result.files);
    const target =
      kind === "jump appearance" ? "layout.jdef" : result.target?.file;
    if (target) setFile(target);
    const added =
      result.target ??
      service
        .analyze(result.files)
        .symbols.filter(
          (symbol) => symbol.file === target && symbol.kind === declarationKind,
        )
        .at(-1);
    if (added) {
      setStructuredFocus(
        ["resource", "section", "choice", "theme"].includes(declarationKind)
          ? "handle"
          : declarationKind === "jump-appearance"
            ? "background"
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
  };

  const requestAssetAddition = () => {
    setAddOpen(false);
    assetImportTargetRef.current = null;
    assetInputRef.current?.click();
  };

  const requestAssetImport = (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
  ) => {
    assetImportTargetRef.current = { symbol, field, occurrence };
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
  const previewInspectionControls = (
    <>
      <label>
        <input
          type="checkbox"
          aria-label={
            previewSelection.kind === "appearance"
              ? translate("ui.editorWorkspace.text.inspectColors")
              : undefined
          }
          checked={showBounds}
          onChange={(event) => setShowBounds(event.target.checked)}
        />{" "}
        {translate(
          previewSelection.kind === "appearance"
            ? "ui.editorWorkspace.text.inspect"
            : "ui.editorWorkspace.text.showBounds",
        )}
      </label>
      <label>
        <input
          type="checkbox"
          checked={stripColor}
          onChange={(event) => setStripColor(event.target.checked)}
        />{" "}
        {translate("ui.editorWorkspace.text.stripColor")}
      </label>
    </>
  );

  return (
    <div
      className="production-editor"
      aria-label={translate("ui.editorWorkspace.ariaLabel.projectEditor", {
        project: summary.name,
      })}
      ref={editorRootRef}
    >
      <div className="editor-project-toolbar">
        <strong title={summary.name}>{summary.name}</strong>
        <span className={`editor-save-state is-${saveState}`}>
          {translate(`ui.editorWorkspace.saveState.${saveState}`)}
        </span>
        {settings.editor.collapseAdvancedViews && (
          <>
            <span id="editor-advanced-views-description" className="sr-only">
              {translate(
                "ui.editorWorkspace.ariaLabel.showFilesSourceAndPropertiesViews",
              )}
            </span>
            <button
              ref={advancedViewsButtonRef}
              className="editor-advanced-views-toggle"
              type="button"
              data-tour-target="editor-advanced-toggle"
              aria-expanded={advancedViewsOpen}
              aria-describedby="editor-advanced-views-description"
              onClick={toggleAdvancedViews}
            >
              <span>{translate("ui.editorWorkspace.text.advancedViews")}</span>
              <Chevron direction={advancedViewsOpen ? "down" : "right"} />
            </button>
          </>
        )}
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
        <button
          type="button"
          onClick={onExport}
          data-tour-target="editor-export"
        >
          {translate("ui.editorWorkspace.text.exportJmp")}
        </button>
        <div
          ref={addMenuRef}
          className="editor-add-menu"
          data-tour-target={addOpen ? undefined : "editor-add"}
        >
          <button
            className="editor-primary-action"
            type="button"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((value) => !value)}
          >
            {translate("ui.editorWorkspace.text.add")}
          </button>
          {addOpen && (
            <div className="editor-add-options" data-tour-target="editor-add">
              {addDeclarationKinds
                .filter(
                  (kind) =>
                    kind !== "jump appearance" ||
                    !analysis.symbols.some(
                      (symbol) => symbol.kind === "jump-appearance",
                    ),
                )
                .map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    onClick={() => addTopLevelDeclaration(kind)}
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
              const target = assetImportTargetRef.current;
              assetImportTargetRef.current = null;
              if (candidate) void addAsset(candidate, target);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <aside
        className="editor-explorer"
        data-tour-target="editor-navigation-appearance"
      >
        <div
          className="editor-tabs editor-navigation-tabs"
          role="tablist"
          aria-label={translate("ui.editorWorkspace.ariaLabel.navigation")}
          data-tour-target="editor-advanced-tabs"
        >
          {(advancedViewsOpen
            ? (["content", "files"] as const)
            : (["content"] as const)
          ).map((tab) => (
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
                if (tab === "files") tour?.onNavigate("files");
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
                data-tour-target="editor-navigation-details"
                onClick={() => {
                  tour?.onNavigate("details");
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
              {(() => {
                const appearance = visibleSymbols.find(
                  (symbol) =>
                    symbol.depth === 0 && symbol.kind === "jump-appearance",
                );
                return appearance ? (
                  <ExplorerEntryButton
                    className={
                      selectedSymbol?.file === appearance.file &&
                      selectedSymbol.from === appearance.from
                        ? "is-selected"
                        : ""
                    }
                    label={translate("ui.editorWorkspace.text.jumpAppearance")}
                    onClick={() => {
                      tour?.onNavigate("appearance");
                      openSymbol(appearance);
                    }}
                    onContextMenu={(event) =>
                      openExplorerContextMenu(event, {
                        kind: "symbol",
                        symbol: appearance,
                      })
                    }
                    onKeyDown={(event) =>
                      openExplorerContextMenuFromKeyboard(event, {
                        kind: "symbol",
                        symbol: appearance,
                      })
                    }
                    aria-haspopup="menu"
                  />
                ) : null;
              })()}
              {declarationGroups.map(({ id, headingKey, kinds, additions }) => {
                const heading = translate(
                  `ui.editorWorkspace.explorerGroup.${headingKey}`,
                );
                const symbols = visibleSymbols.filter(
                  (symbol) =>
                    (kinds as readonly string[]).includes(symbol.kind) &&
                    (symbol.depth === 0 || Boolean(symbolQuery)),
                );
                if (!symbols.length && symbolQuery) return null;
                const groupId = `content:${id}`;
                const expanded =
                  Boolean(symbolQuery) || isExplorerGroupExpanded(groupId);
                return (
                  <ExplorerDisclosure
                    groupId={groupId}
                    key={heading}
                    label={heading}
                    count={symbols.length}
                    expanded={expanded}
                    onToggle={(nextExpanded) => {
                      if (!symbolQuery)
                        setExplorerGroupExpanded(groupId, nextExpanded);
                    }}
                    onContextMenu={(event) =>
                      openExplorerContextMenu(event, {
                        kind: "group",
                        groupId,
                        expanded,
                        additions,
                      })
                    }
                    onContextMenuKey={(event) =>
                      openExplorerContextMenuFromKeyboard(event, {
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
                        data-tour-target={
                          symbol.kind === "section" &&
                          readSourceField(
                            workspace.files[symbol.file],
                            symbol,
                            "handle",
                          ) === "first_steps"
                            ? "editor-navigation-section"
                            : undefined
                        }
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
                        onClick={() => {
                          if (
                            symbol.kind === "section" &&
                            readSourceField(
                              workspace.files[symbol.file],
                              symbol,
                              "handle",
                            ) === "first_steps"
                          )
                            tour?.onNavigate("section");
                          openSymbol(symbol);
                        }}
                        onContextMenu={(event) =>
                          openExplorerContextMenu(event, {
                            kind: "symbol",
                            symbol,
                          })
                        }
                        onKeyDown={(event) =>
                          openExplorerContextMenuFromKeyboard(event, {
                            kind: "symbol",
                            symbol,
                          })
                        }
                        aria-haspopup="menu"
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
                const expanded =
                  Boolean(symbolQuery) || isExplorerGroupExpanded(groupId);
                return (
                  <ExplorerDisclosure
                    groupId={groupId}
                    label={translate("ui.editorWorkspace.text.assets")}
                    count={assets.length}
                    expanded={expanded}
                    onToggle={(nextExpanded) => {
                      if (!symbolQuery)
                        setExplorerGroupExpanded(groupId, nextExpanded);
                    }}
                    onContextMenu={(event) =>
                      openExplorerContextMenu(event, {
                        kind: "group",
                        groupId,
                        expanded,
                        additions: ["asset"],
                      })
                    }
                    onContextMenuKey={(event) =>
                      openExplorerContextMenuFromKeyboard(event, {
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
                      onContextAssetKey={(path, event) =>
                        openExplorerContextMenuFromKeyboard(event, {
                          kind: "asset",
                          path,
                        })
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
                onContextGroupKey={(event) =>
                  openExplorerContextMenuFromKeyboard(event, {
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
                onContextKey={(entry, event) =>
                  openExplorerContextMenuFromKeyboard(event, {
                    kind: "trash",
                    entry,
                  })
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
                onContextMenuKey={(event) =>
                  openExplorerContextMenuFromKeyboard(event, {
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
                  onContextAssetKey={(path, event) =>
                    openExplorerContextMenuFromKeyboard(event, {
                      kind: "asset",
                      path,
                    })
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
                onContextGroupKey={(event) =>
                  openExplorerContextMenuFromKeyboard(event, {
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
                onContextKey={(entry, event) =>
                  openExplorerContextMenuFromKeyboard(event, {
                    kind: "trash",
                    entry,
                  })
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
          {(advancedViewsOpen
            ? selectedTrash
              ? (["source"] as const)
              : selectedAsset
                ? navigationTab === "files"
                  ? (["source"] as const)
                  : (["structured", "source"] as const)
                : navigationTab === "files"
                  ? (["source"] as const)
                  : (["structured", "source"] as const)
            : (["structured"] as const)
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
                symbol={structuredSymbol}
                files={workspace.files}
                assets={archiveAssetPaths.map(assetRelativePath)}
                tagDefinitions={tags}
                collapseOptionalSectionsInitially={
                  collapseOptionalSectionsInitially
                }
                optionalDisclosureState={
                  structuredDisclosureOwner
                    ? (structuredDisclosureStates[structuredDisclosureOwner] ??
                      emptyStructuredDisclosureState)
                    : emptyStructuredDisclosureState
                }
                onOptionalDisclosureChange={(section, expanded) => {
                  if (!structuredDisclosureOwner) return;
                  rememberStructuredDisclosure(
                    structuredDisclosureOwner,
                    section,
                    expanded,
                  );
                }}
                showExplanatoryText={settings.editor.showExplanatoryText}
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
                onImportAsset={requestAssetImport}
                onUpdate={(symbol, field, value, occurrence = 0) => {
                  const historyGroup = `field:${symbol.file}:${symbol.from}:${field}:${occurrence}`;
                  const handleRenameKey = `${symbol.file}:${symbol.from}:${symbol.kind}`;
                  if (
                    field === "handle" &&
                    symbol.handle &&
                    !handleReferenceLineageRef.current.has(handleRenameKey)
                  )
                    handleReferenceLineageRef.current.set(
                      handleRenameKey,
                      symbol.handle,
                    );
                  let result = setDocumentField(
                    workspace.files,
                    symbol,
                    field,
                    value,
                    occurrence,
                  );
                  if (!result.changed) return;
                  if (
                    ["choice", "grant"].includes(symbol.kind) &&
                    value &&
                    ["form", "companion"].includes(field)
                  ) {
                    const exclusiveField =
                      field === "form" ? "companion" : "form";
                    const exclusiveRemoval = setDocumentField(
                      result.files,
                      symbol,
                      exclusiveField,
                      "",
                    );
                    if (exclusiveRemoval.changed) result = exclusiveRemoval;
                  }
                  commitFiles(result.files, true, false, historyGroup);
                  const nextSymbol =
                    service
                      .analyze(result.files)
                      .symbols.find(
                        (candidate) =>
                          candidate.file === symbol.file &&
                          candidate.kind === symbol.kind &&
                          candidate.from === symbol.from,
                      ) ?? symbol;
                  setSelectedSymbol(nextSymbol);
                  if (field === "handle")
                    setPendingHandleRename({
                      key: handleRenameKey,
                      symbol,
                      expectedHandle: value,
                      historyGroup,
                      historyIndex: historyIndexRef.current,
                    });
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
                        declaration:
                          kind === "description"
                            ? translate("ui.editorWorkspace.description.label")
                            : editorDeclarationLabel(kind),
                      },
                    ),
                  );
                }}
                onCreateResource={(owner) => setResourceCreation({ owner })}
                onCreateReference={(
                  owner,
                  field,
                  occurrence,
                  kind,
                  options,
                  returnTarget,
                ) => {
                  const result = createAndAssignTopLevelDocumentReference(
                    workspace.files,
                    owner,
                    field,
                    occurrence,
                    kind,
                    options,
                  );
                  if (!result.changed || !result.target) return;
                  commitFiles(result.files);
                  setStructuredFocus(result.focusField ?? null);
                  openSymbol(result.target);
                  setStructuredReturnTarget(returnTarget ?? owner);
                  setStructuredAnnouncement(
                    translate(
                      "ui.editorWorkspace.announcement.referenceCreated",
                      {
                        declaration: translate(
                          `ui.editorWorkspace.declaration.${kind}`,
                        ),
                      },
                    ),
                  );
                }}
                onOpenCreatedContent={(target, returnTarget, focusField) => {
                  setStructuredFocus(focusField);
                  openSymbol(target);
                  setStructuredReturnTarget(returnTarget);
                }}
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
                        declaration: editorDeclarationLabel(child.kind),
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
                        declaration: editorDeclarationLabel(child.kind),
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
                        indentDeclarationContinuation(
                          declaration,
                          symbol.depth,
                        ) +
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
                      ? translate(
                          "ui.editorWorkspace.title.applySuggestedFixAtCursor",
                        )
                      : translate(
                          "ui.editorWorkspace.title.noSuggestedFixAvailable",
                        )
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
                      ? translate("ui.editorWorkspace.text.matchCount", {
                          current: findStatus.current,
                          total: findStatus.total,
                        })
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
                      ? translate(
                          "ui.editorWorkspace.text.sourceContextTitle",
                          {
                            kind: editorDeclarationLabel(
                              sourceContextSymbol.kind,
                            ),
                            handle:
                              sourceContextSymbol.handle ??
                              translate(
                                "ui.editorWorkspace.text.unnamedDeclaration",
                              ),
                          },
                        )
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
                    const sourceKind = kind === "description" ? "text" : kind;
                    const childBody =
                      kind === "description"
                        ? 'handle: description\ncontent: ""'
                        : kind === "cost"
                          ? "resource: jump_points\namount: 0"
                          : kind === "grant"
                            ? `kind: perk\nname: ${JSON.stringify(
                                translate(
                                  "ui.editorWorkspace.starter.newGrantName",
                                ),
                              )}`
                            : kind === "choice"
                              ? "handle: new_placement\ntarget: choice_handle"
                              : kind === "choice-source"
                                ? "handle: new_source\nmode: multi"
                                : ["stack", "inline", "wrap"].includes(kind)
                                  ? "gap: md"
                                  : kind === "grid"
                                    ? "columns: 2"
                                    : `handle: new_${kind.replaceAll("-", "_")}`;
                    const snippet = `\n${indentation}${sourceKind}\n${childBody
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
                  showExplanatoryText={settings.editor.showExplanatoryText}
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
          {(advancedViewsOpen
            ? (["preview", "properties"] as const)
            : (["preview"] as const)
          ).map((tab) => (
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
          <div
            className="editor-preview-panel"
            data-tour-target="editor-preview"
          >
            <div className="editor-preview-toolbar">
              <span>
                <strong>
                  {translate("ui.editorWorkspace.text.livePreview")}
                </strong>
                <small>{previewStatus}</small>
              </span>
              <div
                className={`editor-preview-toggles${previewSelection.kind === "appearance" ? " is-appearance" : ""}`}
              >
                {previewSelection.kind === "appearance" && (
                  <span
                    className="editor-preview-mode"
                    role="group"
                    aria-label={translate(
                      "ui.editorWorkspace.ariaLabel.appearancePreviewMode",
                    )}
                  >
                    {(["jump", "components"] as const).map((mode) => (
                      <button
                        type="button"
                        aria-pressed={appearancePreviewMode === mode}
                        key={mode}
                        onClick={() => setAppearancePreviewMode(mode)}
                      >
                        {translate(
                          `ui.editorWorkspace.text.appearancePreview${mode === "jump" ? "Jump" : "Components"}`,
                        )}
                      </button>
                    ))}
                  </span>
                )}
                {settings.editor.collapsePreviewInspectionTools ? (
                  <button
                    className="editor-preview-tools-toggle"
                    type="button"
                    aria-expanded={previewInspectionToolsOpen}
                    aria-controls="editor-preview-inspection-tools"
                    onClick={() =>
                      setPreviewInspectionToolsOpen(!previewInspectionToolsOpen)
                    }
                  >
                    <span>
                      {translate("ui.editorWorkspace.text.previewTools")}
                    </span>
                    <Chevron
                      direction={previewInspectionToolsOpen ? "down" : "right"}
                    />
                  </button>
                ) : (
                  previewInspectionControls
                )}
              </div>
            </div>
            {previewChoiceLayoutKey &&
              previewChoiceLayoutOptions.length > 0 && (
                <div className="editor-layout-preview-composition">
                  <label>
                    <span>
                      {translate(
                        "ui.editorWorkspace.layoutPreview.choiceLayout",
                      )}
                      <small>
                        {translate(
                          "ui.editorWorkspace.layoutPreview.choiceLayoutHelp",
                        )}
                      </small>
                    </span>
                    <select
                      aria-label={translate(
                        "ui.editorWorkspace.layoutPreview.choiceLayout",
                      )}
                      value={previewChoiceLayout}
                      onChange={(event) => {
                        const value = event.target.value;
                        setLayoutPreviewChoiceLayouts((current) => ({
                          ...current,
                          [previewChoiceLayoutKey]: value,
                        }));
                      }}
                    >
                      <option value="">
                        {translate(
                          "ui.editorWorkspace.layoutPreview.builtInChoiceLayout",
                        )}
                      </option>
                      {previewChoiceLayoutOptions.map((handle) => (
                        <option value={handle} key={handle}>
                          {handle}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            {settings.editor.collapsePreviewInspectionTools &&
              previewInspectionToolsOpen && (
                <div
                  id="editor-preview-inspection-tools"
                  className="editor-preview-inspection-tools"
                >
                  {previewInspectionControls}
                </div>
              )}
            <div className="editor-bounds-tools" hidden={!showBounds}>
              {previewSelection.kind === "appearance" ? (
                <>
                  <div
                    className="editor-bounds-legend editor-appearance-color-legend"
                    aria-label={translate(
                      "ui.editorWorkspace.ariaLabel.appearanceColorLegend",
                    )}
                  >
                    {(["background", "text", "border", "accent"] as const).map(
                      (kind) => (
                        <span className={`is-${kind}`} key={kind}>
                          {translate(
                            `ui.editorWorkspace.text.appearanceColorKind${kind[0].toLocaleUpperCase()}${kind.slice(1)}`,
                          )}
                        </span>
                      ),
                    )}
                    <span className="is-layout-override">
                      {translate(
                        "ui.editorWorkspace.text.appearanceColorLayoutOverride",
                      )}
                    </span>
                  </div>
                  <output
                    className="editor-bound-readout"
                    data-appearance-color-kind={hoveredAppearanceColor?.kind}
                    data-appearance-color-owner={
                      hoveredAppearanceColor?.layout
                        ? "layout"
                        : hoveredAppearanceColor
                          ? "appearance"
                          : undefined
                    }
                    aria-label={translate(
                      "ui.editorWorkspace.ariaLabel.appearanceColorReadout",
                    )}
                    aria-live="polite"
                  >
                    <i aria-hidden="true" />
                    <span>
                      {hoveredAppearanceColor
                        ? hoveredAppearanceColor.layout
                          ? translate(
                              "ui.editorWorkspace.text.appearanceLayoutColorReadout",
                              {
                                kind: translate(
                                  `ui.editorWorkspace.text.${hoveredAppearanceColor.layout.kind === "section-layout" ? "sectionLayout" : hoveredAppearanceColor.layout.kind === "choice-layout" ? "choiceLayout" : "traitLayout"}`,
                                ),
                                handle: hoveredAppearanceColor.layout.handle,
                                field: translate(
                                  `ui.editorWorkspace.layoutField.${hoveredAppearanceColor.field}`,
                                ),
                              },
                            )
                          : translate(
                              "ui.editorWorkspace.text.appearanceColorReadout",
                              {
                                field: translate(
                                  `ui.editorWorkspace.appearanceField.${hoveredAppearanceColor.field}`,
                                ),
                              },
                            )
                        : translate(
                            "ui.editorWorkspace.text.appearanceColorReadoutIdle",
                          )}
                    </span>
                  </output>
                </>
              ) : (
                <>
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
                        ? translate(
                            "ui.editorWorkspace.text.layoutBoundReadout",
                            {
                              kind: translate(
                                `ui.editorWorkspace.text.${hoveredBound.kind}`,
                              ),
                              path: hoveredBound.path,
                            },
                          )
                        : translate(
                            "ui.editorWorkspace.text.layoutBoundReadoutIdle",
                          )}
                    </span>
                  </output>
                </>
              )}
            </div>
            <div className="editor-preview-scroll">
              <JumpPreview
                packageItem={previewPackage}
                layoutPackageItem={layoutPackageItem}
                choicePackageItem={choicePackageItem}
                assets={workspace.assets}
                tags={tags}
                selection={previewSelection}
                showBounds={showBounds}
                stripColor={stripColor}
                layoutPreviewPlaceholderCharacterLimit={
                  settings.editor.layoutPreviewPlaceholderCharacterLimit
                }
                layoutPreviewChoiceLayout={previewChoiceLayout || undefined}
                hoveredBound={hoveredBound}
                onHoveredBoundChange={setHoveredBound}
                onBoundActivate={inspectLayoutBound}
                hoveredAppearanceColor={hoveredAppearanceColor}
                onHoveredAppearanceColorChange={setHoveredAppearanceColor}
                onAppearanceColorActivate={inspectAppearanceColor}
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
            <Chevron
              className="editor-diagnostics-chevron"
              direction={diagnosticsOpen ? "down" : "right"}
            />
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
                  aria-label={translate(
                    `ui.editorWorkspace.diagnosticCount.${severity}`,
                    { count },
                  )}
                  title={translate(
                    "ui.editorWorkspace.title.toggleDiagnosticSeverity",
                    {
                      severity: translate(
                        `ui.editorWorkspace.diagnosticSeverity.${severity}`,
                      ),
                    },
                  )}
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
                : translate(
                    "ui.editorWorkspace.text.noDiagnosticsMatchFilters",
                  )}
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
                disabled={
                  !diagnostic.range &&
                  !diagnostic.target &&
                  !diagnostic.structuredTargets?.length
                }
                onClick={() => activateDiagnostic(diagnostic)}
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
  onCreateTheme,
  onUpdate,
  fields,
  showHeading = true,
  showExplanatoryText,
}: {
  assets: readonly string[];
  diagnostics: readonly PackageDiagnostic[];
  files: Readonly<Record<string, string>>;
  symbol: FormatSymbol;
  onEndFieldEdit: () => void;
  onCreateTheme: (symbol: FormatSymbol, field: string, color: string) => void;
  onUpdate: (
    symbol: FormatSymbol,
    field: string,
    value: string,
    occurrence?: number,
  ) => void;
  fields?: readonly string[];
  showHeading?: boolean;
  showExplanatoryText: boolean;
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
            node: editorDeclarationLabel(symbol.kind),
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
                  if (referenceKind === "choice")
                    return candidate.kind === "choice" && candidate.depth === 0;
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
        const presentation = editorLayoutFieldPresentation(fieldName, {
          controlAlignment: layoutNodeUsesControlAlignment(
            symbol.kind,
            readSourceField(files[symbol.file], symbol, "target"),
          ),
        });
        const fieldLabel = presentation.label;
        const helpId =
          showExplanatoryText && presentation.help
            ? `${listId}-help`
            : undefined;
        const diagnosticId = matchingDiagnostics.length
          ? `${listId}-diagnostics`
          : undefined;
        const describedBy = [helpId, diagnosticId].filter(Boolean).join(" ");
        const common = {
          "aria-invalid": matchingDiagnostics.length ? true : undefined,
          "aria-describedby": describedBy || undefined,
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
          <div
            className="editor-schema-field"
            data-layout-field={fieldName}
            key={fieldName}
          >
            <div
              className={`editor-field-occurrence${fieldSeverity ? ` is-${fieldSeverity}` : ""}`}
            >
              <span>
                {fieldLabel}
                {definition.required && (
                  <small>{translate("ui.editorWorkspace.text.required")}</small>
                )}
                {helpId && <small id={helpId}>{presentation.help}</small>}
              </span>
              {["color", "hexColor"].includes(definition.type ?? "") ? (
                <ColorFieldControl
                  label={fieldLabel}
                  value={value}
                  choices={colorChoices}
                  allowTokens={definition.type === "color"}
                  ariaInvalid={matchingDiagnostics.length > 0}
                  ariaDescribedBy={describedBy || undefined}
                  onChange={(nextValue) =>
                    onUpdate(symbol, fieldName, nextValue)
                  }
                  onCreateTheme={(displayedColor, resolvedColor) =>
                    onCreateTheme(
                      symbol,
                      fieldName,
                      normalizeFormat1HexColor(displayedColor) ??
                        colorChoices.find(
                          (choice) => choice.value === displayedColor,
                        )?.color ??
                        (displayedColor ? resolvedColor : undefined) ??
                        "#68707C",
                    )
                  }
                  onBlur={onEndFieldEdit}
                />
              ) : definition.type === "boolean" ? (
                <span className="editor-schema-field-control">
                  <input
                    type="checkbox"
                    aria-label={fieldLabel}
                    checked={
                      value === ""
                        ? definition.default === true
                        : value === "true"
                    }
                    {...common}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      onUpdate(
                        symbol,
                        fieldName,
                        definition.default === checked ? "" : String(checked),
                      );
                    }}
                    onBlur={onEndFieldEdit}
                  />
                </span>
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
                  ariaDescribedBy={describedBy || undefined}
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
                    <option value={option} key={option}>
                      {symbol.kind === "rule" && fieldName === "style"
                        ? translate(
                            `ui.editorWorkspace.layoutOption.ruleStyle.${option}`,
                          )
                        : editorOptionPresentation(
                            symbol.kind,
                            fieldName,
                            option,
                          ).label}
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
              ) : referenceKind ? (
                <HandleFieldControl
                  label={fieldLabel}
                  value={value}
                  options={references}
                  ariaInvalid={matchingDiagnostics.length > 0}
                  ariaDescribedBy={describedBy || undefined}
                  showDescriptions={showExplanatoryText}
                  onChange={(nextValue) =>
                    onUpdate(symbol, fieldName, nextValue)
                  }
                  onBlur={onEndFieldEdit}
                />
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
              {!referenceKind && references.length > 0 && (
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

type LayoutContentCreationRequest = {
  kind: "text" | "image" | "input";
  node: LayoutNodeRef | null;
};

function LayoutNodeKindControl({
  label,
  value,
  kinds,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
  showExplanatoryText,
  onChange,
}: {
  label: string;
  value: string;
  kinds: readonly string[];
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  showExplanatoryText: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="editor-schema-field editor-layout-kind-field">
      <span>{label}</span>
      <FreeTextSuggestionCombobox
        label={label}
        value={value}
        suggestions={kinds.map(editorLayoutNodePresentation)}
        disabled={disabled}
        ariaInvalid={ariaInvalid}
        ariaDescribedBy={ariaDescribedBy}
        showSuggestionsLabel={translate(
          "ui.editorWorkspace.combobox.showOptions",
          { field: label },
        )}
        suggestionsLabel={translate(
          "ui.editorWorkspace.combobox.availableOptions",
          { field: label },
        )}
        selectOnly
        showDescriptions={showExplanatoryText}
        onChange={onChange}
      />
    </div>
  );
}

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
  returnTarget,
  onOpenCreatedContent,
  onCreateReference,
  showExplanatoryText,
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
  returnTarget: FormatSymbol | null;
  onOpenCreatedContent: (
    target: FormatSymbol,
    returnTarget: FormatSymbol,
    focusField: string | null,
  ) => void;
  onCreateReference: (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
    kind: CreatableTopLevelDeclarationKind,
    options?: { color?: string },
    returnTarget?: FormatSymbol,
  ) => void;
  showExplanatoryText: boolean;
}) {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
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
  const [contentCreation, setContentCreation] =
    useState<LayoutContentCreationRequest | null>(null);

  useImperativeHandle(
    inspectionRef,
    () => ({
      inspect: (path, field) => {
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
          setEditingNode(
            !node.container && field ? layoutNodeReference(node) : null,
          );
          setContainerPresentationOpen(Boolean(node.container && field));
          setInspectedPath(field ? null : path);
        });
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const nodeRegion = Array.from(
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
            const fieldRegion = field
              ? Array.from(
                  nodeRegion?.querySelectorAll<HTMLElement>(
                    "[data-layout-field]",
                  ) ?? [],
                ).find((candidate) => candidate.dataset.layoutField === field)
              : undefined;
            if (fieldRegion) revealEditorInspection(fieldRegion, "center");
            else if (nodeRegion) revealEditorInspection(nodeRegion);
          });
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
  const typedReferenceValues = (kind: string) =>
    kind === "text" || kind === "image" || kind === "input"
      ? layoutContentTargetHandles(files, tree.layoutKind, kind)
      : referenceValues(kind);
  const jumpSymbol = symbols.find((candidate) => candidate.kind === "jump");
  const defaultLayoutField = layout.kind;
  const defaultLayoutHandle = jumpSymbol
    ? readSourceField(files[jumpSymbol.file], jumpSymbol, defaultLayoutField)
    : "";
  const compatibleContentOwners = (
    kind: LayoutContentCreationRequest["kind"],
  ) =>
    symbols
      .filter((candidate) => {
        const compatibleOwner =
          layout.kind === "section-layout"
            ? candidate.kind === "section"
            : layout.kind === "choice-layout"
              ? candidate.kind === "choice" && candidate.depth === 0
              : candidate.kind === "grant" &&
                readSourceField(files[candidate.file], candidate, "kind") ===
                  "trait";
        if (!compatibleOwner) return false;
        if (!structuredContext(files, candidate)?.childKinds.includes(kind))
          return false;
        const authoredLayout = readSourceField(
          files[candidate.file],
          candidate,
          "layout",
        );
        return (authoredLayout || defaultLayoutHandle) === layout.handle;
      })
      .sort((left, right) => {
        const leftIsReturn =
          returnTarget?.file === left.file && returnTarget.from === left.from;
        const rightIsReturn =
          returnTarget?.file === right.file && returnTarget.from === right.from;
        return Number(rightIsReturn) - Number(leftIsReturn);
      });
  const targetValues =
    newKind === "slot" ? slots : typedReferenceValues(newKind);
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
  const createAndAssignContent = (
    request: LayoutContentCreationRequest,
    owner: FormatSymbol,
  ) => {
    const created = insertDocumentChild(files, owner, request.kind);
    if (!created.changed || !created.target?.handle) return false;
    const layoutResult = request.node
      ? setLayoutNodeTarget(
          created.files,
          layout,
          request.node,
          created.target.handle,
        )
      : selectedRef
        ? insertLayoutChild(created.files, layout, selectedRef, request.kind, {
            target: created.target.handle,
          })
        : { changed: false, files: created.files };
    if (!layoutResult.changed) return false;
    onApply(
      { changed: true, files: layoutResult.files },
      translate("ui.editorWorkspace.announcement.contentTargetCreated", {
        declaration: displayKind(request.kind),
        owner: explorerSymbolLabel(owner),
      }),
    );
    setContentCreation(null);
    onOpenCreatedContent(created.target, layout, created.focusField ?? null);
    return true;
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
          <LayoutNodeKindControl
            label={translate("ui.editorWorkspace.text.containerFlow")}
            value={rootKinds.includes(newKind) ? newKind : rootKinds[0]}
            kinds={rootKinds}
            showExplanatoryText={showExplanatoryText}
            onChange={setNewKind}
          />
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
                inspectedPath === selected.path ? " is-editor-inspected" : ""
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
              <LayoutNodeKindControl
                label={translate("ui.editorWorkspace.text.containerFlow")}
                value={selected.kind}
                kinds={allowedKinds.filter(layoutNodeIsContainer)}
                disabled={!tree.structurallySafe}
                showExplanatoryText={showExplanatoryText}
                onChange={(nextKind) =>
                  apply(
                    convertLayoutNode(
                      files,
                      layout,
                      layoutNodeReference(selected),
                      nextKind,
                    ),
                    announce("layoutNodeConverted", nextKind),
                    "container",
                  )
                }
              />
              <LayoutNodeFields
                assets={assets}
                diagnostics={diagnostics}
                files={files}
                symbol={layoutNodeSymbol(layout, selected)}
                onEndFieldEdit={onEndFieldEdit}
                onCreateTheme={(node, field, color) =>
                  onCreateReference(node, field, 0, "theme", { color }, layout)
                }
                onUpdate={updateLayoutField}
                fields={["columns", "gap"]}
                showHeading={false}
                showExplanatoryText={showExplanatoryText}
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
                    onCreateTheme={(node, field, color) =>
                      onCreateReference(
                        node,
                        field,
                        0,
                        "theme",
                        { color },
                        layout,
                      )
                    }
                    onUpdate={updateLayoutField}
                    fields={[
                      "padding",
                      "background",
                      "align",
                      "justify",
                      "text-align",
                      "text-size",
                      "text-color",
                      "border-color",
                      "border-width",
                      "border-style",
                      "corners",
                    ]}
                    showExplanatoryText={showExplanatoryText}
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
              const nodeReferenceValues = typedReferenceValues(node.kind);
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
              const hasEditableFields = layoutNodeHasEditableFields(node.kind);
              const startMove = () => {
                if (isMoving) {
                  setMovingNode(null);
                  return;
                }
                setMovingNode(layoutNodeReference(node));
                const destination = destinationsForNode(node)[0];
                setMoveDestination(destination?.id ?? "");
              };
              const togglePresentation = () => {
                if (node.compact)
                  apply(
                    expandLayoutLeaf(files, layout, layoutNodeReference(node)),
                    announce("layoutNodeExpanded", node.kind),
                    "node",
                  );
                else if (edited?.id === node.id) {
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
                } else setEditingNode(layoutNodeReference(node));
              };
              const reorder = (direction: "up" | "down") =>
                apply(
                  reorderLayoutNode(
                    files,
                    layout,
                    layoutNodeReference(node),
                    direction,
                  ),
                  announce("layoutNodeReordered", node.kind),
                );
              const remove = () => {
                apply(
                  removeLayoutNode(files, layout, layoutNodeReference(node)),
                  announce("layoutNodeRemoved", node.kind),
                );
                setEditingNode(null);
              };
              const menu = {
                label: translate(
                  "ui.editorWorkspace.ariaLabel.layoutNodeActions",
                  { node: displayKind(node.kind) },
                ),
                actions: [
                  ...(node.container
                    ? [
                        {
                          id: "open",
                          label: translate("common.open"),
                          onAction: () => selectActiveContainer(node),
                        },
                      ]
                    : []),
                  {
                    id: "move",
                    label: translate("ui.editorWorkspace.text.moveEllipsis"),
                    disabled:
                      !tree.structurallySafe ||
                      destinationsForNode(node).length === 0,
                    onAction: startMove,
                  },
                  ...(hasEditableFields
                    ? [
                        {
                          id: "presentation",
                          label: translate(
                            node.compact
                              ? "ui.editorWorkspace.text.expandToFields"
                              : edited?.id === node.id && canCompact
                                ? "ui.editorWorkspace.text.collapseToShorthand"
                                : "ui.editorWorkspace.text.editPresentation",
                          ),
                          disabled: !tree.structurallySafe,
                          onAction: togglePresentation,
                        },
                      ]
                    : []),
                  {
                    id: "up",
                    label: translate("common.moveUp"),
                    disabled: !tree.structurallySafe || index === 0,
                    onAction: () => reorder("up"),
                  },
                  {
                    id: "down",
                    label: translate("common.moveDown"),
                    disabled:
                      !tree.structurallySafe || index === children.length - 1,
                    onAction: () => reorder("down"),
                  },
                  {
                    id: "remove",
                    label: translate("common.remove"),
                    disabled: !tree.structurallySafe,
                    danger: true,
                    separatorBefore: true,
                    onAction: remove,
                  },
                ],
              };
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
                    inspectedPath === node.path ? " is-editor-inspected" : ""
                  }`}
                  draggable={tree.structurallySafe && !layoutDragBoundaryActive}
                  data-layout-node-kind={node.kind}
                  data-layout-node-path={node.path}
                  tabIndex={-1}
                  key={node.id}
                  onContextMenu={(event) => openContextMenu(event, menu)}
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
                  {node.container ? (
                    <label>
                      <span>
                        {translate("ui.editorWorkspace.text.nodeType")}
                      </span>
                      <span className="editor-layout-static-control">
                        {displayKind(node.kind)}
                      </span>
                    </label>
                  ) : (
                    <LayoutNodeKindControl
                      label={translate("ui.editorWorkspace.text.nodeType")}
                      value={node.kind}
                      kinds={leafKinds}
                      disabled={!tree.structurallySafe}
                      ariaInvalid={Boolean(
                        diagnosticAttributes["aria-invalid"],
                      )}
                      ariaDescribedBy={diagnosticAttributes["aria-describedby"]}
                      showExplanatoryText={showExplanatoryText}
                      onChange={(nextKind) =>
                        apply(
                          convertLayoutNode(
                            files,
                            layout,
                            layoutNodeReference(node),
                            nextKind,
                          ),
                          announce("layoutNodeConverted", nextKind),
                        )
                      }
                    />
                  )}
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
                        <HandleFieldControl
                          label={translate("ui.editorWorkspace.text.source")}
                          value={node.source ?? ""}
                          options={referenceValues("choice-source")}
                          ariaInvalid={nodeDiagnostics.length > 0}
                          ariaDescribedBy={
                            nodeDiagnostics.length
                              ? nodeDiagnosticId
                              : undefined
                          }
                          commitOnBlur
                          onChange={(nextValue) => {
                            updateLayoutField(
                              layoutNodeSymbol(layout, node),
                              "source",
                              nextValue,
                            );
                          }}
                          onBlur={onEndFieldEdit}
                        />
                        <HandleFieldControl
                          label={translate("ui.editorWorkspace.text.using")}
                          value={node.using ?? ""}
                          options={referenceValues("choice-layout")}
                          ariaInvalid={nodeDiagnostics.length > 0}
                          ariaDescribedBy={
                            nodeDiagnostics.length
                              ? nodeDiagnosticId
                              : undefined
                          }
                          createLabel={translate(
                            "ui.editorWorkspace.text.newDeclarationEllipsis",
                            {
                              declaration: translate(
                                "ui.editorWorkspace.declaration.choice-layout",
                              ),
                            },
                          )}
                          commitOnBlur
                          onChange={(nextValue) =>
                            updateLayoutField(
                              layoutNodeSymbol(layout, node),
                              "using",
                              nextValue,
                            )
                          }
                          onCreate={() =>
                            onCreateReference(
                              layoutNodeSymbol(layout, node),
                              "using",
                              0,
                              "choice-layout",
                              undefined,
                              layout,
                            )
                          }
                          onBlur={onEndFieldEdit}
                        />
                      </div>
                    ) : (
                      <HandleFieldControl
                        key={`${node.id}:${node.target}`}
                        label={translate(
                          "ui.editorWorkspace.ariaLabel.layoutNodeTarget",
                          { node: displayKind(node.kind) },
                        )}
                        value={node.target ?? ""}
                        options={nodeReferenceValues}
                        ariaInvalid={nodeDiagnostics.length > 0}
                        ariaDescribedBy={
                          nodeDiagnostics.length ? nodeDiagnosticId : undefined
                        }
                        createLabel={
                          ["text", "image", "input"].includes(node.kind) &&
                          compatibleContentOwners(
                            node.kind as LayoutContentCreationRequest["kind"],
                          ).length > 0
                            ? translate(
                                "ui.editorWorkspace.text.newDeclarationEllipsis",
                                { declaration: displayKind(node.kind) },
                              )
                            : undefined
                        }
                        commitOnBlur
                        onChange={(nextValue) =>
                          apply(
                            setLayoutNodeTarget(
                              files,
                              layout,
                              layoutNodeReference(node),
                              nextValue,
                            ),
                            announce("layoutNodeUpdated", node.kind),
                          )
                        }
                        onCreate={
                          ["text", "image", "input"].includes(node.kind) &&
                          compatibleContentOwners(
                            node.kind as LayoutContentCreationRequest["kind"],
                          ).length > 0
                            ? () =>
                                setContentCreation({
                                  kind: node.kind as LayoutContentCreationRequest["kind"],
                                  node: layoutNodeReference(node),
                                })
                            : undefined
                        }
                      />
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
                      onKeyDown={(event) =>
                        openContextMenuFromKeyboard(event, menu)
                      }
                      onClick={startMove}
                    >
                      {translate("ui.editorWorkspace.text.moveEllipsis")}
                    </button>
                    {hasEditableFields ? (
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
                        onClick={togglePresentation}
                      >
                        ◫
                      </button>
                    ) : (
                      <span
                        className="editor-layout-action-presentation-placeholder"
                        aria-hidden="true"
                      />
                    )}
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
                      onClick={() => reorder("up")}
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
                      onClick={() => reorder("down")}
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
                      onClick={remove}
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
                        onCreateTheme={(nodeSymbol, field, color) =>
                          onCreateReference(
                            nodeSymbol,
                            field,
                            0,
                            "theme",
                            { color },
                            layout,
                          )
                        }
                        onUpdate={updateLayoutField}
                        showExplanatoryText={showExplanatoryText}
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
              <LayoutNodeKindControl
                label={translate("ui.editorWorkspace.text.newNodeType")}
                value={
                  allowedKinds.includes(newKind) ? newKind : allowedKinds[0]
                }
                kinds={allowedKinds}
                showExplanatoryText={showExplanatoryText}
                onChange={(nextKind) => {
                  setNewKind(nextKind);
                  setNewTarget(nextKind === "slot" ? (slots[0] ?? "") : "");
                }}
              />
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
                    <HandleFieldControl
                      label={translate("ui.editorWorkspace.text.target")}
                      value={newTarget}
                      options={targetValues}
                      createLabel={
                        ["text", "image", "input"].includes(newKind) &&
                        compatibleContentOwners(
                          newKind as LayoutContentCreationRequest["kind"],
                        ).length > 0
                          ? translate(
                              "ui.editorWorkspace.text.newDeclarationEllipsis",
                              { declaration: displayKind(newKind) },
                            )
                          : undefined
                      }
                      onChange={setNewTarget}
                      onCreate={
                        ["text", "image", "input"].includes(newKind) &&
                        compatibleContentOwners(
                          newKind as LayoutContentCreationRequest["kind"],
                        ).length > 0
                          ? () =>
                              setContentCreation({
                                kind: newKind as LayoutContentCreationRequest["kind"],
                                node: null,
                              })
                          : undefined
                      }
                    />
                  )}
                </label>
              )}
              {newKind === "expand" && (
                <>
                  <label>
                    <span>{translate("ui.editorWorkspace.text.source")}</span>
                    <HandleFieldControl
                      label={translate("ui.editorWorkspace.text.source")}
                      value={newSource}
                      options={referenceValues("choice-source")}
                      onChange={setNewSource}
                    />
                  </label>
                  <label>
                    <span>{translate("ui.editorWorkspace.text.using")}</span>
                    <HandleFieldControl
                      label={translate("ui.editorWorkspace.text.using")}
                      value={newUsing}
                      options={referenceValues("choice-layout")}
                      onChange={setNewUsing}
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
            </div>
          )}
        </>
      )}
      {contentCreation && (
        <LayoutContentCreationDialog
          kind={contentCreation.kind}
          owners={compatibleContentOwners(contentCreation.kind)}
          ownerLabel={(owner) => layoutContentOwnerLabel(files, symbols, owner)}
          onCancel={() => setContentCreation(null)}
          onCreate={(owner) => createAndAssignContent(contentCreation, owner)}
        />
      )}
    </section>
  );
}

function LayoutContentCreationDialog({
  kind,
  owners,
  ownerLabel,
  onCancel,
  onCreate,
}: {
  kind: LayoutContentCreationRequest["kind"];
  owners: readonly FormatSymbol[];
  ownerLabel: (owner: FormatSymbol) => string;
  onCancel: () => void;
  onCreate: (owner: FormatSymbol) => boolean;
}) {
  const [ownerKey, setOwnerKey] = useState(
    owners[0] ? `${owners[0].file}:${owners[0].from}` : "",
  );
  const headingId = `editor-create-layout-${kind}-heading`;
  return (
    <div className="editor-departure-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <p>{translate("ui.editorWorkspace.text.layoutContentTarget")}</p>
        <h2 id={headingId}>
          {translate("ui.editorWorkspace.text.createDeclaration", {
            declaration: translate(`ui.editorWorkspace.declaration.${kind}`),
          })}
        </h2>
        <form
          className="editor-resource-form"
          onSubmit={(event) => {
            event.preventDefault();
            const owner = owners.find(
              (candidate) => `${candidate.file}:${candidate.from}` === ownerKey,
            );
            if (owner) onCreate(owner);
          }}
        >
          <label>
            <span>{translate("ui.editorWorkspace.text.addTo")}</span>
            <select
              autoFocus
              required
              value={ownerKey}
              onChange={(event) => setOwnerKey(event.target.value)}
            >
              {owners.map((owner) => (
                <option
                  key={`${owner.file}:${owner.from}`}
                  value={`${owner.file}:${owner.from}`}
                >
                  {ownerLabel(owner)}
                </option>
              ))}
            </select>
          </label>
          <p className="editor-layout-content-explanation">
            {translate(
              "ui.editorWorkspace.text.layoutContentCreationExplanation",
            )}
          </p>
          <div className="editor-resource-form-actions">
            <button type="submit">
              {translate("ui.editorWorkspace.text.createAndUseDeclaration", {
                declaration: translate(
                  `ui.editorWorkspace.declaration.${kind}`,
                ),
              })}
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

const optionalDetailSectionKinds = new Set(["jump", "section"]);

function CollapsibleFormSection({
  className,
  contentClassName,
  label,
  open,
  disclosureId,
  appearanceGroup,
  children,
  onToggle,
}: {
  className?: string;
  contentClassName?: string;
  label: ReactNode;
  open: boolean;
  disclosureId?: string;
  appearanceGroup?: string;
  children: ReactNode;
  onToggle: (open: boolean) => void;
}) {
  return (
    <DisclosureSection
      className={`editor-form-card editor-collapsible-form-section${
        className ? ` ${className}` : ""
      }`}
      dataDisclosureSection={disclosureId}
      dataAppearanceGroup={appearanceGroup}
      open={open}
      onToggle={onToggle}
      label={<h3>{label}</h3>}
    >
      <div
        className={`editor-collapsible-form-section-content${
          contentClassName ? ` ${contentClassName}` : ""
        }`}
      >
        {children}
      </div>
    </DisclosureSection>
  );
}

function StructuredPanel({
  packageName,
  diagnostics,
  symbol,
  files,
  assets,
  tagDefinitions,
  collapseOptionalSectionsInitially,
  optionalDisclosureState,
  onOptionalDisclosureChange,
  showExplanatoryText,
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
  onCreateReference,
  onOpenCreatedContent,
  onImportAsset,
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
  tagDefinitions: Readonly<Record<string, TagDefinition>>;
  collapseOptionalSectionsInitially: boolean;
  optionalDisclosureState: StructuredDisclosureState;
  onOptionalDisclosureChange: (section: string, expanded: boolean) => void;
  showExplanatoryText: boolean;
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
  onCreateReference: (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
    kind: CreatableTopLevelDeclarationKind,
    options?: { color?: string },
    returnTarget?: FormatSymbol,
  ) => void;
  onOpenCreatedContent: (
    target: FormatSymbol,
    returnTarget: FormatSymbol,
    focusField: string | null,
  ) => void;
  onImportAsset: (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
  ) => void;
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
  const optionalDisclosureExpanded = (
    section: string,
    defaultExpanded = !collapseOptionalSectionsInitially,
  ) => optionalDisclosureState[section] ?? defaultExpanded;
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
  const resolvedContext = structuredContext(files, symbol);
  const handle = field("handle");
  const name = handleIdentityDeclarations.has(symbol.kind)
    ? handle
    : field("name") || (symbol.kind === "jump" ? packageName : handle);
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
  const awardDetailFields = ["choice", "grant"].includes(symbol.kind)
    ? detailFields.filter((item) =>
        ["form", "companion", "measure"].includes(item),
      )
    : [];
  const unorderedOrdinaryDetailFields = detailFields.filter(
    (item) => !awardDetailFields.includes(item),
  );
  const choiceSelection = field("selection") || "toggle";
  const choiceBehaviorFieldOrder =
    choiceSelection === "select"
      ? ["selection", "continuity", "resolution", "placeholder", "option"]
      : [
          "selection",
          "resolution",
          "min",
          "max",
          "placeholder",
          "continuity",
          "option",
        ];
  const choiceDetailOrder = [
    "layout",
    "tag",
    "group",
    ...choiceBehaviorFieldOrder,
  ];
  const ordinaryDetailFields =
    symbol.kind === "choice"
      ? [
          ...choiceDetailOrder.filter((item) =>
            unorderedOrdinaryDetailFields.includes(item),
          ),
          ...unorderedOrdinaryDetailFields.filter(
            (item) => !choiceDetailOrder.includes(item),
          ),
        ]
      : unorderedOrdinaryDetailFields;
  const childKinds = resolvedContext?.childKinds ?? [];
  const structuredAnalysis = service.analyze(files);
  const symbols = structuredAnalysis.symbols;
  const inputOwner =
    symbol.kind === "input"
      ? [...(resolvedContext?.ancestors ?? [])]
          .reverse()
          .find((ancestor) => ancestor.kind === "choice")
      : undefined;
  const inputOwnerChoice = inputOwner?.handle
    ? structuredAnalysis.packageItem.choices.find(
        (choice) => choice.handle === inputOwner.handle,
      )
    : undefined;
  const inputLayoutHandle =
    inputOwnerChoice?.layout ??
    structuredAnalysis.packageItem.defaultChoiceLayout;
  const inputLayoutSymbol = inputLayoutHandle
    ? symbols.find(
        (candidate) =>
          candidate.kind === "choice-layout" &&
          candidate.handle === inputLayoutHandle,
      )
    : undefined;
  const inputLayoutTree = inputLayoutSymbol
    ? createLayoutEditorTree(files, inputLayoutSymbol)
    : null;
  const inputPlaced =
    symbol.kind === "input" &&
    Boolean(
      inputLayoutTree &&
      Object.values(inputLayoutTree.nodes).some(
        (node) => node.kind === "input" && node.target === handle,
      ),
    );
  const inputLayoutRoot =
    inputLayoutTree?.rootId && inputLayoutTree.structurallySafe
      ? inputLayoutTree.nodes[inputLayoutTree.rootId]
      : undefined;
  const primaryTagSuggestions = [...primaryTagIds].flatMap((tagId) => {
    const tag = tagDefinitions[tagId];
    return tag
      ? [
          {
            value: tag.id,
            label: tag.label,
            description: translate(
              "ui.editorWorkspace.setFields.primaryTagSuggestion",
            ),
          },
        ]
      : [];
  });
  const packageGroups = symbols
    .filter((candidate) => ["choice", "choice-source"].includes(candidate.kind))
    .flatMap((candidate) =>
      readSourceFields(files[candidate.file], candidate, "group"),
    )
    .filter(
      (group, index, groups) =>
        Boolean(group.trim()) && groups.indexOf(group) === index,
    );
  const groupSuggestions = packageGroups.map((group) => ({
    value: group,
    label: group,
    description: translate(
      "ui.editorWorkspace.setFields.existingPackageGroupSuggestion",
    ),
  }));
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
    ? readSourceField(files[owningControl.file], owningControl, "selection") ||
      (owningControl.kind === "choice" ? "toggle" : "")
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
  const shortcutCompatibility = {
    form: directGrants.length === 1 && directGrants[0] === "perk",
    companion: directGrants.length === 1 && directGrants[0] === "perk",
    measure:
      field("selection") === "integer" &&
      directGrants.length === 1 &&
      ["perk", "item"].includes(directGrants[0]),
  } as const;
  const conditionEntry = conditionNodeEntries(structuredAnalysis.parsed).find(
    ({ node }) =>
      node.kind === symbol.kind &&
      node.range.file === symbol.file &&
      node.range.from === symbol.from,
  );
  const contextualConditionHandles = conditionEntry
    ? conditionContextHandles(
        conditionEntry.node,
        conditionEntry.parent,
        conditionEntry.ancestors,
      )
    : [];
  const contextualControlProperties = conditionEntry
    ? conditionControlProperties(
        conditionEntry.node,
        conditionEntry.parent,
        conditionEntry.ancestors,
      )
    : [];
  const contextualProperties = [
    ...allConditionProperties.filter(
      (property) =>
        property.category === "context" &&
        contextualConditionHandles.some((handle) => handle === property.handle),
    ),
    ...contextualControlProperties,
  ];
  const contextualPropertyHandles = new Set(
    contextualProperties.map((property) => property.handle),
  );
  const conditionProperties = [
    ...contextualProperties,
    ...allConditionProperties.filter(
      (property) =>
        property.category !== "context" &&
        !contextualPropertyHandles.has(property.handle),
    ),
  ];
  const renderField = (fieldName: string) => {
    const presentation =
      symbol.kind === "jump-appearance"
        ? {
            label: translate(`ui.editorWorkspace.appearanceField.${fieldName}`),
          }
        : editorFieldPresentation(symbol.kind, fieldName);
    const fieldLabel =
      symbol.kind === "grant" &&
      fieldName === "handle" &&
      field("kind") === "property" &&
      field("value") === "" &&
      owningControl
        ? translate("ui.editorWorkspace.namedValues.answerName")
        : symbol.kind === "choice-source" && fieldName === "group"
          ? translate("ui.editorWorkspace.setFields.choiceSourceGroupLabel")
          : presentation.label;
    const fieldHelp = showExplanatoryText
      ? symbol.kind === "grant" &&
        fieldName === "handle" &&
        field("kind") === "property" &&
        field("value") === "" &&
        owningControl
        ? translate("ui.editorWorkspace.namedValues.answerNameHelp")
        : symbol.kind === "choice-source" && fieldName === "group"
          ? translate("ui.editorWorkspace.setFields.choiceSourceGroupHelp")
          : presentation.help
      : undefined;
    const controlLabel = fieldLabel;
    const definition =
      resolvedContext?.fields[fieldName] ??
      fieldDefinition(symbol.kind, fieldName);
    const fieldRequired = Boolean(definition?.required);
    const defaultValue = fieldDefault(symbol.kind, fieldName, {
      gauntlet: field("gauntlet"),
      selection: field("selection"),
      grantKind: field("kind"),
      integerVisibleGrant: String(integerVisibleGrant),
      sectionLayout: jumpField("section-layout"),
      choiceLayout: jumpField("choice-layout"),
      traitLayout: jumpField("trait-layout"),
    });
    const shadowText =
      defaultShadowText(defaultValue) ??
      (symbol.kind === "choice" &&
      fieldName === "continuity" &&
      field("selection") === "select"
        ? translate("ui.editorWorkspace.defaultValue.notGenderSelection")
        : ["choice", "input"].includes(symbol.kind) && fieldName === "min"
          ? translate("ui.editorWorkspace.defaultValue.unboundedMinimum")
          : ["choice", "input"].includes(symbol.kind) && fieldName === "max"
            ? translate("ui.editorWorkspace.defaultValue.unboundedMaximum")
            : undefined);
    const referenceKind = definition?.type?.startsWith("handleReference:")
      ? definition.type.slice("handleReference:".length)
      : null;
    const referenceSymbolKinds: Readonly<Record<string, readonly string[]>> = {
      form: ["grant"],
      companionTarget: ["grant", "choice"],
      "owner-local-content": ["text", "image", "input"],
      "choice-placement": ["choice"],
    };
    const referenceCandidates = referenceKind
      ? symbols
          .filter((candidate) =>
            (referenceSymbolKinds[referenceKind] ?? [referenceKind]).includes(
              candidate.kind,
            ),
          )
          .filter((candidate) => {
            if (referenceKind === "choice")
              return candidate.kind === "choice" && candidate.depth === 0;
            if (referenceKind === "form")
              return (
                readSourceField(files[candidate.file], candidate, "kind") ===
                "form"
              );
            if (referenceKind === "companionTarget")
              return candidate.kind === "choice"
                ? readSourceField(
                    files[candidate.file],
                    candidate,
                    "selection",
                  ) === "companions"
                : readSourceField(files[candidate.file], candidate, "kind") ===
                    "companion";
            if (referenceKind === "choice-placement")
              return candidate.depth > 0;
            return true;
          })
      : [];
    const referenceOptions = [
      ...(referenceKind === "resource" ? ["jump_points"] : []),
      ...referenceCandidates.flatMap((candidate) =>
        candidate.handle ? [candidate.handle] : [],
      ),
      ...(definition?.type === "quotedString:assetRelativePath" ? assets : []),
      ...(["costAmount", "grantAmount"].includes(definition?.type ?? "")
        ? fieldValues(definition)
        : []),
    ].filter((option, index, options) => options.indexOf(option) === index);
    const referenceSuggestions = referenceOptions.map((value) => {
      if (value === "jump_points")
        return {
          value,
          label: value,
          description: translate(
            "ui.editorWorkspace.reference.primaryPointCurrency",
          ),
        };
      const candidate = referenceCandidates.find(
        (item) => item.handle === value,
      );
      if (!candidate) return { value, label: value };
      if (
        candidate.kind === "choice" &&
        readSourceField(files[candidate.file], candidate, "selection") ===
          "companions"
      )
        return {
          value,
          label: value,
          description: translate(
            "ui.editorWorkspace.reference.importedCompanionChoice",
            {
              name: candidate.name ?? value,
            },
          ),
        };
      const kind =
        candidate.kind === "grant"
          ? editorOptionPresentation(
              "grant",
              "kind",
              readSourceField(files[candidate.file], candidate, "kind"),
            ).label
          : editorDeclarationLabel(candidate.kind);
      return {
        value,
        label: value,
        description: candidate.name
          ? translate("ui.editorWorkspace.reference.kindAndName", {
              kind,
              name: candidate.name,
            })
          : kind,
      };
    });
    const referenceCreationKind: CreatableTopLevelDeclarationKind | null =
      referenceKind &&
      ["section-layout", "choice-layout", "trait-layout"].includes(
        referenceKind,
      )
        ? (referenceKind as CreatableTopLevelDeclarationKind)
        : referenceKind === "choice" &&
            symbol.kind === "choice" &&
            symbol.depth > 0
          ? "choice"
          : null;
    const createsResource =
      referenceKind === "resource" &&
      fieldName === "resource" &&
      ["cost", "grant"].includes(symbol.kind);
    const createdDeclarationKind = createsResource
      ? "resource"
      : referenceCreationKind;
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
    const alignFieldRows =
      !definition?.repeatable && !definition?.conditionalVariants;
    const setKind =
      fieldName === "tag" && ["choice", "grant"].includes(symbol.kind)
        ? ("tag" as const)
        : fieldName === "group" && symbol.kind === "choice"
          ? ("group" as const)
          : fieldName === "author" && symbol.kind === "jump"
            ? ("author" as const)
            : null;
    const fieldDiagnostics = (occurrence: number) =>
      diagnostics.filter(
        (diagnostic) =>
          diagnostic.target?.file === symbol.file &&
          diagnostic.target.declarationFrom === symbol.from &&
          diagnostic.target.field === fieldName &&
          diagnostic.target.part !== "condition" &&
          (diagnostic.target.occurrence ?? 0) === occurrence,
      );
    if (setKind) {
      const setLabel = translate(
        `ui.editorWorkspace.setFields.${setKind}.label`,
      );
      const suggestionOptions =
        setKind === "tag"
          ? primaryTagSuggestions
          : setKind === "group"
            ? groupSuggestions
            : [];
      const tagDefinitionForValue = (value: string) => {
        const identity = normalizeTag(value);
        const profileEntry = Object.values(tagDefinitions).find(
          (entry) =>
            normalizeTag(entry.id) === identity ||
            normalizeTag(entry.label) === identity ||
            entry.aliases.some((alias) => normalizeTag(alias) === identity),
        );
        const known = profileEntry
          ? tagDefinitions[profileEntry.id]
          : undefined;
        const fallback = tagDefinitions.miscellaneous;
        return (
          known ?? {
            ...(fallback ?? {
              color: "#68707c",
              to: "#454b54",
              style: "soft" as const,
            }),
            id: value,
            label: value,
            parent: "miscellaneous",
            aliases: [],
          }
        );
      };
      return (
        <SetFieldControl
          key={fieldName}
          kind={setKind}
          fieldName={fieldName}
          label={setLabel}
          help={translate(`ui.editorWorkspace.setFields.${setKind}.help`)}
          showHelp={showExplanatoryText}
          values={values}
          suggestions={suggestionOptions}
          placeholder={translate(
            `ui.editorWorkspace.setFields.${setKind}.placeholder`,
          )}
          addLabel={translate(`ui.editorWorkspace.setFields.${setKind}.add`)}
          addedListLabel={translate(
            `ui.editorWorkspace.setFields.${setKind}.addedList`,
          )}
          emptyValueLabel={translate(
            `ui.editorWorkspace.setFields.${setKind}.emptyValue`,
          )}
          removeLabel={(value) =>
            translate(`ui.editorWorkspace.setFields.${setKind}.remove`, {
              value,
            })
          }
          normalize={
            setKind === "author"
              ? (value) => value.trim().normalize("NFKC").toLocaleLowerCase()
              : normalizeTag
          }
          renderValue={
            setKind === "tag"
              ? (value, removeAction) => (
                  <CanonicalTrackerTagBadge
                    tag={tagDefinitionForValue(value)}
                    trailingAction={removeAction}
                  />
                )
              : undefined
          }
          renderDetails={(_, occurrence) => {
            const matching = fieldDiagnostics(occurrence);
            if (!matching.length) return null;
            return (
              <span
                className="editor-field-diagnostics"
                id={`${listId}-${occurrence}-diagnostics`}
              >
                {matching.map((diagnostic, diagnosticIndex) => (
                  <small
                    className={`is-${diagnostic.severity}`}
                    key={`${diagnostic.code}:${diagnosticIndex}`}
                  >
                    {translateDiagnostic(diagnostic)}
                  </small>
                ))}
              </span>
            );
          }}
          onAdd={(value) => onUpdate(symbol, fieldName, value, values.length)}
          onRemove={(occurrence) => onUpdate(symbol, fieldName, "", occurrence)}
        />
      );
    }
    return (
      <div
        className={`editor-schema-field${
          [
            "description",
            "content",
            "author",
            "option",
            "tag",
            "group",
            "placeholder",
          ].includes(fieldName) ||
          (symbol.kind === "input" && fieldName === "selection") ||
          (symbol.kind === "choice" &&
            ((fieldName === "selection" &&
              !["integer", "select"].includes(choiceSelection)) ||
              (fieldName === "resolution" && choiceSelection === "select")))
            ? " is-wide"
            : ""
        }${alignFieldRows ? " is-row-aligned" : ""}`}
        data-appearance-field={
          symbol.kind === "jump-appearance" ? fieldName : undefined
        }
        data-structured-field={fieldName}
        key={fieldName}
      >
        {displayed.map((value, occurrence) =>
          (() => {
            const selectControl = createSelectControlModel(
              value,
              defaultValue,
              enumValues,
            );
            const measureUnavailable =
              !value && fieldName === "measure"
                ? symbol.kind === "choice"
                  ? choiceSelection !== "integer"
                    ? {
                        help: translate(
                          "ui.editorWorkspace.choiceShorthand.measure.selectionUnavailable",
                        ),
                        placeholder: translate(
                          "ui.editorWorkspace.choiceShorthand.measure.selectionUnavailablePlaceholder",
                        ),
                      }
                    : !shortcutCompatibility.measure
                      ? {
                          help: translate(
                            "ui.editorWorkspace.choiceShorthand.measure.awardUnavailable",
                          ),
                          placeholder: translate(
                            "ui.editorWorkspace.choiceShorthand.measure.awardUnavailablePlaceholder",
                          ),
                        }
                      : undefined
                  : symbol.kind === "grant" && ownerSelection !== "integer"
                    ? {
                        help: translate(
                          "ui.editorWorkspace.choiceShorthand.measure.ownerSelectionUnavailable",
                        ),
                        placeholder: translate(
                          "ui.editorWorkspace.choiceShorthand.measure.selectionUnavailablePlaceholder",
                        ),
                      }
                    : undefined
                : undefined;
            const effectiveFieldHelp = measureUnavailable?.help ?? fieldHelp;
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
            const helpId = effectiveFieldHelp
              ? `${listId}-${occurrence}-help`
              : undefined;
            const describedBy =
              [helpId, diagnosticId].filter(Boolean).join(" ") || undefined;
            const accessibility = {
              "aria-invalid": matchingDiagnostics.length ? true : undefined,
              "aria-describedby": describedBy,
            } as const;
            const emptyIncompatibleShortcut =
              !value &&
              ((symbol.kind === "choice" &&
                fieldName in shortcutCompatibility &&
                !shortcutCompatibility[
                  fieldName as keyof typeof shortcutCompatibility
                ]) ||
                (symbol.kind === "grant" &&
                  ((fieldName === "measure" && ownerSelection !== "integer") ||
                    (fieldName === "form" && Boolean(field("companion"))) ||
                    (fieldName === "companion" &&
                      field("kind") === "perk" &&
                      Boolean(field("form"))))) ||
                (symbol.kind === "cost" &&
                  fieldName === "mode" &&
                  ownerSelection !== "integer"));
            const appearanceColorStatus =
              symbol.kind === "jump-appearance" && definition?.type === "color"
                ? {
                    color: inheritedAppearanceValue(
                      fieldName,
                      structuredAnalysis.packageItem,
                    ),
                    inherited: value === "",
                  }
                : undefined;
            return (
              <div
                className={`editor-field-occurrence${fieldSeverity ? ` is-${fieldSeverity}` : ""}${measureUnavailable ? " is-unavailable" : ""}`}
                data-structured-occurrence={occurrence}
                key={`${fieldName}:${occurrence}`}
              >
                <span>
                  {fieldLabel}
                  {fieldRequired && (
                    <small>
                      {translate("ui.editorWorkspace.text.required")}
                    </small>
                  )}
                </span>
                {effectiveFieldHelp && (
                  <small
                    className={`editor-field-help${measureUnavailable ? " is-unavailable" : ""}`}
                    id={helpId}
                  >
                    {effectiveFieldHelp}
                  </small>
                )}
                {appearanceColorStatus && (
                  <span className="editor-appearance-color-status">
                    <i
                      aria-hidden="true"
                      style={{ background: appearanceColorStatus.color }}
                    />
                    <small>
                      {appearanceColorStatus.inherited
                        ? translate(
                            "ui.editorWorkspace.appearance.inheritedValue",
                            { value: appearanceColorStatus.color },
                          )
                        : translate(
                            "ui.editorWorkspace.appearance.manuallySetValue",
                          )}
                    </small>
                  </span>
                )}
                <span className="editor-schema-field-control">
                  {definition?.type === "boolean" ? (
                    <>
                      <input
                        type="checkbox"
                        autoFocus={fieldName === focusField && occurrence === 0}
                        aria-label={`${controlLabel}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
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
                      label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      choices={colorChoices}
                      allowTokens={definition?.type === "color"}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={describedBy}
                      onChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
                      onCreateTheme={(displayedColor, resolvedColor) => {
                        const color =
                          normalizeFormat1HexColor(displayedColor) ??
                          colorChoices.find(
                            (choice) => choice.value === displayedColor,
                          )?.color ??
                          appearanceColorStatus?.color ??
                          (displayedColor ? resolvedColor : undefined) ??
                          "#68707C";
                        onCreateReference(
                          symbol,
                          fieldName,
                          occurrence,
                          "theme",
                          { color },
                        );
                      }}
                      onBlur={onEndFieldEdit}
                    />
                  ) : definition?.type === "quotedString:assetRelativePath" ? (
                    <select
                      autoFocus={fieldName === focusField && occurrence === 0}
                      aria-label={`${controlLabel}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      {...accessibility}
                      onChange={(event) => {
                        if (event.target.value === importAssetOptionValue) {
                          onImportAsset(symbol, fieldName, occurrence);
                          return;
                        }
                        onUpdate(
                          symbol,
                          fieldName,
                          event.target.value,
                          occurrence,
                        );
                      }}
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
                      <option value={importAssetOptionValue}>
                        {translate(
                          "ui.editorWorkspace.text.importAssetEllipsis",
                        )}
                      </option>
                    </select>
                  ) : definition?.type === "imageDimension" ? (
                    <ImageDimensionFieldControl
                      label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      tokens={enumValues}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={describedBy}
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
                    ].includes(definition?.type ?? "") &&
                    selectControl.options.some(
                      (option) =>
                        editorOptionPresentation(symbol.kind, fieldName, option)
                          .description,
                    ) ? (
                    <FreeTextSuggestionCombobox
                      label={controlLabel}
                      value={selectControl.value}
                      placeholder={
                        measureUnavailable?.placeholder ?? shadowText
                      }
                      suggestions={[
                        ...(value && selectControl.showNotSet
                          ? [
                              {
                                value: "",
                                label: translate(
                                  "ui.editorWorkspace.text.notSet",
                                ),
                              },
                            ]
                          : []),
                        ...selectControl.options.map((option) =>
                          editorOptionPresentation(
                            symbol.kind,
                            fieldName,
                            option,
                          ),
                        ),
                      ]}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      disabled={emptyIncompatibleShortcut}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={describedBy}
                      showSuggestionsLabel={translate(
                        "ui.editorWorkspace.combobox.showSuggestionsForField",
                        { field: fieldLabel },
                      )}
                      suggestionsLabel={translate(
                        "ui.editorWorkspace.combobox.availableSuggestionsForField",
                        { field: fieldLabel },
                      )}
                      selectOnly
                      showDescriptions={showExplanatoryText}
                      onChange={(nextValue) =>
                        onUpdate(
                          symbol,
                          fieldName,
                          selectControl.authoredValue(nextValue),
                          occurrence,
                        )
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
                      aria-label={`${controlLabel}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                      disabled={emptyIncompatibleShortcut}
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
                          {
                            editorOptionPresentation(
                              symbol.kind,
                              fieldName,
                              option,
                            ).label
                          }
                        </option>
                      ))}
                    </select>
                  ) : ["description", "content"].includes(fieldName) ||
                    definition?.type === "richText" ? (
                    <InterpolatedTextArea
                      autoFocus={fieldName === focusField && occurrence === 0}
                      label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      rows={fieldName === "content" ? 6 : 3}
                      value={value}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={describedBy}
                      properties={conditionProperties}
                      showExplanatoryText={showExplanatoryText}
                      onChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
                      onBlur={onEndFieldEdit}
                    />
                  ) : definition?.type === "integer" ||
                    definition?.type === "number" ? (
                    <span className="number-stepper editor-number-stepper is-fluid">
                      <input
                        autoFocus={fieldName === focusField && occurrence === 0}
                        aria-label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
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
                        label={controlLabel}
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
                  ) : referenceKind ? (
                    <HandleFieldControl
                      label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      value={value}
                      options={referenceSuggestions}
                      placeholder={value === "" ? shadowText : undefined}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      disabled={emptyIncompatibleShortcut}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={describedBy}
                      showDescriptions={showExplanatoryText}
                      createLabel={
                        createdDeclarationKind
                          ? translate(
                              "ui.editorWorkspace.text.newDeclarationEllipsis",
                              {
                                declaration: translate(
                                  `ui.editorWorkspace.declaration.${createdDeclarationKind}`,
                                ),
                              },
                            )
                          : undefined
                      }
                      onChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
                      onCreate={
                        createdDeclarationKind
                          ? () => {
                              if (createsResource) onCreateResource(symbol);
                              else if (referenceCreationKind)
                                onCreateReference(
                                  symbol,
                                  fieldName,
                                  occurrence,
                                  referenceCreationKind,
                                );
                            }
                          : undefined
                      }
                      onBlur={onEndFieldEdit}
                    />
                  ) : symbol.kind === "choice-source" &&
                    fieldName === "group" ? (
                    <HandleFieldControl
                      label={controlLabel}
                      value={value}
                      options={packageGroups}
                      placeholder={translate(
                        "ui.editorWorkspace.setFields.choiceSourceGroupPlaceholder",
                      )}
                      autoFocus={fieldName === focusField && occurrence === 0}
                      ariaInvalid={matchingDiagnostics.length > 0}
                      ariaDescribedBy={describedBy}
                      showDescriptions={showExplanatoryText}
                      onChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
                      onBlur={onEndFieldEdit}
                    />
                  ) : ["author", "name", "title"].includes(fieldName) ? (
                    <SpellingTextInput
                      autoFocus={fieldName === focusField && occurrence === 0}
                      aria-label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      type="text"
                      value={value}
                      {...accessibility}
                      placeholder={value === "" ? shadowText : undefined}
                      list={referenceOptions.length ? listId : undefined}
                      onSpellingChange={(nextValue) =>
                        onUpdate(symbol, fieldName, nextValue, occurrence)
                      }
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
                  ) : (
                    <input
                      autoFocus={fieldName === focusField && occurrence === 0}
                      aria-label={`${controlLabel}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                      type="text"
                      spellCheck={false}
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
                  {definition?.repeatable && values.length > 0 && (
                    <button
                      type="button"
                      aria-label={translate(
                        "ui.editorWorkspace.ariaLabel.removeFieldOccurrence",
                        {
                          field: fieldLabel,
                          occurrence: occurrence + 1,
                        },
                      )}
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
                {!referenceKind && referenceOptions.length > 0 && (
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
            {fieldLabel}
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
                        field: fieldLabel,
                        occurrence: baseOccurrence + 1,
                      },
                    )}
                  </strong>
                )}
                <ConditionalVariants
                  fieldName={fieldName}
                  fieldLabel={fieldLabel}
                  showExplanatoryText={showExplanatoryText}
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
  const costAmount = field("amount");
  const costAmountIsValid =
    /^-?(?:0|[1-9][0-9]*)$/.test(costAmount) ||
    fieldValues(fieldDefinition("cost", "amount")).includes(costAmount);
  const costResource = field("resource");
  const costMode = field("mode");
  const scalarGrantKinds = ["perk", "item", "companion"];
  const grantKindValue = field("kind");
  const simpleValue =
    symbol.kind === "cost" &&
    !scalarForm &&
    (costResource === "jump_points" ||
      !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(costResource)) &&
    costMode !== "each" &&
    (authoredFieldNames ?? []).every((item) =>
      ["resource", "amount", "mode"].includes(item),
    )
      ? costAmountIsValid
        ? costAmount
        : "0"
      : symbol.kind === "grant" &&
          !scalarForm &&
          (scalarGrantKinds.includes(grantKindValue) ||
            !fieldValues(fieldDefinition("grant", "kind")).includes(
              grantKindValue,
            )) &&
          authoredFieldNames?.every((item) => item === "kind") &&
          !resolvedContext?.children.length
        ? scalarGrantKinds.includes(grantKindValue)
          ? grantKindValue
          : "perk"
        : null;
  const descriptionChild = resolvedContext?.children.find(
    (child) =>
      child.kind === "text" &&
      readSourceField(files[child.file], child, "handle") === "description",
  );
  const grantKind = symbol.kind === "grant" ? field("kind") : "";
  const canOwnDescription =
    (symbol.kind === "choice" && resolvedContext?.context === "top-level") ||
    (symbol.kind === "grant" &&
      ["perk", "item", "form", "companion", "trait"].includes(grantKind));
  const addableChildKinds =
    symbol.kind === "grant" && grantKind !== "trait"
      ? childKinds.filter((kind) => !["text", "image"].includes(kind))
      : childKinds;
  const hasAwardRecipientFields = awardDetailFields.some((fieldName) =>
    ["form", "companion"].includes(fieldName),
  );
  const hasAwardMeasureField = awardDetailFields.includes("measure");
  const awardDetailCopy =
    hasAwardRecipientFields && hasAwardMeasureField
      ? "both"
      : hasAwardRecipientFields
        ? "recipient"
        : "measure";
  const childLabel = (child: FormatSymbol) =>
    child.kind === "text" &&
    readSourceField(files[child.file], child, "handle") === "description"
      ? translate("ui.editorWorkspace.description.label")
      : symbolLabel(child);
  return (
    <div
      className="editor-structured-scroll"
      data-tour-target={
        symbol.kind === "jump"
          ? "editor-jump-details"
          : symbol.kind === "choice"
            ? resolvedContext?.context === "top-level"
              ? "editor-choice-fields"
              : "editor-section-content"
            : symbol.kind === "section"
              ? "editor-section-content"
              : symbol.kind === "jump-appearance"
                ? "editor-appearance"
                : undefined
      }
    >
      <header className="editor-structured-heading">
        <p>{editorDeclarationLabel(symbol.kind)}</p>
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
        <span>{editorDeclarationLabel(symbol.kind)}</span>
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
      {symbol.kind === "jump-appearance" ? (
        <>
          {showExplanatoryText && (
            <section className="editor-form-card">
              <p>{translate("ui.editorWorkspace.appearance.help")}</p>
              <p>{translate("ui.editorWorkspace.appearance.tagBoundary")}</p>
            </section>
          )}
          {appearanceFieldGroups.map((group) => (
            <CollapsibleFormSection
              className="editor-appearance-group"
              appearanceGroup={group.key}
              key={group.key}
              open={optionalDisclosureExpanded(
                `appearance:${group.key}`,
                !collapseOptionalSectionsInitially ||
                  group.key === "sharedColors",
              )}
              onToggle={(expanded) =>
                onOptionalDisclosureChange(`appearance:${group.key}`, expanded)
              }
              label={translate(
                `ui.editorWorkspace.appearanceGroup.${group.key}`,
              )}
            >
              {group.fields
                .filter((fieldName) => detailFields.includes(fieldName))
                .map(renderField)}
            </CollapsibleFormSection>
          ))}
        </>
      ) : isLayout ? (
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
          returnTarget={returnTarget}
          onOpenCreatedContent={onOpenCreatedContent}
          onCreateReference={onCreateReference}
          showExplanatoryText={showExplanatoryText}
        />
      ) : (
        <>
          {ordinaryDetailFields.length > 0 && !scalarForm && (
            <>
              {optionalDetailSectionKinds.has(symbol.kind) ? (
                <CollapsibleFormSection
                  disclosureId="declaration-details"
                  label={editorSectionLabel(symbol.kind)}
                  open={optionalDisclosureExpanded("declaration-details")}
                  onToggle={(expanded) =>
                    onOptionalDisclosureChange("declaration-details", expanded)
                  }
                >
                  {ordinaryDetailFields.map(renderField)}
                </CollapsibleFormSection>
              ) : (
                <section className="editor-form-card">
                  <h3>{editorSectionLabel(symbol.kind)}</h3>
                  {symbol.kind === "input" && (
                    <div className="editor-input-guidance">
                      {showExplanatoryText && (
                        <p>
                          {translate(
                            "ui.editorWorkspace.input.supportingControlHelp",
                          )}
                        </p>
                      )}
                      {!inputLayoutHandle ? (
                        <p role="status">
                          {translate(
                            "ui.editorWorkspace.input.automaticPlacement",
                          )}
                        </p>
                      ) : inputPlaced ? (
                        <p role="status">
                          {translate(
                            "ui.editorWorkspace.input.placedByLayout",
                            { layout: inputLayoutHandle },
                          )}
                        </p>
                      ) : (
                        <div className="editor-input-placement-warning">
                          <p role="alert">
                            {translate(
                              "ui.editorWorkspace.input.missingFromLayout",
                              {
                                input: handle,
                                layout: inputLayoutHandle,
                              },
                            )}
                          </p>
                          {inputLayoutSymbol && inputLayoutRoot?.container && (
                            <button
                              type="button"
                              onClick={() =>
                                onLayoutEdit(
                                  insertLayoutChild(
                                    files,
                                    inputLayoutSymbol,
                                    inputLayoutRoot,
                                    "input",
                                    { target: handle },
                                  ),
                                  translate(
                                    "ui.editorWorkspace.input.placedAnnouncement",
                                    { input: handle },
                                  ),
                                )
                              }
                            >
                              {translate(
                                "ui.editorWorkspace.input.placeInLayout",
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      {inputLayoutSymbol && (
                        <button
                          type="button"
                          onClick={() => onOpenSymbol(inputLayoutSymbol)}
                        >
                          {translate("ui.editorWorkspace.input.openLayout")}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="editor-form-grid editor-detail-fields">
                    {ordinaryDetailFields.map(renderField)}
                  </div>
                  {simpleValue !== null && (
                    <button
                      type="button"
                      onClick={() =>
                        onReplace(symbol, `${symbol.kind}: ${simpleValue}`)
                      }
                    >
                      {translate("ui.editorWorkspace.text.collapseToShorthand")}
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          {awardDetailFields.length > 0 && !scalarForm && (
            <CollapsibleFormSection
              className={
                symbol.kind === "choice"
                  ? "editor-choice-shorthand"
                  : "editor-grant-details"
              }
              contentClassName="editor-detail-fields"
              disclosureId="award-details"
              open={optionalDisclosureExpanded("award-details")}
              onToggle={(expanded) =>
                onOptionalDisclosureChange("award-details", expanded)
              }
              label={translate(
                `ui.editorWorkspace.choiceShorthand.${awardDetailCopy}Heading`,
              )}
            >
              {showExplanatoryText && (
                <p>
                  {translate(
                    `ui.editorWorkspace.choiceShorthand.${awardDetailCopy}Summary`,
                  )}
                </p>
              )}
              {awardDetailFields.map(renderField)}
            </CollapsibleFormSection>
          )}
        </>
      )}
      {!isLayout &&
        (addableChildKinds.length > 0 ||
          (canOwnDescription && !descriptionChild) ||
          Boolean(resolvedContext?.children.length)) && (
          <CollapsibleFormSection
            disclosureId="content-and-effects"
            label={translate("ui.editorWorkspace.text.contentAndDeclarations")}
            open={optionalDisclosureExpanded("content-and-effects")}
            onToggle={(expanded) =>
              onOptionalDisclosureChange("content-and-effects", expanded)
            }
          >
            {showExplanatoryText && (
              <p>
                {symbol.kind === "choice"
                  ? translate("ui.editorWorkspace.description.choiceOwnerHelp")
                  : symbol.kind === "grant"
                    ? grantKind === "trait"
                      ? translate(
                          "ui.editorWorkspace.description.traitOwnerHelp",
                        )
                      : translate(
                          "ui.editorWorkspace.description.grantOwnerHelp",
                        )
                    : translate(
                        "ui.editorWorkspace.text.addContentAndEffectsHelp",
                        { owner: editorDeclarationLabel(symbol.kind) },
                      )}
              </p>
            )}
            {Boolean(resolvedContext?.children.length) && (
              <div className="editor-child-list">
                {resolvedContext?.children.map((child, index, allChildren) => (
                  <div key={`${child.file}:${child.from}`}>
                    <button type="button" onClick={() => onOpenSymbol(child)}>
                      <span>{childLabel(child)}</span>
                      <small>
                        {child === descriptionChild
                          ? translate(
                              "ui.editorWorkspace.description.declarationLabel",
                            )
                          : editorDeclarationLabel(child.kind)}
                      </small>
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
              {canOwnDescription && !descriptionChild && (
                <button
                  type="button"
                  onClick={() => onInsertChild(symbol, "description")}
                >
                  + {translate("ui.editorWorkspace.description.label")}
                </button>
              )}
              {addableChildKinds.map((kind) => (
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
          </CollapsibleFormSection>
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
  showExplanatoryText,
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
  showExplanatoryText: boolean;
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
  const childCompletions = useMemo(() => {
    if (!symbol || !context) return [];
    const grantKind =
      symbol.kind === "grant"
        ? readSourceField(files[symbol.file], symbol, "kind")
        : "";
    const canOwnDescription =
      (symbol.kind === "choice" && context.context === "top-level") ||
      (symbol.kind === "grant" &&
        ["perk", "item", "form", "companion", "trait"].includes(grantKind));
    const hasDescription = context.children.some(
      (child) =>
        child.kind === "text" &&
        readSourceField(files[child.file], child, "handle") === "description",
    );
    const childKinds =
      symbol.kind === "grant" && grantKind !== "trait"
        ? context.childKinds.filter((kind) => !["text", "image"].includes(kind))
        : context.childKinds;
    return [
      ...(canOwnDescription && !hasDescription ? ["description"] : []),
      ...childKinds,
    ].slice(0, 8);
  }, [context, files, symbol]);
  const validItems = useMemo(
    () => [
      ...completions.map((label) => ({
        id: `field:${label}`,
        label,
        description:
          showExplanatoryText && symbol
            ? (editorFieldPresentation(symbol.kind, label).help ??
              translate("ui.editorWorkspace.text.addFieldToSelection", {
                field: editorFieldPresentation(symbol.kind, label).label,
              }))
            : symbol &&
                quickAddFieldMode(
                  source,
                  symbol,
                  label,
                  context?.fields[label],
                ) === "complete"
              ? translate("ui.editorWorkspace.text.completeField", {
                  field: label,
                })
              : translate("ui.editorWorkspace.text.addField", {
                  field: label,
                }),
        action: () => onAdd(label),
      })),
      ...childCompletions.map((label) => ({
        id: `child:${label}`,
        label:
          label === "description"
            ? translate("ui.editorWorkspace.description.label")
            : label,
        description: translate("ui.editorWorkspace.text.addContentType", {
          type:
            label === "description"
              ? translate("ui.editorWorkspace.description.declarationLabel")
              : editorDeclarationLabel(label),
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
      showExplanatoryText,
      symbol,
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
      <p>{translate("ui.editorWorkspace.text.availableHere")}</p>
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
            ? translate("ui.editorWorkspace.title.applySuggestedFix")
            : translate("ui.editorWorkspace.title.noSuggestedFixAvailable")
        }
      >
        <span>
          {translate("ui.editorWorkspace.text.quickFix")}
          <small>
            {translate("ui.editorWorkspace.text.applySuggestedFix")}
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
              <dd>{editorDeclarationLabel(symbol.kind)}</dd>
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
