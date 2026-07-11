(() => {
  const routes = {
    home: { path: "/", title: "Home · Jumpchain Visualizer" },
    editor: { path: "/editor", title: "Editor · Jumpchain Visualizer" },
    "editor-workspace": { path: "/editor/ws-7f3a", title: "Example Jump · Editor" },
    chain: { path: "/chain", title: "Chain Tracker · Jumpchain Visualizer" },
    "chain-workspace": { path: "/chain/ch-92b1", title: "Morgan · Chain Tracker" },
    settings: { path: "/settings", title: "Settings · Jumpchain Visualizer" },
  };

  const shell = document.querySelector(".app-shell-mockup");
  const path = document.querySelector("#app-mock-path");
  const title = document.querySelector("#app-mock-title");
  const back = document.querySelector("#app-mock-back");
  const forward = document.querySelector("#app-mock-forward");
  const settingsLayer = document.querySelector("#app-settings-layer");
  const settingsButton = document.querySelector(".app-mock-settings");
  if (!shell || !path || !title || !back || !forward || !settingsLayer || !settingsButton) return;

  const history = [{ routeKey: "home" }];
  let historyIndex = 0;

  const currentEntry = () => history[historyIndex];

  const visibleRouteFor = (entry) => (
    entry.routeKey === "settings" ? entry.backgroundKey || "home" : entry.routeKey
  );

  const renderRoute = (entry, moveFocus = true) => {
    const route = routes[entry.routeKey];
    if (!route) return;
    const visibleRoute = visibleRouteFor(entry);
    const settingsOpen = entry.routeKey === "settings";

    path.textContent = route.path;
    title.textContent = route.title;
    shell.querySelectorAll("[data-app-panel]").forEach((panel) => {
      const visible = panel.dataset.appPanel === visibleRoute;
      panel.hidden = !visible;
      panel.inert = settingsOpen && visible;
    });
    settingsLayer.hidden = !settingsOpen;

    shell.querySelectorAll(".app-mock-header [data-app-route]").forEach((button) => {
      const buttonRoute = button.dataset.appRoute;
      const workspaceSelected = buttonRoute === visibleRoute
        || (visibleRoute === "editor-workspace" && buttonRoute === "editor")
        || (visibleRoute === "chain-workspace" && buttonRoute === "chain");
      button.setAttribute("aria-pressed", String(buttonRoute === "settings" ? settingsOpen : workspaceSelected));
    });

    back.disabled = historyIndex === 0;
    forward.disabled = historyIndex === history.length - 1;
    if (!moveFocus) return;
    if (settingsOpen) settingsLayer.querySelector("h3")?.focus();
    else shell.querySelector(`[data-app-panel="${visibleRoute}"] h3`)?.focus();
  };

  const navigate = (routeKey) => {
    if (!routes[routeKey]) return;
    const current = currentEntry();
    if (current.routeKey === routeKey) return;
    const nextEntry = routeKey === "settings"
      ? { routeKey, backgroundKey: visibleRouteFor(current) }
      : { routeKey };
    history.splice(historyIndex + 1);
    history.push(nextEntry);
    historyIndex = history.length - 1;
    renderRoute(nextEntry);
  };

  const closeSettings = () => {
    if (currentEntry().routeKey !== "settings") return;
    if (historyIndex > 0) {
      historyIndex -= 1;
      renderRoute(currentEntry(), false);
      settingsButton.focus();
      return;
    }
    const fallback = { routeKey: currentEntry().backgroundKey || "home" };
    history[0] = fallback;
    renderRoute(fallback);
    settingsButton.focus();
  };

  shell.addEventListener("click", (event) => {
    if (event.target.closest("[data-app-close-settings]")) {
      closeSettings();
      return;
    }
    const routeButton = event.target.closest("[data-app-route]");
    if (routeButton) navigate(routeButton.dataset.appRoute);
  });

  shell.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && currentEntry().routeKey === "settings") {
      event.preventDefault();
      closeSettings();
    }
  });

  back.addEventListener("click", () => {
    if (historyIndex === 0) return;
    historyIndex -= 1;
    renderRoute(currentEntry());
  });

  forward.addEventListener("click", () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    renderRoute(currentEntry());
  });

  renderRoute(currentEntry(), false);
})();
