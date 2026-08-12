import { createContext } from "react";
import type { SupplementAction, SupplementState } from "./supplementState";
export type SupplementStateContextValue = {
  state: SupplementState;
  dispatch: React.Dispatch<SupplementAction>;
  entryLabels: Readonly<Record<string, string>>;
};
export const SupplementStateContext =
  createContext<SupplementStateContextValue | null>(null);
