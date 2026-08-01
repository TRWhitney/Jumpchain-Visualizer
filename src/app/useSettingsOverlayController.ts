import { useCallback, useMemo, useRef, useState } from "react";
import type { SettingsCategory } from "../settings/model";
import type { ShellHistoryState } from "./useShellHistory";

export function settingsCloseAction(
  backgroundPath: string | null,
  historyIndex: number,
) {
  return backgroundPath && historyIndex > 0 ? "back" : "home";
}

export function useSettingsOverlayController({
  routeIsSettings,
  pathname,
  backgroundPath,
  historyIndex,
  navigate,
}: {
  routeIsSettings: boolean;
  pathname: string;
  backgroundPath: string | null;
  historyIndex: number;
  navigate: (path: string, state?: Partial<ShellHistoryState>) => void;
}) {
  const [category, setCategory] = useState<SettingsCategory>("general");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const open = useCallback(() => {
    if (routeIsSettings) return;
    navigate("/settings", { settingsBackgroundPath: pathname });
  }, [navigate, pathname, routeIsSettings]);

  const close = useCallback(() => {
    restoreFocus.current = Boolean(backgroundPath);
    if (settingsCloseAction(backgroundPath, historyIndex) === "back")
      window.history.back();
    else navigate("/");
  }, [backgroundPath, historyIndex, navigate]);

  const toggle = useCallback(() => {
    if (routeIsSettings) close();
    else open();
  }, [close, open, routeIsSettings]);

  const restoreAfterNavigation = useCallback(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    buttonRef.current?.focus();
  }, []);
  const commands = useMemo(
    () => ({ setCategory, open, close, toggle, restoreAfterNavigation }),
    [close, open, restoreAfterNavigation, toggle],
  );

  return {
    category,
    buttonRef,
    commands,
  } as const;
}
