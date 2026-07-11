(() => {
  const full = document.querySelector(".reality-full-mock");
  const dialog = document.querySelector(".reality-dialog-mock");
  const progression = document.querySelector(".reality-progression-mock");
  if (!full || !dialog || !progression) return;

  const freeBasics = ["Cosmic Warehouse", "Boxes and Boxes and Boxes", "Access Key", "Starting Space", "Neutral Lighting", "Shelving", "Environmentally Neutral", "A Week & A Button", "Security System", "Loft", "Entrance Hall", "The Benefactor Lounge", "Cleaning Supplies", "Antibiotic Field"];
  const categories = {
    basics: { kicker: "Included foundation", title: "Basics", description: "Free features included with every Personal Reality, plus optional additional Realities.", entries: [
      ...freeBasics.map((name) => [name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-"), name, [0], `${name} is included with the starting Personal Reality.`, true]),
      ["second-reality", "Second Reality", [600], "Create a separate second Personal Reality with its own purchases and the same Limitations."],
    ] },
    utilities: { kicker: "Space-wide systems", title: "Utilities and structures", description: "Access, space, utilities, security, and time systems applied across the Reality.", entries: [
      ["additional-space", "Additional Space", [200, 400, 600], "Multiply each standard dimension by ten with every purchase."],
      ["discount-space", "Discount Additional Space", [100, 200, 300], "Multiply each dimension by three; two purchases count as one full expansion."],
      ["adaptive-storage", "Adaptive Inactive Storage", [200], "Create safe inactive storage for CP-backed possessions."],
      ["additional-keys", "Additional Keys", [50, 100, 150], "Add four attuned Personal Reality keys per purchase."],
      ["key-link", "Key Link", [50, 100, 150], "Link the Entry Hall to doors previously opened by an Access Key."],
      ["big-hole", "The Big Hole", [50], "Add a covered disposal opening into the limitless void."],
      ["lofty-loft", "Lofty Loft", [50], "Add a starting-space-sized area reserved for housing and luxury."],
      ["underside", "Underside", [100], "Allow basement spaces beneath the Lofty Loft."],
      ["playing-portals", "Playing With Portals", [300], "Open Personal Reality portals on suitable surfaces without relying on the Access Key."],
      ["portal-link", "Portal Link", [300], "Open portals from inside the Reality to previously visited places."],
      ["portal-control", "Portal Control Rod", [200], "Open portals at range with a summoned control device."],
      ["free-portal", "Free Portal", [100], "Open portals without a supporting surface and target any part of the Reality."],
      ["portal-aperture", "Portal Aperture", [100, 200, 300], "Expand portal size and opening speed."],
      ["power", "Who’s Got the Powa", [100], "Supply enough stable electricity for a major city."],
      ["pipes", "Pipes Pipes Pipes", [100], "Provide vast water, plumbing, and sewage capacity."],
      ["temporal-controls", "Temporal Controls", [200], "Change time flow while the owner is outside the Reality."],
      ["central-control", "Central Control", [100], "Install a pseudo-intelligent control and inventory system."],
    ] },
    cosmetic: { kicker: "Appearance and environment", title: "Cosmetic upgrades", description: "Change the presentation, ground, sky, lighting, and environmental theme.", entries: [
      ["sky-simulator", "Sky Simulator", [50], "Replace the ceiling with a simulated sky."], ["natural-lighting", "Natural Lighting", [50], "Provide realistic sun, moon, and star lighting."],
      ["treeline", "Treeline & Timber", [100], "Surround appropriate areas with a convincing forest boundary."], ["pond", "The Pond", [100], "Replace a wall with a configurable water feature."],
      ["ground-cover", "Realistic Ground Cover", [50], "Add natural-looking soil and ground cover."], ["basic-thematics", "Basic Thematics", [20, 40, 60], "Apply a coherent cosmetic theme to selected areas."],
      ["advanced-thematics", "Advanced Thematics", [100], "Make thematic presentation responsive and immersive."], ["theme-park", "Theme Park", [200], "Apply separate managed themes across the Reality."],
    ] },
    facilities: { kicker: "Rooms and shared spaces", title: "Personal Reality facilities", description: "Medical, residential, educational, recreational, and operational facilities.", entries: [
      ["medical-bay", "The Medical Bay", [100], "Treat medical and dental problems for living patients."], ["connecting-doors", "Connecting Doors", [20, 40, 60], "Add paired doors connecting two parts of the Reality."],
      ["housing-complex", "Housing Complex", [100], "Provide housing for the Jumper’s sapient retinue."], ["classroom", "A Classy Classroom", [10], "Add a well-equipped teaching space."],
      ["big-pool", "The Big Pool", [10], "Add an Olympic water park when plumbing is available."], ["entertainment-room", "Entertainment Room", [50], "Add rooms for passive media and relaxation."],
      ["arsenal", "Watch Your Arsenal", [200], "Add an organized armory for weapons and armor."], ["game-room", "I’m Game Room", [100], "Add networked gaming and tabletop facilities."],
      ["garage", "The Garage of the Gods", [200], "Add adaptive berths and maintenance for vehicles."], ["mall", "The Titan’s Mall", [100], "Add a mall with configurable shops."],
      ["greenhouse", "Guardian’s Greenhouse", [100], "Add a controlled greenhouse when water and power are available."],
    ] },
    extensions: { kicker: "Attached domains", title: "Personal Reality extensions", description: "Large additions that may sit inside or outside the primary Reality.", entries: [
      ["library", "The Library Jumpxandria", [100], "Add a protected library for writings collected across the chain."], ["starting-collection", "Starting Collection", [100, 150, 200], "Stock the Library with expected reference works."],
      ["parking-station", "Parking Station", [50], "Add vehicle parking and transport support."], ["village", "The Village", [300], "Add a populated settlement-scale extension."],
      ["small-multiverse", "It’s a Small Multiverse", [400], "Attach multiple themed pocket environments."], ["hollow-earth", "Hollow Earth", [500], "Create a vast internal world extension."],
    ] },
    items: { kicker: "Persistent supplies", title: "Items and equipment", description: "Supplies and collections maintained by the Personal Reality.", entries: [
      ["cleaning-supplies", "Cleaning Supplies", [0], "Provide unlimited ordinary cleaning supplies.", true], ["music-collection", "Music Collection", [50], "Maintain a broad collection of recorded music."],
      ["movie-collection", "Movie & TV Series Collection", [50], "Maintain a broad collection of recorded visual media."], ["printing-precious", "Printing Precious", [300], "Add specialized fabrication and printing machinery."],
      ["one-art", "One Art Please", [50, 100, 150], "Add chosen works of art to the Reality’s collection."],
    ] },
    companions: { kicker: "Retinue integration", title: "Companions and the Personal Reality", description: "Housing, grouping, calibration, and companion-focused Reality features.", entries: [
      ["calibration-unit", "Companion Calibration Unit", [300], "Calibrate eligible companions for imported forms and local conditions."], ["my-harem", "My Harem", [300], "Combine eligible lovers or spouses into shared companion slots."],
      ["all-your-peeps", "All Your Peeps", [50, 100, 150, 600], "Bring selected people from the Origin Reality or buy the unlimited plan."], ["podpanion", "Podpanion Support", [200], "Provide protected accommodation and support for pod-based companions."],
    ] },
    misc: { kicker: "Special rules and capabilities", title: "Miscellaneous", description: "Return visits, observation, imports, mini-realities, and unusual functionality.", entries: [
      ["happy-returns", "Many Happy Returns", [200], "Spend another ten years in a previously visited world on the source cadence."], ["eye-spy", "Eye Spy", [100], "Observe anything occurring inside the Personal Reality."],
      ["all-your-stuff", "All Your Stuff", [100], "Bring Origin Reality possessions and give them fiat backing."], ["mini-reality", "Personal Mini-Reality", [300], "Create a smaller personal domain connected to the main Reality."],
      ["dyson-shell", "Shell By Dyson", [500], "Convert a Personal Mini-Reality into a Dyson-scale system."],
    ] },
    limitations: { kicker: "Permanent complications", title: "Limitations", description: "Permanent restrictions that provide WP and override conflicting purchases.", entries: [
      ["crowd-scene", "Crowd Scene", [-50], "Fill the Reality with anonymous metropolitan crowds."], ["dangerous-wildlife", "Dangerous Wildlife", [-100], "Make wildlife inside the Reality actively antagonistic."],
      ["infestation", "Infestation", [-100], "Cause recurring colonies of adaptive vermin and pests."], ["air-fresheners", "Air Fresheners Needed", [-100], "Require regular airing or cleaning to control accumulated odors."],
      ["journeying-spirits", "Journeying Spirits", [-100], "Make recently departed spirits pass through the Reality."], ["warehouse-clock", "Warehouse Clock", [-100, -200], "Limit daily time inside the Reality."],
      ["unsecured", "Unsecured", [-200], "Allow sufficiently powerful or skilled outsiders to breach the Reality."], ["natural-disasters", "Natural Disasters", [-200], "Subject the Reality to recurring destructive disasters."],
      ["labyrinth", "The Labyrinth of Jumpnos", [-300], "Distribute purchases through a rearranging labyrinth."], ["never-twain", "Never the Twain Shall Meet", [-500], "Make the Reality virtual and prevent physical transfers."],
      ["big-benefactor", "Big Benefactor", [-500], "Turn the chain into pervasive entertainment with assigned challenges."], ["woods", "The Woods Are Lovely, Dark and Deep", [-1000], "Place the Reality in a hostile primeval forest; cannot be bought off."],
    ] },
  };
  Object.values(categories).forEach((category) => { category.entries = category.entries.map(([id, name, costs, description, included = false]) => ({ id, name, costs, description, included })); });
  const allEntries = new Map(Object.values(categories).flatMap((category) => category.entries.map((entry) => [entry.id, entry])));
  const state = {
    category: "setup", coreMode: "incremental", extraModes: new Set(), initialPurchases: new Map([["playing-portals", 1], ["power", 1], ["pipes", 1]]),
    jumpPurchases: new Map(), detail: null, dialogFilter: "space", progression: { award: false, conversionCP: 0, spendCategory: "utilities", spendSearch: "" },
  };
  const startingWP = { upfront: 1500, incremental: 500, unlimited: 0, reasonable: 3000, therehouse: 5000 };
  const entryCategory = (id) => Object.entries(categories).find(([, category]) => category.entries.some((entry) => entry.id === id))?.[0];
  const entryCost = (entry, tier) => !tier || entry.included ? 0 : entry.costs[tier - 1] ?? 0;
  const initialSpent = () => [...state.initialPurchases].reduce((sum, [id, tier]) => sum + entryCost(allEntries.get(id), tier), 0);
  const progressionSpent = () => [...state.jumpPurchases.values()].reduce((sum, purchase) => sum + purchase.cost, 0);
  const modeAward = () => state.progression.award && state.coreMode === "incremental" ? 50 : state.progression.award && state.coreMode === "reasonable" ? 100 : 0;
  const conversionWP = () => state.coreMode === "unlimited" ? state.progression.conversionCP : state.progression.conversionCP / 25;
  const initialBalance = () => startingWP[state.coreMode] - initialSpent();
  const currentBalance = () => initialBalance() + modeAward() + conversionWP() - progressionSpent();
  const ownedTier = (id) => state.jumpPurchases.get(id)?.tier ?? state.initialPurchases.get(id) ?? 0;
  const roman = (tier) => ["", "I", "II", "III", "IV", "V"][tier] ?? String(tier);

  const modeInfo = {
    upfront: ["Upfront", "1500 WP initially, three half-price purchase lines, and no later WP awards."],
    incremental: ["Incremental", "500 WP initially and a reversible 50 WP record for each Jump or Gauntlet."],
    unlimited: ["Unlimited", "0 WP initially and one conversion of up to 100 Jump CP into the same amount of WP."],
    reasonable: ["Reasonable", "3000 WP initially, 100 WP every fifth recorded Jump, and a 100 WP purchase cap."],
    therehouse: ["Therehouse", "5000 WP initially; the Reality becomes a physical location and grants 200 CP each Jump."],
  };
  const updateChrome = () => {
    const initial = initialBalance(), current = currentBalance();
    const output = full.querySelector("#reality-initial-balance"); output.textContent = `${initial} WP`; output.value = `${initial} WP`; output.classList.toggle("is-negative", initial < 0);
    const currentOutput = dialog.querySelector("#reality-current-balance"); currentOutput.textContent = String(current); currentOutput.classList.toggle("is-negative", current < 0);
    const [name, copy] = modeInfo[state.coreMode]; dialog.querySelector("#reality-dialog-mode").textContent = `${name} Mode`; dialog.querySelector("#reality-mode-mark").textContent = name.slice(0, 2).toUpperCase(); dialog.querySelector("#reality-mode-tooltip").textContent = `${name} Core Mode: ${copy}`;
    full.querySelectorAll("[data-reality-category]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.realityCategory === state.category)));
  };

  const renderSetup = (container) => {
    const grid = document.createElement("div"); grid.className = "reality-mode-grid";
    Object.entries(modeInfo).forEach(([id, [name, copy]]) => { const button = document.createElement("button"); button.type = "button"; button.dataset.realityMode = id; button.setAttribute("aria-pressed", String(state.coreMode === id)); const strong = document.createElement("strong"); strong.textContent = `${name} Core Mode`; const span = document.createElement("span"); span.textContent = copy; button.append(strong, span); button.addEventListener("click", () => { state.coreMode = id; state.progression.award = false; state.progression.conversionCP = 0; renderWorkspace(); renderProgression(); renderDialog(); }); grid.append(button); });
    const extra = document.createElement("section"); extra.className = "reality-extra-group"; const heading = document.createElement("h6"); heading.textContent = "Extra-Modes"; const list = document.createElement("div"); list.className = "reality-extra-list";
    [["patient", "The Patient Jumper", "Gain 100 WP for each eligible Jump after the first that adoption was delayed."], ["swap", "Swap-Out", "Replace an established Warehouse-family build under the source’s chain-length rules."], ["crossroads", "Cross-Roads", "Take one unpaid 100 CP drawback in a Jump to add 5 collective WP to the Crossroads Tavern."]].forEach(([id, name, copy]) => { const label = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.checked = state.extraModes.has(id); const text = document.createElement("span"); const strong = document.createElement("strong"); strong.textContent = name; const small = document.createElement("small"); small.textContent = copy; text.append(strong, small); label.append(input, text); input.addEventListener("change", () => { if (input.checked) state.extraModes.add(id); else state.extraModes.delete(id); }); list.append(label); }); extra.append(heading, list); container.append(grid, extra);
  };

  const renderInitialEntries = (container, category) => {
    const query = full.querySelector("#reality-search").value.trim().toLocaleLowerCase(); const list = document.createElement("div"); list.className = "reality-purchase-list";
    category.entries.filter((entry) => !query || `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(query)).forEach((entry) => {
      const tier = state.initialPurchases.get(entry.id) ?? (entry.included ? 1 : 0); const row = document.createElement("article"); row.className = "reality-purchase-row"; row.dataset.realityEntry = entry.id; row.classList.toggle("is-owned", tier > 0);
      const copy = document.createElement("div"); copy.className = "reality-purchase-copy"; copy.tabIndex = 0; const title = document.createElement("strong"); title.textContent = entry.name; const summary = document.createElement("span"); summary.textContent = entry.description; copy.append(title, summary);
      const select = document.createElement("select"); select.setAttribute("aria-label", `${entry.name} level`); const none = document.createElement("option"); none.value = "0"; none.textContent = "Not selected"; select.append(none); entry.costs.forEach((cost, index) => { const option = document.createElement("option"); option.value = String(index + 1); option.textContent = entry.included ? "Included" : entry.costs.length === 1 ? "Selected" : `Purchase ${index + 1}`; select.append(option); }); select.value = String(tier); if (entry.included) { select.disabled = true; select.value = "1"; }
      select.addEventListener("change", () => { const value = Number(select.value); if (value) state.initialPurchases.set(entry.id, value); else state.initialPurchases.delete(entry.id); renderWorkspace(); updateChrome(); renderDialog(); renderProgression(); });
      const cost = document.createElement("span"); cost.className = "reality-purchase-cost"; const amount = entryCost(entry, tier); cost.textContent = tier ? amount < 0 ? `+${Math.abs(amount)} WP` : amount ? `${amount} WP` : "Free" : "—";
      const toggle = () => { state.detail = state.detail === entry.id ? null : entry.id; renderWorkspace(); }; copy.addEventListener("click", toggle); copy.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(); } }); row.append(copy, select, cost); if (state.detail === entry.id) { const detail = document.createElement("div"); detail.className = "reality-purchase-detail"; detail.textContent = entry.description; row.append(detail); } list.append(row);
    });
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "reality-empty"; empty.textContent = "No entries match this search."; list.append(empty); } container.append(list);
  };
  const renderWorkspace = () => {
    const content = full.querySelector("#reality-workspace-content"); content.replaceChildren(); const search = full.querySelector("#reality-search-label"); search.hidden = state.category === "setup";
    if (state.category === "setup") { full.querySelector("#reality-category-kicker").textContent = "Starting rules"; full.querySelector("#reality-category-title").textContent = "Setup"; full.querySelector("#reality-category-description").textContent = "Choose one Core Mode and any compatible Extra-Modes."; renderSetup(content); }
    else { const category = categories[state.category]; full.querySelector("#reality-category-kicker").textContent = category.kicker; full.querySelector("#reality-category-title").textContent = category.title; full.querySelector("#reality-category-description").textContent = category.description; renderInitialEntries(content, category); }
    updateChrome();
  };

  const accumulatedEntries = () => { const result = new Map(state.initialPurchases); state.jumpPurchases.forEach((purchase, id) => result.set(id, purchase.tier)); return result; };
  const capabilityData = () => {
    const owned = accumulatedEntries(); const data = { space: [], facilities: [], services: [] };
    const add = (group, id, fallback) => { if (!owned.has(id) && !fallback) return; const entry = allEntries.get(id); data[group].push([entry?.name ?? fallback, entry?.description ?? `${fallback} is included with every Personal Reality.`, state.jumpPurchases.has(id) ? "Arcane Realms · Jump 2" : "Starting Reality"]); };
    add("space", "starting-space", "Starting Space"); add("space", "access-key", "Access Key"); add("space", "playing-portals"); add("space", "additional-space"); add("space", "lofty-loft"); add("services", "power"); add("services", "pipes"); add("services", "central-control"); add("facilities", "medical-bay"); add("facilities", "housing-complex"); add("facilities", "library"); add("facilities", "garage");
    return data;
  };
  const renderDialog = () => {
    const capabilities = capabilityData(); dialog.querySelectorAll("[data-reality-dialog-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.realityDialogFilter === state.dialogFilter)));
    const container = dialog.querySelector("#reality-dialog-capabilities"); container.replaceChildren(...capabilities[state.dialogFilter].map(([name, copy, provenance]) => { const button = document.createElement("button"); button.type = "button"; button.textContent = name; button.title = `${copy} Acquired: ${provenance}.`; button.setAttribute("aria-expanded", "false"); button.addEventListener("click", () => { container.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-expanded", String(candidate === button))); dialog.querySelector("#reality-dialog-detail-title").textContent = name; dialog.querySelector("#reality-dialog-detail-copy").textContent = `${copy} Acquired: ${provenance}.`; dialog.querySelector("#reality-dialog-detail").hidden = false; }); return button; }));
    if (!container.children.length) { const empty = document.createElement("p"); empty.className = "reality-empty"; empty.textContent = "No accumulated capabilities in this category."; container.append(empty); }
    const floor = dialog.querySelector("#reality-floorplan"); floor.replaceChildren(...[["Main Warehouse", "64,000 m³", "The free starting storage volume."], ["Entrance Hall", "Primary access", "The free controlled arrival area."], ...(accumulatedEntries().has("lofty-loft") ? [["Lofty Loft", "Housing area", allEntries.get("lofty-loft").description]] : [])].map(([name, label, copy]) => { const button = document.createElement("button"); button.type = "button"; button.title = copy; const strong = document.createElement("strong"); strong.textContent = name; const span = document.createElement("span"); span.textContent = label; button.append(strong, span); button.addEventListener("click", () => { dialog.querySelector("#reality-dialog-detail-title").textContent = name; dialog.querySelector("#reality-dialog-detail-copy").textContent = copy; dialog.querySelector("#reality-dialog-detail").hidden = false; }); return button; }));
    const ownedCount = accumulatedEntries().size + freeBasics.length; dialog.querySelector("#reality-current-upgrades").textContent = String(ownedCount); dialog.querySelector("#reality-current-access").textContent = accumulatedEntries().has("playing-portals") ? "Portals and key" : "Access Key"; dialog.querySelector("#reality-dialog-detail").hidden = true; updateChrome();
  };

  const renderProgressionPurchases = () => {
    const category = categories[state.progression.spendCategory]; const query = state.progression.spendSearch.trim().toLocaleLowerCase(); const container = progression.querySelector("#reality-progress-purchases");
    const visible = category.entries.filter((entry) => !entry.included && (!query || `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(query)));
    container.replaceChildren(...visible.map((entry) => { const record = state.jumpPurchases.get(entry.id); const currentTier = ownedTier(entry.id); const targetTier = record ? record.tier : currentTier + 1; const maximum = !record && targetTier > entry.costs.length; const cost = record ? record.cost : maximum ? 0 : Math.max(0, entryCost(entry, targetTier) - entryCost(entry, currentTier)); const capped = state.coreMode === "reasonable" && cost > 100;
      const row = document.createElement("article"); row.className = "reality-progress-purchase"; row.dataset.realityProgressEntry = entry.id; row.classList.toggle("is-acquired", Boolean(record)); const copy = document.createElement("div"); const title = document.createElement("strong"); title.textContent = `${entry.name}${targetTier ? ` ${roman(Math.min(targetTier, entry.costs.length))}` : ""}`; const summary = document.createElement("span"); summary.textContent = entry.description; const source = document.createElement("em"); source.textContent = record ? "Acquired in Arcane Realms · Jump 2" : maximum ? "Maximum purchase reached" : capped ? "Blocked by Reasonable Mode’s 100 WP cap" : `${cost} WP · next purchase`; copy.append(title, summary, source); const action = document.createElement("button"); action.type = "button"; if (record) action.textContent = "Remove"; else if (maximum) { action.textContent = "Maximum"; action.disabled = true; } else { action.textContent = `Buy · ${cost} WP`; action.disabled = capped || cost > currentBalance(); } action.addEventListener("click", () => { if (action.disabled) return; if (record) state.jumpPurchases.delete(entry.id); else state.jumpPurchases.set(entry.id, { tier: targetTier, cost, chainEntryId: "arcane-realms", label: "Arcane Realms · Jump 2" }); renderDialog(); renderProgression(); }); row.append(copy, action); return row; }));
    if (!container.children.length) { const empty = document.createElement("p"); empty.className = "reality-empty"; empty.textContent = "No purchasable entries match this search."; container.append(empty); }
  };
  const renderProgression = () => {
    const [name] = modeInfo[state.coreMode]; progression.querySelector("#reality-progress-mode").textContent = `${name} Core Mode`; const record = progression.querySelector("#reality-record-award"), copy = progression.querySelector("#reality-progress-award-copy");
    if (state.coreMode === "incremental") { record.disabled = false; record.textContent = state.progression.award ? "50 WP recorded" : "Record 50 WP"; record.setAttribute("aria-pressed", String(state.progression.award)); copy.textContent = "Incremental Mode makes 50 WP available for this Jump record."; }
    else if (state.coreMode === "reasonable") { record.disabled = true; record.textContent = "Not the 5th Jump"; record.setAttribute("aria-pressed", "false"); copy.textContent = "Reasonable Mode awards 100 WP only on each fifth eligible Jump; Arcane Realms is Jump 2."; }
    else { record.disabled = true; record.textContent = state.coreMode === "therehouse" ? "+200 CP rule" : "No WP award"; record.setAttribute("aria-pressed", "false"); copy.textContent = state.coreMode === "therehouse" ? "Therehouse adds 200 CP to the Jump ledger rather than WP." : `${name} Mode does not provide a per-Jump WP award.`; }
    const unlimited = state.coreMode === "unlimited"; progression.querySelector("#reality-conversion-copy").textContent = unlimited ? "Unlimited Mode converts up to 100 CP from this Jump into the same amount of WP." : "Outside Unlimited Mode, every 50 CP converts to 2 WP.";
    progression.querySelectorAll("[data-reality-conversion]").forEach((button) => { const cp = Number(button.dataset.realityConversion); button.setAttribute("aria-pressed", String(cp === state.progression.conversionCP)); const span = button.querySelector("span"); span.textContent = `${cp} CP · +${unlimited ? cp : cp / 25} WP`; });
    progression.querySelector("#reality-spend-category").value = state.progression.spendCategory; progression.querySelector("#reality-spend-search").value = state.progression.spendSearch;
    const award = modeAward(), converted = conversionWP(), spent = progressionSpent(), net = award + converted - spent; progression.querySelector("#reality-progress-net").textContent = `${net > 0 ? "+" : ""}${net} WP`; progression.querySelector("#reality-progress-award").textContent = `${award} WP`; progression.querySelector("#reality-progress-conversion").textContent = `${converted} WP`; progression.querySelector("#reality-progress-spent").textContent = `${spent} WP`; progression.querySelector("#reality-progress-cp").textContent = `${state.progression.conversionCP} CP`; progression.querySelector("#reality-progress-balance").textContent = `${currentBalance()} WP`; progression.querySelector("#reality-spend-available").textContent = `${currentBalance()} WP available`; renderProgressionPurchases(); updateChrome();
  };

  full.querySelector("#reality-category-nav").addEventListener("click", (event) => { const button = event.target.closest("[data-reality-category]"); if (!button) return; state.category = button.dataset.realityCategory; state.detail = null; full.querySelector("#reality-search").value = ""; renderWorkspace(); }); full.querySelector("#reality-search").addEventListener("input", renderWorkspace);
  dialog.querySelectorAll("[data-reality-dialog-filter]").forEach((button) => button.addEventListener("click", () => { state.dialogFilter = button.dataset.realityDialogFilter; renderDialog(); })); dialog.querySelector("aside>button").addEventListener("click", () => full.scrollIntoView({ behavior: "smooth", block: "start" }));
  progression.querySelector("#reality-record-award").addEventListener("click", () => { if (progression.querySelector("#reality-record-award").disabled) return; state.progression.award = !state.progression.award; renderProgression(); }); progression.querySelectorAll("[data-reality-conversion]").forEach((button) => button.addEventListener("click", () => { state.progression.conversionCP = Number(button.dataset.realityConversion); renderProgression(); })); progression.querySelector("#reality-spend-category").addEventListener("change", (event) => { state.progression.spendCategory = event.currentTarget.value; state.progression.spendSearch = ""; renderProgression(); }); progression.querySelector("#reality-spend-search").addEventListener("input", (event) => { state.progression.spendSearch = event.currentTarget.value; renderProgressionPurchases(); }); progression.querySelector("aside button").addEventListener("click", () => full.scrollIntoView({ behavior: "smooth", block: "start" }));
  renderWorkspace(); renderDialog(); renderProgression();
})();
