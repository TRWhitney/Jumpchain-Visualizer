(() => {
  const lab = document.querySelector(".tag-lab");

  const tags = {
    magic: { label: "Magic" },
    pyrokinesis: { label: "Pyrokinesis" },
    cryokinesis: { label: "Cryokinesis" },
    telekinesis: { label: "Telekinesis" },
  };

  const treeItems = lab ? [...lab.querySelectorAll("[data-tag-key]")] : [];
  const search = lab?.querySelector("#tag-lab-search");
  const searchNote = lab?.querySelector("#tag-lab-search-note");
  const results = lab ? [...lab.querySelectorAll("[data-result-search]")] : [];
  const empty = lab?.querySelector("#tag-lab-empty");
  let selectedTag = "pyrokinesis";

  const rgbFromHex = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const luminance = ([red, green, blue]) => {
    const channels = [red, green, blue].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const contrast = (first, second) => {
    const light = Math.max(luminance(first), luminance(second));
    const dark = Math.min(luminance(first), luminance(second));
    return (light + 0.05) / (dark + 0.05);
  };
  const readableForeground = (...backgrounds) => {
    const white = rgbFromHex("#ffffff");
    const black = rgbFromHex("#171717");
    const backgroundRgb = backgrounds.map(rgbFromHex);
    const whiteMinimum = Math.min(...backgroundRgb.map((background) => contrast(white, background)));
    const blackMinimum = Math.min(...backgroundRgb.map((background) => contrast(black, background)));
    return whiteMinimum >= blackMinimum ? "#ffffff" : "#171717";
  };

  const mixHex = (first, second, secondWeight = 0.3) => {
    const firstRgb = rgbFromHex(first);
    const secondRgb = rgbFromHex(second);
    const mixed = firstRgb.map((channel, index) => Math.round(channel * (1 - secondWeight) + secondRgb[index] * secondWeight));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  };

  const filterResults = () => {
    if (!lab || !search || !searchNote || !empty) return;
    const query = search.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const selectedTerm = selectedTag === "magic" ? "magic" : selectedTag;
    let visibleCount = 0;
    results.forEach((result) => {
      const searchable = result.dataset.resultSearch;
      const matches = terms.length
        ? terms.every((term) => searchable.includes(term))
        : searchable.includes(selectedTerm);
      result.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    empty.hidden = visibleCount !== 0;
    if (query) searchNote.textContent = `${visibleCount} result${visibleCount === 1 ? "" : "s"} for “${query}”. Aliases and ancestors participate in matching.`;
    else searchNote.textContent = selectedTag === "magic"
      ? "Magic includes records tagged with its child tags."
      : `Showing records tagged ${tags[selectedTag].label}; user aliases expand the match.`;
  };

  const selectTag = (key, moveFocus = false) => {
    selectedTag = key;
    treeItems.forEach((item) => item.setAttribute("aria-selected", String(item.dataset.tagKey === key)));
    if (search) search.value = "";
    filterResults();
    if (moveFocus) treeItems.find((item) => item.dataset.tagKey === key)?.focus();
  };

  treeItems.forEach((item, index) => {
    item.addEventListener("click", () => selectTag(item.dataset.tagKey));
    item.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowDown") nextIndex = (index + 1) % treeItems.length;
      else if (event.key === "ArrowUp") nextIndex = (index - 1 + treeItems.length) % treeItems.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = treeItems.length - 1;
      else return;
      event.preventDefault();
      selectTag(treeItems[nextIndex].dataset.tagKey, true);
    });
  });

  search?.addEventListener("input", filterResults);

  const builtInCategoryData = {
    social: { label: "Social", count: 8, color: "#a93572", style: "soft", description: "Communication, relationships, leadership, and reputation." },
    mental: { label: "Mental", count: 12, color: "#4f46a5", style: "gradient", description: "Memory, cognition, learning, emotion, and will." },
    spiritual: { label: "Spiritual", count: 7, color: "#16806f", style: "outline", description: "Souls, spirits, faith, and spiritual practices." },
    magic: { label: "Magic", count: 21, color: "#6d3bb3", style: "gradient", description: "Spellcraft and explicitly magical systems or techniques." },
    meta: { label: "Meta", count: 5, color: "#7b3f8c", style: "outline", description: "Chain, Jump, perk, and other rules-facing effects." },
    stealth: { label: "Stealth", count: 11, color: "#475569", style: "gradient", description: "Concealment, infiltration, disguise, and evasion." },
    physical: { label: "Physical", count: 18, color: "#a93645", style: "solid", description: "Body, health, senses, forms, and bodily capability." },
    combat: { label: "Combat", count: 16, color: "#922b21", style: "solid", description: "Offense, weapons, tactics, and direct fighting capability." },
    defense: { label: "Defense", count: 14, color: "#35755e", style: "outline", description: "Protection, resistance, recovery, and survival." },
    crafting: { label: "Crafting", count: 9, color: "#9a4d00", style: "soft", description: "Making, repairing, enchanting, cooking, and other creation skills." },
    technology: { label: "Technology", count: 10, color: "#2563a8", style: "solid", description: "Science, computing, engineering, and technological systems." },
    miscellaneous: { label: "Miscellaneous", count: 6, color: "#68707c", style: "soft", description: "Tags with no path to another top-level category." },
  };

  const categoryRadar = document.querySelector(".category-radar");
  if (categoryRadar) {
    const svg = categoryRadar.querySelector("#category-radar-svg");
    const chartTitle = categoryRadar.querySelector("#category-radar-title");
    const chartEyebrow = categoryRadar.querySelector("#category-chart-eyebrow");
    const chartCaption = categoryRadar.querySelector("#category-radar-caption");
    const breadcrumbs = categoryRadar.querySelector("#category-chart-breadcrumbs");
    const backButton = categoryRadar.querySelector("#category-chart-back");
    const openButton = categoryRadar.querySelector("#category-chart-open");
    const sidebarEyebrow = categoryRadar.querySelector("#category-sidebar-eyebrow");
    const sidebarHeading = categoryRadar.querySelector("#category-counts-heading");
    const sidebarSort = categoryRadar.querySelector("#category-chart-sort");
    const table = categoryRadar.querySelector("#category-chart-table");
    const tableCaption = table.querySelector("caption");
    const tableHeadings = [...table.querySelectorAll("thead th")];
    const tableRows = categoryRadar.querySelector("#category-chart-rows");
    const svgNamespace = "http://www.w3.org/2000/svg";
    const piePalette = ["#d4af37", "#2f80ed", "#d97706", "#0f8a78", "#c44555", "#8b5cf6", "#5f8f22", "#c13f87", "#64748b"];
    const radarClickTimers = new WeakMap();
    let selectedRadarCategory = null;
    let chartStack = [];
    let poppedSlice = null;
    let hoveredSlice = null;
    let sidebarSortMode = "count";

    const createSvgElement = (name, attributes = {}) => {
      const element = document.createElementNS(svgNamespace, name);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
      return element;
    };

    const leaf = (name, count, aliases = []) => ({ name, count, aliases, children: [] });
    const branch = (name, count, aliases, children) => ({ name, count, aliases, children });
    const breakdowns = {
      social: branch("Social", 8, [], [leaf("Social", 1), branch("Charisma", 2, ["Charm"], [leaf("Charisma", 1, ["Charm"]), leaf("Influence", 1)]), leaf("Leadership", 2), leaf("Reputation", 1), leaf("Empathy", 1), leaf("Deception", 1)]),
      mental: branch("Mental", 12, [], [leaf("Mental", 2), branch("Memory", 3, ["Recall"], [leaf("Memory", 1, ["Recall"]), leaf("Perfect Recall", 1), leaf("Memory Protection", 1)]), leaf("Learning", 2), leaf("Willpower", 2), leaf("Emotion", 2), leaf("Calculation", 1)]),
      spiritual: branch("Spiritual", 7, [], [leaf("Spiritual", 1), branch("Soul", 2, ["Essence"], [leaf("Soul", 1, ["Essence"]), leaf("Soul Protection", 1)]), leaf("Spirits", 1), leaf("Faith", 1), leaf("Ki", 1), leaf("Afterlife", 1)]),
      magic: branch("Magic", 21, [], [
        leaf("Magic", 2),
        branch("Pyrokinesis", 4, ["Fire Control", "Flamecraft"], [leaf("Pyrokinesis", 1, ["Fire Control", "Flamecraft"]), leaf("Fire Projection", 1), leaf("Heat Control", 1), leaf("Flame Immunity", 1)]),
        branch("Cryokinesis", 3, ["Ice Control"], [leaf("Cryokinesis", 1, ["Ice Control"]), leaf("Ice Creation", 1), leaf("Cold Control", 1)]),
        leaf("Telekinesis", 2, ["Psychokinesis"]), leaf("Healing Magic", 2), leaf("Enchantment", 2), leaf("Divination", 1), leaf("Summoning", 1), leaf("Necromancy", 1), leaf("Illusion", 1), leaf("Runes", 1), leaf("Alchemy", 1),
      ]),
      meta: branch("Meta", 5, [], [leaf("Meta", 1), leaf("Perk Interaction", 1), leaf("Chain Rules", 1), leaf("Fiat", 1), leaf("Choice Points", 1, ["CP"])]),
      miscellaneous: branch("Miscellaneous", 6, [], [leaf("Miscellaneous", 1), leaf("Convenience", 1), leaf("Aesthetic", 1), leaf("Hobby", 1), leaf("Novelty", 1), leaf("Unsorted", 1)]),
      stealth: branch("Stealth", 11, [], [leaf("Stealth", 2), leaf("Concealment", 2), leaf("Infiltration", 2), leaf("Disguise", 2), leaf("Evasion", 2), leaf("Espionage", 1)]),
      physical: branch("Physical", 18, [], [leaf("Physical", 2), branch("Strength", 4, ["Might"], [leaf("Strength", 1, ["Might"]), leaf("Lifting", 1), leaf("Striking", 1), leaf("Grip", 1)]), leaf("Endurance", 3), leaf("Speed", 2), leaf("Senses", 2), leaf("Shapeshifting", 2), leaf("Healing", 2), leaf("Biology", 1)]),
      combat: branch("Combat", 16, [], [leaf("Combat", 2), branch("Weapons", 3, ["Arms"], [leaf("Weapons", 1, ["Arms"]), leaf("Melee Weapons", 1), leaf("Ranged Weapons", 1)]), leaf("Martial Arts", 3), leaf("Tactics", 2), leaf("Offense", 2), leaf("Ranged Combat", 2), leaf("Grappling", 1), leaf("Duels", 1)]),
      defense: branch("Defense", 14, [], [leaf("Defense", 2), branch("Resistance", 3, [], [leaf("Resistance", 1), leaf("Elemental Resistance", 1), leaf("Mental Resistance", 1)]), leaf("Recovery", 2), leaf("Immunity", 2), leaf("Barriers", 2), leaf("Survival", 2), leaf("Armor", 1)]),
      crafting: branch("Crafting", 9, [], [leaf("Crafting", 1), branch("Enchanting", 2, [], [leaf("Enchanting", 1), leaf("Magical Tools", 1)]), leaf("Smithing", 2), leaf("Cooking", 1), leaf("Alchemy", 1), leaf("Art", 1), leaf("Repair", 1)]),
      technology: branch("Technology", 10, [], [leaf("Technology", 1), branch("Computing", 2, ["Computer Science"], [leaf("Computing", 1, ["Computer Science"]), leaf("Artificial Intelligence", 1, ["AI"])]), leaf("Engineering", 2), leaf("Cybernetics", 2), leaf("Vehicles", 1), leaf("Science", 1), leaf("Automation", 1)]),
    };

    const categoryBadge = (category) => {
      const badge = document.createElement("span");
      badge.className = `category-list-badge is-${category.style}`;
      badge.style.setProperty("--category-color", category.color);
      badge.style.setProperty("--category-to", mixHex(category.color, "#171717", 0.32));
      badge.textContent = category.label;
      return badge;
    };

    const compactAliases = (aliases) => {
      if (!aliases?.length) return "";
      return aliases.length === 1 ? `aka ${aliases[0]}` : `aka ${aliases[0]} +${aliases.length - 1}`;
    };

    const setRadarSelection = (key) => {
      selectedRadarCategory = key;
      openButton.disabled = !key;
      chartEyebrow.textContent = key ? `Selected · ${builtInCategoryData[key].label}` : "Sample chain profile";
      categoryRadar.style.setProperty("--chart-selection", key ? builtInCategoryData[key].color : "#d4af37");
      categoryRadar.classList.toggle("has-chart-selection", Boolean(key));
      renderRadar();
      renderRadarSidebar();
    };

    const wireRadarTarget = (element, key) => {
      element.addEventListener("click", () => {
        clearTimeout(radarClickTimers.get(element));
        const timer = setTimeout(() => setRadarSelection(key), 220);
        radarClickTimers.set(element, timer);
      });
      element.addEventListener("dblclick", () => {
        clearTimeout(radarClickTimers.get(element));
        if (selectedRadarCategory === key) openBreakdown(key);
        else setRadarSelection(key);
      });
    };

    const renderRadar = () => {
      if (!svg) return;
      svg.replaceChildren();
      const categories = Object.entries(builtInCategoryData);
      const center = 260;
      const radius = 170;
      const labelRadius = 213;
      const ringCount = 5;
      const maximum = Math.ceil(Math.max(...categories.map(([, category]) => category.count)) / 5) * 5;
      const pointAt = (index, distance) => {
        const angle = ((Math.PI * 2 * index) / categories.length) - (Math.PI / 2);
        return [center + Math.cos(angle) * distance, center + Math.sin(angle) * distance];
      };
      const pointsAtDistance = (distance) => categories.map((_, index) => pointAt(index, distance).join(",")).join(" ");

      for (let ring = 1; ring <= ringCount; ring += 1) {
        const distance = radius * (ring / ringCount);
        svg.append(createSvgElement("polygon", { points: pointsAtDistance(distance), class: "radar-grid" }));
        const scaleLabel = createSvgElement("text", { x: center + 5, y: center - distance + 12, class: "radar-scale-label" });
        scaleLabel.textContent = String(Math.round(maximum * (ring / ringCount)));
        svg.append(scaleLabel);
      }

      categories.forEach(([key, category], index) => {
        const [axisX, axisY] = pointAt(index, radius);
        const axis = createSvgElement("line", {
          x1: center,
          y1: center,
          x2: axisX,
          y2: axisY,
          class: `radar-axis${key === selectedRadarCategory ? " is-selected" : ""}`,
          style: key === selectedRadarCategory ? `stroke:${category.color}` : "",
          "data-radar-key": key,
        });
        const hitAxis = createSvgElement("line", { x1: center, y1: center, x2: axisX, y2: axisY, class: "radar-axis-hit", "data-radar-key": key });
        svg.append(axis, hitAxis);
        const [labelX, labelY] = pointAt(index, labelRadius);
        const label = createSvgElement("text", {
          x: labelX,
          y: labelY,
          class: `radar-label${key === selectedRadarCategory ? " is-selected" : ""}`,
          style: key === selectedRadarCategory ? `fill:${category.color}` : "",
          "text-anchor": Math.abs(labelX - center) < 12 ? "middle" : labelX < center ? "end" : "start",
          "dominant-baseline": "middle",
          "data-radar-key": key,
        });
        label.textContent = category.label;
        svg.append(label);
      });

      const dataPoints = categories.map(([, category], index) => pointAt(index, radius * (category.count / maximum)));
      svg.append(createSvgElement("polygon", { points: dataPoints.map((point) => point.join(",")).join(" "), class: "radar-area" }));
      categories.forEach(([key, category], index) => {
        const [x, y] = dataPoints[index];
        const point = createSvgElement("circle", {
          cx: x,
          cy: y,
          r: key === selectedRadarCategory ? 7 : 5,
          fill: category.color,
          class: `radar-point${key === selectedRadarCategory ? " is-selected" : ""}`,
          "data-radar-key": key,
        });
        const title = createSvgElement("title");
        title.textContent = `${category.label}: ${category.count} records`;
        point.append(title);
        svg.append(point);
      });
      svg.querySelectorAll("[data-radar-key]").forEach((element) => wireRadarTarget(element, element.dataset.radarKey));
    };

    const renderRadarSidebar = () => {
      sidebarEyebrow.textContent = selectedRadarCategory ? `Selected · ${builtInCategoryData[selectedRadarCategory].count} records` : "Exact values";
      sidebarHeading.textContent = selectedRadarCategory ? builtInCategoryData[selectedRadarCategory].label : "Category counts";
      sidebarHeading.closest("header").classList.toggle("is-selected", Boolean(selectedRadarCategory));
      tableHeadings[0].textContent = "Category";
      tableHeadings[1].textContent = "Records";
      tableCaption.textContent = "Accrued record count for each built-in tag category";
      tableRows.replaceChildren();
      const sidebarCategories = Object.entries(builtInCategoryData).sort(([, first], [, second]) => sidebarSortMode === "tag"
        ? first.label.localeCompare(second.label)
        : second.count - first.count || first.label.localeCompare(second.label));
      sidebarCategories.forEach(([key, category]) => {
        const row = document.createElement("tr");
        row.dataset.radarRow = key;
        row.classList.toggle("is-selected", key === selectedRadarCategory);
        if (key === selectedRadarCategory) row.style.setProperty("--row-color", category.color);
        const header = document.createElement("th");
        header.scope = "row";
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.radarCategory = key;
        button.setAttribute("aria-pressed", String(key === selectedRadarCategory));
        button.append(categoryBadge(category));
        button.addEventListener("click", () => {
          clearTimeout(radarClickTimers.get(button));
          const timer = setTimeout(() => setRadarSelection(key), 220);
          radarClickTimers.set(button, timer);
        });
        button.addEventListener("dblclick", () => {
          clearTimeout(radarClickTimers.get(button));
          if (selectedRadarCategory === key) openBreakdown(key);
          else setRadarSelection(key);
        });
        button.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (selectedRadarCategory === key) openBreakdown(key);
          else setRadarSelection(key);
        });
        header.append(button);
        const count = document.createElement("td");
        count.textContent = category.count;
        row.append(header, count);
        tableRows.append(row);
      });
    };

    const visiblePieSlices = (node, categoryKey) => {
      const ordered = [...node.children].sort((first, second) => {
        if (first.name === node.name) return -1;
        if (second.name === node.name) return 1;
        return second.count - first.count || first.name.localeCompare(second.name);
      });
      const shown = ordered.slice(0, 9);
      const remaining = ordered.slice(9);
      const slices = shown.map((item, index) => ({ item, key: `slice-${index}`, color: index === 0 ? builtInCategoryData[categoryKey].color : piePalette[index % piePalette.length], isMore: false }));
      if (remaining.length) {
        slices.push({
          item: branch(`More in ${node.name}`, remaining.reduce((total, item) => total + item.count, 0), [], remaining),
          key: "slice-more",
          color: "#68707c",
          isMore: true,
        });
      }
      return slices;
    };

    const describePieArc = (center, radius, startAngle, endAngle) => {
      const point = (angle) => [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
      const [startX, startY] = point(startAngle);
      const [endX, endY] = point(endAngle);
      return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 1 ${endX} ${endY} Z`;
    };

    const syncPieCorrelation = () => {
      svg.querySelectorAll("[data-pie-key]").forEach((path) => {
        path.classList.toggle("is-hovered", path.dataset.pieKey === hoveredSlice);
        path.classList.toggle("is-popped", path.dataset.pieKey === poppedSlice);
      });
      tableRows.querySelectorAll("[data-pie-row]").forEach((row) => {
        row.classList.toggle("is-hovered", row.dataset.pieRow === hoveredSlice);
        row.classList.toggle("is-popped", row.dataset.pieRow === poppedSlice);
        row.querySelector("button")?.setAttribute("aria-pressed", String(row.dataset.pieRow === poppedSlice));
      });
    };

    const setPieHover = (slice) => {
      hoveredSlice = slice?.key || null;
      if (slice) {
        const aliases = slice.isMore ? "" : compactAliases(slice.item.aliases);
        chartCaption.textContent = `${slice.isMore ? "More tags" : slice.item.name}: ${slice.item.count} records${aliases ? ` · ${aliases}` : ""}.`;
      } else {
        chartCaption.textContent = "Click a slice to pull it out. Double-click a category slice to open its children.";
      }
      syncPieCorrelation();
    };

    const togglePieSlice = (slice) => {
      poppedSlice = poppedSlice === slice.key ? null : slice.key;
      syncPieCorrelation();
    };

    const drillPieSlice = (slice) => {
      if (!slice.item.children?.length) return;
      chartStack.push({ node: slice.item, categoryKey: chartStack.at(-1).categoryKey, isMore: slice.isMore });
      poppedSlice = null;
      hoveredSlice = null;
      renderPie();
    };

    const renderPieSidebar = (slices) => {
      const { node } = chartStack.at(-1);
      sidebarEyebrow.textContent = "Current breakdown";
      sidebarHeading.textContent = `${node.count} records`;
      sidebarHeading.closest("header").classList.remove("is-selected");
      tableHeadings[0].textContent = "Tag";
      tableHeadings[1].textContent = "Records";
      tableCaption.textContent = `Tag breakdown for ${node.name}`;
      tableRows.replaceChildren();
      const sidebarSlices = [...slices].sort((first, second) => {
        if (sidebarSortMode === "tag") {
          if (first.isMore) return 1;
          if (second.isMore) return -1;
          return first.item.name.localeCompare(second.item.name);
        }
        return second.item.count - first.item.count || first.item.name.localeCompare(second.item.name);
      });
      sidebarSlices.forEach((slice) => {
        const row = document.createElement("tr");
        row.dataset.pieRow = slice.key;
        const header = document.createElement("th");
        header.scope = "row";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pie-breakdown-button";
        button.dataset.pieKey = slice.key;
        button.setAttribute("aria-pressed", String(slice.key === poppedSlice));
        const fullAliases = !slice.isMore && slice.item.aliases?.length ? ` Aliases: ${slice.item.aliases.join(", ")}.` : "";
        button.setAttribute("aria-label", `${slice.isMore ? `${slice.item.children.length} more tags` : slice.item.name}, ${slice.item.count} records.${fullAliases}`);
        if (fullAliases) button.title = fullAliases.trim();
        const swatch = document.createElement("span");
        swatch.className = "pie-breakdown-swatch";
        swatch.style.setProperty("--slice-color", slice.color);
        const label = document.createElement("span");
        const name = document.createElement("strong");
        const aliases = document.createElement("small");
        name.textContent = slice.isMore ? "…" : slice.item.name;
        aliases.textContent = slice.isMore ? `${slice.item.children.length} more tags` : compactAliases(slice.item.aliases);
        if (slice.item.aliases?.length) aliases.title = `Aliases: ${slice.item.aliases.join(", ")}`;
        label.append(name);
        if (aliases.textContent) label.append(aliases);
        button.append(swatch, label);
        if (slice.item.children?.length) {
          const drill = document.createElement("span");
          drill.className = "pie-drill-marker";
          drill.textContent = "›";
          drill.setAttribute("aria-hidden", "true");
          button.append(drill);
        }
        button.addEventListener("click", () => togglePieSlice(slice));
        button.addEventListener("dblclick", () => drillPieSlice(slice));
        button.addEventListener("mouseenter", () => setPieHover(slice));
        button.addEventListener("mouseleave", () => setPieHover(null));
        button.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (poppedSlice === slice.key && slice.item.children?.length) drillPieSlice(slice);
          else togglePieSlice(slice);
        });
        header.append(button);
        const count = document.createElement("td");
        count.textContent = slice.item.count;
        row.append(header, count);
        tableRows.append(row);
      });
      syncPieCorrelation();
    };

    const renderBreadcrumbs = () => {
      breadcrumbs.hidden = false;
      breadcrumbs.replaceChildren();
      const all = document.createElement("button");
      all.type = "button";
      all.textContent = "All categories";
      all.addEventListener("click", returnToRadar);
      breadcrumbs.append(all);
      chartStack.forEach((entry, index) => {
        const separator = document.createElement("span");
        separator.textContent = "/";
        breadcrumbs.append(separator);
        if (index === chartStack.length - 1) {
          const current = document.createElement("span");
          current.textContent = entry.isMore ? "More" : entry.node.name;
          current.setAttribute("aria-current", "page");
          breadcrumbs.append(current);
        } else {
          const crumb = document.createElement("button");
          crumb.type = "button";
          crumb.textContent = entry.isMore ? "More" : entry.node.name;
          crumb.addEventListener("click", () => {
            chartStack = chartStack.slice(0, index + 1);
            poppedSlice = null;
            renderPie();
          });
          breadcrumbs.append(crumb);
        }
      });
    };

    const renderPie = () => {
      const current = chartStack.at(-1);
      if (!current) returnToRadar();
      const { node, categoryKey } = current;
      categoryRadar.classList.add("is-pie-mode");
      categoryRadar.style.setProperty("--chart-selection", builtInCategoryData[categoryKey].color);
      chartEyebrow.textContent = current.isMore ? "Additional tags" : `${builtInCategoryData[categoryKey].label} breakdown`;
      chartTitle.textContent = node.name;
      backButton.hidden = false;
      backButton.textContent = chartStack.length === 1 ? "← Radar" : `← ${chartStack.at(-2).isMore ? "More" : chartStack.at(-2).node.name}`;
      openButton.hidden = true;
      renderBreadcrumbs();
      svg.replaceChildren();
      const slices = visiblePieSlices(node, categoryKey);
      const total = slices.reduce((sum, slice) => sum + slice.item.count, 0);
      let angle = -Math.PI / 2;
      slices.forEach((slice) => {
        const sliceAngle = (slice.item.count / total) * Math.PI * 2;
        const startAngle = angle;
        const endAngle = angle + sliceAngle;
        const middle = startAngle + (sliceAngle / 2);
        const path = createSvgElement("path", {
          d: describePieArc(260, 180, startAngle, endAngle),
          fill: slice.color,
          class: "pie-slice",
          "data-pie-key": slice.key,
          style: `--pop-x:${Math.cos(middle) * 14}px;--pop-y:${Math.sin(middle) * 14}px`,
        });
        const title = createSvgElement("title");
        title.textContent = `${slice.isMore ? "More tags" : slice.item.name}: ${slice.item.count} records${!slice.isMore && slice.item.aliases?.length ? `. Aliases: ${slice.item.aliases.join(", ")}` : ""}`;
        path.append(title);
        path.addEventListener("click", () => togglePieSlice(slice));
        path.addEventListener("dblclick", () => drillPieSlice(slice));
        path.addEventListener("mouseenter", () => setPieHover(slice));
        path.addEventListener("mouseleave", () => setPieHover(null));
        svg.append(path);
        angle = endAngle;
      });
      const centerBackplate = createSvgElement("circle", { cx: 260, cy: 260, r: 56, class: "pie-center-backplate" });
      const centerLabel = createSvgElement("text", { x: 260, y: 255, class: "pie-center-label", "text-anchor": "middle" });
      centerLabel.textContent = node.name;
      const centerCount = createSvgElement("text", { x: 260, y: 278, class: "pie-center-count", "text-anchor": "middle" });
      centerCount.textContent = `${node.count} records`;
      svg.append(centerBackplate, centerLabel, centerCount);
      chartCaption.textContent = "Click a slice to pull it out. Double-click a category slice to open its children.";
      renderPieSidebar(slices);
    };

    function openBreakdown(key) {
      if (!breakdowns[key]) return;
      selectedRadarCategory = key;
      chartStack = [{ node: breakdowns[key], categoryKey: key, isMore: false }];
      poppedSlice = null;
      hoveredSlice = null;
      renderPie();
    }

    function returnToRadar() {
      chartStack = [];
      poppedSlice = null;
      hoveredSlice = null;
      categoryRadar.classList.remove("is-pie-mode");
      chartEyebrow.textContent = selectedRadarCategory ? `Selected · ${builtInCategoryData[selectedRadarCategory].label}` : "Sample chain profile";
      chartTitle.textContent = "Accrued records by tag category";
      breadcrumbs.hidden = true;
      breadcrumbs.replaceChildren();
      backButton.hidden = true;
      openButton.hidden = false;
      openButton.disabled = !selectedRadarCategory;
      chartCaption.textContent = "Select a category to show its axis; double-click the selected category to open its breakdown.";
      renderRadar();
      renderRadarSidebar();
    }

    openButton.addEventListener("click", () => {
      if (selectedRadarCategory) openBreakdown(selectedRadarCategory);
    });
    backButton.addEventListener("click", () => {
      if (chartStack.length <= 1) returnToRadar();
      else {
        chartStack.pop();
        poppedSlice = null;
        hoveredSlice = null;
        renderPie();
      }
    });
    sidebarSort.addEventListener("change", () => {
      sidebarSortMode = sidebarSort.value;
      if (chartStack.length) {
        const current = chartStack.at(-1);
        renderPieSidebar(visiblePieSlices(current.node, current.categoryKey));
      } else {
        renderRadarSidebar();
      }
    });

    returnToRadar();
  }

  const profileEditor = document.querySelector(".tag-profile-editor");
  if (profileEditor) {
    const normalizeTag = (value) => value.trim().replace(/\s+/g, " ").normalize("NFKC").toLocaleLowerCase();
    const sourceLabels = {
      builtin: "Built-in category",
      acquired: "From acquired content",
      manual: "Entered manually",
      imported: "Imported profile",
    };
    const validHex = (value) => /^#[0-9a-f]{6}$/i.test(value);
    const clone = (value) => JSON.parse(JSON.stringify(value));

    const createPresentation = (color, style = "solid") => ({
      background: style === "gradient" ? "gradient" : style === "outline" ? "transparent" : "solid",
      colors: [color, mixHex(color, "#171717", 0.28), mixHex(color, "#ffffff", 0.16)],
      positions: [0, 50, 100],
      angle: 120,
      borderColor: color,
      borderWidth: style === "outline" ? "medium" : "thin",
      corners: "pill",
      padding: "compact",
      textMode: "auto",
      textColor: "#ffffff",
      weight: "bold",
      fontStyle: "normal",
      decoration: "none",
      textEffect: "none",
      animation: "none",
    });

    const createTag = (name, source, parent, color, style = "solid", aliases = []) => {
      const tag = {
        name,
        source,
        parent,
        aliases,
        appearanceSource: source === "builtin" ? "builtin" : "derived",
        presentation: createPresentation(color, style),
      };
      tag.defaultState = clone(tag);
      return tag;
    };

    const buildBuiltIns = () => {
      const entries = new Map();
      Object.values(builtInCategoryData).forEach((category) => {
        const tag = createTag(category.label, "builtin", null, category.color, category.style);
        entries.set(normalizeTag(tag.name), tag);
      });
      return entries;
    };

    let profileTags = buildBuiltIns();
    [
      createTag("Pyrokinesis", "acquired", "Magic", "#d9480f", "gradient", ["Fire Control"]),
      createTag("Fire Control", "acquired", "Magic", "#c2410c", "gradient", ["Pyrokinesis"]),
      createTag("Dragon", "acquired", "Miscellaneous", "#8b3f2f"),
      createTag("Vehicle", "acquired", "Technology", "#2d6f98"),
      createTag("Favorite", "manual", "Miscellaneous", "#8a657d", "outline"),
    ].forEach((tag) => profileTags.set(normalizeTag(tag.name), tag));

    const profileList = profileEditor.querySelector("#tag-profile-list");
    const profileSearch = profileEditor.querySelector("#tag-profile-search");
    const formHeading = profileEditor.querySelector("#tag-profile-form-heading");
    const formSource = profileEditor.querySelector("#tag-profile-source");
    const nameInput = profileEditor.querySelector("#tag-profile-name");
    const parentInput = profileEditor.querySelector("#tag-profile-parent");
    const parentField = profileEditor.querySelector("#tag-profile-parent-field");
    const aliasList = profileEditor.querySelector("#tag-profile-alias-list");
    const aliasTarget = profileEditor.querySelector("#tag-profile-alias-target");
    const aliasAdd = profileEditor.querySelector("#tag-profile-alias-add");
    const backgroundInput = profileEditor.querySelector("#tag-profile-background");
    const solidField = profileEditor.querySelector("#tag-profile-solid-field");
    const solidColorInput = profileEditor.querySelector("#tag-profile-solid-color");
    const gradientEditor = profileEditor.querySelector("#tag-gradient-editor");
    const gradientTrack = profileEditor.querySelector("#tag-gradient-track");
    const gradientAdd = profileEditor.querySelector("#tag-gradient-add");
    const gradientStopColor = profileEditor.querySelector("#tag-gradient-stop-color");
    const gradientStopPosition = profileEditor.querySelector("#tag-gradient-stop-position");
    const gradientPositionField = profileEditor.querySelector("#tag-gradient-position-field");
    const gradientStopOutput = profileEditor.querySelector("#tag-gradient-stop-output");
    const gradientRemove = profileEditor.querySelector("#tag-gradient-remove");
    const angleInput = profileEditor.querySelector("#tag-profile-angle");
    const borderColorInput = profileEditor.querySelector("#tag-profile-border-color");
    const borderWidthInput = profileEditor.querySelector("#tag-profile-border-width");
    const cornersInput = profileEditor.querySelector("#tag-profile-corners");
    const paddingInput = profileEditor.querySelector("#tag-profile-padding");
    const textModeInput = profileEditor.querySelector("#tag-profile-text-mode");
    const textColorInput = profileEditor.querySelector("#tag-profile-text-color");
    const textColorField = profileEditor.querySelector("#tag-profile-text-color-field");
    const weightInput = profileEditor.querySelector("#tag-profile-weight");
    const fontStyleInput = profileEditor.querySelector("#tag-profile-font-style");
    const decorationInput = profileEditor.querySelector("#tag-profile-decoration");
    const textEffectInput = profileEditor.querySelector("#tag-profile-text-effect");
    const animationControl = profileEditor.querySelector("#tag-profile-animation");
    const animationButton = profileEditor.querySelector("#tag-animation-button");
    const animationValue = profileEditor.querySelector("#tag-animation-value");
    const animationMenu = profileEditor.querySelector("#tag-animation-menu");
    const animationOptions = [...animationMenu.querySelectorAll("[data-animation-value]")];
    const deleteTagButton = profileEditor.querySelector("#tag-profile-delete");
    const resetTagButton = profileEditor.querySelector("#tag-profile-reset");
    const previewHeading = profileEditor.querySelector("#tag-profile-preview-heading");
    const previewDark = profileEditor.querySelector("#tag-profile-preview-dark");
    const previewLight = profileEditor.querySelector("#tag-profile-preview-light");
    const previewSource = profileEditor.querySelector("#tag-preview-source");
    const previewParent = profileEditor.querySelector("#tag-preview-parent");
    const previewAliases = profileEditor.querySelector("#tag-preview-aliases");
    const previewAppearance = profileEditor.querySelector("#tag-preview-appearance");
    const acquiredButton = profileEditor.querySelector("#tag-add-acquired");
    const acquiredPicker = profileEditor.querySelector("#tag-acquired-picker");
    const acquiredApply = profileEditor.querySelector("#tag-acquired-apply");
    const manualButton = profileEditor.querySelector("#tag-add-manual");
    const manualPanel = profileEditor.querySelector("#tag-manual-entry");
    const manualName = profileEditor.querySelector("#tag-manual-name");
    const manualMessage = profileEditor.querySelector("#tag-manual-message");
    const jsonPanel = profileEditor.querySelector("#tag-json-panel");
    const jsonHeading = profileEditor.querySelector("#tag-json-heading");
    const jsonContent = profileEditor.querySelector("#tag-json-content");
    const jsonMessage = profileEditor.querySelector("#tag-json-message");
    const jsonModeWrapper = profileEditor.querySelector(".tag-json-import-options");
    const jsonMode = profileEditor.querySelector("#tag-json-mode");
    const jsonApply = profileEditor.querySelector("#tag-json-apply");
    let selectedProfileTag = "physical";
    let selectedGradientStop = 1;

    const stableColorFor = (name) => {
      const palette = Object.values(builtInCategoryData).map((category) => category.color);
      const hash = [...name].reduce((value, character) => ((value * 31) + character.codePointAt(0)) >>> 0, 0);
      return palette[hash % palette.length];
    };

    const deriveAppearanceFromParent = (tag, tagsToUse = profileTags) => {
      if (tag.source === "builtin") return;
      const parent = tagsToUse.get(normalizeTag(tag.parent || "Miscellaneous")) || tagsToUse.get("miscellaneous");
      const derived = clone(parent.presentation);
      const childAnchor = stableColorFor(tag.name);
      derived.colors = derived.colors.map((color, index) => mixHex(color, childAnchor, 0.16 + (index * 0.04)));
      derived.borderColor = mixHex(parent.presentation.borderColor, childAnchor, 0.2);
      tag.presentation = derived;
      tag.appearanceSource = "derived";
    };

    const refreshDerivedDescendants = (parentName, tagsToUse = profileTags, visited = new Set()) => {
      const parentKey = normalizeTag(parentName);
      if (visited.has(parentKey)) return;
      visited.add(parentKey);
      [...tagsToUse.values()]
        .filter((candidate) => candidate.appearanceSource === "derived" && normalizeTag(candidate.parent || "") === parentKey)
        .forEach((candidate) => {
          deriveAppearanceFromParent(candidate, tagsToUse);
          refreshDerivedDescendants(candidate.name, tagsToUse, visited);
        });
    };

    const linkAliasPair = (firstKey, secondKey, tagsToUse = profileTags) => {
      if (firstKey === secondKey) return;
      const first = tagsToUse.get(firstKey);
      const second = tagsToUse.get(secondKey);
      if (!first || !second) return;
      if (!first.aliases.some((alias) => normalizeTag(alias) === secondKey)) first.aliases.push(second.name);
      if (!second.aliases.some((alias) => normalizeTag(alias) === firstKey)) second.aliases.push(first.name);
    };

    const unlinkAliasPair = (firstKey, secondKey, tagsToUse = profileTags) => {
      const first = tagsToUse.get(firstKey);
      const second = tagsToUse.get(secondKey);
      if (first) first.aliases = first.aliases.filter((alias) => normalizeTag(alias) !== secondKey);
      if (second) second.aliases = second.aliases.filter((alias) => normalizeTag(alias) !== firstKey);
    };

    [...profileTags.values()].filter((tag) => tag.source !== "builtin").forEach((tag) => deriveAppearanceFromParent(tag));
    linkAliasPair("pyrokinesis", "fire control");

    const currentTag = () => profileTags.get(selectedProfileTag);

    const wouldCreateCycle = (childName, parentName, tagsToCheck = profileTags) => {
      const childKey = normalizeTag(childName);
      let nextKey = normalizeTag(parentName || "");
      const visited = new Set();
      while (nextKey) {
        if (nextKey === childKey || visited.has(nextKey)) return true;
        visited.add(nextKey);
        const nextTag = tagsToCheck.get(nextKey);
        nextKey = nextTag?.parent ? normalizeTag(nextTag.parent) : "";
      }
      return false;
    };

    const populateParentOptions = (tag) => {
      parentInput.replaceChildren();
      if (tag.source === "builtin") {
        const option = new Option("Top level (fixed)", "");
        parentInput.add(option);
        parentInput.disabled = true;
        return;
      }
      parentInput.disabled = false;
      [...profileTags.values()]
        .filter((candidate) => normalizeTag(candidate.name) !== normalizeTag(tag.name))
        .filter((candidate) => !wouldCreateCycle(tag.name, candidate.name))
        .sort((first, second) => {
          if (first.source === "builtin" && second.source !== "builtin") return -1;
          if (first.source !== "builtin" && second.source === "builtin") return 1;
          return first.name.localeCompare(second.name);
        })
        .forEach((candidate) => parentInput.add(new Option(candidate.name, candidate.name)));
      if (![...parentInput.options].some((option) => option.value === tag.parent)) {
        parentInput.add(new Option(tag.parent || "Miscellaneous", tag.parent || "Miscellaneous"));
      }
      parentInput.value = tag.parent || "Miscellaneous";
    };

    const renderAliasEditor = (tag) => {
      aliasList.replaceChildren();
      if (!tag.aliases.length) {
        const empty = document.createElement("span");
        empty.className = "tag-alias-empty";
        empty.textContent = "No aliases linked.";
        aliasList.append(empty);
      } else {
        tag.aliases.sort((first, second) => first.localeCompare(second)).forEach((alias) => {
          const aliasKey = normalizeTag(alias);
          const chip = document.createElement("span");
          chip.className = "tag-alias-chip";
          const name = document.createElement("span");
          name.textContent = profileTags.get(aliasKey)?.name || alias;
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "×";
          remove.setAttribute("aria-label", `Unlink alias ${name.textContent}`);
          remove.addEventListener("click", () => {
            unlinkAliasPair(selectedProfileTag, aliasKey);
            renderAliasEditor(currentTag());
            renderProfilePreview();
            renderProfileList();
          });
          chip.append(name, remove);
          aliasList.append(chip);
        });
      }
      aliasTarget.replaceChildren();
      const placeholder = new Option("Choose a tag…", "");
      aliasTarget.add(placeholder);
      const linked = new Set(tag.aliases.map(normalizeTag));
      [...profileTags.values()]
        .filter((candidate) => normalizeTag(candidate.name) !== selectedProfileTag)
        .filter((candidate) => !linked.has(normalizeTag(candidate.name)))
        .sort((first, second) => first.name.localeCompare(second.name))
        .forEach((candidate) => aliasTarget.add(new Option(candidate.name, normalizeTag(candidate.name))));
      aliasTarget.disabled = aliasTarget.options.length <= 1;
      aliasAdd.disabled = true;
    };

    const renderProfileList = () => {
      const query = normalizeTag(profileSearch.value || "");
      profileList.replaceChildren();
      const visible = [...profileTags.values()].filter((tag) => {
        const searchable = [tag.name, ...tag.aliases].map(normalizeTag).join(" ");
        return !query || searchable.includes(query);
      });
      const groups = [
        ["Built-in categories", visible.filter((tag) => tag.source === "builtin")],
        ["Custom tags", visible.filter((tag) => tag.source !== "builtin")],
      ];
      groups.forEach(([label, groupTags]) => {
        if (!groupTags.length) return;
        const group = document.createElement("section");
        group.className = "tag-profile-group";
        const groupHeading = document.createElement("h5");
        groupHeading.textContent = label;
        group.append(groupHeading);
        groupTags.sort((first, second) => first.name.localeCompare(second.name)).forEach((tag) => {
          const key = normalizeTag(tag.name);
          const button = document.createElement("button");
          button.type = "button";
          button.className = "tag-profile-item";
          button.dataset.profileTag = key;
          button.setAttribute("aria-selected", String(key === selectedProfileTag));
          const labelWrapper = document.createElement("span");
          const name = document.createElement("span");
          const source = document.createElement("small");
          name.textContent = tag.name;
          source.textContent = tag.source === "builtin"
            ? tag.appearanceSource === "custom" ? "Built-in · Custom" : "Built-in preset"
            : `${sourceLabels[tag.source]} · ${tag.appearanceSource === "derived" ? `From ${tag.parent}` : "Custom"}`;
          labelWrapper.append(name, source);
          const color = document.createElement("span");
          color.className = "profile-color-dot";
          color.style.setProperty("--profile-color", tag.presentation.colors[0]);
          button.append(labelWrapper, color);
          button.addEventListener("click", () => selectProfileTag(key));
          group.append(button);
        });
        profileList.append(group);
      });
      if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "tag-profile-empty";
        empty.textContent = "No tags match this search.";
        profileList.append(empty);
      }
    };

    const gradientValue = (presentation, angle = presentation.angle) => `linear-gradient(${angle}deg, ${presentation.colors.map((color, index) => `${color} ${presentation.positions[index]}%`).join(", ")})`;

    const markAppearanceCustom = () => {
      const tag = currentTag();
      if (tag) {
        tag.appearanceSource = "custom";
        formSource.textContent = `${sourceLabels[tag.source] || tag.source} · Custom appearance`;
      }
    };

    const animationLabels = {
      none: "None",
      rainbow: "Rainbow",
      marquee: "Marquee",
      ghost: "Ghost",
      bounce: "Bounce",
    };

    const hslFromHex = (hex) => {
      const [red, green, blue] = rgbFromHex(hex).map((channel) => channel / 255);
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const delta = maximum - minimum;
      const lightness = (maximum + minimum) / 2;
      if (delta === 0) return { hue: 0, saturation: 0, lightness };
      const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
      let hue;
      if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
      else if (maximum === green) hue = 60 * (((blue - red) / delta) + 2);
      else hue = 60 * (((red - green) / delta) + 4);
      return { hue: (hue + 360) % 360, saturation, lightness };
    };

    const renderAnimatedText = (element, text, animation, baseColor) => {
      const effect = animationLabels[animation] ? animation : "none";
      const wrapper = document.createElement("span");
      wrapper.className = `tag-animated-text is-${effect}`;
      if (effect === "rainbow") {
        const hsl = hslFromHex(baseColor);
        const saturation = Math.max(72, Math.round(hsl.saturation * 100));
        const lightness = Math.min(72, Math.max(45, Math.round(hsl.lightness * 100)));
        wrapper.style.setProperty("--rainbow-0", baseColor);
        [1, 2, 3, 4, 5].forEach((step) => {
          wrapper.style.setProperty(`--rainbow-${step}`, `hsl(${(hsl.hue + (step * 60)) % 360} ${saturation}% ${lightness}%)`);
        });
      }
      if (["marquee", "bounce"].includes(effect)) {
        wrapper.setAttribute("aria-label", text);
        wrapper.style.setProperty("--animation-cycle", `${Math.max(1.8, Array.from(text).length * 0.18)}s`);
        Array.from(text).forEach((character, index) => {
          const letter = document.createElement("span");
          letter.className = "tag-animated-letter";
          letter.setAttribute("aria-hidden", "true");
          letter.style.setProperty("--letter-index", index);
          letter.textContent = character === " " ? "\u00a0" : character;
          wrapper.append(letter);
        });
      } else {
        wrapper.textContent = text;
      }
      element.replaceChildren(wrapper);
    };

    const renderAnimationSelection = (animation) => {
      renderAnimatedText(animationValue, animationLabels[animation] || animationLabels.none, animation, "#f0f0eb");
      animationOptions.forEach((option) => option.setAttribute("aria-selected", String(option.dataset.animationValue === animation)));
    };

    animationOptions.forEach((option) => {
      const animation = option.dataset.animationValue;
      renderAnimatedText(option.querySelector("[data-animation-preview]"), animationLabels[animation], animation, "#e4e4de");
    });

    const previewBadge = (element, tag, surfaceColor) => {
      const presentation = tag.presentation;
      element.style.background = presentation.background === "transparent"
        ? "transparent"
        : presentation.background === "gradient"
          ? gradientValue(presentation)
          : presentation.colors[0];
      const contrastColors = presentation.background === "transparent" ? [surfaceColor] : presentation.background === "gradient" ? presentation.colors : [presentation.colors[0]];
      const foreground = presentation.textMode === "custom" ? presentation.textColor : readableForeground(...contrastColors);
      const effectEdge = luminance(rgbFromHex(foreground)) > 0.45 ? "#171717" : "#ffffff";
      element.style.color = foreground;
      element.style.borderColor = presentation.borderColor;
      element.style.borderStyle = presentation.borderWidth === "none" ? "none" : "solid";
      element.style.borderWidth = presentation.borderWidth === "medium" ? "2px" : presentation.borderWidth === "thin" ? "1px" : "0";
      element.style.borderRadius = presentation.corners === "pill" ? "999px" : presentation.corners === "rounded" ? "0.35rem" : "0";
      element.style.padding = presentation.padding === "roomy" ? "0.45rem 0.9rem" : presentation.padding === "standard" ? "0.3rem 0.7rem" : "0.18rem 0.5rem";
      element.style.fontWeight = presentation.weight === "bold" ? "800" : presentation.weight === "medium" ? "600" : "400";
      element.style.fontStyle = presentation.fontStyle;
      element.style.textDecoration = presentation.decoration === "strike" ? "line-through" : presentation.decoration;
      element.style.textShadow = presentation.textEffect === "outline"
        ? `-1px -1px 0 ${effectEdge}, 1px -1px 0 ${effectEdge}, -1px 1px 0 ${effectEdge}, 1px 1px 0 ${effectEdge}`
        : presentation.textEffect === "shadow"
          ? "0 2px 2px rgb(0 0 0 / 65%)"
          : presentation.textEffect === "glow"
            ? "0 0 0.25em currentColor, 0 0 0.55em currentColor"
            : "none";
      renderAnimatedText(element, tag.name, presentation.animation, foreground);
    };

    const renderGradientEditor = () => {
      const tag = currentTag();
      if (!tag) return;
      const presentation = tag.presentation;
      if (!Array.isArray(presentation.positions) || presentation.positions.length !== presentation.colors.length) {
        presentation.positions = presentation.colors.map((_, index) => Math.round((index / (presentation.colors.length - 1)) * 100));
      }
      selectedGradientStop = Math.min(selectedGradientStop, presentation.colors.length - 1);
      gradientTrack.replaceChildren();
      gradientTrack.style.background = gradientValue(presentation, 90);
      presentation.colors.forEach((color, index) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "tag-gradient-node";
        node.classList.toggle("is-selected", index === selectedGradientStop);
        node.style.left = `${presentation.positions[index]}%`;
        node.style.setProperty("--stop-color", color);
        node.setAttribute("aria-label", `Gradient stop ${index + 1}, ${presentation.positions[index]} percent`);
        node.addEventListener("click", () => {
          selectedGradientStop = index;
          renderGradientEditor();
          syncFieldAvailability();
        });
        if (index > 0 && index < presentation.colors.length - 1) {
          node.addEventListener("pointerdown", (event) => {
            if (backgroundInput.value !== "gradient") return;
            event.preventDefault();
            const move = (pointerEvent) => {
              const bounds = gradientTrack.getBoundingClientRect();
              const unclamped = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
              const minimum = presentation.positions[index - 1] + 1;
              const maximum = presentation.positions[index + 1] - 1;
              presentation.positions[index] = Math.round(Math.min(maximum, Math.max(minimum, unclamped)));
              gradientStopPosition.value = presentation.positions[index];
              gradientStopOutput.textContent = `${presentation.positions[index]}%`;
              node.style.left = `${presentation.positions[index]}%`;
              gradientTrack.style.background = gradientValue(presentation, 90);
              markAppearanceCustom();
              refreshDerivedDescendants(tag.name);
              renderProfilePreview();
            };
            const finish = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", finish);
              renderProfileList();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", finish, { once: true });
          });
        }
        gradientTrack.append(node);
      });
      gradientStopColor.value = presentation.colors[selectedGradientStop];
      gradientStopPosition.value = presentation.positions[selectedGradientStop];
      gradientStopOutput.textContent = `${presentation.positions[selectedGradientStop]}%`;
    };

    const setFieldLocked = (field, locked) => field.classList.toggle("is-locked", locked);

    const syncFieldAvailability = () => {
      const tag = currentTag();
      const solid = backgroundInput.value === "solid";
      const gradient = backgroundInput.value === "gradient";
      const endpoint = selectedGradientStop === 0 || selectedGradientStop === tag.presentation.colors.length - 1;
      parentField.classList.toggle("is-locked", tag.source === "builtin");
      setFieldLocked(solidField, !solid);
      solidColorInput.disabled = !solid;
      setFieldLocked(gradientEditor, !gradient);
      gradientEditor.setAttribute("aria-disabled", String(!gradient));
      gradientAdd.disabled = !gradient || tag.presentation.colors.length >= 6;
      gradientStopColor.disabled = !gradient;
      gradientStopPosition.disabled = !gradient || endpoint;
      gradientRemove.disabled = !gradient || endpoint;
      gradientPositionField.classList.toggle("is-locked", gradient && endpoint);
      gradientRemove.title = endpoint ? "Endpoint stops cannot be removed." : "Remove the selected interior stop.";
      angleInput.disabled = !gradient;
      setFieldLocked(textColorField, textModeInput.value !== "custom");
      textColorInput.disabled = textModeInput.value !== "custom";
      gradientTrack.querySelectorAll("button").forEach((button) => { button.disabled = !gradient; });
    };

    const renderProfilePreview = () => {
      const tag = currentTag();
      if (!tag) return;
      previewHeading.textContent = tag.name;
      previewBadge(previewDark, tag, "#20201e");
      previewBadge(previewLight, tag, "#f5f1e6");
      previewSource.textContent = sourceLabels[tag.source] || tag.source;
      previewParent.textContent = tag.parent || "Top level";
      previewAliases.textContent = tag.aliases.length ? tag.aliases.join(", ") : "None";
      previewAppearance.textContent = tag.appearanceSource === "builtin" ? "Built-in preset" : tag.appearanceSource === "derived" ? `Derived from ${tag.parent || "Miscellaneous"}` : "Custom override";
    };

    const syncProfileForm = () => {
      const tag = currentTag();
      if (!tag) return;
      const presentation = tag.presentation;
      formHeading.textContent = tag.name;
      formSource.textContent = `${sourceLabels[tag.source] || tag.source} · ${tag.appearanceSource === "derived" ? `Derived from ${tag.parent}` : tag.appearanceSource === "custom" ? "Custom appearance" : "Built-in preset"}`;
      resetTagButton.textContent = "Reset";
      const resetMeaning = tag.source === "builtin" ? "Reset to the built-in appearance" : `Reset to appearance derived from ${tag.parent || "Miscellaneous"}`;
      resetTagButton.title = resetMeaning;
      resetTagButton.setAttribute("aria-label", resetMeaning);
      nameInput.value = tag.name;
      populateParentOptions(tag);
      renderAliasEditor(tag);
      backgroundInput.value = presentation.background;
      solidColorInput.value = presentation.colors[0];
      angleInput.value = presentation.angle;
      borderColorInput.value = presentation.borderColor;
      borderWidthInput.value = presentation.borderWidth;
      cornersInput.value = presentation.corners;
      paddingInput.value = presentation.padding;
      textModeInput.value = presentation.textMode;
      textColorInput.value = presentation.textColor;
      weightInput.value = presentation.weight;
      fontStyleInput.value = presentation.fontStyle;
      decorationInput.value = presentation.decoration;
      textEffectInput.value = presentation.textEffect;
      renderAnimationSelection(presentation.animation);
      animationMenu.hidden = true;
      animationButton.setAttribute("aria-expanded", "false");
      deleteTagButton.hidden = !["manual", "imported"].includes(tag.source);
      deleteTagButton.title = deleteTagButton.hidden ? "" : `Delete the profile-only tag ${tag.name}`;
      renderGradientEditor();
      syncFieldAvailability();
      renderProfilePreview();
    };

    function selectProfileTag(key) {
      if (!profileTags.has(key)) return;
      selectedProfileTag = key;
      selectedGradientStop = 1;
      renderProfileList();
      syncProfileForm();
    }

    const updateRelationshipFields = () => {
      const tag = currentTag();
      if (!tag) return;
      if (tag.source !== "builtin" && tag.parent !== parentInput.value) {
        tag.parent = parentInput.value;
        if (tag.appearanceSource === "derived") {
          deriveAppearanceFromParent(tag);
          refreshDerivedDescendants(tag.name);
        }
      }
      syncProfileForm();
      renderProfileList();
    };

    const updatePresentationFields = () => {
      const tag = currentTag();
      if (!tag) return;
      tag.appearanceSource = "custom";
      tag.presentation.background = backgroundInput.value;
      if (backgroundInput.value === "solid") tag.presentation.colors[0] = solidColorInput.value;
      tag.presentation.angle = Math.min(360, Math.max(0, Number(angleInput.value) || 0));
      tag.presentation.borderColor = borderColorInput.value;
      tag.presentation.borderWidth = borderWidthInput.value;
      tag.presentation.corners = cornersInput.value;
      tag.presentation.padding = paddingInput.value;
      tag.presentation.textMode = textModeInput.value;
      tag.presentation.textColor = textColorInput.value;
      tag.presentation.weight = weightInput.value;
      tag.presentation.fontStyle = fontStyleInput.value;
      tag.presentation.decoration = decorationInput.value;
      tag.presentation.textEffect = textEffectInput.value;
      refreshDerivedDescendants(tag.name);
      renderGradientEditor();
      syncFieldAvailability();
      renderProfilePreview();
      renderProfileList();
      formSource.textContent = `${sourceLabels[tag.source] || tag.source} · Custom appearance`;
    };

    parentInput.addEventListener("change", updateRelationshipFields);
    [backgroundInput, solidColorInput, angleInput, borderColorInput, borderWidthInput, cornersInput, paddingInput,
      textModeInput, textColorInput, weightInput, fontStyleInput, decorationInput, textEffectInput].forEach((control) => {
      control.addEventListener(control.matches('input[type="color"], input[type="number"]') ? "input" : "change", updatePresentationFields);
    });

    const setAnimationMenuOpen = (open, focusSelection = false) => {
      animationMenu.hidden = !open;
      animationButton.setAttribute("aria-expanded", String(open));
      if (open && focusSelection) {
        (animationOptions.find((option) => option.getAttribute("aria-selected") === "true") || animationOptions[0]).focus();
      }
    };

    const selectAnimation = (animation) => {
      const tag = currentTag();
      if (!tag || !animationLabels[animation]) return;
      tag.presentation.animation = animation;
      markAppearanceCustom();
      refreshDerivedDescendants(tag.name);
      renderAnimationSelection(animation);
      renderProfilePreview();
      renderProfileList();
      setAnimationMenuOpen(false);
      animationButton.focus();
    };

    animationButton.addEventListener("click", () => setAnimationMenuOpen(animationMenu.hidden));
    animationButton.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      setAnimationMenuOpen(true, true);
    });
    animationOptions.forEach((option, index) => {
      option.addEventListener("click", () => selectAnimation(option.dataset.animationValue));
      option.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setAnimationMenuOpen(false);
          animationButton.focus();
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0
          : event.key === "End" ? animationOptions.length - 1
            : event.key === "ArrowDown" ? (index + 1) % animationOptions.length
              : (index - 1 + animationOptions.length) % animationOptions.length;
        animationOptions[nextIndex].focus();
      });
    });
    profileEditor.addEventListener("click", (event) => {
      if (!animationControl.contains(event.target)) setAnimationMenuOpen(false);
    });

    aliasTarget.addEventListener("change", () => { aliasAdd.disabled = !aliasTarget.value; });
    aliasAdd.addEventListener("click", () => {
      if (!aliasTarget.value) return;
      linkAliasPair(selectedProfileTag, aliasTarget.value);
      renderAliasEditor(currentTag());
      renderProfilePreview();
      renderProfileList();
    });

    gradientAdd.addEventListener("click", () => {
      const tag = currentTag();
      const presentation = tag.presentation;
      if (presentation.colors.length >= 6) return;
      let insertAfter = 0;
      let largestGap = 0;
      for (let index = 0; index < presentation.positions.length - 1; index += 1) {
        const gap = presentation.positions[index + 1] - presentation.positions[index];
        if (gap > largestGap) { largestGap = gap; insertAfter = index; }
      }
      const position = Math.round((presentation.positions[insertAfter] + presentation.positions[insertAfter + 1]) / 2);
      const color = mixHex(presentation.colors[insertAfter], presentation.colors[insertAfter + 1], 0.5);
      presentation.positions.splice(insertAfter + 1, 0, position);
      presentation.colors.splice(insertAfter + 1, 0, color);
      selectedGradientStop = insertAfter + 1;
      markAppearanceCustom();
      refreshDerivedDescendants(tag.name);
      renderGradientEditor();
      syncFieldAvailability();
      renderProfilePreview();
      renderProfileList();
    });

    gradientRemove.addEventListener("click", () => {
      const presentation = currentTag().presentation;
      if (selectedGradientStop === 0 || selectedGradientStop === presentation.colors.length - 1) return;
      presentation.colors.splice(selectedGradientStop, 1);
      presentation.positions.splice(selectedGradientStop, 1);
      selectedGradientStop = Math.min(selectedGradientStop, presentation.colors.length - 2);
      markAppearanceCustom();
      refreshDerivedDescendants(currentTag().name);
      renderGradientEditor();
      syncFieldAvailability();
      renderProfilePreview();
      renderProfileList();
    });

    gradientStopColor.addEventListener("input", () => {
      const presentation = currentTag().presentation;
      presentation.colors[selectedGradientStop] = gradientStopColor.value;
      markAppearanceCustom();
      refreshDerivedDescendants(currentTag().name);
      renderGradientEditor();
      syncFieldAvailability();
      renderProfilePreview();
      renderProfileList();
    });

    gradientStopPosition.addEventListener("input", () => {
      const presentation = currentTag().presentation;
      const minimum = presentation.positions[selectedGradientStop - 1] + 1;
      const maximum = presentation.positions[selectedGradientStop + 1] - 1;
      presentation.positions[selectedGradientStop] = Math.min(maximum, Math.max(minimum, Number(gradientStopPosition.value)));
      markAppearanceCustom();
      refreshDerivedDescendants(currentTag().name);
      renderGradientEditor();
      syncFieldAvailability();
      renderProfilePreview();
      renderProfileList();
    });

    resetTagButton.addEventListener("click", () => {
      const tag = currentTag();
      if (!tag) return;
      if (tag.source === "builtin") {
        tag.presentation = clone(tag.defaultState.presentation);
        tag.appearanceSource = "builtin";
      } else {
        deriveAppearanceFromParent(tag);
      }
      refreshDerivedDescendants(tag.name);
      selectedGradientStop = 1;
      syncProfileForm();
      renderProfileList();
    });

    deleteTagButton.addEventListener("click", () => {
      const tag = currentTag();
      if (!tag || !["manual", "imported"].includes(tag.source)) return;
      const deletedKey = selectedProfileTag;
      const replacementParent = tag.parent || "Miscellaneous";
      const children = [...profileTags.values()].filter((candidate) => normalizeTag(candidate.parent || "") === deletedKey);
      [...tag.aliases].forEach((alias) => unlinkAliasPair(deletedKey, normalizeTag(alias)));
      profileTags.delete(deletedKey);
      children.forEach((child) => { child.parent = replacementParent; });
      children.filter((child) => child.appearanceSource === "derived").forEach((child) => {
        deriveAppearanceFromParent(child);
        refreshDerivedDescendants(child.name);
      });
      selectedProfileTag = profileTags.has(normalizeTag(replacementParent)) ? normalizeTag(replacementParent) : "miscellaneous";
      renderProfileList();
      syncProfileForm();
    });

    const closeAddPanels = () => {
      acquiredPicker.hidden = true;
      manualPanel.hidden = true;
    };
    acquiredButton.addEventListener("click", () => {
      const opening = acquiredPicker.hidden;
      closeAddPanels();
      acquiredPicker.hidden = !opening;
    });
    manualButton.addEventListener("click", () => {
      const opening = manualPanel.hidden;
      closeAddPanels();
      manualPanel.hidden = !opening;
      if (opening) manualName.focus();
    });
    profileEditor.querySelectorAll("[data-close-tag-add]").forEach((button) => button.addEventListener("click", closeAddPanels));

    const addProfileTag = (name, source) => {
      const cleanName = name.trim().replace(/\s+/g, " ");
      const key = normalizeTag(cleanName);
      if (!key) return { error: "Enter a non-empty tag string." };
      if (profileTags.has(key)) {
        selectProfileTag(key);
        return { error: `${cleanName} is already in this profile.` };
      }
      const tag = createTag(cleanName, source, "Miscellaneous", stableColorFor(cleanName));
      profileTags.set(key, tag);
      deriveAppearanceFromParent(tag);
      selectProfileTag(key);
      return { tag };
    };

    acquiredApply.addEventListener("click", () => {
      const detected = [...acquiredPicker.querySelectorAll("[data-acquired-tag]")];
      let lastKey = null;
      detected.forEach((item) => {
        const result = addProfileTag(item.dataset.acquiredTag, "acquired");
        if (result.tag) {
          lastKey = normalizeTag(result.tag.name);
          item.remove();
        }
      });
      closeAddPanels();
      if (lastKey) selectProfileTag(lastKey);
    });

    const applyManualTag = () => {
      const result = addProfileTag(manualName.value, "manual");
      if (result.error) {
        manualMessage.textContent = result.error;
        return;
      }
      manualName.value = "";
      manualMessage.textContent = "New tags begin under Miscellaneous.";
      closeAddPanels();
    };
    profileEditor.querySelector("#tag-manual-apply").addEventListener("click", applyManualTag);
    manualName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyManualTag();
      }
    });
    profileSearch.addEventListener("input", renderProfileList);

    const collectAliasLinks = (tagsToUse = profileTags) => {
      const links = [];
      const seen = new Set();
      tagsToUse.forEach((tag) => tag.aliases.forEach((alias) => {
        const pair = [tag.name, tagsToUse.get(normalizeTag(alias))?.name || alias].sort((first, second) => normalizeTag(first).localeCompare(normalizeTag(second)));
        const key = pair.map(normalizeTag).join("\u0000");
        if (!seen.has(key)) { seen.add(key); links.push({ tags: pair }); }
      }));
      return links;
    };

    const exportedProfile = () => ({
      schemaVersion: 1,
      tags: [...profileTags.values()].map((tag) => ({
        name: tag.name,
        source: tag.source,
        parent: tag.parent,
        appearanceSource: tag.appearanceSource,
        presentation: clone(tag.presentation),
      })),
      aliasLinks: collectAliasLinks(),
    });

    const buildReplaceBase = () => {
      const replacement = buildBuiltIns();
      [...profileTags.values()].filter((tag) => tag.source === "acquired").forEach((tag) => {
        const reset = createTag(tag.name, "acquired", tag.parent || "Miscellaneous", stableColorFor(tag.name));
        reset.aliases = [];
        replacement.set(normalizeTag(reset.name), reset);
      });
      [...replacement.values()].filter((tag) => tag.source !== "builtin").forEach((tag) => deriveAppearanceFromParent(tag, replacement));
      return replacement;
    };

    const openJsonPanel = (mode) => {
      closeAddPanels();
      jsonPanel.hidden = false;
      jsonContent.readOnly = mode === "export";
      jsonModeWrapper.hidden = mode !== "import";
      jsonApply.hidden = mode !== "import";
      if (mode === "export") {
        jsonHeading.textContent = "Export tag profile JSON";
        jsonContent.value = JSON.stringify(exportedProfile(), null, 2);
        jsonMessage.textContent = "Export includes user relationships and presentation, not acquired records or Jump content.";
      } else {
        jsonHeading.textContent = "Import tag profile JSON";
        jsonContent.value = "";
        jsonContent.placeholder = "Paste a versioned tag profile JSON document here.";
        jsonMessage.textContent = "Nothing changes until the document validates and the import is applied.";
        jsonContent.focus();
      }
    };

    profileEditor.querySelector("#tag-json-export").addEventListener("click", () => openJsonPanel("export"));
    profileEditor.querySelector("#tag-json-import").addEventListener("click", () => openJsonPanel("import"));
    profileEditor.querySelector("#tag-json-close").addEventListener("click", () => { jsonPanel.hidden = true; });

    const applyImportedPresentation = (tag, imported) => {
      const presentation = imported.presentation || {};
      const allowed = {
        background: ["solid", "gradient", "transparent"],
        borderWidth: ["none", "thin", "medium"],
        corners: ["pill", "rounded", "square"],
        padding: ["compact", "standard", "roomy"],
        textMode: ["auto", "custom"],
        weight: ["normal", "medium", "bold"],
        fontStyle: ["normal", "italic"],
        decoration: ["none", "underline", "strike"],
        textEffect: ["none", "outline", "shadow", "glow"],
        animation: ["none", "rainbow", "marquee", "ghost", "bounce"],
      };
      Object.entries(allowed).forEach(([field, values]) => {
        if (presentation[field] !== undefined) {
          if (!values.includes(presentation[field])) throw new Error(`Unsupported ${field} value for ${tag.name}.`);
          tag.presentation[field] = presentation[field];
        }
      });
      if (presentation.colors !== undefined) {
        if (!Array.isArray(presentation.colors) || presentation.colors.length < 2 || presentation.colors.length > 6 || !presentation.colors.every(validHex)) {
          throw new Error(`Invalid color list for ${tag.name}.`);
        }
        tag.presentation.colors = presentation.colors.map((color) => color.toLowerCase());
        if (presentation.positions === undefined) {
          tag.presentation.positions = presentation.colors.map((_, index) => Math.round((index / (presentation.colors.length - 1)) * 100));
        }
      }
      if (presentation.positions !== undefined) {
        if (!Array.isArray(presentation.positions) || presentation.positions.length !== tag.presentation.colors.length ||
          presentation.positions[0] !== 0 || presentation.positions.at(-1) !== 100 ||
          presentation.positions.some((position, index) => !Number.isFinite(position) || position < 0 || position > 100 || (index > 0 && position <= presentation.positions[index - 1]))) {
          throw new Error(`Invalid gradient stop positions for ${tag.name}.`);
        }
        tag.presentation.positions = [...presentation.positions];
      }
      if (presentation.borderColor !== undefined) {
        if (!validHex(presentation.borderColor)) throw new Error(`Invalid border color for ${tag.name}.`);
        tag.presentation.borderColor = presentation.borderColor.toLowerCase();
      }
      if (presentation.textColor !== undefined) {
        if (!validHex(presentation.textColor)) throw new Error(`Invalid text color for ${tag.name}.`);
        tag.presentation.textColor = presentation.textColor.toLowerCase();
      }
      if (presentation.angle !== undefined) {
        if (!Number.isFinite(presentation.angle) || presentation.angle < 0 || presentation.angle > 360) throw new Error(`Invalid gradient angle for ${tag.name}.`);
        tag.presentation.angle = presentation.angle;
      }
    };

    jsonApply.addEventListener("click", () => {
      try {
        const imported = JSON.parse(jsonContent.value);
        if (imported?.schemaVersion !== 1 || !Array.isArray(imported.tags)) throw new Error("Expected schemaVersion 1 with a tags array.");
        const nextTags = jsonMode.value === "replace"
          ? buildReplaceBase()
          : new Map([...profileTags].map(([key, tag]) => [key, clone(tag)]));
        const importedKeys = new Set();
        imported.tags.forEach((entry) => {
          if (!entry || typeof entry.name !== "string" || !entry.name.trim()) throw new Error("Every imported tag needs a non-empty name.");
          const name = entry.name.trim().replace(/\s+/g, " ");
          const key = normalizeTag(name);
          if (importedKeys.has(key)) throw new Error(`Duplicate imported tag: ${name}.`);
          importedKeys.add(key);
          const existing = nextTags.get(key);
          const tag = existing || createTag(name, "imported", "Miscellaneous", stableColorFor(name));
          if (entry.parent !== undefined && entry.parent !== null && typeof entry.parent !== "string") throw new Error(`Invalid parent for ${name}.`);
          if (tag.source !== "builtin") tag.parent = entry.parent?.trim() || "Miscellaneous";
          if (entry.appearanceSource !== undefined && !["builtin", "derived", "custom"].includes(entry.appearanceSource)) throw new Error(`Invalid appearance source for ${name}.`);
          applyImportedPresentation(tag, entry);
          tag.appearanceSource = tag.source === "builtin"
            ? entry.appearanceSource === "custom" ? "custom" : "builtin"
            : entry.appearanceSource || "custom";
          if (!existing) tag.defaultState = clone(tag);
          nextTags.set(key, tag);
        });
        nextTags.forEach((tag) => {
          if (tag.parent && !nextTags.has(normalizeTag(tag.parent))) throw new Error(`Unknown parent “${tag.parent}” for ${tag.name}.`);
          if (tag.parent && wouldCreateCycle(tag.name, tag.parent, nextTags)) throw new Error(`Parent cycle involving ${tag.name}.`);
        });
        [...nextTags.values()].filter((tag) => tag.appearanceSource === "derived").forEach((tag) => deriveAppearanceFromParent(tag, nextTags));
        if (imported.aliasLinks !== undefined) {
          if (!Array.isArray(imported.aliasLinks)) throw new Error("aliasLinks must be an array.");
          imported.aliasLinks.forEach((link) => {
            if (!link || !Array.isArray(link.tags) || link.tags.length !== 2 || !link.tags.every((name) => typeof name === "string" && name.trim())) throw new Error("Every alias link must contain exactly two tag strings.");
            const [first, second] = link.tags.map(normalizeTag);
            if (!nextTags.has(first) || !nextTags.has(second)) throw new Error(`Alias link references an unknown tag: ${link.tags.join(" / ")}.`);
            linkAliasPair(first, second, nextTags);
          });
        }
        profileTags = nextTags;
        if (!profileTags.has(selectedProfileTag)) selectedProfileTag = "physical";
        renderProfileList();
        syncProfileForm();
        jsonMessage.textContent = `Imported ${imported.tags.length} tag entr${imported.tags.length === 1 ? "y" : "ies"}.`;
      } catch (error) {
        jsonMessage.textContent = `Import not applied: ${error.message}`;
      }
    });

    renderProfileList();
    syncProfileForm();
  }

  if (lab) selectTag(selectedTag);
})();
