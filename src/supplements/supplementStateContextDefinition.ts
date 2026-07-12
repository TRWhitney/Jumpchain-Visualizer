import { createContext } from "react";
import type { SupplementAction, SupplementState } from "./supplementState";
export type SupplementStateContextValue = {
  state: SupplementState;
  dispatch: React.Dispatch<SupplementAction>;
};
export const SupplementStateContext =
  createContext<SupplementStateContextValue | null>(null);
