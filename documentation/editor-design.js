(() => {
  const field = (key, label, value, options = {}) => ({ key, label, value, ...options });
  const valueOf = (view, key) => view.fields.find((item) => item.key === key)?.value ?? "";
  const quoted = (value) => `"${value}"`;

  const choice = (handle, name, group, cost, description) => ({
    kind: "Choice",
    keyword: "choice",
    file: "choices.jdef",
    title: name,
    handle,
    fields: [
      field("name", "Name", name, { sourceKey: "name", quoted: true }),
      field("handle", "Handle", handle, { sourceKey: "handle" }),
      field("group", "Group", group, { sourceKey: "group" }),
      field("cost", "Cost", String(cost), { sourceKey: "cost", type: "number" }),
      field("description", "Description", description, { block: true, wide: true, type: "textarea" }),
    ],
    source(view) {
      return `choice
  handle: ${valueOf(view, "handle")}
  name: ${quoted(valueOf(view, "name"))}
  group: ${valueOf(view, "group")}
  cost: ${valueOf(view, "cost")}

  text
    handle: description
    content:
      """
      ${valueOf(view, "description")}
      """`;
    },
    properties(view) {
      return [
        ["Declaration", "choice"],
        ["Stored in", view.file],
        ["Handle", valueOf(view, "handle")],
        ["Group", valueOf(view, "group")],
      ];
    },
  });

  const section = (handle, name, layout, group, mode, description, choiceKeys) => ({
    kind: "Section",
    keyword: "section",
    file: "jump.jdef",
    title: name,
    handle,
    choiceKeys,
    fields: [
      field("name", "Name", name, { sourceKey: "name", quoted: true }),
      field("handle", "Handle", handle, { sourceKey: "handle" }),
      field("layout", "Layout", layout, { sourceKey: "layout" }),
      field("group", "Choice group", group, { sourceKey: "group" }),
      field("mode", "Selection", mode, { sourceKey: "mode", type: "select", options: ["single", "multi"] }),
      field("description", "Introduction", description, { block: true, wide: true, type: "textarea" }),
    ],
    contextualAdd: "Add choice",
    source(view) {
      return `section
  handle: ${valueOf(view, "handle")}
  name: ${quoted(valueOf(view, "name"))}
  layout: ${valueOf(view, "layout")}

  choice-source
    handle: main
    group: ${valueOf(view, "group")}
    mode: ${valueOf(view, "mode")}

  text
    handle: description
    content:
      """
      ${valueOf(view, "description")}
      """`;
    },
    properties(view) {
      return [
        ["Declaration", "section"],
        ["Stored in", view.file],
        ["Handle", valueOf(view, "handle")],
        ["Layout", valueOf(view, "layout")],
      ];
    },
  });

  const layout = (keyword, handle, gap, description) => ({
    kind: keyword === "section-layout" ? "Section layout" : "Choice layout",
    keyword,
    file: "layout.jdef",
    title: handle,
    handle,
    fields: [
      field("handle", "Handle", handle, { sourceKey: "handle" }),
    ],
    layoutTree: {
      container: "stack",
      gap,
      selected: "root",
      nodes: keyword === "section-layout"
        ? [
            { id: "node-1", parent: "root", type: "slot", value: "name" },
            { id: "node-2", parent: "root", type: "text", value: "description" },
            { id: "node-rule", parent: "root", type: "rule" },
            { id: "container-1", parent: "root", type: "grid", gap: "sm" },
            { id: "node-3", parent: "container-1", type: "expand", source: "main", using: "origin_card" },
          ]
        : [
            { id: "container-1", parent: "root", type: "stack", gap: "xs" },
            { id: "node-1", parent: "container-1", type: "slot", value: "name" },
            { id: "node-2", parent: "container-1", type: "text", value: "description" },
            { id: "node-3", parent: "container-1", type: "slot", value: "cost" },
            { id: "node-4", parent: "root", type: "slot", value: "control" },
          ],
    },
    description,
    source(view) {
      const renderNode = (node, depth) => {
        const indent = "  ".repeat(depth);
        if (node.type === "expand") {
          return `${indent}expand\n${indent}  source: ${node.source}\n${indent}  using: ${node.using}`;
        }
        if (node.type === "rule") return `${indent}rule`;
        if (["stack", "inline", "wrap", "grid"].includes(node.type)) {
          const children = view.layoutTree.nodes
            .filter((candidate) => candidate.parent === node.id)
            .map((child) => renderNode(child, depth + 1))
            .join("\n");
          return `${indent}${node.type}\n${indent}  gap: ${node.gap || "md"}${children ? `\n${children}` : ""}`;
        }
        return `${indent}${node.type}: ${node.value}`;
      };
      const body = view.layoutTree.nodes
        .filter((node) => node.parent === "root")
        .map((node) => renderNode(node, 2))
        .join("\n");
      return `${keyword}
  handle: ${valueOf(view, "handle")}

  ${view.layoutTree.container}
    gap: ${view.layoutTree.gap}
${body}`;
    },
    properties(view) {
      return [
        ["Declaration", keyword],
        ["Stored in", view.file],
        ["Handle", valueOf(view, "handle")],
        ["Root node", view.layoutTree.container],
      ];
    },
  });

  const theme = (handle, color) => ({
    kind: "Theme",
    keyword: "theme",
    file: "layout.jdef",
    title: handle,
    handle,
    fields: [
      field("handle", "Handle", handle, { sourceKey: "handle" }),
      field("color", "Color", color, { sourceKey: "color" }),
    ],
    source(view) {
      return `theme
  handle: ${valueOf(view, "handle")}
  color: ${valueOf(view, "color")}`;
    },
    properties(view) {
      return [
        ["Declaration", "theme"],
        ["Stored in", view.file],
        ["Handle", valueOf(view, "handle")],
        ["Color", valueOf(view, "color")],
      ];
    },
  });

  const views = {
    jump: {
      kind: "Jump",
      keyword: "jump",
      file: "jump.jdef",
      title: "Example Jump",
      fields: [
        field("name", "Name", "Example Jump", { sourceKey: "name", quoted: true }),
        field("description", "Description", "Choose where a chain enters a city of doors.", { sourceKey: "description", quoted: true, block: true, wide: true, type: "textarea" }),
        field("authors", "Authors", "Author One; Author Two", { sourceKey: "author", multiple: true }),
        field("version", "Version", "1.0", { sourceKey: "version", quoted: true }),
        field("sectionLayout", "Default section layout", "default_section", { sourceKey: "section-layout" }),
        field("choiceLayout", "Default choice layout", "default_choice", { sourceKey: "choice-layout" }),
      ],
      contextualAdd: "Add author",
      source(view) {
        const authors = valueOf(view, "authors").split(";").map((author) => author.trim()).filter(Boolean);
      return `jump
  name: ${quoted(valueOf(view, "name"))}
  description: ${quoted(valueOf(view, "description"))}
${authors.map((author) => `  author: ${quoted(author)}`).join("\n")}
  version: ${quoted(valueOf(view, "version"))}
  section-layout: ${valueOf(view, "sectionLayout")}
  choice-layout: ${valueOf(view, "choiceLayout")}`;
      },
      properties(view) {
        return [
          ["Declaration", "jump"],
          ["Stored in", view.file],
          ["Sections", "2"],
          ["Choices", "5"],
        ];
      },
    },
    origins: section("origins", "Origins", "origin_section", "origins", "single", "Choose where your chain begins.", ["human", "dragon"]),
    perks: section("perks", "Perks", "perk_section", "perks", "multi", "Purchase abilities for the jump ahead.", ["flight", "arcane-study", "unbreakable"]),
    human: choice("human", "Human", "origins", 100, "Adaptable, ambitious, and familiar."),
    dragon: choice("dragon", "Dragon", "origins", 200, "Powerful, resilient, and unmistakable."),
    flight: choice("flight", "Flight", "perks", 100, "Move freely through the air."),
    "arcane-study": choice("arcane_study", "Arcane Study", "perks", 200, "Learn structured forms of magic."),
    unbreakable: choice("unbreakable", "Unbreakable", "perks", 400, "Gain exceptional physical resilience."),
    "origin-section-layout": layout("section-layout", "origin_section", "md", "Stacks the section heading above its origin cards."),
    "origin-card-layout": layout("choice-layout", "origin_card", "sm", "Displays an origin as a compact selectable card."),
    "perk-card-layout": layout("choice-layout", "perk_card", "sm", "Displays a perk with description, cost, and control."),
    "primary-theme": theme("primary", "#3366cc"),
    "accent-theme": theme("accent", "#ff9900"),
  };

  const semanticKeys = {
    jump: ["jump"],
    sections: ["origins", "perks"],
    choices: ["human", "dragon", "flight", "arcane-study", "unbreakable"],
    layouts: ["origin-section-layout", "origin-card-layout", "perk-card-layout"],
    themes: ["primary-theme", "accent-theme"],
  };

  const fileView = (title, role, keys, required = false) => ({
    kind: "Package file",
    keyword: title,
    file: title,
    title,
    mode: "source",
    fields: [],
    outline: keys,
    source() {
      return keys.map((key) => views[key].source(views[key])).join("\n\n");
    },
    properties() {
      return [
        ["Role", role],
        ["Required", required ? "Yes" : "No"],
        ["Declarations", String(keys.length)],
      ];
    },
  });

  views["jump-file"] = fileView("jump.jdef", "Jump details and sections", [...semanticKeys.jump, ...semanticKeys.sections], true);
  views["choices-file"] = fileView("choices.jdef", "Choice declarations", semanticKeys.choices);
  views["layout-file"] = fileView("layout.jdef", "Layouts and themes", [...semanticKeys.layouts, ...semanticKeys.themes]);
  views.assets = {
    kind: "Package folder",
    keyword: "assets/",
    file: "assets/",
    title: "assets/",
    mode: "source",
    fields: [],
    assets: ["human.png", "dragon.png"],
    source: () => "assets/\n  human.png\n  dragon.png",
    properties: () => [["Role", "Local images"], ["Files", "2"], ["Unused", "0"]],
  };

  const structuredPanel = document.querySelector("#structured-panel");
  const sourcePanel = document.querySelector("#source-panel");
  const previewPanel = document.querySelector("#preview-panel");
  const propertiesPanel = document.querySelector("#properties-panel");
  const feedback = document.querySelector("#mock-feedback");
  const saveState = document.querySelector("#mock-save-state");
  const addButton = document.querySelector("#mock-add-button");
  const addOptions = document.querySelector("#mock-add-options");
  const contentSearch = document.querySelector("#mock-content-search");
  const diagnosticsToggle = document.querySelector("#mock-diagnostics-toggle");
  const diagnosticsDetails = document.querySelector("#mock-diagnostics-details");
  const diagnosticsEmpty = document.querySelector("#mock-diagnostics-empty");
  const diagnosticsSummary = document.querySelector("#mock-diagnostics-summary");
  let currentKey = "origins";
  let lastContentEditorTabId = "structured-tab";
  let layoutBoundsVisible = false;
  let stripPreviewColor = false;

  if (!structuredPanel || !sourcePanel || !previewPanel || !propertiesPanel || !feedback || !saveState || !addButton || !addOptions || !contentSearch || !diagnosticsToggle || !diagnosticsDetails || !diagnosticsEmpty || !diagnosticsSummary) return;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const setDirty = () => {
    saveState.textContent = "Unsaved";
    saveState.classList.add("dirty");
  };

  const sourceFor = (view) => view.source(view);
  const displayTitle = (view) => valueOf(view, "name") || valueOf(view, "handle") || view.title;

  const makeSelect = (values, selectedValue, attributes = {}) => {
    const select = document.createElement("select");
    Object.entries(attributes).forEach(([key, value]) => {
      select.dataset[key] = value;
    });
    values.forEach(({ value, label = value }) => {
      const option = element("option", "", label);
      option.value = value;
      option.selected = value === selectedValue;
      select.append(option);
    });
    return select;
  };

  const spacingOptions = [
    { value: "none", label: "None" },
    { value: "xs", label: "Extra small" },
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
    { value: "xl", label: "Extra large" },
  ];
  const flowOptions = [
    { value: "stack", label: "Stack" },
    { value: "inline", label: "Inline" },
    { value: "wrap", label: "Wrap" },
    { value: "grid", label: "Grid" },
  ];
  const typeOptionsFor = (view) => [
    { value: "slot", label: "Slot" },
    { value: "text", label: "Text" },
    { value: "image", label: "Image" },
    ...(view.kind === "Choice layout" ? [{ value: "input", label: "Input" }] : []),
    { value: "rule", label: "Horizontal rule" },
    ...(view.kind === "Section layout"
      ? [
          { value: "choice", label: "Direct choice" },
          { value: "expand", label: "Choice list" },
        ]
      : []),
    ...flowOptions.map(({ value, label }) => ({ value, label: `${label} container` })),
  ];
  const slotOptionsFor = (view) =>
    (view.kind === "Section layout"
      ? ["name", "roll"]
      : ["name", "cost", "control", "roll", "tags"]
    ).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
  const isContainer = (node) => node && ["stack", "inline", "wrap", "grid"].includes(node.type);

  const layoutNodePath = (view, node) => {
    if (node.id === "root") return `${view.layoutTree.container}[1]`;
    const siblings = view.layoutTree.nodes.filter((candidate) => candidate.parent === node.parent);
    const position = siblings.findIndex((candidate) => candidate.id === node.id) + 1;
    const parent = node.parent === "root"
      ? { id: "root" }
      : view.layoutTree.nodes.find((candidate) => candidate.id === node.parent);
    return `${layoutNodePath(view, parent)}/${node.type}[${position}]`;
  };

  const layoutContainers = (view) => [
    {
      id: "root",
      type: view.layoutTree.container,
      gap: view.layoutTree.gap,
      parent: null,
    },
    ...view.layoutTree.nodes.filter(isContainer),
  ];

  const labeledControl = (labelText, control, className = "") => {
    const label = element("label", className);
    label.append(element("span", "", labelText), control);
    return label;
  };

  const renderLayoutBuilder = (view) => {
    const builder = element("section", "mock-layout-builder");
    const containers = layoutContainers(view);
    const selectedId = containers.some((container) => container.id === view.layoutTree.selected)
      ? view.layoutTree.selected
      : "root";
    view.layoutTree.selected = selectedId;
    const selected = containers.find((container) => container.id === selectedId);
    const containerOptions = containers.map((container) => ({
      value: container.id,
      label: layoutNodePath(view, container),
    }));
    const typeOptions = typeOptionsFor(view);

    const heading = element("div", "mock-layout-heading");
    heading.append(element("strong", "", "Layout editor"), element("span", "", `${view.layoutTree.nodes.length + 1} nodes`));

    const levelNavigation = element("div", "mock-layout-level-navigation");
    levelNavigation.append(labeledControl(
      "Editing container",
      makeSelect(containerOptions, selectedId, { layoutSelected: "true" }),
    ));

    const breadcrumb = element("div", "mock-layout-breadcrumb");
    const path = [];
    let current = selected;
    while (current) {
      path.unshift(current);
      current = current.parent ? containers.find((container) => container.id === current.parent) : null;
    }
    path.forEach((container, index) => {
      if (index > 0) breadcrumb.append(element("span", "", "/"));
      const crumb = element("button", "", layoutNodePath(view, container).split("/").at(-1));
      crumb.type = "button";
      crumb.dataset.layoutOpen = container.id;
      if (container.id === selectedId) crumb.setAttribute("aria-current", "page");
      breadcrumb.append(crumb);
    });
    levelNavigation.append(breadcrumb);

    const selectedEditor = element("div", "mock-layout-selected-editor");
    selectedEditor.append(
      labeledControl("Path", element("div", "mock-layout-static-control", layoutNodePath(view, selected))),
      labeledControl("Flow", makeSelect(flowOptions, selected.type, { layoutSelectedProperty: "type" })),
      labeledControl("Spacing", makeSelect(spacingOptions, selected.gap, { layoutSelectedProperty: "gap" })),
    );

    const childrenHeading = element("div", "mock-layout-children-heading");
    const children = view.layoutTree.nodes.filter((node) => node.parent === selectedId);
    childrenHeading.append(
      element("strong", "", `Children of ${layoutNodePath(view, selected)}`),
      element("span", "", `${children.length} items`),
    );

    const table = element("div", "mock-layout-table");
    const isDescendantOf = (candidateId, ancestorId) => {
      let current = view.layoutTree.nodes.find((node) => node.id === candidateId);
      while (current) {
        if (current.parent === ancestorId) return true;
        current = view.layoutTree.nodes.find((node) => node.id === current.parent);
      }
      return false;
    };
    children.forEach((node) => {
      const row = element("div", "mock-layout-row");
      row.dataset.layoutRow = node.id;
      const dragHandle = element("span", "mock-layout-drag-handle", "⋮⋮");
      dragHandle.draggable = true;
      dragHandle.dataset.layoutDrag = node.id;
      dragHandle.setAttribute("aria-hidden", "true");
      dragHandle.title = "Drag to reorder";
      const actions = element("div", "mock-layout-row-actions");
      [["move", "Move…", "Move to another container"], ["up", "↑", "Move up"], ["down", "↓", "Move down"], ["remove", "×", "Remove"]].forEach(([action, text, label]) => {
        const button = element("button", "", text);
        button.type = "button";
        button.dataset.layoutAction = action;
        button.dataset.layoutNode = node.id;
        button.setAttribute("aria-label", label);
        button.title = label;
        actions.append(button);
      });

      if (isContainer(node)) {
        const typeSummary = element("div", "mock-layout-static-control", `${flowOptions.find((option) => option.value === node.type)?.label || node.type} container`);
        const pathSummary = element("div", "mock-layout-static-control", layoutNodePath(view, node));
        const open = element("button", "mock-layout-open", "Open");
        open.type = "button";
        open.dataset.layoutOpen = node.id;
        row.classList.add("container-row");
        row.append(
          dragHandle,
          labeledControl("Node type", typeSummary),
          labeledControl("Path", pathSummary),
          labeledControl("Container", open),
          actions,
        );
      } else {
        const type = makeSelect(typeOptions, node.type, { layoutNode: node.id, layoutProperty: "type" });
        let valueControl;
        let valueLabel;
        if (node.type === "slot") {
          valueLabel = "Slot";
          valueControl = makeSelect(
            slotOptionsFor(view),
            node.value,
            { layoutNode: node.id, layoutProperty: "value" },
          );
        } else if (["text", "image", "input"].includes(node.type)) {
          valueLabel = `${node.type[0].toUpperCase() + node.type.slice(1)} target`;
          const targets = node.type === "text"
            ? ["description", "intro_text"]
            : node.type === "image"
              ? ["visual", "banner"]
              : ["quantity", "companions"];
          valueControl = makeSelect(
            targets.map((value) => ({ value, label: value.replace("_", " ") })),
            node.value,
            { layoutNode: node.id, layoutProperty: "value" },
          );
        } else if (node.type === "choice") {
          valueLabel = "Direct choice target";
          valueControl = makeSelect(
            [{ value: "featured", label: "Featured" }],
            node.value,
            { layoutNode: node.id, layoutProperty: "value" },
          );
        } else if (node.type === "rule") {
          valueLabel = "Separator";
          valueControl = element("div", "mock-layout-static-control", "Horizontal rule");
        } else {
          valueLabel = "Choice source";
          const expandControls = element("div", "mock-layout-expand-controls");
          expandControls.append(
            makeSelect([{ value: "main", label: "Main" }, { value: "secondary", label: "Secondary" }], node.source, { layoutNode: node.id, layoutProperty: "source" }),
            makeSelect([{ value: "origin_card" }, { value: "perk_card" }], node.using, { layoutNode: node.id, layoutProperty: "using" }),
          );
          valueControl = expandControls;
        }

        row.append(
          dragHandle,
          labeledControl("Node type", type),
          labeledControl(valueLabel, valueControl),
          labeledControl("Container", element("div", "mock-layout-static-control", layoutNodePath(view, selected))),
          actions,
        );
      }

      if (view.layoutTree.moving === node.id) {
        const moveOptions = containerOptions.filter((option) => option.value !== node.id && !isDescendantOf(option.value, node.id));
        const movePanel = element("div", "mock-layout-move-panel");
        movePanel.append(
          labeledControl("Move node to container", makeSelect(moveOptions, node.parent, { layoutMoveTarget: "true" })),
        );
        const confirm = element("button", "", "Move");
        confirm.type = "button";
        confirm.dataset.layoutConfirmMove = node.id;
        const cancel = element("button", "", "Cancel");
        cancel.type = "button";
        cancel.dataset.layoutCancelMove = "true";
        movePanel.append(confirm, cancel);
        row.append(movePanel);
      }
      table.append(row);
    });

    const addRow = element("div", "mock-layout-add-row");
    const newType = makeSelect(typeOptions, "slot", { layoutNewType: "true" });
    const addNode = element("button", "mock-layout-add", "Add child");
    addNode.type = "button";
    addNode.dataset.layoutAdd = "true";
    addRow.append(labeledControl("New node type", newType), addNode);

    builder.append(heading, levelNavigation, selectedEditor, childrenHeading, table, addRow);
    return builder;
  };

  const renderStructured = (view) => {
    const content = element("form", "mock-direct-editor");
    content.addEventListener("submit", (event) => event.preventDefault());

    const header = element("header", "mock-content-header");
    const identity = element("div");
    identity.append(element("p", "mock-content-kind", view.kind), element("h3", "", displayTitle(view)));
    header.append(identity);
    content.append(header);

    if (view.fields.length) {
      const fields = element("div", "mock-field-grid");
      view.fields.forEach((item) => {
        const label = element("label", item.wide ? "mock-field wide" : "mock-field");
        label.append(element("span", "", item.label));
        let control;
        if (item.type === "textarea") {
          control = document.createElement("textarea");
          control.rows = item.block ? 7 : 5;
          control.value = item.value;
        } else if (item.type === "select") {
          control = document.createElement("select");
          item.options.forEach((optionValue) => {
            const option = element("option", "", optionValue);
            option.value = optionValue;
            option.selected = optionValue === item.value;
            control.append(option);
          });
        } else {
          control = document.createElement("input");
          control.type = item.type || "text";
          control.value = item.value;
        }
        control.dataset.fieldKey = item.key;
        label.append(control);
        fields.append(label);
      });
      content.append(fields);
      if (view.layoutTree) content.append(renderLayoutBuilder(view));
      if (view.contextualAdd) {
        const add = element("button", "mock-inline-add", view.contextualAdd);
        add.type = "button";
        add.dataset.addKind = view.contextualAdd.replace(/^Add /, "").toLowerCase();
        content.append(add);
      }
    } else {
      const outline = element("div", "mock-file-outline");
      const keys = view.outline || [];
      if (keys.length) {
        keys.forEach((key) => {
          const item = element("div", "mock-outline-row");
          item.append(element("code", "", views[key].keyword), element("strong", "", views[key].title));
          outline.append(item);
        });
      } else {
        view.assets.forEach((name) => outline.append(element("div", "mock-outline-row", name)));
      }
      content.append(outline);
    }

    structuredPanel.replaceChildren(content);
  };

  const sourceKeywords = new Set([
    "jump", "section", "choice", "choice-source", "text", "image", "cost", "grant", "theme",
    "section-layout", "choice-layout", "trait-layout", "stack", "inline", "wrap", "grid", "expand", "rule",
  ]);

  const highlightedSource = (sourceLine) => {
    const code = element("code");
    const indent = sourceLine.match(/^\s*/)?.[0] || "";
    const content = sourceLine.slice(indent.length);
    code.append(document.createTextNode(indent));
    if (!content) return code;
    if (content.startsWith("#")) {
      code.append(element("span", "token-comment", content));
      return code;
    }

    const colonIndex = content.indexOf(":");
    if (colonIndex >= 0) {
      const fieldName = content.slice(0, colonIndex);
      const value = content.slice(colonIndex + 1);
      const fieldParts = fieldName.split(/(\s+when\s+)/);
      code.append(element("span", "token-field", fieldParts[0]));
      if (fieldParts.length > 1) {
        code.append(element("span", "token-keyword", fieldParts[1]));
        code.append(element("span", "token-reference", fieldParts.slice(2).join("")));
      }
      code.append(document.createTextNode(":"));
      if (value) {
        const valueClass = /^\s*"/.test(value)
          ? "token-string"
          : /^\s*-?\d/.test(value)
            ? "token-number"
            : "token-reference";
        code.append(element("span", valueClass, value));
      }
      return code;
    }

    const [first, ...rest] = content.split(/(\s+)/);
    code.append(element("span", sourceKeywords.has(first) ? "token-keyword" : "token-reference", first));
    if (rest.length) code.append(document.createTextNode(rest.join("")));
    return code;
  };

  const quickAddsFor = (view) => {
    if (view.kind === "Choice") return [["Text block", "T"], ["Image", "I"], ["Cost", "C"], ["Grant", "G"]];
    if (view.kind === "Section") return [["Choice source", "C"], ["Text block", "T"], ["Image", "I"]];
    if (view.kind === "Jump") return [["Section", "S"], ["Choice", "C"], ["Layout", "L"]];
    if (view.kind?.includes("layout")) return [["Slot", "S"], ["Text", "T"], ["Image", "I"], ["Input", "N"], ["Horizontal rule", "R"], ["Container", "C"]];
    if (view.kind === "Theme token") return [["Theme token", "T"]];
    if (view.file === "choices.jdef") return [["Choice", "C"]];
    if (view.file === "layout.jdef") return [["Layout", "L"], ["Theme token", "T"]];
    return [["Section", "S"], ["Choice", "C"]];
  };

  const ghostSourceFor = (view) => {
    if (view.kind === "Choice") return "  tag: featured";
    if (view.kind === "Section") return "  image";
    if (view.kind?.includes("layout")) return "    slot: description";
    if (view.kind === "Jump") return "section";
    return "# Type or open Quick add";
  };

  const renderSource = (view) => {
    const heading = element("div", "mock-source-heading");
    heading.append(element("span", "", view.file), element("code", "", view.keyword));

    const toolbar = element("div", "mock-pane-source-toolbar");
    const findButton = element("button", "", "Find");
    findButton.type = "button";
    findButton.dataset.paneSourceAction = "find";
    findButton.setAttribute("aria-expanded", "false");
    const addButton = element("button", "", "Quick add");
    addButton.type = "button";
    addButton.dataset.paneSourceAction = "palette";
    addButton.setAttribute("aria-expanded", "false");
    toolbar.append(findButton, addButton);

    const findBar = element("div", "mock-pane-source-find");
    findBar.hidden = true;
    const findInput = document.createElement("input");
    findInput.type = "search";
    findInput.placeholder = "Find in source";
    findInput.dataset.paneSourceFind = "";
    findInput.setAttribute("aria-label", "Find in selected source");
    const findCount = element("span", "", "No query");
    findCount.dataset.paneSourceFindCount = "";
    findBar.append(findInput, findCount);

    const stage = element("div", "mock-pane-source-stage");
    const editor = element("div", "mock-pane-source-code");
    editor.tabIndex = 0;
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", `${view.title} source`);

    const sourceLines = sourceFor(view).split("\n");
    sourceLines.forEach((sourceLine, index) => {
      const nextLine = sourceLines[index + 1] || "";
      const depth = sourceLine.match(/^\s*/)?.[0].length || 0;
      const nextDepth = nextLine.match(/^\s*/)?.[0].length || 0;
      const row = element("div", "mock-pane-source-line");
      row.dataset.sourceLine = String(index);
      row.dataset.sourceDepth = String(depth);
      row.append(element("span", "mock-pane-source-line-number", String(index + 1)));
      if (sourceLine.trim() && nextLine.trim() && nextDepth > depth) {
        const fold = element("button", "mock-pane-source-fold", "▾");
        fold.type = "button";
        fold.dataset.paneSourceFold = String(index);
        fold.setAttribute("aria-expanded", "true");
        fold.setAttribute("aria-label", `Collapse line ${index + 1}`);
        row.append(fold);
      } else {
        row.append(element("span", "mock-pane-source-fold-spacer"));
      }
      const code = highlightedSource(sourceLine);
      code.contentEditable = "true";
      code.spellcheck = false;
      code.dataset.sourceEditableLine = "";
      row.append(code);
      editor.append(row);
    });

    const ghostRow = element("div", "mock-pane-source-line mock-pane-source-ghost");
    ghostRow.dataset.sourceGhost = "";
    ghostRow.append(
      element("span", "mock-pane-source-line-number", String(sourceLines.length + 1)),
      element("span", "mock-pane-source-fold-spacer"),
    );
    const ghostCode = highlightedSource(ghostSourceFor(view));
    const ghostContent = element("span", "mock-pane-source-ghost-text");
    while (ghostCode.firstChild) ghostContent.append(ghostCode.firstChild);
    ghostCode.append(ghostContent, element("kbd", "", "Tab"));
    ghostRow.append(ghostCode);
    editor.append(ghostRow);

    const palette = element("aside", "source-context-palette mock-pane-source-palette");
    palette.dataset.paneSourcePalette = "";
    palette.hidden = true;
    const paletteHeader = document.createElement("header");
    const paletteTitle = element("div");
    paletteTitle.append(element("strong", "", "Quick add"), element("small", "", displayTitle(view)));
    const paletteClose = element("button", "", "×");
    paletteClose.type = "button";
    paletteClose.dataset.paneSourceAction = "close-palette";
    paletteClose.setAttribute("aria-label", "Close Quick add");
    paletteHeader.append(paletteTitle, paletteClose);
    palette.append(paletteHeader, element("p", "source-palette-label", "Valid here"));
    quickAddsFor(view).forEach(([label, shortcut]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.dataset.paneSourceAdd = label;
      option.dataset.paneSourceShortcut = shortcut.toLowerCase();
      const labelGroup = element("span");
      labelGroup.append(element("span", "", label), element("small", "", `Insert into ${view.keyword}`));
      option.append(labelGroup, element("kbd", "", `⌘ ${shortcut}`));
      palette.append(option);
    });
    palette.append(element("p", "source-palette-label", "Commands"));
    const quickFix = document.createElement("button");
    quickFix.type = "button";
    quickFix.disabled = true;
    const quickFixLabel = element("span");
    quickFixLabel.append(element("span", "", "Quick Fix"), element("small", "", "No deterministic fix at cursor"));
    quickFix.append(quickFixLabel, element("kbd", "", "⌘ ."));
    palette.append(quickFix);

    stage.append(editor, palette);
    const surface = element("div", "mock-pane-source-surface");
    surface.append(toolbar, findBar, stage);
    sourcePanel.replaceChildren(heading, surface);
  };

  const previewItemsFor = (view) => {
    if (view.choiceKeys) return view.choiceKeys.map((key) => views[key]);
    if (view.kind === "Jump") return [views.origins, views.perks];
    if (view.outline) return view.outline.map((key) => views[key]);
    return [];
  };

  const layoutGap = (token) => ({ none: "0", xs: "0.2rem", sm: "0.35rem", md: "0.55rem", lg: "0.8rem", xl: "1.1rem" })[token] || "0.55rem";

  const layoutByHandle = (handle) => Object.values(views).find((candidate) =>
    candidate.layoutTree && valueOf(candidate, "handle") === handle);

  const fallbackSectionLayout = {
    kind: "Section layout",
    layoutTree: {
      container: "stack",
      gap: "md",
      nodes: [
        { id: "fallback-section-name", parent: "root", type: "slot", value: "name" },
        { id: "fallback-section-description", parent: "root", type: "text", value: "description" },
        { id: "fallback-section-choices", parent: "root", type: "expand", source: "main" },
      ],
    },
  };

  const fallbackChoiceLayout = {
    kind: "Choice layout",
    layoutTree: {
      container: "stack",
      gap: "sm",
      nodes: [
        { id: "fallback-choice-name", parent: "root", type: "slot", value: "name" },
        { id: "fallback-choice-description", parent: "root", type: "text", value: "description" },
        { id: "fallback-choice-cost", parent: "root", type: "slot", value: "cost" },
        { id: "fallback-choice-control", parent: "root", type: "slot", value: "control" },
      ],
    },
  };

  const layoutForPreview = (view) => {
    if (view.layoutTree) return view;
    if (view.kind === "Section") return layoutByHandle(valueOf(view, "layout")) || fallbackSectionLayout;
    if (view.kind === "Choice") {
      const preferred = valueOf(view, "group") === "origins" ? "origin_card" : "perk_card";
      return layoutByHandle(preferred) || fallbackChoiceLayout;
    }
    return null;
  };

  const markPreviewBound = (node, kind, label) => {
    node.dataset.previewBound = kind;
    node.dataset.previewBoundLabel = label;
    node.title = label;
    return node;
  };

  const renderDummyLayout = (
    view,
    contentView = null,
    parent = "root",
    containerType = view.layoutTree.container,
    gap = view.layoutTree.gap,
    path = `${view.layoutTree.container}[1]`,
  ) => {
    const container = element("div", `mock-dummy-layout ${containerType}`);
    container.style.gap = layoutGap(gap);
    markPreviewBound(container, "container", `Container · ${path} · ${containerType}`);

    view.layoutTree.nodes.filter((node) => node.parent === parent).forEach((node, index) => {
      const nodePath = `${path}/${node.type}[${index + 1}]`;
      if (["stack", "inline", "wrap", "grid"].includes(node.type)) {
        container.append(renderDummyLayout(view, contentView, node.id, node.type, node.gap, nodePath));
      } else if (node.type === "slot") {
        const contentName = contentView ? displayTitle(contentView) : view.kind === "Section layout" ? "Origins" : "Flight";
        const contentCost = contentView && valueOf(contentView, "cost") ? `${valueOf(contentView, "cost")} JP` : "100 JP";
        const slots = {
          name: ["h4", "mock-dummy-name", contentName],
          cost: ["span", "mock-dummy-cost", contentCost],
          control: ["span", "mock-dummy-control", "Select"],
          roll: ["span", "mock-dummy-control", "Roll"],
          tags: ["span", "mock-dummy-tags", contentView ? `${valueOf(contentView, "group")} · ${contentView.kind.toLowerCase()}` : "movement · perk"],
        };
        const slot = element(...(slots[node.value] || ["span", "", node.value]));
        container.append(markPreviewBound(slot, "slot", `Slot · ${node.value}`));
      } else if (node.type === "text") {
        const text = contentView && valueOf(contentView, node.value)
          ? valueOf(contentView, node.value)
          : contentView && valueOf(contentView, "description")
            ? valueOf(contentView, "description")
            : "Dummy content shows how authored text will flow through this layout.";
        container.append(markPreviewBound(element("p", "mock-dummy-description", text), "reference", `Text · ${node.value}`));
      } else if (node.type === "image") {
        container.append(markPreviewBound(element("div", "mock-dummy-visual", "Image"), "reference", `Image · ${node.value}`));
      } else if (node.type === "input") {
        container.append(markPreviewBound(element("span", "mock-dummy-control", "Example input"), "reference", `Input · ${node.value}`));
      } else if (node.type === "rule") {
        container.append(markPreviewBound(element("hr", "mock-dummy-rule"), "reference", "Horizontal rule"));
      } else if (node.type === "expand") {
        const choices = element("div", "mock-dummy-choices");
        const expandedChoices = contentView?.choiceKeys?.map((key) => views[key]) || [views.human, views.dragon];
        expandedChoices.filter(Boolean).forEach((choiceView) => {
          const choiceLayout = layoutByHandle(node.using) || layoutForPreview(choiceView) || fallbackChoiceLayout;
          const card = element("article", "mock-dummy-choice");
          card.append(renderDummyLayout(choiceLayout, choiceView));
          choices.append(card);
        });
        container.append(markPreviewBound(choices, "reference", `Choice source · ${node.source || "main"}`));
      }
    });
    return container;
  };

  const renderPreview = (view) => {
    const previewShell = element("div", "mock-preview-shell");
    const preview = element("div", "mock-preview-section");
    const activeLayout = layoutForPreview(view);
    if (activeLayout) {
      const tools = element("div", "mock-preview-layout-tools");
      const toggleRow = element("div", "mock-preview-toggle-row");
      const boundsToggle = element("label", "mock-preview-bounds-toggle");
      const boundsCheckbox = element("input");
      boundsCheckbox.type = "checkbox";
      boundsCheckbox.checked = layoutBoundsVisible;
      boundsCheckbox.dataset.previewBoundsToggle = "true";
      boundsToggle.append(
        boundsCheckbox,
        element("span", "", "Show bounds"),
      );
      const colorToggle = element("label", "mock-preview-bounds-toggle");
      const colorCheckbox = element("input");
      colorCheckbox.type = "checkbox";
      colorCheckbox.checked = stripPreviewColor;
      colorCheckbox.dataset.previewColorToggle = "true";
      colorToggle.append(
        colorCheckbox,
        element("span", "", "Strip color"),
      );
      toggleRow.append(boundsToggle, colorToggle);
      const legend = element("div", "mock-preview-bounds-legend");
      legend.hidden = !layoutBoundsVisible;
      [["container", "Container"], ["slot", "Slot"], ["reference", "Reference"]].forEach(([kind, label]) => {
        const item = element("span", "");
        item.dataset.previewLegend = kind;
        item.append(element("i", ""), document.createTextNode(label));
        legend.append(item);
      });
      const readout = element("div", "mock-preview-bounds-readout");
      readout.hidden = !layoutBoundsVisible;
      readout.setAttribute("role", "status");
      readout.setAttribute("aria-live", "polite");
      readout.append(element("i", ""), element("span", "", "Hover a bound to inspect"));
      tools.append(toggleRow, legend, readout);
      previewShell.append(tools);
      preview.classList.toggle("show-layout-bounds", layoutBoundsVisible);
      preview.classList.toggle("strip-layout-color", stripPreviewColor);
    }
    preview.append(element("p", "preview-kicker", `${view.kind} preview`));

    if (activeLayout) {
      if (view.layoutTree) {
        preview.append(element("h3", "", displayTitle(view)));
        if (view.description) preview.append(element("p", "", view.description));
      }
      preview.append(renderDummyLayout(activeLayout, view.layoutTree ? null : view));
    } else if (view.kind === "Theme") {
      preview.append(element("h3", "", displayTitle(view)));
      const swatch = element("div", "mock-theme-preview");
      swatch.style.backgroundColor = valueOf(view, "color");
      swatch.textContent = valueOf(view, "color");
      preview.append(swatch);
    } else if (view.assets) {
      preview.append(element("h3", "", displayTitle(view)));
      const list = element("div", "mock-preview-list");
      view.assets.forEach((name) => {
        const item = element("article", "mock-preview-item");
        item.append(element("strong", "", name), element("small", "", "Image asset"));
        list.append(item);
      });
      preview.append(list);
    } else {
      const title = displayTitle(view);
      preview.append(element("h3", "", title));
      const description = valueOf(view, "description") || view.description;
      if (description) preview.append(element("p", "", description));
      const items = previewItemsFor(view);
      if (items.length) {
        const list = element("div", "mock-preview-list");
        items.forEach((itemView) => {
          const item = element("article", "mock-preview-item");
          const name = valueOf(itemView, "name") || itemView.title;
          const note = valueOf(itemView, "description") || itemView.kind;
          const identity = element("div");
          identity.append(element("strong", "", name), element("small", "", note));
          item.append(identity);
          const cost = valueOf(itemView, "cost");
          if (cost) item.append(element("span", "mock-item-meta", `${cost} JP`));
          list.append(item);
        });
        preview.append(list);
      }
    }
    previewShell.append(preview);
    previewPanel.replaceChildren(previewShell);
  };

  previewPanel.addEventListener("change", (event) => {
    if (event.target.matches("[data-preview-color-toggle]")) {
      stripPreviewColor = event.target.checked;
      previewPanel
        .querySelector(".mock-preview-section")
        ?.classList.toggle("strip-layout-color", stripPreviewColor);
      return;
    }
    if (event.target.matches("[data-preview-bounds-toggle]")) {
      layoutBoundsVisible = event.target.checked;
      previewPanel.querySelector(".mock-preview-section")?.classList.toggle("show-layout-bounds", layoutBoundsVisible);
      const legend = previewPanel.querySelector(".mock-preview-bounds-legend");
      if (legend) legend.hidden = !layoutBoundsVisible;
      const readout = previewPanel.querySelector(".mock-preview-bounds-readout");
      if (readout) readout.hidden = !layoutBoundsVisible;
      if (!layoutBoundsVisible) previewPanel.querySelectorAll(".is-preview-bound-active").forEach((node) => node.classList.remove("is-preview-bound-active"));
    }
  });

  const resetPreviewBoundReadout = () => {
    previewPanel.querySelectorAll(".is-preview-bound-active").forEach((node) => node.classList.remove("is-preview-bound-active"));
    const readout = previewPanel.querySelector(".mock-preview-bounds-readout");
    if (!readout) return;
    delete readout.dataset.previewBoundKind;
    const label = readout.querySelector("span");
    if (label) label.textContent = "Hover a bound to inspect";
  };

  previewPanel.addEventListener("pointerover", (event) => {
    const preview = previewPanel.querySelector(".show-layout-bounds");
    if (!preview) return;
    const bound = event.target.closest("[data-preview-bound]");
    if (!bound || !preview.contains(bound)) {
      resetPreviewBoundReadout();
      return;
    }
    previewPanel.querySelectorAll(".is-preview-bound-active").forEach((node) => node.classList.remove("is-preview-bound-active"));
    bound.classList.add("is-preview-bound-active");
    const readout = previewPanel.querySelector(".mock-preview-bounds-readout");
    if (!readout) return;
    readout.dataset.previewBoundKind = bound.dataset.previewBound;
    const label = readout.querySelector("span");
    if (label) label.textContent = bound.dataset.previewBoundLabel;
  });

  previewPanel.addEventListener("pointerleave", resetPreviewBoundReadout);

  const renderProperties = (view) => {
    const heading = element("div", "mock-properties-heading");
    heading.append(element("p", "preview-kicker", "Selected item"), element("h3", "", displayTitle(view)));
    const list = element("div", "mock-property-list");
    view.properties(view).forEach(([label, value]) => {
      const row = element("div", "mock-property-row");
      row.append(element("span", "", label), element("code", "", value));
      list.append(row);
    });
    propertiesPanel.replaceChildren(heading, list);
  };

  const renderView = (key) => {
    const view = views[key];
    if (!view) return;
    currentKey = key;
    renderStructured(view);
    renderSource(view);
    renderPreview(view);
    renderProperties(view);
    feedback.hidden = true;

    const preferredTabId = view.mode === "source" ? "source-tab" : lastContentEditorTabId;
    const preferredTab = document.getElementById(preferredTabId);
    preferredTab?.click();
  };

  const selectNavigationItem = (item) => {
    const panel = item.closest("[role='tabpanel']");
    const key = item.dataset.mockView;
    panel?.querySelectorAll(".mock-nav-item").forEach((candidate) => {
      const selected = candidate.dataset.mockView === key;
      candidate.classList.toggle("active", selected);
      if (selected) candidate.setAttribute("aria-current", "page");
      else candidate.removeAttribute("aria-current");
    });
    renderView(key);
  };

  document.querySelectorAll(".mock-nav-item").forEach((item) => {
    const syncFullNameHint = () => {
      const nameTarget = item.matches(".mock-layout-nav-item") ? item.querySelector(":scope > span") : item;
      const truncated = nameTarget.scrollWidth > nameTarget.clientWidth;
      if (truncated) item.title = nameTarget.textContent.trim();
      else item.removeAttribute("title");
    };
    syncFullNameHint();
    item.addEventListener("mouseenter", syncFullNameHint);
    item.addEventListener("focus", syncFullNameHint);
    item.addEventListener("click", () => selectNavigationItem(item));
  });

  const activateTab = (tabs, nextTab, moveFocus = false) => {
    if (["structured-tab", "source-tab"].includes(nextTab.id) && views[currentKey]?.mode !== "source") {
      lastContentEditorTabId = nextTab.id;
    }
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (panel) panel.hidden = !selected;
    });
    const panel = document.getElementById(nextTab.getAttribute("aria-controls"));
    const selectedItem = panel?.querySelector(".mock-nav-item.active");
    if (selectedItem) selectNavigationItem(selectedItem);
    if (moveFocus) nextTab.focus();
  };

  document.querySelectorAll("[role='tablist']").forEach((tabList) => {
    const tabs = [...tabList.querySelectorAll(":scope > [role='tab']")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tabs, tab));
      tab.addEventListener("keydown", (event) => {
        let nextIndex;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        activateTab(tabs, tabs[nextIndex], true);
      });
    });
  });

  structuredPanel.addEventListener("input", (event) => {
    const view = views[currentKey];
    if (!view.layoutTree) {
      const control = event.target.closest("[data-field-key]");
      if (!control) return;
      const item = view.fields.find((candidate) => candidate.key === control.dataset.fieldKey);
      if (!item) return;
      item.value = control.value;
      setDirty();
      renderSource(view);
      renderPreview(view);
      renderProperties(view);
      return;
    }

    const level = event.target.closest("[data-layout-selected]");
    if (level) {
      view.layoutTree.selected = level.value;
      renderStructured(view);
      return;
    }

    const selectedControl = event.target.closest("[data-layout-selected-property]");
    if (selectedControl) {
      const property = selectedControl.dataset.layoutSelectedProperty;
      const selected = view.layoutTree.selected === "root"
        ? view.layoutTree
        : view.layoutTree.nodes.find((node) => node.id === view.layoutTree.selected);
      if (!selected) return;
      if (property === "type") {
        if (view.layoutTree.selected === "root") selected.container = selectedControl.value;
        else selected.type = selectedControl.value;
      } else {
        selected[property] = selectedControl.value;
      }
      setDirty();
      renderSource(view);
      renderPreview(view);
      renderProperties(view);
      return;
    }

    const layoutControl = event.target.closest("[data-layout-node]");
    if (!layoutControl) return;
    const node = view.layoutTree.nodes.find((candidate) => candidate.id === layoutControl.dataset.layoutNode);
    const property = layoutControl.dataset.layoutProperty;
    if (!node) return;
    if (property === "type") {
      const preserved = { id: node.id, parent: node.parent, type: layoutControl.value };
      if (layoutControl.value === "slot") preserved.value = "name";
      else if (layoutControl.value === "text") preserved.value = "description";
      else if (layoutControl.value === "image") preserved.value = "visual";
      else if (layoutControl.value === "input") preserved.value = "quantity";
      else if (layoutControl.value === "rule") {
        // A rule is a targetless leaf.
      }
      else if (layoutControl.value === "expand") Object.assign(preserved, { source: "main", using: "origin_card" });
      else {
        Object.assign(preserved, { gap: "md" });
        view.layoutTree.selected = node.id;
      }
      Object.keys(node).forEach((key) => delete node[key]);
      Object.assign(node, preserved);
      renderStructured(view);
    } else {
      node[property] = layoutControl.value;
      if (property === "parent") renderStructured(view);
    }
    setDirty();
    renderSource(view);
    renderPreview(view);
    renderProperties(view);
  });

  let draggedLayoutNode = null;
  const clearLayoutDropIndicators = () => {
    structuredPanel.querySelectorAll(".mock-layout-row").forEach((row) => {
      row.classList.remove("drop-before", "drop-after");
    });
  };

  structuredPanel.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-layout-drag]");
    if (!handle) return;
    draggedLayoutNode = handle.dataset.layoutDrag;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedLayoutNode);
    handle.closest(".mock-layout-row")?.classList.add("dragging");
  });

  structuredPanel.addEventListener("dragover", (event) => {
    if (!draggedLayoutNode) return;
    const row = event.target.closest(".mock-layout-row");
    if (!row || row.dataset.layoutRow === draggedLayoutNode) return;
    const view = views[currentKey];
    const source = view.layoutTree?.nodes.find((node) => node.id === draggedLayoutNode);
    const target = view.layoutTree?.nodes.find((node) => node.id === row.dataset.layoutRow);
    if (!source || !target || source.parent !== target.parent) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearLayoutDropIndicators();
    const after = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    row.classList.add(after ? "drop-after" : "drop-before");
  });

  structuredPanel.addEventListener("drop", (event) => {
    if (!draggedLayoutNode) return;
    const row = event.target.closest(".mock-layout-row");
    const view = views[currentKey];
    const sourceIndex = view.layoutTree?.nodes.findIndex((node) => node.id === draggedLayoutNode) ?? -1;
    const targetId = row?.dataset.layoutRow;
    const target = view.layoutTree?.nodes.find((node) => node.id === targetId);
    const source = view.layoutTree?.nodes[sourceIndex];
    if (!row || sourceIndex < 0 || !target || source.parent !== target.parent) return;

    event.preventDefault();
    const placeAfter = row.classList.contains("drop-after");
    const [moved] = view.layoutTree.nodes.splice(sourceIndex, 1);
    const targetIndex = view.layoutTree.nodes.findIndex((node) => node.id === targetId);
    view.layoutTree.nodes.splice(targetIndex + (placeAfter ? 1 : 0), 0, moved);
    draggedLayoutNode = null;
    setDirty();
    renderStructured(view);
    renderSource(view);
    renderPreview(view);
    renderProperties(view);
  });

  structuredPanel.addEventListener("dragend", () => {
    draggedLayoutNode = null;
    clearLayoutDropIndicators();
    structuredPanel.querySelectorAll(".dragging").forEach((row) => row.classList.remove("dragging"));
  });

  const syncFieldsFromSource = (view, source) => {
    if (view.layoutTree) {
      const container = source.match(/^\s{2}(stack|inline|wrap|grid)\s*$/m);
      const gap = source.match(/^\s{4}gap:\s*(\S+)\s*$/m);
      if (container) view.layoutTree.container = container[1];
      if (gap) view.layoutTree.gap = gap[1];

      const lines = source.split("\n");
      const parsedNodes = [];
      const containers = [{ id: "root", indent: 2 }];
      let nodeNumber = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const indent = lines[index].match(/^\s*/)[0].length;
        if (indent < 4 || /^\s*gap:/.test(lines[index])) continue;
        while (containers.length > 1 && containers.at(-1).indent >= indent) containers.pop();
        const parent = containers.at(-1).id;
        const id = `node-${++nodeNumber}`;

        const leaf = lines[index].match(/^\s*(slot|text|image|input):\s*(\S+)\s*$/);
        if (leaf) parsedNodes.push({ id, parent, type: leaf[1], value: leaf[2] });

        if (/^\s*rule\s*$/.test(lines[index])) parsedNodes.push({ id, parent, type: "rule" });

        const nestedContainer = lines[index].match(/^\s*(stack|inline|wrap|grid)\s*$/);
        if (nestedContainer) {
          const nestedGap = lines[index + 1]?.match(/^\s*gap:\s*(\S+)\s*$/);
          parsedNodes.push({ id, parent, type: nestedContainer[1], gap: nestedGap?.[1] || "md" });
          containers.push({ id, indent });
        }

        if (/^\s*expand\s*$/.test(lines[index])) {
          const sourceLine = lines[index + 1]?.match(/^\s*source:\s*(\S+)\s*$/);
          const usingLine = lines[index + 2]?.match(/^\s*using:\s*(\S+)\s*$/);
          parsedNodes.push({ id, parent, type: "expand", source: sourceLine?.[1] || "main", using: usingLine?.[1] || "origin_card" });
        }
      }
      if (parsedNodes.length) view.layoutTree.nodes = parsedNodes;
    }

    view.fields.forEach((item) => {
      if (item.block) {
        const block = source.match(/content:\s*\n\s*"""\s*\n([\s\S]*?)\n\s*"""/);
        if (block) item.value = block[1].replace(/^\s{6}/gm, "").trim();
        return;
      }

      const key = item.sourceKey?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!key) return;
      const matches = [...source.matchAll(new RegExp(`^\\s*${key}:\\s*(.+)$`, "gm"))];
      if (!matches.length) return;
      const clean = (raw) => raw.trim().replace(/^"|"$/g, "");
      item.value = item.multiple
        ? matches.map((match) => clean(match[1])).join("; ")
        : clean(matches[0][1]);
    });
  };

  const sourceTextFromPane = () => [...sourcePanel.querySelectorAll("[data-source-editable-line]")]
    .map((line) => line.textContent)
    .join("\n");

  const setPaneSourceFindOpen = (open) => {
    const findBar = sourcePanel.querySelector(".mock-pane-source-find");
    const findButton = sourcePanel.querySelector('[data-pane-source-action="find"]');
    if (!findBar || !findButton) return;
    findBar.hidden = !open;
    findButton.setAttribute("aria-expanded", String(open));
    if (open) sourcePanel.querySelector("[data-pane-source-find]")?.focus();
  };

  const setPaneSourcePaletteOpen = (open) => {
    const palette = sourcePanel.querySelector("[data-pane-source-palette]");
    const paletteButton = sourcePanel.querySelector('[data-pane-source-action="palette"]');
    if (!palette || !paletteButton) return;
    palette.hidden = !open;
    paletteButton.setAttribute("aria-expanded", String(open));
    if (open) palette.querySelector("button:not(:disabled)")?.focus();
  };

  const updatePaneSourceFind = () => {
    const input = sourcePanel.querySelector("[data-pane-source-find]");
    const count = sourcePanel.querySelector("[data-pane-source-find-count]");
    if (!input || !count) return;
    const query = input.value.trim().toLowerCase();
    const matches = [...sourcePanel.querySelectorAll(".mock-pane-source-line:not(.mock-pane-source-ghost)")]
      .filter((line) => query && line.textContent.toLowerCase().includes(query));
    sourcePanel.querySelectorAll(".mock-pane-source-line").forEach((line) => {
      line.classList.toggle("find-match", matches.includes(line));
    });
    count.textContent = matches.length ? `1 of ${matches.length}` : query ? "No results" : "No query";
  };

  const acceptPaneSourceGhost = (replacement) => {
    const ghost = sourcePanel.querySelector("[data-source-ghost]");
    if (!ghost) return;
    const existingCode = ghost.querySelector("code");
    const sourceLine = replacement || existingCode?.textContent.replace(/Tab$/, "").trimEnd();
    const leading = existingCode?.textContent.match(/^\s*/)?.[0] || "";
    const code = highlightedSource(replacement ? `${leading}${sourceLine}` : sourceLine);
    code.contentEditable = "true";
    code.spellcheck = false;
    code.dataset.sourceEditableLine = "";
    ghost.replaceChild(code, existingCode);
    ghost.classList.add("accepted");
    delete ghost.dataset.sourceGhost;
    setDirty();
  };

  sourcePanel.addEventListener("input", (event) => {
    if (event.target.matches("[data-pane-source-find]")) {
      updatePaneSourceFind();
      return;
    }
    if (!event.target.closest("[data-source-editable-line]")) return;
    setDirty();
    const view = views[currentKey];
    syncFieldsFromSource(view, sourceTextFromPane());
    renderStructured(view);
    renderPreview(view);
    renderProperties(view);
  });

  sourcePanel.addEventListener("click", (event) => {
    const fold = event.target.closest("[data-pane-source-fold]");
    if (fold) {
      const owner = fold.closest(".mock-pane-source-line");
      const rows = [...sourcePanel.querySelectorAll(".mock-pane-source-line:not(.mock-pane-source-ghost)")];
      const ownerIndex = rows.indexOf(owner);
      const ownerDepth = Number(owner.dataset.sourceDepth);
      const collapse = fold.getAttribute("aria-expanded") === "true";
      for (let index = ownerIndex + 1; index < rows.length; index += 1) {
        const rowDepth = Number(rows[index].dataset.sourceDepth);
        if (rowDepth <= ownerDepth) break;
        rows[index].hidden = collapse;
      }
      fold.setAttribute("aria-expanded", String(!collapse));
      fold.textContent = collapse ? "▸" : "▾";
      return;
    }

    const action = event.target.closest("[data-pane-source-action]")?.dataset.paneSourceAction;
    if (action === "find") setPaneSourceFindOpen(sourcePanel.querySelector(".mock-pane-source-find").hidden);
    if (action === "palette") setPaneSourcePaletteOpen(sourcePanel.querySelector("[data-pane-source-palette]").hidden);
    if (action === "close-palette") setPaneSourcePaletteOpen(false);

    const add = event.target.closest("[data-pane-source-add]");
    if (add) {
      const snippets = {
        "Text block": "text",
        Image: "image",
        Cost: "cost: 100",
        Grant: "grant: perk",
        "Choice source": "choice-source",
        Section: "section",
        Choice: "choice",
        Layout: "section-layout",
        Slot: "slot: description",
        Text: "text: description",
        Image: "image: visual",
        Input: "input: quantity",
        "Horizontal rule": "rule",
        Container: "stack",
        "Theme token": "theme",
      };
      acceptPaneSourceGhost(snippets[add.dataset.paneSourceAdd] || add.dataset.paneSourceAdd);
      setPaneSourcePaletteOpen(false);
    }
  });

  sourcePanel.addEventListener("keydown", (event) => {
    const commandKey = event.ctrlKey || event.metaKey;
    if (commandKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setPaneSourceFindOpen(true);
      return;
    }
    if (commandKey && event.key === "Enter") {
      event.preventDefault();
      const palette = sourcePanel.querySelector("[data-pane-source-palette]");
      setPaneSourcePaletteOpen(palette.hidden);
      return;
    }
    const palette = sourcePanel.querySelector("[data-pane-source-palette]");
    if (commandKey && !event.altKey && !event.shiftKey && !palette.hidden) {
      const shortcut = palette.querySelector(`[data-pane-source-shortcut="${event.key.toLowerCase()}"]`);
      if (shortcut) {
        event.preventDefault();
        shortcut.click();
        return;
      }
    }
    const sourceEditingTarget = event.target.matches("[data-source-editable-line], .mock-pane-source-code");
    if (event.key === "Tab" && sourceEditingTarget && sourcePanel.querySelector("[data-source-ghost]")) {
      event.preventDefault();
      acceptPaneSourceGhost();
      return;
    }
    if (event.key === "Escape") {
      setPaneSourceFindOpen(false);
      setPaneSourcePaletteOpen(false);
    }
  });

  contentSearch.addEventListener("input", () => {
    const query = contentSearch.value.trim().toLowerCase();
    document.querySelectorAll("#content-panel .mock-nav-item").forEach((item) => {
      item.hidden = query !== "" && !item.textContent.toLowerCase().includes(query);
    });
    document.querySelectorAll("#content-panel .mock-nav-group").forEach((group) => {
      const visibleItems = [...group.querySelectorAll(".mock-nav-item")].some((item) => !item.hidden);
      group.hidden = query !== "" && !visibleItems;
      if (query && visibleItems) group.open = true;
    });
  });

  const showAddFeedback = (kind) => {
    feedback.textContent = `Add ${kind} would insert a new ${kind} and focus its fields in the Structured editor.`;
    feedback.hidden = false;
  };

  structuredPanel.addEventListener("click", (event) => {
    const confirmMove = event.target.closest("[data-layout-confirm-move]");
    if (confirmMove) {
      const view = views[currentKey];
      const node = view.layoutTree.nodes.find((candidate) => candidate.id === confirmMove.dataset.layoutConfirmMove);
      const target = confirmMove.closest(".mock-layout-row").querySelector("[data-layout-move-target]")?.value;
      if (node && target) node.parent = target;
      view.layoutTree.moving = null;
      setDirty();
      renderStructured(view);
      renderSource(view);
      renderPreview(view);
      renderProperties(view);
      return;
    }
    const cancelMove = event.target.closest("[data-layout-cancel-move]");
    if (cancelMove) {
      const view = views[currentKey];
      view.layoutTree.moving = null;
      renderStructured(view);
      return;
    }
    const layoutOpen = event.target.closest("[data-layout-open]");
    if (layoutOpen) {
      const view = views[currentKey];
      view.layoutTree.selected = layoutOpen.dataset.layoutOpen;
      renderStructured(view);
      return;
    }
    const layoutAction = event.target.closest("[data-layout-action]");
    if (layoutAction) {
      const view = views[currentKey];
      const index = view.layoutTree.nodes.findIndex((node) => node.id === layoutAction.dataset.layoutNode);
      const action = layoutAction.dataset.layoutAction;
      if (action === "move") {
        view.layoutTree.moving = layoutAction.dataset.layoutNode;
        renderStructured(view);
        return;
      }
      if (index >= 0 && action === "remove") {
        const [removed] = view.layoutTree.nodes.splice(index, 1);
        view.layoutTree.nodes
          .filter((node) => node.parent === removed.id)
          .forEach((child) => { child.parent = removed.parent; });
      }
      if (index >= 0 && (action === "up" || action === "down")) {
        const parent = view.layoutTree.nodes[index].parent;
        const siblings = view.layoutTree.nodes.filter((node) => node.parent === parent);
        const siblingIndex = siblings.findIndex((node) => node.id === layoutAction.dataset.layoutNode);
        const other = action === "up" ? siblings[siblingIndex - 1] : siblings[siblingIndex + 1];
        if (other) {
          const otherIndex = view.layoutTree.nodes.findIndex((node) => node.id === other.id);
          [view.layoutTree.nodes[index], view.layoutTree.nodes[otherIndex]] = [view.layoutTree.nodes[otherIndex], view.layoutTree.nodes[index]];
        }
      }
      setDirty();
      renderStructured(view);
      renderSource(view);
      renderPreview(view);
      renderProperties(view);
      return;
    }
    const layoutAdd = event.target.closest("[data-layout-add]");
    if (layoutAdd) {
      const view = views[currentKey];
      const type = structuredPanel.querySelector("[data-layout-new-type]")?.value || "slot";
      const node = { id: `node-${Date.now()}`, parent: view.layoutTree.selected, type };
      if (type === "slot") node.value = "name";
      else if (type === "text") node.value = "description";
      else if (type === "image") node.value = "visual";
      else if (type === "input") node.value = "quantity";
      else if (type === "rule") {
        // A rule is a targetless leaf.
      }
      else if (type === "expand") Object.assign(node, { source: "main", using: "origin_card" });
      else {
        Object.assign(node, { gap: "md" });
        view.layoutTree.selected = node.id;
      }
      view.layoutTree?.nodes.push(node);
      setDirty();
      renderStructured(view);
      renderSource(view);
      renderPreview(view);
      renderProperties(view);
      return;
    }
    const button = event.target.closest("[data-add-kind]");
    if (button) showAddFeedback(button.dataset.addKind);
  });

  addButton.addEventListener("click", () => {
    const expanded = addButton.getAttribute("aria-expanded") === "true";
    addButton.setAttribute("aria-expanded", String(!expanded));
    addOptions.hidden = expanded;
    if (!expanded) addOptions.querySelector("button")?.focus();
  });

  addOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-add-kind]");
    if (!option) return;
    addOptions.hidden = true;
    addButton.setAttribute("aria-expanded", "false");
    addButton.focus();
    showAddFeedback(option.dataset.addKind);
  });

  addOptions.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    addOptions.hidden = true;
    addButton.setAttribute("aria-expanded", "false");
    addButton.focus();
  });

  const enabledDiagnosticSeverities = new Set(["error", "warning", "info"]);
  const diagnosticItems = [...diagnosticsDetails.querySelectorAll("[data-diagnostic-severity]")];

  const updateDiagnosticFilters = () => {
    let visibleCount = 0;
    document.querySelectorAll("[data-diagnostic-filter]").forEach((button) => {
      const severity = button.dataset.diagnosticFilter;
      const enabled = enabledDiagnosticSeverities.has(severity);
      const count = diagnosticItems.filter((item) => item.dataset.diagnosticSeverity === severity).length;
      button.setAttribute("aria-pressed", String(enabled));
      const countNode = button.querySelector(`[data-diagnostic-count="${severity}"]`);
      if (countNode) countNode.textContent = String(count);
    });
    diagnosticItems.forEach((item) => {
      item.hidden = !enabledDiagnosticSeverities.has(item.dataset.diagnosticSeverity);
      if (!item.hidden) visibleCount += 1;
    });
    diagnosticsEmpty.hidden = visibleCount !== 0;

    const summaryItem = ["error", "warning"]
      .filter((severity) => enabledDiagnosticSeverities.has(severity))
      .map((severity) => diagnosticItems.find((item) => item.dataset.diagnosticSeverity === severity))
      .find(Boolean);
    diagnosticsSummary.hidden = !summaryItem;
    if (summaryItem) {
      const severity = summaryItem.dataset.diagnosticSeverity;
      const icon = element("span", "mock-diagnostic-icon", severity === "error" ? "×" : "!");
      icon.setAttribute("aria-hidden", "true");
      const message = element("span", "mock-diagnostics-summary-text", summaryItem.dataset.diagnosticSummary);
      diagnosticsSummary.className = `mock-diagnostics-summary is-${severity}`;
      diagnosticsSummary.replaceChildren(icon, message);
    }
  };

  diagnosticsToggle.addEventListener("click", () => {
    const expanded = diagnosticsToggle.getAttribute("aria-expanded") === "true";
    diagnosticsToggle.setAttribute("aria-expanded", String(!expanded));
    diagnosticsDetails.hidden = expanded;
  });

  document.querySelectorAll("[data-diagnostic-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const severity = button.dataset.diagnosticFilter;
      if (enabledDiagnosticSeverities.has(severity)) enabledDiagnosticSeverities.delete(severity);
      else enabledDiagnosticSeverities.add(severity);
      updateDiagnosticFilters();
    });
  });

  updateDiagnosticFilters();

  const collapsedSourceGroups = new Set();
  const sourceDemo = document.querySelector("#source-code-demo");
  const sourceEditorDemo = document.querySelector(".source-editor-demo");
  const sourceDemoType = document.querySelector("#source-demo-type");
  const sourceDemoFind = document.querySelector("#source-demo-find");
  const sourceFindBar = document.querySelector("#source-find-bar");
  const sourceFindInput = document.querySelector("#source-find-input");
  const sourceFindCount = document.querySelector("#source-find-count");
  const sourceCodeStage = document.querySelector(".source-code-stage");
  const sourceDemoPalette = document.querySelector("#source-demo-palette");
  const sourceContextPalette = document.querySelector("#source-context-palette");
  const sourcePaletteClose = document.querySelector("#source-palette-close");
  const sourcePaletteResolution = document.querySelector("#source-palette-resolution");
  const sourcePaletteNoFields = document.querySelector("#source-palette-no-fields");
  const sourcePaletteQuickFix = document.querySelector("#source-palette-quick-fix");
  const sourceGhostLine = document.querySelector("#source-ghost-line");
  const sourceDemoDiagnostic = document.querySelector("#source-demo-diagnostic");
  const sourcePreviewStatus = document.querySelector("#source-preview-status");
  const sourceModeLine = document.querySelector(".diagnostic-line code");
  let sourceDebounceTimer;
  let sourceHasSyntaxIssue = true;

  const renderSourceModeLine = (fixed) => {
    const fieldToken = element("span", "token-field", "mode");
    const valueToken = element("span", fixed ? "token-reference" : "token-reference diagnostic-token", "single");
    sourceModeLine?.replaceChildren(
      document.createTextNode("    "),
      fieldToken,
      document.createTextNode(fixed ? ": " : " "),
      valueToken,
    );
  };

  const updateSourceFolding = () => {
    sourceDemo?.querySelectorAll(".source-line").forEach((line) => {
      const ancestors = (line.dataset.sourceAncestors || "").split(" ").filter(Boolean);
      line.hidden = ancestors.some((group) => collapsedSourceGroups.has(group));
      if (line.dataset.sourceGroup) line.classList.toggle("collapsed", collapsedSourceGroups.has(line.dataset.sourceGroup));
    });
  };

  const setSourceFindOpen = (open) => {
    if (!sourceFindBar || !sourceDemoFind || !sourceCodeStage) return;
    sourceFindBar.hidden = !open;
    sourceDemoFind.setAttribute("aria-expanded", String(open));
    sourceCodeStage.classList.toggle("finding", open && Boolean(sourceFindInput?.value));
    if (open) {
      sourceFindInput?.focus();
      sourceFindInput?.select();
    }
  };

  const updateSourceFind = () => {
    if (!sourceFindInput || !sourceFindCount || !sourceCodeStage || !sourceDemo) return;
    const query = sourceFindInput.value.trim().toLowerCase();
    const matchingLines = [...sourceDemo.querySelectorAll(".source-line")].filter((line) => (
      query && line.textContent.toLowerCase().includes(query)
    ));
    sourceDemo.querySelectorAll(".source-line").forEach((line) => {
      line.classList.toggle("source-find-match", matchingLines.includes(line));
    });
    const count = matchingLines.length;
    sourceFindCount.textContent = count ? `1 of ${count}` : "No results";
    sourceCodeStage.classList.toggle("finding", count > 0);
  };

  const setSourcePaletteOpen = (open) => {
    if (!sourceContextPalette || !sourceDemoPalette) return;
    sourceContextPalette.hidden = !open;
    sourceDemoPalette.setAttribute("aria-expanded", String(open));
    if (open) sourceContextPalette.querySelector("button:not([hidden])")?.focus();
    else sourceDemo?.focus();
  };

  const applySourceQuickFix = () => {
    if (!sourceHasSyntaxIssue) return;
    window.clearTimeout(sourceDebounceTimer);
    sourceHasSyntaxIssue = false;
    sourceEditorDemo?.classList.remove("debouncing");
    renderSourceModeLine(true);
    sourcePaletteQuickFix.hidden = true;
    sourceDemoDiagnostic.replaceChildren(
      document.createTextNode("Quick Fix wrote the recovered "),
      element("code", "", ":"),
      document.createTextNode(" after "),
      element("code", "", "mode"),
      document.createTextNode("."),
    );
    sourcePreviewStatus.textContent = "Preview: source and preview agree";
  };

  const acceptSourceGhostText = () => {
    if (!sourceGhostLine || sourceGhostLine.classList.contains("accepted")) return;
    sourceGhostLine.classList.add("accepted");
    sourcePaletteResolution.hidden = true;
    sourcePaletteNoFields.hidden = false;
    sourceDemoDiagnostic.replaceChildren(
      document.createTextNode("Inserted context-valid field "),
      element("code", "", "resolution: either"),
      document.createTextNode("."),
    );
  };

  const runSourcePaletteAction = (action) => {
    if (action === "find") {
      setSourcePaletteOpen(false);
      setSourceFindOpen(true);
      return;
    }
    if (action === "resolution") acceptSourceGhostText();
    if (action === "quick-fix") applySourceQuickFix();
    if (action === "completion") {
      sourceDemoDiagnostic.textContent = "Full completions would show only valid choice-source values and package handles.";
      sourceDemo?.focus();
    }
    if (action === "fold") sourceDemo?.querySelector('[data-source-fold="choice-source"]')?.click();
    setSourcePaletteOpen(false);
  };

  sourceDemo?.querySelectorAll("[data-source-fold]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.sourceFold;
      const collapse = !collapsedSourceGroups.has(group);
      if (collapse) collapsedSourceGroups.add(group);
      else collapsedSourceGroups.delete(group);
      button.setAttribute("aria-expanded", String(!collapse));
      button.textContent = collapse ? "▸" : "▾";
      updateSourceFolding();
    });
  });

  sourceDemoFind?.addEventListener("click", () => setSourceFindOpen(sourceFindBar.hidden));
  sourceFindInput?.addEventListener("input", updateSourceFind);

  sourceDemoPalette?.addEventListener("click", () => setSourcePaletteOpen(sourceContextPalette.hidden));
  sourcePaletteClose?.addEventListener("click", () => setSourcePaletteOpen(false));
  sourceContextPalette?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-source-palette-action]")?.dataset.sourcePaletteAction;
    if (action) runSourcePaletteAction(action);
  });

  sourceEditorDemo?.addEventListener("keydown", (event) => {
    const commandKey = event.ctrlKey || event.metaKey;
    if (commandKey && event.key === "Enter") {
      event.preventDefault();
      setSourcePaletteOpen(sourceContextPalette.hidden);
      return;
    }
    if (commandKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setSourceFindOpen(true);
      return;
    }
    if (commandKey && event.key === ".") {
      event.preventDefault();
      applySourceQuickFix();
      return;
    }
    if (commandKey && event.key === " ") {
      event.preventDefault();
      runSourcePaletteAction("completion");
      return;
    }
    if (commandKey && event.shiftKey && event.code === "BracketLeft") {
      event.preventDefault();
      runSourcePaletteAction("fold");
      return;
    }
    if (!sourceContextPalette.hidden && commandKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      runSourcePaletteAction("resolution");
      return;
    }
    if (event.key === "Tab" && document.activeElement === sourceDemo && !sourceGhostLine.classList.contains("accepted")) {
      event.preventDefault();
      acceptSourceGhostText();
      return;
    }
    if (event.key === "Escape") {
      setSourcePaletteOpen(false);
      setSourceFindOpen(false);
    }
  });

  sourceDemoType?.addEventListener("click", () => {
    window.clearTimeout(sourceDebounceTimer);
    sourceHasSyntaxIssue = true;
    renderSourceModeLine(false);
    sourcePaletteQuickFix.hidden = false;
    sourceEditorDemo.classList.add("debouncing");
    sourceDemoDiagnostic.textContent = "Typing detected; parsing waits for a short idle period.";
    sourcePreviewStatus.textContent = "Preview: last valid (waiting)";
    sourceDebounceTimer = window.setTimeout(() => {
      sourceEditorDemo.classList.remove("debouncing");
      sourceDemoDiagnostic.replaceChildren(
        document.createTextNode("Preview safely inferred the missing “:” after "),
        element("code", "", "mode"),
        document.createTextNode(" without rewriting source. Press "),
        element("kbd", "", "⌘ ."),
        document.createTextNode(" to commit it."),
      );
      sourcePreviewStatus.textContent = "Preview: safely recovered";
    }, 700);
  });

  updateSourceFind();

  renderView("origins");
})();

(() => {
  const workspace = document.querySelector(".asset-editor-design");
  const mode = document.querySelector("#asset-design-mode");
  const state = document.querySelector("#asset-design-state");
  const zoom = document.querySelector("#asset-design-zoom");
  const zoomOutput = document.querySelector("#asset-design-zoom-output");
  const raster = workspace?.querySelector(".asset-design-raster");
  const svg = workspace?.querySelector(".asset-design-svg");
  const status = workspace?.querySelector(".asset-design-status");
  if (!workspace || !mode || !state || !zoom || !zoomOutput || !raster || !svg)
    return;
  const renderMode = () => {
    workspace.dataset.assetEditorMode = mode.value;
    raster.hidden = mode.value !== "raster";
    svg.hidden = mode.value !== "svg";
  };
  const renderState = () => {
    workspace.dataset.assetEditorState = state.value;
    if (!status) return;
    status.textContent =
      {
        ready: "640 × 360 · Preview updated",
        rendering: "Rendering full resolution…",
        warning: "sRGB profile normalized · Preview updated",
        error: "Validation failed · Previous valid preview retained",
      }[state.value] ?? "";
  };
  const renderZoom = () => {
    zoomOutput.value = `${zoom.value}%`;
    workspace.style.setProperty("--asset-design-zoom", String(zoom.value / 100));
  };
  mode.addEventListener("change", renderMode);
  state.addEventListener("change", renderState);
  zoom.addEventListener("input", renderZoom);
  renderMode();
  renderState();
  renderZoom();
})();
