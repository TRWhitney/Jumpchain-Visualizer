(() => {
  const mockup = document.querySelector(".chain-mockup");
  if (!mockup) return;

  const jumpCatalog = {
    earth: {
      name: "Earth",
      logicalId: "system-earth",
      version: "Application",
      source: "system",
      description: "The chain's system-owned starting identity entry.",
      status: "The Beginning",
      foundation: true,
    },
    "first-step": {
      name: "First Step",
      logicalId: "first-step",
      version: "1.0",
      source: "builtin",
      description: "A flexible beginning for a new chain.",
      status: "4 choices",
    },
    "arcane-realms": {
      name: "Arcane Realms",
      logicalId: "arcane-realms",
      version: "1.0",
      source: "imported",
      description: "Build a life in a world of spellcraft and ancient kingdoms.",
      status: "2 choices",
      companionImports: { ash: { resource: "jump_points", amount: 600 } },
    },
    "arcane-realms-v1-1": {
      name: "Arcane Realms",
      logicalId: "arcane-realms",
      version: "1.1",
      source: "imported",
      description: "A separately installed revision with adjusted spellcraft choices.",
      status: "Available",
      companionImports: { ash: { resource: "jump_points", amount: 600 } },
    },
    "cosmic-odyssey": {
      name: "Cosmic Odyssey",
      logicalId: "cosmic-odyssey",
      version: "2.3",
      source: "imported",
      description: "Explore distant systems, strange civilizations, and stellar mysteries.",
      status: "No choices",
      companionImports: { mira: { resource: "jump_points", amount: 800 } },
    },
    "hero-academy": {
      name: "Hero Academy",
      logicalId: "hero-academy",
      version: "1.0",
      source: "builtin",
      description: "Train alongside a new generation of heroes.",
      status: "Available",
    },
    "ocean-depths": {
      name: "Ocean Depths",
      logicalId: "ocean-depths",
      version: "1.4",
      source: "imported",
      description: "Descend into unexplored seas and submerged civilizations.",
      status: "Available",
    },
    "builder-world": {
      name: "Builder World",
      logicalId: "builder-world",
      version: "1.0",
      source: "builtin",
      description: "Create settlements, tools, and infrastructure from the ground up.",
      status: "Available",
    },
  };

  let chainOrder = ["earth", "first-step", "arcane-realms", "cosmic-odyssey"];
  let selectedJump = "arcane-realms";
  let inspectionPoint = selectedJump;
  let librarySource = "all";
  let draggedJump = null;
  let currentActor = "jumper";
  let inventoryKind = "all";
  let inventoryTag = "all";
  const allowMultiplePackageVersions = true;
  const allowNegativePointBalances = mockup.dataset.allowNegativeBalances === "true";
  const choiceState = new Map();
  const identityState = new Map([
    ["earth:jumper", { gender: "", age: null }],
  ]);
  const identityFixture = {
    earth: { origin: "Human", location: "Earth" },
    "first-step": { origin: "Wanderer", location: "Crossroads", continuity: "previous", genders: ["Male", "Female"] },
    "arcane-realms": { species: "Elf", continuity: "original", genders: ["Male", "Female"] },
    "cosmic-odyssey": { origin: "Spacer", location: "Starlight Anchorage", continuity: "previous", genders: ["Andorian", "Nonbinary"] },
  };
  const questState = new Map();
  const storyState = new Map([
    ["first-step", { title: "A Door Opens", blocks: ["Morgan stepped beyond the familiar world with one pack and no promise of a return.", ""] }],
    ["arcane-realms", {
      title: "The Violet Gates",
      blocks: [
        "**The gates of Highcourt** opened beneath a violet sky.",
        "I followed **Mira** through the market, where *every promise* seemed to carry a price.",
      ],
    }],
    ["cosmic-odyssey", { title: "", blocks: ["", ""] }],
  ]);
  const actorCatalog = {
    jumper: { name: "Morgan", role: "Jumper", gender: "Female", age: "24" },
    ash: { name: "Ash", role: "Companion", gender: "Male", age: "27", joinedIn: "first-step" },
    mira: { name: "Mira", role: "Companion", gender: "Female", age: "31", joinedIn: "arcane-realms" },
    io: { name: "Io", role: "Companion", gender: "Nonbinary", age: "29", joinedIn: "cosmic-odyssey" },
  };

  const railTabs = [...mockup.querySelectorAll(".chain-rail-tabs [role='tab']")];
  const mainTabs = [...mockup.querySelectorAll(".chain-main-tabs [role='tab']")];
  const jumpList = mockup.querySelector("#chain-jump-list");
  const jumpCount = mockup.querySelector("#chain-jump-count");
  const openLibrary = mockup.querySelector("#chain-open-library");
  const librarySearch = mockup.querySelector("#chain-library-search");
  const libraryList = mockup.querySelector("#chain-library-list");
  const libraryEmpty = mockup.querySelector("#chain-library-empty");
  const librarySourceButtons = [...mockup.querySelectorAll("[data-library-source]")];
  const currentPosition = mockup.querySelector("#chain-current-position");
  const currentTitle = mockup.querySelector("#chain-current-title");
  const currentSource = mockup.querySelector("#chain-current-source");
  const pointSelects = [...mockup.querySelectorAll("[data-chain-point-select]")];
  const renderKicker = mockup.querySelector("#tracker-render-kicker");
  const renderTitle = mockup.querySelector("#tracker-render-title");
  const renderDescription = mockup.querySelector("#tracker-render-description");
  const earthRenderer = mockup.querySelector("#tracker-earth-renderer");
  const jumpRenderer = mockup.querySelector("#tracker-jump-renderer");
  const earthGender = mockup.querySelector("#tracker-earth-gender");
  const earthAge = mockup.querySelector("#tracker-earth-age");
  const genderChoice = mockup.querySelector("#tracker-gender-choice");
  const ageChoice = mockup.querySelector("#tracker-age-choice");
  const continuityNote = mockup.querySelector("#tracker-continuity-note");
  const budgetOutput = mockup.querySelector("#tracker-budget-output");
  const actorSelect = mockup.querySelector("#chain-actor-select");
  const summaryCurrency = mockup.querySelector("#chain-summary-currency");
  const summaryOrigin = mockup.querySelector("#chain-summary-origin");
  const currencyTooltip = mockup.querySelector("#chain-currency-tooltip");
  const originTooltip = mockup.querySelector("#chain-origin-tooltip");
  const summaryGender = mockup.querySelector("#chain-summary-gender");
  const summaryAge = mockup.querySelector("#chain-summary-age");
  const trackerChoices = [...mockup.querySelectorAll(".tracker-choice")];
  const rollOrigin = mockup.querySelector("#tracker-roll-origin");
  const rollResult = mockup.querySelector("#tracker-roll-result");
  const originDetails = {
    wanderer: { description: "You arrive without local ties." },
    noble: { description: "You begin with status and obligations." },
    scholar: { description: "You trained among learned institutions." },
  };
  const locationDetails = {
    highcourt: "Highcourt, the royal capital",
    collegium: "The Collegium district",
  };
  const alternativeCurrencies = {
    jumper: ["50 MP · Mana", "3 Renown", "2 Destiny Tokens"],
    ash: ["20 MP · Mana", "1 Renown"],
    mira: ["75 MP · Mana", "4 Research Marks"],
    io: ["6 System Tokens"],
  };

  const sourceLabel = (source) => source === "builtin" ? "Built-in" : source === "system" ? "Application" : "Imported";
  const jumpIds = () => chainOrder.filter((id) => id !== "earth");
  const jumpNumber = (id) => jumpIds().indexOf(id) + 1;
  const replaceTooltipContent = (tooltip, headingText, lines) => {
    const heading = document.createElement("strong");
    heading.textContent = headingText;
    tooltip.replaceChildren(heading, ...lines.map((line) => {
      const detail = document.createElement("span");
      detail.textContent = line;
      return detail;
    }));
  };

  const activateTab = (tabs, nextTab, moveFocus = false) => {
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = mockup.querySelector(`#${tab.getAttribute("aria-controls")}`);
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) nextTab.focus();
  };

  const wireTabs = (tabs) => tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tabs, tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % tabs.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs, tabs[nextIndex], true);
    });
  });

  wireTabs(railTabs);
  wireTabs(mainTabs);

  const identityKey = (jumpId, actorId = currentActor) => `${jumpId}:${actorId}`;
  const identityFor = (jumpId, actorId = currentActor) => {
    const key = identityKey(jumpId, actorId);
    if (!identityState.has(key)) identityState.set(key, { gender: "", age: null });
    return identityState.get(key);
  };
  const originalIdentity = (actorId) => actorId === "jumper"
    ? identityFor("earth", actorId)
    : { gender: actorCatalog[actorId]?.gender ?? "", age: Number(actorCatalog[actorId]?.age) || null };
  const effectiveIdentity = (jumpId, actorId = currentActor) => {
    const index = chainOrder.indexOf(jumpId);
    const explicit = identityFor(jumpId, actorId);
    if (jumpId === "earth") return actorId === "jumper" ? explicit : originalIdentity(actorId);
    const previousId = chainOrder[index - 1];
    const previous = previousId ? effectiveIdentity(previousId, actorId) : originalIdentity(actorId);
    const fixture = identityFixture[jumpId] ?? {};
    const baseline = fixture.continuity === "original" ? originalIdentity(actorId) : previous;
    const referencedGender = baseline.gender || "";
    const genderAvailable = fixture.genders?.includes(referencedGender);
    return {
      gender: explicit.gender || (genderAvailable ? referencedGender : ""),
      age: explicit.age ?? previous.age ?? null,
    };
  };
  const identityChoiceCost = (jumpId, actorId = currentActor) => {
    const explicit = identityFor(jumpId, actorId).gender;
    if (!explicit || jumpId === "earth") return 0;
    const fixture = identityFixture[jumpId] ?? {};
    const previousId = chainOrder[chainOrder.indexOf(jumpId) - 1];
    const baseline = fixture.continuity === "original"
      ? originalIdentity(actorId)
      : (previousId ? effectiveIdentity(previousId, actorId) : originalIdentity(actorId));
    if (!baseline.gender || !fixture.genders?.includes(baseline.gender)) return 0;
    return explicit === baseline.gender ? 0 : 100;
  };

  const renderPointSelect = () => {
    if (!chainOrder.includes(inspectionPoint)) inspectionPoint = selectedJump;
    pointSelects.forEach((select) => {
      select.replaceChildren();
      [...chainOrder].reverse().forEach((id) => {
        const jump = jumpCatalog[id];
        const version = id !== "earth" && allowMultiplePackageVersions ? ` · v${jump.version}` : "";
        const label = id === "earth" ? "Earth · Chain beginning" : `${jumpNumber(id)}. ${jump.name}${version}`;
        select.add(new Option(label, id));
      });
      select.value = inspectionPoint;
    });
  };

  const selectedChoices = () => {
    const key = `${selectedJump}:${currentActor}`;
    if (!choiceState.has(key)) choiceState.set(key, new Set());
    return choiceState.get(key);
  };

  const choicesFor = (jumpId, actorId) => choiceState.get(`${jumpId}:${actorId}`) ?? new Set();
  const startingBudgetFor = (jumpId, actorId) => jumpId === "earth" ? 0 : actorId === "jumper"
    ? 1000
    : (jumpCatalog[jumpId]?.companionImports?.[actorId]?.amount ?? 0);
  const spentFor = (selected) => trackerChoices.reduce((total, choice) => (
    total + (selected.has(choice.dataset.choiceKey) ? Number(choice.dataset.choiceCost || 0) : 0)
  ), 0);
  const remainingFor = (jumpId, actorId, selected = choicesFor(jumpId, actorId)) => (
    startingBudgetFor(jumpId, actorId) - spentFor(selected) - identityChoiceCost(jumpId, actorId)
  );
  const mayUseNegativeBalance = (jumpId, actorId) => actorId === "jumper"
    || startingBudgetFor(jumpId, actorId) > 0;
  const actorsForJump = (jumpId) => ["jumper", ...Object.keys(jumpCatalog[jumpId]?.companionImports ?? {})];
  const jumpHasNegativeBalance = (jumpId) => actorsForJump(jumpId).some((actorId) => (
    remainingFor(jumpId, actorId) < 0
  ));

  const syncBalanceIndicators = () => {
    const negativeActors = actorsForJump(selectedJump).filter((actorId) => remainingFor(selectedJump, actorId) < 0);
    budgetOutput.classList.toggle("is-negative", remainingFor(selectedJump, currentActor) < 0);
    summaryCurrency.classList.toggle("is-negative", remainingFor(selectedJump, currentActor) < 0);
    actorSelect.classList.toggle("has-negative-actor", currentActor !== "jumper" && remainingFor(selectedJump, currentActor) < 0);
    [...actorSelect.options].forEach((option) => {
      const actorId = option.value;
      const remaining = remainingFor(selectedJump, actorId);
      const negative = actorId !== "jumper" && remaining < 0;
      option.classList.toggle("is-negative", negative);
      option.textContent = `${negative ? "⚠ " : ""}${actorCatalog[actorId].name} · ${actorCatalog[actorId].role}${negative ? ` · ${remaining} CP` : ""}`;
    });
    const negativeStatus = mockup.querySelector("#chain-negative-status");
    negativeStatus.hidden = negativeActors.length === 0;
    negativeStatus.textContent = negativeActors.length === 1
      ? `⚠ ${actorCatalog[negativeActors[0]].name} has a negative point balance`
      : `⚠ ${negativeActors.length} actors have negative point balances`;
    mockup.querySelectorAll("[data-chain-jump]").forEach((entry) => {
      const jumpId = entry.dataset.chainJump;
      const negative = jumpHasNegativeBalance(jumpId);
      entry.classList.toggle("has-negative-balance", negative);
      const status = entry.querySelector(".chain-jump-select small");
      if (status) status.textContent = `${sourceLabel(jumpCatalog[jumpId].source)} · ${jumpCatalog[jumpId].status}${negative ? " · Negative balance" : ""}`;
    });
  };

  const selectionWouldBeBlocked = (nextSelected) => {
    const currentRemaining = remainingFor(selectedJump, currentActor);
    const nextRemaining = remainingFor(selectedJump, currentActor, nextSelected);
    const negativeAllowed = allowNegativePointBalances && mayUseNegativeBalance(selectedJump, currentActor);
    return !negativeAllowed && nextRemaining < 0 && nextRemaining < currentRemaining;
  };

  const syncActorOptions = () => {
    const jumpPosition = chainOrder.indexOf(selectedJump);
    const imports = jumpCatalog[selectedJump]?.companionImports ?? {};
    const eligibleCompanions = Object.keys(imports).filter((actorId) => {
      const joinedPosition = chainOrder.indexOf(actorCatalog[actorId]?.joinedIn);
      return joinedPosition >= 0 && joinedPosition < jumpPosition;
    });
    const availableActors = ["jumper", ...eligibleCompanions];
    if (!availableActors.includes(currentActor)) currentActor = "jumper";
    actorSelect.replaceChildren(...availableActors.map((actorId) => {
      const actor = actorCatalog[actorId];
      return new Option(`${actor.name} · ${actor.role}`, actorId);
    }));
    actorSelect.value = currentActor;
  };

  const syncIdentityControls = () => {
    const isEarth = selectedJump === "earth";
    earthRenderer.hidden = !isEarth;
    jumpRenderer.hidden = isEarth;
    if (isEarth) {
      const identity = identityFor("earth");
      earthGender.value = identity.gender;
      earthAge.value = identity.age ?? "";
      return;
    }
    const fixture = identityFixture[selectedJump] ?? {};
    const explicit = identityFor(selectedJump);
    const previousId = chainOrder[chainOrder.indexOf(selectedJump) - 1];
    const baseline = fixture.continuity === "original"
      ? originalIdentity(currentActor)
      : (previousId ? effectiveIdentity(previousId) : originalIdentity(currentActor));
    const referencedGender = baseline.gender || "";
    const optionExists = Boolean(referencedGender && fixture.genders?.includes(referencedGender));
    const everyOptionFree = !referencedGender || !optionExists;
    genderChoice.replaceChildren(new Option("Not set", ""), ...(fixture.genders ?? []).map((gender) => {
      const cost = everyOptionFree || gender === referencedGender ? "Free" : "100 CP";
      return new Option(`${gender} · ${cost}`, gender);
    }));
    genderChoice.value = explicit.gender || (optionExists ? referencedGender : "");
    ageChoice.value = explicit.age ?? effectiveIdentity(selectedJump).age ?? "";
    const continuityLabel = fixture.continuity === "original" ? "original Earth identity" : "previous effective identity";
    continuityNote.textContent = everyOptionFree
      ? `The ${continuityLabel} is unset or absent from this dropdown, so the control remains unset and every authored option is free.`
      : `${referencedGender} matches the ${continuityLabel} and is free. Other authored options retain their 100 CP cost.`;
  };

  const syncChoices = () => {
    const selected = selectedChoices();
    trackerChoices.forEach((choice) => {
      const active = selected.has(choice.dataset.choiceKey);
      choice.setAttribute("aria-pressed", String(active));
    });
    const remaining = remainingFor(selectedJump, currentActor, selected);
    budgetOutput.value = `${remaining} CP`;
    budgetOutput.textContent = `${remaining} CP`;
    summaryCurrency.textContent = `${remaining} CP`;
    const origin = ["wanderer", "noble", "scholar"].find((key) => selected.has(key));
    const location = ["highcourt", "collegium"].find((key) => selected.has(key));
    const fixture = identityFixture[selectedJump] ?? {};
    const resolvedOrigin = origin ? origin[0].toLocaleUpperCase() + origin.slice(1) : fixture.origin;
    const resolvedLocation = location ? locationDetails[location] : fixture.location;
    const resolvedSpecies = fixture.species ?? "Human";
    const effective = effectiveIdentity(selectedJump);
    summaryOrigin.textContent = resolvedOrigin || "Unknown";
    replaceTooltipContent(currencyTooltip, "Alternative currencies remaining", alternativeCurrencies[currentActor] ?? ["No alternative currencies remain."]);
    if (origin) {
      const detail = originDetails[origin];
      replaceTooltipContent(originTooltip, summaryOrigin.textContent, [detail.description, `Species: ${resolvedSpecies}`, `Location: ${resolvedLocation || "Unknown"}`]);
    } else {
      replaceTooltipContent(originTooltip, resolvedOrigin ? `${resolvedOrigin} · evaluated property` : "Origin is not set in this Jump.", [`Species: ${resolvedSpecies}`, `Location: ${resolvedLocation || "Unknown"}`]);
    }
    summaryGender.textContent = effective.gender || "Unknown";
    summaryAge.textContent = effective.age ?? "Unknown";
    syncIdentityControls();
    syncBalanceIndicators();
  };

  earthGender.addEventListener("change", () => {
    identityFor("earth").gender = earthGender.value;
    syncChoices();
  });
  earthAge.addEventListener("input", () => {
    identityFor("earth").age = earthAge.value === "" ? null : Math.max(1, Number(earthAge.value));
    syncChoices();
  });
  genderChoice.addEventListener("change", () => {
    identityFor(selectedJump).gender = genderChoice.value;
    syncChoices();
  });
  ageChoice.addEventListener("input", () => {
    identityFor(selectedJump).age = ageChoice.value === "" ? null : Math.max(1, Number(ageChoice.value));
    syncChoices();
  });

  const activateJumpView = () => {
    const jumpTab = mainTabs.find((tab) => tab.id === "chain-view-jump-tab");
    if (jumpTab) activateTab(mainTabs, jumpTab);
  };

  const syncCurrentJump = ({ openJump = false, resetPoint = false } = {}) => {
    const jump = jumpCatalog[selectedJump];
    const position = chainOrder.indexOf(selectedJump);
    if (!jump || position < 0) return;
    currentPosition.textContent = selectedJump === "earth" ? "Before Jump 1" : `Jump ${jumpNumber(selectedJump)} of ${jumpIds().length}`;
    currentTitle.textContent = jump.name;
    currentSource.textContent = selectedJump === "earth"
      ? "The Beginning"
      : `Version ${jump.version} · ${sourceLabel(jump.source)} package · ${jump.status}`;
    mockup.querySelector("#chain-supp-context-title").textContent = jump.name;
    mockup.querySelector("#supp-quest-context-kicker").textContent = `Quest Mode · ${jump.name}`;
    mockup.querySelector("#supp-story-context-kicker").textContent = `Story · ${jump.name}`;
    const completedQuests = questState.get(selectedJump) ?? new Set();
    mockup.querySelectorAll("[data-quest-award]").forEach((checkbox) => {
      checkbox.checked = completedQuests.has(Number(checkbox.dataset.questAward));
    });
    loadStoryEditor();
    updateQuestTotal();
    syncActorOptions();
    const actorName = actorCatalog[currentActor].name;
    renderKicker.textContent = `${currentActor === "jumper" ? "Current Jump" : "Companion build"} · ${sourceLabel(jump.source)}`;
    renderTitle.textContent = currentActor === "jumper" ? jump.name : `${actorName} in ${jump.name}`;
    renderDescription.textContent = jump.description;
    if (resetPoint) inspectionPoint = selectedJump;
    renderPointSelect();
    syncChoices();
    if (openJump) activateJumpView();
    applyHistoricalFilters();
  };

  actorSelect.addEventListener("change", () => {
    currentActor = actorSelect.value;
    syncCurrentJump();
  });

  const selectJump = (id) => {
    if (!chainOrder.includes(id)) return;
    selectedJump = id;
    renderChainList();
    syncCurrentJump({ openJump: true, resetPoint: true });
  };

  const moveJump = (id, nextIndex) => {
    const currentIndex = chainOrder.indexOf(id);
    if (currentIndex < 1 || id === "earth") return;
    const bounded = Math.max(1, Math.min(chainOrder.length - 1, nextIndex));
    if (bounded === currentIndex) return;
    chainOrder.splice(currentIndex, 1);
    chainOrder.splice(bounded, 0, id);
    renderChainList();
    renderLibrary();
    renderPointSelect();
    syncCurrentJump();
  };

  const removeJump = (id) => {
    if (id === "earth" || chainOrder.length <= 2) return;
    const removedIndex = chainOrder.indexOf(id);
    if (removedIndex < 0) return;
    chainOrder.splice(removedIndex, 1);
    [...choiceState.keys()].filter((key) => key.startsWith(`${id}:`)).forEach((key) => choiceState.delete(key));
    if (selectedJump === id) selectedJump = chainOrder[Math.min(removedIndex, chainOrder.length - 1)];
    if (inspectionPoint === id) inspectionPoint = selectedJump;
    renderChainList();
    renderLibrary();
    syncCurrentJump({ resetPoint: true });
  };

  function renderChainList() {
    jumpList.replaceChildren();
    [...chainOrder].reverse().forEach((id) => {
      const index = chainOrder.indexOf(id);
      const jump = jumpCatalog[id];
      const isEarth = id === "earth";
      const entry = document.createElement("article");
      entry.className = "chain-jump-entry";
      entry.classList.toggle("is-earth", isEarth);
      entry.classList.toggle("is-selected", id === selectedJump);
      entry.draggable = !isEarth;
      entry.dataset.chainJump = id;

      const handle = document.createElement("span");
      handle.className = "chain-jump-handle";
      handle.textContent = "⠿";
      handle.title = "Drag to reorder";
      handle.setAttribute("aria-hidden", "true");

      const select = document.createElement("button");
      select.type = "button";
      select.className = "chain-jump-select";
      select.setAttribute("aria-pressed", String(id === selectedJump));
      const name = document.createElement("span");
      name.textContent = isEarth ? "Earth" : `${jumpNumber(id)}. ${jump.name}${allowMultiplePackageVersions ? ` · v${jump.version}` : ""}`;
      const status = document.createElement("small");
      status.textContent = `${sourceLabel(jump.source)} · ${jump.status}`;
      select.append(name, status);
      select.addEventListener("click", () => selectJump(id));

      const actions = document.createElement("div");
      actions.className = "chain-jump-actions";
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.disabled = index === chainOrder.length - 1;
      up.setAttribute("aria-label", `Move ${jump.name} later in the chain`);
      up.addEventListener("click", () => moveJump(id, index + 1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.disabled = index === 0;
      down.setAttribute("aria-label", `Move ${jump.name} earlier in the chain`);
      down.addEventListener("click", () => moveJump(id, index - 1));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.dataset.removeJump = id;
      remove.disabled = chainOrder.length <= 1;
      remove.setAttribute("aria-label", `Remove ${jump.name} from the chain`);
      remove.addEventListener("click", () => removeJump(id));
      actions.append(up, down, remove);

      entry.addEventListener("dragstart", (event) => {
        if (isEarth) return;
        draggedJump = id;
        entry.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      });
      entry.addEventListener("dragover", (event) => {
        if (!draggedJump || draggedJump === id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      entry.addEventListener("drop", (event) => {
        event.preventDefault();
        if (!draggedJump || draggedJump === id) return;
        moveJump(draggedJump, chainOrder.indexOf(id));
      });
      entry.addEventListener("dragend", () => {
        draggedJump = null;
        entry.classList.remove("is-dragging");
      });

      if (isEarth) entry.append(select);
      else entry.append(handle, select, actions);
      jumpList.append(entry);
    });
    jumpCount.textContent = `${jumpIds().length} ${jumpIds().length === 1 ? "Jump" : "Jumps"}`;
  }

  const addJump = (id) => {
    if (chainOrder.includes(id)) {
      selectJump(id);
      activateTab(railTabs, railTabs[0]);
      return;
    }
    const samePackageEntry = chainOrder.find((entryId) => (
      jumpCatalog[entryId].logicalId === jumpCatalog[id].logicalId
    ));
    if (samePackageEntry && !allowMultiplePackageVersions) {
      selectJump(samePackageEntry);
      activateTab(railTabs, railTabs[0]);
      return;
    }
    chainOrder.push(id);
    selectedJump = id;
    inspectionPoint = id;
    renderChainList();
    renderLibrary();
    syncCurrentJump({ openJump: true });
    activateTab(railTabs, railTabs[0]);
  };

  function renderLibrary() {
    const query = librarySearch.value.trim().toLocaleLowerCase();
    libraryList.replaceChildren();
    const visible = Object.entries(jumpCatalog).filter(([, jump]) => {
      if (jump.foundation) return false;
      const sourceMatches = librarySource === "all" || jump.source === librarySource;
      const queryMatches = !query || `${jump.name} ${jump.version} ${jump.description}`.toLocaleLowerCase().includes(query);
      return sourceMatches && queryMatches;
    });
    visible.forEach(([id, jump]) => {
      const card = document.createElement("article");
      card.className = "chain-library-card";
      const description = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = `${jump.name} · v${jump.version}`;
      const source = document.createElement("small");
      source.textContent = `${sourceLabel(jump.source)} · ${jump.description}`;
      description.append(name, source);
      const add = document.createElement("button");
      add.type = "button";
      const alreadyAdded = chainOrder.includes(id);
      const samePackageEntry = chainOrder.find((entryId) => jumpCatalog[entryId].logicalId === jump.logicalId);
      const parallelVersionBlocked = !alreadyAdded && samePackageEntry && !allowMultiplePackageVersions;
      add.textContent = alreadyAdded ? "Open chain entry" : parallelVersionBlocked ? "Another version is in chain" : "Add to chain";
      add.disabled = Boolean(parallelVersionBlocked);
      add.addEventListener("click", () => addJump(id));
      card.append(description, add);
      libraryList.append(card);
    });
    libraryEmpty.hidden = visible.length !== 0;
  }

  openLibrary.addEventListener("click", () => activateTab(railTabs, railTabs[1], true));
  librarySearch.addEventListener("input", renderLibrary);
  librarySourceButtons.forEach((button) => button.addEventListener("click", () => {
    librarySource = button.dataset.librarySource;
    librarySourceButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    renderLibrary();
  }));

  trackerChoices.forEach((choice) => choice.addEventListener("click", () => {
    const selected = selectedChoices();
    const nextSelected = new Set(selected);
    const key = choice.dataset.choiceKey;
    const originKeys = ["wanderer", "noble", "scholar"];
    if (originKeys.includes(key)) {
      originKeys.forEach((origin) => nextSelected.delete(origin));
      nextSelected.add(key);
    } else if (nextSelected.has(key)) nextSelected.delete(key);
    else nextSelected.add(key);
    if (selectionWouldBeBlocked(nextSelected)) {
      rollResult.textContent = `${actorCatalog[currentActor].name} cannot make that selection because it would create or worsen a negative point balance.`;
      return;
    }
    selected.clear();
    nextSelected.forEach((selectedKey) => selected.add(selectedKey));
    syncChoices();
  }));

  rollOrigin.addEventListener("click", () => {
    const origins = ["wanderer", "noble", "scholar"];
    const selectedOrigin = origins[Math.floor(Math.random() * origins.length)];
    const selected = selectedChoices();
    const nextSelected = new Set(selected);
    origins.forEach((origin) => nextSelected.delete(origin));
    nextSelected.add(selectedOrigin);
    const choice = trackerChoices.find((candidate) => candidate.dataset.choiceKey === selectedOrigin);
    const actorName = actorCatalog[currentActor].name;
    if (selectionWouldBeBlocked(nextSelected)) {
      rollResult.textContent = `Rolled ${choice.querySelector("strong").textContent}, but ${actorName} cannot accept it because it would create or worsen a negative point balance.`;
      return;
    }
    selected.clear();
    nextSelected.forEach((selectedKey) => selected.add(selectedKey));
    rollResult.textContent = `Rolled ${choice.querySelector("strong").textContent}. The result is stored for ${actorName} in ${jumpCatalog[selectedJump].name}.`;
    syncChoices();
  });

  const recordDetails = {
    "Body Calibration": { kind: "Perk", source: "Acquired in First Step", tags: ["Physical", "Survival"], description: "Your body adjusts quickly to unfamiliar environments, maintaining a dependable baseline of strength, coordination, and endurance." },
    "Traveler’s Pack": { kind: "Item", source: "Acquired in First Step", tags: ["Utility"], description: "A durable travel pack whose ordinary-looking compartments keep essential supplies organized, protected, and ready to hand." },
    "Quick Study": { kind: "Perk", source: "Acquired in Arcane Realms", tags: ["Magic", "Mental"], description: "You learn unfamiliar systems rapidly. Focused study reveals their underlying structure, helping you retain lessons and apply related techniques sooner." },
    "Warded Soul": { kind: "Perk", source: "Acquired in Arcane Realms", tags: ["Magic", "Pyrokinesis", "Defense"], description: "Your spirit is reinforced against hostile influence. Possession, corruption, and attacks that directly target the soul meet a resilient magical ward." },
    "Apprentice Grimoire": { kind: "Item", source: "Acquired in Arcane Realms", tags: ["Magic", "Crafting"], description: "A working spellbook containing foundational exercises, practical formulae, and generous space for recording discoveries of your own." },
    "Stellar Intuition": { kind: "Perk", source: "Acquired in Cosmic Odyssey", tags: ["Technology", "Meta"], description: "You develop a practiced instinct for strange vessels, orbital systems, and the hidden constraints of unfamiliar technology." },
    "Survey Skiff": { kind: "Item", source: "Acquired in Cosmic Odyssey", tags: ["Technology", "Vehicle"], description: "A compact survey craft equipped for atmospheric and short-range orbital travel, environmental sampling, and safe field operations." },
    Trailwise: { kind: "Perk", source: "Ash · Companion record", tags: ["Travel", "Survival"], description: "Ash can read terrain, weather, and the traces left by earlier travelers well enough to keep a group moving safely." },
    "Steady Nerves": { kind: "Perk", source: "Ash · Companion record", tags: ["Mental", "Defense"], description: "Ash remains composed through danger and uncertainty, making clear decisions without becoming numb to genuine risks." },
    "Traveler’s Kit": { kind: "Item", source: "Ash · Companion record", tags: ["Travel", "Utility"], description: "A maintained collection of field tools, shelter supplies, maps, and repair materials suited to long journeys." },
    "Formal Spellcraft": { kind: "Perk", source: "Mira · Companion record", tags: ["Magic", "Scholar"], description: "Mira has a rigorous grounding in magical notation, ritual construction, and the safe analysis of unfamiliar spells." },
    "Perfect Recall": { kind: "Perk", source: "Mira · Companion record", tags: ["Mental", "Scholar"], description: "Mira can accurately revisit anything she deliberately committed to memory, including complex diagrams and research notes." },
    "Annotated Grimoire": { kind: "Item", source: "Mira · Companion record", tags: ["Magic", "Research"], description: "Mira’s cross-world research journal, densely annotated with comparisons, corrections, and reproducible magical experiments." },
    "Stellar Navigation": { kind: "Perk", source: "Io · Companion record", tags: ["Technology", "Travel"], description: "Io can plot safe and efficient routes through unfamiliar stellar environments, even when available charts are incomplete." },
    "Machine Empathy": { kind: "Perk", source: "Io · Companion record", tags: ["Technology", "Mental"], description: "Io develops an intuitive sense for how machines are intended to behave and where a malfunction or mismatch is likely to originate." },
    "Survey Rig": { kind: "Item", source: "Io · Companion record", tags: ["Technology", "Research"], description: "A portable sensor suite for mapping terrain, sampling local conditions, and consolidating observations into useful field reports." },
    "Pilot Suit": { kind: "Item", source: "Io · Companion record", tags: ["Technology", "Defense"], description: "A fitted flight suit with environmental sealing, impact protection, and interfaces adaptable to unfamiliar vehicle controls." },
    "Adaptable Baseline": { kind: "Perk", source: "Jumper · Form perk", tags: ["Physical", "Adaptation"], description: "This form maintains a healthy human baseline and gradually acclimates to ordinary differences in climate, diet, and daily exertion." },
    "Human Ingenuity": { kind: "Perk", source: "Jumper · Form perk", tags: ["Mental", "Crafting"], description: "This form is particularly good at combining familiar tools and incomplete information into practical, improvised solutions." },
    "Draconic Flight": { kind: "Perk", source: "Dragon Form · Form perk", tags: ["Physical", "Travel"], description: "Powerful wings and instinctive aerial balance allow this form to fly, hover briefly, and maneuver safely in difficult winds." },
    "Elemental Scales": { kind: "Perk", source: "Dragon Form · Form perk", tags: ["Magic", "Defense"], description: "Layered magical scales protect this form from harsh environments and blunt elemental attacks before they reach the body beneath." },
    "Network Embodiment": { kind: "Perk", source: "Digital Avatar · Form perk", tags: ["Technology", "Alt Form"], description: "This form can inhabit compatible digital environments as a coherent body rather than operating through a detached interface." },
    "Fork Resistance": { kind: "Perk", source: "Digital Avatar · Form perk", tags: ["Technology", "Mental", "Defense"], description: "Copying, synchronization, and hostile process duplication cannot casually fragment this form’s sense of identity or continuity." },
  };
  const recordLayer = mockup.querySelector("#record-detail-layer");
  const recordTitle = mockup.querySelector("#record-detail-title");
  let recordDetailOpener = null;
  let recordUnderlyingDialog = null;

  const openRecordDetail = (name, opener) => {
    const record = recordDetails[name];
    if (!record) return;
    recordDetailOpener = opener;
    recordUnderlyingDialog = opener?.closest?.(".companion-profile-dialog") ?? null;
    mockup.querySelector("#record-detail-kind").textContent = `${record.kind} details`;
    recordTitle.textContent = name;
    mockup.querySelector("#record-detail-source").textContent = record.source;
    mockup.querySelector("#record-detail-description").textContent = record.description;
    mockup.querySelector("#record-detail-tags").replaceChildren(...record.tags.map((tag) => {
      const badge = document.createElement("span");
      badge.textContent = tag;
      return badge;
    }));
    if (recordUnderlyingDialog) {
      recordUnderlyingDialog.inert = true;
      recordUnderlyingDialog.setAttribute("aria-hidden", "true");
    }
    recordLayer.hidden = false;
    recordTitle.focus();
  };

  const closeRecordDetail = () => {
    recordLayer.hidden = true;
    if (recordUnderlyingDialog) {
      recordUnderlyingDialog.inert = false;
      recordUnderlyingDialog.removeAttribute("aria-hidden");
    }
    recordUnderlyingDialog = null;
    recordDetailOpener?.focus?.();
    recordDetailOpener = null;
  };
  mockup.querySelector("#record-detail-close").addEventListener("click", closeRecordDetail);
  recordLayer.addEventListener("click", (event) => { if (event.target === recordLayer) closeRecordDetail(); });
  recordLayer.addEventListener("keydown", (event) => { if (event.key === "Escape") closeRecordDetail(); });

  const inventoryTabs = [...mockup.querySelectorAll(".inventory-subtabs [role='tab']")];
  wireTabs(inventoryTabs);
  const inventoryRecords = [...mockup.querySelectorAll("[data-inventory-record]")];
  const inventoryKindButtons = [...mockup.querySelectorAll("[data-inventory-kind]")];
  const inventoryTagButtons = [...mockup.querySelectorAll("[data-inventory-tag]")];
  const inventorySearch = mockup.querySelector("#inventory-text-search");
  const inventoryNote = mockup.querySelector("#inventory-result-note");
  const inventoryEmpty = mockup.querySelector("#inventory-record-empty");
  const sonarButtons = [...mockup.querySelectorAll("[data-sonar-category]")];
  const sonarArea = mockup.querySelector("#inventory-sonar-area");

  inventoryRecords.forEach((record) => {
    const name = record.querySelector("h5").textContent;
    record.setAttribute("role", "button");
    record.tabIndex = 0;
    record.setAttribute("aria-label", `View full details for ${name}`);
    const open = () => openRecordDetail(name, record);
    record.addEventListener("click", open);
    record.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      open();
    });
  });

  const tagMatches = (record, tag) => {
    if (tag === "all") return true;
    const tags = record.dataset.recordTags.split(/\s+/);
    if (tag === "magic") return tags.includes("magic") || tags.includes("pyrokinesis");
    return tags.includes(tag);
  };

  const filterInventory = () => {
    const cutoff = chainOrder.indexOf(inspectionPoint);
    const terms = inventorySearch.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    inventoryRecords.forEach((record) => {
      const origin = chainOrder.indexOf(record.dataset.acquiredJump);
      const withinPoint = origin >= 0 && origin <= cutoff;
      const matchesKind = inventoryKind === "all" || record.dataset.recordKind === inventoryKind;
      const matchesTag = tagMatches(record, inventoryTag);
      const matchesText = terms.every((term) => record.dataset.recordSearch.includes(term));
      record.hidden = !(withinPoint && matchesKind && matchesTag && matchesText);
      if (!record.hidden) visible += 1;
    });
    mockup.querySelector("#chain-inventory-count").textContent = visible;
    mockup.querySelector("#chain-inventory-summary").textContent = `Through ${jumpCatalog[inspectionPoint].name}`;
    inventoryNote.textContent = `${visible} ${visible === 1 ? "record" : "records"} through ${jumpCatalog[inspectionPoint].name}${inventoryTag === "all" ? "" : ` matching ${inventoryTag}`}.`;
    inventoryEmpty.hidden = visible !== 0;
  };

  const syncSonarCounts = () => {
    const cutoff = chainOrder.indexOf(inspectionPoint);
    const eligible = inventoryRecords.filter((record) => {
      const origin = chainOrder.indexOf(record.dataset.acquiredJump);
      return record.dataset.recordKind === "perk" && origin >= 0 && origin <= cutoff;
    });
    sonarButtons.forEach((button) => {
      const count = eligible.filter((record) => tagMatches(record, button.dataset.sonarCategory)).length;
      button.querySelector("strong").textContent = count;
    });
  };

  inventoryKindButtons.forEach((button) => button.addEventListener("click", () => {
    inventoryKind = button.dataset.inventoryKind;
    inventoryKindButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    filterInventory();
  }));
  inventoryTagButtons.forEach((button) => button.addEventListener("click", () => {
    inventoryTag = button.dataset.inventoryTag;
    inventoryTagButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    filterInventory();
  }));
  inventorySearch.addEventListener("input", filterInventory);
  sonarButtons.forEach((button) => button.addEventListener("click", () => {
    const selected = button.getAttribute("aria-pressed") !== "true";
    sonarButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", String(selected));
    sonarArea.classList.toggle("is-selected", selected);
  }));

  const filterForms = () => {
    const cutoff = chainOrder.indexOf(inspectionPoint);
    const forms = [...mockup.querySelectorAll("[data-form-jump]")];
    let visible = 0;
    forms.forEach((form) => {
      const origin = chainOrder.indexOf(form.dataset.formJump);
      form.hidden = origin < 0 || origin > cutoff;
      if (!form.hidden) visible += 1;
    });
    mockup.querySelector("#chain-form-count").textContent = visible;
    mockup.querySelector("#chain-form-summary").textContent = `Through ${jumpCatalog[inspectionPoint].name}`;
    mockup.querySelector("#chain-form-empty").hidden = visible !== 0;
    const detail = mockup.querySelector("#chain-form-detail");
    const detailOrigin = chainOrder.indexOf(detail.dataset.formJump);
    if (detail.dataset.formJump && (detailOrigin < 0 || detailOrigin > cutoff)) detail.hidden = true;
  };

  const formDetail = mockup.querySelector("#chain-form-detail");
  const formDetailName = mockup.querySelector("#chain-form-detail-name");
  const formDetailSource = mockup.querySelector("#chain-form-detail-source");
  const formDetailText = mockup.querySelector("#chain-form-detail-text");
  let selectedFormName = "Jumper";
  mockup.querySelectorAll("[data-form-jump] button").forEach((button) => button.addEventListener("click", () => {
    const card = button.closest("[data-form-jump]");
    selectedFormName = card.querySelector("h5").textContent;
    formDetail.dataset.formJump = card.dataset.formJump;
    formDetailName.textContent = selectedFormName;
    formDetailSource.textContent = card.querySelector("p").textContent;
    formDetailText.textContent = card.dataset.formDescription;
    formDetail.hidden = false;
    formDetailName.focus();
  }));
  mockup.querySelector("#chain-form-detail-close").addEventListener("click", () => { formDetail.hidden = true; });

  const filterCompanions = () => {
    const cutoff = chainOrder.indexOf(inspectionPoint);
    const companions = [...mockup.querySelectorAll("[data-companion-jump]")];
    let visible = 0;
    companions.forEach((companion) => {
      const origin = chainOrder.indexOf(companion.dataset.companionJump);
      companion.hidden = origin < 0 || origin > cutoff;
      if (!companion.hidden) visible += 1;
    });
    mockup.querySelector("#chain-companion-count").textContent = visible;
    mockup.querySelector("#chain-companion-summary").textContent = `Through ${jumpCatalog[inspectionPoint].name}`;
    mockup.querySelector("#chain-companion-empty").hidden = visible !== 0;
    const openDetail = mockup.querySelector("#chain-companion-detail");
    const detailOrigin = chainOrder.indexOf(openDetail.dataset.companionJump);
    if (openDetail.dataset.companionJump && (detailOrigin < 0 || detailOrigin > cutoff)) openDetail.hidden = true;
  };

  function applyHistoricalFilters() {
    if (!chainOrder.includes(inspectionPoint)) inspectionPoint = selectedJump;
    filterInventory();
    syncSonarCounts();
    filterForms();
    filterCompanions();
  }

  pointSelects.forEach((select) => select.addEventListener("change", () => {
    inspectionPoint = select.value;
    renderPointSelect();
    applyHistoricalFilters();
  }));

  const companionDescriptions = {
    Ash: "A reliable traveler who helps keep the chain moving.",
    Mira: "A scholar of magic who maintains research notes across worlds.",
    Io: "A pilot and systems specialist comfortable with unfamiliar technology.",
  };
  const companionDetail = mockup.querySelector("#chain-companion-detail");
  const companionDetailName = mockup.querySelector("#chain-companion-detail-name");
  const companionDetailSource = mockup.querySelector("#chain-companion-detail-source");
  const companionDetailText = mockup.querySelector("#chain-companion-detail-text");
  let selectedCompanionName = "Ash";
  mockup.querySelectorAll("[data-companion-jump] button").forEach((button) => button.addEventListener("click", () => {
    const card = button.closest("[data-companion-jump]");
    const name = card.querySelector("h5").textContent;
    selectedCompanionName = name;
    companionDetail.dataset.companionJump = card.dataset.companionJump;
    companionDetailName.textContent = name;
    companionDetailSource.textContent = card.querySelector("p").textContent;
    companionDetailText.textContent = companionDescriptions[name];
    companionDetail.hidden = false;
    companionDetailName.focus?.();
  }));
  mockup.querySelector("#chain-companion-detail-close").addEventListener("click", () => { companionDetail.hidden = true; });

  const companionProfiles = {
    Ash: { avatar: "AS", description: "Reliable traveler and support specialist.", perks: ["Trailwise", "Steady Nerves"], items: ["Traveler’s Kit"], imports: ["Arcane Realms"] },
    Mira: { avatar: "MI", description: "Scholar of magic and cross-world researcher.", perks: ["Formal Spellcraft", "Perfect Recall"], items: ["Annotated Grimoire"], imports: ["Cosmic Odyssey", "Hero Academy"] },
    Io: { avatar: "IO", description: "Pilot and unfamiliar-systems specialist.", perks: ["Stellar Navigation", "Machine Empathy"], items: ["Survey Rig", "Pilot Suit"], imports: ["Builder World"] },
  };
  const profileLayer = mockup.querySelector("#companion-profile-layer");
  const populateTextList = (id, values) => {
    const list = mockup.querySelector(id);
    list.replaceChildren(...values.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }));
  };
  const populateRecordList = (id, values, kind) => {
    const list = mockup.querySelector(id);
    list.replaceChildren(...values.map((value) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.setAttribute("aria-label", `View full ${kind.toLocaleLowerCase()} details for ${value}`);
      button.addEventListener("click", () => openRecordDetail(value, button));
      item.append(button);
      return item;
    }));
  };

  const formProfiles = {
    Jumper: { avatar: "JU", description: "The chain’s ordinary human baseline.", details: ["Body type · Human", "Acquired · First Step", "Presentation · Baseline"], perks: ["Adaptable Baseline", "Human Ingenuity"] },
    "Dragon Form": { avatar: "DR", description: "A scaled magical body with flight and elemental resilience.", details: ["Body type · Dragon", "Acquired · Arcane Realms", "Presentation · Large draconic form"], perks: ["Draconic Flight", "Elemental Scales"] },
    "Digital Avatar": { avatar: "DA", description: "A network-native body used for digital environments.", details: ["Body type · Digital", "Acquired · Cosmic Odyssey", "Presentation · Configurable avatar"], perks: ["Network Embodiment", "Fork Resistance"] },
  };
  const formProfileLayer = mockup.querySelector("#form-profile-layer");
  mockup.querySelector("#chain-form-profile-open").addEventListener("click", () => {
    const profile = formProfiles[selectedFormName];
    mockup.querySelector("#form-profile-title").textContent = selectedFormName;
    mockup.querySelector("#form-profile-name").textContent = selectedFormName;
    mockup.querySelector("#form-profile-avatar").textContent = profile.avatar;
    mockup.querySelector("#form-profile-description").textContent = profile.description;
    populateTextList("#form-profile-details", profile.details);
    populateRecordList("#form-profile-perks", profile.perks, "Perk");
    formProfileLayer.hidden = false;
    mockup.querySelector("#form-profile-title").focus();
  });
  const closeFormProfile = () => {
    formProfileLayer.hidden = true;
    mockup.querySelector("#chain-form-profile-open").focus();
  };
  mockup.querySelector("#form-profile-close").addEventListener("click", closeFormProfile);
  formProfileLayer.addEventListener("click", (event) => { if (event.target === formProfileLayer) closeFormProfile(); });
  formProfileLayer.addEventListener("keydown", (event) => { if (event.key === "Escape") closeFormProfile(); });

  mockup.querySelector("#chain-companion-profile-open").addEventListener("click", () => {
    const profile = companionProfiles[selectedCompanionName];
    mockup.querySelector("#companion-profile-title").textContent = selectedCompanionName;
    mockup.querySelector("#companion-profile-name").textContent = selectedCompanionName;
    mockup.querySelector("#companion-profile-avatar").textContent = profile.avatar;
    mockup.querySelector("#companion-profile-description").textContent = profile.description;
    populateRecordList("#companion-profile-perks", profile.perks, "Perk");
    populateRecordList("#companion-profile-items", profile.items, "Item");
    populateTextList("#companion-profile-imports", profile.imports);
    profileLayer.hidden = false;
    mockup.querySelector("#companion-profile-title").focus();
  });
  const closeCompanionProfile = () => {
    profileLayer.hidden = true;
    mockup.querySelector("#chain-companion-profile-open").focus();
  };
  mockup.querySelector("#companion-profile-close").addEventListener("click", closeCompanionProfile);
  profileLayer.addEventListener("click", (event) => { if (event.target === profileLayer) closeCompanionProfile(); });
  profileLayer.addEventListener("keydown", (event) => { if (event.key === "Escape") closeCompanionProfile(); });

  const supplementTabs = [...mockup.querySelectorAll("#supplement-tabs [role='tab']")];
  const supplementToggles = {
    "body-mod": mockup.querySelector("#supplement-body-mod-enabled"),
    "essential-body-mod": mockup.querySelector("#supplement-essential-body-mod-enabled"),
    warehouse: mockup.querySelector("#supplement-warehouse-enabled"),
    "personal-reality": mockup.querySelector("#supplement-personal-reality-enabled"),
    "universal-drawbacks": mockup.querySelector("#supplement-universal-drawbacks-enabled"),
    "quest-mode": mockup.querySelector("#supplement-quest-mode-enabled"),
    story: mockup.querySelector("#supplement-story-enabled"),
  };

  const supplementContext = mockup.querySelector("#chain-supp-context");
  const openSupplementContext = mockup.querySelector("#chain-open-supp-context");
  const closeSupplementContext = mockup.querySelector("#chain-close-supp-context");
  const contextButtons = [...mockup.querySelectorAll("[data-supp-context-target]")];
  const contextPanels = [...mockup.querySelectorAll("[data-supp-context-panel]")];
  const activateSupplementContext = (button, moveFocus = false) => {
    if (!button || button.hidden) return;
    contextButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    contextPanels.forEach((panel) => { panel.hidden = panel.dataset.suppContextPanel !== button.dataset.suppContextTarget; });
    if (moveFocus) button.focus();
  };
  const setSupplementContextOpen = (open) => {
    supplementContext.hidden = !open;
    openSupplementContext.setAttribute("aria-expanded", String(open));
    if (open) supplementContext.querySelector("[data-supp-context-target][aria-pressed='true']:not([hidden])")?.focus();
    else openSupplementContext.focus();
  };
  openSupplementContext.addEventListener("click", () => setSupplementContextOpen(supplementContext.hidden));
  closeSupplementContext.addEventListener("click", () => setSupplementContextOpen(false));
  supplementContext.addEventListener("keydown", (event) => { if (event.key === "Escape") setSupplementContextOpen(false); });
  contextButtons.forEach((button) => button.addEventListener("click", () => activateSupplementContext(button)));

  const updateQuestTotal = () => {
    const total = [...mockup.querySelectorAll("[data-quest-award]:checked")].reduce((sum, checkbox) => sum + Number(checkbox.dataset.questAward), 0);
    mockup.querySelector("#supp-quest-earned").value = `${total} CP`;
    mockup.querySelector("#supp-quest-earned").textContent = `${total} CP`;
  };
  mockup.querySelectorAll("[data-quest-award]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    const completed = new Set([...mockup.querySelectorAll("[data-quest-award]:checked")].map((input) => Number(input.dataset.questAward)));
    questState.set(selectedJump, completed);
    updateQuestTotal();
  }));
  const storyBlocks = [...mockup.querySelectorAll("[data-story-block-index]")];
  const storyForCurrentJump = () => {
    if (!storyState.has(selectedJump)) storyState.set(selectedJump, { title: "", blocks: ["", ""] });
    return storyState.get(selectedJump);
  };
  const appendStoryMarkup = (target, source) => {
    target.replaceChildren();
    const pattern = /(\*\*.+?\*\*|~~.+?~~|\*.+?\*)/g;
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      target.append(document.createTextNode(source.slice(cursor, match.index)));
      const token = match[0];
      const element = token.startsWith("**") ? document.createElement("strong")
        : token.startsWith("~~") ? document.createElement("s")
          : document.createElement("em");
      const markerLength = token.startsWith("**") || token.startsWith("~~") ? 2 : 1;
      element.textContent = token.slice(markerLength, -markerLength);
      target.append(element);
      cursor = match.index + token.length;
    }
    target.append(document.createTextNode(source.slice(cursor)));
  };
  const renderStoryBlock = (block) => {
    const source = block.querySelector("[data-story-source]").value;
    const preview = block.querySelector("[data-story-preview]");
    const rendered = block.querySelector("[data-story-rendered]");
    preview.classList.toggle("is-empty", !source.trim());
    if (source.trim()) appendStoryMarkup(rendered, source);
    else rendered.textContent = "Add story text…";
  };
  const editStoryBlock = (activeBlock, moveFocus = true) => {
    storyBlocks.forEach((block) => {
      const editing = block === activeBlock;
      block.classList.toggle("is-editing", editing);
      block.querySelector("[data-story-preview]").hidden = editing;
      block.querySelector("[data-story-source]").hidden = !editing;
      if (!editing) renderStoryBlock(block);
    });
    if (moveFocus) activeBlock.querySelector("[data-story-source]").focus();
  };
  const loadStoryEditor = () => {
    const story = storyForCurrentJump();
    mockup.querySelector("#supp-story-title").value = story.title;
    storyBlocks.forEach((block) => {
      const index = Number(block.dataset.storyBlockIndex);
      block.querySelector("[data-story-source]").value = story.blocks[index] ?? "";
      renderStoryBlock(block);
    });
  };
  mockup.querySelector("#supp-story-title").addEventListener("input", (event) => {
    storyForCurrentJump().title = event.currentTarget.value;
    const sequenceTitle = mockup.querySelector(`[data-story-sequence-title="${selectedJump}"]`);
    if (sequenceTitle) sequenceTitle.textContent = event.currentTarget.value.trim() || "Untitled chapter";
  });
  storyBlocks.forEach((block) => {
    const source = block.querySelector("[data-story-source]");
    block.querySelector("[data-story-preview]").addEventListener("click", () => editStoryBlock(block));
    source.addEventListener("focus", () => editStoryBlock(block, false));
    source.addEventListener("input", () => {
      storyForCurrentJump().blocks[Number(block.dataset.storyBlockIndex)] = source.value;
    });
    source.addEventListener("blur", () => {
      block.classList.remove("is-editing");
      source.hidden = true;
      block.querySelector("[data-story-preview]").hidden = false;
      renderStoryBlock(block);
    });
  });
  mockup.querySelectorAll(".supp-context-choices button").forEach((button) => button.addEventListener("click", () => {
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  }));

  const activateSupplementTab = (tab, moveFocus = false) => {
    if (!tab || tab.disabled) return;
    activateTab(supplementTabs, tab, moveFocus);
  };

  supplementTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateSupplementTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const visible = supplementTabs.filter((candidate) => !candidate.disabled);
      const index = visible.indexOf(tab);
      const next = event.key === "Home" ? visible[0]
        : event.key === "End" ? visible.at(-1)
          : event.key === "ArrowRight" ? visible[(index + 1) % visible.length]
            : visible[(index - 1 + visible.length) % visible.length];
      activateSupplementTab(next, true);
    });
  });

  const syncSupplementPages = () => {
    Object.entries(supplementToggles).forEach(([key, toggle]) => {
      const tab = mockup.querySelector(`[data-supplement-tab="${key}"]`);
      const open = mockup.querySelector(`[data-open-supplement="${key}"]`);
      tab.disabled = !toggle.checked;
      tab.classList.toggle("is-unavailable", !toggle.checked);
      tab.setAttribute("aria-hidden", String(!toggle.checked));
      open.disabled = !toggle.checked;
      contextButtons.filter((button) => button.dataset.suppContextModule === key).forEach((button) => { button.hidden = !toggle.checked; });
      if (!toggle.checked && tab.getAttribute("aria-selected") === "true") activateSupplementTab(supplementTabs[0]);
    });
    const activeContext = contextButtons.find((button) => button.getAttribute("aria-pressed") === "true" && !button.hidden);
    if (!activeContext) activateSupplementContext(contextButtons.find((button) => !button.hidden));
  };

  const exclusiveSupplement = {
    "body-mod": "essential-body-mod",
    "essential-body-mod": "body-mod",
    warehouse: "personal-reality",
    "personal-reality": "warehouse",
  };
  Object.entries(supplementToggles).forEach(([key, toggle]) => toggle.addEventListener("change", () => {
    if (toggle.checked && exclusiveSupplement[key]) supplementToggles[exclusiveSupplement[key]].checked = false;
    syncSupplementPages();
  }));
  mockup.querySelectorAll("[data-open-supplement]").forEach((button) => button.addEventListener("click", () => {
    activateSupplementTab(mockup.querySelector(`[data-supplement-tab="${button.dataset.openSupplement}"]`));
  }));
  mockup.querySelectorAll(".supplement-subpage .supplement-choice").forEach((button) => button.addEventListener("click", () => {
    const group = button.closest(".tracker-choice-grid");
    if (group.dataset.choiceMode === "multi") {
      button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    } else {
      [...group.querySelectorAll(".supplement-choice")].forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
    }
  }));

  renderChainList();
  renderLibrary();
  syncCurrentJump();
  syncSupplementPages();
})();
