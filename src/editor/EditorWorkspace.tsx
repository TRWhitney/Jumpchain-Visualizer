import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { packageIsValid, type PackageDiagnostic } from "../markup";
import type { ApplicationSettings } from "../settings/model";
import { JumpPreview, type PreviewSelection } from "./JumpPreview";
import { Format1LanguageService, type FormatSymbol } from "./languageService";
import { summarizeWorkspace, type EditorWorkspaceSnapshot } from "./model";

type SaveState = "Saved" | "Saving" | "Unsaved" | "Save failed";
type NavigationTab = "content" | "files";
type EditingTab = "structured" | "source";
type ContextTab = "preview" | "properties";
type Severity = PackageDiagnostic["severity"];

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

function updateField(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
  field: string,
  value: string,
) {
  const source = files[symbol.file];
  if (source === undefined) return files;
  const declaration = source.slice(symbol.from, symbol.to);
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const rendered = [
    "handle",
    "layout",
    "selection",
    "resolution",
    "group",
    "target",
    "mode",
  ].includes(field)
    ? value
    : `"${escaped}"`;
  const pattern = new RegExp(
    `^(\\s*)${field}(?:\\s+when\\s+.+?)?:\\s*.*$`,
    "m",
  );
  const nextDeclaration = pattern.test(declaration)
    ? declaration.replace(pattern, `$1${field}: ${rendered}`)
    : declaration.replace(/^(.*\n?)/, `$1  ${field}: ${rendered}\n`);
  return {
    ...files,
    [symbol.file]:
      source.slice(0, symbol.from) + nextDeclaration + source.slice(symbol.to),
  };
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
  section: `\nsection\n  handle: new_section\n  name: "New Section"\n`,
  choice: `\nchoice\n  handle: new_choice\n  name: "New Choice"\n  selection: toggle\n  resolution: manual\n`,
  "section layout": `\nsection-layout\n  handle: new_section_layout\n  name: "New Section Layout"\n\n  stack\n    handle: root\n    gap: md\n\n    slot: name\n`,
  "choice layout": `\nchoice-layout\n  handle: new_choice_layout\n  name: "New Choice Layout"\n\n  stack\n    handle: root\n    gap: sm\n\n    slot: name\n    slot: control\n`,
  theme: `\ntheme\n  handle: new_theme\n  name: "New Theme"\n  color: "#68707c"\n`,
} as const;

export function EditorWorkspace({
  workspace,
  settings,
  saveState,
  onChange,
  onSave,
  onExport,
}: {
  workspace: EditorWorkspaceSnapshot;
  settings: ApplicationSettings;
  saveState: SaveState;
  onChange: (workspace: EditorWorkspaceSnapshot, continuous?: boolean) => void;
  onSave: () => void;
  onExport: () => void;
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
  const [file, setFile] = useState(
    Object.keys(workspace.files).includes("jump.jdef")
      ? "jump.jdef"
      : Object.keys(workspace.files)[0],
  );
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticFilters, setDiagnosticFilters] = useState<
    Record<Severity, boolean>
  >({ error: true, warning: true, info: true });
  const [showBounds, setShowBounds] = useState(false);
  const [hoveredBound, setHoveredBound] = useState<string | null>(null);
  const [history, setHistory] = useState(() => [workspace.files]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [lastValid, setLastValid] = useState(
    () => service.analyze(workspace.files).packageItem,
  );
  const sourceRef = useRef<HTMLTextAreaElement>(null);
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

  const commitFiles = (
    nextFiles: Record<string, string>,
    continuous = false,
    preserveRedo = false,
  ) => {
    if (!preserveRedo) {
      const nextHistory = [...history.slice(0, historyIndex + 1), nextFiles];
      setHistory(nextHistory.slice(-100));
      setHistoryIndex(Math.min(nextHistory.length - 1, 99));
    }
    onChange(
      {
        ...workspace,
        files: nextFiles,
        updatedAt: new Date().toISOString(),
        revision: workspace.revision + 1,
      },
      continuous,
    );
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    commitFiles(history[nextIndex], false, true);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    commitFiles(history[nextIndex], false, true);
  };

  const openSymbol = (symbol: FormatSymbol) => {
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

  const sourceKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const primary = event.metaKey || event.ctrlKey;
    if (primary && event.key.toLocaleLowerCase() === "f") {
      event.preventDefault();
      setFindOpen(true);
    } else if (primary && event.key === "Enter") {
      event.preventDefault();
      setQuickAddOpen(true);
    } else if (primary && event.key === ".") {
      event.preventDefault();
      commitFiles({
        ...workspace.files,
        [file]: service.quickFix(workspace.files[file] ?? ""),
      });
    } else if (primary && event.key === " ") {
      event.preventDefault();
      setCompletionOpen(true);
    } else if (primary && event.key.toLocaleLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (primary && event.key.toLocaleLowerCase() === "y") {
      event.preventDefault();
      redo();
    }
  };

  const symbolQuery = search.trim().toLocaleLowerCase();
  const visibleSymbols = analysis.symbols.filter(
    (symbol) =>
      symbol.depth === 0 &&
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
        <div className="editor-add-menu">
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
                    commitFiles({
                      ...workspace.files,
                      [target]:
                        (workspace.files[target] ?? "") +
                        addTemplates[kind as keyof typeof addTemplates],
                    });
                    setFile(target);
                    setAddOpen(false);
                  }}
                >
                  {kind[0].toLocaleUpperCase() + kind.slice(1)}
                </button>
              ))}
              <button type="button" onClick={() => setAddOpen(false)}>
                Asset…
              </button>
            </div>
          )}
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
              onClick={() => setNavigationTab(tab)}
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
                  setFile("jump.jdef");
                  setEditingTab(contentEditingTab);
                }}
              >
                <span>◆</span>
                <span>{summary.name}</span>
              </button>
              {declarationGroups.map(([heading, kinds]) => {
                const symbols = visibleSymbols.filter((symbol) =>
                  (kinds as readonly string[]).includes(symbol.kind),
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
                        <span aria-hidden="true">
                          {symbol.kind.includes("layout") ? "▦" : "◇"}
                        </span>
                        <span>{symbolLabel(symbol)}</span>
                      </button>
                    ))}
                  </details>
                );
              })}
              <details open>
                <summary>
                  Assets <span>{Object.keys(workspace.assets).length}</span>
                </summary>
                {Object.keys(workspace.assets).map((asset) => (
                  <button type="button" title={asset} key={asset}>
                    <span aria-hidden="true">▧</span>
                    <span>{asset}</span>
                  </button>
                ))}
              </details>
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
                <button type="button" key={path} title={path}>
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
          {(["structured", "source"] as const).map((tab) => (
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
            onUpdate={(symbol, field, value) =>
              commitFiles(
                updateField(workspace.files, symbol, field, value) as Record<
                  string,
                  string
                >,
              )
            }
            onReplace={(symbol, declaration) =>
              commitFiles({
                ...workspace.files,
                [symbol.file]:
                  workspace.files[symbol.file].slice(0, symbol.from) +
                  declaration +
                  workspace.files[symbol.file].slice(symbol.to),
              })
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
                  Find
                </button>
                <button
                  type="button"
                  aria-expanded={quickAddOpen}
                  onClick={() => setQuickAddOpen((value) => !value)}
                >
                  Quick Add
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commitFiles({
                      ...workspace.files,
                      [file]: service.format(workspace.files[file] ?? ""),
                    })
                  }
                >
                  Format
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commitFiles({
                      ...workspace.files,
                      [file]: service.quickFix(workspace.files[file] ?? ""),
                    })
                  }
                >
                  Quick Fix
                </button>
              </div>
            </div>
            {findOpen && (
              <div className="editor-find-bar">
                <label>
                  Find{" "}
                  <input
                    value={find}
                    onChange={(event) => setFind(event.target.value)}
                  />
                </label>
                <label>
                  Replace{" "}
                  <input
                    value={replace}
                    onChange={(event) => setReplace(event.target.value)}
                  />
                </label>
                <span>
                  {find
                    ? (
                        workspace.files[file]?.match(
                          new RegExp(
                            find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                            "g",
                          ),
                        ) ?? []
                      ).length
                    : 0}{" "}
                  matches
                </span>
                <button
                  type="button"
                  disabled={!find}
                  onClick={() =>
                    commitFiles({
                      ...workspace.files,
                      [file]: (workspace.files[file] ?? "").replaceAll(
                        find,
                        replace,
                      ),
                    })
                  }
                >
                  Replace all
                </button>
                <button
                  type="button"
                  aria-label="Close find"
                  onClick={() => setFindOpen(false)}
                >
                  ×
                </button>
              </div>
            )}
            <div className="editor-code-stage">
              <div className="editor-line-numbers" aria-hidden="true">
                {(workspace.files[file] ?? "").split("\n").map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <textarea
                ref={sourceRef}
                aria-label={`${file} source`}
                value={workspace.files[file] ?? ""}
                spellCheck={false}
                onKeyDown={sourceKeyDown}
                onChange={(event) =>
                  commitFiles(
                    { ...workspace.files, [file]: event.target.value },
                    true,
                  )
                }
              />
              {quickAddOpen && (
                <SourcePalette
                  title={
                    selectedSymbol
                      ? `${selectedSymbol.kind} · ${selectedSymbol.handle ?? "declaration"}`
                      : file
                  }
                  symbol={selectedSymbol}
                  onClose={() => setQuickAddOpen(false)}
                  onAdd={(field) => {
                    if (selectedSymbol)
                      commitFiles(
                        updateField(
                          workspace.files,
                          selectedSymbol,
                          field,
                          "",
                        ) as Record<string, string>,
                      );
                    setQuickAddOpen(false);
                  }}
                  onQuickFix={() => {
                    commitFiles({
                      ...workspace.files,
                      [file]: service.quickFix(workspace.files[file] ?? ""),
                    });
                    setQuickAddOpen(false);
                  }}
                  onCompletion={() => setCompletionOpen(true)}
                />
              )}
              {completionOpen && (
                <div
                  className="editor-completion-list"
                  role="listbox"
                  aria-label="All completions"
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
                  {[
                    "name",
                    "handle",
                    "layout",
                    "selection",
                    "resolution",
                    "cost",
                    "grant",
                    "input",
                    "text",
                    "image",
                  ].map((item) => (
                    <button
                      type="button"
                      role="option"
                      key={item}
                      onClick={() => setCompletionOpen(false)}
                    >
                      <code>{item}</code>
                      <small>Format 1 declaration or field</small>
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
          <PropertiesPanel summary={summary} symbol={selectedSymbol} />
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
}: {
  packageName: string;
  symbol: FormatSymbol | null;
  files: Readonly<Record<string, string>>;
  onUpdate: (symbol: FormatSymbol, field: string, value: string) => void;
  onReplace: (symbol: FormatSymbol, declaration: string) => void;
}) {
  const source = symbol ? files[symbol.file].slice(symbol.from, symbol.to) : "";
  const field = (name: string) => {
    const value =
      new RegExp(`^\\s*${name}:\\s*(.*)$`, "m").exec(source)?.[1] ?? "";
    return value.replace(/^"|"$/g, "");
  };
  if (!symbol)
    return (
      <div className="editor-empty-panel">
        <strong>No declaration selected</strong>
        <span>Choose package content from the explorer.</span>
      </div>
    );
  const handle = field("handle");
  const name = field("name") || packageName;
  const isLayout = symbol.kind.includes("layout");
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
        <button type="button">Package</button>
        <span>›</span>
        <button type="button">{symbol.kind}</button>
        {handle && (
          <>
            <span>›</span>
            <strong>{handle}</strong>
          </>
        )}
      </nav>
      <section className="editor-form-card">
        <h3>Identity</h3>
        {symbol.kind !== "jump" && (
          <label>
            Handle
            <input
              value={handle}
              onChange={(event) =>
                onUpdate(symbol, "handle", event.target.value)
              }
            />
          </label>
        )}
        <label>
          Name
          <input
            value={name}
            onChange={(event) => onUpdate(symbol, "name", event.target.value)}
          />
        </label>
        {symbol.kind === "jump" && (
          <label>
            Description
            <textarea
              rows={3}
              value={field("description")}
              onChange={(event) =>
                onUpdate(symbol, "description", event.target.value)
              }
            />
          </label>
        )}
        {symbol.kind === "jump" && (
          <div className="editor-form-grid">
            <label>
              Version
              <input
                value={field("version")}
                onChange={(event) =>
                  onUpdate(symbol, "version", event.target.value)
                }
              />
            </label>
            <label>
              Author
              <input
                value={field("author")}
                onChange={(event) =>
                  onUpdate(symbol, "author", event.target.value)
                }
              />
            </label>
          </div>
        )}
      </section>
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
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "up"))
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} down`}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "down"))
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} into a container`}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "in"))
                  }
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Move ${line.trim()} out of its container`}
                  onClick={() =>
                    onReplace(symbol, mutateLayoutNode(source, index, "out"))
                  }
                >
                  ←
                </button>
                <code>{line.trim()}</code>
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
          <button
            type="button"
            className="editor-insert-node"
            onClick={() =>
              onReplace(
                symbol,
                `${source.trimEnd()}\n\n  stack\n    handle: new_container\n    gap: md\n\n    slot: name\n`,
              )
            }
          >
            + Insert layout node
          </button>
        </section>
      ) : (
        <section className="editor-form-card">
          <h3>Presentation and behavior</h3>
          <div className="editor-form-grid">
            <label>
              Layout
              <input
                value={field("layout")}
                onChange={(event) =>
                  onUpdate(symbol, "layout", event.target.value)
                }
                placeholder="Default"
              />
            </label>
            {symbol.kind === "choice" && (
              <label>
                Selection
                <select
                  value={field("selection")}
                  onChange={(event) =>
                    onUpdate(symbol, "selection", event.target.value)
                  }
                >
                  <option>toggle</option>
                  <option>text</option>
                  <option>integer</option>
                  <option>select</option>
                </select>
              </label>
            )}
          </div>
        </section>
      )}
      <section className="editor-form-card">
        <h3>Conditional variants and content</h3>
        <p>
          Renderable text, conditions, direct choices, inputs, costs, grants,
          assets, resources, and presentation fields remain
          source-authoritative.
        </p>
        <button type="button">+ Add variant or declaration</button>
      </section>
    </div>
  );
}

function SourcePalette({
  title,
  symbol,
  onClose,
  onAdd,
  onQuickFix,
  onCompletion,
}: {
  title: string;
  symbol: FormatSymbol | null;
  onClose: () => void;
  onAdd: (field: string) => void;
  onQuickFix: () => void;
  onCompletion: () => void;
}) {
  const completions = service
    .completions(symbol?.kind ?? "jump")
    .fields.slice(0, 6);
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
      <p>Valid unused fields</p>
      {completions.map((field) => (
        <button type="button" key={field} onClick={() => onAdd(field)}>
          <span>
            <code>{field}</code>
            <small>Valid Format 1 field</small>
          </span>
          <kbd>{field[0].toLocaleUpperCase()}</kbd>
        </button>
      ))}
      {!completions.length && <small>All available fields are present.</small>}
      <p>Relevant commands</p>
      <button type="button" onClick={onQuickFix}>
        <span>
          Quick Fix<small>Write a deterministic repair</small>
        </span>
        <kbd>Ctrl/⌘ .</kbd>
      </button>
      <button type="button" onClick={onCompletion}>
        <span>
          All completions<small>Show fields, values, and handles</small>
        </span>
        <kbd>Ctrl/⌘ Space</kbd>
      </button>
    </aside>
  );
}

function PropertiesPanel({
  summary,
  symbol,
}: {
  summary: ReturnType<typeof summarizeWorkspace>;
  symbol: FormatSymbol | null;
}) {
  return (
    <div className="editor-properties-panel">
      <p>Selection</p>
      <h2>{symbol ? symbolLabel(symbol) : summary.name}</h2>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{symbol?.kind ?? "jump package"}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{symbol?.file ?? "jump.jdef"}</dd>
        </div>
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
      <p className="editor-property-note">
        Properties are derived from canonical source. Edit them in Structured or
        Source.
      </p>
    </div>
  );
}
