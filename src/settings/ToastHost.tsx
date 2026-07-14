import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings, useToasts } from "./SettingsContext";
import type { ToastRecord } from "./logging";

export function ToastHost() {
  const toasts = useToasts();
  const { settings, logger } = useSettings();
  return (
    <div className="app-toast-host" aria-label="Application notifications">
      <div aria-live="polite" aria-atomic="false">
        {toasts
          .slice(0, settings.notifications.maxVisible)
          .filter(
            (toast) => toast.severity !== "error" && toast.severity !== "fatal",
          )
          .map((toast) => (
            <Toast key={toast.id} toast={toast} logger={logger} />
          ))}
      </div>
      <div aria-live="assertive" aria-atomic="true">
        {toasts
          .slice(0, settings.notifications.maxVisible)
          .filter(
            (toast) => toast.severity === "error" || toast.severity === "fatal",
          )
          .map((toast) => (
            <Toast key={toast.id} toast={toast} logger={logger} />
          ))}
      </div>
    </div>
  );
}

function Toast({
  toast,
  logger,
}: {
  toast: ToastRecord;
  logger: ReturnType<typeof useSettings>["logger"];
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.durationMs);
  const started = useRef(0);
  const occurrence = useRef(toast.occurrences);
  const dismiss = useCallback(
    () => logger.dismissToast(toast.id),
    [logger, toast.id],
  );
  const invokeAction = useCallback(() => {
    try {
      toast.action?.invoke();
    } finally {
      dismiss();
    }
  }, [dismiss, toast.action]);
  useEffect(() => {
    if (paused) return;
    if (occurrence.current !== toast.occurrences) {
      occurrence.current = toast.occurrences;
      remaining.current = toast.durationMs;
    }
    started.current = Date.now();
    const timer = window.setTimeout(dismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started.current),
      );
    };
  }, [dismiss, paused, toast.durationMs, toast.occurrences]);
  return (
    <article
      className={`app-toast is-${toast.severity}${toast.appearance ? ` is-${toast.appearance}` : ""}`}
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span aria-hidden="true">
        {toast.appearance === "danger"
          ? "×"
          : toast.severity === "error" || toast.severity === "fatal"
            ? "!"
            : "✓"}
      </span>
      <div>
        <p>{toast.message}</p>
        <small>
          {toast.class.replaceAll("-", " ")}
          {toast.occurrences > 1 ? ` · ${toast.occurrences} occurrences` : ""}
        </small>
      </div>
      <div className="app-toast-actions">
        {toast.action && (
          <button
            type="button"
            className="app-toast-action"
            onClick={invokeAction}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          className="app-toast-dismiss"
          aria-label="Dismiss notification"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </article>
  );
}
