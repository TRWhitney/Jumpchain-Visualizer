import { useCallback, useEffect, useState } from "react";

export type ShellHistoryState = {
  jvIndex?: number;
  settingsBackgroundPath?: string;
} & Record<string, unknown>;

export const historyIndexFromState = (state: unknown) => {
  const value = (state as ShellHistoryState | null)?.jvIndex;
  return typeof value === "number" ? value : 0;
};

export const settingsBackgroundFromLocation = (
  pathname: string,
  state: unknown,
) => {
  const backgroundPath = (state as ShellHistoryState | null)
    ?.settingsBackgroundPath;
  return pathname === "/settings" && typeof backgroundPath === "string"
    ? backgroundPath
    : null;
};

export function useShellHistory() {
  const initialIndex = historyIndexFromState(window.history.state);
  const [pathname, setPathname] = useState(window.location.pathname);
  const [settingsBackgroundPath, setSettingsBackgroundPath] = useState<
    string | null
  >(() =>
    settingsBackgroundFromLocation(
      window.location.pathname,
      window.history.state,
    ),
  );
  const [historyIndex, setHistoryIndex] = useState(initialIndex);
  const [historyMaximum, setHistoryMaximum] = useState(initialIndex);

  useEffect(() => {
    const state = (window.history.state as ShellHistoryState | null) ?? {};
    if (typeof state.jvIndex !== "number")
      window.history.replaceState({ ...state, jvIndex: 0 }, "");
    const onPopState = (event: PopStateEvent) => {
      setHistoryIndex(historyIndexFromState(event.state));
      setPathname(window.location.pathname);
      setSettingsBackgroundPath(
        settingsBackgroundFromLocation(window.location.pathname, event.state),
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const pushHistory = useCallback(
    (nextPath: string, extraState: Partial<ShellHistoryState> = {}) => {
      const nextIndex = historyIndex + 1;
      window.history.pushState(
        { jvIndex: nextIndex, ...extraState },
        "",
        nextPath,
      );
      setHistoryIndex(nextIndex);
      setHistoryMaximum(nextIndex);
      setPathname(nextPath);
      setSettingsBackgroundPath(
        settingsBackgroundFromLocation(nextPath, extraState),
      );
    },
    [historyIndex],
  );

  const replaceHistory = useCallback((nextPath: string, nextIndex: number) => {
    window.history.replaceState({ jvIndex: nextIndex }, "", nextPath);
    setHistoryIndex(nextIndex);
    setHistoryMaximum(nextIndex);
    setPathname(nextPath);
    setSettingsBackgroundPath(null);
  }, []);

  return {
    pathname,
    setPathname,
    settingsBackgroundPath,
    setSettingsBackgroundPath,
    historyIndex,
    historyMaximum,
    pushHistory,
    replaceHistory,
  };
}
