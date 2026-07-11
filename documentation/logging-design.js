(() => {
  const levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
  const eventDetails = {
    "app.started": { correlation: "op-011a", attributes: ["routeKind=home", "appVersion=0.1.0"], stack: "No stack trace: expected informational event." },
    "logging.buffer.near_limit": { correlation: "op-7f2c", attributes: ["usageBand=high", "operation=session-log"], stack: "SessionBufferWarning: session log nearing its limit\n  at SessionLog.append (logging/session-log.ts:84:11)\n  at EventPipeline.emit (logging/event-pipeline.ts:52:9)" },
    "package.parse.failed": { correlation: "op-b491", attributes: ["errorCode=JDEF_UNEXPECTED_FIELD", "line=42", "column=7"], stack: "MarkupParseError: unexpected field at line 42, column 7\n  at Parser.readField (markup/parser.ts:311:15)\n  at PackageLoader.validate (packages/loader.ts:144:22)\n  at ImportCommand.run (packages/import-command.ts:61:9)" },
    "renderer.cache.reused": { correlation: "op-c203", attributes: ["routeKind=editor", "cache=layout"], stack: "No stack trace: expected debug event." },
  };

  document.querySelectorAll(".logging-viewer").forEach((viewer) => {
    const levelButtons = [...viewer.querySelectorAll("[data-log-level]")];
    const events = [...viewer.querySelectorAll("[data-log-event]")];
    const search = viewer.querySelector("[data-logging-search]");
    const empty = viewer.querySelector("[data-logging-empty]");
    const detailTitle = viewer.querySelector("[data-logging-detail-title]");
    const detailSeverity = viewer.querySelector("[data-logging-detail-severity]");
    const detailCategory = viewer.querySelector("[data-logging-detail-category]");
    const detailCorrelation = viewer.querySelector("[data-logging-detail-correlation]");
    const detailAttributes = viewer.querySelector("[data-logging-detail-attributes]");
    const detailStack = viewer.querySelector("[data-logging-detail-stack]");
    const message = viewer.querySelector("[data-logging-message]");
    let minimumLevel = "debug";
    let selectedEventName = events[0]?.querySelector("code")?.textContent ?? "";

    const reportText = () => {
      const detail = eventDetails[selectedEventName];
      return [
        `Event: ${selectedEventName}`,
        `Severity: ${detailSeverity.textContent}`,
        `Correlation: ${detail?.correlation ?? "none"}`,
        "App: Jumpchain Visualizer 0.1.0",
        "Runtime: Local app · Example OS · Example architecture",
        `Attributes: ${(detail?.attributes ?? []).join(", ")}`,
        "Stack trace:",
        detail?.stack ?? "Unavailable",
        "Recent session events:",
        ...events.slice(-20).map((eventButton) => `${eventButton.querySelector("time").textContent} ${eventButton.dataset.severity.toUpperCase()} ${eventButton.querySelector("code").textContent}`),
      ].join("\n");
    };

    const selectEvent = (eventButton, moveFocus = false) => {
      if (!eventButton || eventButton.hidden) return;
      events.forEach((candidate) => candidate.classList.toggle("is-selected", candidate === eventButton));
      selectedEventName = eventButton.querySelector("code").textContent;
      const detail = eventDetails[selectedEventName] ?? { correlation: "none", attributes: [], stack: "No stack trace available." };
      detailTitle.textContent = selectedEventName;
      detailSeverity.textContent = eventButton.dataset.severity[0].toUpperCase() + eventButton.dataset.severity.slice(1);
      detailCategory.textContent = selectedEventName.split(".")[0];
      detailCorrelation.textContent = detail.correlation;
      detailAttributes.replaceChildren(...detail.attributes.map((attribute) => {
        const line = document.createElement("code");
        line.textContent = attribute;
        return line;
      }));
      detailStack.textContent = detail.stack;
      message.textContent = "";
      if (moveFocus) eventButton.focus();
    };

    const applyFilters = () => {
      const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const minimum = levels[minimumLevel];
      events.forEach((eventButton) => {
        const levelMatches = levels[eventButton.dataset.severity] >= minimum;
        const searchMatches = terms.every((term) => eventButton.dataset.search.includes(term));
        eventButton.hidden = viewer.dataset.logsCleared === "true" || !(levelMatches && searchMatches);
      });
      const visible = events.filter((eventButton) => !eventButton.hidden);
      empty.hidden = visible.length !== 0;
      empty.textContent = viewer.dataset.logsCleared === "true" ? "Session logs cleared." : "No events match the current filters.";
      const selected = events.find((eventButton) => eventButton.classList.contains("is-selected") && !eventButton.hidden);
      if (!selected && visible.length) selectEvent(visible[0]);
    };

    levelButtons.forEach((button) => button.addEventListener("click", () => {
      minimumLevel = button.dataset.logLevel;
      levelButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
      applyFilters();
    }));
    events.forEach((eventButton) => eventButton.addEventListener("click", () => selectEvent(eventButton)));
    search.addEventListener("input", applyFilters);
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !search.value) return;
      search.value = "";
      applyFilters();
    });
    viewer.querySelector("[data-log-export]")?.addEventListener("click", () => {
      message.textContent = "Session export prepared with environment details and full application stack traces.";
    });
    viewer.querySelector("[data-log-clear]")?.addEventListener("click", () => {
      viewer.dataset.logsCleared = "true";
      applyFilters();
      message.textContent = "Session log cleared.";
    });
    viewer.querySelector("[data-log-copy-report]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(reportText());
        message.textContent = "Crash report copied. Review it before posting to GitHub.";
      } catch {
        message.textContent = "Clipboard access is unavailable in this documentation preview.";
      }
    });
    viewer.querySelector("[data-log-github]")?.addEventListener("click", () => {
      message.textContent = "The application would open its GitHub Issues page; attach or paste the reviewed report.";
    });

    selectEvent(events[1] ?? events[0]);
    applyFilters();
  });
})();
