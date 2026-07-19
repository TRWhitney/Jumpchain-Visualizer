import type { ApplicationSettings, NotificationClass } from "./model";

export type LogSeverity = "debug" | "info" | "warn" | "error" | "fatal";
export type SafeAttribute = string | number | boolean;
export type LogError = {
  code: string;
  message: string;
  stack: string;
  causes: readonly string[];
};
type NotificationAppearance = "danger";
type EventNotification = {
  class: NotificationClass;
  messageKey: string;
  dedupeKey: string;
  appearance?: NotificationAppearance;
};
export type LogEvent = {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  eventName: string;
  category: string;
  sessionId: string;
  correlationId: string;
  appVersion: string;
  routeKind: string;
  attributes: Readonly<Record<string, SafeAttribute>>;
  notification?: EventNotification;
  error: LogError | null;
  occurrences: number;
};

export type EventDefinition = {
  severity: LogSeverity;
  category: string;
  attributes: readonly string[];
  notification?: EventNotification;
};

export const eventCatalog: Record<string, EventDefinition> = {
  "app.started": {
    severity: "info",
    category: "app",
    attributes: ["routeKind", "appVersion"],
  },
  "app.crashed": {
    severity: "fatal",
    category: "app",
    attributes: ["routeKind", "errorCode"],
    notification: {
      class: "errors",
      messageKey: "logging.app_crashed",
      dedupeKey: "app-crash",
    },
  },
  "storage.write_failed": {
    severity: "error",
    category: "storage",
    attributes: ["aggregate", "errorCode"],
    notification: {
      class: "errors",
      messageKey: "logging.storage_write_failed",
      dedupeKey: "settings-write",
    },
  },
  "storage.recovery_used": {
    severity: "warn",
    category: "storage",
    attributes: ["aggregate", "reason"],
    notification: {
      class: "errors",
      messageKey: "logging.storage_recovery_used",
      dedupeKey: "settings-recovery",
    },
  },
  "settings.value.changed": {
    severity: "info",
    category: "settings",
    attributes: ["settingKey"],
    notification: {
      class: "confirmations",
      messageKey: "logging.settings_value_changed",
      dedupeKey: "settings-change",
    },
  },
  "settings.value_rejected": {
    severity: "warn",
    category: "settings",
    attributes: ["settingKey", "reason"],
    notification: {
      class: "validation",
      messageKey: "logging.settings_value_rejected",
      dedupeKey: "settings-rejected",
    },
  },
  "settings.tag_profile.imported": {
    severity: "info",
    category: "settings",
    attributes: ["mode", "entryCount"],
    notification: {
      class: "confirmations",
      messageKey: "logging.settings_tag_profile_imported",
      dedupeKey: "tag-import",
    },
  },
  "settings.tag_profile.exported": {
    severity: "info",
    category: "settings",
    attributes: ["entryCount"],
    notification: {
      class: "confirmations",
      messageKey: "logging.settings_tag_profile_exported",
      dedupeKey: "tag-export",
    },
  },
  "settings.notification.previewed": {
    severity: "info",
    category: "settings",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.settings_notification_previewed",
      dedupeKey: "settings-preview",
    },
  },
  "chain.created": {
    severity: "info",
    category: "chain",
    attributes: ["jumpCount"],
    notification: {
      class: "chain",
      messageKey: "logging.chain_created",
      dedupeKey: "chain-create",
    },
  },
  "chain.details.updated": {
    severity: "info",
    category: "chain",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.chain_details_updated",
      dedupeKey: "chain-details",
    },
  },
  "chain.package.added": {
    severity: "info",
    category: "chain",
    attributes: ["source", "parallelVersion"],
    notification: {
      class: "chain",
      messageKey: "logging.chain_package_added",
      dedupeKey: "chain-package",
    },
  },
  "chain.package.blocked": {
    severity: "warn",
    category: "chain",
    attributes: ["reason"],
    notification: {
      class: "validation",
      messageKey: "logging.chain_package_blocked",
      dedupeKey: "chain-package-blocked",
    },
  },
  "chain.choice.overspend_blocked": {
    severity: "warn",
    category: "chain",
    attributes: ["entryId", "actorId"],
    notification: {
      class: "validation",
      messageKey: "logging.chain_choice_overspend_blocked",
      dedupeKey: "chain-choice-overspend",
      appearance: "danger",
    },
  },
  "chain.reordered": {
    severity: "info",
    category: "chain",
    attributes: ["dependencyReview"],
    notification: {
      class: "chain",
      messageKey: "logging.chain_reordered",
      dedupeKey: "chain-reorder",
    },
  },
  "chain.removed": {
    severity: "info",
    category: "chain",
    attributes: ["dependencyReview"],
    notification: {
      class: "chain",
      messageKey: "logging.chain_removed",
      dedupeKey: "chain-remove",
    },
  },
  "editor.format.succeeded": {
    severity: "info",
    category: "editor",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.editor_format_succeeded",
      dedupeKey: "editor-format-success",
    },
  },
  "editor.format.noop": {
    severity: "info",
    category: "editor",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.editor_format_noop",
      dedupeKey: "editor-format-noop",
    },
  },
  "editor.quick_fix.succeeded": {
    severity: "info",
    category: "editor",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.editor_quick_fix_succeeded",
      dedupeKey: "editor-quick-fix-success",
    },
  },
  "editor.quick_fix.noop": {
    severity: "info",
    category: "editor",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.editor_quick_fix_noop",
      dedupeKey: "editor-quick-fix-noop",
    },
  },
  "editor.format.failed": {
    severity: "error",
    category: "editor",
    attributes: [],
    notification: {
      class: "errors",
      messageKey: "logging.editor_format_failed",
      dedupeKey: "editor-format-failed",
    },
  },
  "editor.quick_fix.failed": {
    severity: "error",
    category: "editor",
    attributes: [],
    notification: {
      class: "errors",
      messageKey: "logging.editor_quick_fix_failed",
      dedupeKey: "editor-quick-fix-failed",
    },
  },
  "editor.asset.added": {
    severity: "info",
    category: "editor",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.editor_asset_added",
      dedupeKey: "editor-asset-added",
    },
  },
  "editor.asset.rejected": {
    severity: "warn",
    category: "editor",
    attributes: [],
    notification: {
      class: "validation",
      messageKey: "logging.editor_asset_rejected",
      dedupeKey: "editor-asset-rejected",
    },
  },
  "editor.asset.removed": {
    severity: "info",
    category: "editor",
    attributes: [],
    notification: {
      class: "confirmations",
      messageKey: "logging.editor_asset_removed",
      dedupeKey: "editor-asset-removed",
    },
  },
  "renderer.cache.reused": {
    severity: "debug",
    category: "renderer",
    attributes: ["routeKind", "cache"],
  },
  "package.parse.failed": {
    severity: "error",
    category: "package",
    attributes: ["errorCode", "line", "column"],
    notification: {
      class: "errors",
      messageKey: "logging.package_parse_failed",
      dedupeKey: "package-parse",
    },
  },
  "logging.buffer.near_limit": {
    severity: "warn",
    category: "logging",
    attributes: ["usageBand", "operation"],
  },
};

export type EventInput = {
  severity?: LogSeverity;
  attributes?: Record<string, SafeAttribute>;
  correlationId?: string;
  routeKind?: string;
  error?: unknown;
  toast?: ToastInteraction;
};

export type ToastInteraction = {
  action?: {
    label: string;
    invoke: () => void;
  };
  onDismiss?: () => void;
};

export type ToastRecord = {
  id: string;
  eventId: string;
  severity: LogSeverity;
  class: NotificationClass;
  messageKey: string;
  dedupeKey: string;
  occurrences: number;
  durationMs: number;
  appearance?: NotificationAppearance;
  action?: ToastInteraction["action"];
  onDismiss?: ToastInteraction["onDismiss"];
};

const severityRank: Record<LogSeverity, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};
const sanitize = (value: string, maximum = 512) =>
  value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
const redactStack = (stack: string) =>
  stack
    .replaceAll(
      /(?:[A-Za-z]:)?[\\/](?:Users|home)[\\/][^\\/\s)]+/g,
      "<user-dir>",
    )
    .replaceAll(/([?&#](?:token|key|secret)=)[^&#\s]+/gi, "$1<redacted>")
    .slice(0, 32_000);

const errorRecord = (value: unknown): LogError | null => {
  if (!value) return null;
  if (value instanceof Error) {
    const causes: string[] = [];
    let cause = value.cause;
    while (cause && causes.length < 8) {
      causes.push(
        sanitize(cause instanceof Error ? cause.message : String(cause)),
      );
      cause = cause instanceof Error ? cause.cause : undefined;
    }
    return {
      code: sanitize(value.name || "APPLICATION_ERROR", 80),
      message: sanitize(value.message || "Unexpected application error."),
      stack: redactStack(value.stack ?? "Stack trace unavailable."),
      causes,
    };
  }
  return {
    code: "APPLICATION_ERROR",
    message: sanitize(String(value)),
    stack: "Stack trace unavailable.",
    causes: [],
  };
};

const randomId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export class EventPipeline {
  readonly sessionId = randomId("session");
  private events: LogEvent[] = [];
  private toasts: ToastRecord[] = [];
  private debugCapture = false;
  private listeners = new Set<() => void>();
  private toastListeners = new Set<() => void>();
  private settings: () => ApplicationSettings;
  private route: () => string;
  private sequence = 0;
  private toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(settings: () => ApplicationSettings, route: () => string) {
    this.settings = settings;
    this.route = route;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  subscribeToasts = (listener: () => void) => {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  };
  snapshot = () => this.events;
  toastSnapshot = () => this.toasts;
  isDebugCaptureEnabled = () => this.debugCapture;
  setDebugCapture(enabled: boolean) {
    this.debugCapture = enabled;
  }

  emit(eventName: string, input: EventInput = {}) {
    const definition = eventCatalog[eventName];
    if (!definition) return null;
    const severity = input.severity ?? definition.severity;
    if (severity === "debug" && !this.debugCapture) return null;
    const attributes: Record<string, SafeAttribute> = {};
    for (const key of definition.attributes) {
      const value = input.attributes?.[key];
      if (["string", "number", "boolean"].includes(typeof value))
        attributes[key] =
          typeof value === "string" ? sanitize(value, 256) : value!;
    }
    const event: LogEvent = {
      id: `event-${++this.sequence}`,
      timestamp: new Date().toISOString(),
      severity,
      eventName,
      category: definition.category,
      sessionId: this.sessionId,
      correlationId: input.correlationId ?? randomId("op"),
      appVersion: "0.1.0",
      routeKind: sanitize(input.routeKind ?? this.route(), 40),
      attributes,
      notification: definition.notification,
      error: errorRecord(input.error),
      occurrences: 1,
    };
    const duplicate = this.events.at(-1);
    if (
      duplicate &&
      duplicate.eventName === eventName &&
      duplicate.correlationId === event.correlationId &&
      Date.parse(event.timestamp) - Date.parse(duplicate.timestamp) < 1000
    ) {
      duplicate.occurrences += 1;
      duplicate.timestamp = event.timestamp;
      this.notify();
      this.scheduleToast(duplicate, input.toast);
      return duplicate;
    }
    this.events = [...this.events, event];
    this.enforceBounds();
    this.notify();
    this.scheduleToast(event, input.toast);
    return event;
  }

  private enforceBounds() {
    const size = () => new Blob([JSON.stringify(this.events)]).size;
    while (this.events.length > 2000 || size() > 10 * 1024 * 1024) {
      let index = this.events.findIndex(
        (event) => severityRank[event.severity] < severityRank.error,
      );
      if (index < 0) index = 0;
      this.events = this.events.filter((_, candidate) => candidate !== index);
    }
  }

  private scheduleToast(event: LogEvent, interaction?: ToastInteraction) {
    const notification = event.notification;
    if (!notification) return;
    const preferences = this.settings().notifications;
    if (!preferences.enabled || !preferences.classes[notification.class]) {
      globalThis.setTimeout(() => interaction?.onDismiss?.(), 0);
      return;
    }
    const key = `${notification.class}:${notification.dedupeKey}`;
    const currentTimer = this.toastTimers.get(key);
    if (currentTimer) globalThis.clearTimeout(currentTimer);
    const timer = globalThis.setTimeout(() => {
      this.toastTimers.delete(key);
      const latestPreferences = this.settings().notifications;
      if (
        !latestPreferences.enabled ||
        !latestPreferences.classes[notification.class]
      ) {
        interaction?.onDismiss?.();
        return;
      }
      const existing = this.toasts.find((toast) => toast.dedupeKey === key);
      if (existing) {
        existing.occurrences += 1;
        existing.eventId = event.id;
        existing.severity = event.severity;
        existing.appearance = notification.appearance;
        existing.durationMs = latestPreferences.durationMs;
        existing.action = interaction?.action;
        existing.onDismiss = interaction?.onDismiss;
        this.toasts = [...this.toasts];
      } else {
        this.toasts = [
          ...this.toasts,
          {
            id: randomId("toast"),
            eventId: event.id,
            severity: event.severity,
            class: notification.class,
            messageKey: notification.messageKey,
            dedupeKey: key,
            occurrences: 1,
            durationMs: latestPreferences.durationMs,
            appearance: notification.appearance,
            action: interaction?.action,
            onDismiss: interaction?.onDismiss,
          },
        ].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
      }
      this.notifyToasts();
    }, 500);
    this.toastTimers.set(key, timer);
  }

  dismissToast(id: string) {
    const dismissed = this.toasts.find((toast) => toast.id === id);
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.notifyToasts();
    dismissed?.onDismiss?.();
  }
  syncNotificationPreferences() {
    const preferences = this.settings().notifications;
    const retained = preferences.enabled
      ? this.toasts.filter((toast) => preferences.classes[toast.class])
      : [];
    const dismissed = this.toasts.filter((toast) => !retained.includes(toast));
    this.toasts = retained;
    this.notifyToasts();
    for (const toast of dismissed) toast.onDismiss?.();
  }
  clear() {
    this.events = [];
    this.notify();
  }
  filtered(minimum: LogSeverity, query: string) {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return this.events.filter(
      (event) =>
        severityRank[event.severity] >= severityRank[minimum] &&
        terms.every((term) =>
          `${event.eventName} ${event.category} ${JSON.stringify(event.attributes)}`
            .toLocaleLowerCase()
            .includes(term),
        ),
    );
  }
  exportJsonLines(events = this.events) {
    return events.map((event) => JSON.stringify(event)).join("\n");
  }
  report(event: LogEvent | null) {
    const selected = event ?? this.events.at(-1) ?? null;
    const preferences = this.settings();
    return [
      "Jumpchain Visualizer diagnostic report",
      `Session: ${this.sessionId}`,
      `App: 0.1.0`,
      `Runtime: ${navigator.userAgent}`,
      `Route: ${this.route()}`,
      `Preferences: ${JSON.stringify({ theme: preferences.appearance.theme, motion: preferences.accessibility.motion, notificationsEnabled: preferences.notifications.enabled, warnUpstreamChanges: preferences.chain.warnUpstreamChanges })}`,
      selected ? `Event: ${selected.eventName}` : "Event: none",
      selected ? `Severity: ${selected.severity}` : "Severity: none",
      selected ? `Correlation: ${selected.correlationId}` : "Correlation: none",
      selected
        ? `Attributes: ${JSON.stringify(selected.attributes)}`
        : "Attributes: {}",
      "Stack trace:",
      selected?.error?.stack ?? "No stack trace available.",
      "Cause chain:",
      ...(selected?.error?.causes.length
        ? selected.error.causes
        : ["No nested causes recorded."]),
      "Recent session events:",
      ...this.events
        .slice(-20)
        .map(
          (candidate) =>
            `${candidate.timestamp} ${candidate.severity.toUpperCase()} ${candidate.eventName}`,
        ),
      "Redaction: imported content, user paths, credentials, and URL secrets are excluded.",
    ].join("\n");
  }
  private notify() {
    for (const listener of this.listeners) listener();
  }
  private notifyToasts() {
    for (const listener of this.toastListeners) listener();
  }
}
