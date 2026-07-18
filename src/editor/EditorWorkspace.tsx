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
import { JumpPreview, type PreviewSelection } from "./JumpPreview";
import { Format1LanguageService, type FormatSymbol } from "./languageService";
import { summarizeWorkspace, type EditorWorkspaceSnapshot } from "./model";
import {
  addDocumentField,
  declarationFieldNames,
  fieldDefinition,
  quickAddFieldMode,
  readConditionalSourceFields,
  readSourceField,
  readSourceFields,
  setDocumentField,
  setConditionalDocumentField,
} from "./documentEditor";
import {
  SourceCodeEditor,
  type SourceCodeEditorHandle,
  type SourceSearchStatus,
} from "./SourceCodeEditor";
import { assignQuickAddMnemonics } from "./quickAdd";

type SaveState = "Saved" | "Saving" | "Unsaved" | "Save failed";
type NavigationTab = "content" | "files";
type EditingTab = "structured" | "source";
type ContextTab = "preview" | "properties";
type Severity = PackageDiagnostic["severity"];
type WorkspaceHistoryState = Pick<EditorWorkspaceSnapshot, "files" | "assets">;

const service = new Format1LanguageService();

const declarationGroups = [
  ["Resources", ["resource"]],
  ["Sections", ["section"]],
  ["Choices", ["choice"]],
  ["Layouts", ["section-layout", "choice-layout", "trait-layout"]],
  ["Themes", ["theme"]],
] as const;

function symbolLabel(symbol: FormatSymbol) {
  return symbol.name || symbol.handle || symbol.kind.replaceAll("-", " ");
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

type LayoutMove = "up" | "down" | "in" | "out" | "remove";

function mutateLayoutNode(source: string, lineIndex: number, move: LayoutMove) {
  const lines = source.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return source;
  const indent = line.search(/\S/);
  let blockEnd = lineIndex + 1;
  while (
    blockEnd < lines.length &&
    (!lines[blockEnd].trim() || lines[blockEnd].search(/\S/) > indent)
  )
    blockEnd += 1;
  const block = lines.slice(lineIndex, blockEnd);
  if (move === "remove") lines.splice(lineIndex, block.length);
  else if (move === "in" || move === "out") {
    if (move === "out" && indent < 2) return source;
    const prefix = move === "in" ? "  " : "";
    const adjusted = block.map((item) =>
      move === "in"
        ? prefix + item
        : item.startsWith("  ")
          ? item.slice(2)
          : item,
    );
    lines.splice(lineIndex, block.length, ...adjusted);
  } else {
    const direction = move === "up" ? -1 : 1;
    let siblingStart = move === "up" ? lineIndex - 1 : blockEnd;
    while (
      siblingStart >= 0 &&
      siblingStart < lines.length &&
      (!lines[siblingStart].trim() || lines[siblingStart].search(/\S/) > indent)
    )
      siblingStart += direction;
    if (
      siblingStart < 0 ||
      siblingStart >= lines.length ||
      lines[siblingStart].search(/\S/) !== indent
    )
      return source;
    if (move === "up") {
      let previousStart = siblingStart;
      while (
        previousStart > 0 &&
        (!lines[previousStart - 1].trim() ||
          lines[previousStart - 1].search(/\S/) > indent)
      )
        previousStart -= 1;
      const previous = lines.slice(previousStart, lineIndex);
      lines.splice(
        previousStart,
        block.length + previous.length,
        ...block,
        ...previous,
      );
    } else {
      let siblingEnd = siblingStart + 1;
      while (
        siblingEnd < lines.length &&
        (!lines[siblingEnd].trim() || lines[siblingEnd].search(/\S/) > indent)
      )
        siblingEnd += 1;
      const sibling = lines.slice(siblingStart, siblingEnd);
      lines.splice(
        lineIndex,
        block.length + sibling.length,
        ...sibling,
        ...block,
      );
    }
  }
  return lines.join("\n");
}

const addTemplates = {
  resource: `\nresource\n  handle: new_resource\n  name: "New Resource"\n  abbreviation: "NR"\n  initial: 0\n`,
  section: `\nsection\n  handle: new_section\n  name: "New Section"\n`,
  choice: `\nchoice\n  handle: new_choice\n  name: "New Choice"\n  selection: toggle\n  resolution: manual\n`,
  "section layout": `\nsection-layout\n  handle: new_section_layout\n  name: "New Section Layout"\n\n  stack\n    handle: root\n    gap: md\n\n    slot: name\n`,
  "choice layout": `\nchoice-layout\n  handle: new_choice_layout\n  name: "New Choice Layout"\n\n  stack\n    handle: root\n    gap: sm\n\n    slot: name\n    slot: control\n`,
  "trait layout": `\ntrait-layout\n  handle: new_trait_layout\n  name: "New Trait Layout"\n\n  stack\n    handle: root\n    gap: sm\n\n    slot: name\n`,
  theme: `\ntheme\n  handle: new_theme\n  name: "New Theme"\n  color: "#68707c"\n`,
} as const;

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
  const [diagnosticFilters, setDiagnosticFilters] = useState<
    Record<Severity, boolean>
  >({ error: true, warning: true, info: true });
  const [showBounds, setShowBounds] = useState(false);
  const [hoveredBound, setHoveredBound] = useState<string | null>(null);
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
    () => service.analyze(workspace.files),
    [workspace.files],
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
    () => service.analyze(service.recover(workspace.files)),
    [workspace.files],
  );
  const currentValid = packageIsValid(analysis.packageItem);
  const recoveredValid = packageIsValid(recoveredAnalysis.packageItem);
  const previewPackage = currentValid
    ? analysis.packageItem
    : recoveredValid
      ? recoveredAnalysis.packageItem
      : lastValid;
  const previewStatus = currentValid
    ? "Current source"
    : recoveredValid
      ? "Safely recovered preview"
      : "Last valid preview";
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
    return [
      ...declarationFieldNames(sourceContextSymbol.kind)
        .filter(
          (value) =>
            quickAddFieldMode(source, sourceContextSymbol, value) !== null,
        )
        .map((value) => ({ value, kind: "field" as const })),
      ...service
        .completions(sourceContextSymbol.kind)
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
          aria-label="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          aria-label="Redo"
        >
          ↷
        </button>
        {settings.editor.saveMode === "explicit" && (
          <button type="button" onClick={onSave}>
            Save
          </button>
        )}
        <button type="button" onClick={onExport}>
          Export .jmp
        </button>
        <div ref={addMenuRef} className="editor-add-menu">
          <button
            className="editor-primary-action"
            type="button"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((value) => !value)}
          >
            Add
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
                    const nextFiles = {
                      ...workspace.files,
                      [target]:
                        (workspace.files[target] ?? "") +
                        addTemplates[kind as keyof typeof addTemplates],
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
                    if (added) openSymbol(added);
                    setAddOpen(false);
                  }}
                >
                  {kind[0].toLocaleUpperCase() + kind.slice(1)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  assetInputRef.current?.click();
                }}
              >
                Asset…
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
          aria-label="Navigation"
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
              <span className="sr-only">Search package content</span>
              <input
                type="search"
                placeholder="Search content"
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
                <span>Jump details</span>
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
                        title={symbolLabel(symbol)}
                        onClick={() => openSymbol(symbol)}
                      >
                        <span>{symbolLabel(symbol)}</span>
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
                      Nested results{" "}
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
                          <span>{symbolLabel(symbol)}</span>
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
                      Assets <span>{assets.length}</span>
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
            <p>Package files</p>
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

      <section className="editor-authoring-pane" aria-label="Authoring">
        <div className="editor-tabs" role="tablist" aria-label="Editing view">
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
          <StructuredPanel
            packageName={summary.name}
            symbol={
              resolvedSelectedSymbol ??
              analysis.symbols.find((item) => item.kind === "jump") ??
              null
            }
            files={workspace.files}
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
            onAddField={(symbol, field) => {
              const result = addDocumentField(workspace.files, symbol, field);
              if (result.changed) commitFiles(result.files);
            }}
            onUpdateVariant={(symbol, field, occurrence, condition, value) => {
              const result = setConditionalDocumentField(
                workspace.files,
                symbol,
                field,
                occurrence,
                condition,
                value,
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
                  <span>Find</span>
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
                  <span>Quick Add</span>
                  <kbd aria-hidden="true">{sourceShortcutLabels.quickAdd}</kbd>
                </button>
                <button type="button" onClick={runFormat}>
                  <span>Format</span>
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
                  <span>Quick Fix</span>
                  <kbd aria-hidden="true">{sourceShortcutLabels.quickFix}</kbd>
                </button>
              </div>
            </div>
            {findOpen && (
              <div className="editor-find-bar" role="search">
                <div className="editor-find-row">
                  <div className="editor-find-field-shell">
                    <label>
                      <span className="sr-only">Find</span>
                      <input
                        autoFocus
                        placeholder="Find"
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
                      aria-label="Find options"
                    >
                      <button
                        type="button"
                        className="editor-find-mode"
                        aria-label="Match case"
                        aria-pressed={findCaseSensitive}
                        title="Match case"
                        onClick={() => setFindCaseSensitive((value) => !value)}
                      >
                        Aa
                      </button>
                      <button
                        type="button"
                        className="editor-find-mode"
                        aria-label="Match whole word"
                        aria-pressed={findWholeWord}
                        title="Match whole word"
                        onClick={() => setFindWholeWord((value) => !value)}
                      >
                        ab
                      </button>
                      <button
                        type="button"
                        className="editor-find-mode"
                        aria-label="Use regular expression"
                        aria-pressed={findRegexp}
                        title="Use regular expression"
                        onClick={() => setFindRegexp((value) => !value)}
                      >
                        .*
                      </button>
                    </div>
                  </div>
                  <div className="editor-find-navigation">
                    <button
                      type="button"
                      aria-label="Previous match"
                      disabled={!findStatus.valid || !findStatus.total}
                      onClick={() => sourceRef.current?.findPrevious()}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Next match"
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
                    <span>Replace</span>
                  </label>
                </div>
                {replaceOpen && (
                  <div className="editor-replace-row">
                    <label className="editor-replace-field-shell">
                      <span className="sr-only">Replace</span>
                      <input
                        placeholder="Replace"
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
                        Replace
                      </button>
                      <button
                        type="button"
                        disabled={!findStatus.valid || !findStatus.total}
                        onClick={() => sourceRef.current?.replaceAll()}
                      >
                        Replace all
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
                          message: diagnostic.message,
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
                  aria-label="All completions"
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
                    <strong>Completions</strong>
                    <button
                      type="button"
                      aria-label="Close completions"
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
                      <small>Format 1 {item.kind}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className={`editor-source-status ${currentValid ? "is-valid" : "is-recovered"}`}
            >
              <span>
                {currentValid
                  ? "Source parses without errors."
                  : recoveredValid
                    ? "Preview recovered a deterministic incomplete field. Source is unchanged."
                    : "Preview retains the last valid package."}
              </span>
              <strong>Preview: {previewStatus.toLocaleLowerCase()}</strong>
            </div>
          </div>
        )}
      </section>

      <aside className="editor-context-pane">
        <div className="editor-tabs" role="tablist" aria-label="Context view">
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
                <strong>Live preview</strong>
                <small>{previewStatus}</small>
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={showBounds}
                  onChange={(event) => setShowBounds(event.target.checked)}
                />{" "}
                Show bounds
              </label>
            </div>
            {showBounds && (
              <div
                className="editor-bounds-legend"
                aria-label="Layout bounds legend"
              >
                <span className="is-container">Container</span>
                <span className="is-slot">Slot</span>
                <span className="is-reference">Reference</span>
              </div>
            )}
            <div className="editor-preview-scroll">
              <JumpPreview
                packageItem={previewPackage}
                assets={workspace.assets}
                selection={selected}
                showBounds={showBounds}
                hoveredBound={hoveredBound}
                onHoveredBoundChange={setHoveredBound}
              />
            </div>
            {showBounds && (
              <output className="editor-bound-readout">
                {hoveredBound
                  ? `Hovered: ${hoveredBound}`
                  : "Hover a bound to inspect it"}
              </output>
            )}
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
        aria-label="Document diagnostics"
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
            <span>Diagnostics</span>
          </button>
          <div
            className="editor-diagnostic-filters"
            aria-label="Filter diagnostics by severity"
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
                ? priorityDiagnostic.message
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
                <span>{diagnostic.message}</span>
                <code>
                  {diagnostic.range
                    ? `${diagnostic.range.file}:${diagnostic.range.line}`
                    : diagnostic.code}
                </code>
              </button>
            ))}
            {!filteredDiagnostics.length && (
              <p>No diagnostic classes are included.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StructuredPanel({
  packageName,
  symbol,
  files,
  onUpdate,
  onReplace,
  onOpenPackage,
  onAddField,
  onUpdateVariant,
  onEndFieldEdit,
}: {
  packageName: string;
  symbol: FormatSymbol | null;
  files: Readonly<Record<string, string>>;
  onUpdate: (
    symbol: FormatSymbol,
    field: string,
    value: string,
    occurrence?: number,
  ) => void;
  onReplace: (
    symbol: FormatSymbol,
    declaration: string,
    continuous?: boolean,
  ) => void;
  onOpenPackage: () => void;
  onAddField: (symbol: FormatSymbol, field: string) => void;
  onEndFieldEdit: () => void;
  onUpdateVariant: (
    symbol: FormatSymbol,
    field: string,
    occurrence: number,
    condition: string,
    value: string,
  ) => void;
}) {
  const source = symbol ? files[symbol.file].slice(symbol.from, symbol.to) : "";
  const field = (name: string) =>
    symbol ? readSourceField(files[symbol.file], symbol, name) : "";
  if (!symbol)
    return (
      <div className="editor-empty-panel">
        <strong>No declaration selected</strong>
        <span>Choose package content from the explorer.</span>
      </div>
    );
  const handle = field("handle");
  const name = field("name") || (symbol.kind === "jump" ? packageName : handle);
  const isLayout = symbol.kind.includes("layout");
  const scalarForm = new RegExp(
    `^\\s*${symbol.kind.replaceAll("-", "\\-")}:\\s*(.+)$`,
  ).exec(source.split("\n")[0] ?? "");
  const identityFields = declarationFieldNames(symbol.kind).filter((item) =>
    ["handle", "name", "description", "author", "version"].includes(item),
  );
  const detailFields = declarationFieldNames(symbol.kind).filter(
    (item) => !identityFields.includes(item),
  );
  const childTemplates: Record<string, readonly [string, string][]> = {
    section: [
      ["Text", '\n  text\n    handle: new_text\n    content: ""\n'],
      [
        "Image",
        '\n  image\n    handle: new_image\n    src: "assets/image.png"\n    alt: ""\n',
      ],
      [
        "Choice source",
        "\n  choice-source\n    handle: new_source\n    mode: multi\n",
      ],
      [
        "Direct choice",
        "\n  choice\n    handle: new_placement\n    target: choice_handle\n",
      ],
    ],
    choice: [
      ["Text", '\n  text\n    handle: new_text\n    content: ""\n'],
      [
        "Image",
        '\n  image\n    handle: new_image\n    src: "assets/image.png"\n    alt: ""\n',
      ],
      ["Cost", "\n  cost\n    resource: jump_points\n    amount: 0\n"],
      ["Grant", '\n  grant\n    kind: perk\n    name: "New grant"\n'],
      ["Input", "\n  input\n    handle: new_input\n    selection: text\n"],
    ],
    input: [
      [
        "Grant",
        "\n  grant\n    kind: resource\n    resource: jump_points\n    amount: 0\n",
      ],
    ],
    grant: [
      ["Text", '\n  text\n    handle: new_text\n    content: ""\n'],
      [
        "Image",
        '\n  image\n    handle: new_image\n    src: "assets/image.png"\n    alt: ""\n',
      ],
    ],
  };
  const children = childTemplates[symbol.kind] ?? [];
  const renderField = (fieldName: string) => {
    const definition = fieldDefinition(symbol.kind, fieldName);
    const referenceKind = definition?.type?.startsWith("handleReference:")
      ? definition.type.slice("handleReference:".length)
      : null;
    const referenceOptions = referenceKind
      ? service
          .analyze(files)
          .symbols.filter((candidate) => candidate.kind === referenceKind)
          .flatMap((candidate) => (candidate.handle ? [candidate.handle] : []))
      : [];
    const listId =
      `editor-${symbol.file}-${symbol.from}-${fieldName}`.replaceAll(
        /[^a-zA-Z0-9_-]/g,
        "-",
      );
    const values = readSourceFields(files[symbol.file], symbol, fieldName);
    const variants = readConditionalSourceFields(
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
        {displayed.map((value, occurrence) => (
          <div
            className="editor-field-occurrence"
            key={`${fieldName}:${occurrence}`}
          >
            <span>
              {fieldName.replaceAll("-", " ")}
              {definition?.required && <small>Required</small>}
            </span>
            <span className="editor-schema-field-control">
              {definition?.type === "boolean" ? (
                <input
                  type="checkbox"
                  aria-label={`${fieldName}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                  checked={value === "true"}
                  onChange={(event) =>
                    onUpdate(
                      symbol,
                      fieldName,
                      String(event.target.checked),
                      occurrence,
                    )
                  }
                  onBlur={onEndFieldEdit}
                />
              ) : definition?.values?.length ? (
                <select
                  aria-label={`${fieldName}${definition.repeatable ? ` ${occurrence + 1}` : ""}`}
                  value={value}
                  onChange={(event) =>
                    onUpdate(symbol, fieldName, event.target.value, occurrence)
                  }
                  onBlur={onEndFieldEdit}
                >
                  {!definition?.required && <option value="">Not set</option>}
                  {definition.values.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : ["description", "content"].includes(fieldName) ||
                definition?.type === "richText" ? (
                <textarea
                  aria-label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                  rows={fieldName === "content" ? 6 : 3}
                  value={value}
                  onChange={(event) =>
                    onUpdate(symbol, fieldName, event.target.value, occurrence)
                  }
                  onBlur={onEndFieldEdit}
                />
              ) : definition?.type === "integer" ||
                definition?.type === "number" ? (
                <span className="number-stepper editor-number-stepper is-fluid">
                  <input
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
                    placeholder={
                      definition.const === undefined
                        ? undefined
                        : String(definition.const)
                    }
                    value={value}
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
                  aria-label={`${fieldName}${definition?.repeatable ? ` ${occurrence + 1}` : ""}`}
                  type="text"
                  value={value}
                  list={referenceOptions.length ? listId : undefined}
                  onChange={(event) =>
                    onUpdate(symbol, fieldName, event.target.value, occurrence)
                  }
                  onBlur={onEndFieldEdit}
                />
              )}
              {definition?.repeatable && values.length > 0 && (
                <button
                  type="button"
                  aria-label={`Remove ${fieldName} ${occurrence + 1}`}
                  onClick={() => onUpdate(symbol, fieldName, "", occurrence)}
                >
                  ×
                </button>
              )}
            </span>
            {referenceOptions.length > 0 && (
              <datalist id={listId}>
                {referenceOptions.map((option) => (
                  <option value={option} key={option} />
                ))}
              </datalist>
            )}
          </div>
        ))}
        {definition?.repeatable && (
          <button type="button" onClick={() => onAddField(symbol, fieldName)}>
            + Add {fieldName.replaceAll("-", " ")}
          </button>
        )}
        {definition?.conditionalVariants && (
          <div className="editor-conditional-variants">
            {variants.map((variant, occurrence) => (
              <div key={`${fieldName}:variant:${occurrence}`}>
                <label>
                  <span>When</span>
                  <input
                    value={variant.condition}
                    onChange={(event) =>
                      onUpdateVariant(
                        symbol,
                        fieldName,
                        occurrence,
                        event.target.value,
                        variant.value,
                      )
                    }
                    onBlur={onEndFieldEdit}
                  />
                </label>
                <label>
                  <span>Value</span>
                  <input
                    value={variant.value}
                    onChange={(event) =>
                      onUpdateVariant(
                        symbol,
                        fieldName,
                        occurrence,
                        variant.condition,
                        event.target.value,
                      )
                    }
                    onBlur={onEndFieldEdit}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${fieldName} conditional variant ${occurrence + 1}`}
                  onClick={() =>
                    onUpdateVariant(symbol, fieldName, occurrence, "", "")
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onUpdateVariant(symbol, fieldName, variants.length, "true", "")
              }
            >
              + Add conditional variant
            </button>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="editor-structured-scroll">
      <header className="editor-structured-heading">
        <p>{symbol.kind.replaceAll("-", " ")}</p>
        <h2>{name}</h2>
        <code>
          {symbol.file}:{sourceLine(files[symbol.file], symbol.from)}
        </code>
      </header>
      <nav className="editor-breadcrumbs" aria-label="Declaration breadcrumbs">
        <button type="button" onClick={onOpenPackage}>
          Package
        </button>
        <span>›</span>
        <span>{symbol.kind}</span>
        {handle && (
          <>
            <span>›</span>
            <strong>{handle}</strong>
          </>
        )}
      </nav>
      {identityFields.length > 0 && (
        <section className="editor-form-card">
          <h3>Identity</h3>
          {identityFields.map(renderField)}
        </section>
      )}
      {scalarForm && ["cost", "grant"].includes(symbol.kind) && (
        <section className="editor-form-card">
          <h3>Scalar shorthand</h3>
          <label className="editor-schema-field is-wide">
            Value
            <input
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
            Expand to fields
          </button>
        </section>
      )}
      {isLayout ? (
        <section className="editor-form-card editor-layout-structure">
          <h3>Layout tree</h3>
          <p>
            Navigate containers, slots, controls, and references. Reorder
            buttons commit through the shared source history.
          </p>
          {source.split("\n").map((line, index) =>
            /^\s{2,}(stack|inline|wrap|grid|slot|text|image|input|rule|choice|expand)/.test(
              line,
            ) ? (
              <div
                key={`${line}:${index}`}
                style={{
                  paddingInlineStart: `${Math.max(0, line.search(/\S/) - 2) * 0.45}rem`,
                }}
              >
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} up`}
                  disabled={mutateLayoutNode(source, index, "up") === source}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "up"))
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} down`}
                  disabled={mutateLayoutNode(source, index, "down") === source}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "down"))
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} into a container`}
                  disabled={mutateLayoutNode(source, index, "in") === source}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "in"))
                  }
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} out of its container`}
                  disabled={mutateLayoutNode(source, index, "out") === source}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "out"))
                  }
                >
                  ←
                </button>
                <input
                  aria-label={`${line.trim().split(/[:\s]/)[0]} layout node`}
                  value={line.trim()}
                  onChange={(event) => {
                    const lines = source.split("\n");
                    lines[index] =
                      " ".repeat(Math.max(0, line.search(/\S/))) +
                      event.target.value;
                    onReplace(symbol, lines.join("\n"), true);
                  }}
                  onBlur={onEndFieldEdit}
                />
                <button
                  type="button"
                  aria-label={`Remove ${line.trim()}`}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "remove"))
                  }
                >
                  ×
                </button>
              </div>
            ) : null,
          )}
          <div className="editor-layout-insertions">
            {[
              ["Container", "stack\n    handle: new_container\n    gap: md"],
              ["Grid", "grid\n    handle: new_grid\n    columns: 2"],
              ["Slot", "slot: name"],
              ["Text", "text: description"],
              ["Image", "image: hero"],
              ["Input", "input: value"],
              ["Rule", "rule"],
              ["Choice", "choice: placement"],
              ["Expand", "expand: source_handle"],
            ].map(([label, node]) => (
              <button
                type="button"
                key={label}
                onClick={() =>
                  onReplace(
                    symbol,
                    `${source.trimEnd()}\n\n  ${node.replaceAll("\n", "\n  ")}\n`,
                  )
                }
              >
                + {label}
              </button>
            ))}
          </div>
        </section>
      ) : (
        detailFields.length > 0 &&
        !scalarForm && (
          <section className="editor-form-card">
            <h3>Fields and behavior</h3>
            <div className="editor-form-grid">
              {detailFields.map(renderField)}
            </div>
          </section>
        )
      )}
      {children.length > 0 && (
        <section className="editor-form-card">
          <h3>Content and declarations</h3>
          <p>Add a declaration valid inside this {symbol.kind}.</p>
          <div className="editor-contextual-add">
            {children.map(([label, template]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  const indentation = " ".repeat(symbol.depth * 2);
                  const nestedTemplate = template.replaceAll(
                    /\n(?=\s*\S)/g,
                    `\n${indentation}`,
                  );
                  onReplace(symbol, `${source.trimEnd()}${nestedTemplate}`);
                }}
              >
                + {label}
              </button>
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
  const completions = useMemo(
    () =>
      (symbol
        ? declarationFieldNames(symbol.kind).filter(
            (field) => quickAddFieldMode(source, symbol, field) !== null,
          )
        : service.completions("jump").fields
      ).slice(0, 8),
    [source, symbol],
  );
  const childCompletions = useMemo(
    () => (symbol ? service.completions(symbol.kind).children.slice(0, 8) : []),
    [symbol],
  );
  const validItems = useMemo(
    () => [
      ...completions.map((label) => ({
        id: `field:${label}`,
        label,
        description:
          symbol && quickAddFieldMode(source, symbol, label) === "complete"
            ? `Complete existing field in ${title}`
            : `Add to ${title}`,
        action: () => onAdd(label),
      })),
      ...childCompletions.map((label) => ({
        id: `child:${label}`,
        label,
        description: `Insert inside ${title}`,
        action: () => onAddChild(label),
      })),
    ],
    [childCompletions, completions, onAdd, onAddChild, source, symbol, title],
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
    <aside className="editor-source-palette" aria-label="Quick add">
      <header>
        <span>
          <strong>Quick add</strong>
          <small>{title}</small>
        </span>
        <button type="button" aria-label="Close Quick Add" onClick={onClose}>
          ×
        </button>
      </header>
      <p>Valid here</p>
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
        <small>No additional declarations are valid here.</small>
      )}
      <p>Commands</p>
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
          Quick Fix<small>Write a deterministic repair</small>
        </span>
        <kbd>{shortcutLabels.quickFix}</kbd>
      </button>
      <button type="button" onClick={onCompletion}>
        <span>
          All completions<small>Show fields, values, and handles</small>
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
      <p>Selection</p>
      <h2>{asset ?? (symbol ? symbolLabel(symbol) : summary.name)}</h2>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{asset ? "asset" : (symbol?.kind ?? "jump package")}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{asset ?? symbol?.file ?? "jump.jdef"}</dd>
        </div>
        {asset && (
          <div>
            <dt>Size</dt>
            <dd>{assetBytes?.byteLength ?? 0} bytes</dd>
          </div>
        )}
        <div>
          <dt>Version</dt>
          <dd>{summary.version}</dd>
        </div>
        <div>
          <dt>Authors</dt>
          <dd>{summary.authors.join(", ")}</dd>
        </div>
        <div>
          <dt>Sections</dt>
          <dd>{summary.sectionCount}</dd>
        </div>
        <div>
          <dt>Choices</dt>
          <dd>{summary.choiceCount}</dd>
        </div>
        <div>
          <dt>Gauntlet</dt>
          <dd>{summary.nativeGauntlet ? "Native" : "No"}</dd>
        </div>
      </dl>
      {asset ? (
        <button type="button" onClick={onRemoveAsset}>
          Remove asset
        </button>
      ) : (
        <p className="editor-property-note">
          Properties are derived from canonical source. Edit them in Structured
          or Source.
        </p>
      )}
    </div>
  );
}
