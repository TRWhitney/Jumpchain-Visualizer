(() => {
  const full = document.querySelector(".essential-full-mock");
  const dialog = document.querySelector(".essential-dialog-mock");
  const progression = document.querySelector(".essential-progression-mock");
  if (!full || !dialog || !progression) return;

  const essences = [
    ["warlord", "Warlord", "Lead armies, usually from the front."], ["scholar", "Scholar", "Pursue knowledge, common and obscure."],
    ["mad-doctor", "Mad Doctor", "Push medical knowledge beyond accepted limits."], ["crafter", "Crafter", "Build things both great and small."],
    ["assassin", "Assassin", "End lives with precision."], ["archmage", "Archmage", "Learn magic in all of its forms."],
    ["brute", "Brute", "Become a one-person force capable of defeating armies."], ["superior", "Superior", "Stretch human limits through internal and acquired power."],
    ["lich", "Lich", "Transcend death to continue magical study."], ["vampire", "Vampire", "Transcend death by draining life from others."],
    ["shapeshifter", "Shapeshifter", "Transcend one mortal form by taking others."], ["king", "King", "Rule a nation of sentient beings or more."],
    ["beast", "Beast", "Become an inhuman creature."], ["dragon", "Dragon", "Become a dragon."],
    ["explorer", "Explorer", "Discover new places and ideas."], ["healer", "Healer", "Mend the injuries of others."],
    ["elemental", "Elemental", "Become one with an element."], ["druid", "Druid", "Harness the power of nature."],
  ].map(([id, name, description]) => ({ id, name, description }));

  const categories = {
    basic: { kicker: "Available to everyone", title: "Basic perks", description: "Free refinements and interface options that cannot be discounted.", perks: [
      ["basic-refinements", "Basic Refinements", [0], "Cosmetic, physical, mental, spiritual, and secondary-power refinements.", true],
      ["interface", "The Interface", [0], "Choose optional character, status, party, quest, timer, help, and notification windows."],
    ] },
    physical: { kicker: "Base-form catalog", title: "Physical perks", description: "Physical capabilities remain available in Gauntlets.", perks: [
      ["physical-perfection", "Physical Perfection", [50, 100, 200], "Improves all physical performance from peak human through five times peak."],
      ["physical-resilience", "Physical Resilience", [50, 100, 200], "Provides escalating immunity to disease, toxins, radiation, and injury."],
      ["reduced-sustenance", "Reduced Sustenance", [50, 100, 200], "Progressively reduces and broadens ordinary food and drink requirements."],
      ["environmental-tolerance", "Environmental Tolerance", [50, 100], "Protects against breathing, temperature, pressure, and vacuum hazards."],
      ["regeneration", "Regeneration", [100, 200], "Accelerates recovery from minor wounds through severed limbs."],
      ["ageless", "Ageless", [50, 100], "Extends lifespan or stops aging after physical maturity."],
      ["undead-physiology", "Undead Physiology", [50, 100, 200, 400, 600], "Creates an undead base physiology with higher tiers funding associated abilities."],
      ["elemental-physiology", "Elemental Physiology", [50, 100, 200, 400, 600], "Creates an elemental physiology tied to a chosen element."],
      ["creature-soul", "Creature Soul", [50, 100, 200, 400, 600], "Manifests and eventually assumes a chosen creature form."],
    ] },
    mental: { kicker: "Base-form catalog", title: "Mental perks", description: "Senses, reactions, cognition, resistance, empathy, and presence.", perks: [
      ["heightened-senses", "Heightened Senses", [50, 100], "Improves the range and precision of ordinary senses."],
      ["heightened-reactions", "Heightened Reactions", [50, 100], "Accelerates reaction time and develops danger awareness."],
      ["mental-prowess", "Mental Prowess", [50, 100, 200], "Improves memory, processing, concentration, and mental endurance."],
      ["mental-resistance", "Mental Resistance", [50, 100, 200], "Resists mental influence and hostile alteration."],
      ["blank", "Blank", [100, 200], "Blocks supernatural observation of personal information and history."],
      ["empathetic", "Empathetic", [50, 100], "Improves awareness and understanding of others’ emotions."],
      ["charismatic", "Charismatic", [50, 100], "Improves personal presence and social influence."],
    ] },
    spiritual: { kicker: "Base-form catalog", title: "Spiritual perks", description: "Soul, corruption, resolve, and supernatural-resource resilience.", perks: [
      ["wild-empathy", "Wild Empathy", [50, 100], "Understand and influence animals and other non-sapient creatures."],
      ["unflappable", "Unflappable", [50], "Maintain composure under pressure and supernatural circumstances."],
      ["corruption-resistance", "Corruption Resistance", [100], "Resist effects that corrupt the body, mind, or soul."],
      ["inertia-of-self", "Inertia of Self", [100, 200], "Preserve identity against unwanted metaphysical change."],
      ["resource-recovery", "Supernatural Resource Recovery", [50, 100, 200, 400], "Accelerates recovery of magical and other non-physical resources."],
    ] },
    skills: { kicker: "Base-form catalog", title: "Skill perks", description: "Broad mastery categories with four learning tiers.", perks: [
      ["strategic-mastery", "Strategic Mastery", [50, 100, 200, 400], "Learn strategy and tactics from familiarity through mastery."],
      ["leadership-mastery", "Leadership Mastery", [50, 100, 200, 400], "Learn command, administration, and organizational leadership."],
      ["martial-mastery", "Martial Mastery", [50, 100, 200, 400], "Learn armed and unarmed combat disciplines."],
      ["scientific-mastery", "Scientific Mastery", [50, 100, 200, 400], "Learn scientific disciplines encountered across the chain."],
      ["engineering-mastery", "Engineering Mastery", [50, 100, 200, 400], "Learn design, construction, and maintenance disciplines."],
      ["biomedical-mastery", "Biomedical Mastery", [50, 100, 200, 400], "Learn medicine and biological sciences."],
      ["occult-mastery", "Occult Mastery", [50, 100, 200, 400], "Learn occult lore and practices."],
      ["subterfuge-mastery", "Subterfuge Mastery", [50, 100, 200, 400], "Learn stealth, infiltration, and deception."],
      ["social-mastery", "Social Mastery", [50, 100, 200, 400], "Learn social interaction and cultural navigation."],
      ["wilderness-mastery", "Wilderness Mastery", [50, 100, 200, 400], "Learn survival and wilderness disciplines."],
      ["polyglot", "Polyglot", [50], "Quickly understand and learn encountered languages."],
    ] },
    supernatural: { kicker: "Outside the Gauntlet baseline", title: "Supernatural abilities", description: "These purchases do not function in Gauntlets under the source rules.", perks: [
      ["form-mastery", "Form Mastery", [100, 200, 400], "Improves control, access, and combination of alternate forms."],
      ["morphic-form", "Morphic Form", [100, 200, 400], "Allows increasingly extensive shapeshifting."],
      ["energy-projection", "Energy Projection", [100, 200, 400, 600], "Projects a selected form of damaging energy."],
      ["kinesis", "Kinesis", [100, 200, 400, 600], "Manipulates a selected material or force at increasing scale."],
      ["flight", "Flight", [100, 200, 400, 600], "Provides increasingly fast atmospheric flight."],
      ["inventory", "Inventory", [100, 200, 400, 600], "Creates personal extradimensional item storage."],
      ["power-toggle", "Power Toggle", [100], "Suppresses or restores owned abilities and their visible effects."],
      ["power-combination", "Power Combination", [100, 200, 400], "Combines compatible abilities into unified expressions."],
      ["private-reality", "Private Reality", [600], "Creates a personal extradimensional reality."],
      ["cheat-death", "Cheat Death", [200, 400], "Provides limited methods of returning from death."],
      ["healing-touch", "Healing Touch", [100, 200, 400, 600], "Heals others with escalating speed and scope."],
      ["divinity", "Divinity", [600], "Establishes a divine portfolio and metaphysical authority."],
    ] },
    items: { kicker: "Persistent equipment", title: "Item perks", description: "Fiat protection, integration, annexation, and import behavior.", perks: [
      ["essence-infusion-item", "Essence Infusion", [100], "Give one non-CP item fiat protection and reliable return."],
      ["essence-integration", "Essence Integration", [100], "Treat implanted technology or magitech as part of the base form."],
      ["essential-annexation", "Essential Annexation", [100, 200, 400, 600], "Attach increasingly large owned properties to a persistent space."],
      ["essential-item", "Essential Item", [100], "Allow one item to import into future settings at an appropriate local level."],
    ] },
    companions: { kicker: "Companion integration", title: "Companion perks", description: "Transfer EP and extend Essential Body Modification benefits to companions.", perks: [
      ["essence-transfer", "Essence Transfer", [50, 100, 200, 400], "Transfer a chosen amount of EP to an eligible companion."],
      ["essence-link", "Essence Link", [100, 200], "Give a companion scaling EP and eventual Essence access."],
      ["essential-companion", "Essential Companion", [100], "Provide persistent import and Gauntlet protections to one companion."],
    ] },
    drawbacks: { kicker: "Chain-long complications", title: "Drawbacks", description: "Selected drawbacks provide EP and persist wherever they reasonably apply.", perks: [
      ["dependency", "Dependency", [-100], "Require regular access to a specific substance."],
      ["standout", "Standout", [-100, -200, -300], "Become increasingly noticeable, unnerving, or provocative."],
      ["unnatural-presence", "Unnatural Presence", [-100], "Cause an unmistakable supernatural impression."],
      ["elemental-vulnerability", "Elemental Vulnerability", [-100, -200], "Suffer an escalating weakness to a selected element."],
      ["vulnerability", "Vulnerability", [-100, -200], "Suffer an escalating weakness to a selected substance."],
      ["achilles-heel", "Achilles Heel", [-100], "Retain a vulnerable point that determined enemies may reach."],
      ["lovable-goof", "Lovable Goof", [-100], "Lose access to social enhancement perks in exchange for awkward charm."],
      ["compulsions", "Compulsions", [-100], "Accept several minor compulsions or one major compulsion."],
      ["softhearted", "Softhearted", [-100], "Become unusually susceptible to requests for help."],
      ["form-locked", "Form Locked", [-100, -200], "Restrict supplement abilities to selected forms."],
      ["wardrobe-malfunction", "Wardrobe Malfunction", [-100, -200], "Make shapeshifting unreliable around clothing."],
    ] },
  };
  Object.values(categories).forEach((category) => {
    category.perks = category.perks.map(([id, name, costs, description, included = false]) => ({ id, name, costs, description, included }));
  });

  const state = {
    category: "setup", start: "standard", essenceMode: "single", advancement: "standard", access: "standard", limiter: "none",
    variants: new Set(), essences: new Set(["warlord"]), initialPurchases: new Map([["physical-perfection", 2]]), jumpPurchases: new Map(),
    detail: null, essenceDetail: "warlord", dialogFilter: "base",
    progression: { advancementApplied: false, infusion: "none", quests: new Set(), spendCategory: "physical", spendSearch: "" },
  };
  const startingEP = { heroic: 500, standard: 100, hardcore: 0 };
  const grantedByWarlord = new Map([["physical-perfection", 1], ["physical-resilience", 1], ["heightened-senses", 1], ["heightened-reactions", 1], ["mental-prowess", 1], ["mental-resistance", 1], ["strategic-mastery", 1], ["leadership-mastery", 1], ["martial-mastery", 1]]);
  const allPerks = new Map(Object.values(categories).flatMap((category) => category.perks.map((perk) => [perk.id, perk])));

  const essenceLimit = () => state.essenceMode === "none" ? 0 : state.essenceMode === "single" ? 1 : state.essenceMode === "dual" ? 2 : 3;
  const noEssenceBonus = () => state.essenceMode === "none" ? ({ heroic: 500, standard: 400, hardcore: 250 }[state.start]) : 0;
  const isDiscounted = (perkId) => state.essences.has("warlord") && ["physical-perfection", "physical-resilience", "regeneration", "heightened-senses", "heightened-reactions", "mental-prowess", "mental-resistance", "strategic-mastery", "leadership-mastery", "martial-mastery"].includes(perkId);
  const grantedTier = (perkId) => state.essences.has("warlord") ? (grantedByWarlord.get(perkId) ?? 0) : 0;
  const perkCost = (perk, tier) => {
    if (!tier || perk.included || tier <= grantedTier(perk.id)) return 0;
    const cost = perk.costs[tier - 1] ?? 0;
    if (cost < 0) return cost;
    return isDiscounted(perk.id) ? (cost === 50 ? 0 : cost / 2) : cost;
  };
  const initialSpentEP = () => [...state.initialPurchases].reduce((sum, [id, tier]) => sum + perkCost(allPerks.get(id), tier), 0);
  const progressionSpentEP = () => [...state.jumpPurchases.values()].reduce((sum, purchase) => sum + purchase.cost, 0);
  const advancementEP = () => state.advancement === "heroic" && state.progression.advancementApplied ? 50
    : state.advancement === "meteoric" && state.progression.advancementApplied ? 100
      : state.advancement === "questing" ? [...state.progression.quests].reduce((sum, value) => sum + value, 0) : 0;
  const infusionEP = () => state.progression.infusion === "lesser" ? 50 : state.progression.infusion === "greater" ? 100 : 0;
  const infusionCP = () => state.progression.infusion === "lesser" ? 50 : state.progression.infusion === "greater" ? 100 : 0;
  const initialBalance = () => startingEP[state.start] + noEssenceBonus() - initialSpentEP();
  const currentBalance = () => initialBalance() + advancementEP() + infusionEP() - progressionSpentEP();
  const ownedTier = (perkId) => state.jumpPurchases.get(perkId)?.tier ?? state.initialPurchases.get(perkId) ?? grantedTier(perkId);

  const descriptions = {
    base: [
      ["Physical Resilience I", "Immune to common disease, parasites, bacteria, toxins, and degenerative radiation."],
      ["Heightened Senses I", "Healthy senses operate at the peak of ordinary human performance."], ["Heightened Reactions I", "Peak-human reactions and coordination."],
      ["Mental Prowess I", "Peak-human memory, concentration, and mental endurance."], ["Mental Resistance I", "A baseline defense against hostile mental influence."],
    ],
    skills: [["Strategic Mastery I", "Immediate familiarity with strategy and half normal learning time."], ["Leadership Mastery I", "Immediate familiarity with leadership disciplines."], ["Martial Mastery I", "Immediate familiarity with encountered martial disciplines."]],
    supernatural: [],
  };
  const updateChrome = () => {
    const startingValue = initialBalance();
    const value = currentBalance();
    const output = full.querySelector("#essential-balance");
    output.textContent = `${startingValue} EP`;
    output.value = `${startingValue} EP`;
    output.classList.toggle("is-negative", startingValue < 0);
    const dialogBalance = dialog.querySelector("#essential-dialog-balance");
    dialogBalance.textContent = String(value);
    dialogBalance.classList.toggle("is-negative", value < 0);
    const selected = [...state.essences].map((id) => essences.find((essence) => essence.id === id)?.name).filter(Boolean);
    dialog.querySelector("aside h5").textContent = selected.length ? `${selected.join(" + ")} Essence` : "No Essence";
    dialog.querySelector(".essential-dialog-mark").textContent = selected.length ? selected.map((name) => name[0]).join("") : "—";
    const selectedEssences = [...state.essences].map((id) => essences.find((essence) => essence.id === id)).filter(Boolean);
    dialog.querySelector("#essential-essence-tooltip").textContent = selectedEssences.length
      ? `${selectedEssences.map((essence) => `Essence of the ${essence.name}: ${essence.description}`).join(" ")} Marked perks receive a 50% discount, and discounted 50 EP perks become free.`
      : "No Essence is selected; the starting EP bonus for No Essence applies.";
    dialog.querySelector("aside > span").textContent = `${state.advancement[0].toUpperCase() + state.advancement.slice(1)} progression`;
    dialog.querySelectorAll("aside dd")[0].textContent = state.start[0].toUpperCase() + state.start.slice(1);
    dialog.querySelectorAll("aside dd")[1].textContent = state.advancement[0].toUpperCase() + state.advancement.slice(1);
    dialog.querySelectorAll("aside dd")[2].textContent = state.access[0].toUpperCase() + state.access.slice(1);
    full.querySelectorAll("#essential-category-nav button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.essentialCategory === state.category)));
  };

  const romanTier = (tier) => ["", "I", "II", "III", "IV", "V"][tier] ?? String(tier);
  const categoryForPerk = (perkId) => Object.entries(categories).find(([, category]) => category.perks.some((perk) => perk.id === perkId))?.[0];

  const field = (title, id, options, description) => {
    const label = document.createElement("label"); label.className = "essential-mode-field";
    const heading = document.createElement("span"); heading.textContent = title;
    const select = document.createElement("select"); select.id = id;
    options.forEach(([value, name]) => { const option = document.createElement("option"); option.value = value; option.textContent = name; select.append(option); });
    const copy = document.createElement("p"); copy.textContent = description;
    label.append(heading, select, copy); return { label, select };
  };
  const renderSetup = (container) => {
    const grid = document.createElement("div"); grid.className = "essential-setup-grid";
    const fields = [
      ["Starting Mode", "start", [["heroic", "Heroic · 500 EP"], ["standard", "Standard · 100 EP"], ["hardcore", "Hardcore · 0 EP"]], "Sets the initial EP pool."],
      ["Essence Mode", "essenceMode", [["single", "Single Essence"], ["dual", "Dual Essence"], ["multi", "Multi-Essence"], ["none", "No Essence"]], "Controls how many Essences may be selected."],
      ["Advancement Mode", "advancement", [["standard", "Standard"], ["heroic", "Heroic · 50 EP per Jump"], ["meteoric", "Meteoric · 100 EP per Jump"], ["questing", "Questing"]], "Controls EP gained as the chain advances."],
      ["EP Access Mode", "access", [["standard", "Standard Access"], ["lesser", "Lesser Access"], ["none", "No Access"]], "Controls access to EP-granting Jump purchases."],
      ["Limiter", "limiter", [["none", "None"], ["everyday", "Everyday Hero"], ["street", "Street Level"], ["mid", "Mid Level"], ["bodymod", "Body Mod"], ["scaling-1", "Scaling I"], ["scaling-2", "Scaling II"], ["vanishing", "Vanishing"]], "Restricts the cost or category of available purchases."],
    ].map(([title, key, options, description]) => ({ key, ...field(title, `essential-${key}`, options, description) }));
    fields.forEach(({ key, label, select }) => {
      select.value = state[key];
      select.addEventListener("change", () => {
        state[key] = select.value;
        if (key === "essenceMode") while (state.essences.size > essenceLimit()) state.essences.delete([...state.essences].pop());
        if (key === "advancement" && !["heroic", "meteoric"].includes(state.advancement)) state.progression.advancementApplied = false;
        if (key === "access" && state.access === "lesser" && state.progression.infusion === "greater") state.progression.infusion = "none";
        if (key === "access" && state.access === "none") state.progression.infusion = "none";
        updateChrome(); renderProgression();
      });
      grid.append(label);
    });
    const variants = document.createElement("section"); variants.className = "essential-setup-group";
    const heading = document.createElement("h6"); heading.textContent = "Variants and access modifiers";
    const list = document.createElement("div"); list.className = "essential-toggle-list";
    [["cumulative", "Cumulative access", "Bank unused EP-purchase opportunities."], ["retroactive", "Retroactive cumulative", "Count qualifying Jumps completed before enabling this supplement."], ["training", "Training allowance", "Train base-form ranks when Standard Advancement and No Access are selected."], ["tempered", "Tempered by Suffering", "Receive EP for qualifying Gauntlets completed before adoption."]].forEach(([id, name, copy]) => {
      const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = state.variants.has(id);
      const text = document.createElement("span"); const strong = document.createElement("strong"); strong.textContent = name; const small = document.createElement("small"); small.textContent = copy; text.append(strong, small); label.append(checkbox, text);
      checkbox.addEventListener("change", () => { if (checkbox.checked) state.variants.add(id); else state.variants.delete(id); renderProgression(); }); list.append(label);
    });
    variants.append(heading, list); container.append(grid, variants);
  };

  const renderEssences = (container) => {
    const grid = document.createElement("div"); grid.className = "essential-essence-grid";
    essences.forEach((essence) => {
      const button = document.createElement("button"); button.type = "button"; button.dataset.essentialEssence = essence.id; button.setAttribute("aria-pressed", String(state.essences.has(essence.id)));
      const strong = document.createElement("strong"); strong.textContent = essence.name; const small = document.createElement("small"); small.textContent = essence.description; button.append(strong, small);
      button.addEventListener("click", () => {
        state.essenceDetail = essence.id;
        if (state.essences.has(essence.id)) state.essences.delete(essence.id);
        else if (essenceLimit() === 1) { state.essences.clear(); state.essences.add(essence.id); }
        else if (state.essences.size < essenceLimit()) state.essences.add(essence.id);
        renderWorkspace(); updateChrome(); renderDialog();
      }); grid.append(button);
    });
    const detailEssence = essences.find((essence) => essence.id === state.essenceDetail);
    const detail = document.createElement("div"); detail.className = "essential-essence-detail";
    const title = document.createElement("strong"); title.textContent = `Essence of the ${detailEssence.name}`;
    const copy = document.createElement("p"); copy.textContent = `${detailEssence.description} It discounts every source perk marked for this Essence by 50%; a discounted 50 EP perk becomes free. In Single Essence Mode, choosing it replaces the current Essence.`;
    detail.append(title, copy); container.append(grid, detail);
  };

  const renderPerks = (container, category) => {
    const query = full.querySelector("#essential-search").value.trim().toLocaleLowerCase();
    const list = document.createElement("div"); list.className = "essential-perk-list";
    category.perks.filter((perk) => !query || `${perk.name} ${perk.description}`.toLocaleLowerCase().includes(query)).forEach((perk) => {
      const tier = state.initialPurchases.get(perk.id) ?? (perk.included ? 1 : grantedTier(perk.id));
      const row = document.createElement("article"); row.className = "essential-perk-row"; row.dataset.essentialPerk = perk.id; row.classList.toggle("is-owned", tier > 0);
      const copy = document.createElement("div"); copy.className = "essential-perk-copy"; copy.tabIndex = 0;
      const name = document.createElement("strong"); name.textContent = perk.name; const summary = document.createElement("span"); summary.textContent = perk.description;
      copy.append(name); if (isDiscounted(perk.id)) { const badge = document.createElement("em"); badge.textContent = "Essence discount"; copy.append(badge); }
      copy.append(summary);
      const select = document.createElement("select"); select.setAttribute("aria-label", `${perk.name} tier`); const none = document.createElement("option"); none.value = "0"; none.textContent = "Not selected"; select.append(none);
      perk.costs.forEach((cost, index) => { const option = document.createElement("option"); option.value = String(index + 1); option.textContent = perk.included ? "Included" : perk.costs.length === 1 ? "Selected" : `Tier ${["I", "II", "III", "IV", "V"][index]}`; select.append(option); });
      select.value = String(tier);
      if (perk.included || grantedTier(perk.id)) select.querySelector(`option[value="${Math.max(1, grantedTier(perk.id))}"]`)?.setAttribute("disabled", "");
      select.addEventListener("change", () => {
        const value = Number(select.value);
        if (value) state.initialPurchases.set(perk.id, value);
        else state.initialPurchases.delete(perk.id);
        renderWorkspace(); updateChrome(); renderDialog();
      });
      const cost = document.createElement("span"); cost.className = "essential-perk-cost"; const amount = perkCost(perk, tier); cost.textContent = tier ? amount < 0 ? `+${Math.abs(amount)} EP` : amount ? `${amount} EP` : "Free" : "—";
      const toggle = () => { state.detail = state.detail === perk.id ? null : perk.id; renderWorkspace(); };
      copy.addEventListener("click", toggle); copy.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
      row.append(copy, select, cost);
      if (state.detail === perk.id) { const detail = document.createElement("div"); detail.className = "essential-perk-detail"; detail.textContent = perk.description; row.append(detail); }
      list.append(row);
    });
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "essential-empty"; empty.textContent = "No entries match this search."; list.append(empty); }
    container.append(list);
  };

  const renderWorkspace = () => {
    const content = full.querySelector("#essential-workspace-content"); content.replaceChildren();
    const searchLabel = full.querySelector("#essential-search-label"); searchLabel.hidden = ["setup", "essences"].includes(state.category);
    if (state.category === "setup") {
      full.querySelector("#essential-category-kicker").textContent = "Build rules"; full.querySelector("#essential-category-title").textContent = "Setup"; full.querySelector("#essential-category-description").textContent = "Choose the four permanent Modes, optional variants, and a limiter."; renderSetup(content);
    } else if (state.category === "essences") {
      full.querySelector("#essential-category-kicker").textContent = "Discount paths"; full.querySelector("#essential-category-title").textContent = "Essences"; full.querySelector("#essential-category-description").textContent = "Your Essence Mode controls how many may be selected."; renderEssences(content);
    } else {
      const category = categories[state.category]; full.querySelector("#essential-category-kicker").textContent = category.kicker; full.querySelector("#essential-category-title").textContent = category.title; full.querySelector("#essential-category-description").textContent = category.description; renderPerks(content, category);
    }
    updateChrome();
  };

  const renderDialog = () => {
    const selectedEssence = essences.find((essence) => state.essences.has(essence.id));
    const essenceDescriptions = selectedEssence?.id === "warlord" ? descriptions : selectedEssence?.id === "scholar" ? {
      base: [["Mental Prowess I", "Peak-human memory, concentration, and mental endurance."], ["Mental Resistance I", "A baseline defense against hostile mental influence."], ["Empathetic I", "Improved awareness of others’ emotional states."]],
      skills: [["Strategic Mastery I", "Immediate familiarity with strategy."], ["Scientific Mastery I", "Immediate familiarity with encountered sciences."], ["Engineering Mastery I", "Immediate familiarity with engineering disciplines."], ["Biomedical Mastery I", "Immediate familiarity with medicine and biology."], ["Occult Mastery I", "Immediate familiarity with occult practices."], ["Polyglot", "Rapidly understand and learn encountered languages."]],
      supernatural: [["Trivial Applications", "Use supernatural abilities for harmless convenience and cosmetic effects."]],
    } : {
      base: selectedEssence ? [[`Essence of the ${selectedEssence.name}`, selectedEssence.description]] : [], skills: [], supernatural: [],
    };
    const dialogDescriptions = Object.fromEntries(Object.entries(essenceDescriptions).map(([key, entries]) => [key, entries.map((entry) => [...entry])]));
    const ownedPurchases = new Map(state.initialPurchases);
    state.jumpPurchases.forEach((purchase, perkId) => ownedPurchases.set(perkId, purchase.tier));
    ownedPurchases.forEach((tier, perkId) => {
      const perk = allPerks.get(perkId);
      if (!perk) return;
      const destination = categoryForPerk(perkId) === "skills" ? "skills" : categoryForPerk(perkId) === "supernatural" ? "supernatural" : "base";
      dialogDescriptions[destination] = dialogDescriptions[destination].filter(([name]) => !name.startsWith(perk.name));
      const provenance = state.jumpPurchases.has(perkId) ? "Arcane Realms · Jump 2" : "Initial build";
      dialogDescriptions[destination].push([`${perk.name} ${romanTier(tier)}`, perk.description, provenance]);
    });
    dialog.querySelectorAll("[data-essential-dialog-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.essentialDialogFilter === state.dialogFilter)));
    const list = dialog.querySelector("#essential-dialog-abilities"); list.replaceChildren(...dialogDescriptions[state.dialogFilter].map(([name, description, provenance]) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = name; button.title = provenance ? `${description} Acquired: ${provenance}.` : description; button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", () => {
        list.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-expanded", String(candidate === button)));
        dialog.querySelector("#essential-dialog-detail-title").textContent = name; dialog.querySelector("#essential-dialog-detail-copy").textContent = provenance ? `${description} Acquired: ${provenance}.` : description; dialog.querySelector("#essential-dialog-detail").hidden = false;
      }); return button;
    }));
    if (!dialogDescriptions[state.dialogFilter].length) { const empty = document.createElement("p"); empty.className = "essential-empty"; empty.textContent = state.dialogFilter === "supernatural" ? "No Supernatural abilities purchased." : "No abilities in this category."; list.append(empty); }
    dialog.querySelector("#essential-dialog-detail").hidden = true; updateChrome();
  };

  const renderProgressionPurchases = () => {
    const container = progression.querySelector("#essential-progress-purchases");
    const category = categories[state.progression.spendCategory];
    const query = state.progression.spendSearch.trim().toLocaleLowerCase();
    const visiblePerks = category.perks.filter((perk) => !query || `${perk.name} ${perk.description}`.toLocaleLowerCase().includes(query));
    container.replaceChildren(...visiblePerks.map((perk) => {
      const perkId = perk.id;
      const record = state.jumpPurchases.get(perkId);
      const initialTier = state.initialPurchases.get(perkId) ?? grantedTier(perkId);
      const currentTier = ownedTier(perkId);
      const acquired = Boolean(record);
      const targetTier = acquired ? record.tier : currentTier + 1;
      const atMaximum = !acquired && targetTier > perk.costs.length;
      const cost = acquired ? record.cost : atMaximum ? 0 : Math.max(0, perkCost(perk, targetTier) - perkCost(perk, currentTier));
      const row = document.createElement("article"); row.className = "essential-progress-purchase"; row.dataset.essentialProgressPerk = perkId; row.classList.toggle("is-acquired", acquired);
      const copy = document.createElement("div"); const title = document.createElement("strong"); title.textContent = `${perk.name}${targetTier ? ` ${romanTier(Math.min(targetTier, perk.costs.length))}` : ""}`;
      const summary = document.createElement("span"); summary.textContent = perk.description;
      const source = document.createElement("em"); source.textContent = acquired ? "Acquired in Arcane Realms · Jump 2" : atMaximum ? `Maximum tier owned · ${initialTier ? "starting build" : "progression"}` : `${cost} EP · next tier`;
      copy.append(title, summary, source);
      const action = document.createElement("button"); action.type = "button";
      if (acquired) action.textContent = "Remove";
      else if (atMaximum) { action.textContent = "Maximum"; action.disabled = true; }
      else { action.textContent = `Buy · ${cost} EP`; action.disabled = cost > currentBalance(); }
      action.addEventListener("click", () => {
        if (action.disabled) return;
        if (acquired) state.jumpPurchases.delete(perkId);
        else state.jumpPurchases.set(perkId, { tier: targetTier, cost, chainEntryId: "arcane-realms", label: "Arcane Realms · Jump 2" });
        renderDialog(); renderProgression();
      });
      row.append(copy, action); return row;
    }));
    if (!container.children.length) { const empty = document.createElement("p"); empty.className = "essential-empty"; empty.textContent = "No purchasable entries match this search."; container.append(empty); }
  };

  const renderProgression = () => {
    const advancementNames = { standard: "Standard Advancement", heroic: "Heroic Advancement", meteoric: "Meteoric Advancement", questing: "Questing Advancement" };
    const mode = progression.querySelector("#essential-progress-mode");
    mode.textContent = advancementNames[state.advancement];
    progression.querySelector("#essential-spend-category").value = state.progression.spendCategory;
    progression.querySelector("#essential-spend-search").value = state.progression.spendSearch;
    const record = progression.querySelector("#essential-record-advancement");
    const copy = progression.querySelector("#essential-progress-advancement-copy");
    const questing = progression.querySelector("#essential-questing-progress");
    questing.hidden = state.advancement !== "questing";
    if (state.advancement === "heroic" || state.advancement === "meteoric") {
      const award = state.advancement === "heroic" ? 50 : 100;
      record.disabled = false;
      record.textContent = state.progression.advancementApplied ? `${award} EP recorded` : `Record ${award} EP`;
      record.setAttribute("aria-pressed", String(state.progression.advancementApplied));
      copy.textContent = `This Mode permits a ${award} EP advancement record for the selected Jump.`;
    } else {
      record.disabled = true;
      record.setAttribute("aria-pressed", "false");
      record.textContent = state.advancement === "questing" ? "Use challenges" : "No award";
      copy.textContent = state.advancement === "questing" ? "Questing awards come from the challenge records below." : "Standard Advancement provides no per-Jump EP award.";
    }
    questing.querySelectorAll("[data-essential-quest-award]").forEach((checkbox) => { checkbox.checked = state.progression.quests.has(Number(checkbox.dataset.essentialQuestAward)); });

    const accessCopy = progression.querySelector("#essential-access-copy");
    const cumulative = state.variants.has("cumulative") || state.variants.has("retroactive");
    accessCopy.textContent = state.access === "standard" ? `Standard Access permits one Lesser or Greater Essence Infusion${cumulative ? " from the available cumulative opportunities" : " in this Jump"}.`
      : state.access === "lesser" ? `Lesser Access permits only Lesser Essence Infusion${cumulative ? " from the available cumulative opportunities" : " in this Jump"}.`
        : "No Access prevents EP Infusion purchases.";
    progression.querySelectorAll("[data-essential-infusion]").forEach((button) => {
      const value = button.dataset.essentialInfusion;
      button.setAttribute("aria-pressed", String(value === state.progression.infusion));
      button.disabled = value === "greater" ? state.access !== "standard" : value === "lesser" ? state.access === "none" : false;
    });
    const advancement = advancementEP();
    const infusion = infusionEP();
    const spentHere = [...state.jumpPurchases.values()].reduce((sum, purchase) => sum + purchase.cost, 0);
    const net = advancement + infusion - spentHere;
    progression.querySelector("#essential-progress-total").textContent = `${net > 0 ? "+" : ""}${net} EP`;
    progression.querySelector("#essential-progress-advancement").textContent = `${advancement} EP`;
    progression.querySelector("#essential-progress-infusion").textContent = `${infusion} EP`;
    progression.querySelector("#essential-progress-spent").textContent = `${spentHere} EP`;
    progression.querySelector("#essential-progress-cp").textContent = `${infusionCP()} CP`;
    progression.querySelector("#essential-progress-balance").textContent = `${currentBalance()} EP`;
    progression.querySelector("#essential-spend-available").textContent = `${currentBalance()} EP available`;
    renderProgressionPurchases();
    updateChrome();
  };

  full.querySelector("#essential-category-nav").addEventListener("click", (event) => { const button = event.target.closest("[data-essential-category]"); if (!button) return; state.category = button.dataset.essentialCategory; state.detail = null; full.querySelector("#essential-search").value = ""; renderWorkspace(); });
  full.querySelector("#essential-search").addEventListener("input", renderWorkspace);
  dialog.querySelectorAll("[data-essential-dialog-filter]").forEach((button) => button.addEventListener("click", () => { state.dialogFilter = button.dataset.essentialDialogFilter; renderDialog(); }));
  dialog.querySelector("aside button").addEventListener("click", () => full.scrollIntoView({ behavior: "smooth", block: "start" }));
  progression.querySelector("#essential-record-advancement").addEventListener("click", () => { state.progression.advancementApplied = !state.progression.advancementApplied; renderProgression(); });
  progression.querySelectorAll("[data-essential-quest-award]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    const award = Number(checkbox.dataset.essentialQuestAward);
    if (checkbox.checked) state.progression.quests.add(award); else state.progression.quests.delete(award);
    renderProgression();
  }));
  progression.querySelectorAll("[data-essential-infusion]").forEach((button) => button.addEventListener("click", () => { if (button.disabled) return; state.progression.infusion = button.dataset.essentialInfusion; renderProgression(); }));
  progression.querySelector("#essential-spend-category").addEventListener("change", (event) => { state.progression.spendCategory = event.currentTarget.value; state.progression.spendSearch = ""; renderProgression(); });
  progression.querySelector("#essential-spend-search").addEventListener("input", (event) => { state.progression.spendSearch = event.currentTarget.value; renderProgressionPurchases(); });
  progression.querySelector("aside button").addEventListener("click", () => full.scrollIntoView({ behavior: "smooth", block: "start" }));
  renderWorkspace(); renderDialog(); renderProgression();
})();
