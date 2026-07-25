import { useState } from "react";
import { useSessionEvents, useSettings } from "./SettingsContext";
import type { LogEvent, LogSeverity } from "./logging";
import { translate } from "../localization";
import { useContextMenu } from "../ui";

const levels: LogSeverity[] = ["debug", "info", "warn", "error"];

export function LoggingViewer() {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const events = useSessionEvents();
  const { logger, reportExporter } = useSettings();
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState<LogSeverity>("debug");
  const visible = logger.filtered(minimum, query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"filtered" | "complete">(
    "filtered",
  );
  const selected =
    visible.find((event) => event.id === selectedId) ?? visible[0] ?? null;

  const copyReport = async (event = selected) => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(logger.report(event));
      setMessage("Diagnostic report copied. Review it before sharing.");
    } catch {
      setMessage("Clipboard access is unavailable.");
    }
  };
  const saveReport = async (event = selected) => {
    if (!event) return;
    const result = await reportExporter.save(
      "jumpchain-visualizer-report.txt",
      logger.report(event),
    );
    setMessage(
      result === "saved" ? "Diagnostic report saved." : "Save cancelled.",
    );
  };
  const exportEvents = exportScope === "filtered" ? visible : events;
  const counts = levels.map((level) => ({
    level,
    count: exportEvents.filter(
      (event) =>
        event.severity === level ||
        (level === "error" && event.severity === "fatal"),
    ).length,
  }));

  return (
    <div className="logging-viewer" data-toc-ignore>
      <header>
        <div>
          <p>{translate("ui.loggingViewer.text.sessionDiagnostics")}</p>
          <h3>{translate("ui.loggingViewer.text.recentEvents")}</h3>
        </div>
        <div>
          <button type="button" onClick={() => setExportOpen(true)}>
            {translate("ui.loggingViewer.text.export")}
          </button>
          <button
            type="button"
            onClick={() => {
              logger.clear();
              setMessage("Session log cleared.");
            }}
          >
            {translate("ui.loggingViewer.text.clearSession")}
          </button>
        </div>
      </header>
      <div className="logging-viewer-toolbar">
        <label>
          <span className="sr-only">
            {translate("ui.loggingViewer.text.searchLoggedEvents")}
          </span>
          <input
            type="search"
            spellCheck={false}
            value={query}
            placeholder={translate(
              "ui.loggingViewer.placeholder.findEventOrCategory",
            )}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
        </label>
        <div
          role="group"
          aria-label={translate("ui.loggingViewer.ariaLabel.minimumSeverity")}
        >
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={minimum === level}
              onClick={() => setMinimum(level)}
            >
              {level[0].toUpperCase() + level.slice(1)}+
            </button>
          ))}
        </div>
      </div>
      <div className="logging-event-layout">
        <div
          className="logging-event-list"
          aria-label={translate(
            "ui.loggingViewer.ariaLabel.filteredSessionDiagnosticEvents",
          )}
        >
          {visible.map((event) => {
            const view = () => {
              setSelectedId(event.id);
              setMessage("");
            };
            const menu = {
              label: translate("ui.loggingViewer.ariaLabel.eventActions", {
                event: event.eventName,
              }),
              actions: [
                {
                  id: "view",
                  label: translate("common.viewDetails"),
                  onAction: view,
                },
                {
                  id: "copy",
                  label: translate("ui.loggingViewer.text.copyReport"),
                  onAction: () => void copyReport(event),
                },
                {
                  id: "save",
                  label: translate("ui.loggingViewer.text.saveReport"),
                  onAction: () => void saveReport(event),
                },
              ],
            };
            return (
              <button
                key={event.id}
                type="button"
                aria-haspopup="menu"
                className={
                  selected?.id === event.id ? "is-selected" : undefined
                }
                onContextMenu={(contextEvent) =>
                  openContextMenu(contextEvent, menu)
                }
                onKeyDown={(keyboardEvent) =>
                  openContextMenuFromKeyboard(keyboardEvent, menu)
                }
                onClick={view}
              >
                <span className={`log-severity ${event.severity}`}>
                  {event.severity}
                </span>
                <code>
                  {event.eventName}
                  {event.occurrences > 1 ? ` ×${event.occurrences}` : ""}
                </code>
                <time dateTime={event.timestamp}>
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour12: false,
                  })}
                </time>
              </button>
            );
          })}
          {!visible.length && (
            <p className="logging-empty">
              {events.length
                ? "No events match the current filters."
                : "Session logs cleared."}
            </p>
          )}
        </div>
        <LogDetail
          event={selected}
          message={message}
          onCopy={copyReport}
          onSave={saveReport}
        />
      </div>
      {exportOpen && (
        <div className="logging-export-backdrop" role="presentation">
          <section
            className="logging-export-review"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logging-export-heading"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setExportOpen(false);
                return;
              }
              if (event.key !== "Tab") return;
              const controls = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), input:not([disabled])",
                ),
              ];
              const first = controls[0];
              const last = controls.at(-1);
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <p>{translate("ui.loggingViewer.text.redactionPreview")}</p>
            <h4 id="logging-export-heading">
              {translate("ui.loggingViewer.text.exportSessionEvents")}
            </h4>
            <fieldset>
              <legend>
                {translate("ui.loggingViewer.text.eventsToInclude")}
              </legend>
              <label>
                <input
                  type="radio"
                  name="log-export"
                  checked={exportScope === "filtered"}
                  onChange={() => setExportScope("filtered")}
                />{" "}
                {translate("ui.loggingViewer.text.currentFilteredEvents")}
              </label>
              <label>
                <input
                  type="radio"
                  name="log-export"
                  checked={exportScope === "complete"}
                  onChange={() => setExportScope("complete")}
                />{" "}
                {translate("ui.loggingViewer.text.completeSession")}
              </label>
            </fieldset>
            <dl>
              {counts.map(({ level, count }) => (
                <div key={level}>
                  <dt>{level}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
            <p>
              {translate(
                "ui.loggingViewer.text.importedContentFilesystemNamesCredentialsAndURLSecretsAre",
              )}
            </p>
            <div>
              <button
                autoFocus
                type="button"
                onClick={async () => {
                  const result = await reportExporter.save(
                    "jumpchain-visualizer-session.jsonl",
                    logger.exportJsonLines(exportEvents),
                  );
                  setMessage(
                    result === "saved"
                      ? "Session export saved."
                      : "Export cancelled.",
                  );
                  setExportOpen(false);
                }}
              >
                {translate("ui.loggingViewer.text.saveJSONLines")}
              </button>
              <button type="button" onClick={() => setExportOpen(false)}>
                {translate("ui.loggingViewer.text.cancel")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function LogDetail({
  event,
  message,
  onCopy,
  onSave,
}: {
  event: LogEvent | null;
  message: string;
  onCopy: () => void;
  onSave: () => void;
}) {
  return (
    <section
      className="logging-event-detail"
      aria-label={translate(
        "ui.loggingViewer.ariaLabel.selectedLogEventDetails",
      )}
    >
      <p>{translate("ui.loggingViewer.text.selectedEvent")}</p>
      <h4>{event?.eventName ?? "No event selected"}</h4>
      <dl>
        <div>
          <dt>{translate("ui.loggingViewer.text.severity")}</dt>
          <dd>
            {event
              ? event.severity[0].toUpperCase() + event.severity.slice(1)
              : "—"}
          </dd>
        </div>
        <div>
          <dt>{translate("ui.loggingViewer.text.category")}</dt>
          <dd>{event?.category ?? "—"}</dd>
        </div>
        <div>
          <dt>{translate("ui.loggingViewer.text.correlation")}</dt>
          <dd>{event?.correlationId ?? "—"}</dd>
        </div>
        <div>
          <dt>{translate("ui.loggingViewer.text.safeAttributes")}</dt>
          <dd data-logging-detail-attributes>
            {event && Object.entries(event.attributes).length ? (
              Object.entries(event.attributes).map(([key, value]) => (
                <code key={key}>
                  {key}={String(value)}
                </code>
              ))
            ) : (
              <code>None</code>
            )}
          </dd>
        </div>
      </dl>
      <div className="logging-stack">
        <strong>{translate("ui.loggingViewer.text.stackTrace")}</strong>
        <pre data-native-context-menu="true">
          {event?.error?.stack ?? "No stack trace: expected application event."}
        </pre>
      </div>
      <div className="logging-report-actions">
        <button type="button" disabled={!event} onClick={onCopy}>
          {translate("ui.loggingViewer.text.copyReport")}
        </button>
        <button type="button" disabled={!event} onClick={onSave}>
          {translate("ui.loggingViewer.text.saveReport")}
        </button>
      </div>
      <p className="logging-viewer-message" role="status">
        {message}
      </p>
    </section>
  );
}
