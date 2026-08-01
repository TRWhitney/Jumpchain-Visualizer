export type StoryTokenType =
  "bold" | "italic" | "underline" | "strike" | "color";

const storyTokenPattern =
  /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|\+\+[^+\n]+?\+\+|\*[^*\n]+?\*|\{\{#[0-9a-fA-F]{6}\|[^}\n]+?\}\})/g;

export function storySegments(source: string) {
  const segments: { type: StoryTokenType | "plain"; raw: string }[] = [];
  let cursor = 0;
  for (const match of source.matchAll(storyTokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      segments.push({ type: "plain", raw: source.slice(cursor, index) });
    const raw = match[0];
    const type: StoryTokenType = raw.startsWith("**")
      ? "bold"
      : raw.startsWith("~~")
        ? "strike"
        : raw.startsWith("++")
          ? "underline"
          : raw.startsWith("{{")
            ? "color"
            : "italic";
    segments.push({ type, raw });
    cursor = index + raw.length;
  }
  if (cursor < source.length || !segments.length)
    segments.push({ type: "plain", raw: source.slice(cursor) });
  return segments;
}

export function storyTokenParts(type: StoryTokenType, raw: string) {
  if (type === "color") {
    const divider = raw.indexOf("|");
    return {
      open: raw.slice(0, divider + 1),
      content: raw.slice(divider + 1, -2),
      close: "}}",
      color: raw.slice(2, divider),
    };
  }
  const length = type === "italic" ? 1 : 2;
  return {
    open: raw.slice(0, length),
    content: raw.slice(length, -length),
    close: raw.slice(-length),
    color: "",
  };
}

export function createStoryToken(
  type: StoryTokenType,
  content: string,
  open: string,
  close: string,
  color = "",
) {
  const tag =
    type === "bold"
      ? "strong"
      : type === "italic"
        ? "em"
        : type === "underline"
          ? "u"
          : type === "strike"
            ? "s"
            : "span";
  const token = document.createElement(tag);
  token.className = "story-rich-token";
  token.dataset.storyTokenType = type;
  token.dataset.storyTokenOpen = open;
  token.dataset.storyTokenClose = close;
  token.textContent = content;
  if (type === "color" && /^#[0-9a-fA-F]{6}$/.test(color))
    token.style.color = color;
  return token;
}

export function renderStoryEditorMarkup(target: HTMLElement, source: string) {
  target.replaceChildren(
    ...storySegments(source).map((segment) => {
      if (segment.type === "plain") return document.createTextNode(segment.raw);
      const parts = storyTokenParts(segment.type, segment.raw);
      return createStoryToken(
        segment.type,
        parts.content,
        parts.open,
        parts.close,
        parts.color,
      );
    }),
  );
}

function serializeStoryNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.classList.contains("story-rich-token"))
    return `${node.dataset.storyTokenOpen ?? ""}${node.textContent ?? ""}${node.dataset.storyTokenClose ?? ""}`;
  if (node.tagName === "BR") return "\n";
  const content = [...node.childNodes].map(serializeStoryNode).join("");
  return ["DIV", "P"].includes(node.tagName) ? `${content}\n` : content;
}

export function serializeStoryEditor(editor: HTMLElement) {
  return [...editor.childNodes]
    .map(serializeStoryNode)
    .join("")
    .replace(/\n$/, "");
}
