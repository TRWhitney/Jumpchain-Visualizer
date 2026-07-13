import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { installedPackages as defaultInstalledPackages } from "../tracker/fixtures";
import type { InstalledPackage } from "../tracker/model";
import { accentTokens } from "./appearance";
import { EventPipeline } from "./logging";
import {
  defaultSettings,
  hydrateSettings,
  type ApplicationSettings,
} from "./model";
import {
  createReportExporter,
  createSettingsRepository,
  type ReportExporter,
  type SettingsRepository,
} from "./repository";
import { createDefaultTagProfile, hydrateTagProfile } from "./tagProfile";
import { SettingsContext, type SettingsContextValue } from "./SettingsContext";

class SettingsSource {
  #value: ApplicationSettings;

  constructor(initial: ApplicationSettings) {
    this.#value = initial;
  }

  read = () => this.#value;
  write = (value: ApplicationSettings) => {
    this.#value = value;
  };
}

export function SettingsProvider({
  children,
  repository,
  reportExporter,
  installedPackages = defaultInstalledPackages,
}: {
  children: ReactNode;
  repository?: SettingsRepository;
  reportExporter?: ReportExporter;
  installedPackages?: readonly InstalledPackage[];
}) {
  const initial = useMemo(() => defaultSettings(createDefaultTagProfile()), []);
  const [settings, setSettings] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [settingsSource] = useState(() => new SettingsSource(initial));
  const [persistedSource] = useState(() => new SettingsSource(initial));
  const actualRepository = useMemo(
    () => repository ?? createSettingsRepository(),
    [repository],
  );
  const actualExporter = useMemo(
    () => reportExporter ?? createReportExporter(),
    [reportExporter],
  );
  const [logger] = useState(
    () =>
      new EventPipeline(
        settingsSource.read,
        () => window.location.pathname.split("/")[1] || "home",
      ),
  );
  const saveTimer = useRef<number | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  const latestRequestedRevision = useRef(0);
  const continuousPublishTimer = useRef<number | null>(null);
  const continuousAuditTimer = useRef<number | null>(null);
  const pendingContinuous = useRef<{
    next: ApplicationSettings;
    settingKey: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    actualRepository
      .load()
      .then((stored) => {
        if (!active) return;
        if (stored) {
          const hydrated = hydrateSettings(
            stored,
            initial.tags.profile,
            hydrateTagProfile,
          );
          settingsSource.write(hydrated);
          persistedSource.write(hydrated);
          setSettings(hydrated);
          if (JSON.stringify(stored) !== JSON.stringify(hydrated))
            logger.emit("storage.recovery_used", {
              attributes: { aggregate: "settings", reason: "invalid-values" },
            });
        }
        setLoaded(true);
        logger.emit("app.started", {
          attributes: {
            routeKind: window.location.pathname.split("/")[1] || "home",
            appVersion: "0.1.0",
          },
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoaded(true);
        logger.emit("storage.recovery_used", {
          attributes: { aggregate: "settings", reason: "read-failed" },
          error,
        });
      });
    return () => {
      active = false;
    };
  }, [
    actualRepository,
    initial.tags.profile,
    logger,
    persistedSource,
    settingsSource,
  ]);

  const persist = useCallback(
    (next: ApplicationSettings, continuous: boolean) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const save = () => {
        saveTimer.current = null;
        const revision = ++saveRevision.current;
        latestRequestedRevision.current = revision;
        saveQueue.current = saveQueue.current
          .catch(() => undefined)
          .then(() => actualRepository.save(next))
          .then(() => persistedSource.write(next))
          .catch((error: unknown) => {
            if (revision === latestRequestedRevision.current) {
              const persisted = persistedSource.read();
              settingsSource.write(persisted);
              setSettings(persisted);
            }
            logger.emit("storage.write_failed", {
              attributes: {
                aggregate: "settings",
                errorCode: "SETTINGS_WRITE_FAILED",
              },
              error,
            });
          });
      };
      if (continuous) saveTimer.current = window.setTimeout(save, 250);
      else save();
    },
    [actualRepository, logger, persistedSource, settingsSource],
  );

  const update = useCallback<SettingsContextValue["update"]>(
    (updater, settingKey, continuous = false) => {
      const previous = settingsSource.read();
      const next = updater(previous);
      settingsSource.write(next);
      persist(next, continuous);
      if (!continuous) {
        if (continuousPublishTimer.current)
          window.clearTimeout(continuousPublishTimer.current);
        if (continuousAuditTimer.current)
          window.clearTimeout(continuousAuditTimer.current);
        continuousPublishTimer.current = null;
        continuousAuditTimer.current = null;
        pendingContinuous.current = null;
        setSettings(next);
        logger.emit("settings.value.changed", { attributes: { settingKey } });
        if (settingKey.startsWith("notifications."))
          logger.syncNotificationPreferences();
        return;
      }
      pendingContinuous.current = { next, settingKey };
      if (!continuousPublishTimer.current)
        continuousPublishTimer.current = window.setTimeout(() => {
          continuousPublishTimer.current = null;
          const pending = pendingContinuous.current;
          if (!pending) return;
          setSettings(pending.next);
          if (pending.settingKey.startsWith("notifications."))
            logger.syncNotificationPreferences();
        }, 32);
      if (continuousAuditTimer.current)
        window.clearTimeout(continuousAuditTimer.current);
      continuousAuditTimer.current = window.setTimeout(() => {
        continuousAuditTimer.current = null;
        const pending = pendingContinuous.current;
        if (!pending) return;
        logger.emit("settings.value.changed", {
          attributes: { settingKey: pending.settingKey },
        });
        pendingContinuous.current = null;
      }, 300);
    },
    [logger, persist, settingsSource],
  );

  const replace = useCallback<SettingsContextValue["replace"]>(
    (next, settingKey) => {
      if (continuousPublishTimer.current)
        window.clearTimeout(continuousPublishTimer.current);
      if (continuousAuditTimer.current)
        window.clearTimeout(continuousAuditTimer.current);
      continuousPublishTimer.current = null;
      continuousAuditTimer.current = null;
      pendingContinuous.current = null;
      settingsSource.write(next);
      setSettings(next);
      persist(next, false);
      logger.emit("settings.value.changed", { attributes: { settingKey } });
      if (settingKey.startsWith("notifications."))
        logger.syncNotificationPreferences();
    },
    [logger, persist, settingsSource],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const theme =
        settings.appearance.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.appearance.theme;
      const reduced =
        settings.accessibility.motion === "system"
          ? motion.matches
          : settings.accessibility.motion === "reduced";
      document.documentElement.dataset.appTheme = theme;
      document.documentElement.dataset.appMotion = reduced ? "reduced" : "full";
      for (const [name, value] of Object.entries(
        accentTokens(settings.appearance.accentColor, theme),
      ))
        document.documentElement.style.setProperty(name, value);
    };
    apply();
    media.addEventListener("change", apply);
    motion.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      motion.removeEventListener("change", apply);
    };
  }, [settings.appearance, settings.accessibility.motion]);

  useEffect(
    () => () => {
      if (continuousPublishTimer.current)
        window.clearTimeout(continuousPublishTimer.current);
      if (continuousAuditTimer.current)
        window.clearTimeout(continuousAuditTimer.current);
    },
    [],
  );

  const value: SettingsContextValue = {
    settings,
    update,
    replace,
    logger,
    reportExporter: actualExporter,
    installedPackages,
  };

  if (!loaded)
    return (
      <div className="app-settings-loading" role="status">
        Loading local preferences…
      </div>
    );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
