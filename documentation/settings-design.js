(() => {
  const tabList = document.querySelector(".settings-mockup [role='tablist']");
  if (!tabList) return;
  const tabs = [...tabList.querySelectorAll(":scope > [role='tab']")];
  const mockup = document.querySelector(".settings-mockup");
  const searchInput = document.querySelector("#mock-settings-search");
  const searchPanel = document.querySelector("#settings-search-panel");
  const searchCount = document.querySelector("#mock-settings-search-count");
  const noSearchResults = document.querySelector("#mock-settings-no-results");
  const searchEntries = [...document.querySelectorAll("[data-settings-search-entry]")];
  document.querySelectorAll(".setting-state.agreed").forEach((indicator) => {
    if (indicator.textContent.trim() === "Agreed") indicator.remove();
  });
  let activeTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];

  const showActiveCategory = () => {
    tabs.forEach((tab) => {
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = tab !== activeTab;
    });
  };

  const updateSearch = () => {
    if (!searchInput || !searchPanel || !searchCount || !noSearchResults) return;
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      searchPanel.hidden = true;
      showActiveCategory();
      return;
    }

    tabs.forEach((tab) => {
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = true;
    });
    searchPanel.hidden = false;
    const terms = query.split(/\s+/);
    const matches = searchEntries.filter((entry) => (
      terms.every((term) => entry.dataset.settingsSearchText.includes(term))
    ));
    searchEntries.forEach((entry) => { entry.hidden = !matches.includes(entry); });
    searchCount.textContent = matches.length === 1 ? "1 result" : `${matches.length} results`;
    noSearchResults.hidden = matches.length !== 0;
  };

  const activate = (nextTab, moveFocus = false) => {
    activeTab = nextTab;
    if (searchInput) searchInput.value = "";
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    if (searchPanel) searchPanel.hidden = true;
    showActiveCategory();
    if (moveFocus) nextTab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % tabs.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[nextIndex], true);
    });
  });

  searchInput?.addEventListener("input", updateSearch);
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !searchInput.value) return;
    event.preventDefault();
    searchInput.value = "";
    updateSearch();
  });

  searchPanel?.addEventListener("click", (event) => {
    const result = event.target.closest("[data-settings-search-entry]");
    if (!result) return;
    const nextTab = document.querySelector(`#settings-${result.dataset.settingsCategory}-tab`);
    if (!nextTab) return;
    activate(nextTab);
    const focusTarget = result.dataset.settingsFocus
      ? document.getElementById(result.dataset.settingsFocus)
      : document.getElementById(nextTab.getAttribute("aria-controls"))?.querySelector("button, select, input");
    if (focusTarget?.matches("[role='tab']")) focusTarget.click();
    const owningSection = focusTarget?.closest(".settings-section");
    if (owningSection) owningSection.open = true;
    focusTarget?.focus();
  });

  const developerTabs = [...document.querySelectorAll(".settings-subtabs [role='tab']")];
  const activateDeveloperTab = (nextTab, moveFocus = false) => {
    developerTabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) nextTab.focus();
  };
  developerTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateDeveloperTab(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % developerTabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + developerTabs.length) % developerTabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = developerTabs.length - 1;
      else return;
      event.preventDefault();
      activateDeveloperTab(developerTabs[nextIndex], true);
    });
  });

  const notificationsEnabled = document.querySelector("#mock-notifications-enabled");
  const notificationsMax = document.querySelector("#mock-notifications-max");
  const notificationsDuration = document.querySelector("#mock-notifications-duration");
  const notificationClasses = [...document.querySelectorAll("[data-notification-class]")];
  const toastPreview = document.querySelector("#mock-toast-preview");
  const toastStage = document.querySelector("#mock-toast-stage");
  let toastDebounceTimer;

  const toastLimit = () => Number.parseInt(notificationsMax.value, 10) || 3;
  const confirmationToastsEnabled = () => notificationClasses.find((input) => input.dataset.notificationClass === "confirmations")?.checked;
  const showSettingsToast = () => {
    if (!notificationsEnabled.checked || !confirmationToastsEnabled()) return;
    const existing = toastStage.querySelector("[data-toast-key='settings-preview']");
    if (existing) {
      const count = Number(existing.dataset.toastCount || 1) + 1;
      existing.dataset.toastCount = String(count);
      existing.querySelector("small").textContent = `Action confirmation · ${count} occurrences`;
      existing.restartDismissal?.();
      return;
    }
    const toast = document.createElement("article");
    toast.className = "settings-toast";
    toast.dataset.toastKey = "settings-preview";
    toast.dataset.toastCount = "1";
    toast.tabIndex = 0;
    const icon = document.createElement("span");
    icon.textContent = "✓";
    icon.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    const message = document.createElement("p");
    message.textContent = "Notification preferences updated.";
    const detail = document.createElement("small");
    detail.textContent = "Action confirmation";
    content.append(message, detail);
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss notification preview");
    close.addEventListener("click", () => toast.remove());
    toast.append(icon, content, close);
    toastStage.prepend(toast);
    while (toastStage.children.length > toastLimit()) toastStage.lastElementChild.remove();
    let timeout;
    const pauseDismissal = () => window.clearTimeout(timeout);
    const resumeDismissal = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => toast.remove(), Number(notificationsDuration.value));
    };
    toast.restartDismissal = resumeDismissal;
    toast.addEventListener("mouseenter", pauseDismissal);
    toast.addEventListener("mouseleave", resumeDismissal);
    toast.addEventListener("focusin", pauseDismissal);
    toast.addEventListener("focusout", resumeDismissal);
    resumeDismissal();
  };
  const scheduleSettingsToast = () => {
    window.clearTimeout(toastDebounceTimer);
    toastDebounceTimer = window.setTimeout(showSettingsToast, 500);
  };
  const syncNotificationControls = () => {
    const disabled = !notificationsEnabled.checked;
    notificationsMax.disabled = disabled;
    notificationsDuration.disabled = disabled;
    notificationClasses.forEach((input) => { input.disabled = disabled; });
    toastPreview.disabled = disabled || !confirmationToastsEnabled();
    if (disabled) toastStage.replaceChildren();
  };
  notificationsEnabled?.addEventListener("change", () => {
    syncNotificationControls();
    scheduleSettingsToast();
  });
  [notificationsMax, notificationsDuration, ...notificationClasses].forEach((control) => control?.addEventListener("change", () => {
    syncNotificationControls();
    scheduleSettingsToast();
  }));
  toastPreview?.addEventListener("click", scheduleSettingsToast);
  syncNotificationControls();

  const accentInput = document.querySelector("#mock-accent");
  const accentValue = document.querySelector("#mock-accent-value");
  const accentReset = document.querySelector("#mock-accent-reset");
  const defaultAccent = "#d4af37";

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
  const hexFromRgb = (rgb) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  const accessibleAccentForDarkSurface = (hex) => {
    const base = rgbFromHex(hex);
    const background = rgbFromHex("#20201e");
    for (let amount = 0; amount <= 1; amount += 0.02) {
      const candidate = base.map((channel) => channel + ((255 - channel) * amount));
      if (contrast(candidate, background) >= 3) return hexFromRgb(candidate);
    }
    return "#ffffff";
  };

  const applyAccent = (hex) => {
    if (!mockup || !accentInput || !accentValue) return;
    const normalized = hex.toLowerCase();
    mockup.style.setProperty("--mock-accent", normalized);
    mockup.style.setProperty("--mock-accent-ui", accessibleAccentForDarkSurface(normalized));
    accentInput.value = normalized;
    accentValue.value = normalized.toUpperCase();
    accentValue.textContent = normalized.toUpperCase();
  };

  accentInput?.addEventListener("input", () => applyAccent(accentInput.value));
  accentReset?.addEventListener("click", () => applyAccent(defaultAccent));
  applyAccent(defaultAccent);
})();
