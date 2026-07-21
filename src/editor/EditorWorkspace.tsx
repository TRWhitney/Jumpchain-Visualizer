import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
} from "react";
import { packageIsValid, type PackageDiagnostic } from "../markup";
import { validatePackageAsset } from "../archive";
import { NumberStepperButtons } from "../tracker/NumberStepper";
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
import {
  JumpPreview,
  type LayoutBoundHover,
  type PreviewSelection,
} from "./JumpPreview";
import { Format1LanguageService, type FormatSymbol } from "./languageService";
import { summarizeWorkspace, type EditorWorkspaceSnapshot } from "./model";
import { createSelectControlModel } from "./selectControl";
import {
  addDocumentField,
  createAndAssignDocumentResource,
  declarationFieldNames,
  fieldDefault,
  fieldDefinition,
  fieldValues,
  insertDocumentChild,
  moveDocumentChild,
  removeDocumentDeclaration,
  removeDocumentFields,
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
  layoutNodeIsContainer,
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

type SaveState = "Saved" | "Saving" | "Unsaved" | "Save failed";
type NavigationTab = "content" | "files";
type EditingTab = "structured" | "source";
type ContextTab = "preview" | "properties";
type Severity = PackageDiagnostic["severity"];
type WorkspaceHistoryState = Pick<EditorWorkspaceSnapshot, "files" | "assets">;

const service = new Format1LanguageService();

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
  ["Resources", ["resource"]],
  ["Sections", ["section"]],
  ["Choices", ["choice"]],
  ["Layouts", ["section-layout", "choice-layout", "trait-layout"]],
  ["Themes", ["theme"]],
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

function symbolLabel(symbol: FormatSymbol) {
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
  theme: `\ntheme\n  handle: new_theme\n  name: "New Theme"\n  color: "#68707c"\n`,
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
  const [contextTab, setContextTab] = useState<ContextTab>("preview");
  const [selected, setSelected] = useState<PreviewSelection>({
    kind: "package",
  });
  const [selectedSymbol, setSelectedSymbol] = useState<FormatSymbol | null>(
    null,
  );
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
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
  const [hoveredBound, setHoveredBound] = useState<LayoutBoundHover | null>(
    null,
  );
  const [history, setHistory] = useState<WorkspaceHistoryState[]>(() => [
    { files: workspace.files, assets: workspace.assets },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const historyGroupRef = useRef<string | null>(null);
  const historyGroupTimer = useRef<number | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [lastValid, setLastValid] = useState(
    () => service.analyze(workspace.files).packageItem,
  );
  const sourceRef = useRef<SourceCodeEditorHandle>(null);
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
        assetPaths: Object.keys(workspace.assets),
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
    ? (analysis.symbols.find(
        (symbol) =>
          symbol.file === selectedSymbol.file &&
          symbol.kind === selectedSymbol.kind &&
          symbol.handle === selectedSymbol.handle,
      ) ?? selectedSymbol)
    : null;
  const recoveredAnalysis = useMemo(
    () =>
      service.analyze(service.recover(workspace.files), {
        assetPaths: Object.keys(workspace.assets),
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
    selected.kind === "layout"
      ? [analysis.packageItem, recoveredAnalysis.packageItem, lastValid].find(
          (packageItem) =>
            packageItem.layouts.some(
              (layout) => layout.handle === selected.handle,
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
  ) => {
    if (
      Object.keys(nextFiles).length === Object.keys(workspace.files).length &&
      Object.entries(nextFiles).every(
        ([path, source]) => workspace.files[path] === source,
      ) &&
      Object.keys(nextAssets).length === Object.keys(workspace.assets).length &&
      Object.entries(nextAssets).every(
        ([path, bytes]) => workspace.assets[path] === bytes,
      )
    )
      return false;
    if (!preserveRedo) {
      let nextHistory: WorkspaceHistoryState[];
      let nextIndex: number;
      const entry = { files: nextFiles, assets: nextAssets };
      if (
        continuous &&
        historyGroupRef.current === historyGroup &&
        historyIndexRef.current > 0
      ) {
        nextHistory = [...historyRef.current];
        nextHistory[historyIndexRef.current] = entry;
        nextIndex = historyIndexRef.current;
      } else {
        nextHistory = [
          ...historyRef.current.slice(0, historyIndexRef.current + 1),
          entry,
        ].slice(-100);
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
    commitWorkspace(entry.files, entry.assets, false, true);
  };
  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyGroupRef.current = null;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const entry = historyRef.current[nextIndex];
    commitWorkspace(entry.files, entry.assets, false, true);
  };

  const openSymbol = (symbol: FormatSymbol) => {
    setStructuredReturnTarget(null);
    setSelectedAsset(null);
    setSelectedSymbol(symbol);
    setSelected({
      kind: ["section-layout", "choice-layout", "trait-layout"].includes(
        symbol.kind,
      )
        ? "layout"
        : symbol.kind === "section"
          ? "section"
          : symbol.kind === "choice"
            ? "choice"
            : "package",
      handle: symbol.handle,
    });
    setFile(symbol.file);
    setEditingTab(contentEditingTab);
  };

  const openFile = (nextFile: string) => {
    setFile(nextFile);
    setNavigationTab("files");
    setEditingTab("source");
    requestAnimationFrame(() => sourceRef.current?.focus());
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
    const allowed = ["png", "jpg", "jpeg", "gif", "webp", "avif"];
    const limit =
      effectivePackageSizeLimits(settings.developer).maxAssetFileMiB *
      1024 *
      1024;
    if (!extension || !allowed.includes(extension) || candidate.size > limit) {
      onFeedback("editor.asset.rejected");
      return;
    }
    try {
      const bytes = new Uint8Array(await candidate.arrayBuffer());
      const safeName = candidate.name.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
      await validatePackageAsset(`assets/${safeName}`, bytes);
      commitWorkspace(workspace.files, {
        ...workspace.assets,
        [`assets/${safeName}`]: bytes,
      });
      onFeedback("editor.asset.added");
    } catch {
      onFeedback("editor.asset.rejected");
    }
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
                  onClick={() => {
                    const target =
                      kind.includes("layout") || kind === "theme"
                        ? "layout.jdef"
                        : kind === "choice"
                          ? "choices.jdef"
                          : "jump.jdef";
                    const template = uniqueTopLevelTemplate(
                      addTemplates[kind as keyof typeof addTemplates],
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
                        (symbol) =>
                          symbol.file === target &&
                          symbol.kind === declarationKind,
                      )
                      .at(-1);
                    if (added) {
                      setStructuredFocus(
                        ["resource", "section", "choice", "theme"].includes(
                          declarationKind,
                        )
                          ? "handle"
                          : "name",
                      );
                      openSymbol(added);
                      setStructuredAnnouncement(
                        translate(
                          "ui.editorWorkspace.announcement.declarationAdded",
                          {
                            declaration: translate(
                              `ui.editorWorkspace.declaration.${declarationKind}`,
                            ),
                          },
                        ),
                      );
                    }
                    setAddOpen(false);
                  }}
                >
                  {translate(
                    `ui.editorWorkspace.declaration.${kind.replaceAll(" ", "-")}`,
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  assetInputRef.current?.click();
                }}
              >
                {translate("ui.editorWorkspace.text.asset")}
              </button>
            </div>
          )}
          <input
            ref={assetInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
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
              <button
                className={selected.kind === "package" ? "is-selected" : ""}
                type="button"
                title={summary.name}
                onClick={() => {
                  setSelected({ kind: "package" });
                  setSelectedSymbol(
                    analysis.symbols.find((symbol) => symbol.kind === "jump") ??
                      null,
                  );
                  setSelectedAsset(null);
                  setFile("jump.jdef");
                  setEditingTab(contentEditingTab);
                }}
              >
                <span>{translate("ui.editorWorkspace.text.jumpDetails")}</span>
              </button>
              {declarationGroups.map(([heading, kinds]) => {
                const symbols = visibleSymbols.filter(
                  (symbol) =>
                    (kinds as readonly string[]).includes(symbol.kind) &&
                    (symbol.depth === 0 || Boolean(symbolQuery)),
                );
                if (!symbols.length && symbolQuery) return null;
                return (
                  <details key={heading} open>
                    <summary>
                      {heading} <span>{symbols.length}</span>
                    </summary>
                    {symbols.map((symbol) => (
                      <button
                        className={
                          selectedSymbol?.file === symbol.file &&
                          selectedSymbol.from === symbol.from
                            ? "is-selected"
                            : ""
                        }
                        type="button"
                        key={`${symbol.file}:${symbol.from}`}
                        title={explorerSymbolLabel(symbol)}
                        onClick={() => openSymbol(symbol)}
                      >
                        <span>{explorerSymbolLabel(symbol)}</span>
                        {symbol.kind.includes("layout") && (
                          <small>{symbol.kind.replace("-layout", "")}</small>
                        )}
                      </button>
                    ))}
                  </details>
                );
              })}
              {symbolQuery &&
                visibleSymbols.some(
                  (symbol) =>
                    symbol.depth > 0 &&
                    !declarationGroups.some(([, kinds]) =>
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
                              !declarationGroups.some(([, kinds]) =>
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
                          !declarationGroups.some(([, kinds]) =>
                            (kinds as readonly string[]).includes(symbol.kind),
                          ),
                      )
                      .map((symbol) => (
                        <button
                          type="button"
                          key={`nested:${symbol.file}:${symbol.from}`}
                          onClick={() => openSymbol(symbol)}
                        >
                          <span>{explorerSymbolLabel(symbol)}</span>
                          <small>{symbol.kind}</small>
                        </button>
                      ))}
                  </details>
                )}
              {(() => {
                const assets = Object.keys(workspace.assets).filter(
                  (asset) =>
                    !symbolQuery ||
                    asset.toLocaleLowerCase().includes(symbolQuery),
                );
                if (!assets.length && symbolQuery) return null;
                return (
                  <details open>
                    <summary>
                      {translate("ui.editorWorkspace.text.assets")}
                      <span>{assets.length}</span>
                    </summary>
                    {assets.map((asset) => (
                      <button
                        type="button"
                        title={asset}
                        key={asset}
                        onClick={() => {
                          setSelectedAsset(asset);
                          setSelectedSymbol(null);
                          setContextTab("properties");
                        }}
                      >
                        <span>{asset}</span>
                      </button>
                    ))}
                  </details>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="editor-explorer-panel editor-file-list">
            <p>{translate("ui.editorWorkspace.text.packageFiles")}</p>
            <div className="editor-outline-scroll">
              {Object.keys(workspace.files)
                .sort()
                .map((path) => (
                  <button
                    type="button"
                    className={file === path ? "is-selected" : ""}
                    key={path}
                    title={path}
                    onClick={() => openFile(path)}
                  >
                    <span aria-hidden="true">▤</span>
                    <span>{path}</span>
                  </button>
                ))}
              {Object.keys(workspace.assets).map((path) => (
                <button
                  type="button"
                  key={path}
                  title={path}
                  onClick={() => {
                    setSelectedAsset(path);
                    setSelectedSymbol(null);
                    setContextTab("properties");
                  }}
                >
                  <span aria-hidden="true">▧</span>
                  <span>{path}</span>
                </button>
              ))}
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
          {(navigationTab === "files"
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
                if (navigationTab === "content") setContentEditingTab(tab);
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
              assets={Object.keys(workspace.assets)}
              focusField={structuredFocus}
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
                const result = addDocumentField(workspace.files, symbol, field);
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
          </>
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
        {contextTab === "preview" ? (
          <div className="editor-preview-panel">
            <div className="editor-preview-toolbar">
              <span>
                <strong>
                  {translate("ui.editorWorkspace.text.livePreview")}
                </strong>
                <small>{previewStatus}</small>
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={showBounds}
                  onChange={(event) => setShowBounds(event.target.checked)}
                />{" "}
                {translate("ui.editorWorkspace.text.showBounds")}
              </label>
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
                selection={selected}
                showBounds={showBounds}
                hoveredBound={hoveredBound}
                onHoveredBoundChange={setHoveredBound}
              />
            </div>
          </div>
        ) : (
          <PropertiesPanel
            summary={summary}
            symbol={selectedSymbol}
            asset={selectedAsset}
            assetBytes={
              selectedAsset ? workspace.assets[selectedAsset] : undefined
            }
            onRemoveAsset={() => {
              if (!selectedAsset) return;
              const nextAssets = { ...workspace.assets };
              delete nextAssets[selectedAsset];
              commitWorkspace(workspace.files, nextAssets);
              setSelectedAsset(null);
              onFeedback("editor.asset.removed");
            }}
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
          ...(definition.type === "quotedString:packageRelativeAssetPath"
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
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={fieldLabel}
                  type={definition.type === "integer" ? "number" : "text"}
                  min={definition.minimum}
                  max={definition.maximum}
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
}) {
  const tree = createLayoutEditorTree(files, layout);
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

  if (!tree) return null;

  const resolve = (reference: LayoutNodeRef | null) =>
    reference
      ? Object.values(tree.nodes).find(
          (node) =>
            node.file === reference.file &&
            node.from === reference.from &&
            node.kind === reference.kind &&
            node.compact === reference.compact,
        )
      : undefined;
  const root = tree.rootId ? tree.nodes[tree.rootId] : undefined;
  const selected = resolve(selectedContainer) ?? root;
  const selectedRef = selected ? layoutNodeReference(selected) : null;
  const edited = resolve(editingNode);
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
    if (result.target && select === "container")
      setSelectedContainer(result.target);
    if (result.target && select === "node") setEditingNode(result.target);
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
      Boolean(target.closest("[data-editor-drag-boundary]"));
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
    apply(
      moveLayoutNode(
        files,
        layout,
        layoutNodeReference(dragged),
        layoutNodeReference(destination),
      ),
      announce("layoutNodeMoved", dragged.kind),
      dragged.container ? "container" : "node",
    );
    updateDraggedNode(null);
    updateDropTarget(null);
  };

  return (
    <section className="editor-form-card editor-layout-builder">
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
                  if (next) setSelectedContainer(layoutNodeReference(next));
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
                    onClick={() =>
                      setSelectedContainer(layoutNodeReference(node))
                    }
                  >
                    {node.kind}[{node.path.match(/\[(\d+)\]$/)?.[1] ?? "1"}]
                  </button>
                </span>
              ))}
            </nav>
          </div>
          {selected && (
            <div className="editor-layout-selected-editor">
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
                  }`}
                  draggable={tree.structurallySafe && !layoutDragBoundaryActive}
                  data-layout-node-kind={node.kind}
                  data-layout-node-path={node.path}
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
                        onClick={() =>
                          setSelectedContainer(layoutNodeReference(node))
                        }
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
                    {!node.container && node.kind !== "rule" && (
                      <button
                        type="button"
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
                    )}
                    <button
                      type="button"
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
                            apply(
                              moveLayoutNode(
                                files,
                                layout,
                                layoutNodeReference(node),
                                layoutNodeReference(destination),
                              ),
                              announce("layoutNodeMoved", node.kind),
                              node.container ? "container" : "node",
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
          <label>
            <span>{translate("ui.editorWorkspace.field.initial")}</span>
            <input
              required
              type="number"
              value={initial}
              onChange={(event) => setInitial(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div>
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
  onEndFieldEdit,
}: {
  packageName: string;
  diagnostics: readonly PackageDiagnostic[];
  symbol: FormatSymbol | null;
  files: Readonly<Record<string, string>>;
  assets: readonly string[];
  focusField: string | null;
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
  const name = field("name") || (symbol.kind === "jump" ? packageName : handle);
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
  const symbols = service.analyze(files).symbols;
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
      ...(definition?.type === "quotedString:packageRelativeAssetPath"
        ? assets
        : []),
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
          <div className="editor-conditional-variants">
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
                {variants
                  .filter(
                    (variant) => variant.baseOccurrence === baseOccurrence,
                  )
                  .map((variant) => (
                    <div key={`${fieldName}:variant:${variant.occurrence}`}>
                      <label>
                        <span>{translate("ui.editorWorkspace.text.when")}</span>
                        <input
                          spellCheck={false}
                          value={variant.condition}
                          onChange={(event) =>
                            onUpdateVariant(
                              symbol,
                              fieldName,
                              variant.occurrence,
                              event.target.value,
                              variant.value,
                            )
                          }
                          onBlur={onEndFieldEdit}
                        />
                      </label>
                      <label>
                        <span>
                          {translate("ui.editorWorkspace.text.value")}
                        </span>
                        <input
                          spellCheck
                          value={variant.value}
                          onChange={(event) =>
                            onUpdateVariant(
                              symbol,
                              fieldName,
                              variant.occurrence,
                              variant.condition,
                              event.target.value,
                            )
                          }
                          onBlur={onEndFieldEdit}
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={translate(
                          "ui.editorWorkspace.ariaLabel.removeConditionalVariant",
                          {
                            field: fieldName,
                            occurrence: variant.occurrence + 1,
                          },
                        )}
                        onClick={() =>
                          onUpdateVariant(
                            symbol,
                            fieldName,
                            variant.occurrence,
                            "",
                            "",
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateVariant(
                      symbol,
                      fieldName,
                      variants.length,
                      "true",
                      "",
                      baseOccurrence,
                    )
                  }
                >
                  {translate("ui.editorWorkspace.text.addConditionalVariant")}
                </button>
              </div>
            ))}
          </div>
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
                declaration: symbolLabel(returnTarget),
              })}
            </button>
            <span>›</span>
          </>
        )}
        <button type="button" onClick={onOpenPackage}>
          {translate("ui.editorWorkspace.text.package")}
        </button>
        {resolvedContext?.ancestors
          .filter((ancestor) => ancestor.kind !== "jump")
          .map((ancestor) => (
            <span key={`${ancestor.file}:${ancestor.from}`}>
              <span>›</span>
              <button type="button" onClick={() => onOpenSymbol(ancestor)}>
                {symbolLabel(ancestor)}
              </button>
            </span>
          ))}
        <span>›</span>
        <span>{symbol.kind.replaceAll("-", " ")}</span>
        {handle && (
          <>
            <span>›</span>
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

function PropertiesPanel({
  summary,
  symbol,
  asset,
  assetBytes,
  onRemoveAsset,
}: {
  summary: ReturnType<typeof summarizeWorkspace>;
  symbol: FormatSymbol | null;
  asset: string | null;
  assetBytes?: Uint8Array;
  onRemoveAsset: () => void;
}) {
  return (
    <div className="editor-properties-panel">
      <p>{translate("ui.editorWorkspace.text.selection")}</p>
      <h2>{asset ?? (symbol ? symbolLabel(symbol) : summary.name)}</h2>
      <dl>
        <div>
          <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
          <dd>{asset ? "asset" : (symbol?.kind ?? "jump package")}</dd>
        </div>
        <div>
          <dt>{translate("ui.editorWorkspace.text.file")}</dt>
          <dd>{asset ?? symbol?.file ?? "jump.jdef"}</dd>
        </div>
        {asset && (
          <div>
            <dt>{translate("ui.editorWorkspace.text.size")}</dt>
            <dd>
              {assetBytes?.byteLength ?? 0}{" "}
              {translate("ui.editorWorkspace.text.bytes")}
            </dd>
          </div>
        )}
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
          <dd>{summary.nativeGauntlet ? "Native" : "No"}</dd>
        </div>
      </dl>
      {asset ? (
        <button type="button" onClick={onRemoveAsset}>
          {translate("ui.editorWorkspace.text.removeAsset")}
        </button>
      ) : (
        <p className="editor-property-note">
          {translate(
            "ui.editorWorkspace.text.propertiesAreDerivedFromCanonicalSourceEditThemIn",
          )}
        </p>
      )}
    </div>
  );
}
