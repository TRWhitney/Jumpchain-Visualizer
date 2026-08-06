import { createContext, useContext, useSyncExternalStore } from "react";
import type { EventPipeline } from "./logging";
import type { ApplicationSettings, EffectiveTheme } from "./model";
import type { ReportExporter } from "./repository";
import type { InstalledPackage } from "../tracker/model";

export type SettingsContextValue = {
  settings: ApplicationSettings;
  effectiveTheme: EffectiveTheme;
  update: (
    updater: (settings: ApplicationSettings) => ApplicationSettings,
    settingKey: string,
    continuous?: boolean,
  ) => void;
  replace: (settings: ApplicationSettings, settingKey: string) => void;
  logger: EventPipeline;
  reportExporter: ReportExporter;
  installedPackages: readonly InstalledPackage[];
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("SettingsProvider is missing.");
  return context;
};

export const useOptionalSettings = () => useContext(SettingsContext);

export const useSessionEvents = () => {
  const { logger } = useSettings();
  return useSyncExternalStore(
    logger.subscribe,
    logger.snapshot,
    logger.snapshot,
  );
};

export const useToasts = () => {
  const { logger } = useSettings();
  return useSyncExternalStore(
    logger.subscribeToasts,
    logger.toastSnapshot,
    logger.toastSnapshot,
  );
};
