import { useContext } from "react";
import { SupplementStateContext } from "./supplementStateContextDefinition";
export function useSupplementState() {
  const value = useContext(SupplementStateContext);
  if (!value)
    throw new Error(
      "useSupplementState must be used within SupplementStateProvider",
    );
  return value;
}
