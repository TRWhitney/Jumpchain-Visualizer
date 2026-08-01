import { useLayoutEffect, useRef } from "react";
import {
  renderStoryEditorMarkup,
  serializeStoryEditor,
  type StoryTokenType,
} from "./storyRichText";

export function StoryRichEditor({
  source,
  label,
  index,
  onChange,
  onTrackSelection,
  onKeyboardFormat,
}: {
  source: string;
  label: string;
  index: number;
  onChange: (source: string) => void;
  onTrackSelection: (editor: HTMLElement) => void;
  onKeyboardFormat: (type: StoryTokenType) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const renderedSource = useRef("");

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || renderedSource.current === source) return;
    renderStoryEditorMarkup(editor, source);
    renderedSource.current = source;
  }, [source]);

  return (
    <div
      ref={editorRef}
      className="story-rich-editor"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-story-chapter-editor={index}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      onFocus={(event) => onTrackSelection(event.currentTarget)}
      onClick={(event) => onTrackSelection(event.currentTarget)}
      onKeyUp={(event) => onTrackSelection(event.currentTarget)}
      onInput={(event) => {
        const next = serializeStoryEditor(event.currentTarget);
        renderedSource.current = next;
        onChange(next);
        onTrackSelection(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const formats: Partial<Record<string, StoryTokenType>> = {
          b: "bold",
          i: "italic",
          u: "underline",
          x: "strike",
        };
        const format = formats[event.key.toLowerCase()];
        if (!format) return;
        event.preventDefault();
        onTrackSelection(event.currentTarget);
        onKeyboardFormat(format);
      }}
    />
  );
}
