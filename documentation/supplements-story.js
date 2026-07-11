(() => {
  const fullPage = document.querySelector(".story-full-mock");
  const dialog = document.querySelector(".story-dialog-mock");
  if (!fullPage || !dialog) return;

  const order = ["first-step", "arcane-realms", "cosmic-odyssey"];
  const stories = {
    "first-step": { jump: "First Step", number: 1, chapters: [
      { title: "A Door Opens", source: "Morgan stepped beyond the familiar world with one pack and no promise of a return." },
      { title: "The First Choice", source: "The road ahead was frightening, but it was finally **theirs to choose**." },
    ] },
    "arcane-realms": { jump: "Arcane Realms", number: 2, chapters: [
      { title: "The Violet Gates", source: "**The gates of Highcourt** opened beneath a violet sky." },
      { title: "A Market of Promises", source: "I followed **Mira** through the market, where *every promise* seemed to carry a price." },
      { title: "", source: "By dusk, the old bargain was ~~broken~~ ++rewritten++ in {{#74d8a1|green fire}}." },
    ] },
    "cosmic-odyssey": { jump: "Cosmic Odyssey", number: 3, chapters: [] },
  };
  const savedStories = JSON.parse(JSON.stringify(stories));
  const currentId = "arcane-realms";
  const dirtyChapters = new Set();
  let targetedStory = currentId;
  let targetedChapter = null;
  let activeEditor = null;
  let savedRange = null;
  let saveStatusTimer = null;
  let pendingSaveChapter = null;

  const tokenPattern = /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|\+\+[^+\n]+?\+\+|\*[^*\n]+?\*|\{\{#[0-9a-fA-F]{6}\|[^}\n]+?\}\})/g;
  const parseSegments = (source) => {
    const segments = [];
    let cursor = 0;
    for (const match of source.matchAll(tokenPattern)) {
      if (match.index > cursor) segments.push({ type: "plain", raw: source.slice(cursor, match.index) });
      const raw = match[0];
      const type = raw.startsWith("**") ? "bold" : raw.startsWith("~~") ? "strike"
        : raw.startsWith("++") ? "underline" : raw.startsWith("{{") ? "color" : "italic";
      segments.push({ type, raw });
      cursor = match.index + raw.length;
    }
    if (cursor < source.length || !segments.length) segments.push({ type: "plain", raw: source.slice(cursor) });
    return segments;
  };
  const tokenParts = (segment) => {
    if (segment.type === "color") {
      const divider = segment.raw.indexOf("|");
      return { open: segment.raw.slice(0, divider + 1), content: segment.raw.slice(divider + 1, -2), close: "}}" };
    }
    const length = segment.type === "italic" ? 1 : 2;
    return { open: segment.raw.slice(0, length), content: segment.raw.slice(length, -length), close: segment.raw.slice(-length) };
  };
  const createToken = (type, content, open, close, color = "") => {
    const token = type === "bold" ? document.createElement("strong") : type === "italic" ? document.createElement("em")
      : type === "underline" ? document.createElement("u") : type === "strike" ? document.createElement("s") : document.createElement("span");
    token.className = "story-rich-token";
    token.dataset.storyTokenType = type;
    token.dataset.storyTokenOpen = open;
    token.dataset.storyTokenClose = close;
    token.textContent = content;
    if (type === "color" && /^#[0-9a-fA-F]{6}$/.test(color)) token.style.color = color;
    return token;
  };
  const renderedToken = (segment, editable = false) => {
    const parts = tokenParts(segment);
    const color = segment.type === "color" ? parts.open.slice(2, -1) : "";
    const token = createToken(segment.type, parts.content, parts.open, parts.close, color);
    if (!editable) token.classList.remove("story-rich-token");
    return token;
  };
  const renderMarkup = (target, source, editable = false) => {
    target.replaceChildren(...parseSegments(source).map((segment) => (
      segment.type === "plain" ? document.createTextNode(segment.raw) : renderedToken(segment, editable)
    )));
  };
  const serializeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.classList.contains("story-rich-token")) return `${node.dataset.storyTokenOpen}${node.textContent}${node.dataset.storyTokenClose}`;
    if (node.tagName === "BR") return "\n";
    const content = [...node.childNodes].map(serializeNode).join("");
    return ["DIV", "P"].includes(node.tagName) ? `${content}\n` : content;
  };
  const serializeEditor = (editor) => [...editor.childNodes].map(serializeNode).join("").replace(/\n$/, "");
  const wordCount = (chapters) => chapters.map((chapter) => chapter.source).join(" ").trim().match(/\S+/g)?.length ?? 0;

  const renderFullPage = () => {
    const container = fullPage.querySelector("#story-full-chapters");
    container.replaceChildren(...order.map((id) => {
      const story = savedStories[id];
      const article = document.createElement("article");
      article.className = "story-full-chapter";
      article.dataset.storyFullChapter = id;
      article.classList.toggle("is-targeted", id === targetedStory);
      const header = document.createElement("header");
      const number = document.createElement("span");
      number.textContent = `Jump ${story.number}`;
      const name = document.createElement("h5");
      name.textContent = story.jump;
      const count = document.createElement("small");
      count.textContent = story.chapters.length ? `${story.chapters.length} ${story.chapters.length === 1 ? "chapter" : "chapters"} · ${wordCount(story.chapters)} words` : "No chapters yet";
      header.append(number, name, count);
      const copy = document.createElement("div");
      copy.className = "story-full-copy";
      if (story.chapters.length) story.chapters.forEach((chapter, index) => {
        const chapterElement = document.createElement("section");
        chapterElement.className = "story-full-section";
        chapterElement.dataset.storyFullChapterIndex = `${id}:${index}`;
        chapterElement.classList.toggle("is-targeted-chapter", targetedChapter === `${id}:${index}`);
        const label = document.createElement("span");
        label.textContent = `Chapter ${index + 1}`;
        const title = document.createElement("h6");
        title.textContent = chapter.title.trim() || "Untitled chapter";
        const paragraph = document.createElement("p");
        if (chapter.source.trim()) renderMarkup(paragraph, chapter.source);
        else { paragraph.className = "is-empty"; paragraph.textContent = "This chapter has not been written yet."; }
        chapterElement.append(label, title, paragraph);
        copy.append(chapterElement);
      });
      else {
        const empty = document.createElement("p");
        empty.className = "is-empty";
        empty.textContent = "Open this Jump and choose Supp → Story to add its first chapter.";
        copy.append(empty);
      }
      article.append(header, copy);
      return article;
    }));
    const written = order.reduce((sum, id) => sum + savedStories[id].chapters.filter((chapter) => chapter.source.trim()).length, 0);
    fullPage.querySelector("#story-full-progress").textContent = `${order.length} Jumps · ${written} chapters written`;
    const index = fullPage.querySelector("#story-full-index");
    index.replaceChildren(...order.map((id) => {
      const story = savedStories[id];
      const group = document.createElement("div");
      group.className = "story-index-group";
      group.classList.toggle("is-targeted", id === targetedStory);
      const jumpButton = document.createElement("button");
      jumpButton.type = "button";
      jumpButton.dataset.storyFullTarget = id;
      jumpButton.setAttribute("aria-pressed", String(id === targetedStory));
      const number = document.createElement("span");
      number.textContent = `Jump ${story.number}`;
      const name = document.createElement("strong");
      name.textContent = story.jump;
      const count = document.createElement("small");
      count.textContent = story.chapters.length ? `${story.chapters.length} ${story.chapters.length === 1 ? "chapter" : "chapters"}` : "No chapters yet";
      jumpButton.append(number, name, count);
      group.append(jumpButton);
      if (story.chapters.length) {
        const chapters = document.createElement("div");
        chapters.className = "story-chapter-index";
        story.chapters.forEach((chapter, chapterIndex) => {
          const chapterButton = document.createElement("button");
          chapterButton.type = "button";
          chapterButton.dataset.storyChapterTarget = id;
          chapterButton.dataset.storyChapterNumber = String(chapterIndex);
          chapterButton.setAttribute("aria-pressed", String(targetedChapter === `${id}:${chapterIndex}`));
          chapterButton.textContent = chapter.title.trim() || "Untitled chapter";
          chapters.append(chapterButton);
        });
        group.append(chapters);
      }
      return group;
    }));
  };

  const updateCounts = () => {
    const chapters = stories[currentId].chapters;
    dialog.querySelector("#story-word-count").textContent = String(wordCount(chapters));
    dialog.querySelector("#story-chapter-count").textContent = String(chapters.length);
  };
  const commitChapter = (index) => {
    if (!dirtyChapters.has(index)) return;
    const editor = dialog.querySelector(`[data-story-chapter-editor="${index}"]`);
    if (editor) stories[currentId].chapters[index].source = serializeEditor(editor);
    savedStories[currentId].chapters[index] = { ...stories[currentId].chapters[index] };
    dirtyChapters.delete(index);
    if (editor) renderMarkup(editor, stories[currentId].chapters[index].source, true);
    renderFullPage();
    const status = dialog.querySelector("#story-save-status");
    status.textContent = "Saved";
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => { status.textContent = ""; }, 2500);
  };
  const updateActiveToken = () => {
    dialog.querySelectorAll(".story-rich-token.is-source").forEach((token) => token.classList.remove("is-source"));
    const selection = document.getSelection();
    if (!selection?.rangeCount || !activeEditor?.contains(selection.anchorNode)) return;
    savedRange = selection.getRangeAt(0).cloneRange();
    const anchor = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
    const token = anchor?.closest?.(".story-rich-token");
    if (token && activeEditor.contains(token)) token.classList.add("is-source");
  };

  const renderEditor = (focusLast = false) => {
    const container = dialog.querySelector("#story-editor-chapters");
    const chapters = stories[currentId].chapters;
    container.replaceChildren(...chapters.map((chapter, index) => {
      const card = document.createElement("article");
      card.className = "story-chapter-editor";
      const titleBar = document.createElement("header");
      const title = document.createElement("input");
      title.type = "text";
      title.value = chapter.title;
      title.placeholder = "Untitled chapter";
      title.setAttribute("aria-label", `Chapter ${index + 1} title`);
      title.addEventListener("input", () => { chapter.title = title.value; dirtyChapters.add(index); });
      titleBar.addEventListener("mousedown", (event) => { if (event.target === titleBar) title.focus(); });
      titleBar.append(title);
      const editor = document.createElement("div");
      editor.className = "story-rich-editor";
      editor.setAttribute("contenteditable", "true");
      editor.spellcheck = true;
      editor.dataset.storyChapterEditor = String(index);
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");
      editor.setAttribute("aria-label", `Chapter ${index + 1} text`);
      renderMarkup(editor, chapter.source, true);
      const trackSelection = () => { activeEditor = editor; updateActiveToken(); };
      editor.addEventListener("focus", trackSelection);
      editor.addEventListener("click", trackSelection);
      editor.addEventListener("keyup", trackSelection);
      editor.addEventListener("input", () => {
        chapter.source = serializeEditor(editor);
        dirtyChapters.add(index);
        updateCounts();
        trackSelection();
      });
      card.append(titleBar, editor);
      card.addEventListener("focusout", () => setTimeout(() => {
        if (card.contains(document.activeElement)) return;
        if (dialog.querySelector(".story-toolbar").contains(document.activeElement)) { pendingSaveChapter = index; return; }
        commitChapter(index);
      }, 0));
      return card;
    }));
    updateCounts();
    if (focusLast && chapters.length) container.querySelector(`[data-story-chapter-editor="${chapters.length - 1}"]`)?.focus();
  };

  const markerDefinitions = {
    bold: { open: "**", close: "**" }, italic: { open: "*", close: "*" },
    underline: { open: "++", close: "++" }, strike: { open: "~~", close: "~~" },
  };
  const wrapSelection = (type, color = "") => {
    if (!activeEditor || !savedRange) return;
    const range = savedRange.cloneRange();
    if (!activeEditor.contains(range.commonAncestorContainer)) return;
    const definition = type === "color" ? { open: `{{${color}|`, close: "}}" } : markerDefinitions[type];
    const selected = range.extractContents().textContent || "text";
    const token = createToken(type, selected, definition.open, definition.close, color);
    token.classList.add("is-source");
    range.insertNode(token);
    const selection = document.getSelection();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(token);
    nextRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    activeEditor.focus();
    activeEditor.dispatchEvent(new Event("input", { bubbles: true }));
  };
  dialog.querySelectorAll("[data-story-format]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => wrapSelection(button.dataset.storyFormat));
  });
  dialog.querySelector("#story-text-color").addEventListener("change", (event) => wrapSelection("color", event.currentTarget.value));
  dialog.querySelector(".story-toolbar").addEventListener("focusout", () => setTimeout(() => {
    if (pendingSaveChapter === null || dialog.querySelector(".story-toolbar").contains(document.activeElement)) return;
    const destination = document.activeElement.closest?.(".story-chapter-editor");
    const destinationIndex = destination ? Number(destination.querySelector(".story-rich-editor").dataset.storyChapterEditor) : null;
    if (destinationIndex !== pendingSaveChapter) commitChapter(pendingSaveChapter);
    pendingSaveChapter = null;
  }, 0));
  document.addEventListener("selectionchange", updateActiveToken);
  dialog.querySelector("#story-add-chapter").addEventListener("click", () => {
    stories[currentId].chapters.push({ title: "", source: "" });
    dirtyChapters.add(stories[currentId].chapters.length - 1);
    activeEditor = null;
    savedRange = null;
    renderEditor(true);
  });
  dialog.querySelector("aside button").addEventListener("click", () => fullPage.scrollIntoView({ behavior: "smooth", block: "start" }));
  fullPage.querySelector("#story-full-index").addEventListener("click", (event) => {
    const chapterButton = event.target.closest("[data-story-chapter-target]");
    if (chapterButton) {
      targetedStory = chapterButton.dataset.storyChapterTarget;
      targetedChapter = `${targetedStory}:${chapterButton.dataset.storyChapterNumber}`;
      renderFullPage();
      fullPage.querySelector(`[data-story-full-chapter-index="${targetedChapter}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const jumpButton = event.target.closest("[data-story-full-target]");
    if (!jumpButton) return;
    targetedStory = jumpButton.dataset.storyFullTarget;
    targetedChapter = null;
    renderFullPage();
    fullPage.querySelector(`[data-story-full-chapter="${targetedStory}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  renderFullPage();
  renderEditor();
})();
