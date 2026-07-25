import { ReviewSupplements } from "../supplements/ReviewSupplements";
import { ReviewChainTracker } from "../tracker/ReviewChainTracker";
import { AppShell } from "./AppShell";
import { SettingsProvider } from "../settings/SettingsProvider";
import { ToastHost } from "../settings/ToastHost";
import { CrashBoundary } from "../settings/CrashBoundary";
import { ContextMenuProvider } from "../ui";
import "../settings/settings.css";

export function App() {
  if (window.location.pathname === "/review/chain-tracker")
    return (
      <ContextMenuProvider>
        <SettingsProvider>
          <ReviewChainTracker />
          <ToastHost />
        </SettingsProvider>
      </ContextMenuProvider>
    );
  if (window.location.pathname === "/review/supplements")
    return (
      <ContextMenuProvider>
        <ReviewSupplements />
      </ContextMenuProvider>
    );
  return (
    <SettingsProvider>
      <ContextMenuProvider>
        <CrashBoundary>
          <AppShell />
          <ToastHost />
        </CrashBoundary>
      </ContextMenuProvider>
    </SettingsProvider>
  );
}
