(() => {
  // Embed contract:
  // - Load with ?embedded=1&theme=light|dark to remove standalone chrome.
  // - Pass &entry=<reference-id> to restore Editor-owned navigation state.
  // - Same-origin embeds automatically follow the parent application tokens.
  // - Send jumpchain:format-reference-config from the parent to update theme,
  //   bounded application accent tokens, direction, or the active entry.
  // - Listen for jumpchain:format-reference-ready and
  //   jumpchain:format-reference-location messages from this document.
  const storageKey = "jumpchain.format1-reference.v1";
  const embeddedToolStorageKey = `${storageKey}.embedded-tools`;
  const root = document.documentElement;
  const parameters = new URLSearchParams(window.location.search);
  const embedded = parameters.get("embedded") === "1";
  const themeParameter = parameters.get("theme");
  const explicitTheme = themeParameter === "light" || themeParameter === "dark";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const colorPattern = /^#[0-9a-f]{6}$/i;
  const tokenNames = new Set([
    "--app-accent-raw",
    "--app-accent-text",
    "--app-accent-focus",
    "--app-accent-border",
    "--app-accent-fill",
    "--app-accent-fill-text",
    "--app-accent-soft",
  ]);

  const applyTheme = (theme) => {
    if (theme === "light" || theme === "dark") root.dataset.appTheme = theme;
  };
  const applyTokens = (tokens) => {
    if (!tokens || typeof tokens !== "object") return;
    for (const [name, value] of Object.entries(tokens))
      if (tokenNames.has(name) && colorPattern.test(value))
        root.style.setProperty(name, value);
  };
  const syncParentAppearance = () => {
    if (!embedded || window.parent === window) return false;
    try {
      const parentRoot = window.parent.document.documentElement;
      const parentStyle = window.parent.getComputedStyle(parentRoot);
      const tokens = Object.fromEntries(
        [...tokenNames]
          .map((name) => [name, parentStyle.getPropertyValue(name).trim()])
          .filter(([, value]) => colorPattern.test(value)),
      );
      applyTheme(parentRoot.dataset.appTheme);
      applyTokens(tokens);
      if (parentRoot.dir === "ltr" || parentRoot.dir === "rtl")
        root.dir = parentRoot.dir;
      return true;
    } catch {
      // Cross-origin hosts use the validated postMessage contract instead.
      return false;
    }
  };

  root.dataset.embedded = String(embedded);
  applyTheme(
    explicitTheme ? themeParameter : media.matches ? "dark" : "light",
  );
  const accent = parameters.get("accent");
  if (accent && colorPattern.test(accent))
    root.style.setProperty("--app-accent-raw", accent);
  if (syncParentAppearance()) {
    const parentRoot = window.parent.document.documentElement;
    new MutationObserver(syncParentAppearance).observe(parentRoot, {
      attributes: true,
      attributeFilter: ["data-app-theme", "dir", "style"],
    });
    requestAnimationFrame(syncParentAppearance);
  }

  if (!explicitTheme)
    media.addEventListener("change", (event) =>
      applyTheme(event.matches ? "dark" : "light"),
    );

  const search = document.querySelector("#reference-search");
  const results = document.querySelector("#reference-results");
  const resultCount = document.querySelector("#reference-result-count");
  const clearButton = document.querySelector("#reference-clear");
  const content = document.querySelector("#reference-content");
  const filterButtons = [
    ...document.querySelectorAll("[data-reference-filter]"),
  ];
  const entries = [...document.querySelectorAll("[data-reference-entry]")];
  const sections = [...document.querySelectorAll("[data-reference-group]")];
  const lexicalTesters = [
    ...document.querySelectorAll("[data-lexical-tester]"),
  ];
  const valueTesters = [...document.querySelectorAll("[data-value-tester]")];
  const declarationBuilders = [
    ...document.querySelectorAll("[data-declaration-builder]"),
  ];
  const toolPopovers = [
    ...document.querySelectorAll(".reference-tool-popover"),
  ];
  const state = {
    filter: "all",
    query: "",
    lastEntry: null,
    openEntries: [],
    validatorValues: {},
    valueTesterValues: {},
  };

  const readState = () => {
    try {
      const value = JSON.parse(
        localStorage.getItem(embedded ? embeddedToolStorageKey : storageKey) ??
          "null",
      );
      if (!value || typeof value !== "object") return;
      if (!embedded) {
        if (typeof value.lastEntry === "string") state.lastEntry = value.lastEntry;
        if (Array.isArray(value.openEntries))
          state.openEntries = value.openEntries
            .filter((id) => typeof id === "string")
            .slice(-40);
      }
      if (value.validatorValues && typeof value.validatorValues === "object")
        for (const tester of lexicalTesters) {
          const key = tester.dataset.lexicalKey;
          const savedValue = key ? value.validatorValues[key] : null;
          if (key && typeof savedValue === "string")
            state.validatorValues[key] = savedValue.slice(0, 160);
        }
      if (
        value.valueTesterValues &&
        typeof value.valueTesterValues === "object"
      )
        for (const tester of valueTesters) {
          const key = tester.dataset.valueType;
          const savedValue = key ? value.valueTesterValues[key] : null;
          if (key && typeof savedValue === "string")
            state.valueTesterValues[key] = savedValue.slice(0, 160);
        }
      if (
        !embedded &&
        typeof value.filter === "string" &&
        filterButtons.some((button) => button.dataset.referenceFilter === value.filter)
      )
        state.filter = value.filter;
    } catch {
      // Storage may be unavailable in a hardened or opaque embedded context.
    }
  };

  const persistState = () => {
    try {
      localStorage.setItem(
        embedded ? embeddedToolStorageKey : storageKey,
        JSON.stringify(
          embedded
            ? {
                validatorValues: state.validatorValues,
                valueTesterValues: state.valueTesterValues,
              }
            : {
                filter: state.filter,
                lastEntry: state.lastEntry,
                openEntries: state.openEntries.slice(-40),
                validatorValues: state.validatorValues,
                valueTesterValues: state.valueTesterValues,
              },
        ),
      );
    } catch {
      // Reference navigation remains fully usable without persistence.
    }
  };

  const normalized = (value) =>
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, " ")
      .trim();
  const termsFor = (value) => normalized(value).split(/\s+/).filter(Boolean);
  const entryMatches = (entry) => {
    const kind = entry.dataset.referenceKind;
    if (state.filter !== "all" && kind !== state.filter) return false;
    const haystack = normalized(
      `${entry.dataset.referenceLabel ?? ""} ${entry.dataset.referenceSearch ?? ""} ${entry.textContent ?? ""}`,
    );
    return termsFor(state.query).every((term) => haystack.includes(term));
  };

  const groupLabels = {
    special: "Special cases",
    overview: "Foundations",
    declaration: "Declarations",
    field: "Fields",
    layout: "Layouts",
    type: "Value types",
    rule: "Semantic rules",
  };
  const groupOrder = [
    "special",
    "overview",
    "declaration",
    "field",
    "layout",
    "type",
    "rule",
  ];

  const setCurrentLink = (id) => {
    results
      ?.querySelectorAll("a[aria-current]")
      .forEach((link) => link.removeAttribute("aria-current"));
    const link = results?.querySelector(`a[href="#${CSS.escape(id)}"]`);
    link?.setAttribute("aria-current", "location");
  };

  const recordLocation = (entry) => {
    if (!entry?.id || entry.hidden) return;
    state.lastEntry = entry.id;
    setCurrentLink(entry.id);
    persistState();
    if (window.parent !== window)
      window.parent.postMessage(
        {
          type: "jumpchain:format-reference-location",
          entryId: entry.id,
        },
        "*",
      );
  };

  const navigateTo = (entry, { updateHash = true, focus = true } = {}) => {
    if (!entry) return;
    if (entry instanceof HTMLDetailsElement) entry.open = true;
    entry.scrollIntoView({ block: "start" });
    if (focus) {
      const target =
        entry instanceof HTMLDetailsElement
          ? entry.querySelector(":scope > summary")
          : entry;
      target?.focus({ preventScroll: true });
    }
    if (updateHash)
      history.replaceState(null, "", `${location.pathname}${location.search}#${entry.id}`);
    recordLocation(entry);
  };

  const renderIndex = () => {
    if (!results || !resultCount || !clearButton) return;
    const matches = entries.filter(entryMatches);
    entries.forEach((entry) => {
      entry.hidden = !matches.includes(entry);
    });
    for (const section of sections) {
      const sectionEntries = [...section.querySelectorAll("[data-reference-entry]")];
      section.hidden =
        sectionEntries.length > 0 && sectionEntries.every((entry) => entry.hidden);
    }

    const grouped = new Map();
    for (const entry of matches) {
      const kind = entry.dataset.referenceKind ?? "overview";
      const group = grouped.get(kind) ?? [];
      group.push(entry);
      grouped.set(kind, group);
    }

    const fragment = document.createDocumentFragment();
    for (const kind of groupOrder) {
      const group = grouped.get(kind);
      if (!group?.length) continue;
      const section = document.createElement("section");
      section.className = "reference-index-group";
      const heading = document.createElement("h2");
      heading.textContent = groupLabels[kind] ?? kind;
      const list = document.createElement("ol");
      for (const entry of group) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${entry.id}`;
        const label = document.createElement("span");
        label.textContent = entry.dataset.referenceLabel ?? entry.id;
        const type = document.createElement("small");
        type.textContent = kind;
        link.append(label, type);
        link.addEventListener("click", (event) => {
          event.preventDefault();
          navigateTo(entry);
        });
        item.append(link);
        list.append(item);
      }
      section.append(heading, list);
      fragment.append(section);
    }
    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "reference-index-empty";
      empty.textContent = "No syntax or fields match that search.";
      fragment.append(empty);
    }
    results.replaceChildren(fragment);
    resultCount.textContent = state.query
      ? `${matches.length} result${matches.length === 1 ? "" : "s"}`
      : `${matches.length} indexed entries`;
    clearButton.hidden = state.query.length === 0 && state.filter === "all";
    setCurrentLink(state.lastEntry);
  };

  const setFilter = (filter) => {
    state.filter = filter;
    filterButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.referenceFilter === filter),
      ),
    );
    persistState();
    renderIndex();
  };

  const clearSearch = () => {
    state.query = "";
    if (search) search.value = "";
    setFilter("all");
  };

  const updateLexicalTester = (tester, value, shouldPersist = true) => {
    const input = tester.querySelector("input");
    const status = tester.querySelector("[data-lexical-status]");
    const mark = tester.querySelector("[data-lexical-mark]");
    const preview = tester.querySelector("[data-lexical-preview]");
    const key = tester.dataset.lexicalKey;
    const pattern = tester.dataset.lexicalPattern;
    if (!input || !status || !mark || !key || !pattern) return;

    input.value = value;
    if (value) state.validatorValues[key] = value.slice(0, 160);
    else delete state.validatorValues[key];

    let validationState = "neutral";
    if (value) validationState = new RegExp(pattern).test(value) ? "valid" : "invalid";
    tester.dataset.validationState = validationState;
    if (validationState === "valid") {
      input.removeAttribute("aria-invalid");
      status.textContent = tester.dataset.validMessage ?? "Pattern matched.";
      mark.textContent = "✓";
      if (preview) preview.style.backgroundColor = value;
    } else if (validationState === "invalid") {
      input.setAttribute("aria-invalid", "true");
      status.textContent = tester.dataset.invalidMessage ?? "Pattern did not match.";
      mark.textContent = "×";
      if (preview) preview.style.removeProperty("background-color");
    } else {
      input.removeAttribute("aria-invalid");
      status.textContent = "Enter a value to test.";
      mark.textContent = "";
      if (preview) preview.style.removeProperty("background-color");
    }
    if (shouldPersist) persistState();
  };

  const tokensForValueTester = (tester) => {
    try {
      const value = JSON.parse(tester.dataset.valueTokens ?? "[]");
      return Array.isArray(value) ? value.map(String) : [];
    } catch {
      return [];
    }
  };

  const checkValue = (type, source, tokens) => {
    const raw = source.trim();
    const integerPattern = /^-?(?:0|[1-9][0-9]*)$/;
    if (!raw) return { state: "neutral", message: "Enter a value to check." };
    if (type === "textSize") {
      if (tokens.includes(raw))
        return { state: "valid", message: "Valid named text-size token." };
      const match = raw.match(/^(\d+(?:\.\d+)?|\.\d+)(px|rem)$/);
      const amount = match ? Number(match[1]) : Number.NaN;
      const valid = Boolean(
        match &&
          (match[2] === "px"
            ? amount >= 8 && amount <= 512
            : amount >= 0.5 && amount <= 32),
      );
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? "Valid exact text size."
          : "Use a named token, 8–512px, or .5–32rem.",
      };
    }
    if (type === "layoutDimension") {
      if (tokens.includes(raw))
        return { state: "valid", message: "Valid named layout-size token." };
      const match = raw.match(/^(\d+(?:\.\d+)?|\.\d+)(px|rem)$/);
      const amount = match ? Number(match[1]) : Number.NaN;
      const valid = Boolean(
        match &&
          amount >= 0 &&
          (match[2] === "px" ? amount <= 4096 : amount <= 256),
      );
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? "Valid exact layout dimension."
          : "Use a named token, 0–4096px, or 0–256rem.",
      };
    }
    if (type === "imageDimension") {
      const valid =
        tokens.includes(raw) ||
        /^(?:0|[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]+)(?:px|rem)$/.test(raw);
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? "Valid image dimension."
          : "Use a named token or a non-negative px/rem length.",
      };
    }
    if (type === "aspectRatio") {
      const valid = /^([1-9]\d?)\s*\/\s*([1-9]\d?)$/.test(raw);
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? "Valid aspect ratio."
          : "Use two positive integers from 1 through 99 separated by /.",
      };
    }
    if (type === "propertyValue") {
      const valid =
        integerPattern.test(raw) ||
        raw === "true" ||
        raw === "false" ||
        (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"'));
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? "Valid property value."
          : "Use a quoted string, canonical integer, true, or false.",
      };
    }
    if (type === "costAmount" || type === "grantAmount") {
      const valid = integerPattern.test(raw) || tokens.includes(raw);
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? `Valid ${type === "costAmount" ? "cost" : "grant"} amount.`
          : `Use an integer or one of the listed ${type === "costAmount" ? "cost/award" : "grant"} tokens.`,
      };
    }
    if (type === "tag") {
      const startsQuoted = raw.startsWith('"');
      const endsQuoted = raw.endsWith('"');
      const quoted = startsQuoted && endsQuoted && raw.length >= 2;
      const value = quoted ? raw.slice(1, -1) : raw;
      const valid =
        Boolean(value.trim()) &&
        startsQuoted === endsQuoted &&
        (quoted || !/[\s"]/u.test(raw));
      return {
        state: valid ? "valid" : "invalid",
        message: valid
          ? "Valid Tag syntax."
          : "Use a non-empty bare Tag, or quote Tags containing spaces.",
        canonical: valid
          ? value
              .normalize("NFKC")
              .toLocaleLowerCase()
              .replace(/[\s_\p{Pd}]+/gu, " ")
              .trim()
          : null,
      };
    }
    return { state: "invalid", message: "This value checker is unavailable." };
  };

  const updateValueTester = (tester, value, shouldPersist = true) => {
    const input = tester.querySelector("input");
    const status = tester.querySelector("[data-value-status]");
    const mark = tester.querySelector("[data-value-mark]");
    const canonical = tester.querySelector("[data-value-canonical]");
    const type = tester.dataset.valueType;
    if (!input || !status || !mark || !type) return;

    input.value = value;
    if (value) state.valueTesterValues[type] = value.slice(0, 160);
    else delete state.valueTesterValues[type];
    const result = checkValue(type, value, tokensForValueTester(tester));
    tester.dataset.validationState = result.state;
    status.textContent = result.message;
    mark.textContent = result.state === "valid" ? "✓" : result.state === "invalid" ? "×" : "";
    if (result.state === "invalid") input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    if (canonical) {
      canonical.hidden = !result.canonical;
      const code = canonical.querySelector("code");
      if (code) code.textContent = result.canonical ?? "";
    }
    if (shouldPersist) persistState();
  };

  const filterSkeletonFields = (builder) => {
    const query = normalized(builder.querySelector("[data-skeleton-search]")?.value ?? "");
    const active = builder.querySelector("[data-skeleton-form]:not([hidden])");
    const options = [...(active?.querySelectorAll("[data-skeleton-field-option]") ?? [])];
    let visible = 0;
    options.forEach((option) => {
      const matches = !query || normalized(option.textContent ?? "").includes(query);
      option.hidden = !matches;
      if (matches) visible += 1;
    });
    const empty = builder.querySelector("[data-skeleton-empty]");
    if (empty) empty.hidden = options.length === 0 || visible > 0;
  };

  const updateDeclarationBuilder = (builder) => {
    const context = builder.querySelector("[data-skeleton-context]");
    const forms = [...builder.querySelectorAll("[data-skeleton-form]")];
    const activeIndex = Number(context?.value ?? 0);
    forms.forEach((form, index) => {
      form.hidden = index !== activeIndex;
    });
    const active = forms[activeIndex];
    const output = builder.querySelector("[data-skeleton-output]");
    if (!active || !output) return;
    const declaration = active.dataset.skeletonDeclaration;
    const scalar = active.dataset.skeletonScalar;
    const lines = scalar ? [`${declaration}: ${scalar}`] : [declaration];
    if (!scalar)
      active.querySelectorAll("[data-skeleton-field]:checked").forEach((input) => {
        lines.push(
          `  ${input.dataset.skeletonFieldName}: ${input.dataset.skeletonFieldValue}`,
        );
      });
    if (active.dataset.skeletonRoot) lines.push(`  ${active.dataset.skeletonRoot}`);
    output.textContent = lines.join("\n");
    filterSkeletonFields(builder);
  };

  readState();
  lexicalTesters.forEach((tester) => {
    const key = tester.dataset.lexicalKey;
    updateLexicalTester(tester, key ? (state.validatorValues[key] ?? "") : "", false);
    tester.querySelector("input")?.addEventListener("input", (event) =>
      updateLexicalTester(tester, event.currentTarget.value),
    );
  });
  valueTesters.forEach((tester) => {
    const key = tester.dataset.valueType;
    updateValueTester(
      tester,
      key ? (state.valueTesterValues[key] ?? "") : "",
      false,
    );
    tester.querySelector("input")?.addEventListener("input", (event) =>
      updateValueTester(tester, event.currentTarget.value),
    );
  });
  declarationBuilders.forEach((builder) => {
    updateDeclarationBuilder(builder);
    builder.querySelector("[data-skeleton-context]")?.addEventListener("change", () => {
      const search = builder.querySelector("[data-skeleton-search]");
      if (search) search.value = "";
      updateDeclarationBuilder(builder);
    });
    builder.addEventListener("change", (event) => {
      if (event.target.matches?.("[data-skeleton-field]"))
        updateDeclarationBuilder(builder);
    });
    builder.querySelector("[data-skeleton-search]")?.addEventListener("input", () =>
      filterSkeletonFields(builder),
    );
  });
  toolPopovers.forEach((popover) => {
    popover.addEventListener("toggle", (event) => {
      if (event.newState !== "open") return;
      requestAnimationFrame(() => {
        const target = popover.matches("[data-declaration-builder]")
          ? popover.querySelector("select")
          : popover.querySelector("input");
        target?.focus();
      });
    });
  });
  state.openEntries.forEach((id) => {
    const entry = document.getElementById(id);
    if (entry instanceof HTMLDetailsElement) entry.open = true;
  });
  setFilter(state.filter);

  search?.addEventListener("input", () => {
    state.query = search.value;
    renderIndex();
  });
  clearButton?.addEventListener("click", () => {
    clearSearch();
    search?.focus();
  });
  filterButtons.forEach((button) =>
    button.addEventListener("click", () =>
      setFilter(button.dataset.referenceFilter),
    ),
  );
  document.querySelectorAll("[data-focus-search]").forEach((button) =>
    button.addEventListener("click", () => search?.focus()),
  );

  document.addEventListener("keydown", (event) => {
    const editable = event.target.closest?.("input, textarea, select, [contenteditable]");
    if (
      (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key === "k")) &&
      !editable
    ) {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === "Escape" && document.activeElement === search) {
      event.preventDefault();
      if (state.query) clearSearch();
      else search.blur();
    }
  });

  document.addEventListener("toggle", (event) => {
    const entry = event.target;
    if (!(entry instanceof HTMLDetailsElement) || !entry.matches("[data-reference-entry]"))
      return;
    const open = new Set(state.openEntries);
    if (entry.open) {
      open.add(entry.id);
      recordLocation(entry);
    } else open.delete(entry.id);
    state.openEntries = [...open].slice(-40);
    persistState();
  }, true);

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-copy-code]");
    if (!button) return;
    const code = button.closest(".syntax-example")?.querySelector("code")?.textContent;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 1400);
    } catch {
      button.textContent = "Select code";
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(button.closest(".syntax-example").querySelector("code"));
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });

  const observer = new IntersectionObserver(
    (observations) => {
      const visible = observations
        .filter((observation) => observation.isIntersecting && !observation.target.hidden)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible) recordLocation(visible.target);
    },
    {
      root: embedded ? content : null,
      rootMargin: "0px 0px -72% 0px",
      threshold: 0,
    },
  );
  entries.forEach((entry) => observer.observe(entry));

  const hashEntry = location.hash
    ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
    : null;
  const requestedEntry = embedded
    ? document.getElementById(parameters.get("entry") ?? "")
    : null;
  const savedEntry = state.lastEntry ? document.getElementById(state.lastEntry) : null;
  const restoreTarget = hashEntry ?? requestedEntry ?? savedEntry;
  if (restoreTarget)
    requestAnimationFrame(() =>
      navigateTo(restoreTarget, { updateHash: Boolean(hashEntry), focus: false }),
    );

  window.addEventListener("pagehide", persistState);
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !event.data || typeof event.data !== "object")
      return;
    if (event.data.type !== "jumpchain:format-reference-config") return;
    applyTheme(event.data.theme);
    applyTokens(event.data.tokens);
    if (event.data.direction === "ltr" || event.data.direction === "rtl")
      root.dir = event.data.direction;
    if (event.data.embedded === true) root.dataset.embedded = "true";
    if (typeof event.data.entryId === "string")
      navigateTo(document.getElementById(event.data.entryId), {
        updateHash: false,
        focus: false,
      });
  });

  if (window.parent !== window)
    window.parent.postMessage(
      {
        type: "jumpchain:format-reference-ready",
        schemaVersion: 1,
      },
      "*",
    );
})();
