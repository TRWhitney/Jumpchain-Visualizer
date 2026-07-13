import { ReviewSupplements } from "../supplements/ReviewSupplements";
import { ReviewChainTracker } from "../tracker/ReviewChainTracker";
import { AppShell } from "./AppShell";

export function App() {
  if (window.location.pathname === "/review/chain-tracker")
    return <ReviewChainTracker />;
  if (window.location.pathname === "/review/supplements")
    return <ReviewSupplements />;
  return <AppShell />;
}
