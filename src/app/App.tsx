import { ReviewSupplements } from "../supplements/ReviewSupplements";
import { ReviewChainTracker } from "../tracker/ReviewChainTracker";
import { AppShell } from "./AppShell";
import { SettingsProvider } from "../settings/SettingsProvider";
import { ToastHost } from "../settings/ToastHost";
import { CrashBoundary } from "../settings/CrashBoundary";

export function App() {
  if (window.location.pathname === "/review/chain-tracker")
    return <ReviewChainTracker />;
  if (window.location.pathname === "/review/supplements")
    return <ReviewSupplements />;
  return (
    <SettingsProvider>
      <CrashBoundary>
        <AppShell />
        <ToastHost />
      </CrashBoundary>
    </SettingsProvider>
  );
}
