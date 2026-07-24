import { useEffect, useRef, useState } from "react";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { xml, type ElementSpec } from "@codemirror/lang-xml";
import { tags } from "@lezer/highlight";
import {
  decodeSvgBytes,
  validateSvgSource,
  type SvgSourceValidation,
} from "../archive";
import type { SvgAssetEditorDocument } from "./assetEditorModel";
import { translate } from "../localization";
import { matchesKeybinding, type KeybindingChord } from "../settings/model";

const svgElements: ElementSpec[] = [
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "filter",
  "title",
  "desc",
].map((name) => ({ name, top: name === "svg" }));

const svgHighlightStyle = HighlightStyle.define([
  { tag: tags.tagName, class: "cm-svg-tag" },
  { tag: tags.attributeName, class: "cm-svg-attribute" },
  { tag: tags.string, class: "cm-svg-string" },
  { tag: tags.angleBracket, class: "cm-svg-bracket" },
  { tag: tags.comment, class: "cm-svg-comment" },
  { tag: tags.processingInstruction, class: "cm-svg-processing" },
  { tag: tags.invalid, class: "cm-svg-invalid" },
]);

export function SvgSourceEditor({
  path,
  bytes,
  document,
  readOnly,
  onCommit,
  onStatus,
  onFocusChange,
  onUndo,
  onRedo,
  findKeybinding,
}: {
  path: string;
  bytes: Uint8Array;
  document?: SvgAssetEditorDocument;
  readOnly: boolean;
  onCommit: (
    bytes: Uint8Array,
    document: SvgAssetEditorDocument | null,
    historyLabel: string,
  ) => void;
  onStatus: (status: string, invalid: boolean) => void;
  onFocusChange: (focused: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  findKeybinding: KeybindingChord;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const bytesRef = useRef(bytes);
  const timer = useRef<number | null>(null);
  const changingExternally = useRef(false);
  const callbacks = useRef({
    onCommit,
    onStatus,
    onFocusChange,
    onUndo,
    onRedo,
    findKeybinding,
  });
  const initialSource =
    document?.invalidDraft ?? decodeSvgBytes(bytes) ?? "<svg></svg>\n";
  const [validation, setValidation] = useState<SvgSourceValidation>(() =>
    validateSvgSource(initialSource),
  );

  useEffect(() => {
    bytesRef.current = bytes;
    callbacks.current = {
      onCommit,
      onStatus,
      onFocusChange,
      onUndo,
      onRedo,
      findKeybinding,
    };
  }, [
    bytes,
    findKeybinding,
    onCommit,
    onFocusChange,
    onRedo,
    onStatus,
    onUndo,
  ]);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: initialSource,
      extensions: [
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        foldGutter({ openText: "▾", closedText: "▸" }),
        lintGutter(),
        xml({ elements: svgElements }),
        syntaxHighlighting(svgHighlightStyle),
        indentOnInput(),
        search({ top: true }),
        autocompletion(),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": `${path} SVG source`,
          spellcheck: "false",
        }),
        Prec.highest(
          keymap.of([
            {
              key: "Mod-z",
              run: () => {
                callbacks.current.onUndo();
                return true;
              },
            },
            {
              key: "Mod-Shift-z",
              run: () => {
                callbacks.current.onRedo();
                return true;
              },
            },
            {
              key: "Mod-y",
              run: () => {
                callbacks.current.onRedo();
                return true;
              },
            },
            indentWithTab,
            ...completionKeymap,
            ...foldKeymap,
            ...searchKeymap,
            ...defaultKeymap,
          ]),
        ),
        EditorView.domEventHandlers({
          focus: () => callbacks.current.onFocusChange(true),
          blur: () => callbacks.current.onFocusChange(false),
          keydown: (event, view) => {
            if (!matchesKeybinding(event, callbacks.current.findKeybinding))
              return false;
            event.preventDefault();
            return openSearchPanel(view);
          },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || readOnly || changingExternally.current)
            return;
          if (timer.current) window.clearTimeout(timer.current);
          callbacks.current.onStatus("Checking SVG…", false);
          timer.current = window.setTimeout(() => {
            const source = update.state.doc.toString();
            const result = validateSvgSource(source);
            setValidation(result);
            update.view.dispatch(
              setDiagnostics(
                update.view.state,
                result.diagnostics.map((item) => ({
                  ...item,
                  source: "SVG security",
                })),
              ),
            );
            if (result.valid) {
              callbacks.current.onCommit(result.bytes, null, "Edit SVG source");
              callbacks.current.onStatus("SVG valid · Preview updated", false);
            } else {
              callbacks.current.onCommit(
                bytesRef.current,
                {
                  version: 1,
                  kind: "svg",
                  invalidDraft: source,
                },
                "Edit invalid SVG draft",
              );
              callbacks.current.onStatus(
                `${result.diagnostics.length} SVG issue${
                  result.diagnostics.length === 1 ? "" : "s"
                } · Preview kept last valid`,
                true,
              );
            }
          }, 300);
        }),
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    editor.current = view;
    const result = validateSvgSource(initialSource);
    view.dispatch(
      setDiagnostics(
        view.state,
        result.diagnostics.map((item) => ({
          ...item,
          source: "SVG security",
        })),
      ),
    );
    callbacks.current.onStatus(
      result.valid
        ? "SVG valid"
        : `${result.diagnostics.length} SVG issue${
            result.diagnostics.length === 1 ? "" : "s"
          } · Preview kept last valid`,
      !result.valid,
    );
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      view.destroy();
      editor.current = null;
    };
    // The editor is intentionally recreated for a new asset, not its own commits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly]);

  useEffect(() => {
    const view = editor.current;
    const source =
      document?.invalidDraft ?? decodeSvgBytes(bytes) ?? "<svg></svg>\n";
    if (!view || view.state.doc.toString() === source) return;
    changingExternally.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
    });
    changingExternally.current = false;
    const result = validateSvgSource(source);
    view.dispatch(
      setDiagnostics(
        view.state,
        result.diagnostics.map((item) => ({
          ...item,
          source: "SVG security",
        })),
      ),
    );
    setValidation(result);
  }, [bytes, document]);

  return (
    <div className="asset-svg-editor">
      <div className="editor-code-editor asset-svg-editor-host" ref={host} />
      <div
        className={`asset-editor-diagnostics${validation.valid ? "" : " is-invalid"}`}
        aria-live="polite"
      >
        {validation.valid ? (
          <span>
            {translate("ui.editorWorkspace.asset.editor.noSvgDiagnostics")}
          </span>
        ) : (
          <span>
            {validation.diagnostics[0]?.message ?? "SVG source is invalid."}
          </span>
        )}
      </div>
    </div>
  );
}
