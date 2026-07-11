(() => {
  const full = document.querySelector(".uds-full-mock");
  const dialog = document.querySelector(".uds-dialog-mock");
  if (!full || !dialog) return;

  const categoryInfo = {
    chain: ["Global setup", "Chain Drawbacks", "Add or remove effects that apply throughout the chain."],
    companion: ["Companion rules", "Companion Drawbacks", "Effects on Companions, Followers, or imports apply only where the source explicitly says so."],
    warehouse: ["Persistent possessions", "Warehouse & item Drawbacks", "Access, storage, equipment, and restricted item-CP effects."],
    starting: ["Insertion rules", "Starting-condition Drawbacks", "Changes to where, when, or under what pressure a Jump begins."],
    powers: ["Capability restrictions", "Power & perk Drawbacks", "Restrictions that suppress or complicate accumulated abilities."],
    setting: ["Context and identity", "Setting & memory Drawbacks", "Changes to setting knowledge, imported context, language, and identity."],
    ethos: ["Behavioral commitments", "Ethos Drawbacks", "Ethical restrictions with source-specific violation and atonement rules."],
    challenge: ["Fundamental variants", "Challenge modes", "Author-selected rules that substantially restructure the entire chain."],
  };
  const entries = [
    { id: "without-why", category: "chain", name: "Without Why", chain: 200, description: "The Jumper does not know they are in a Jumpchain or receive the usual explanatory context.", tags: ["Chain only", "Knowledge restriction"] },
    { id: "random-chan", category: "chain", name: "Random-Chan", chain: 200, description: "Jump order is generated from a large random pool instead of being freely selected.", tags: ["Chain only", "Cannot revoke"], noRevoke: true, conflicts: ["pseudo-random"] },
    { id: "pseudo-random", category: "chain", name: "Pseudo-Random-Chan", chain: 50, description: "The author chooses the route, but the Jumper has no control over the destination or timing.", tags: ["Chain only", "Alternative"], conflicts: ["random-chan"] },
    { id: "economic-impact", category: "chain", name: "Economic Impact", chain: 50, jump: 50, description: "Imported wealth affects local economies normally; protections against inflation or disruption no longer erase those consequences.", tags: ["Chain or Single Jump", "General CP"] },
    { id: "all-by-yourself", category: "companion", name: "All By Yourself", chain: 200, jump: 200, description: "Companions are unavailable for the affected scope and no new long-term companions may join during it.", tags: ["Chain or Single Jump", "Companion restriction"] },
    { id: "two-player", category: "companion", name: "Two Player Jumpchain", chain: 0, description: "Creates two linked Jumpers with divided budgets and shared chain-failure conditions.", tags: ["Chain only", "Special value", "No hiatus"], noHiatus: true, conflicts: ["all-by-yourself"] },
    { id: "limited-access", category: "warehouse", name: "Limited Access", chain: 100, jump: 100, description: "Warehouse access is limited to a periodic interval or qualifying owned property; chaining it also supplies its one-time Warehouse benefit.", tags: ["Chain or Single Jump", "+10 WP when chained"] },
    { id: "ready-access", category: "warehouse", name: "Ready Access", chain: 100, jump: 100, description: "Warehouse entrances remain vulnerable to outside intrusion and the protective Force Wall is unavailable.", tags: ["Chain or Single Jump", "Access risk"], conflicts: ["no-access"] },
    { id: "no-insurance", category: "warehouse", name: "No Insurance", chain: 200, jump: 200, description: "Stolen Warehouse contents no longer return automatically; chaining it directs an additional stipend to items.", tags: ["Requires Ready Access", "Restricted item CP"], requires: "ready-access", restricted: true },
    { id: "no-access", category: "warehouse", name: "No Access", chain: 300, jump: 300, description: "The Warehouse cannot be accessed for the affected Jump and incompatible Warehouse drawbacks are unavailable.", tags: ["No hiatus", "Exclusive Warehouse rule"], noHiatus: true, conflicts: ["limited-access", "ready-access", "no-insurance"] },
    { id: "why-glowing", category: "warehouse", name: "Why Is It Glowing?", chain: 100, jump: 50, description: "Out-of-setting CP-backed equipment becomes visibly anomalous; its higher chained option directs the award to items.", tags: ["Variable award", "Restricted option"] },
    { id: "hot-water", category: "starting", name: "Hot Water", chain: 50, jump: 50, description: "The Jump begins at the least desirable non-deadly listed location under an unpleasant insertion.", tags: ["Chain or Single Jump", "Starting location"] },
    { id: "hotter-water", category: "starting", name: "Hotter Water", chain: 50, jump: 50, description: "The bad starting location becomes actively dangerous and harder to escape.", tags: ["Requires Hot Water", "Upgrade"], requires: "hot-water" },
    { id: "super-hot", category: "starting", name: "Super Hot", chain: 100, jump: 100, description: "Each Jump begins in its worst survivable location with a prolonged opening crisis.", tags: ["Requires Hotter Water", "Upgrade"], requires: "hotter-water" },
    { id: "not-so-ooc", category: "powers", name: "Not-So Out of Context", chain: 200, jump: 100, description: "Abilities brought from earlier settings acquire local counterparts, awareness, and counters in later settings.", tags: ["200 Chain / 100 Jump", "Cannot hiatus when chained"], noHiatus: true },
    { id: "luckless", category: "powers", name: "Luckless", chain: 100, jump: 100, description: "Luck perks and equivalent effects cannot benefit the affected actor.", tags: ["Companion eligible", "Requires relevant perks for Single Jump"], companionEligible: true },
    { id: "slow-learner", category: "powers", name: "Slow Learner", chain: 100, jump: 50, description: "Accelerated-learning effects cannot benefit the affected actor.", tags: ["100 Chain / 50 Jump", "Companion eligible"], companionEligible: true },
    { id: "setting-amnesia", category: "setting", name: "Setting Amnesia", chain: 200, jump: 200, description: "Foreknowledge of the current setting and its plot is unavailable while the drawback applies.", tags: ["Memory restriction", "Alternative line"], conflicts: ["total-amnesia"] },
    { id: "total-amnesia", category: "setting", name: "Total Amnesia", chain: 400, jump: 400, description: "Prior memories, rather than only setting knowledge, become unavailable for the affected Jump.", tags: ["Alternative", "Not recommended as Chain"], conflicts: ["setting-amnesia"] },
    { id: "language-block", category: "setting", name: "Language Block", chain: 50, jump: 50, description: "Insertion supplies only a small kernel of the common language rather than automatic fluency.", tags: ["Chain or Single Jump", "Language"] },
    { id: "oath-truth", category: "ethos", name: "Oath of Truth", chain: 200, jump: 100, description: "The actor must not communicate deliberate falsehoods; higher variants also cover misleading omission.", tags: ["Ethos", "+100 when chained", "Never hiatus"] , noHiatus: true },
    { id: "oath-humility", category: "ethos", name: "Oath of Humility", chain: 200, jump: 100, description: "The actor must not claim credit or accept rewards outside the selected variant’s narrow allowances.", tags: ["Ethos", "+100 when chained", "Never hiatus"], noHiatus: true },
    { id: "npc-blues", category: "challenge", name: "NPC Blues", chain: 0, description: "A punishment-oriented challenge constrains the Jumper to an ordinary working life for a limited run of Jumps.", tags: ["Author-selected", "Limited duration", "Special value"], noHiatus: true },
    { id: "jumpseed", category: "challenge", name: "JumpSeed", chain: 200, description: "Other Jumpers exist in the originating world and return on their own schedules, restructuring the chain’s larger stakes.", tags: ["Challenge mode", "Chain only"] },
  ];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const state = { category: "chain", filter: "all", search: "", dialogFilter: "all", jumpSearch: "", chain: new Set(["without-why", "all-by-yourself", "limited-access"]), jump: new Set(["economic-impact"]), hiatus: new Set(), detail: null };
  const selected = (id) => state.chain.has(id) || state.jump.has(id);
  const valueFor = (entry, scope) => entry[scope] ?? 0;
  const chainValue = () => [...state.chain].reduce((sum, id) => sum + (state.hiatus.has(id) ? -2 * valueFor(byId.get(id), "chain") : valueFor(byId.get(id), "chain")), 0);
  const jumpValue = () => [...state.jump].reduce((sum, id) => sum + valueFor(byId.get(id), "jump"), 0);
  const restrictedValue = () => [...state.chain, ...state.jump].reduce((sum, id) => sum + (byId.get(id).restricted ? valueFor(byId.get(id), state.chain.has(id) ? "chain" : "jump") : 0), 0);
  const isBlocked = (entry, scope) => (entry.conflicts ?? []).some((id) => scope === "chain" ? state.chain.has(id) : state.chain.has(id) || state.jump.has(id));

  const updateTotals = () => {
    const chain = chainValue(), single = jumpValue(), total = chain + single;
    full.querySelector("#uds-full-total").textContent = `${chain >= 0 ? "+" : ""}${chain} CP`;
    dialog.querySelector("#uds-dialog-total").textContent = `${total >= 0 ? "+" : ""}${total} CP`;
    dialog.querySelector("#uds-dialog-chain").textContent = `${chain >= 0 ? "+" : ""}${chain}`;
    dialog.querySelector("#uds-dialog-single").textContent = `${single >= 0 ? "+" : ""}${single}`;
    dialog.querySelector("#uds-dialog-restricted").textContent = String(restrictedValue());
    dialog.querySelector("#uds-dialog-count").textContent = String(state.chain.size + state.jump.size - state.hiatus.size);
    dialog.querySelector("#uds-budget-chain").textContent = String(chain);
    dialog.querySelector("#uds-budget-single").textContent = String(single);
    dialog.querySelector("#uds-budget-total").textContent = `${1000 + total} CP`;
    full.querySelector("#uds-full-total").classList.toggle("is-negative", chain < 0);
    dialog.querySelector("#uds-dialog-total").classList.toggle("is-negative", total < 0);
    full.querySelectorAll("[data-uds-category]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.udsCategory === state.category));
      const count = entries.filter((entry) => entry.category === button.dataset.udsCategory && state.chain.has(entry.id)).length;
      if (count) button.querySelector("small").textContent = `${count} selected`;
    });
  };

  const addRequirement = (entry, scope) => {
    if (!entry.requires || selected(entry.requires)) return;
    const requirement = byId.get(entry.requires);
    if (scope === "chain" && requirement.chain !== undefined) state.chain.add(requirement.id);
    else if (requirement.jump !== undefined) state.jump.add(requirement.id);
    addRequirement(requirement, scope);
  };
  const removeWithDependents = (id, scope) => {
    const collection = state[scope]; collection.delete(id); if (scope === "chain") state.hiatus.delete(id);
    entries.filter((entry) => entry.requires === id && collection.has(entry.id)).forEach((entry) => removeWithDependents(entry.id, scope));
  };
  const renderCatalog = () => {
    const [kicker, title, description] = categoryInfo[state.category];
    full.querySelector("#uds-category-kicker").textContent = kicker; full.querySelector("#uds-category-title").textContent = title; full.querySelector("#uds-category-description").textContent = description;
    const visible = entries.filter((entry) => entry.category === state.category && entry.chain !== undefined && (!state.search || `${entry.name} ${entry.description} ${entry.tags.join(" ")}`.toLocaleLowerCase().includes(state.search)) && (state.filter === "all" || (state.filter === "selected") === state.chain.has(entry.id)));
    const list = document.createElement("div"); list.className = "uds-card-list";
    visible.forEach((entry) => {
      const card = document.createElement("article"); card.className = "uds-card"; card.dataset.udsEntry = entry.id; card.classList.toggle("is-selected", state.chain.has(entry.id));
      const copy = document.createElement("div"); copy.className = "uds-card-copy"; copy.tabIndex = 0; const heading = document.createElement("div"); const name = document.createElement("strong"); name.textContent = entry.name; const award = document.createElement("b"); award.textContent = entry.chain ? `+${entry.chain} CP chain-wide` : "Special"; heading.append(name, award); const summary = document.createElement("span"); summary.textContent = entry.description; const tags = document.createElement("div"); tags.className = "uds-card-tags"; entry.tags.forEach((tag) => { const chip = document.createElement("em"); chip.textContent = tag; tags.append(chip); }); copy.append(heading, summary, tags);
      const actions = document.createElement("div"); actions.className = "uds-card-actions";
      const chain = document.createElement("button"); chain.type = "button"; chain.textContent = state.chain.has(entry.id) ? "Remove from chain" : "Add to chain"; chain.setAttribute("aria-pressed", String(state.chain.has(entry.id))); chain.classList.toggle("is-active", state.chain.has(entry.id)); chain.disabled = !state.chain.has(entry.id) && isBlocked(entry, "chain"); chain.title = chain.disabled ? "Unavailable because an incompatible Chain Drawback is active." : ""; chain.addEventListener("click", () => { if (state.chain.has(entry.id)) removeWithDependents(entry.id, "chain"); else { addRequirement(entry, "chain"); state.jump.delete(entry.id); state.chain.add(entry.id); } renderAll(); }); actions.append(chain);
      const toggle = () => { state.detail = state.detail === entry.id ? null : entry.id; renderCatalog(); }; copy.addEventListener("click", toggle); copy.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(); } }); card.append(copy, actions);
      if (state.detail === entry.id) { const detail = document.createElement("div"); detail.className = "uds-card-detail"; detail.innerHTML = `<strong>Current rule:</strong> ${entry.description}${entry.requires ? ` Requires ${byId.get(entry.requires).name}.` : ""}${entry.noHiatus ? " This entry cannot be put on hiatus." : ""}${entry.noRevoke ? " This entry cannot be revoked." : ""}`; card.append(detail); }
      list.append(card);
    });
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "uds-empty"; empty.textContent = "No drawbacks match this category and filter."; list.append(empty); }
    full.querySelector("#uds-catalog").replaceChildren(list); updateTotals();
  };

  const activeEntries = () => [...state.chain].map((id) => ({ entry: byId.get(id), scope: "chain" })).concat([...state.jump].map((id) => ({ entry: byId.get(id), scope: "jump" })));
  const renderJumpChooser = (container) => {
    const chooser = document.createElement("div"); chooser.className = "uds-jump-chooser";
    const label = document.createElement("label"); label.className = "uds-jump-search"; const caption = document.createElement("span"); caption.textContent = "Find a Single-Jump Drawback"; const search = document.createElement("input"); search.type = "search"; search.placeholder = "Name, effect, or restriction"; search.value = state.jumpSearch; label.append(caption, search); chooser.append(label);
    const list = document.createElement("div"); list.className = "uds-jump-choice-list";
    const visible = entries.filter((entry) => entry.jump !== undefined && !state.chain.has(entry.id));
    visible.forEach((entry) => { const row = document.createElement("article"); row.className = "uds-jump-choice"; row.classList.toggle("is-selected", state.jump.has(entry.id)); row.dataset.udsSearch = `${entry.name} ${entry.description} ${entry.tags.join(" ")}`.toLocaleLowerCase(); row.hidden = Boolean(state.jumpSearch && !row.dataset.udsSearch.includes(state.jumpSearch)); const copy = document.createElement("div"); const title = document.createElement("strong"); title.textContent = entry.name; const summary = document.createElement("span"); summary.textContent = entry.description; const meta = document.createElement("small"); meta.textContent = `${categoryInfo[entry.category][1]} · +${entry.jump} CP`; copy.append(title, summary, meta); const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = state.jump.has(entry.id) ? "Remove from this Jump" : "Add to this Jump"; toggle.setAttribute("aria-pressed", String(state.jump.has(entry.id))); toggle.classList.toggle("is-active", state.jump.has(entry.id)); toggle.disabled = !state.jump.has(entry.id) && isBlocked(entry, "jump"); toggle.title = toggle.disabled ? "Unavailable because an incompatible drawback is active." : ""; toggle.addEventListener("click", () => { if (state.jump.has(entry.id)) removeWithDependents(entry.id, "jump"); else { addRequirement(entry, "jump"); state.jump.add(entry.id); } renderAll(); }); row.append(copy, toggle); list.append(row); });
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "uds-empty"; empty.textContent = "No available Single-Jump Drawbacks match this search."; list.append(empty); }
    search.addEventListener("input", (event) => { state.jumpSearch = event.currentTarget.value.trim().toLocaleLowerCase(); list.querySelectorAll("[data-uds-search]").forEach((row) => { row.hidden = Boolean(state.jumpSearch && !row.dataset.udsSearch.includes(state.jumpSearch)); }); }); chooser.append(list); container.replaceChildren(chooser);
  };
  const renderDialog = () => {
    dialog.querySelectorAll("[data-uds-dialog-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.udsDialogFilter === state.dialogFilter)));
    const list = dialog.querySelector("#uds-active-effects");
    if (state.dialogFilter === "choose") { renderJumpChooser(list); dialog.querySelector("#uds-effect-detail").hidden = true; updateTotals(); return; }
    const effects = activeEntries().filter(({ scope }) => state.dialogFilter === "all" || state.dialogFilter === scope || state.dialogFilter === "conflict" && false);
    list.replaceChildren(...effects.map(({ entry, scope }) => {
      const row = document.createElement("article"); row.className = "uds-effect"; row.dataset.udsEffect = entry.id; const open = document.createElement("button"); open.type = "button"; open.className = "uds-effect-open"; const copy = document.createElement("span"); const title = document.createElement("strong"); title.textContent = entry.name; const summary = document.createElement("small"); summary.textContent = state.hiatus.has(entry.id) ? "On hiatus for Arcane Realms; effect resumes next Jump." : entry.description; copy.append(title, summary); const scopeChip = document.createElement("em"); scopeChip.textContent = scope === "chain" ? state.hiatus.has(entry.id) ? "Chain · hiatus" : "Chain" : "This Jump"; const value = document.createElement("b"); value.textContent = state.hiatus.has(entry.id) ? `${-2 * entry.chain} CP` : `+${valueFor(entry, scope)} CP`; open.append(copy, scopeChip, value); open.addEventListener("click", () => { dialog.querySelector("#uds-effect-detail-title").textContent = entry.name; dialog.querySelector("#uds-effect-detail-copy").textContent = `${entry.description} ${scope === "chain" ? entry.noRevoke ? "This Chain Drawback cannot be revoked." : "Revocation becomes available after eight active Jumps; Arcane Realms is Jump 2." : "This selection belongs only to Arcane Realms and counts against its drawback cap."}`; dialog.querySelector("#uds-effect-detail").hidden = false; }); row.append(open);
      if (scope === "chain") { const hiatus = document.createElement("div"); hiatus.className = "uds-hiatus"; const status = document.createElement("span"); status.textContent = entry.noHiatus ? "The source forbids hiatus for this entry." : state.hiatus.has(entry.id) ? "Hiatus recorded for Arcane Realms only." : `Hiatus changes this Jump’s balance by -${entry.chain * 3} CP.`; const button = document.createElement("button"); button.type = "button"; button.disabled = entry.noHiatus; button.textContent = state.hiatus.has(entry.id) ? "Resume here" : entry.noHiatus ? "No hiatus" : "Use hiatus"; button.setAttribute("aria-pressed", String(state.hiatus.has(entry.id))); button.addEventListener("click", () => { if (state.hiatus.has(entry.id)) state.hiatus.delete(entry.id); else state.hiatus.add(entry.id); renderAll(); }); hiatus.append(status, button); row.append(hiatus); }
      return row;
    }));
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "uds-empty"; empty.textContent = state.dialogFilter === "conflict" ? "No native or Universal Drawback conflicts were detected for Arcane Realms." : "No active effects in this filter."; list.append(empty); }
    dialog.querySelector("#uds-effect-detail").hidden = true; updateTotals();
  };
  const renderAll = () => { renderCatalog(); renderDialog(); };

  full.querySelector("#uds-category-nav").addEventListener("click", (event) => { const button = event.target.closest("[data-uds-category]"); if (!button) return; state.category = button.dataset.udsCategory; state.detail = null; renderCatalog(); });
  full.querySelector("#uds-search").addEventListener("input", (event) => { state.search = event.currentTarget.value.trim().toLocaleLowerCase(); renderCatalog(); });
  full.querySelectorAll("[data-uds-state-filter]").forEach((button) => button.addEventListener("click", () => { state.filter = button.dataset.udsStateFilter; full.querySelectorAll("[data-uds-state-filter]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button))); renderCatalog(); }));
  dialog.querySelectorAll("[data-uds-dialog-filter]").forEach((button) => button.addEventListener("click", () => { state.dialogFilter = button.dataset.udsDialogFilter; renderDialog(); }));
  dialog.querySelector("aside>button").addEventListener("click", () => full.scrollIntoView({ behavior: "smooth", block: "start" }));
  renderAll();
})();
