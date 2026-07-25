import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import {
  codeFolding,
  foldGutter,
  foldKeymap,
  foldService,
} from "@codemirror/language";
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  search,
  setSearchQuery,
} from "@codemirror/search";
import {
  EditorSelection,
  EditorState,
  Prec,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  gutterLineClass,
  keymap,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { parseFormatFile } from "../markup";
import {
  matchesKeybinding,
  type KeybindingAction,
  type KeybindingChord,
} from "../settings/model";
import { format1DeclarationWords } from "./format1Syntax";

export type SourceSearch = {
  find: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
};

export type SourceSearchStatus = {
  current: number;
  total: number;
  valid: boolean;
  error?: string;
};

export type SourceCodeEditorHandle = {
  focus: () => void;
  findNext: () => void;
  findPrevious: () => void;
  replaceNext: () => boolean;
  replaceAll: () => boolean;
  insert: (text: string, selection?: { from: number; to?: number }) => void;
  syncExternalValue: (
    value: string,
    selection?: { from: number; to: number },
  ) => void;
  setSelectionRange: (from: number, to: number) => void;
};

type SourceCodeEditorProps = {
  file: string;
  value: string;
  searchQuery: SourceSearch;
  onSearchStatus: (status: SourceSearchStatus) => void;
  onSelectionChange: (from: number, to: number) => void;
  onChange: (value: string, continuous: boolean) => void;
  onOpenFind: () => void;
  onQuickAdd: () => void;
  onFormat: () => void;
  onQuickFix: () => void;
  onCompletion: () => void;
  onUndo: () => void;
  onRedo: () => void;
  completions: readonly string[];
  diagnostics: readonly Diagnostic[];
  keybindings: Record<KeybindingAction, KeybindingChord>;
};

function syntaxDecorations(view: EditorView) {
  const ranges: ReturnType<Decoration["range"]>[] = [];
  for (const range of view.visibleRanges) {
    let line = view.state.doc.lineAt(range.from);
    while (line.from <= range.to) {
      const text = line.text;
      const trimmed = text.trimStart();
      const indent = text.length - trimmed.length;
      if (trimmed.startsWith("#")) {
        ranges.push(
          Decoration.mark({ class: "cm-format-comment" }).range(
            line.from + indent,
            line.to,
          ),
        );
      } else {
        const word = /^([a-z][a-z0-9-]*)(?=\s|$)/i.exec(trimmed);
        if (word && format1DeclarationWords.has(word[1]))
          ranges.push(
            Decoration.mark({ class: "cm-format-declaration" }).range(
              line.from + indent,
              line.from + indent + word[1].length,
            ),
          );
        const field = /^([a-z][a-z0-9-]*)(\s+when\s+[^:]+)?\s*:/i.exec(trimmed);
        if (field) {
          ranges.push(
            Decoration.mark({ class: "cm-format-field" }).range(
              line.from + indent,
              line.from + indent + field[1].length,
            ),
          );
          if (field[2])
            ranges.push(
              Decoration.mark({ class: "cm-format-condition" }).range(
                line.from + indent + field[1].length,
                line.from + indent + field[1].length + field[2].length,
              ),
            );
        }
        for (const match of trimmed.matchAll(/"(?:\\.|[^"\\])*"/g))
          ranges.push(
            Decoration.mark({ class: "cm-format-string" }).range(
              line.from + indent + (match.index ?? 0),
              line.from + indent + (match.index ?? 0) + match[0].length,
            ),
          );
        for (const match of trimmed.matchAll(
          /\b(?:true|false|-?\d+(?:\.\d+)?)\b/g,
        ))
          ranges.push(
            Decoration.mark({ class: "cm-format-literal" }).range(
              line.from + indent + (match.index ?? 0),
              line.from + indent + (match.index ?? 0) + match[0].length,
            ),
          );
      }
      if (line.number === view.state.doc.lines) break;
      line = view.state.doc.line(line.number + 1);
    }
  }
  return Decoration.set(ranges, true);
}

const syntaxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = syntaxDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = syntaxDecorations(update.view);
    }
  },
  { decorations: (value) => value.decorations },
);

const selectionLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    build(view: EditorView) {
      const lines = new Set<number>();
      for (const range of view.state.selection.ranges) {
        const start = view.state.doc.lineAt(range.from).number;
        const end = view.state.doc.lineAt(range.to).number;
        for (let number = start; number <= end; number += 1) lines.add(number);
      }
      return Decoration.set(
        [...lines].map((number) =>
          Decoration.line({ class: "cm-selected-source-line" }).range(
            view.state.doc.line(number).from,
          ),
        ),
      );
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet)
        this.decorations = this.build(update.view);
    }
  },
  { decorations: (value) => value.decorations },
);

class SelectedSourceGutterMarker extends GutterMarker {
  elementClass = "cm-selected-source-gutter";
}
const selectedSourceGutterMarker = new SelectedSourceGutterMarker();
const selectedGutterLines = (state: EditorState) => {
  const positions = new Set<number>();
  for (const range of state.selection.ranges) {
    const start = state.doc.lineAt(range.from).number;
    const end = state.doc.lineAt(range.to).number;
    for (let number = start; number <= end; number += 1)
      positions.add(state.doc.line(number).from);
  }
  return RangeSet.of(
    [...positions]
      .sort((left, right) => left - right)
      .map((position) => selectedSourceGutterMarker.range(position)),
  );
};
const selectedGutterField = StateField.define({
  create: selectedGutterLines,
  update(value, transaction) {
    return transaction.docChanged || transaction.selection
      ? selectedGutterLines(transaction.state)
      : value;
  },
  provide: (field) => gutterLineClass.from(field),
});

const sourceSearchEffect = StateEffect.define<SearchQuery>();
const sourceSearchMark = Decoration.mark({ class: "cm-searchMatch" });
const sourceSearchActiveMark = Decoration.mark({
  class: "cm-searchMatch cm-searchMatch-selected",
});
type SourceSearchDecorationState = {
  query: SearchQuery;
  decorations: DecorationSet;
};
const buildSearchDecorations = (
  state: EditorState,
  query: SearchQuery,
): DecorationSet => {
  if (!query.valid) return Decoration.none;
  const selection = state.selection.main;
  const ranges: ReturnType<typeof sourceSearchMark.range>[] = [];
  const cursor = query.getCursor(state.doc);
  for (let match = cursor.next(); !match.done; match = cursor.next())
    ranges.push(
      (selection.from === match.value.from && selection.to === match.value.to
        ? sourceSearchActiveMark
        : sourceSearchMark
      ).range(match.value.from, match.value.to),
    );
  return Decoration.set(ranges, true);
};
const sourceSearchField = StateField.define<SourceSearchDecorationState>({
  create: () => {
    const query = new SearchQuery({ search: "" });
    return { query, decorations: Decoration.none };
  },
  update(value, transaction) {
    let query = value.query;
    for (const effect of transaction.effects)
      if (effect.is(sourceSearchEffect)) query = effect.value;
    return {
      query,
      decorations:
        transaction.docChanged || transaction.selection || query !== value.query
          ? buildSearchDecorations(transaction.state, query)
          : value.decorations,
    };
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

function searchStatus(
  view: EditorView,
  query: SearchQuery,
): SourceSearchStatus {
  if (!query.search) return { current: 0, total: 0, valid: true };
  if (!query.valid)
    return {
      current: 0,
      total: 0,
      valid: false,
      error: "Invalid regular expression",
    };
  const matches: { from: number; to: number }[] = [];
  const cursor = query.getCursor(view.state.doc);
  for (let match = cursor.next(); !match.done; match = cursor.next())
    matches.push(match.value);
  const head = view.state.selection.main.head;
  let current = matches.findIndex(
    (match) => head >= match.from && head <= match.to,
  );
  if (current < 0) current = matches.findIndex((match) => match.from >= head);
  if (current < 0 && matches.length) current = 0;
  return {
    current: matches.length ? current + 1 : 0,
    total: matches.length,
    valid: true,
  };
}

export const SourceCodeEditor = forwardRef<
  SourceCodeEditorHandle,
  SourceCodeEditorProps
>(function SourceCodeEditor(
  {
    file,
    value,
    searchQuery,
    onSearchStatus,
    onSelectionChange,
    onChange,
    onOpenFind,
    onQuickAdd,
    onFormat,
    onQuickFix,
    onCompletion,
    onUndo,
    onRedo,
    completions,
    diagnostics,
    keybindings,
  },
  forwardedRef,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changingExternally = useRef(false);
  const atomicChange = useRef(false);
  const fileStates = useRef<Record<string, EditorState>>({});
  const callbackRef = useRef({
    onSearchStatus,
    onSelectionChange,
    onChange,
    onOpenFind,
    onQuickAdd,
    onFormat,
    onQuickFix,
    onCompletion,
    onUndo,
    onRedo,
    completions,
    keybindings,
  });
  callbackRef.current = {
    onSearchStatus,
    onSelectionChange,
    onChange,
    onOpenFind,
    onQuickAdd,
    onFormat,
    onQuickFix,
    onCompletion,
    onUndo,
    onRedo,
    completions,
    keybindings,
  };
  const queryRef = useRef(new SearchQuery({ search: "" }));

  useEffect(() => {
    if (!host.current) return;
    const foldRanges = foldService.of((state, lineStart, lineEnd) => {
      const parsed = parseFormatFile(file, state.doc.toString());
      const nodes = parsed.tree.flatMap(
        function flatten(node): typeof parsed.tree {
          return [node, ...node.children.flatMap(flatten)];
        },
      );
      const node = nodes.find((item) => {
        const declarationLine = state.doc.lineAt(item.range.from);
        return declarationLine.from === lineStart && item.range.to > lineEnd;
      });
      if (!node) return null;
      return { from: lineEnd, to: Math.max(lineEnd, node.range.to) };
    });
    const createdState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        codeFolding({ placeholderText: "" }),
        foldGutter({ openText: "▾", closedText: "▸" }),
        lintGutter(),
        foldRanges,
        drawSelection(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        selectionLinePlugin,
        selectedGutterField,
        syntaxPlugin,
        sourceSearchField,
        autocompletion({
          override: [
            (context) => {
              const word = context.matchBefore(/[a-z0-9-]*/i);
              if (!word || (!context.explicit && word.from === word.to))
                return null;
              return {
                from: word.from,
                options: callbackRef.current.completions.map((label) => ({
                  label,
                  type: "property",
                })),
              };
            },
          ],
        }),
        search({ top: true }),
        EditorState.allowMultipleSelections.of(true),
        Prec.highest(
          keymap.of([
            {
              key: "Mod-z",
              run: () => {
                callbackRef.current.onUndo();
                return true;
              },
            },
            {
              key: "Mod-Shift-z",
              run: () => {
                callbackRef.current.onRedo();
                return true;
              },
            },
            {
              key: "Mod-y",
              run: () => {
                callbackRef.current.onRedo();
                return true;
              },
            },
            ...foldKeymap,
            indentWithTab,
            ...defaultKeymap,
          ]),
        ),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": `${file} source`,
          spellcheck: "false",
        }),
        Prec.highest(
          EditorView.domEventHandlers({
            keydown(event) {
              const commands: Array<[KeybindingAction, () => void]> = [
                ["find", callbackRef.current.onOpenFind],
                ["quickAdd", callbackRef.current.onQuickAdd],
                ["format", callbackRef.current.onFormat],
                ["quickFix", callbackRef.current.onQuickFix],
                ["completions", callbackRef.current.onCompletion],
              ];
              for (const [action, command] of commands) {
                if (
                  !matchesKeybinding(
                    event,
                    callbackRef.current.keybindings[action],
                  )
                )
                  continue;
                event.preventDefault();
                command();
                return true;
              }
              return false;
            },
          }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !changingExternally.current)
            callbackRef.current.onChange(
              update.state.doc.toString(),
              !atomicChange.current,
            );
          if (update.selectionSet) {
            const range = update.state.selection.main;
            callbackRef.current.onSelectionChange(range.from, range.to);
          }
          if (update.docChanged || update.selectionSet)
            callbackRef.current.onSearchStatus(
              searchStatus(update.view, queryRef.current),
            );
        }),
      ],
    });
    const retainedStates = fileStates.current;
    const retainedState = retainedStates[file];
    const state =
      retainedState?.doc.toString() === value ? retainedState : createdState;
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      if (view.current) retainedStates[file] = view.current.state;
      view.current?.destroy();
      view.current = null;
    };
    // File changes recreate the view; value updates are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    changingExternally.current = true;
    const anchor = Math.min(editor.state.selection.main.anchor, value.length);
    const head = Math.min(editor.state.selection.main.head, value.length);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      selection: EditorSelection.range(anchor, head),
    });
    changingExternally.current = false;
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const query = new SearchQuery({
      search: searchQuery.find,
      replace: searchQuery.replace,
      caseSensitive: searchQuery.caseSensitive,
      literal: !searchQuery.regexp,
      regexp: searchQuery.regexp,
      wholeWord: searchQuery.wholeWord,
    });
    queryRef.current = query;
    editor.dispatch({
      effects: [setSearchQuery.of(query), sourceSearchEffect.of(query)],
    });
    if (query.valid) {
      const first = query.getCursor(editor.state.doc).next();
      if (!first.done)
        editor.dispatch({
          selection: EditorSelection.range(first.value.from, first.value.to),
          scrollIntoView: true,
        });
    }
    onSearchStatus(searchStatus(editor, query));
  }, [searchQuery, onSearchStatus]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(setDiagnostics(editor.state, [...diagnostics]));
  }, [diagnostics]);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => view.current?.focus(),
    findNext: () => {
      if (view.current) findNext(view.current);
    },
    findPrevious: () => {
      if (view.current) findPrevious(view.current);
    },
    replaceNext: () => {
      const editor = view.current;
      if (!editor || !queryRef.current.valid || !queryRef.current.search)
        return false;
      const before = editor.state.doc.toString();
      atomicChange.current = true;
      replaceNext(editor);
      atomicChange.current = false;
      return before !== editor.state.doc.toString();
    },
    replaceAll: () => {
      const editor = view.current;
      if (!editor || !queryRef.current.valid || !queryRef.current.search)
        return false;
      const before = editor.state.doc.toString();
      atomicChange.current = true;
      replaceAll(editor);
      atomicChange.current = false;
      return before !== editor.state.doc.toString();
    },
    insert: (text: string, selection) => {
      const editor = view.current;
      if (!editor) return;
      const range = editor.state.selection.main;
      const selectionFrom = range.from + (selection?.from ?? text.length);
      const selectionTo =
        range.from + (selection?.to ?? selection?.from ?? text.length);
      atomicChange.current = true;
      editor.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: EditorSelection.range(selectionFrom, selectionTo),
      });
      atomicChange.current = false;
      editor.focus();
    },
    syncExternalValue: (nextValue, selection) => {
      const editor = view.current;
      if (!editor) return;
      const fallback = editor.state.selection.main;
      const safeFrom = Math.max(
        0,
        Math.min(selection?.from ?? fallback.from, nextValue.length),
      );
      const safeTo = Math.max(
        safeFrom,
        Math.min(selection?.to ?? fallback.to, nextValue.length),
      );
      changingExternally.current = true;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: nextValue },
        selection: EditorSelection.range(safeFrom, safeTo),
        scrollIntoView: true,
      });
      changingExternally.current = false;
      editor.focus();
    },
    setSelectionRange: (from: number, to: number) => {
      const editor = view.current;
      if (!editor) return;
      const safeFrom = Math.max(0, Math.min(from, editor.state.doc.length));
      const safeTo = Math.max(safeFrom, Math.min(to, editor.state.doc.length));
      editor.dispatch({
        selection: EditorSelection.range(safeFrom, safeTo),
        scrollIntoView: true,
      });
      editor.focus();
    },
  }));

  return <div className="editor-code-editor" ref={host} />;
});
