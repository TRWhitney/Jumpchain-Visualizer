(() => {
  const explorer = document.querySelector(".supplement-explorer");
  if (!explorer) return;

  const candidates = {
    "classic-body-mod": { family: "Foundation family", title: "Classic Body Mod", recommendation: "Supported", summary: "A compact persistent baseline body configured independently from ordinary Jump forms.", state: "Body selections, point balance, derived baseline form", integrations: "Forms, power-loss rendering, shared choice controls, contextual statistics", risk: "Selecting an exact edition and securing permission to distribute its content" },
    "essential-body-mod": { family: "Foundation family", title: "Essential Body Modification", recommendation: "Supported alternative", summary: "A broader, mode-driven body foundation with progression and conversion mechanics.", state: "Essences, perks, drawbacks, advancement mode, multiple resources", integrations: "Forms, companions where supported, every-Jump conversions, contextual statistics", risk: "Large rules surface and substantially greater cross-feature coupling" },
    "cosmic-warehouse": { family: "Persistent-space family", title: "Cosmic Warehouse", recommendation: "Supported", summary: "A persistent storage space with utilities, structures, access rules, and its own budget.", state: "Warehouse points, facilities, access upgrades, add-on provenance", integrations: "Inventory, item return/storage, Jump-authored add-on hooks, contextual summary", risk: "Distinguishing tracked item location from abstract ownership" },
    "personal-reality": { family: "Persistent-space family", title: "Personal Reality", recommendation: "Supported alternative", summary: "A larger home-and-storage system intended to replace several overlapping space supplements.", state: "Initial choices, expansions, accrued points, facilities, integration choices", integrations: "Inventory, companions, housing, at-a-glance and spend-points contextual tools", risk: "Replacement rules and incompatibility with other persistent spaces" },
    "universal-drawbacks": { family: "Rules family", title: "Universal Drawbacks", recommendation: "Supported", summary: "Chain-long and recurring drawbacks that alter budgets, restrictions, and other supplement resources.", state: "Active drawbacks, duration, awards and cancellations", integrations: "Every-Jump budget, validation, other supplement resources, contextual effects", risk: "Requires an explicit cross-Jump rule-effect engine" },
    "quest-mode": { family: "Rules family", title: "Quest Mode", recommendation: "Supported", summary: "Replaces ordinary starting CP with quest awards earned independently within each Jump.", state: "Per-Jump quest checklist, optional rules, earned-CP provenance", integrations: "Actor budgets, current-Jump contextual checklist, purchase revalidation", risk: "Unchecked quests can create deficits without automatically undoing purchases" },
    story: { family: "Narrative family", title: "Story", recommendation: "First-party", summary: "Stores and presents one rich narrative document for every Jump in the chain.", state: "Per-entry story source, formatting, text colors", integrations: "Current-Jump Live Preview editor, oldest-to-newest supplement page", risk: "Live Preview parsing and strict sanitization must share one deterministic document model" },
  };
  const filterButtons = [...explorer.querySelectorAll("[data-supplement-filter]")];
  const candidateButtons = [...explorer.querySelectorAll("[data-supplement-candidate]")];
  const empty = explorer.querySelector("#supplement-candidate-empty");

  const selectCandidate = (button, moveFocus = false) => {
    if (!button || button.hidden) return;
    candidateButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    const detail = candidates[button.dataset.supplementCandidate];
    explorer.querySelector("#supplement-detail-family").textContent = detail.family;
    explorer.querySelector("#supplement-detail-title").textContent = detail.title;
    explorer.querySelector("#supplement-detail-recommendation").textContent = detail.recommendation;
    explorer.querySelector("#supplement-detail-summary").textContent = detail.summary;
    explorer.querySelector("#supplement-detail-state").textContent = detail.state;
    explorer.querySelector("#supplement-detail-integrations").textContent = detail.integrations;
    explorer.querySelector("#supplement-detail-risk").textContent = detail.risk;
    if (moveFocus) button.focus();
  };

  filterButtons.forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.supplementFilter;
    filterButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    candidateButtons.forEach((candidate) => { candidate.hidden = filter !== "all" && candidate.dataset.family !== filter; });
    const visible = candidateButtons.filter((candidate) => !candidate.hidden);
    empty.hidden = visible.length !== 0;
    if (!visible.some((candidate) => candidate.getAttribute("aria-pressed") === "true")) selectCandidate(visible[0]);
  }));
  candidateButtons.forEach((button) => button.addEventListener("click", () => selectCandidate(button)));

  const bodymod = document.querySelector(".bodymod-full-mock");
  const bodymodDialog = document.querySelector(".bodymod-dialog-mock");
  if (!bodymod || !bodymodDialog) return;

  const bodyTypes = {
    None: { cost: 0, initials: "UM", stats: {}, perks: {}, included: "No included ranks" },
    Bodybuilder: { cost: 100, initials: "BB", stats: { Strength: 2, Endurance: 2 }, perks: { Height: 1 }, included: "Strength 2 · Endurance 2 · Height 1" },
    Athlete: { cost: 100, initials: "AT", stats: { Speed: 2, Dexterity: 2 }, perks: { Flexibility: 1 }, included: "Speed 2 · Dexterity 2 · Flexibility 1" },
    Charmer: { cost: 100, initials: "CH", stats: { Appeal: 2, Shape: 2 }, perks: { Endowed: 3 }, included: "Appeal 2 · Shape 2 · Endowed 3" },
    Bestial: { cost: 150, initials: "BE", stats: { Sense: 2 }, perks: { Color: 1 }, included: "Sense 2 · Color 1 · animal-tier stat" },
  };
  const statDescriptions = {
    Strength: ["Human average.", "Bench press roughly 180 pounds.", "Bench press roughly 250 pounds.", "Lift about twice your body weight.", "Lift about three times your body weight."],
    Endurance: ["Human average.", "Run a mile without heavy breathing.", "Finish a 5K and recover easily.", "Run a marathon, rest, then do it again.", "Remain active all day without fatigue."],
    Speed: ["Human average.", "Run steadily at about 6 mph.", "Run steadily at about 15 mph.", "Comparable to Usain Bolt.", "Motorcycle-like sprinting speed."],
    Dexterity: ["Human average.", "Clear a hurdle at a sprint.", "Basic parkour while maintaining speed.", "Balance through difficult precision movement.", "Advanced wall-running, ziplines, and fall recovery."],
    Appeal: ["Human average.", "Clear, acne-free skin.", "Clean, healthy hair and skin.", "No wrinkles, scars, or blemishes.", "Perfectly smooth, flawless skin."],
    Shape: ["Human average.", "Even, healthy fat distribution.", "Choose a plausible leg-to-torso ratio.", "Pronounced supple or rigid proportions.", "An idealized, striking physique."],
    Sense: ["Human average.", "20/20 vision and ordinary healthy senses.", "Sharper vision and sensory acuity.", "Double the power and range of three senses.", "Perceive beyond a normal human spectrum."],
  };
  const perkDescriptions = {
    Height: ["No height adjustment.", "Adjust height up to one foot from the current age-group average.", "Adjust height up to two feet from the current age-group average."],
    Flexibility: ["Ordinary flexibility.", "Reach the natural physical limit of the current body.", "Become more flexible than the body would ordinarily permit."],
    Endowed: ["No adjustment.", "Adjust primary or secondary physical proportions by one tier."],
    Color: ["Natural coloration.", "Choose any naturally possible skin, hair, or eye color.", "Choose any imaginable coloration."],
    Winged: ["No wings.", "Functional wings that fold against the back when not in use."],
    Metavore: ["Ordinary fitness maintenance.", "Retain the selected physique with adequate nutrition."],
    Evercleansed: ["Ordinary cleanliness.", "Naturally repel dirt, mud, and body odor."],
    Genderswap: ["No Body Mod gender change.", "Change gender up to twice during a Jump."],
  };
  const state = {
    build: "Medium",
    type: "Athlete",
    purchasedStats: { Strength: 1, Endurance: 0, Speed: 1, Dexterity: 0, Appeal: 0, Shape: 0, Sense: 0 },
    purchasedPerks: { Height: 1, Flexibility: 0, Endowed: 0, Color: 0, Winged: 0, Metavore: 0, Evercleansed: 0, Genderswap: 0 },
    bestialTier: 1,
    bestialStat: "Speed",
  };
  const statRows = [...bodymod.querySelectorAll("[data-bodymod-stat]")];
  const perkRows = [...bodymod.querySelectorAll("[data-bodymod-perk]")];
  const bodymodTabs = [...bodymod.querySelectorAll(".bodymod-full-tabs [role='tab']")];

  const freeStats = () => {
    const free = { ...(bodyTypes[state.type].stats ?? {}) };
    if (state.type === "Bestial" && state.bestialTier > 0) free[state.bestialStat] = Math.min(4, (free[state.bestialStat] ?? 0) + state.bestialTier);
    return free;
  };
  const freePerks = () => bodyTypes[state.type].perks ?? {};
  const totalStat = (name) => Math.min(4, (freeStats()[name] ?? 0) + state.purchasedStats[name]);
  const totalPerk = (name) => (freePerks()[name] ?? 0) + state.purchasedPerks[name];
  const statCost = () => Object.values(state.purchasedStats).reduce((sum, rank) => sum + rank * 50, 0);
  const perkCost = () => perkRows.reduce((sum, row) => sum + state.purchasedPerks[row.dataset.bodymodPerk] * Number(row.dataset.price), 0);
  const spent = () => bodyTypes[state.type].cost + statCost() + perkCost();

  const activateBodymodTab = (tab, moveFocus = false) => {
    bodymodTabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      bodymod.querySelector(`#${candidate.getAttribute("aria-controls")}`).hidden = !selected;
    });
    if (moveFocus) tab.focus();
  };
  bodymodTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateBodymodTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % bodymodTabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + bodymodTabs.length) % bodymodTabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = bodymodTabs.length - 1;
      else return;
      event.preventDefault();
      activateBodymodTab(bodymodTabs[next], true);
    });
  });

  const replaceChips = (container, values, emptyText) => {
    container.replaceChildren(...(values.length ? values : [emptyText]).map((value) => {
      const chip = document.createElement("span");
      chip.textContent = value;
      return chip;
    }));
  };
  const renderDialogStats = () => {
    const container = bodymodDialog.querySelector("#bodymod-dialog-stats");
    container.replaceChildren(...Object.keys(statDescriptions).map((name) => {
      const rank = totalStat(name);
      const row = document.createElement("div");
      row.className = "bodymod-dialog-stat";
      row.tabIndex = 0;
      const tooltipId = `bodymod-${name.toLocaleLowerCase()}-tooltip`;
      row.setAttribute("aria-describedby", tooltipId);
      const label = document.createElement("span");
      label.textContent = name;
      const bar = document.createElement("span");
      bar.className = "bodymod-dialog-bar";
      const fill = document.createElement("i");
      fill.style.width = `${rank * 25}%`;
      bar.append(fill);
      const value = document.createElement("span");
      value.className = "bodymod-dialog-rank";
      value.textContent = String(rank);
      const tooltip = document.createElement("span");
      tooltip.id = tooltipId;
      tooltip.className = "bodymod-stat-tooltip";
      tooltip.setAttribute("role", "tooltip");
      tooltip.textContent = `Rank ${rank}: ${statDescriptions[name][rank]}`;
      row.append(label, bar, value, tooltip);
      return row;
    }));
  };
  const renderDialogPerks = (selectedPerks) => {
    const container = bodymodDialog.querySelector("#bodymod-dialog-perks");
    const detail = bodymodDialog.querySelector("#bodymod-dialog-perk-detail");
    container.replaceChildren();
    if (!selectedPerks.length) {
      const empty = document.createElement("span");
      empty.textContent = "No Body Mod perks";
      container.append(empty);
      detail.hidden = true;
      return;
    }
    selectedPerks.forEach(({ name, rank }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.bodymodDialogPerk = name;
      button.setAttribute("aria-expanded", "false");
      button.textContent = `${name} ${rank}`;
      button.addEventListener("click", () => {
        const opening = detail.hidden || bodymodDialog.querySelector("#bodymod-dialog-perk-title").dataset.perk !== name;
        container.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-expanded", String(opening && candidate === button)));
        detail.hidden = !opening;
        if (!opening) return;
        const title = bodymodDialog.querySelector("#bodymod-dialog-perk-title");
        title.dataset.perk = name;
        title.textContent = `${name} ${rank}`;
        const descriptions = perkDescriptions[name];
        bodymodDialog.querySelector("#bodymod-dialog-perk-description").textContent = descriptions[Math.min(rank, descriptions.length - 1)];
      });
      container.append(button);
    });
    detail.hidden = true;
  };
  const renderBodymod = () => {
    const type = bodyTypes[state.type];
    const remaining = 600 - spent();
    const budget = bodymod.querySelector("#bodymod-budget-output");
    budget.value = `${remaining} CP`;
    budget.textContent = `${remaining} CP`;
    budget.classList.toggle("is-negative", remaining < 0);
    bodymod.querySelector("#bodymod-summary-type").textContent = state.type === "None" ? "Current body" : state.type;
    bodymod.querySelector("#bodymod-summary-build").textContent = `${state.build} build`;
    bodymod.querySelector(".bodymod-summary-avatar").textContent = type.initials;
    bodymod.querySelector("#bodymod-summary-body-cost").textContent = `${type.cost} CP`;
    bodymod.querySelector("#bodymod-summary-stat-cost").textContent = `${statCost()} CP`;
    bodymod.querySelector("#bodymod-summary-perk-cost").textContent = `${perkCost()} CP`;
    const bestialGrant = state.type === "Bestial" && state.bestialTier > 0 ? ` · ${state.bestialStat} ${state.bestialTier}` : "";
    bodymod.querySelector(".bodymod-free-grants strong").textContent = `Included with ${state.type === "None" ? "current body" : state.type}`;
    bodymod.querySelector("#bodymod-summary-grants").textContent = `${type.included}${bestialGrant}`;
    bodymod.querySelector("#bodymod-bestial-options").hidden = state.type !== "Bestial";

    statRows.forEach((row) => {
      const name = row.dataset.bodymodStat;
      const rank = totalStat(name);
      row.querySelector("output").value = String(rank);
      row.querySelector("output").textContent = String(rank);
      row.querySelector("[data-rank-description]").textContent = statDescriptions[name][rank];
      row.querySelector("[data-rank-delta='-1']").disabled = state.purchasedStats[name] <= 0;
      row.querySelector("[data-rank-delta='1']").disabled = rank >= 4;
    });
    perkRows.forEach((row) => {
      const name = row.dataset.bodymodPerk;
      const total = totalPerk(name);
      row.querySelector("output").value = String(total);
      row.querySelector("output").textContent = String(total);
      row.querySelector("[data-perk-delta='-1']").disabled = state.purchasedPerks[name] <= 0;
      row.querySelector("[data-perk-delta='1']").disabled = total >= Number(row.dataset.max);
    });

    bodymod.querySelector("#bodymod-review-build").textContent = state.build;
    bodymod.querySelector("#bodymod-review-type").textContent = state.type === "None" ? "Current body" : state.type;
    bodymod.querySelector("#bodymod-review-spent").textContent = `${spent()} CP`;
    const selectedStats = Object.keys(statDescriptions).filter((name) => totalStat(name) > 0).map((name) => `${name} ${totalStat(name)}`);
    const selectedPerkValues = perkRows.map((row) => row.dataset.bodymodPerk).filter((name) => totalPerk(name) > 0).map((name) => ({ name, rank: totalPerk(name) }));
    const selectedPerks = selectedPerkValues.map(({ name, rank }) => `${name} ${rank}`);
    replaceChips(bodymod.querySelector("#bodymod-review-stats"), selectedStats, "No ranked stats");
    replaceChips(bodymod.querySelector("#bodymod-review-perks"), selectedPerks, "No perks");
    const diagnostic = bodymod.querySelector("#bodymod-review-diagnostic");
    diagnostic.classList.toggle("is-negative", remaining < 0);
    diagnostic.textContent = remaining < 0 ? `Build is ${Math.abs(remaining)} CP over budget.` : `Build is valid with ${remaining} CP remaining.`;

    const animal = bodymod.querySelector("#bodymod-animal").value.trim() || "Animal";
    const bestialPresentations = [`${animal}-trait body`, `${animal} Demi-Human`, `${animal} Anthro`];
    const presentation = state.type === "Bestial" ? bestialPresentations[state.bestialTier]
      : state.type === "None" ? "Current body"
        : `${state.type} baseline`;
    bodymodDialog.querySelector("#bodymod-dialog-avatar").textContent = state.type === "Bestial" ? animal.slice(0, 1).toLocaleUpperCase() + "D" : type.initials;
    bodymodDialog.querySelector("#bodymod-dialog-type").textContent = presentation;
    bodymodDialog.querySelector("#bodymod-dialog-build").textContent = `${state.build} build`;
    bodymodDialog.querySelector("#bodymod-dialog-species").textContent = state.type === "Bestial" ? presentation : "Human";
    bodymodDialog.querySelector("#bodymod-dialog-presentation").textContent = presentation;
    const dialogBudget = bodymodDialog.querySelector("#bodymod-dialog-budget");
    dialogBudget.textContent = remaining < 0 ? `${Math.abs(remaining)} CP over` : `${remaining} CP unspent`;
    dialogBudget.classList.toggle("is-negative", remaining < 0);
    renderDialogStats();
    renderDialogPerks(selectedPerkValues);
  };

  bodymod.querySelectorAll("[data-bodymod-build]").forEach((button) => button.addEventListener("click", () => {
    state.build = button.dataset.bodymodBuild;
    bodymod.querySelectorAll("[data-bodymod-build]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    renderBodymod();
  }));
  const preserveTotalsAcrossGrantChange = (changeGrantSource) => {
    const previousStats = Object.fromEntries(Object.keys(state.purchasedStats).map((name) => [name, totalStat(name)]));
    const previousPerks = Object.fromEntries(Object.keys(state.purchasedPerks).map((name) => [name, totalPerk(name)]));
    changeGrantSource();
    const nextFreeStats = freeStats();
    const nextFreePerks = freePerks();
    Object.keys(state.purchasedStats).forEach((name) => { state.purchasedStats[name] = Math.max(0, previousStats[name] - (nextFreeStats[name] ?? 0)); });
    Object.keys(state.purchasedPerks).forEach((name) => { state.purchasedPerks[name] = Math.max(0, previousPerks[name] - (nextFreePerks[name] ?? 0)); });
  };
  bodymod.querySelectorAll("[data-bodymod-type]").forEach((button) => button.addEventListener("click", () => {
    preserveTotalsAcrossGrantChange(() => { state.type = button.dataset.bodymodType; });
    bodymod.querySelectorAll("[data-bodymod-type]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    renderBodymod();
  }));
  statRows.forEach((row) => row.querySelectorAll("[data-rank-delta]").forEach((button) => button.addEventListener("click", () => {
    const name = row.dataset.bodymodStat;
    const delta = Number(button.dataset.rankDelta);
    state.purchasedStats[name] = Math.max(0, state.purchasedStats[name] + delta);
    renderBodymod();
  })));
  perkRows.forEach((row) => row.querySelectorAll("[data-perk-delta]").forEach((button) => button.addEventListener("click", () => {
    const name = row.dataset.bodymodPerk;
    const delta = Number(button.dataset.perkDelta);
    state.purchasedPerks[name] = Math.max(0, state.purchasedPerks[name] + delta);
    renderBodymod();
  })));
  bodymod.querySelector("#bodymod-bestial-tier").addEventListener("change", (event) => { preserveTotalsAcrossGrantChange(() => { state.bestialTier = Number(event.currentTarget.value); }); renderBodymod(); });
  bodymod.querySelector("#bodymod-bestial-stat").addEventListener("change", (event) => { preserveTotalsAcrossGrantChange(() => { state.bestialStat = event.currentTarget.value; }); renderBodymod(); });
  bodymod.querySelector("#bodymod-animal").addEventListener("input", renderBodymod);
  bodymodDialog.querySelector("aside button").addEventListener("click", () => bodymod.scrollIntoView({ behavior: "smooth", block: "start" }));
  renderBodymod();

  const warehouse = document.querySelector(".warehouse-full-mock");
  const warehouseDialog = document.querySelector(".warehouse-dialog-mock");
  if (!warehouse || !warehouseDialog) return;
  const warehouseTabs = [...warehouse.querySelectorAll(".warehouse-full-tabs [role='tab']")];
  const warehouseOptions = [...warehouse.querySelectorAll("button[data-warehouse-option]")];
  const stasisOption = warehouse.querySelector(".warehouse-quantity-option");
  const warehouseOptionDescriptions = Object.fromEntries([
    ...warehouseOptions.map((button) => [button.dataset.warehouseOption, button.querySelector("p").textContent]),
    ["Stasis Pod", stasisOption.querySelector("p").textContent],
  ]);
  const warehouseState = {
    selected: new Set(["Electricity", "Plumbing", "Heat / A.C.", "Shelving", "Terminal", "Workshop", "Portal", "Food Supply", "Loft"]),
    stasisPods: 0,
  };
  const activateWarehouseTab = (tab, moveFocus = false) => {
    warehouseTabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      warehouse.querySelector(`#${candidate.getAttribute("aria-controls")}`).hidden = !selected;
    });
    if (moveFocus) tab.focus();
  };
  warehouseTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateWarehouseTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % warehouseTabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + warehouseTabs.length) % warehouseTabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = warehouseTabs.length - 1;
      else return;
      event.preventDefault();
      activateWarehouseTab(warehouseTabs[next], true);
    });
  });
  const warehouseOptionData = () => warehouseOptions.map((button) => ({
    name: button.dataset.warehouseOption,
    category: button.dataset.category,
    cost: Number(button.dataset.cost),
    selected: warehouseState.selected.has(button.dataset.warehouseOption),
  }));
  const warehouseSpent = () => warehouseOptionData().filter((option) => option.selected).reduce((sum, option) => sum + option.cost, 0) + warehouseState.stasisPods * Number(stasisOption.dataset.cost);
  const warehouseSelectedLabels = () => [
    ...warehouseOptionData().filter((option) => option.selected).map((option) => option.name),
    ...(warehouseState.stasisPods ? [`Stasis Pod ×${warehouseState.stasisPods}`] : []),
  ];
  const replaceWarehouseChips = (container, labels) => {
    container.replaceChildren(...labels.map((label) => {
      const chip = document.createElement("span");
      chip.textContent = label;
      return chip;
    }));
  };
  const renderWarehouseDialogOptions = (labels) => {
    const container = warehouseDialog.querySelector("#warehouse-dialog-options");
    const detail = warehouseDialog.querySelector("#warehouse-dialog-option-detail");
    container.replaceChildren(...labels.map((label) => {
      const name = label.replace(/ ×\d+$/, "");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      button.textContent = label;
      button.addEventListener("click", () => {
        const title = warehouseDialog.querySelector("#warehouse-dialog-option-title");
        const opening = detail.hidden || title.dataset.option !== name;
        container.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-expanded", String(opening && candidate === button)));
        detail.hidden = !opening;
        if (!opening) return;
        title.dataset.option = name;
        title.textContent = label;
        warehouseDialog.querySelector("#warehouse-dialog-option-description").textContent = warehouseOptionDescriptions[name];
      });
      return button;
    }));
    detail.hidden = true;
  };
  const renderWarehouseFloorplan = (size, structures) => {
    const floorplan = warehouseDialog.querySelector("#warehouse-floorplan");
    const main = document.createElement("div");
    main.className = "is-main";
    main.tabIndex = 0;
    const mainName = document.createElement("strong");
    mainName.textContent = "Main storage";
    const mainSize = document.createElement("span");
    mainSize.textContent = `${size.toLocaleString()} ft² total`;
    const mainTooltip = document.createElement("span");
    mainTooltip.id = "warehouse-main-storage-tooltip";
    mainTooltip.className = "warehouse-floor-tooltip";
    mainTooltip.setAttribute("role", "tooltip");
    mainTooltip.textContent = "The Warehouse’s general-purpose storage floor.";
    main.setAttribute("aria-describedby", mainTooltip.id);
    main.append(mainName, mainSize, mainTooltip);
    const structureCells = structures.map((name) => {
      const cell = document.createElement("div");
      cell.tabIndex = 0;
      const heading = document.createElement("strong");
      heading.textContent = name;
      const detail = document.createElement("span");
      detail.textContent = name === "Shelving" ? "Storage" : name === "Terminal" ? "Catalog" : name === "Workshop" ? "Tools" : "Facility";
      const tooltip = document.createElement("span");
      tooltip.id = `warehouse-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}-tooltip`;
      tooltip.className = "warehouse-floor-tooltip";
      tooltip.setAttribute("role", "tooltip");
      tooltip.textContent = warehouseOptionDescriptions[name];
      cell.setAttribute("aria-describedby", tooltip.id);
      cell.append(heading, detail, tooltip);
      return cell;
    });
    floorplan.replaceChildren(main, ...structureCells);
  };
  const renderWarehouse = () => {
    const spent = warehouseSpent();
    const remaining = 150 - spent;
    const size = warehouseState.selected.has("Free Space") ? 80000 : 40000;
    const access = warehouseState.selected.has("Portal") ? "Portal" : "Key and locked door";
    const data = warehouseOptionData();
    const labels = warehouseSelectedLabels();
    const utilities = data.filter((option) => option.category === "utility" && option.selected);
    const structures = data.filter((option) => option.category === "structure" && option.selected);
    const misc = data.filter((option) => option.category === "misc" && option.selected);
    const budget = warehouse.querySelector("#warehouse-budget-output");
    budget.value = `${remaining} WP`;
    budget.textContent = `${remaining} WP`;
    budget.classList.toggle("is-negative", remaining < 0);
    warehouse.querySelector("#warehouse-summary-size").textContent = `${size.toLocaleString()} ft²`;
    warehouse.querySelector("#warehouse-summary-access").textContent = `${access} access`;
    warehouse.querySelector("#warehouse-summary-utilities").textContent = String(utilities.length);
    warehouse.querySelector("#warehouse-summary-structures").textContent = String(structures.length);
    warehouse.querySelector("#warehouse-summary-misc").textContent = String(misc.length + (warehouseState.stasisPods ? 1 : 0));
    warehouse.querySelector("#warehouse-summary-entry").textContent = warehouseState.selected.has("Portal") ? "Portal on a suitable surface" : "Special key used in a locked door";
    warehouseOptions.forEach((button) => {
      const selected = warehouseState.selected.has(button.dataset.warehouseOption);
      button.setAttribute("aria-pressed", String(selected));
      if (button.dataset.requires) button.disabled = !warehouseState.selected.has(button.dataset.requires);
    });
    stasisOption.querySelector("output").value = String(warehouseState.stasisPods);
    stasisOption.querySelector("output").textContent = String(warehouseState.stasisPods);
    stasisOption.querySelector("[data-warehouse-quantity='-1']").disabled = warehouseState.stasisPods === 0;
    stasisOption.querySelector("[data-warehouse-quantity='1']").disabled = warehouseState.stasisPods >= Number(stasisOption.dataset.max);
    warehouse.querySelector("#warehouse-review-size").textContent = `${size.toLocaleString()} ft²`;
    warehouse.querySelector("#warehouse-review-access").textContent = warehouseState.selected.has("Portal") ? "Portal" : "Key and door";
    warehouse.querySelector("#warehouse-review-spent").textContent = `${spent} WP`;
    replaceWarehouseChips(warehouse.querySelector("#warehouse-review-options"), labels);
    const diagnostic = warehouse.querySelector("#warehouse-review-diagnostic");
    diagnostic.classList.toggle("is-negative", remaining < 0);
    diagnostic.textContent = remaining < 0 ? `Configuration is ${Math.abs(remaining)} WP over budget.` : `Configuration is valid with ${remaining} WP remaining.`;

    warehouseDialog.querySelector("#warehouse-dialog-size").textContent = size.toLocaleString();
    warehouseDialog.querySelector("#warehouse-dialog-access").textContent = warehouseState.selected.has("Portal") ? "Portal" : "Key and door";
    const dialogBudget = warehouseDialog.querySelector("#warehouse-dialog-budget");
    dialogBudget.textContent = remaining < 0 ? `${Math.abs(remaining)} over` : String(remaining);
    dialogBudget.classList.toggle("is-negative", remaining < 0);
    warehouseDialog.querySelector("#warehouse-dialog-feature-count").textContent = `${labels.length} ${labels.length === 1 ? "feature" : "features"}`;
    renderWarehouseFloorplan(size, structures.map((option) => option.name));
    renderWarehouseDialogOptions(labels);
    warehouseDialog.querySelector(".warehouse-dialog-note").textContent = warehouseState.selected.has("Portal")
      ? "The gateway uses Portal instead of the default key-and-door method. Utilities and facilities exist only inside the Warehouse unless their own description says otherwise."
      : "The Warehouse opens when its special key is used in a locked door. Utilities and facilities exist only inside the Warehouse unless their own description says otherwise.";
  };
  warehouseOptions.forEach((button) => button.addEventListener("click", () => {
    const name = button.dataset.warehouseOption;
    if (warehouseState.selected.has(name)) warehouseState.selected.delete(name);
    else warehouseState.selected.add(name);
    if (name === "Portal" && !warehouseState.selected.has("Portal")) warehouseState.selected.delete("Link");
    renderWarehouse();
  }));
  stasisOption.querySelectorAll("[data-warehouse-quantity]").forEach((button) => button.addEventListener("click", () => {
    warehouseState.stasisPods = Math.max(0, Math.min(Number(stasisOption.dataset.max), warehouseState.stasisPods + Number(button.dataset.warehouseQuantity)));
    renderWarehouse();
  }));
  warehouseDialog.querySelector("aside button").addEventListener("click", () => warehouse.scrollIntoView({ behavior: "smooth", block: "start" }));
  renderWarehouse();
})();

(() => {
  const quest = document.querySelector(".quest-full-mock");
  const dialog = document.querySelector(".quest-dialog-mock");
  if (!quest || !dialog) return;

  const tabs = [...quest.querySelectorAll(".quest-full-tabs [role='tab']")];
  const ruleButtons = [...quest.querySelectorAll("[data-quest-rule]")];
  const filters = [...dialog.querySelectorAll("[data-quest-filter]")];
  const state = {
    rules: new Set(ruleButtons.filter((button) => button.getAttribute("aria-pressed") === "true").map((button) => button.dataset.questRule)),
    filter: "all",
    customNumber: 0,
  };

  const activateTab = (tab, moveFocus = false) => {
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      quest.querySelector(`#${candidate.getAttribute("aria-controls")}`).hidden = !selected;
    });
    if (moveFocus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[next], true);
    });
  });

  const allRows = () => [...dialog.querySelectorAll("[data-quest-row]")];
  const renderQuest = () => {
    ruleButtons.forEach((button) => {
      const enabled = state.rules.has(button.dataset.questRule);
      button.setAttribute("aria-pressed", String(enabled));
      button.querySelector("small").textContent = enabled ? "Enabled" : "Disabled";
    });
    quest.querySelector("#quest-summary-rules").textContent = `${state.rules.size} optional ${state.rules.size === 1 ? "rule" : "rules"}`;
    dialog.querySelectorAll("[data-quest-rule-status]").forEach((status) => {
      const enabled = state.rules.has(status.dataset.questRuleStatus);
      status.classList.toggle("is-disabled", !enabled);
      status.querySelector("b").textContent = enabled ? "On" : "Off";
    });

    dialog.querySelector("#quest-drawback-section").hidden = !state.rules.has("drawback");
    dialog.querySelector("#quest-custom-section").hidden = !state.rules.has("custom");
    filters.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.questFilter === state.filter)));
    allRows().forEach((row) => {
      row.hidden = state.filter !== "all" && row.dataset.tier !== state.filter;
    });

    const activeRows = allRows().filter((row) => {
      if (row.closest("#quest-drawback-section") && !state.rules.has("drawback")) return false;
      if (row.closest("#quest-custom-section") && !state.rules.has("custom")) return false;
      return true;
    });
    const checked = activeRows.filter((row) => row.querySelector("input[type='checkbox']").checked);
    const questEarned = checked.filter((row) => row.dataset.kind !== "drawback").reduce((sum, row) => sum + Number(row.querySelector("input").dataset.award), 0);
    const selectedDrawbacks = allRows().filter((row) => row.dataset.kind === "drawback");
    const drawbackEarned = state.rules.has("drawback")
      ? checked.filter((row) => row.dataset.kind === "drawback").reduce((sum, row) => sum + Number(row.querySelector("input").dataset.award), 0)
      : selectedDrawbacks.reduce((sum, row) => sum + Number(row.querySelector("input").dataset.award), 0);
    dialog.querySelector("#quest-dialog-earned").textContent = String(questEarned);
    dialog.querySelector("#quest-dialog-drawbacks").textContent = String(drawbackEarned);
    dialog.querySelector("#quest-dialog-total").textContent = `${drawbackEarned + questEarned} CP`;
    dialog.querySelector("#quest-dialog-count").textContent = String(checked.length);
  };

  ruleButtons.forEach((button) => button.addEventListener("click", () => {
    const rule = button.dataset.questRule;
    if (state.rules.has(rule)) state.rules.delete(rule);
    else state.rules.add(rule);
    renderQuest();
  }));

  filters.forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.questFilter;
    renderQuest();
  }));

  dialog.querySelector("#quest-checklist").addEventListener("change", (event) => {
    if (event.target.matches("input[type='checkbox']")) renderQuest();
  });

  dialog.querySelector("#quest-custom-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.rules.has("custom")) return;
    const nameInput = dialog.querySelector("#quest-custom-name");
    const name = nameInput.value.trim();
    if (!name) return;
    const award = dialog.querySelector("#quest-custom-award").value;
    state.customNumber += 1;
    const row = document.createElement("label");
    row.dataset.questRow = "";
    row.dataset.tier = award;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.questId = `custom-${state.customNumber}`;
    checkbox.dataset.award = award;
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = name;
    const description = document.createElement("small");
    description.textContent = "Custom objective for this Jump.";
    copy.append(title, description);
    const value = document.createElement("b");
    value.textContent = `${award} CP`;
    row.append(checkbox, copy, value);
    dialog.querySelector("#quest-custom-list").append(row);
    nameInput.value = "";
    renderQuest();
  });

  dialog.querySelector("aside button").addEventListener("click", () => quest.scrollIntoView({ behavior: "smooth", block: "start" }));
  renderQuest();
})();
