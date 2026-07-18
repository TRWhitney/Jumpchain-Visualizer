import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./model";
import { createDefaultTagProfile } from "./tagProfile";
import { EventPipeline } from "./logging";

const createPipeline = () => {
  const settings = defaultSettings(createDefaultTagProfile());
  return {
    settings,
    pipeline: new EventPipeline(
      () => settings,
      () => "settings",
    ),
  };
};

afterEach(() => vi.useRealTimers());

describe("session event pipeline", () => {
  it("uses a closed catalog, allowlisted attributes, and debug gating", () => {
    const { pipeline } = createPipeline();
    expect(pipeline.emit("not.registered")).toBeNull();
    expect(
      pipeline.emit("renderer.cache.reused", {
        attributes: { routeKind: "settings", cache: "profile" },
      }),
    ).toBeNull();
    pipeline.setDebugCapture(true);
    const event = pipeline.emit("renderer.cache.reused", {
      attributes: {
        routeKind: "settings\nforged",
        cache: "profile",
        secret: "must not survive",
      },
    });
    expect(event?.attributes).toEqual({
      routeKind: "settings forged",
      cache: "profile",
    });
  });

  it("coalesces correlated repeats and filters by severity and query", () => {
    const { pipeline } = createPipeline();
    pipeline.emit("app.started", {
      correlationId: "same",
      attributes: { routeKind: "home", appVersion: "0.1.0" },
    });
    pipeline.emit("app.started", {
      correlationId: "same",
      attributes: { routeKind: "home", appVersion: "0.1.0" },
    });
    expect(pipeline.snapshot()).toHaveLength(1);
    expect(pipeline.snapshot()[0].occurrences).toBe(2);
    expect(pipeline.filtered("info", "app")).toHaveLength(1);
    expect(pipeline.filtered("warn", "app")).toHaveLength(0);
  });

  it("projects enabled notification classes after the documented debounce", () => {
    vi.useFakeTimers();
    const { pipeline } = createPipeline();
    pipeline.emit("settings.notification.previewed");
    expect(pipeline.toastSnapshot()).toHaveLength(0);
    vi.advanceTimersByTime(500);
    expect(pipeline.toastSnapshot()).toHaveLength(1);
    pipeline.emit("settings.notification.previewed");
    vi.advanceTimersByTime(500);
    expect(pipeline.toastSnapshot()[0].occurrences).toBe(2);
    pipeline.emit("chain.choice.overspend_blocked", {
      attributes: { entryId: "entry-1", actorId: "jumper" },
    });
    vi.advanceTimersByTime(500);
    expect(
      pipeline
        .toastSnapshot()
        .some(
          (toast) =>
            toast.message === "Choice rejected, negative balance" &&
            toast.appearance === "danger",
        ),
    ).toBe(true);
  });

  it("routes Editor format and Quick Fix outcomes through confirmation preferences", () => {
    vi.useFakeTimers();
    const { pipeline, settings } = createPipeline();
    pipeline.emit("editor.format.succeeded");
    pipeline.emit("editor.quick_fix.noop");
    vi.advanceTimersByTime(500);
    expect(pipeline.toastSnapshot().map((toast) => toast.message)).toEqual(
      expect.arrayContaining(["Format successful", "Nothing to fix"]),
    );

    settings.notifications.classes.confirmations = false;
    pipeline.syncNotificationPreferences();
    pipeline.emit("editor.format.noop");
    vi.runAllTimers();
    expect(
      pipeline
        .toastSnapshot()
        .some((toast) => toast.message === "Nothing to format"),
    ).toBe(false);
  });

  it("carries actions through the shared toast lifecycle", () => {
    vi.useFakeTimers();
    const { pipeline } = createPipeline();
    const invoke = vi.fn();
    const onDismiss = vi.fn();
    pipeline.emit("chain.reordered", {
      attributes: { dependencyReview: false },
      toast: { action: { label: "Undo", invoke }, onDismiss },
    });

    vi.advanceTimersByTime(500);
    const toast = pipeline.toastSnapshot()[0];
    expect(toast.message).toBe("Reorder complete.");
    expect(toast.action?.label).toBe("Undo");
    toast.action?.invoke();
    expect(invoke).toHaveBeenCalledOnce();
    pipeline.dismissToast(toast.id);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("suppresses actionable toasts with their notification class", () => {
    vi.useFakeTimers();
    const { pipeline, settings } = createPipeline();
    settings.notifications.classes.chain = false;
    const onDismiss = vi.fn();
    pipeline.emit("chain.reordered", {
      attributes: { dependencyReview: false },
      toast: {
        action: { label: "Undo", invoke: vi.fn() },
        onDismiss,
      },
    });

    vi.runAllTimers();
    expect(pipeline.toastSnapshot()).toHaveLength(0);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses visible actionable toasts when preferences hide them", () => {
    vi.useFakeTimers();
    const { pipeline, settings } = createPipeline();
    const onDismiss = vi.fn();
    pipeline.emit("chain.reordered", {
      attributes: { dependencyReview: false },
      toast: {
        action: { label: "Undo", invoke: vi.fn() },
        onDismiss,
      },
    });
    vi.advanceTimersByTime(500);

    settings.notifications.classes.chain = false;
    pipeline.syncNotificationPreferences();
    expect(pipeline.toastSnapshot()).toHaveLength(0);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("retains high-severity events while evicting the oldest low-severity records", () => {
    const { pipeline } = createPipeline();
    pipeline.emit("app.crashed", {
      correlationId: "fatal",
      error: new Error("retain me"),
    });
    for (let index = 0; index < 2_005; index += 1)
      pipeline.emit("app.started", {
        correlationId: `startup-${index}`,
        attributes: { routeKind: "home", appVersion: "0.1.0" },
      });
    expect(pipeline.snapshot()).toHaveLength(2_000);
    expect(
      pipeline.snapshot().some((event) => event.correlationId === "fatal"),
    ).toBe(true);
    expect(
      pipeline.snapshot().some((event) => event.correlationId === "startup-0"),
    ).toBe(false);
  });

  it("redacts user paths and secrets from errors and diagnostic reports", () => {
    const { pipeline } = createPipeline();
    const error = new Error("safe summary");
    error.stack =
      "Error: safe summary\n at /home/alice/private.ts?token=secret";
    const event = pipeline.emit("package.parse.failed", {
      attributes: { errorCode: "PARSE", line: 4, column: 8 },
      error,
    });
    const report = pipeline.report(event);
    expect(report).toContain("<user-dir>");
    expect(report).toContain("token=<redacted>");
    expect(report).not.toContain("alice");
    expect(report).not.toContain("token=secret");
  });
});
